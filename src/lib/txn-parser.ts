/**
 * Bank / UPI transaction message parser.
 *
 * Recognises transactional SMS and payment-app notifications from major
 * Indian banks and UPI apps (SBI, HDFC, ICICI, Axis, Kotak, IDFC FIRST,
 * Canara, Union, BoB, PNB, BoI, IDBI, Yes, RBL, Federal, IndusInd,
 * Indian Bank + PhonePe, Google Pay, Paytm, BHIM, Amazon Pay) and
 * extracts amount, direction, counterparty, bank, UPI ID, reference
 * number, available balance and timestamp.
 *
 * Non-transactional noise (OTP, promo, delivery, spam) is rejected
 * up-front so parsing stays fast against thousands of messages.
 */

export type TxnSource = "sms" | "notification" | "manual";

export type ParsedTxn = {
  amount: number;
  direction: "credit" | "debit";
  counterparty: string;
  upi_id: string | null;
  bank: string | null;
  ref_id: string | null;
  balance: number | null;
  occurred_at: string;
  raw: string;
  source: TxnSource;
  dedupe_key: string;
};

// Sender-id fragments used by Indian bank/UPI SMS headers (VM-HDFCBK,
// AX-SBIUPI, JD-ICICIB, VK-PAYTM …) and payment-app package names.
export const BANK_SENDERS =
  /\b(?:HDFC(?:BK)?|ICICI(?:B|BANK)?|SBI(?:INB|UPI|BNK)?|AXIS(?:BK)?|KOTAK|PNB|BOI|BOB|BARODA|IDBI|YES(?:BK)?|IDFC(?:FB|FIRST)?|RBL|CANARA|CANBNK|UNION|UBI|INDIAN|INDBNK|CENTBK|CBIN|FED(?:BNK)?|FEDERAL|INDUS(?:IND)?|HSBC|CITI|SCB|DBS|AU(?:BANK)?|BANDHAN|EQUITAS|UCO|IOB|PAYTM(?:B|BNK)?|PHONEPE|GPAY|GOOGL(?:E)?PAY|BHIM(?:UPI)?|AMAZONPAY|APAY|MOBIKWIK|FREECHRG|CRED)\b/i;

// A message must positively signal a completed money movement.
export const TXN_HINT =
  /\b(?:credited|debited|received|paid|sent|spent|withdrawn|deposited|transferred|refunded|refund|purchase|payment of|debit for|credit for|txn|imps|neft|rtgs|upi|a\/c|acct)\b/i;

// Immediate rejects — OTP codes, promotional offers, delivery updates, spam.
export const NOISE_RE =
  /\b(?:otp|one[\s-]?time[\s-]?password|verification code|do not share|dont share|passcode|login code|auth code|will expire|valid for \d+ (?:min|sec)|offer|cashback offer|discount|sale|deal|coupon|voucher|win|winner|lottery|prize|loan|emi offer|pre[\s-]?approved|apply now|click here|http[s]?:\/\/(?!.*(?:receipt|invoice))|shipped|delivered|out for delivery|order (?:placed|confirmed)|appointment|schedule)\b/i;

export function looksTransactional(sender: string, body: string): boolean {
  if (!body || body.trim().length < 10) return false;
  if (NOISE_RE.test(body)) return false;
  return BANK_SENDERS.test(sender ?? "") || TXN_HINT.test(body);
}

/** Stable duplicate key: reference id when present, else money fingerprint. */
export function dedupeKeyFor(input: {
  direction: string;
  amount: number;
  counterparty: string;
  occurred_at: string;
  ref_id?: string | null;
}): string {
  if (input.ref_id) return `ref:${input.ref_id.toUpperCase()}`;
  const minute = new Date(
    Math.floor(new Date(input.occurred_at).getTime() / 60000) * 60000,
  ).toISOString();
  return `${input.direction}|${Number(input.amount).toFixed(2)}|${input.counterparty
    .toLowerCase()
    .replace(/\s+/g, "")}|${minute}`;
}

/** Legacy fingerprint used for in-memory comparisons against existing rows. */
export function hashOf(direction: string, amount: number, counterparty: string, iso: string) {
  return dedupeKeyFor({ direction, amount, counterparty, occurred_at: iso });
}

function parseTimestamp(body: string, fallback: number): string {
  const m =
    body.match(
      /on\s+(\d{1,2}[-/\s][A-Za-z0-9]{2,4}[-/\s]\d{2,4})(?:[\s,]+(?:at\s+)?(\d{1,2}[:.]\d{2}(?:\s*[AP]M)?))?/i,
    ) || body.match(/(\d{1,2}[-/][A-Za-z]{3}[-/]?\d{2,4})/);
  if (m) {
    const raw = m[1] + (m[2] ? " " + m[2].replace(".", ":") : "");
    const d = new Date(raw);
    if (!isNaN(d.getTime()) && d.getTime() < Date.now() + 86400000) return d.toISOString();
  }
  return new Date(fallback).toISOString();
}

