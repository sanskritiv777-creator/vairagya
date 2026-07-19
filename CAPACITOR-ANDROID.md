# Varaigya — Android build (Automatic SMS import)

The web app you're editing in Lovable cannot read SMS. That is an OS-level
restriction, not a bug — browsers on Android intentionally block SMS access.
To ship the tap-once auto-import flow, wrap this project in **Capacitor** and
build a real Android APK.

## One-time setup (on your machine, after exporting the repo)

```bash
# 1. Install Capacitor + the SMS-inbox plugin
bun add @capacitor/core @capacitor/android capacitor-sms-inbox
bun add -d @capacitor/cli

# 2. Build the web bundle
bun run build

# 3. Add the Android platform (uses capacitor.config.ts in repo root)
bunx cap add android

# 4. Sync web assets + plugins into the Android project
bunx cap sync
```

## Grant SMS permissions to the Android project

Open `android/app/src/main/AndroidManifest.xml` and add inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.RECEIVE_SMS" />
```

The `capacitor-sms-inbox` plugin registers a `BroadcastReceiver` for
`android.provider.Telephony.SMS_RECEIVED` automatically, so new bank/UPI SMS
fire the `smsReceived` event that Varaigya listens for in
`src/routes/_authenticated/app.tsx` (`attachNativeSmsListener`).

## Build & run

```bash
bunx cap open android      # opens Android Studio
# then Run ▶ on a connected device / emulator
```

Or produce a signed APK from Android Studio: **Build ▸ Generate Signed Bundle / APK**.

## What Varaigya does at runtime

`AutoImportCard` (in `src/routes/_authenticated/app.tsx`) detects the native
Android platform via `Capacitor.isNativePlatform()`.

- **Web / preview** → shows an honest "Requires the Android app" state. No paste
  UI. No fake automation.
- **Android APK** → shows **Enable Automatic Import**. Tapping it:
  1. Calls `SmsInbox.requestPermissions()` — Android shows the system dialog.
  2. On grant, calls `SmsInbox.getSmsList()` with a 90-day filter.
  3. Parses each message via `parseSmsBatch()`, dedupes on
     `direction|amount|party|minute`, and bulk-inserts new rows into the
     `upi_transactions` table.
  4. Registers a `smsReceived` listener so every new incoming SMS is parsed
     and inserted silently in the background.

No PIN, OTP, or bank login is ever read — only bank/UPI SMS bodies for amount,
party, and time.

## Plugin API expected by Varaigya

The JS side (`tryReadNativeSms`, `attachNativeSmsListener`) expects
`Capacitor.Plugins.SmsInbox` to expose:

```ts
{
  checkPermissions(): Promise<{ sms: "granted" | "denied" | "prompt" }>;
  requestPermissions(): Promise<{ sms: "granted" | "denied" }>;
  getSmsList(opts: { filter: { minDate: number; maxCount: number } }):
    Promise<{ smsList: Array<{ address?: string; body?: string; date?: number }> }>;
  addListener(
    event: "smsReceived",
    cb: (msg: { address?: string; body?: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}
```

`capacitor-sms-inbox` matches this. If you swap plugins, keep the shape or
update the two helper functions.

## Play Store note

Google restricts the `READ_SMS` permission — apps that use it must submit a
**Permissions Declaration** justifying the use case (financial transaction
tracking is an accepted category). Sideloading or private distribution has no
such restriction.
