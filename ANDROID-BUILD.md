# Vairagya — Android build guide

Vairagya ships as **one codebase, two runtimes**:

- **Web** — the Lovable preview and the published `vairagya.lovable.app` site.
  Works exactly as before. Native features silently no-op.
- **Android** — a Capacitor shell that loads the same React app inside a
  WebView, plus native plugins for SMS import, push, biometrics, etc.

The web build does **not** need any of the steps below. Follow them only when
you want to produce an APK or an AAB for the Play Store.

---

## 1. One-time setup

Prerequisites on your local machine:

- Node 20+ and `bun` (or `npm`)
- **Android Studio Iguana or newer** with the Android SDK (API 34+) and
  build-tools 34.x
- JDK 17 (bundled with Android Studio)

Export the Lovable project to GitHub, clone it, then:

```bash
bun install
bun run build           # produces dist/ (Capacitor's webDir)
bunx cap add android    # scaffolds the android/ folder
bunx cap sync android   # copies web assets + registers plugins
```

`bunx cap add android` creates the `android/` Gradle project. Commit it — it's
part of the app from that point on.

---

## 2. Files this project already ships

| File | Purpose |
| --- | --- |
| `capacitor.config.ts` | Capacitor app id, name, plugin configuration |
| `src/native/platform.ts` | `isNative()`, `isAndroid()`, `platformName()` |
| `src/native/sms.ts` | `capacitor-sms-inbox` wrapper for auto UPI import |
| `src/native/notifications.ts` | Local + FCM push notifications |
| `src/native/biometrics.ts` | Fingerprint / face unlock |
| `src/native/background-sync.ts` | App-resume sync + WorkManager contract |
| `src/native/index.ts` | Barrel — components import from `@/native` only |
| `ANDROID-BUILD.md` | This document |

Installed Capacitor packages (see `package.json`):

- `@capacitor/core`, `@capacitor/android`, `@capacitor/cli`, `@capacitor/assets`
- `@capacitor/app`, `@capacitor/preferences`, `@capacitor/status-bar`,
  `@capacitor/splash-screen`, `@capacitor/haptics`
- `@capacitor/local-notifications`, `@capacitor/push-notifications`
- `@aparajita/capacitor-biometric-auth`
- `capacitor-sms-inbox`

---

## 3. Android manifest permissions

After `cap add android`, open
`android/app/src/main/AndroidManifest.xml` and add inside `<manifest>`:

```xml
<!-- SMS auto-import (bank / UPI transaction messages only) -->
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.RECEIVE_SMS" />

<!-- Push notifications (Android 13+) -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

<!-- Biometric unlock -->
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
<uses-permission android:name="android.permission.USE_FINGERPRINT" />

<!-- Background sync -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.INTERNET" />
```

The `capacitor-sms-inbox` plugin registers its own
`android.provider.Telephony.SMS_RECEIVED` receiver — you don't need to add
one manually.

---

## 4. App icon & splash

```bash
bunx capacitor-assets generate --android \
  --iconBackgroundColor "#07050F" \
  --splashBackgroundColor "#07050F"
```

Source icon: `src/assets/app-icon.png` (already in the repo).

---

## 5. Push notifications (optional)

1. Create a Firebase project.
2. Add an Android app with package name `app.vairagya`.
3. Download `google-services.json` and place it at
   `android/app/google-services.json`.
4. In `android/build.gradle` inside `buildscript { dependencies { ... } }` add:

   ```gradle
   classpath 'com.google.gms:google-services:4.4.2'
   ```

5. At the bottom of `android/app/build.gradle` add:

   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```

6. `bunx cap sync android` and rebuild.

The JS side is already wired — call `Notifications.registerPush()` from
`@/native` and persist the returned token to Supabase.

---

## 6. Background sync via WorkManager (real, not fake)

App-resume sync is already handled from JS
(`BackgroundSync.registerSyncHandler`). For true periodic background sync,
add a native `WorkManager` job:

1. Create `android/app/src/main/java/app/vairagya/sync/SyncWorker.kt`
   extending `androidx.work.CoroutineWorker`.
2. Enqueue it from `MainActivity.onCreate` with `WorkManager.getInstance(...)`
   using `PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES)`.
3. Expose a Capacitor plugin `VairagyaSync` that the worker can call, or
   have the worker query Room / Supabase directly.

Add to `android/app/build.gradle` dependencies:

```gradle
implementation "androidx.work:work-runtime-ktx:2.9.1"
```

Full walkthrough lives in this file so a native contributor can pick it up
without reverse-engineering the JS side.

---

## 7. Build an APK / AAB

Debug APK from the command line:

```bash
bun run build
bunx cap sync android
cd android
./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Signed release build from Android Studio:

1. `bunx cap open android`
2. **Build ▸ Generate Signed Bundle / APK…**
3. Choose **Android App Bundle** (for Play Store) or **APK** (for sideloading).
4. Create or select a keystore, pick `release` variant, click **Finish**.

Output paths:

- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

---

## 8. Play Store notes

- `READ_SMS` requires a **Permissions Declaration** in the Play Console.
  "Financial transaction tracking" is an accepted category — submit sample
  screenshots showing the SMS-based auto-import screen and explain that no
  message content is uploaded off-device except parsed transaction fields
  (amount, party, timestamp) which the user already owns.
- Target SDK must be current (34+ as of late 2024).
- If you don't want to deal with the SMS declaration, ship without
  `READ_SMS` / `RECEIVE_SMS`; the app falls back to manual entry and
  everything else keeps working.

---

## 9. Iterating

After any JS change:

```bash
bun run build && bunx cap sync android
```

After changing `capacitor.config.ts` or adding/removing a plugin:

```bash
bunx cap sync android
```

Live-reload against a dev server: set `server.url` in `capacitor.config.ts`
to your machine's LAN address running `bun run dev`, then
`bunx cap run android`.

---

## 10. What is NOT stubbed

Every function in `src/native/*` calls the real Capacitor plugin when
running on Android and returns a safe no-op on web. There are no fake SMS
providers, no fake biometrics, and no placeholder push tokens. When the
Android shell is built following this guide, the features are live.
