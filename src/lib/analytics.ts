/**
 * Dashboard analytics.
 *
 * Merges manually-logged `transactions` with automatically-imported
 * `upi_transactions` into a single timeline, then derives every number the
 * home dashboard shows. Pure functions so React can memoise them and no
 * refresh button is ever required.
 */
import { categorize, prettyMerchant, type CategoryKey, type CategoryMeta } from "./categorize";

export type UnifiedTxn = {
  key: string;
  id: string;
  source: "manual" | "upi";
  direction: "credit" | "debit";
  merchant: string;
  rawLabel: string;
  amount: number;
  at: string;
  upiId: string | null;
  refId: string | null;
  bank: string | null;
  method: string;
  category: CategoryMeta;
};

export type ManualRow = {
  id: string;
  kind: "income" | "expense";
  label: string;
  amount: number;
  category: string | null;
  occurred_at: string;
};

export type UpiRow = {
  id: string;
  amount: number;
  direction: "credit" | "debit";
  counterparty: string;
  upi_id: string | null;
  note: string | null;
  occurred_at: string;
  bank?: string | null;
  ref_id?: string | null;
  source?: string | null;
};

export function unify(manual: ManualRow[], upi: UpiRow[]): UnifiedTxn[] {
  const a: UnifiedTxn[] = manual.map((t) => {
    const direction = t.kind === "income" ? ("credit" as const) : ("debit" as const);
    return {
      key: `m-${t.id}`,
      id: t.id,
      source: "manual" as const,
      direction,
      merchant: t.label || "Unknown",
      rawLabel: `${t.label} ${t.category ?? ""}`,
      amount: Number(t.amount),
      at: t.occurred_at,
      upiId: null,
      refId: null,
      bank: null,
      method: "Manual",
      category: categorize(`${t.label} ${t.category ?? ""}`, direction),
    };
  });

  const b: UnifiedTxn[] = upi.map((u) => {
    const raw = `${u.counterparty} ${u.upi_id ?? ""} ${u.note ?? ""}`;
    return {
      key: `u-${u.id}`,
      id: u.id,
      source: "upi" as const,
      direction: u.direction,
      merchant: prettyMerchant(u.counterparty),
      rawLabel: raw,
      amount: Number(u.amount),
      at: u.occurred_at,
      upiId: u.upi_id ?? null,
      refId: u.ref_id ?? null,
      bank: u.bank ?? null,
      method:
        u.source === "notification"
          ? "UPI · notification"
          : u.source === "manual"
            ? "UPI · manual"
            : "UPI",
      category: categorize(raw, u.direction),
    };
  });

  return [...a, ...b].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
}

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export type Summary = {
  todaySpend: number;
  weekSpend: number;
  monthSpend: number;
  monthReceived: number;
  received: number;
  spent: number;
  net: number;
  highestExpense: UnifiedTxn | null;
  topMerchant: { name: string; total: number; count: number } | null;
  byCategory: { meta: CategoryMeta; total: number; count: number }[];
  todayItems: UnifiedTxn[];
  receivedItems: UnifiedTxn[];
  monthlyTrend: { label: string; spend: number; income: number }[];
};

export function summarize(items: UnifiedTxn[], now = new Date()): Summary {
  const dayStart = startOfDay(now).getTime();
  const weekStart = dayStart - 6 * 86400000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  let todaySpend = 0,
    weekSpend = 0,
    monthSpend = 0,
    monthReceived = 0,
    received = 0,
    spent = 0;
  const merchants = new Map<string, { total: number; count: number }>();
  const cats = new Map<CategoryKey, { meta: CategoryMeta; total: number; count: number }>();
  const todayItems: UnifiedTxn[] = [];
  const receivedItems: UnifiedTxn[] = [];
  let highestExpense: UnifiedTxn | null = null;
  const months = new Map<string, { label: string; spend: number; income: number }>();

  for (const t of items) {
    const ts = new Date(t.at).getTime();
    const mKey = new Date(t.at).toISOString().slice(0, 7);
    if (!months.has(mKey)) {
      months.set(mKey, {
        label: new Date(t.at).toLocaleDateString("en-IN", { month: "short" }),
        spend: 0,
        income: 0,
      });
    }
    const bucket = months.get(mKey)!;

    if (t.direction === "debit") {
      spent += t.amount;
      bucket.spend += t.amount;
      if (ts >= dayStart) {
        todaySpend += t.amount;
        todayItems.push(t);
      }
      if (ts >= weekStart) weekSpend += t.amount;
      if (ts >= monthStart) monthSpend += t.amount;
      if (!highestExpense || t.amount > highestExpense.amount) highestExpense = t;

      const m = merchants.get(t.merchant) ?? { total: 0, count: 0 };
      m.total += t.amount;
      m.count += 1;
      merchants.set(t.merchant, m);

      const c = cats.get(t.category.key) ?? { meta: t.category, total: 0, count: 0 };
      c.total += t.amount;
      c.count += 1;
      cats.set(t.category.key, c);
    } else {
      received += t.amount;
      bucket.income += t.amount;
      if (ts >= monthStart) monthReceived += t.amount;
      if (receivedItems.length < 40) receivedItems.push(t);
    }
  }

  let topMerchant: Summary["topMerchant"] = null;
  for (const [name, v] of merchants) {
    if (!topMerchant || v.total > topMerchant.total)
      topMerchant = { name, total: v.total, count: v.count };
  }

  const monthlyTrend = [...months.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-6)
    .map(([, v]) => v);

  return {
    todaySpend,
    weekSpend,
    monthSpend,
    monthReceived,
    received,
    spent,
    net: received - spent,
    highestExpense,
    topMerchant,
    byCategory: [...cats.values()].sort((a, b) => b.total - a.total),
    todayItems,
    receivedItems,
    monthlyTrend,
  };
}

/** Group a timeline into "Today" / "Yesterday" / "March 2026" buckets. */
export function groupByPeriod(items: UnifiedTxn[]): { label: string; items: UnifiedTxn[] }[] {
  const dayStart = startOfDay().getTime();
  const out: { label: string; items: UnifiedTxn[] }[] = [];
  const index = new Map<string, number>();

  for (const t of items) {
    const ts = new Date(t.at).getTime();
    const label =
      ts >= dayStart
        ? "Today"
        : ts >= dayStart - 86400000
          ? "Yesterday"
          : new Date(t.at).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    if (!index.has(label)) {
      index.set(label, out.length);
      out.push({ label, items: [] });
    }
    out[index.get(label)!].items.push(t);
  }
  return out;
}
