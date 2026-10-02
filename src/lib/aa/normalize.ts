/**
 * Parses ReBIT-standard FI "DEPOSIT" data (the format every licensed Indian
 * Account Aggregator returns after FI decryption) into Vairagya transactions.
 */
import type { AaNormalizedTxn } from "./types";

type RebitTxn = {
  txnId?: string;
  type?: string;
  mode?: string;
  amount?: string | number;
  currentBalance?: string | number;
  transactionTimestamp?: string;
  valueDate?: string;
  narration?: string;
  reference?: string;
};

export type RebitAccount = {
  maskedAccNumber?: string;
  fipName?: string;
  fipId?: string;
  Transactions?: { Transaction?: RebitTxn[] | RebitTxn };
};

const UPI_REF = /\b(\d{12})\b/;

function counterpartyFrom(narration: string): string {
  // e.g. "UPI/DR/412345678901/RAHUL SHARMA/YESB/rahul@ybl/Payment"
  const parts = narration.split(/[/|-]/).map((s) => s.trim()).filter(Boolean);
  const name = parts.find((p) => /[A-Za-z]{3,}/.test(p) && !/^(UPI|DR|CR|IMPS|NEFT|RTGS|POS)$/i.test(p));
  return (name ?? narration).slice(0, 80) || "Bank transaction";
}

export function normalizeRebitAccount(acc: RebitAccount): AaNormalizedTxn[] {
  const raw = acc.Transactions?.Transaction;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: AaNormalizedTxn[] = [];
  for (const t of list) {
    const amount = Number(t.amount);
    const type = String(t.type ?? "").toUpperCase();
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (type !== "DEBIT" && type !== "CREDIT") continue;
    const when = t.transactionTimestamp || t.valueDate;
    if (!when || Number.isNaN(new Date(when).getTime())) continue;
    const narration = String(t.narration ?? "").trim();
    const ref = t.reference?.trim() || narration.match(UPI_REF)?.[1] || null;
    const bal = Number(t.currentBalance);
    out.push({
      amount,
      direction: type === "CREDIT" ? "credit" : "debit",
      counterparty: counterpartyFrom(narration),
      occurred_at: new Date(when).toISOString(),
      ref_id: ref,
      provider_txn_id: t.txnId?.trim() || null,
      account_ref: acc.maskedAccNumber ?? null,
      bank: acc.fipName ?? acc.fipId ?? null,
      balance: Number.isFinite(bal) ? bal : null,
      note: narration || null,
    });
  }
  return out;
}

/** Stable key so re-syncs hit the (user_id, dedupe_key) unique index. */
export function aaDedupeKey(t: AaNormalizedTxn): string {
  if (t.ref_id) return `ref:${t.ref_id.toUpperCase()}`;
  if (t.provider_txn_id) return `aa:${(t.account_ref ?? "").slice(-4)}:${t.provider_txn_id}`;
  return `aa:${(t.account_ref ?? "").slice(-4)}:${t.direction}:${t.amount.toFixed(2)}:${t.occurred_at}`;
}
