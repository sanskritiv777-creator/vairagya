/**
 * Android notification-access bridge.
 *
 * Reads transaction notifications posted by payment apps (PhonePe,
 * Google Pay, Paytm, BHIM, Amazon Pay, WhatsApp Pay) and banking apps via
 * the project's native `NotificationListener` plugin
 * (`android-native/.../notifications/`). No-ops on web.
 */
import { registerPlugin } from "@capacitor/core";
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
  startListening(): Promise<{ listening: boolean }>;
  addListener(
    event: "notificationReceived",
    cb: (n: NotificationPayload) => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

const NotificationListener = registerPlugin<ListenerPlugin>("NotificationListener");

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
  return isNative() ? NotificationListener : null;
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

  if (!p) {
    console.log("[VairagyaNotif] Native notification plugin unavailable");
    return () => {};
  }

  console.log("[VairagyaNotif] Attaching JS notification listener");

  const sub = await p.addListener("notificationReceived", (n) => {
    console.log(
      "[VairagyaNotif] JS RECEIVED:",
      JSON.stringify(n),
    );

    handler(n);
  });

  try {
    const result = await p.startListening();

    console.log(
      "[VairagyaNotif] Native listener status:",
      JSON.stringify(result),
    );
  } catch (e) {
    console.log(
      "[VairagyaNotif] startListening failed:",
      e,
    );
  }

  return () => {
    void sub.remove();
  };
}
