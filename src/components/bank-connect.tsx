import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Landmark, Loader2, RefreshCw, ShieldCheck, Unlink } from "lucide-react";
import {
  getAaStatus,
  refreshAaConsent,
  revokeAaConsent,
  startAaConsent,
  syncAaTransactions,
} from "@/lib/aa.functions";
import { isNative } from "@/native/platform";
import type { AaUiState } from "@/lib/aa/types";

const btn =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-[14px] font-semibold transition disabled:opacity-50";

export function BankConnectPanel() {
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getAaStatus);
  const start = useServerFn(startAaConsent);
  const refresh = useServerFn(refreshAaConsent);
  const sync = useServerFn(syncAaTransactions);
  const revoke = useServerFn(revokeAaConsent);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const q = useQuery({ queryKey: ["aa-status"], queryFn: () => fetchStatus() });
  const state: AaUiState | undefined = q.data;

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      qc.invalidateQueries();
    }
  }

  const connect = () =>
    run("connect", async () => {
      const redirectUrl = isNative() ? "app.vairagya://aa/callback" : `${window.location.origin}/app`;
      const { redirectUrl: url } = await start({ data: { redirectUrl } });
      window.location.href = url;
    });

  return (
    <div className="space-y-4 text-foreground">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Landmark className="h-5 w-5 text-foreground" />
          <div>
            <p className="text-[15px] font-semibold">Connect bank account</p>
            <p className="text-[12.5px] text-muted-foreground">
              Account Aggregator — RBI-regulated, consent-based bank statement sharing.
            </p>
          </div>
        </div>
      </div>

      {q.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}

      {state?.kind === "not_configured" && (
        <div className="rounded-lg border border-border bg-card p-4 text-[13px] text-muted-foreground">
          <p className="font-semibold text-foreground">Not available yet</p>
          <p className="mt-1">
            Bank linking through Account Aggregator isn't switched on for Vairagya yet. Your SMS and
            notification import keep working as usual.
          </p>
        </div>
      )}

      {state?.kind === "not_connected" && (
        <>
          <Status label="Not connected" />
          <button className={`${btn} w-full bg-primary text-primary-foreground`} disabled={!!busy} onClick={connect}>
            {busy === "connect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Connect bank account
          </button>
        </>
      )}

      {state?.kind === "pending" && (
        <>
          <Status label="Consent pending" />
          {state.redirectUrl && (
            <a href={state.redirectUrl} className={`${btn} w-full bg-primary text-primary-foreground`}>
              Continue consent
            </a>
          )}
          <button className={`${btn} w-full border border-border bg-card`} disabled={!!busy} onClick={() => run("refresh", () => refresh())}>
            {busy === "refresh" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Check status
          </button>
        </>
      )}

      {state?.kind === "connected" && (
        <>
          <Status
            label={busy === "sync" ? "Syncing…" : "Connected"}
            sub={`Last synced: ${state.lastSyncedAt ? new Date(state.lastSyncedAt).toLocaleString("en-IN") : "never"}`}
          />
          {state.accounts.map((a) => (
            <p key={a.maskedNumber} className="text-[13px] text-muted-foreground">
              {a.fipName ?? "Bank"} · {a.maskedNumber}
            </p>
          ))}
          <button className={`${btn} w-full bg-primary text-primary-foreground`} disabled={!!busy} onClick={() => run("sync", async () => {
            const r = await sync();
            setMsg(`Synced: ${r.inserted} new of ${r.fetched} transactions.`);
          })}>
            {busy === "sync" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync transactions
          </button>
        </>
      )}

      {state?.kind === "error" && (
        <>
          <Status label={state.reauth ? "Re-authentication required" : "Error"} sub={state.message} />
          <button className={`${btn} w-full bg-primary text-primary-foreground`} disabled={!!busy} onClick={state.reauth ? connect : () => run("refresh", () => refresh())}>
            {state.reauth ? "Reconnect bank" : "Retry"}
          </button>
        </>
      )}

      {(state?.kind === "connected" || state?.kind === "pending" || state?.kind === "error") && (
        <button className={`${btn} w-full border border-rose-400/30 text-rose-200`} disabled={!!busy} onClick={() => run("revoke", () => revoke())}>
          <Unlink className="h-4 w-4" /> Manage consent · Revoke
        </button>
      )}

      {msg && <p className="text-[13px] text-muted-foreground">{msg}</p>}
    </div>
  );
}

function Status({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[14px] font-semibold">{label}</p>
      {sub && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
