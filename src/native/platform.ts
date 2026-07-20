/**
 * Runtime platform detection.
 *
 * Every helper in `src/native/*` is safe to import from web code. They
 * short-circuit to no-ops when running in a browser so the same React
 * codebase powers both the Lovable web build and the Android APK.
 */
import { Capacitor } from "@capacitor/core";

export function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isAndroid(): boolean {
  try {
    return Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export function platformName(): "android" | "ios" | "web" {
  try {
    const p = Capacitor.getPlatform();
    if (p === "android" || p === "ios") return p;
  } catch {
    /* noop */
  }
  return "web";
}
