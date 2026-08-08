/**
 * SMS bridge for automatic UPI/bank transaction import (Android).
 *
 * Backed by the project's own native plugin (`android-native/.../sms/`),
 * registered under the name `SmsInbox`. The web build has no SMS access, so
 * every helper no-ops in the browser.
 */
import { registerPlugin } from "@capacitor/core";
import { isNative } from "./platform";

export type SmsMessage = {
  id?: number;
  address?: string;
  body?: string;
  date?: number;
};

type SmsPermissionStatus = {
  sms: "granted" | "denied" | "prompt";
  read?: boolean;
  receive?: boolean;
  granted?: boolean;
};

type SmsInboxPlugin = {
  checkPermissions(): Promise<SmsPermissionStatus>;
  requestPermissions(): Promise<SmsPermissionStatus>;
  getSmsList(opts: {
    filter: { minDate: number; maxCount: number };
  }): Promise<{ smsList: SmsMessage[] }>;
  startWatch(): Promise<{ watching: boolean }>;
  getPendingSms(): Promise<{ messages: SmsMessage[] }>;
  addListener(
    event: "smsReceived",
    cb: (msg: SmsMessage) => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

const SmsInbox = registerPlugin<SmsInboxPlugin>("SmsInbox");


function getPlugin(): SmsInboxPlugin | null {
  return isNative() ? SmsInbox : null;
}

export function isSmsSupported(): boolean {
  return getPlugin() !== null;
}

/** Non-prompting check against the live OS permission state. */
export async function checkSmsPermission(): Promise<boolean> {
  const p = getPlugin();
  if (!p) return false;
  try {
    const current = await p.checkPermissions();
    return current.granted === true || current.sms === "granted";
  } catch {
    return false;
  }
}

export async function requestSmsPermission(): Promise<boolean> {
  const p = getPlugin();
  if (!p) return false;
  try {
    const current = await p.checkPermissions();
    if (current.granted === true || current.sms === "granted") return true;
    const res = await p.requestPermissions();
    return res.granted === true || res.sms === "granted";
  } catch {
    return false;
  }
}

export async function readRecentSms(days = 90, maxCount = 500): Promise<SmsMessage[]> {
  const p = getPlugin();
  if (!p) return [];
  const minDate = Date.now() - days * 24 * 60 * 60 * 1000;
  const { smsList } = await p.getSmsList({ filter: { minDate, maxCount } });
  return smsList ?? [];
}

/**
 * Scan the ENTIRE SMS inbox (no date cut-off) so the user's full bank/UPI
 * history is imported the moment permission is granted.
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
  try {
    await p.startWatch();
  } catch {
    /* watching is manifest-driven; ignore */
  }
  return () => {
    void sub.remove();
  };
}
