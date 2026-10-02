import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AaUiState } from "./aa/types";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type ConsentRow = {
  id: string;
  provider_consent_id: string | null;
  status: string;
  redirect_url: string | null;
  accounts: unknown;
  last_synced_at: string | null;
  last_error: string | null;
};

async function latestConsent(supabase: any, userId: string): Promise<ConsentRow | null> {
  const { data } = await supabase
    .from("aa_consents")
    .select("id,provider_consent_id,status,redirect_url,accounts,last_synced_at,last_error")
    .eq("user_id", userId)
    .not("status", "in", "(revoked,rejected,expired)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as ConsentRow) ?? null;
}

function toUi(row: ConsentRow | null): AaUiState {
  if (!row) return { kind: "not_connected" };
  if (row.status === "pending")
    return { kind: "pending", consentId: row.id, redirectUrl: row.redirect_url };
  if (row.status === "active")
    return {
      kind: "connected",
      consentId: row.id,
      lastSyncedAt: row.last_synced_at,
      accounts: Array.isArray(row.accounts) ? (row.accounts as any[]) : [],
    };
  return {
    kind: "error",
    consentId: row.id,
    message: row.last_error ?? "Bank connection needs attention.",
    reauth: row.status !== "error",
  };
}

export const getAaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AaUiState> => {
    const { getAaProvider } = await import("./aa/provider.server");
    const p = getAaProvider();
    if (!p.ok) return { kind: "not_configured", missing: p.missing };
    return toUi(await latestConsent(context.supabase, context.userId));
  });

export const startAaConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ redirectUrl: z.string().url().max(300) }).parse(d))
  .handler(async ({ context, data }) => {
    const { getAaProvider } = await import("./aa/provider.server");
    const p = getAaProvider();
    if (!p.ok) throw new Error("Account Aggregator is not configured yet.");
    const to = new Date();
    const from = new Date(to.getTime() - 365 * 864e5);
    const res = await p.provider.createConsent({
      userRef: context.userId,
      redirectUrl: data.redirectUrl,
      fromDate: from.toISOString(),
      toDate: to.toISOString(),
    });
    const db = await admin();
    const { error } = await db.from("aa_consents").insert({
      user_id: context.userId,
      provider: p.name,
      provider_consent_id: res.consentId,
      status: "pending",
      redirect_url: res.redirectUrl,
    });
    if (error) throw new Error(error.message);
    return { redirectUrl: res.redirectUrl };
  });

export const refreshAaConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AaUiState> => {
    const { getAaProvider } = await import("./aa/provider.server");
    const p = getAaProvider();
    if (!p.ok) return { kind: "not_configured", missing: p.missing };
    const row = await latestConsent(context.supabase, context.userId);
    if (!row?.provider_consent_id) return toUi(row);
    const db = await admin();
    try {
      const s = await p.provider.getConsentStatus(row.provider_consent_id);
      await db
        .from("aa_consents")
        .update({ status: s.status, accounts: s.accounts, last_error: null, updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("user_id", context.userId);
    } catch (e) {
      await db.from("aa_consents").update({ status: "error", last_error: String((e as Error).message ?? e) }).eq("id", row.id);
    }
    return toUi(await latestConsent(context.supabase, context.userId));
  });

export const syncAaTransactions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAaProvider } = await import("./aa/provider.server");
    const { normalizeRebitAccount, aaDedupeKey } = await import("./aa/normalize");
    const { filterDuplicates } = await import("./txn-dedupe");
    const p = getAaProvider();
    if (!p.ok) throw new Error("Account Aggregator is not configured yet.");
    const row = await latestConsent(context.supabase, context.userId);
    if (!row || row.status !== "active" || !row.provider_consent_id)
      throw new Error("Connect and approve a bank account first.");

    const db = await admin();
    const to = new Date();
    const from = row.last_synced_at
      ? new Date(new Date(row.last_synced_at).getTime() - 3 * 864e5)
      : new Date(to.getTime() - 365 * 864e5);
    try {
      const accounts = await p.provider.fetchFinancialData(row.provider_consent_id, {
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const txns = accounts.flatMap(normalizeRebitAccount);
      let inserted = 0;
      if (txns.length) {
        const times = txns.map((t) => new Date(t.occurred_at).getTime());
        const { data: existing } = await context.supabase
          .from("upi_transactions")
          .select("amount,direction,occurred_at,ref_id,provider_txn_id,account_ref,source")
          .eq("user_id", context.userId)
          .gte("occurred_at", new Date(Math.min(...times) - 2 * 864e5).toISOString())
          .lte("occurred_at", new Date(Math.max(...times) + 2 * 864e5).toISOString());
        const fresh = filterDuplicates(
          txns.map((t) => ({ ...t, source: "account_aggregator" })),
          (existing ?? []).map((e: any) => ({ ...e, amount: Number(e.amount) })),
        );
        const rows = fresh.map((t) => ({
          user_id: context.userId,
          amount: t.amount,
          direction: t.direction,
          counterparty: t.counterparty,
          occurred_at: t.occurred_at,
          ref_id: t.ref_id,
          provider_txn_id: t.provider_txn_id,
          account_ref: t.account_ref,
          bank: t.bank,
          balance: t.balance,
          note: t.note,
          source: "account_aggregator",
          category: "other" as const,
          dedupe_key: aaDedupeKey(t),
        }));
        for (let i = 0; i < rows.length; i += 200) {
          const { data: ins, error } = await context.supabase
            .from("upi_transactions")
            .upsert(rows.slice(i, i + 200), { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
            .select("id");
          if (error) throw new Error(error.message);
          inserted += ins?.length ?? 0;
        }
      }
      await db
        .from("aa_consents")
        .update({ last_synced_at: to.toISOString(), last_error: null })
        .eq("id", row.id);
      return { fetched: txns.length, inserted };
    } catch (e) {
      const msg = String((e as Error).message ?? e);
      await db.from("aa_consents").update({ last_error: msg }).eq("id", row.id);
      throw new Error(msg);
    }
  });

export const revokeAaConsent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getAaProvider } = await import("./aa/provider.server");
    const row = await latestConsent(context.supabase, context.userId);
    if (!row) return { ok: true };
    const p = getAaProvider();
    if (p.ok && row.provider_consent_id) await p.provider.revokeConsent(row.provider_consent_id);
    const db = await admin();
    await db.from("aa_consents").update({ status: "revoked" }).eq("id", row.id).eq("user_id", context.userId);
    return { ok: true };
  });
