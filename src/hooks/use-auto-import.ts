/**
 * Automatic transaction import engine (Android).
 *
 * Owns the whole ingestion lifecycle so it runs from app start rather than
 * only when a settings sheet happens to be open:
 *  - detects an already-granted SMS permission on launch (no prompt)
 *  - scans the full inbox and imports every bank/UPI transaction
 *  - keeps a live `smsReceived` listener attached
 *  - attaches the notification-access listener when that permission exists
 *  - re-checks permissions when the app resumes from Android Settings
 *
 * Duplicates are prevented by the database's unique (user_id, dedupe_key)
 * index, so re-running a scan is always safe.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { parseMessages, parseTransactionText } from "@/lib/txn-parser";
import { ingestTransactions, describeDbError } from "@/lib/ingest";
import { ilog } from "@/lib/ingest-log";
import {
  checkSmsPermission,
  requestSmsPermission,
  readAllSms,
  subscribeIncomingSms,
} from "@/native/sms";
import {
  hasNotificationAccess,
  requestNotificationAccess,
  subscribeNotifications,
} from "@/native/notification-listener";

export type ImportPhase =
  | "unsupported"
  | "idle"
  | "requesting"
  | "scanning"
  | "saving"
  | "live"
  | "denied"
  | "error";

export type AutoImportState = {
  native: boolean;
  phase: ImportPhase;
  status: string;
  scanned: number;
  detected: number;
  imported: number;
  smsGranted: boolean;
  notifGranted: boolean;
  busy: boolean;
};

export function isNativeAndroidRuntime(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

export function useAutoImport(onImported: () => void) {
  const native = isNativeAndroidRuntime();
  const [state, setState] = useState<AutoImportState>({
    native,
    phase: native ? "idle" : "unsupported",
    status: "",
    scanned: 0,
    detected: 0,
    imported: 0,
    smsGranted: false,
    notifGranted: false,
    busy: false,
  });

  const importedRef = useRef(onImported);
  importedRef.current = onImported;
  const runningRef = useRef(false);
  const patch = useCallback((p: Partial<AutoImportState>) => setState((s) => ({ ...s, ...p })), []);

  /** Full-inbox scan + import. Safe to call repeatedly. */
  const runFullScan = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    patch({ phase: "scanning", busy: true, status: "Scanning your inbox…" });
    try {
      const messages = await readAllSms();
      ilog("sms", `scanned ${messages.length} SMS from inbox`);
      patch({ scanned: messages.length, status: `Read ${messages.length} messages…` });

      const { parsed, failed } = parseMessages(messages, "sms");
      ilog("parse", `detected ${parsed.length} transaction(s), ${failed} parse failure(s)`);
      patch({
        detected: parsed.length,
        phase: "saving",
        status: `Found ${parsed.length} transactions — saving…`,
      });

      const { inserted, skipped } = await ingestTransactions(parsed);
      ilog("db", `saved ${inserted} new transaction(s), skipped ${skipped} duplicate(s)`);
      importedRef.current();
      patch({
        imported: inserted,
        phase: "live",
        busy: false,
        status:
          inserted > 0
            ? `Imported ${inserted} transaction${inserted === 1 ? "" : "s"}. New SMS now sync automatically.`
            : "You're up to date. New SMS sync automatically.",
      });
    } catch (e) {
      const msg = describeDbError(e);
      ilog("sms", `import failed: ${msg}`);
      patch({ phase: "error", busy: false, status: `Import failed: ${msg}` });
    } finally {
      runningRef.current = false;
    }
  }, [patch]);

  /** Ask for SMS permission, then import immediately when granted. */
  const enableSms = useCallback(async () => {
    if (!native) return false;
    patch({ phase: "requesting", busy: true, status: "Requesting SMS permission…" });
    const granted = await requestSmsPermission();
    ilog("perm", `SMS permission ${granted ? "granted" : "denied"}`);
    patch({ smsGranted: granted });
    if (!granted) {
      patch({
        phase: "denied",
        busy: false,
        status: "SMS permission denied. Grant it to import transactions automatically.",
      });
      return false;
    }
    await runFullScan();
    return true;
  }, [native, patch, runFullScan]);

  const enableNotifications = useCallback(async () => {
    if (!native) return;
    ilog("perm", "opening notification access settings");
    await requestNotificationAccess();
    patch({ status: "Enable “Vairagya” in the list, then return to the app." });
  }, [native, patch]);

  // Detect existing permissions on launch and start everything up.
  useEffect(() => {
    if (!native) return;
    let cancelled = false;
    const cleanups: Array<() => void> = [];

    async function attachSms() {
      const stop = await subscribeIncomingSms(async (msg) => {
        ilog("sms", `live SMS received from ${msg.address ?? "unknown"}`);
        const { parsed, failed } = parseMessages(
          [{ address: msg.address, body: msg.body, date: msg.date ?? Date.now() }],
          "sms",
        );
        if (failed) ilog("parse", `live SMS parse failures: ${failed}`);
        if (!parsed.length) return;
        try {
          const { inserted } = await ingestTransactions(parsed);
          if (inserted > 0) {
            importedRef.current();
            patch({
              status: `Auto-imported ${inserted} new transaction${inserted === 1 ? "" : "s"}.`,
            });
          }
        } catch (e) {
          ilog("db", `live SMS write failed: ${describeDbError(e)}`);
        }
      });
      cleanups.push(stop);
      ilog("sms", "live SMS listener attached");
    }

    async function attachNotifications() {
      const stop = await subscribeNotifications(async (n) => {
        const text = [n.title ?? "", n.text ?? ""].filter(Boolean).join(" — ");
        ilog("notification", `notification from ${n.package ?? "unknown"}`, text.slice(0, 120));
        const parsed = parseTransactionText(text, {
          source: "notification",
          sender: n.package ?? "",
          timestamp: n.time ?? Date.now(),
        });
        if (!parsed) return;
        try {
          const { inserted, skipped } = await ingestTransactions([parsed]);
          ilog("notification", `imported ${inserted}, duplicates skipped ${skipped}`);
          if (inserted > 0) {
            importedRef.current();
            patch({ status: `Auto-imported ${inserted} transaction from a payment notification.` });
          }
        } catch (e) {
          ilog("db", `notification write failed: ${describeDbError(e)}`);
        }
      });
      cleanups.push(stop);
    }

    void (async () => {
      const sms = await checkSmsPermission();
      if (cancelled) return;
      ilog("perm", `SMS permission on launch: ${sms ? "granted" : "not granted"}`);
      patch({ smsGranted: sms });
      if (sms) {
        await attachSms();
        await runFullScan();
      }
      const notif = await hasNotificationAccess();
      if (cancelled) return;
      patch({ notifGranted: notif });
      ilog("perm", `notification access ${notif ? "granted" : "not granted"}`);
      if (notif) await attachNotifications();
    })();

    // Re-check after the user comes back from Android Settings.
    const recheck = () => {
      void (async () => {
        const [sms, notif] = await Promise.all([checkSmsPermission(), hasNotificationAccess()]);
        if (cancelled) return;
        setState((s) => {
          if (sms && !s.smsGranted)
            void (async () => {
              await attachSms();
              await runFullScan();
            })();
          if (notif && !s.notifGranted) void attachNotifications();
          return { ...s, smsGranted: sms, notifGranted: notif };
        });
      })();
    };
    window.addEventListener("focus", recheck);
    // Native lifecycle: fires reliably when returning from Android Settings.
    let removeResume: (() => void) | null = null;
    void CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) recheck();
    }).then((sub) => {
      removeResume = () => void sub.remove();
    });
    document.addEventListener("visibilitychange", recheck);
    // Some Android builds don't fire focus/visibility when returning from the
    // system Settings app, so poll cheaply until both permissions are on.
    const poll = window.setInterval(() => {
      setState((s) => {
        if (s.smsGranted && s.notifGranted) return s;
        recheck();
        return s;
      });
    }, 4000);

    return () => {
      cancelled = true;
      cleanups.forEach((fn) => fn());
      window.clearInterval(poll);
      removeResume?.();
      window.removeEventListener("focus", recheck);
      document.removeEventListener("visibilitychange", recheck);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native]);

  return { ...state, enableSms, enableNotifications, runFullScan };
}
