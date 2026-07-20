/**
 * Barrel for the native services layer.
 *
 * React components should import from `@/native` and never from
 * individual Capacitor plugin packages. Every helper is safe to call
 * from the web build (they no-op).
 */
export * from "./platform";
export * as Sms from "./sms";
export * as Notifications from "./notifications";
export * as Biometrics from "./biometrics";
export * as BackgroundSync from "./background-sync";
