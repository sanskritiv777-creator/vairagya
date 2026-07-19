import type { CapacitorConfig } from "@capacitor/cli";

// Capacitor configuration for the Varaigya Android build.
// Only used when you export the project and run:
//   bun add -d @capacitor/cli
//   bun add @capacitor/core @capacitor/android capacitor-sms-inbox
//   bunx cap init "Varaigya" "app.varaigya" --web-dir=dist
//   bun run build
//   bunx cap add android
//   bunx cap sync
//   bunx cap open android
//
// See CAPACITOR-ANDROID.md for the full walkthrough.
const config: CapacitorConfig = {
  appId: "app.varaigya",
  appName: "Varaigya",
  webDir: "dist",
  android: {
    // Required so the WebView allows requests to Supabase over HTTPS.
    allowMixedContent: false,
  },
  plugins: {
    // capacitor-sms-inbox plugin — reads inbox + emits a `smsReceived` event.
    // The Varaigya JS layer looks for Capacitor.Plugins.SmsInbox at runtime.
    SmsInbox: {
      // Filter narrows the inbox scan (last 90 days, up to 500 messages).
      // The plugin's own bodyRegex further filters bank/UPI messages.
    },
  },
};

export default config;
