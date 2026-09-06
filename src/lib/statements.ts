/**
 * Financial statements: shared calculation layer.
 *
 * Everything here derives from the SAME unified timeline the dashboard already
 * builds (`unify()` over manual `transactions` + imported `upi_transactions`),
 * so Income Statement, Cash Flow, Spending Analysis and the monthly report can
 * never disagree with each other or with the home screen. Pure functions only,
 * no fetching, no writes, no separate dataset.
 */
import type { UnifiedTxn } from "./analytics";

/* ─────────────────────────── classification ─────────────────────────── */

export type StatementKind = "income" | "expense" | "transfer";

export type IncomeBucket =
  | "Salary"
  | "Freelance / Business"
  | "Money Received"
  | "Refunds"
  | "Other Income";

export type ExpenseBucket =
  | "Food"
  | "Shopping"
  | "Transport"
  | "Bills & Utilities"
  | "Entertainment"
  | "Education"
  | "Healthcare"
  | "Subscriptions"
  | "Other Expenses";

export const INCOME_BUCKETS: IncomeBucket[] = [
  "Salary",
  "Freelance / Business",
  "Money Received",
  "Refunds",
  "Other Income",
];

export const EXPENSE_BUCKETS: ExpenseBucket[] = [
  "Food",
  "Shopping",
  "Transport",
  "Bills & Utilities",
  "Entertainment",
  "Education",
  "Healthcare",
  "Subscriptions",
  "Other Expenses",
];

/** Expenses you cannot realistically skip in a month. */
const ESSENTIAL: ExpenseBucket[] = [
  "Food",
  "Transport",
  "Bills & Utilities",
  "Healthcare",
  "Education",
];

export const BUCKET_COLORS: Record<string, string> = {
  Salary: "#34D399",
  "Freelance / Business": "#5EEAD4",
  "Money Received": "#A5B4FC",
  Refunds: "#93C5FD",
  "Other Income": "#DDD6FE",
  Food: "#FDBA74",
  Shopping: "#F0ABFC",
  Transport: "#7DD3FC",
  "Bills & Utilities": "#C4B5FD",
  Entertainment: "#F9A8D4",
  Education: "#FCD34D",
  Healthcare: "#6EE7B7",
  Subscriptions: "#FDA4AF",
  "Other Expenses": "#DDD6FE",
};

/**
 * Money moving between the user's own accounts / wallets. Deliberately narrow:
 * a false positive silently removes real income or spending from the report.
 */
const INTERNAL_TRANSFER =
  /\b(self\s*(?:transfer|txn|credit|debit)?|own\s+account|to\s+self|from\s+self|self\/|add(?:ed)?\s+money\s+to\s+wallet|wallet\s+top\s*-?\s*up|topup\s+wallet|transfer\s+to\s+own|internal\s+transfer|acct?\s+transfer\s+self|atm\s+(?:withdrawal|wdl|cash)|cash\s+withdrawal|cash\s+deposit|credit\s+card\s+(?:bill|payment))\b/i;

const REFUND = /\b(refund(?:ed)?|reversal|reversed|returned|chargeback|cashback|cash\s?back)\b/i;
const SUBSCRIPTION =
  /\b(netflix|spotify|prime\s?(?:video|membership)|hotstar|disney\+?|youtube\s?premium|sonyliv|zee5|jiocinema|apple\s?(?:music|tv|one)|icloud|google\s?one|adobe|canva|notion|figma|chatgpt|openai|subscription|autopay|mandate|recurring)\b/i;
const EDUCATION =
  /\b(school|college|university|tuition|coaching|course|udemy|coursera|byju|unacademy|vedantu|upgrad|simplilearn|exam\s?fee|admission|semester|hostel\s?fee|book\s?store|stationery)\b/i;
const HEALTHCARE_HINT = /\b(insurance|mediclaim|health\s?policy)\b/i;

export type Classified = {
  txn: UnifiedTxn;
  kind: StatementKind;
  bucket: IncomeBucket | ExpenseBucket | "Internal Transfer";
  essential: boolean;
};

