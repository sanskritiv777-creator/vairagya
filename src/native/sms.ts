/**
 * SMS integration point for automatic UPI/bank transaction import.
 *
 * The web build has no way to read SMS — browsers block it. On Android
 * the app uses the `capacitor-sms-inbox` plugin, which is registered
 * in `capacitor.config.ts` and requires READ_SMS + RECEIVE_SMS in
 * `android/app/src/main/AndroidManifest.xml`.
 *
 * These helpers wrap the plugin so app code never touches
 * `Capacitor.Plugins.SmsInbox` directly.
 */
import { Capacitor } from "@capacitor/core";
import { isNative } from "./platform";

export type SmsMessage = {
  address?: string;
  body?: string;
  date?: number;
};

type SmsInboxPlugin = {
  checkPermissions(): Promise<{ sms: "granted" | "denied" | "prompt" }>;
  requestPermissions(): Promise<{ sms: "granted" | "denied" }>;
  getSmsList(opts: {
    filter: { minDate: number; maxCount: number };
  }): Promise<{ smsList: SmsMessage[] }>;
  addListener(
    event: "smsReceived",
    cb: (msg: SmsMessage) => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

function getPlugin(): SmsInboxPlugin | null {
  if (!isNative()) return null;
  const plugins = (Capacitor as unknown as { Plugins?: Record<string, unknown> })
    .Plugins;
  return (plugins?.SmsInbox as SmsInboxPlugin | undefined) ?? null;
}

export function isSmsSupported(): boolean {
  return getPlugin() !== null;
}

export async function requestSmsPermission(): Promise<boolean> {
  const p = getPlugin();
  if (!p) return false;
  const current = await p.checkPermissions();
  if (current.sms === "granted") return true;
  const res = await p.requestPermissions();
  return res.sms === "granted";
}

export async function readRecentSms(days = 90, maxCount = 500): Promise<SmsMessage[]> {
  const p = getPlugin();
  if (!p) return [];
  const minDate = Date.now() - days * 24 * 60 * 60 * 1000;
  const { smsList } = await p.getSmsList({ filter: { minDate, maxCount } });
  return smsList ?? [];
}

/**
 * Scan the ENTIRE SMS inbox (no date cut-off). Used right after the SMS
 * permission is granted so the user's full bank/UPI history is imported.
 */
export async function readAllSms(maxCount = 20000): Promise<SmsMessage[]> {
  const p = getPlugin();
  if (!p) return [];
  const { smsList } = await p.getSmsList({ filter: { minDate: 0, maxCount } });
  return smsList ?? [];
}

export async function subscribeIncomingSms(
  handler: (msg: SmsMessage) => void,
): Promise<() => void> {
  const p = getPlugin();
  if (!p) return () => {};
  const sub = await p.addListener("smsReceived", handler);
  return () => {
    void sub.remove();
  };
}
