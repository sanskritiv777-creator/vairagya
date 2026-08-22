/**
 * Android notification-access bridge.
 *
 * Captures payment/banking notifications and also retrieves notifications
 * that arrived while Vairagya was closed.
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

  getPendingNotifications(): Promise<{
    notifications: NotificationPayload[];
  }>;

  addListener(
    event: "notificationReceived",
    cb: (n: NotificationPayload) => void,
  ): Promise<{
    remove: () => Promise<void>;
  }>;
};

const NotificationListener =
  registerPlugin<ListenerPlugin>("NotificationListener");

/**
 * Payment + banking app packages.
 */
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

export async function hasNotificationAccess(): Promise<boolean> {
  const plugin = getPlugin();

  if (!plugin) {
    return false;
  }

  try {
    const result = await plugin.checkPermission();

    return !!result?.granted;
  } catch {
    return false;
  }
}

export async function requestNotificationAccess(): Promise<boolean> {
  const plugin = getPlugin();

  if (!plugin) {
    return false;
  }

  try {
    await plugin.requestPermission();
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads notifications that arrived while Vairagya was closed.
 *
 * These are stored by NotificationQueue.kt and removed from the queue
 * only after being successfully returned to JavaScript.
 */
async function drainPendingNotifications(
  handler: (n: NotificationPayload) => void,
): Promise<void> {

  const plugin = getPlugin();

  if (!plugin) {
    return;
  }

  try {
    const result =
      await plugin.getPendingNotifications();

    const notifications =
      result?.notifications ?? [];

    console.log(
      "[VairagyaNotif] Pending notifications:",
      notifications.length,
    );

    for (const notification of notifications) {
      try {
        console.log(
          "[VairagyaNotif] PROCESSING SAVED:",
          JSON.stringify(notification),
        );

        handler(notification);
      } catch (error) {
        console.error(
          "[VairagyaNotif] Failed to process saved notification:",
          error,
        );
      }
    }
  } catch (error) {
    console.error(
      "[VairagyaNotif] Failed to drain pending notifications:",
      error,
    );
  }
}

export async function subscribeNotifications(
  handler: (n: NotificationPayload) => void,
): Promise<() => void> {

  const plugin = getPlugin();

  if (!plugin) {
    console.log(
      "[VairagyaNotif] Native notification plugin unavailable",
    );

    return () => {};
  }

  console.log(
    "[VairagyaNotif] Attaching JS notification listener",
  );

  /*
   * First retrieve notifications that arrived while the app
   * was closed.
   */
  await drainPendingNotifications(handler);

  /*
   * Then listen for notifications arriving while the app
   * is running.
   */
  const subscription =
    await plugin.addListener(
      "notificationReceived",
      (notification) => {

        console.log(
          "[VairagyaNotif] LIVE RECEIVED:",
          JSON.stringify(notification),
        );

        try {
          handler(notification);
        } catch (error) {
          console.error(
            "[VairagyaNotif] Failed to process live notification:",
            error,
          );
        }
      },
    );

  try {

    const result =
      await plugin.startListening();

    console.log(
      "[VairagyaNotif] Native listener status:",
      JSON.stringify(result),
    );

  } catch (error) {

    console.log(
      "[VairagyaNotif] startListening failed:",
      error,
    );
  }

  /*
   * One more drain after the native listener starts.
   *
   * This closes the small timing gap between the first drain
   * and listener registration.
   */
  await drainPendingNotifications(handler);

  return () => {
    void subscription.remove();
  };
}
