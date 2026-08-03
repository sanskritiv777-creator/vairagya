/**
 * AI insights endpoint.
 *
 * Lives under /api/public/ so the Android APK (which runs from
 * https://localhost and has no site session cookie) can reach it. The
 * caller MUST send a Supabase access token; every read below runs as
 * that user through RLS, so the route is safe despite the public prefix.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type Insight = { title: string; body: string; tone: "positive" | "neutral" | "warning" };

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS },
  });
}

const SYSTEM = `You are a personal-finance analyst. Look at the user's transactions and UPI activity and produce 3-5 short, concrete insights. Focus on: month-over-month income/expense change, top spending categories, recurring subscriptions, unusual UPI counterparties, and cash-flow tips. Reply ONLY with JSON of the shape {"insights":[{"title":string,"body":string,"tone":"positive"|"neutral"|"warning"}]}. Keep each body under 140 characters, use ₹ for currency.`;

export const Route = createFileRoute("/api/public/insights")({
  server: {
    handlers: {
      OPTIONS: () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
        if (!token) return json({ error: "Sign in required to generate insights." }, 401);

        const url = process.env["SUPABASE_URL"];
        const anon = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!url || !anon) return json({ error: "Backend is not configured." }, 500);

        const supabase = createClient(url, anon, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { apikey: anon, Authorization: `Bearer ${token}` } },
        });

        const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userRes?.user) {
          return json({ error: "Your session expired. Sign in again." }, 401);
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return json({ error: "AI service is not configured yet. Try again later." }, 503);
        }

        const [{ data: txns }, { data: upi }] = await Promise.all([
          supabase
            .from("transactions")
            .select("kind,label,amount,category,occurred_at")
            .order("occurred_at", { ascending: false })
            .limit(200),
          supabase
            .from("upi_transactions")
            .select("direction,counterparty,amount,category,occurred_at")
            .order("occurred_at", { ascending: false })
            .limit(200),
        ]);

        if ((txns?.length ?? 0) === 0 && (upi?.length ?? 0) === 0) {
          return json({ insights: [] as Insight[] });
        }

        let res: Response;
        try {
          res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: SYSTEM },
                {
                  role: "user",
                  content: `Data:\n${JSON.stringify({ transactions: txns ?? [], upi: upi ?? [] }).slice(0, 12000)}`,
                },
              ],
              response_format: { type: "json_object" },
            }),
          });
        } catch {
          return json({ error: "Could not reach the AI service. Check your connection." }, 502);
        }

        if (res.status === 429) return json({ error: "AI rate limit reached. Try again in a minute." }, 429);
        if (res.status === 402) return json({ error: "AI credits exhausted for this workspace." }, 402);
        if (!res.ok) {
          return json({ error: `AI service error (${res.status}). Please retry.` }, 502);
        }

        const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = payload.choices?.[0]?.message?.content ?? "{}";
        try {
          const parsed = JSON.parse(raw) as { insights?: Insight[] };
          return json({ insights: (parsed.insights ?? []).slice(0, 6) });
        } catch {
          return json({ error: "AI returned an unreadable response. Please retry." }, 502);
        }
      },
    },
  },
});
