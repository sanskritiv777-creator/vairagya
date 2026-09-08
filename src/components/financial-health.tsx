/**
 * Financial Health — Income Statement, Cash Flow, spending analysis and the
 * monthly report. All numbers come from the shared `buildStatements()` layer
 * over the existing unified transaction timeline, so nothing here fetches or
 * stores data of its own.
 */
import { memo, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  PiggyBank,
  TrendingUp,
  ChevronRight,
  Activity,
  Info,
} from "lucide-react";
import type { UnifiedTxn } from "@/lib/analytics";
import {
  buildStatements,
  resolveRange,
  PERIOD_LABELS,
  type PeriodKey,
  type Line,
  type Statements,
} from "@/lib/statements";

function inr(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
function inrShort(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `₹${(n / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
  return `₹${Math.round(n)}`;
}
function signed(n: number) {
  return `${n >= 0 ? "+" : "−"}${inr(Math.abs(n))}`;
}

/* ─────────────────────── dashboard summary card ─────────────────────── */

export const FinancialStatementsCard = memo(function FinancialStatementsCard({
  items,
  onOpen,
}: {
  items: UnifiedTxn[];
  onOpen: () => void;
}) {
  const s = useMemo(() => buildStatements(items, resolveRange("this_month")), [items]);
  const rate = s.savingsRate;

  return (
    <button
      onClick={onOpen}
      className="va-glass w-full rounded-3xl p-5 text-left active:scale-[0.99] transition"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-emerald-400/15 text-emerald-300 flex items-center justify-center">
            <Activity size={17} />
          </span>
          <div>
            <div className="text-[15.5px] text-purple-50">Financial Statements</div>
            <div className="text-[12.5px] text-purple-200/55">{s.range.label}</div>
          </div>
        </div>
        <ChevronRight size={16} className="text-purple-300/60" />
      </div>

      <div className="grid grid-cols-4 gap-2 mt-4">
        <MiniStat label="Total Income" value={inrShort(s.totalIncome)} color="#34D399" />
        <MiniStat label="Total Expenses" value={inrShort(s.totalExpenses)} color="#F0ABFC" />
        <MiniStat
          label="Net Income"
          value={`${s.netIncome >= 0 ? "+" : "−"}${inrShort(Math.abs(s.netIncome))}`}
          color={s.netIncome >= 0 ? "#6EE7B7" : "#FCA5A5"}
        />
        <MiniStat
          label="Saved"
          value={rate === null ? "—" : `${Math.round(rate)}%`}
          color="#C084FC"
        />
      </div>

      <IncomeExpenseBar income={s.totalIncome} expenses={s.totalExpenses} className="mt-4" />
    </button>
  );
});

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="text-[11.5px] text-purple-200/55 truncate">{label}</div>
      <div className="va-display text-[16.5px] mt-0.5 truncate" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function IncomeExpenseBar({
  income,
  expenses,
  className = "",
}: {
  income: number;
  expenses: number;
  className?: string;
}) {
  const max = Math.max(income, expenses, 1);
  return (
    <div className={`space-y-2 ${className}`}>
      <Bar label="In" value={income} pct={(income / max) * 100} color="#34D399" />
      <Bar label="Out" value={expenses} pct={(expenses / max) * 100} color="#F0ABFC" />
    </div>
  );
}

function Bar({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[12px] text-purple-200/55 w-7 shrink-0">{label}</span>
      <span className="flex-1 h-2.5 rounded-full bg-purple-400/10 overflow-hidden">
        <span
          className="block h-full rounded-full transition-all"
          style={{ width: `${Math.max(pct, value > 0 ? 4 : 0)}%`, background: color }}
        />
      </span>
      <span className="va-mono text-[12.5px] text-purple-100/80 w-[68px] text-right shrink-0">
        {inrShort(value)}
      </span>
    </div>
  );
}

/* ─────────────────────────── full report panel ───────────────────────── */

export function FinancialStatementsPanel({ items }: { items: UnifiedTxn[] }) {
  const [statement, setStatement] = useState<"income" | "cashflow">("income");
  const [period, setPeriod] = useState<PeriodKey>("this_month");
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: "", to: "" });

  const s = useMemo(
    () => buildStatements(items, resolveRange(period, custom)),
    [items, period, custom],
  );

  if (items.length === 0) {
    return (
      <div className="va-glass rounded-3xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-400/12 text-emerald-300 mx-auto flex items-center justify-center">
          <Activity size={22} />
        </div>
        <p className="text-[15.5px] text-purple-100/85 mt-4">No transactions yet</p>
        <p className="text-[14px] text-purple-200/55 mt-1.5 leading-relaxed">
          Your Income Statement and Cash Flow Statement build themselves as soon as transactions
          arrive.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* statement switcher */}
      <div className="grid grid-cols-2 gap-2 va-glass rounded-2xl p-1.5">
        <SegBtn active={statement === "income"} onClick={() => setStatement("income")}>
          Income Statement
        </SegBtn>
        <SegBtn active={statement === "cashflow"} onClick={() => setStatement("cashflow")}>
          Cash Flow
        </SegBtn>
      </div>

      {/* period switcher */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {(Object.keys(PERIOD_LABELS) as (keyof typeof PERIOD_LABELS)[]).map((k) => (
          <Chip key={k} active={period === k} onClick={() => setPeriod(k)}>
            {PERIOD_LABELS[k]}
          </Chip>
        ))}
        <Chip active={period === "custom"} onClick={() => setPeriod("custom")}>
          Custom
        </Chip>
      </div>

      {period === "custom" && (
        <div className="va-glass rounded-2xl p-4 grid grid-cols-2 gap-3">
          <label className="text-[12.5px] text-purple-200/60">
            From
            <input
              type="date"
              value={custom.from}
              onChange={(e) => setCustom({ ...custom, from: e.target.value })}
              className="va-input w-full rounded-xl px-3 py-2.5 mt-1.5 text-[14px]"
            />
          </label>
          <label className="text-[12.5px] text-purple-200/60">
            To
            <input
              type="date"
              value={custom.to}
              onChange={(e) => setCustom({ ...custom, to: e.target.value })}
              className="va-input w-full rounded-xl px-3 py-2.5 mt-1.5 text-[14px]"
            />
          </label>
        </div>
      )}

      {statement === "income" ? (
        <IncomeStatement s={s} />
      ) : (
        <CashFlowStatement s={s} />
      )}
    </div>
  );
}

/* ─────────────────────────── Income Statement ────────────────────────── */

function IncomeStatement({ s }: { s: Statements }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Tile
          label="Total Income"
          value={inr(s.totalIncome)}
          icon={ArrowDownLeft}
          accent="#34D399"
        />
        <Tile
          label="Total Expenses"
          value={inr(s.totalExpenses)}
          icon={ArrowUpRight}
          accent="#F0ABFC"
        />
        <Tile
          label="Net Income"
          value={signed(s.netIncome)}
          icon={TrendingUp}
          accent={s.netIncome >= 0 ? "#6EE7B7" : "#FCA5A5"}
        />
        <Tile
          label="Savings rate"
          value={s.savingsRate === null ? "Not enough data" : `${Math.round(s.savingsRate)}%`}
          icon={PiggyBank}
          accent="#C084FC"
          small={s.savingsRate === null}
        />
      </div>

      <Card title="Income vs Expenses" sub={s.range.label}>
        <IncomeExpenseBar income={s.totalIncome} expenses={s.totalExpenses} />
        <p className="text-[13px] text-purple-200/60 mt-3.5 leading-relaxed">
          {s.totalIncome === 0 && s.totalExpenses === 0
            ? "No income or spending recorded in this period."
            : s.netIncome >= 0
              ? `You kept ${inr(s.netIncome)} of what came in.`
              : `You spent ${inr(Math.abs(s.netIncome))} more than you earned.`}
        </p>
      </Card>

      <Card title="Income Statement" sub={s.range.label}>
        <LineGroup title="Income breakdown" lines={s.incomeLines} total={s.totalIncome} />
        <div className="va-divider my-4" />
        <LineGroup title="Expense breakdown" lines={s.expenseLines} total={s.totalExpenses} />
        <div className="va-divider my-4" />
        <div className="flex items-center justify-between">
          <span className="va-display text-[16.5px]">
            Net Income{" "}
            <span className="text-[13px] text-purple-200/55">
              ({s.netIncome >= 0 ? "surplus" : "deficit"})
            </span>
          </span>
          <span
            className="va-mono text-[16.5px]"
            style={{ color: s.netIncome >= 0 ? "#6EE7B7" : "#FCA5A5" }}
          >
            {signed(s.netIncome)}
          </span>
        </div>
        {s.transferCount > 0 && (
          <p className="text-[12.5px] text-purple-200/55 leading-relaxed mt-3">
            {s.transferCount} internal transfer{s.transferCount > 1 ? "s" : ""} (
            {inrShort(s.transferTotalIn + s.transferTotalOut)}) excluded — moving your own money
            isn't income or spending. Refunds reduce the category they came from.
          </p>
        )}
      </Card>

      <Card title="Income vs Expenses chart" sub="Last 12 months">
        <TrendChart s={s} />
      </Card>

      <Card title="Spending breakdown" sub="Top categories">
        {s.topExpenseCategories.length === 0 ? (
          <p className="text-[14px] text-purple-200/55">No spending in this period.</p>
        ) : (
          <div className="space-y-2.5">
            {s.topExpenseCategories.map((l) => (
              <Bar
                key={l.label}
                label={l.label.slice(0, 3)}
                value={l.total}
                pct={(l.total / (s.topExpenseCategories[0].total || 1)) * 100}
                color={l.color}
              />
            ))}
            <div className="va-divider my-3" />
            <Row label="Highest category" value={s.highestExpenseCategory?.label ?? "—"} />
            <Row label="Essential" value={inr(s.essentialSpend)} />
            <Row label="Discretionary" value={inr(s.discretionarySpend)} />
            <Row
              label="Highest expense"
              value={
                s.highestExpense
                  ? `${s.highestExpense.merchant} · ${inr(s.highestExpense.amount)}`
                  : "—"
              }
            />
            <Row
              label="Largest income"
              value={
                s.largestIncome
                  ? `${s.largestIncome.merchant} · ${inr(s.largestIncome.amount)}`
                  : "—"
              }
            />
            <Row label="Transactions" value={String(s.txnCount)} />
          </div>
        )}
      </Card>
    </div>
  );
}

/* ────────────────────────── Cash Flow Statement ──────────────────────── */

function CashFlowStatement({ s }: { s: Statements }) {
  const closing =
    s.closingBalance !== null
      ? s.closingBalance
      : s.openingBalance !== null
        ? s.openingBalance + s.netIncome
        : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Tile
          label="Total Cash Inflows"
          value={inr(s.totalIncome)}
          icon={ArrowDownLeft}
          accent="#34D399"
        />
        <Tile
          label="Total Cash Outflows"
          value={inr(s.totalExpenses)}
          icon={ArrowUpRight}
          accent="#F0ABFC"
        />
        <Tile
          label="Net Cash Flow"
          value={signed(s.netIncome)}
          icon={TrendingUp}
          accent={s.netIncome >= 0 ? "#6EE7B7" : "#FCA5A5"}
        />
        <Tile
          label="Closing Balance"
          value={closing === null ? "Unavailable" : inr(closing)}
          icon={PiggyBank}
          accent="#C084FC"
          small={closing === null}
        />
      </div>

      <Card title="Cash Flow Statement" sub={s.range.label}>
        <Row
          label="Opening Balance"
          value={s.openingBalance === null ? null : inr(s.openingBalance)}
        />
        <Row label="Total Cash Inflows" value={`+${inr(s.totalIncome)}`} color="#6EE7B7" />
        <Row label="Total Cash Outflows" value={`−${inr(s.totalExpenses)}`} color="#FCA5A5" />
        <div className="va-divider my-3" />
        <Row
          label="Net Cash Flow"
          value={signed(s.netIncome)}
          color={s.netIncome >= 0 ? "#6EE7B7" : "#FCA5A5"}
          strong
        />
        <Row label="Closing Balance" value={closing === null ? null : inr(closing)} strong />
        {closing === null && (
          <div className="flex items-start gap-2 mt-3">
            <Info size={13} className="text-purple-300/70 mt-0.5 shrink-0" />
            <p className="text-[12.5px] text-purple-200/55 leading-relaxed">
              Opening Balance and Closing Balance are only shown when your bank messages include an
              account balance. Until then, only the movement of money is reported.
            </p>
          </div>
        )}
        {s.transferCount > 0 && (
          <p className="text-[12.5px] text-purple-200/55 leading-relaxed mt-3">
            {s.transferCount} internal transfer{s.transferCount > 1 ? "s" : ""} (
            {inrShort(s.transferTotalIn + s.transferTotalOut)}) excluded from inflows and outflows.
          </p>
        )}
      </Card>

      <Card title="Monthly cash flow" sub="Inflows vs outflows, last 12 months">
        <TrendChart s={s} />
      </Card>

      <Card title="Savings trend" sub="Kept vs earned each month">
        <SavingsTrend s={s} />
      </Card>
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl py-2.5 text-[13.5px] transition"
      style={
        active
          ? {
              background: "rgba(192,132,252,0.25)",
              border: "1px solid rgba(216,180,254,0.5)",
              color: "#F5F3FF",
            }
          : { border: "1px solid transparent", color: "rgba(233,213,255,0.65)" }
      }
    >
      {children}
    </button>
  );
}

/* ───────────────────────────── small pieces ─────────────────────────── */

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3.5 py-2 text-[13px] whitespace-nowrap shrink-0 transition"
      style={
        active
          ? { background: "rgba(192,132,252,0.25)", border: "1px solid rgba(216,180,254,0.5)", color: "#F5F3FF" }
          : {
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(168,85,247,0.2)",
              color: "rgba(233,213,255,0.7)",
            }
      }
    >
      {children}
    </button>
  );
}

function Card({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="va-glass rounded-3xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h4 className="va-display text-[17px] text-white">{title}</h4>
        {sub && <span className="text-[12.5px] text-purple-200/55">{sub}</span>}
      </div>
      {children}
    </div>
  );
}

function Tile({
  label,
  value,
  icon: Icon,
  accent,
  small,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  accent: string;
  small?: boolean;
}) {
  return (
    <div className="va-glass rounded-2xl px-4 py-4">
      <div className="flex items-center gap-2">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: accent + "22" }}
        >
          <Icon size={14} style={{ color: accent }} />
        </span>
        <span className="text-[12.5px] text-purple-200/65">{label}</span>
      </div>
      <div
        className={`va-display mt-2.5 truncate ${small ? "text-[14.5px]" : "text-[21px]"}`}
        style={{ color: accent }}
      >
        {value}
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  color,
  strong,
}: {
  label: string;
  value: string | null;
  color?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className={`text-[13.5px] ${strong ? "text-purple-50" : "text-purple-200/65"}`}>
        {label}
      </span>
      <span
        className={`va-mono text-right truncate ${strong ? "text-[15px]" : "text-[13.5px]"}`}
        style={{ color: value === null ? "rgba(216,180,254,0.45)" : (color ?? "#EDE9FE") }}
      >
        {value ?? "Unavailable"}
      </span>
    </div>
  );
}

function LineGroup({ title, lines, total }: { title: string; lines: Line[]; total: number }) {
  return (
    <div>
      <div className="text-[12px] uppercase tracking-[0.2em] text-purple-200/50 mb-2">{title}</div>
      {lines.length === 0 ? (
        <p className="text-[13.5px] text-purple-200/50">Nothing recorded.</p>
      ) : (
        lines.map((l) => (
          <div key={l.label} className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-[14px] text-purple-100/85 flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />
              <span className="truncate">{l.label}</span>
            </span>
            <span className="va-mono text-[13.5px] text-purple-100/80 shrink-0">{inr(l.total)}</span>
          </div>
        ))
      )}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-purple-500/15">
        <span className="text-[13.5px] text-purple-50">Total {title.toLowerCase()}</span>
        <span className="va-mono text-[14.5px] text-purple-50">{inr(total)}</span>
      </div>
    </div>
  );
}

function TrendChart({ s }: { s: Statements }) {
  const pts = s.monthly;
  if (pts.length === 0) return <p className="text-[13.5px] text-purple-200/55">No history yet.</p>;
  const max = Math.max(1, ...pts.map((p) => Math.max(p.income, p.expenses)));
  return (
    <div>
      <div className="flex items-end gap-2 h-[130px]">
        {pts.map((p) => (
          <div key={p.key} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
            <div className="w-full flex items-end justify-center gap-[3px] h-[104px]">
              <span
                className="w-1/2 rounded-t-md"
                style={{
                  height: `${Math.max((p.income / max) * 100, p.income > 0 ? 3 : 0)}%`,
                  background: "#34D399",
                }}
              />
              <span
                className="w-1/2 rounded-t-md"
                style={{
                  height: `${Math.max((p.expenses / max) * 100, p.expenses > 0 ? 3 : 0)}%`,
                  background: "#F0ABFC",
                }}
              />
            </div>
            <span className="text-[10.5px] text-purple-200/50 truncate w-full text-center">
              {p.label}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-3 text-[12px] text-purple-200/60">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "#34D399" }} /> Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: "#F0ABFC" }} /> Expenses
        </span>
      </div>
    </div>
  );
}

function SavingsTrend({ s }: { s: Statements }) {
  const pts = s.monthly;
  if (pts.length === 0) return <p className="text-[13.5px] text-purple-200/55">No history yet.</p>;
  return (
    <div className="space-y-2">
      {pts.slice(-6).map((p) => (
        <div key={p.key} className="flex items-center gap-2.5">
          <span className="text-[12.5px] text-purple-200/55 w-9 shrink-0">{p.label}</span>
          <span className="flex-1 h-2.5 rounded-full bg-purple-400/10 overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.min(100, Math.max(p.savingsRate === null ? 0 : p.savingsRate, 0))}%`,
                background: (p.net ?? 0) >= 0 ? "#6EE7B7" : "#FCA5A5",
              }}
            />
          </span>
          <span className="va-mono text-[12.5px] text-purple-100/75 w-[86px] text-right shrink-0">
            {p.savingsRate === null ? "no income" : `${Math.round(p.savingsRate)}%`}
          </span>
        </div>
      ))}
    </div>
  );
}
