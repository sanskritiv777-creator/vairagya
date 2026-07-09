import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Insight = { title: string; body: string; tone: "positive" | "neutral" | "warning" };

export const generateInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ insights: Insight[] }> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { supabase } = context;

    const [{ data: txns }, { data: upi }] = await Promise.all([
      supabase.from("transactions").select("kind,label,amount,category,occurred_at").order("occurred_at", { ascending: false }).limit(200),
      supabase.from("upi_transactions").select("direction,counterparty,amount,category,occurred_at").order("occurred_at", { ascending: false }).limit(200),
    ]);

    const summary = {
      transactions: txns ?? [],
      upi: upi ?? [],
    };

    const system = `You are a personal-finance analyst. Look at the user's transactions and UPI activity and produce 3-5 short, concrete insights. Focus on: month-over-month income/expense change, top spending categories, recurring subscriptions, unusual UPI counterparties, and cash-flow tips. Reply ONLY with JSON of the shape {"insights":[{"title":string,"body":string,"tone":"positive"|"neutral"|"warning"}]}. Keep each body under 140 characters, use ₹ for currency.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Data:\n${JSON.stringify(summary).slice(0, 12000)}` },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI gateway ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = await res.json() as { choices?: { message?: { content?: string } }[] };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(raw) as { insights?: Insight[] };
      return { insights: (parsed.insights ?? []).slice(0, 6) };
    } catch {
      return { insights: [{ title: "Insights unavailable", body: "Try again in a moment.", tone: "neutral" }] };
    }
  });
