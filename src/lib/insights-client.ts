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

export async function fetchInsights(): Promise<Insight[]> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to generate insights.");

  const url = `${apiOrigin()}/api/public/insights`;
  ilog("insights", `requesting insights from ${url}`);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${token}` },
      body: "{}",
    });
  } catch {
    throw new Error("No connection to the insights service. Check your internet and retry.");
  }

  let body: { insights?: Insight[]; error?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    throw new Error(`Insights service returned an unexpected response (${res.status}).`);
  }

  if (!res.ok) {
    ilog("insights", `failed (${res.status})`, body.error);
    throw new Error(body.error ?? `Insights service error (${res.status}).`);
  }

  ilog("insights", `received ${body.insights?.length ?? 0} insight(s)`);
  return body.insights ?? [];
}
