/**
 * Database ingestion for parsed bank/UPI transactions.
 *
 * Duplicate prevention is enforced by the database: a unique index on
 * (user_id, dedupe_key) means re-scanning the inbox, receiving the same
 * transaction over SMS *and* a payment-app notification, or a retried
 * write can never create a second row. `ignoreDuplicates` turns those
 * conflicts into silent skips.
 *
 * The index MUST be a plain (non-partial) unique index: PostgREST issues
 * `ON CONFLICT (user_id, dedupe_key)` with no WHERE clause, and Postgres
 * cannot infer a partial index from that, which fails with 42P10.
 */
import { supabase } from "@/integrations/supabase/client";
import { ilog } from "./ingest-log";
import type { ParsedTxn } from "./txn-parser";

export type IngestResult = { inserted: number; skipped: number };

type UpiRow = {
  user_id: string;
  amount: number;
  direction: "credit" | "debit";
  counterparty: string;
  upi_id: string | null;
  bank: string | null;
  ref_id: string | null;
  balance: number | null;
  source: string;
  dedupe_key: string;
  note: string | null;
  category: "other";
  occurred_at: string;
};

/** Turn any thrown value (PostgREST errors are plain objects) into readable text. */
export function describeDbError(err: unknown): string {
  if (!err) return "unknown error";
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    const parts = [
      e.message ? String(e.message) : null,
      e.code ? `code=${String(e.code)}` : null,
      e.details ? `details=${String(e.details)}` : null,
      e.hint ? `hint=${String(e.hint)}` : null,
    ].filter(Boolean);
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

const CHUNK = 200;

/**
 * Cross-source duplicate suppression.
 *
 * The same payment usually arrives twice: once as a bank SMS (which carries a
 * UPI reference id) and once as a payment-app notification (which usually does
 * not). Their `dedupe_key`s therefore differ, so the DB unique index alone
 * cannot collapse them. Here we treat two entries as the same transaction when
 * amount + direction match and they happened within a few minutes of each
 * other — never merely because the amount matches.
 */
const WINDOW_MS = 5 * 60 * 1000;

function fingerprint(r: { amount: number; direction: string }) {
  return `${r.direction}|${r.amount.toFixed(2)}`;
}

async function dropCrossSourceDuplicates(user_id: string, rows: UpiRow[]): Promise<UpiRow[]> {
  if (rows.length === 0) return rows;

  // 1) Collapse inside the incoming batch, preferring the entry with a ref id.
  const batch: UpiRow[] = [];
  for (const r of [...rows].sort((a, b) => (a.ref_id ? -1 : 0) - (b.ref_id ? -1 : 0))) {
    const t = new Date(r.occurred_at).getTime();
    const clash = batch.find(
      (b) =>
        fingerprint(b) === fingerprint(r) &&
        Math.abs(new Date(b.occurred_at).getTime() - t) <= WINDOW_MS,
    );
    if (clash) continue;
    batch.push(r);
  }

  // 2) Compare against rows already stored inside the same time window.
  const times = batch.map((r) => new Date(r.occurred_at).getTime());
  const from = new Date(Math.min(...times) - WINDOW_MS).toISOString();
  const to = new Date(Math.max(...times) + WINDOW_MS).toISOString();

  try {
    const { data, error } = await supabase
      .from("upi_transactions")
      .select("amount,direction,occurred_at,ref_id")
      .eq("user_id", user_id)
      .gte("occurred_at", from)
      .lte("occurred_at", to);

    if (error || !data?.length) return batch;

    const existing = data.map((d) => ({
      amount: Number(d.amount),
      direction: String(d.direction),
      time: new Date(d.occurred_at as string).getTime(),
      ref_id: d.ref_id ? String(d.ref_id) : null,
    }));

    const kept = batch.filter((r) => {
      const t = new Date(r.occurred_at).getTime();
      const dup = existing.some(
        (e) =>
          (r.ref_id && e.ref_id && r.ref_id.toUpperCase() === e.ref_id.toUpperCase()) ||
          (fingerprint(e) === fingerprint(r) && Math.abs(e.time - t) <= WINDOW_MS),
      );
      return !dup;
    });

    if (kept.length !== batch.length) {
      ilog("db", `cross-source dedupe: skipped ${batch.length - kept.length} already-known txn(s)`);
    }
    return kept;
  } catch (e) {
    ilog("db", `cross-source dedupe check skipped: ${describeDbError(e)}`);
    return batch;
  }
}


export async function ingestTransactions(parsed: ParsedTxn[]): Promise<IngestResult> {
  if (parsed.length === 0) return { inserted: 0, skipped: 0 };

  const { data: u, error: userErr } = await supabase.auth.getUser();
  if (userErr || !u?.user) {
    ilog("db", "no authenticated user — skipping write", userErr?.message);
    return { inserted: 0, skipped: parsed.length };
  }
  const user_id = u.user.id;
  ilog("db", `authenticated user resolved: ${user_id}`);

  const rows: UpiRow[] = parsed.map((p) => ({
    user_id,
    amount: p.amount,
    direction: p.direction,
    counterparty: p.counterparty,
    upi_id: p.upi_id ?? null,
    bank: p.bank ?? null,
    ref_id: p.ref_id ?? null,
    balance: p.balance ?? null,
    source: p.source,
    dedupe_key: p.dedupe_key,
    note: p.raw ?? null,
    category: "other" as const,
    occurred_at: p.occurred_at,
  }));

  // Guard the DB check constraints/NOT NULLs locally so one bad parse can't
  // fail the whole batch import.
  const valid = rows.filter((r) => {
    const ok =
      Number.isFinite(r.amount) &&
      (r.direction === "credit" || r.direction === "debit") &&
      !!r.counterparty &&
      !!r.dedupe_key &&
      !!r.occurred_at &&
      !Number.isNaN(new Date(r.occurred_at).getTime());
    if (!ok) ilog("db", "dropping malformed row before insert", r);
    return ok;
  });

  const deduped = await dropCrossSourceDuplicates(user_id, valid);

  let inserted = 0;
  let skipped = rows.length - deduped.length;


  for (let i = 0; i < deduped.length; i += CHUNK) {
    const chunk = deduped.slice(i, i + CHUNK);
    ilog("db", `writing ${chunk.length} candidate transaction(s) [${i + 1}-${i + chunk.length}]`);

    const { data, error } = await supabase
      .from("upi_transactions")
      .upsert(chunk, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
      .select("id");

    if (error) {
      ilog("db", `write failed: ${describeDbError(error)}`, {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        sampleRow: chunk[0],
        rowCount: chunk.length,
      });
      throw new Error(`Database import failed: ${describeDbError(error)}`);
    }

    const got = data?.length ?? 0;
    inserted += got;
    skipped += chunk.length - got;
  }

  ilog("db", `inserted ${inserted}, skipped ${skipped} duplicate/invalid row(s)`);
  return { inserted, skipped };
}
