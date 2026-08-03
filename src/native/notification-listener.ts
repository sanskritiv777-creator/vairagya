/**
 * Android notification-access bridge.
 *
 * Reads transaction notifications posted by payment apps (PhonePe,
 * Google Pay, Paytm, BHIM) and banking apps. Android exposes this only
 * through a `NotificationListenerService`, which the Vairagya Android
 * project registers natively (see `android-native/` + the CI patch
 * script). This module talks to that plugin when it exists and no-ops
 * everywhere else, so the web build is unaffected.
 */
import { Capacitor } from "@capacitor/core";
import { isNative } from "./platform";

export type NotificationPayload = {
  package?: string;
  title?: string;
  text?: string;
  time?: number;
};

type ListenerPlugin = {
  checkPermission(): Promise<{ granted: boolean }>;
  requestPermission(): Promise<{ opened: boolean }>;
  startListening?(): Promise<void>;
  addListener(
    event: "notificationReceived",
    cb: (n: NotificationPayload) => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

/** Payment + banking app packages we care about. */
export const TXN_PACKAGES = [
  "com.phonepe.app",
  "com.google.android.apps.nbu.paisa.user",
  "net.one97.paytm",
  "in.org.npci.upiapp",
  "com.dreamplug.androidapp",
  "com.mobikwik_new",
  "com.amazon.mShop.android.shopping",
  "com.whatsapp",
  "com.sbi.lotusintouch",
  "com.sbi.SBIFreedomPlus",
  "com.snapwork.hdfc",
  "com.csam.icici.bank.imobile",
  "com.axis.mobile",
  "com.msf.kbank.mobile",
  "com.fss.idfcpsp",
  "com.bankofbaroda.mconnect",
  "com.canarabank.mobility",
  "com.infrasoft.uboi",
  "com.fss.pnbpsp",
  "com.bandhanbank.mobile",
  "com.fedmobile",
];

function getPlugin(): ListenerPlugin | null {
  if (!isNative()) return null;
  const plugins = (Capacitor as unknown as { Plugins?: Record<string, unknown> }).Plugins;
  return (plugins?.NotificationListener as ListenerPlugin | undefined) ?? null;
}

export function isNotificationImportSupported(): boolean {
  return getPlugin() !== null;
}

/** True when the user has already granted Notification Access. */
export async function hasNotificationAccess(): Promise<boolean> {
  const p = getPlugin();
  if (!p) return false;
  try {
    const res = await p.checkPermission();
    return !!res?.granted;
  } catch {
    return false;
  }
}

/**
 * Opens Android's Notification Access settings screen. Android has no
 * in-app dialog for this permission, so we send the user to Settings and
 * re-check when the app resumes.
 */
export async function requestNotificationAccess(): Promise<boolean> {
  const p = getPlugin();
  if (!p) return false;
  try {
    await p.requestPermission();
    return true;
  } catch {
    return false;
  }
}

export async function subscribeNotifications(
  handler: (n: NotificationPayload) => void,
): Promise<() => void> {
  const p = getPlugin();
  if (!p) return () => {};
  try {
    await p.startListening?.();
  } catch {
    /* listening starts implicitly on some builds */
  }
  const sub = await p.addListener("notificationReceived", handler);
  return () => {
    void sub.remove();
  };
}
