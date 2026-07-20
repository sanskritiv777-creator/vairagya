/**
 * Local + push notification bridge.
 *
 * - Local notifications power in-app reminders (quarterly tax nudges,
 *   runway alerts) and always work on Android.
 * - Push notifications require a Firebase project (`google-services.json`
 *   dropped into `android/app/`). See ANDROID-BUILD.md.
 */
import { isNative } from "./platform";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";

export type ReminderInput = {
  id: number;
  title: string;
  body: string;
  at: Date;
};

export async function ensureLocalNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  const status = await LocalNotifications.checkPermissions();
  if (status.display === "granted") return true;
  const req = await LocalNotifications.requestPermissions();
  return req.display === "granted";
}

export async function scheduleReminder(r: ReminderInput): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: r.id,
        title: r.title,
        body: r.body,
        schedule: { at: r.at, allowWhileIdle: true },
      },
    ],
  });
}

export async function cancelReminder(id: number): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] });
}

/**
 * Register for FCM push notifications. Returns the device token so the
 * caller can persist it in Supabase (e.g. a `device_tokens` table) and
 * later target the user from a server function.
 */
export async function registerPush(): Promise<string | null> {
  if (!isNative()) return null;
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return null;

  return new Promise((resolve) => {
    type Handle = { remove: () => Promise<void> };
    const done = (token: string | null) => {
      void regSub.then((s: Handle) => s.remove());
      void errSub.then((s: Handle) => s.remove());
      resolve(token);
    };
    const regSub = PushNotifications.addListener(
      "registration",
      (t: { value: string }) => done(t.value),
    );
    const errSub = PushNotifications.addListener("registrationError", () =>
      done(null),
    );
    void PushNotifications.register();
  });
}
