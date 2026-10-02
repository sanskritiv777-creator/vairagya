/**
 * Source-aware duplicate detection shared by every import path
 * (SMS, payment-app notification, Account Aggregator, manual).
 *
 * Two records are the same transaction when ANY strong identifier matches:
 *   1. provider transaction id (same provider), or
 *   2. UPI/UTR reference id,
 * otherwise only when amount + direction match AND the times are close AND
 * nothing contradicts it (different reference ids or different masked
 * accounts). Amount alone is never enough.
 */
export type DedupeCandidate = {
  amount: number;
  direction: string;
  occurred_at: string;
  ref_id?: string | null;
  provider_txn_id?: string | null;
  account_ref?: string | null;
  source?: string | null;
};

export const DEDUPE_WINDOW_MS = 5 * 60 * 1000;
/** AA statements often carry only a value date, so allow a wider window there. */
export const AA_DATE_ONLY_WINDOW_MS = 36 * 60 * 60 * 1000;

const norm = (s?: string | null) => (s ? s.trim().toUpperCase() : null);

export function isSameTransaction(a: DedupeCandidate, b: DedupeCandidate): boolean {
  const pa = norm(a.provider_txn_id);
  const pb = norm(b.provider_txn_id);
  if (pa && pb && a.source === b.source) return pa === pb;

  const ra = norm(a.ref_id);
  const rb = norm(b.ref_id);
  if (ra && rb) return ra === rb;

  if (a.direction !== b.direction) return false;
  if (Math.abs(Number(a.amount) - Number(b.amount)) > 0.005) return false;

  const aa = norm(a.account_ref);
  const ab = norm(b.account_ref);
  if (aa && ab && aa.slice(-4) !== ab.slice(-4)) return false;

  const window =
    a.source === "account_aggregator" || b.source === "account_aggregator"
      ? AA_DATE_ONLY_WINDOW_MS
      : DEDUPE_WINDOW_MS;
  const dt = Math.abs(new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
  return dt <= window;
}

/** Drop incoming rows that duplicate each other or any existing row. */
export function filterDuplicates<T extends DedupeCandidate>(
  incoming: T[],
  existing: DedupeCandidate[],
): T[] {
  const kept: T[] = [];
  // Prefer rows that carry strong identifiers.
  const ordered = [...incoming].sort(
    (x, y) => Number(!!(y.ref_id || y.provider_txn_id)) - Number(!!(x.ref_id || x.provider_txn_id)),
  );
  for (const r of ordered) {
    if (kept.some((k) => isSameTransaction(k, r))) continue;
    if (existing.some((e) => isSameTransaction(e, r))) continue;
    kept.push(r);
  }
  return kept;
}
