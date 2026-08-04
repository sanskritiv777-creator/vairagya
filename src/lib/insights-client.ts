/**
 * Client for the AI insights endpoint.
 *
 * On the web this hits the same origin. Inside the Android APK the app is
 * served from https://localhost, so requests are pointed at the deployed
 * Vairagya origin instead — that is why the insights page used to fail
 * with "Page can't load" on device.
 */
import { supabase } from "@/integrations/supabase/client";
import { ilog } from "./ingest-log";

export type Insight = { title: string; body: string; tone: "positive" | "neutral" | "warning" };

const FALLBACK_ORIGIN = "https://vairagya.lovable.app";

export function apiOrigin(): string {
  const configured = import.meta.env["VITE_API_ORIGIN"] as string | undefined;
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window === "undefined") return "";
  const { protocol, hostname, origin } = window.location;
  // Capacitor serves the app from https://localhost or capacitor://localhost.
  const isNativeShell =
    protocol === "capacitor:" || protocol === "file:" || hostname === "localhost" && !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  return isNativeShell ? FALLBACK_ORIGIN : origin;
}

function candidateOrigins(): string[] {
  const list = [apiOrigin(), FALLBACK_ORIGIN, ""];
  return [...new Set(list)];
}

export async function fetchInsights(): Promise<Insight[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to generate insights.");

  let lastError = "Could not reach the insights service.";

  // Try the resolved origin first, then the published origin, then a relative
  // path. On Android the app is served from https://localhost, so a relative
  // path alone can never work — that was the old "page can't load".
  for (const origin of candidateOrigins()) {
    const url = `${origin}/api/public/insights`;
    ilog("insights", `requesting insights from ${url}`);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
        body: "{}",
      });
    } catch {
      lastError = "No connection to the insights service. Check your internet and retry.";
      continue;
    }

    let body: { insights?: Insight[]; error?: string } = {};
    let text = "";
    try {
      text = await res.text();
      body = JSON.parse(text) as typeof body;
    } catch {
      lastError = `Insights service returned an unexpected response (${res.status}).`;
      continue; // usually an HTML shell — try the next origin
    }

    if (!res.ok) {
      ilog("insights", `failed (${res.status})`, body.error);
      const message = body.error ?? `Insights service error (${res.status}).`;
      // Auth / config / AI errors are real answers — surface them immediately.
      if (res.status !== 404) throw new Error(message);
      lastError = message;
      continue;
    }

    ilog("insights", `received ${body.insights?.length ?? 0} insight(s)`);
    return body.insights ?? [];
  }

  throw new Error(lastError);
}
