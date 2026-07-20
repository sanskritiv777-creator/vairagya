/**
 * Biometric authentication (fingerprint / face unlock) via
 * @aparajita/capacitor-biometric-auth.
 *
 * On Android this requires `USE_BIOMETRIC` in AndroidManifest.xml
 * (added automatically by the plugin) and Android 6.0+.
 */
import { isNative } from "./platform";
import {
  BiometricAuth,
  BiometryErrorType,
} from "@aparajita/capacitor-biometric-auth";

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable;
  } catch {
    return false;
  }
}

export type BiometricResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "cancelled" | "failed" };

export async function authenticateWithBiometrics(
  reason = "Unlock Vairagya",
): Promise<BiometricResult> {
  if (!isNative()) return { ok: false, reason: "unavailable" };
  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      androidTitle: "Vairagya",
      androidSubtitle: reason,
      androidConfirmationRequired: false,
    });
    return { ok: true };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (
      code === BiometryErrorType.userCancel ||
      code === BiometryErrorType.appCancel ||
      code === BiometryErrorType.systemCancel
    ) {
      return { ok: false, reason: "cancelled" };
    }
    return { ok: false, reason: "failed" };
  }
}
