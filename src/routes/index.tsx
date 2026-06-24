import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Plus,
  X,
  Bell,
  Menu,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Percent,
  CalendarClock,
  Home,
  PieChart,
  Sparkles,
  ChevronRight,
  User,
  Receipt,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Varaigya — Freelance tax & runway" },
      {
        name: "description",
        content:
          "Track income, expenses, tax set-aside, and runway as a freelancer with Varaigya.",
      },
    ],
  }),
  component: Varaigya,
});

const USER_NAME = "Asha";
const MONTHLY_BASE_EXPENSES = 2400;

type IncomeEntry = { id: number; source: string; amount: number; date: string };
type ExpenseEntry = { id: number; label: string; amount: number; category: string };

const seedIncome: IncomeEntry[] = [
  { id: 1, source: "Design retainer — Northbridge", amount: 3200, date: "Jun 02" },
  { id: 2, source: "Logo — Fennel & Co.", amount: 850, date: "Jun 10" },
  { id: 3, source: "Consulting — half day", amount: 600, date: "Jun 18" },
];
const seedExpenses: ExpenseEntry[] = [
  { id: 1, label: "Adobe Creative Cloud", amount: 54.99, category: "Software" },
  { id: 2, label: "Co-working desk", amount: 220, category: "Office" },
  { id: 3, label: "Client lunch", amount: 64, category: "Meals" },
];