export function classify(t: UnifiedTxn): Classified {
  const text = `${t.rawLabel} ${t.merchant}`;
  const amount = Number(t.amount);

  // Guard: unusable rows are treated as transfers so they never distort totals.
  if (!Number.isFinite(amount) || amount <= 0) {
    return { txn: t, kind: "transfer", bucket: "Internal Transfer", essential: false };
  }

  if (INTERNAL_TRANSFER.test(text) && !REFUND.test(text)) {
    return { txn: t, kind: "transfer", bucket: "Internal Transfer", essential: false };
  }

  if (t.direction === "credit") {
    let bucket: IncomeBucket;
    if (REFUND.test(text)) bucket = "Refunds";
    else if (t.category.key === "salary") bucket = "Salary";
    else if (t.category.key === "client") bucket = "Freelance / Business";
    else if (t.category.key === "investments") bucket = "Other Income";
    else bucket = "Money Received";
    return { txn: t, kind: "income", bucket, essential: false };
  }

  let bucket: ExpenseBucket;
  if (EDUCATION.test(text)) bucket = "Education";
  else if (SUBSCRIPTION.test(text)) bucket = "Subscriptions";
  else if (HEALTHCARE_HINT.test(text)) bucket = "Healthcare";
  else
    switch (t.category.key) {
      case "food":
        bucket = "Food";
        break;
      case "shopping":
        bucket = "Shopping";
        break;
      case "travel":
      case "fuel":
        bucket = "Transport";
        break;
      case "bills":
        bucket = "Bills & Utilities";
        break;
      case "entertainment":
        bucket = "Entertainment";
        break;
      case "medicine":
        bucket = "Healthcare";
        break;
      default:
        bucket = "Other Expenses";
    }

  return {
    txn: t,
    kind: "expense",
    bucket,
    essential: ESSENTIAL.includes(bucket),
  };
}

/* ───────────────────────────── date ranges ──────────────────────────── */

export type PeriodKey = "this_month" | "last_month" | "last_3_months" | "this_year" | "custom";

export type Range = { from: Date; to: Date; label: string };

export const PERIOD_LABELS: Record<Exclude<PeriodKey, "custom">, string> = {
  this_month: "This month",
  last_month: "Last month",
  last_3_months: "Last 3 months",
  this_year: "This year",
};