/**
 * Parse one message (SMS body or notification text) into a transaction.
 * Returns null when the text is not a bank/UPI transaction we understand.
 */
export function parseTransactionText(
  text: string,
  opts: { source: TxnSource; sender?: string; timestamp?: number } = { source: "sms" },
): ParsedTxn | null {
  const body = (text ?? "").trim();
  if (body.length < 10) return null;
  if (NOISE_RE.test(body)) return null;
  if (!TXN_HINT.test(body)) return null;

  const const amtMatch =
    body.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d+)?)/i) ||
    body.match(
     /\b(?:debited|credited|received|paid|sent|spent|
   deposited)\s+(?:by|with|of)\s*(?:Rs\.?|INR|₹)?\s*([\d,]+
   (?:\.\d+)?)/i,
    );
  const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, "")) : NaN;
  if (!isFinite(amount) || amount <= 0) return null;

  const credit = /\b(credited|received|deposited|refunded|refund|added to)\b/i.test(body);
  const debit = /\b(debited|paid|sent|spent|withdrawn|purchase|debit)\b/i.test(body);
  const direction: "credit" | "debit" = credit && !debit ? "credit" : "debit";

  const upiMatch = body.match(/([a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,})/);
  const upi_id = upiMatch ? upiMatch[1] : null;

  let counterparty: string | null = null;
  const named =
    body.match(
      /(?:to|from|by|at)\s+((?:[A-Z][A-Za-z0-9&'.\- ]{1,40}?))(?=\s+(?:on|via|Ref|UPI|Info|Bal|A\/c|for)|[.,;]|$)/,
    ) ||
    body.match(/VPA\s+([a-zA-Z0-9._-]+@[a-zA-Z]{2,})/i) ||
    body.match(/UPI\/(?:P2[APM]|CR|DR)\/\d+\/([A-Z][A-Za-z0-9&'.\- ]{2,40})/);
  if (named) counterparty = named[1].trim();
  if (!counterparty && upi_id) counterparty = upi_id;
  if (!counterparty) counterparty = "Unknown";

  const refMatch = body.match(
    /(?:Ref(?:erence)?(?:\s*No\.?|#)?|UTR|Txn(?:\s*ID)?|RRN)[:\s]*([A-Za-z0-9]{6,})/i,
  );
  const balMatch = body.match(
    /(?:Avl(?:\.?\s*Bal)?|Available Bal(?:ance)?|Bal(?:ance)?)[:\s]*(?:Rs\.?|INR|₹)?\s*([\d,]+(?:\.\d+)?)/i,
  );
  const bankMatch = (opts.sender ?? "").match(BANK_SENDERS) || body.match(BANK_SENDERS);

  const occurred_at = parseTimestamp(body, opts.timestamp ?? Date.now());
  const ref_id = refMatch ? refMatch[1] : null;

  return {
    amount,
    direction,
    counterparty,
    upi_id,
    bank: bankMatch ? bankMatch[0].toUpperCase() : null,
    ref_id,
    balance: balMatch ? parseFloat(balMatch[1].replace(/,/g, "")) : null,
    occurred_at,
    raw: body.slice(0, 300),
    source: opts.source,
    dedupe_key: dedupeKeyFor({ direction, amount, counterparty, occurred_at, ref_id }),
  };
}

export type RawMessage = { address?: string; body?: string; date?: number };

/** Parse a batch of raw SMS records; reports parse failures to the caller. */
export function parseMessages(
  messages: RawMessage[],
  source: TxnSource = "sms",
): { parsed: ParsedTxn[]; failed: number } {
  const parsed: ParsedTxn[] = [];
  let failed = 0;
  for (const m of messages) {
    const body = m.body ?? "";
    const sender = m.address ?? "";
    if (!looksTransactional(sender, body)) continue;
    const p = parseTransactionText(body, { source, sender, timestamp: m.date });
    if (p) parsed.push(p);
    else failed += 1;
  }
  // Collapse duplicates inside the same batch.
  const seen = new Set<string>();
  const unique = parsed.filter((p) => {
    if (seen.has(p.dedupe_key)) return false;
    seen.add(p.dedupe_key);
    return true;
  });
  return { parsed: unique, failed };
}

/** Back-compat: parse a `\n\n`-joined `sender: body` dump. */
export function parseSmsBatch(dump: string): ParsedTxn[] {
  if (!dump?.trim()) return [];
  const messages: RawMessage[] = dump
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
    .map((chunk) => {
      const idx = chunk.indexOf(":");
      const looksLikeSender = idx > 0 && idx < 24;
      return looksLikeSender
        ? { address: chunk.slice(0, idx), body: chunk.slice(idx + 1).trim() }
        : { address: "", body: chunk };
    });
  return parseMessages(messages, "sms").parsed;
}
