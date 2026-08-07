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

  let inserted = 0;
  let skipped = rows.length - valid.length;

  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
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