export function resolveRange(
  key: PeriodKey,
  custom?: { from?: string; to?: string },
  now = new Date(),
): Range {
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  switch (key) {
    case "last_month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return {
        from,
        to,
        label: from.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      };
    }
    case "last_3_months":
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 2, 1),
        to: endOfToday,
        label: "Last 3 months",
      };
    case "this_year":
      return {
        from: new Date(now.getFullYear(), 0, 1),
        to: endOfToday,
        label: String(now.getFullYear()),
      };
    case "custom": {
      const from = custom?.from ? new Date(`${custom.from}T00:00:00`) : null;
      const to = custom?.to ? new Date(`${custom.to}T23:59:59.999`) : null;
      if (from && to && !Number.isNaN(+from) && !Number.isNaN(+to) && from <= to) {
        return {
          from,
          to,
          label: `${from.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${to.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
        };
      }
      // Incomplete custom input falls back to the current month rather than
      // showing an empty or nonsensical report.
      return resolveRange("this_month", undefined, now);
    }
    default: {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        from,
        to: endOfToday,
        label: from.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      };
    }
  }
}

/* ───────────────────────────── statements ──────────────────────────── */

export type Line = { label: string; total: number; count: number; color: string };

export type Statements = {
  range: Range;
  /** Duplicate-safe classified rows inside the range. */
  rows: Classified[];
  incomeLines: Line[];
  expenseLines: Line[];
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  savings: number;
  /** null when income is zero — caller shows "Not enough data". */
  savingsRate: number | null;
  transferTotalIn: number;
  transferTotalOut: number;
  transferCount: number;
  /** Balance reported by the bank just before the range, when known. */
  openingBalance: number | null;
  closingBalance: number | null;
  topExpenseCategories: Line[];
  highestExpenseCategory: Line | null;
  essentialSpend: number;
  discretionarySpend: number;
  highestExpense: UnifiedTxn | null;
  largestIncome: UnifiedTxn | null;
  txnCount: number;
  monthly: MonthPoint[];
};

export type MonthPoint = {
  key: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
  savingsRate: number | null;
};

function dedupe(items: UnifiedTxn[]): UnifiedTxn[] {
  const seen = new Set<string>();
  const out: UnifiedTxn[] = [];
  for (const t of items) {
    // Same reference id, or the same amount/direction/counterparty in the same
    // minute, is the same real-world transaction seen twice (SMS + notification).
    const fingerprint = t.refId
      ? `r:${t.refId}:${t.direction}`
      : `f:${t.direction}:${Math.round(Number(t.amount) * 100)}:${t.merchant.toLowerCase()}:${new Date(t.at).toISOString().slice(0, 16)}`;
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    out.push(t);
  }
  return out;
}

function lines(map: Map<string, { total: number; count: number }>, order: string[]): Line[] {
  return order
    .map((label) => {
      const v = map.get(label);
      return {
        label,
        total: v?.total ?? 0,
        count: v?.count ?? 0,
        color: BUCKET_COLORS[label] ?? "#DDD6FE",
      };
    })
    .filter((l) => l.count > 0);
}

export function buildStatements(all: UnifiedTxn[], range: Range): Statements {
  const unique = dedupe(all);
  const fromTs = range.from.getTime();
  const toTs = range.to.getTime();

  const rows: Classified[] = [];
  const incomeMap = new Map<string, { total: number; count: number }>();
  const expenseMap = new Map<string, { total: number; count: number }>();
  const monthMap = new Map<string, MonthPoint>();

  let totalIncome = 0,
    totalExpenses = 0,
    essentialSpend = 0,
    discretionarySpend = 0,
    transferTotalIn = 0,
    transferTotalOut = 0,
    transferCount = 0;
  let highestExpense: UnifiedTxn | null = null;
  let largestIncome: UnifiedTxn | null = null;

  // Opening / closing balance can only come from a bank-reported balance.
  let openingBalance: number | null = null;
  let openingTs = -Infinity;
  let closingBalance: number | null = null;
  let closingTs = -Infinity;

  for (const t of unique) {
    const ts = new Date(t.at).getTime();
    if (!Number.isFinite(ts)) continue;

    const bal = typeof t.balance === "number" && Number.isFinite(t.balance) ? t.balance : null;
    if (bal !== null) {
      if (ts < fromTs && ts > openingTs) {
        openingTs = ts;
        openingBalance = bal;
      }
      if (ts >= fromTs && ts <= toTs && ts > closingTs) {
        closingTs = ts;
        closingBalance = bal;
      }
    }

    // 12-month rolling trend is independent of the selected range.
    const c = classify(t);
    const mKey = `${new Date(t.at).getFullYear()}-${String(new Date(t.at).getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(mKey)) {
      monthMap.set(mKey, {
        key: mKey,
        label: new Date(t.at).toLocaleDateString("en-IN", { month: "short" }),
        income: 0,
        expenses: 0,
        net: 0,
        savingsRate: null,
      });
    }
    const mp = monthMap.get(mKey)!;
    if (c.kind === "income") mp.income += t.amount;
    else if (c.kind === "expense") mp.expenses += t.amount;

    if (ts < fromTs || ts > toTs) continue;
    rows.push(c);

    if (c.kind === "transfer") {
      transferCount += 1;
      if (t.direction === "credit") transferTotalIn += t.amount;
      else transferTotalOut += t.amount;
      continue;
    }

    if (c.kind === "income") {
      totalIncome += t.amount;
      const cur = incomeMap.get(c.bucket) ?? { total: 0, count: 0 };
      cur.total += t.amount;
      cur.count += 1;
      incomeMap.set(c.bucket, cur);
      if (!largestIncome || t.amount > largestIncome.amount) largestIncome = t;
    } else {
      totalExpenses += t.amount;
      const cur = expenseMap.get(c.bucket) ?? { total: 0, count: 0 };
      cur.total += t.amount;
      cur.count += 1;
      expenseMap.set(c.bucket, cur);
      if (c.essential) essentialSpend += t.amount;
      else discretionarySpend += t.amount;
      if (!highestExpense || t.amount > highestExpense.amount) highestExpense = t;
    }
  }

  const monthly = [...monthMap.values()]
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .slice(-12)
    .map((m) => ({
      ...m,
      net: m.income - m.expenses,
      savingsRate: m.income > 0 ? ((m.income - m.expenses) / m.income) * 100 : null,
    }));

  const expenseLines = lines(expenseMap, EXPENSE_BUCKETS);
  const byTotal = [...expenseLines].sort((a, b) => b.total - a.total);

  return {
    range,
    rows,
    incomeLines: lines(incomeMap, INCOME_BUCKETS),
    expenseLines: byTotal,
    totalIncome,
    totalExpenses,
    netIncome: totalIncome - totalExpenses,
    savings: totalIncome - totalExpenses,
    savingsRate: totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : null,
    transferTotalIn,
    transferTotalOut,
    transferCount,
    openingBalance,
    closingBalance:
      openingBalance !== null || closingBalance !== null
        ? closingBalance
        : null,
    topExpenseCategories: byTotal.slice(0, 5),
    highestExpenseCategory: byTotal[0] ?? null,
    essentialSpend,
    discretionarySpend,
    highestExpense,
    largestIncome,
    txnCount: rows.length,
    monthly,
  };
}