function currency(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}
function currencyShort(n: number) {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Varaigya() {
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => setGreeting(getGreeting()), []);

  const [income, setIncome] = useState(seedIncome);
  const [expenses, setExpenses] = useState(seedExpenses);
  const [tab, setTab] = useState<"home" | "ledger" | "expenses" | "profile">("home");
  const [taxRate, setTaxRate] = useState(27);
  const [sheet, setSheet] = useState<null | "income" | "expense" | "menu">(null);
  const [newIncome, setNewIncome] = useState({ source: "", amount: "" });
  const [newExpense, setNewExpense] = useState({
    label: "",
    amount: "",
    category: "Software",
  });

  const totalIncome = useMemo(
    () => income.reduce((s, i) => s + i.amount, 0),
    [income],
  );
  const totalExpenses = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses],
  );
  const netIncome = totalIncome - totalExpenses;
  const setAside = Math.max(0, netIncome * (taxRate / 100));
  const safeToSpend = netIncome - setAside;
  const runwayMonths =
    safeToSpend > 0 ? (safeToSpend / MONTHLY_BASE_EXPENSES).toFixed(1) : "0.0";

  const dueDates = ["2026-09-15", "2027-01-15"];
  const today = new Date("2026-06-24");
  const nextDue = dueDates.find((d) => new Date(d) >= today) || dueDates[0];
  const daysUntilDue = Math.ceil(
    (new Date(nextDue).getTime() - today.getTime()) / 86400000,
  );

  function addIncome() {
    if (!newIncome.source || !newIncome.amount) return;
    setIncome([
      {
        id: Date.now(),
        source: newIncome.source,
        amount: parseFloat(newIncome.amount),
        date: "Today",
      },
      ...income,
    ]);
    setNewIncome({ source: "", amount: "" });
    setSheet(null);
  }
  function addExpense() {
    if (!newExpense.label || !newExpense.amount) return;
    setExpenses([
      {
        id: Date.now(),
        label: newExpense.label,
        amount: parseFloat(newExpense.amount),
        category: newExpense.category,
      },
      ...expenses,
    ]);
    setNewExpense({ label: "", amount: "", category: "Software" });
    setSheet(null);
  }

  const recent = [
    ...income.map((i) => ({
      key: `i-${i.id}`,
      kind: "in" as const,
      label: i.source,
      meta: i.date,
      amount: i.amount,
    })),
    ...expenses.map((e) => ({
      key: `e-${e.id}`,
      kind: "out" as const,
      label: e.label,
      meta: e.category,
      amount: e.amount,
    })),
  ].slice(0, 6);

  return (
    <div className="va-root min-h-screen text-white">
      <style>{`
        .va-root {
          background:
            radial-gradient(900px 500px at 80% -10%, rgba(168,85,247,0.35), transparent 60%),
            radial-gradient(700px 500px at -20% 110%, rgba(91,33,182,0.45), transparent 60%),
            #07050F;
          font-family: 'Space Grotesk', system-ui, sans-serif;
        }
        .va-display {
          font-family: 'Bricolage Grotesque', serif;
          font-weight: 600;
          letter-spacing: -0.02em;
        }
        .va-mono { font-family: 'Space Mono', monospace; }
        .va-glass {
          background: linear-gradient(150deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
          border: 1px solid rgba(168,85,247,0.18);
          backdrop-filter: blur(12px);
        }
        .va-balance-card {
          background:
            radial-gradient(120% 120% at 0% 0%, rgba(216,180,254,0.35), transparent 50%),
            linear-gradient(135deg, #6B21A8 0%, #4C1D95 60%, #2E1065 100%);
          box-shadow:
            0 30px 60px -30px rgba(168,85,247,0.55),
            inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .va-quick {
          background: linear-gradient(160deg, rgba(168,85,247,0.10), rgba(255,255,255,0.02));
          border: 1px solid rgba(168,85,247,0.22);
          transition: transform .15s ease, background .2s ease, border-color .2s ease;
        }
        .va-quick:hover { background: linear-gradient(160deg, rgba(168,85,247,0.20), rgba(255,255,255,0.04)); border-color: rgba(216,180,254,0.45); }
        .va-quick:active { transform: scale(0.97); }
        .va-fab {
          background: radial-gradient(circle at 30% 20%, #D8B4FE, #A855F7 55%, #6B21A8);
          box-shadow: 0 18px 40px -12px rgba(168,85,247,0.8), inset 0 1px 0 rgba(255,255,255,0.4);
        }
        .va-dock {
          background: rgba(15, 8, 30, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(168,85,247,0.22);
        }
        .va-chip {
          background: rgba(168,85,247,0.15);
          border: 1px solid rgba(216,180,254,0.25);
        }
        .va-input {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(168,85,247,0.25);
          color: #F5F3FF;
        }
        .va-input::placeholder { color: rgba(216,180,254,0.5); }
        .va-input:focus { outline: none; border-color: #C084FC; box-shadow: 0 0 0 3px rgba(192,132,252,0.18); }
        @keyframes pulseRing {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
        .va-ring { animation: pulseRing 3.5s ease-in-out infinite; }
        @keyframes sheetUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .va-sheet { animation: sheetUp .25s ease-out; }
        .va-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(168,85,247,0.35), transparent);
        }
      `}</style>

      <div className="max-w-md mx-auto min-h-screen pb-32 relative">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 pt-6">
          <button
            onClick={() => setSheet("menu")}
            className="w-10 h-10 rounded-full va-glass flex items-center justify-center active:scale-95 transition"
          >
            <Menu size={18} />
          </button>
          <div className="text-[11px] uppercase tracking-[0.25em] text-purple-200/60">
            Varaigya · v1
          </div>
          <button className="w-10 h-10 rounded-full va-glass flex items-center justify-center relative active:scale-95 transition">
            <Bell size={17} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
          </button>
        </div>

        {/* Greeting */}
        <div className="px-6 pt-6">
          <p className="text-purple-200/70 text-[13px]">{greeting},</p>
          <h1 className="va-display text-3xl mt-1">{USER_NAME} Mehta</h1>
          <p className="va-display text-2xl mt-3 leading-snug">
            You're carrying{" "}
            <span className="text-fuchsia-300">{runwayMonths} months</span>
            <br />
            of runway.
          </p>
        </div>

        {/* Balance card */}
        <div className="px-6 mt-6">
          <div className="va-balance-card rounded-3xl p-5 relative overflow-hidden">
            {/* glow corner */}
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-fuchsia-400/30 blur-3xl va-ring" />
            <div className="flex items-center justify-between relative">
              <div>
                <div className="text-purple-200/80 text-[12px] tracking-wide">
                  Safe to spend
                </div>
                <div className="va-display text-[34px] mt-1 leading-none">
                  {currency(safeToSpend)}
                </div>
              </div>
              <div className="va-chip rounded-full px-3 py-1 text-[11px] text-purple-100">
                {taxRate}% set aside
              </div>
            </div>

            <div className="va-divider my-4 opacity-60" />

            <div className="flex items-center justify-between text-[12px] relative">
              <div>
                <div className="text-purple-200/60">Earned</div>
                <div className="va-mono text-purple-50 mt-0.5">
                  {currencyShort(totalIncome)}
                </div>
              </div>
              <div>
                <div className="text-purple-200/60">Spent</div>
                <div className="va-mono text-purple-50 mt-0.5">
                  {currencyShort(totalExpenses)}
                </div>
              </div>
              <div>
                <div className="text-purple-200/60">Tax jar</div>
                <div className="va-mono text-fuchsia-200 mt-0.5">
                  {currencyShort(setAside)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick services */}
        <div className="px-6 mt-6">
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: ArrowDownLeft, label: "Income", onClick: () => setSheet("income") },
              { icon: ArrowUpRight, label: "Expense", onClick: () => setSheet("expense") },
              { icon: Percent, label: "Tax %", onClick: () => setTab("profile") },
              { icon: CalendarClock, label: `${daysUntilDue}d`, onClick: () => {} },
            ].map((q) => (
              <button
                key={q.label}
                onClick={q.onClick}
                className="va-quick rounded-2xl py-3 flex flex-col items-center gap-1.5"
              >
                <q.icon size={18} className="text-fuchsia-200" />
                <span className="text-[11px] text-purple-100/80">{q.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Transactions */}
        <div className="px-6 mt-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="va-display text-[17px]">Transactions</h2>
            <button
              onClick={() => setTab("ledger")}
              className="text-[12px] text-fuchsia-300 flex items-center gap-0.5"
            >
              See all <ChevronRight size={14} />
            </button>
          </div>

          <div className="va-glass rounded-2xl divide-y divide-purple-500/10">
            {recent.map((r) => (
              <div
                key={r.key}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    r.kind === "in"
                      ? "bg-emerald-400/15 text-emerald-300"
                      : "bg-fuchsia-400/15 text-fuchsia-300"
                  }`}
                >
                  {r.kind === "in" ? (
                    <ArrowDownLeft size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] text-purple-50 truncate">
                    {r.label}
                  </div>
                  <div className="text-[11px] text-purple-200/50">{r.meta}</div>
                </div>
                <div
                  className={`va-mono text-[13px] ${
                    r.kind === "in" ? "text-emerald-300" : "text-fuchsia-200"
                  }`}
                >
                  {r.kind === "in" ? "+" : "−"}
                  {currency(r.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI nudge */}
        <div className="px-6 mt-5">
          <div className="va-glass rounded-2xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-200">
              <Sparkles size={15} />
            </div>
            <p className="text-[12.5px] leading-relaxed text-purple-100/80">
              Next quarterly estimate due in{" "}
              <span className="text-fuchsia-300 font-medium">{daysUntilDue} days</span>.
              Your tax jar already covers{" "}
              <span className="text-white">{currencyShort(setAside)}</span>.
            </p>
          </div>
        </div>

        {/* Floating dock */}
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 w-[88%] max-w-md">
          <div className="va-dock rounded-full px-3 py-2 flex items-center justify-between">
            <DockBtn
              icon={Home}
              active={tab === "home"}
              onClick={() => setTab("home")}
            />
            <DockBtn
              icon={Receipt}
              active={tab === "ledger"}
              onClick={() => setTab("ledger")}
            />
            <button
              onClick={() => setSheet("income")}
              className="va-fab w-14 h-14 rounded-full flex items-center justify-center -mt-8 active:scale-95 transition"
              aria-label="Add"
            >
              <Plus size={24} className="text-white" />
            </button>
            <DockBtn
              icon={PieChart}
              active={tab === "expenses"}
              onClick={() => setTab("expenses")}
            />
            <DockBtn
              icon={User}
              active={tab === "profile"}
              onClick={() => setTab("profile")}
            />
          </div>
        </div>

        {/* Drawer overlays for ledger/expenses/profile content shown as sheets */}
        {tab !== "home" && (
          <SecondarySheet
            title={
              tab === "ledger"
                ? "Income"
                : tab === "expenses"
                  ? "Expenses"
                  : "Profile"
            }
            onClose={() => setTab("home")}
          >
            {tab === "ledger" && (
              <LedgerList
                items={income.map((i) => ({
                  id: i.id,
                  primary: i.source,
                  secondary: i.date,
                  amount: i.amount,
                  positive: true,
                }))}
              />
            )}
            {tab === "expenses" && (
              <LedgerList
                items={expenses.map((e) => ({
                  id: e.id,
                  primary: e.label,
                  secondary: e.category,
                  amount: e.amount,
                  positive: false,
                }))}
              />
            )}
            {tab === "profile" && (
              <ProfilePanel
                taxRate={taxRate}
                setTaxRate={setTaxRate}
                runway={runwayMonths}
              />
            )}
          </SecondarySheet>
        )}

        {/* Bottom sheet — add */}
        {sheet === "income" && (
          <BottomSheet title="Log income" onClose={() => setSheet(null)}>
            <input
              className="va-input w-full rounded-xl px-4 py-3 text-[14px]"
              placeholder="Source — e.g. Client name"
              value={newIncome.source}
              onChange={(e) =>
                setNewIncome({ ...newIncome, source: e.target.value })
              }
            />
            <input
              className="va-input va-mono w-full rounded-xl px-4 py-3 text-[14px]"
              placeholder="Amount"
              type="number"
              value={newIncome.amount}
              onChange={(e) =>
                setNewIncome({ ...newIncome, amount: e.target.value })
              }
            />
            <button
              onClick={addIncome}
              className="va-fab w-full rounded-xl py-3 text-[14px] font-semibold text-white active:scale-[0.98] transition"
            >
              Add income
            </button>
          </BottomSheet>
        )}

        {sheet === "expense" && (
          <BottomSheet title="Log expense" onClose={() => setSheet(null)}>
            <input
              className="va-input w-full rounded-xl px-4 py-3 text-[14px]"
              placeholder="What was it for?"
              value={newExpense.label}
              onChange={(e) =>
                setNewExpense({ ...newExpense, label: e.target.value })
              }
            />
            <input
              className="va-input va-mono w-full rounded-xl px-4 py-3 text-[14px]"
              placeholder="Amount"
              type="number"
              value={newExpense.amount}
              onChange={(e) =>
                setNewExpense({ ...newExpense, amount: e.target.value })
              }
            />
            <div className="flex gap-2 flex-wrap">
              {["Software", "Office", "Meals", "Travel", "Equipment", "Other"].map(
                (c) => (
                  <button
                    key={c}
                    onClick={() => setNewExpense({ ...newExpense, category: c })}
                    className="px-3 py-1.5 rounded-full text-[12px] transition"
                    style={{
                      background:
                        newExpense.category === c
                          ? "linear-gradient(135deg,#C084FC,#7C3AED)"
                          : "rgba(168,85,247,0.12)",
                      border: "1px solid rgba(216,180,254,0.25)",
                      color: newExpense.category === c ? "#FFF" : "#E9D5FF",
                    }}
                  >
                    {c}
                  </button>
                ),
              )}
            </div>
            <button
              onClick={addExpense}
              className="va-fab w-full rounded-xl py-3 text-[14px] font-semibold text-white active:scale-[0.98] transition"
            >
              Add expense
            </button>
          </BottomSheet>
        )}

        {sheet === "menu" && (
          <BottomSheet title="Quick menu" onClose={() => setSheet(null)}>
            {[
              { icon: Wallet, label: "View income ledger", onClick: () => { setTab("ledger"); setSheet(null); } },
              { icon: Receipt, label: "View expenses", onClick: () => { setTab("expenses"); setSheet(null); } },
              { icon: Percent, label: "Adjust tax rate", onClick: () => { setTab("profile"); setSheet(null); } },
            ].map((m) => (
              <button
                key={m.label}
                onClick={m.onClick}
                className="va-glass rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left active:scale-[0.99] transition"
              >
                <m.icon size={16} className="text-fuchsia-300" />
                <span className="text-[13.5px] text-purple-50">{m.label}</span>
                <ChevronRight size={14} className="ml-auto text-purple-300/60" />
              </button>
            ))}
          </BottomSheet>
        )}
      </div>
    </div>
  );
}

function DockBtn({
  icon: Icon,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90"
      style={{
        background: active
          ? "linear-gradient(135deg, rgba(216,180,254,0.25), rgba(168,85,247,0.15))"
          : "transparent",
        color: active ? "#F5F3FF" : "rgba(216,180,254,0.6)",
      }}
    >
      <Icon size={18} />
    </button>
  );
}

function BottomSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="va-sheet relative w-full max-w-md rounded-t-3xl p-5 pb-8 va-glass"
        style={{ background: "linear-gradient(180deg, #15092A 0%, #0B0518 100%)" }}>
        <div className="mx-auto w-10 h-1 rounded-full bg-purple-400/30 mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="va-display text-[18px] text-white">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full va-glass flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}

function SecondarySheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="va-sheet relative w-full max-w-md rounded-t-3xl p-5 pb-28 max-h-[85vh] overflow-y-auto"
        style={{ background: "linear-gradient(180deg, #15092A 0%, #07050F 100%)", border: "1px solid rgba(168,85,247,0.2)" }}
      >
        <div className="mx-auto w-10 h-1 rounded-full bg-purple-400/30 mb-4" />
        <div className="flex items-center justify-between mb-5">
          <h3 className="va-display text-[20px] text-white">{title}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full va-glass flex items-center justify-center"
          >
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LedgerList({
  items,
}: {
  items: { id: number; primary: string; secondary: string; amount: number; positive: boolean }[];
}) {
  return (
    <div className="va-glass rounded-2xl divide-y divide-purple-500/10">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-3 px-4 py-3.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              it.positive
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-fuchsia-400/15 text-fuchsia-300"
            }`}
          >
            {it.positive ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] text-purple-50 truncate">{it.primary}</div>
            <div className="text-[11px] text-purple-200/50">{it.secondary}</div>
          </div>
          <div
            className={`va-mono text-[13px] ${
              it.positive ? "text-emerald-300" : "text-fuchsia-200"
            }`}
          >
            {it.positive ? "+" : "−"}
            {currency(it.amount)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProfilePanel({
  taxRate,
  setTaxRate,
  runway,
}: {
  taxRate: number;
  setTaxRate: (n: number) => void;
  runway: string;
}) {
  return (
    <div className="space-y-5">
      <div className="va-balance-card rounded-2xl p-4">
        <div className="text-purple-200/80 text-[12px]">Current runway</div>
        <div className="va-display text-3xl mt-1">{runway} months</div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-purple-200/60 mb-2">
          Tax set-aside rate
        </div>
        <div className="va-glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-purple-100">Blended rate</span>
            <span className="va-mono text-fuchsia-200 text-[15px]">{taxRate}%</span>
          </div>
          <input
            type="range"
            min={10}
            max={40}
            value={taxRate}
            onChange={(e) => setTaxRate(parseInt(e.target.value))}
            className="w-full"
            style={{ accentColor: "#C084FC" }}
          />
          <div className="flex justify-between text-[10px] text-purple-200/50 mt-1">
            <span>10%</span>
            <span>40%</span>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-purple-200/60 mb-2">
          Reminders
        </div>
        <div className="va-glass rounded-2xl p-4 flex items-center gap-3">
          <CalendarClock size={16} className="text-fuchsia-300" />
          <span className="text-[13px] text-purple-100">
            Quarterly estimate — Sep 15, 2026
          </span>
        </div>
      </div>
    </div>
  );
}
