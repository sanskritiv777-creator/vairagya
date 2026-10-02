/**
 * Account Aggregator provider abstraction (server-only).
 *
 * Vairagya acts as an FIU through a licensed AA technology provider. No
 * provider is bundled: an adapter is selected by AA_PROVIDER and must be
 * implemented against that provider's official API docs once credentials
 * are issued. Until then the feature reports "not configured" honestly.
 *
 * Required backend secrets:
 *   AA_PROVIDER        adapter id, e.g. "setu" | "finvu" | "onemoney"
 *   AA_API_BASE_URL    provider API base URL (from provider onboarding)
 *   AA_CLIENT_ID       provider-issued client id
 *   AA_CLIENT_SECRET   provider-issued client secret
 *   AA_FIU_ID          your FIU id registered with Sahamati / provider
 */
import type { AaConsentStatus } from "./types";
import type { RebitAccount } from "./normalize";

export type AaConfig = {
  provider: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  fiuId: string;
};

export const AA_ENV_VARS = [
  "AA_PROVIDER",
  "AA_API_BASE_URL",
  "AA_CLIENT_ID",
  "AA_CLIENT_SECRET",
  "AA_FIU_ID",
] as const;

export function readAaConfig(): { config: AaConfig | null; missing: string[] } {
  const missing = AA_ENV_VARS.filter((k) => !process.env[k]);
  if (missing.length) return { config: null, missing: [...missing] };
  return {
    config: {
      provider: process.env["AA_PROVIDER"]!,
      baseUrl: process.env["AA_API_BASE_URL"]!,
      clientId: process.env["AA_CLIENT_ID"]!,
      clientSecret: process.env["AA_CLIENT_SECRET"]!,
      fiuId: process.env["AA_FIU_ID"]!,
    },
    missing: [],
  };
}

export interface AaProvider {
  /** Create a consent request; returns the hosted consent URL the user must approve. */
  createConsent(input: {
    userRef: string;
    redirectUrl: string;
    fromDate: string;
    toDate: string;
  }): Promise<{ consentId: string; redirectUrl: string }>;
  getConsentStatus(consentId: string): Promise<{
    status: AaConsentStatus;
    accounts: { maskedNumber: string; fipName?: string }[];
  }>;
  /** Create a data session and return decrypted ReBIT DEPOSIT accounts. */
  fetchFinancialData(consentId: string, range: { from: string; to: string }): Promise<RebitAccount[]>;
  revokeConsent(consentId: string): Promise<void>;
}

/** Register concrete adapters here once a provider contract is signed. */
const ADAPTERS: Record<string, (cfg: AaConfig) => AaProvider> = {};

export function getAaProvider():
  | { ok: true; provider: AaProvider; name: string }
  | { ok: false; missing: string[] } {
  const { config, missing } = readAaConfig();
  if (!config) return { ok: false, missing };
  const factory = ADAPTERS[config.provider.toLowerCase()];
  if (!factory) return { ok: false, missing: [`adapter for AA_PROVIDER="${config.provider}"`] };
  return { ok: true, provider: factory(config), name: config.provider.toLowerCase() };
}
