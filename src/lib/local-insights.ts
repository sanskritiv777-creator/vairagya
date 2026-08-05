/**
 * Local (offline) insight generation.
 *
 * Used as the fallback whenever the AI gateway is unreachable — for example on
 * a device with no connectivity or when the gateway is rate limited. The AI
 * Insights screen therefore never opens empty.
 */
import { summarize, type UnifiedTxn } from "./analytics";

export type Insight = { title: string; body: string; tone: "positive" | "neutral" | "warning" };

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function localInsights(items: UnifiedTxn[], taxRate = 27): Insight[] {
  if (items.length === 0) {
    return [
      {
        title: "No transactions yet",
        body: "Enable automatic import or log one entry and your insights appear here instantly.",
        tone: "neutral",
      },
    ];
  }

  const s = summarize(items);
  const out: Insight[] = [];

  out.push({
    title: `This month you spent ${inr(s.monthSpend)}`,
    body: `You received ${inr(s.monthReceived)} — a net of ${s.monthReceived - s.monthSpend >= 0 ? "+" : "−"}${inr(Math.abs(s.monthReceived - s.monthSpend))} so far this month.`,
    tone: s.monthReceived >= s.monthSpend ? "positive" : "warning",
  });

  const top = s.byCategory[0];
  if (top) {
    const share = s.spent > 0 ? Math.round((top.total / s.spent) * 100) : 0;
    out.push({
      title: `${top.meta.label} is your biggest category`,
      body: `${inr(top.total)} across ${top.count} transaction${top.count === 1 ? "" : "s"} — ${share}% of everything you spend.`,
      tone: share > 45 ? "warning" : "neutral",
    });
  }

  if (s.highestExpense) {
    out.push({
      title: "Largest single expense",
      body: `${inr(s.highestExpense.amount)} to ${s.highestExpense.merchant} on ${new Date(s.highestExpense.at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.`,
      tone: "neutral",
    });
  }

  if (s.topMerchant && s.topMerchant.count > 1) {
    out.push({
      title: `You pay ${s.topMerchant.name} most often`,
      body: `${s.topMerchant.count} payments totalling ${inr(s.topMerchant.total)}. Worth checking for a cheaper plan or a subscription you forgot.`,
      tone: "neutral",
    });
  }

  if (s.monthlyTrend.length >= 2) {
    const prev = s.monthlyTrend[s.monthlyTrend.length - 2];
    const cur = s.monthlyTrend[s.monthlyTrend.length - 1];
    const diff = cur.spend - prev.spend;
    const pct = prev.spend > 0 ? Math.round((diff / prev.spend) * 100) : 0;
    out.push({
      title: diff >= 0 ? `Spending up ${Math.abs(pct)}% vs ${prev.label}` : `Spending down ${Math.abs(pct)}% vs ${prev.label}`,
      body: `${cur.label}: ${inr(cur.spend)} against ${prev.label}: ${inr(prev.spend)}.`,
      tone: diff > 0 ? "warning" : "positive",
    });
  }

  const savings = Math.max(0, s.received - s.spent);
  out.push({
    title: "Savings estimate",
    body: s.received > 0
      ? `You keep ${Math.round((savings / s.received) * 100)}% of what you earn — about ${inr(savings)} banked so far.`
      : "Log or import income to see your savings rate.",
    tone: s.received > 0 && savings / s.received > 0.2 ? "positive" : "neutral",
  });

  const taxable = Math.max(0, s.received - s.spent);
  out.push({
    title: "Tax set-aside estimate",
    body: `At ${taxRate}% you should be holding ${inr(taxable * (taxRate / 100))} for your next advance-tax instalment.`,
    tone: "neutral",
  });

  return out.slice(0, 7);
}
