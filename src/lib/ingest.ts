/**
 * Database ingestion for parsed bank/UPI transactions.
 *
 * Duplicate prevention is enforced by the database: a unique index on
 * (user_id, dedupe_key) means re-scanning the inbox, receiving the same
 * transaction over SMS *and* a payment-app notification, or a retried
 * write can never create a second row. `ignoreDuplicates` turns those
 * conflicts into silent skips.
 */
import { supabase } from "@/integrations/supabase/client";
import { ilog } from "./ingest-log";
import type { ParsedTxn } from "./txn-parser";

export type IngestResult = { inserted: number; skipped: number };

export async function ingestTransactions(parsed: ParsedTxn[]): Promise<IngestResult> {
  if (parsed.length === 0) return { inserted: 0, skipped: 0 };

  const { data: u, error: userErr } = await supabase.auth.getUser();
  if (userErr || !u?.user) {
    ilog("db", "no authenticated user — skipping write", userErr?.message);
    return { inserted: 0, skipped: parsed.length };
  }
  const user_id = u.user.id;

  const rows = parsed.map((p) => ({
    user_id,
    amount: p.amount,
    direction: p.direction,
    counterparty: p.counterparty,
    upi_id: p.upi_id,
    bank: p.bank,
    ref_id: p.ref_id,
    balance: p.balance,
    source: p.source,
    dedupe_key: p.dedupe_key,
    note: p.raw,
    category: "other",
    occurred_at: p.occurred_at,
  }));

  ilog("db", `writing ${rows.length} candidate transaction(s)`);

  const { data, error } = await supabase
    .from("upi_transactions" as never)
    .upsert(rows as never, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
    .select("id");

  if (error) {
    ilog("db", `write failed: ${error.message}`);
    throw error;
  }

  const inserted = (data as unknown as { id: string }[] | null)?.length ?? 0;
  const skipped = rows.length - inserted;
  ilog("db", `inserted ${inserted}, skipped ${skipped} duplicate(s)`);
  return { inserted, skipped };
}
