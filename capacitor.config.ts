import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the Vairagya Android app.
 *
 * The web app (Lovable preview + published site) keeps working unchanged;
 * this file only takes effect when the project is exported and wrapped as
 * a native Android app. See ANDROID-BUILD.md for the full walkthrough.
 */
const config: CapacitorConfig = {
  appId: "app.vairagya",
  appName: "Vairagya",
  // TanStack Start's SPA mode emits the static shell at `.output/public/index.html`.
  webDir: ".output/public",
  bundledWebRuntime: false,

  android: {
    // Supabase + Lovable AI Gateway are HTTPS only.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  server: {
    // Use the packaged web assets. To point the shell at a hosted
    // preview during development, set `url` to your preview URL and
    // `cleartext: false`.
    androidScheme: "https",
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: "#07050F",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#07050F",
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#8B5CF6",
    },
    SmsInbox: {
      // capacitor-sms-inbox — see src/native/sms.ts for the runtime bridge.
    },
    BiometricAuth: {
      // @aparajita/capacitor-biometric-auth — see src/native/biometrics.ts.
    },
  },
};

export default config;
