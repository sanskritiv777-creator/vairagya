/** Browser-safe Account Aggregator types (no secrets here). */
export type AaConsentStatus =
  | "pending"
  | "active"
  | "paused"
  | "revoked"
  | "expired"
  | "rejected"
  | "error";

export type AaUiState =
  | { kind: "not_configured"; missing: string[] }
  | { kind: "not_connected" }
  | { kind: "pending"; consentId: string; redirectUrl: string | null }
  | {
      kind: "connected";
      consentId: string;
      lastSyncedAt: string | null;
      accounts: { maskedNumber: string; fipName?: string }[];
    }
  | { kind: "error"; consentId: string | null; message: string; reauth: boolean };

/** A transaction normalized into Vairagya's upi_transactions shape. */
export type AaNormalizedTxn = {
  amount: number;
  direction: "credit" | "debit";
  counterparty: string;
  occurred_at: string;
  ref_id: string | null;
  provider_txn_id: string | null;
  account_ref: string | null;
  bank: string | null;
  balance: number | null;
  note: string | null;
};
