import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  Plus,
  X,
  Calendar,
  Sparkles,
  Moon,
  Sun,
  LogOut,
  Bell,
  Percent,
  ChevronLeft,
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
      { property: "og:title", content: "Varaigya — Freelance tax & runway" },
      {
        property: "og:description",
        content:
          "Track income, expenses, tax set-aside, and runway as a freelancer with Varaigya.",
      },
    ],
  }),
  component: Varaigya,
});

// ---- Black & Purple theme tokens ----
const THEMES = {
  dark: {
    bg: "#070009",
    surface: "#120821",
    surfaceAlt: "#1B0F31",
    border: "#2E1A52",
    text: "#F2EAFF",
    muted: "#9A86C2",
    mutedDim: "#6B5891",
    accent: "#B57BFF",
    accentHover: "#D2A6FF",
    negative: "#FF6B8B",
    selectBg: "#0B0414",
  },
  light: {
    bg: "#F5F1FB",
    surface: "#FFFFFF",
    surfaceAlt: "#EFE7FA",
    border: "#D8C7F0",
    text: "#1A0B2E",
    muted: "#6B5891",
    mutedDim: "#9A86C2",
    accent: "#7A29D6",
    accentHover: "#5F1FAE",
    negative: "#D6336C",
    selectBg: "#FFFFFF",
  },
} as const;

const USER_NAME = "Asha";
const USER_EMAIL = "asha@northbridgedesign.co";

const seedIncome = [
  { id: 1, source: "Design retainer — Northbridge Co.", amount: 3200, date: "2026-06-02" },
  { id: 2, source: "Logo project — Fennel & Co.", amount: 850, date: "2026-06-10" },
  { id: 3, source: "Consulting — half day", amount: 600, date: "2026-06-18" },
];

const seedExpenses = [
  { id: 1, label: "Adobe Creative Cloud", amount: 54.99, category: "Software" },
  { id: 2, label: "Co-working desk", amount: 220, category: "Office" },
  { id: 3, label: "Client lunch — Northbridge", amount: 64, category: "Meals (50%)" },
];

const MONTHLY_BASE_EXPENSES = 2400;

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function currencyPrecise(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

type Theme = (typeof THEMES)[keyof typeof THEMES];

function SetAsideRing({ amount, theme }: { percent: number; amount: number; theme: Theme }) {
  const r = 64;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - 100 / 100);

  return (
    <div className="relative flex items-center justify-center group cursor-default transition-transform duration-300 hover:scale-[1.03]">
      <svg width="160" height="160" viewBox="0 0 160 160" className="overflow-visible">
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.accent} />
            <stop offset="100%" stopColor={theme.accentHover} />
          </linearGradient>
          <filter id="ringGlow">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx="80" cy="80" r={r} fill="none" stroke={theme.border} strokeWidth="9" />
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="9"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
          filter="url(#ringGlow)"
          className="transition-all duration-1000 ease-out"
          style={{ animation: "breathe 4s ease-in-out infinite" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span
          className="text-2xl tracking-tight"
          style={{ fontFamily: "'Space Mono', monospace", color: theme.text }}
        >
          {currency(amount)}
        </span>
        <span
          className="text-[10px] uppercase tracking-[0.15em] mt-1"
          style={{ color: theme.muted }}
        >
          set aside
        </span>
      </div>
      <style>{`
        @keyframes breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.65; } }
      `}</style>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  children,
  theme,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  label: string;
  children: React.ReactNode;
  theme: Theme;
}) {
  return (
    <div
      className="flex items-center justify-between py-3.5 px-4 rounded-lg transition-colors"
      style={{ backgroundColor: theme.surface, border: `1px solid ${theme.border}` }}
    >
      <div className="flex items-center gap-3">
        <Icon size={16} style={{ color: theme.muted }} />
        <span className="text-[14px]" style={{ color: theme.text }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function Varaigya() {
  const [themeName, setThemeName] = useState<"dark" | "light">("dark");
  const theme = THEMES[themeName];

  const [income, setIncome] = useState(seedIncome);
  const [expenses, setExpenses] = useState(seedExpenses);
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newIncome, setNewIncome] = useState({ source: "", amount: "" });
  const [newExpense, setNewExpense] = useState({ label: "", amount: "", category: "Software" });
  const [tab, setTab] = useState<"ledger" | "expenses" | "profile">("ledger");
  const [taxRate, setTaxRate] = useState(27);
  const [notifsOn, setNotifsOn] = useState(true);

  const totalIncome = useMemo(() => income.reduce((s, i) => s + i.amount, 0), [income]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const netIncome = totalIncome - totalExpenses;
  const setAside = netIncome * (taxRate / 100);
  const runwayMonths =
    netIncome - setAside > 0
      ? ((netIncome - setAside) / MONTHLY_BASE_EXPENSES).toFixed(1)
      : "0.0";

  const dueDates = ["2026-04-15", "2026-06-15", "2026-09-15", "2027-01-15"];
  const today = new Date("2026-06-24");
  const nextDue = dueDates.find((d) => new Date(d) >= today) || dueDates[0];
  const daysUntilDue = Math.ceil(
    (new Date(nextDue).getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  const greeting = getGreeting();

  function addIncome() {
    if (!newIncome.source || !newIncome.amount) return;
    setIncome([
      {
        id: Date.now(),
        source: newIncome.source,
        amount: parseFloat(newIncome.amount),
        date: "2026-06-24",
      },
      ...income,
    ]);
    setNewIncome({ source: "", amount: "" });
    setShowAddIncome(false);
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
    setShowAddExpense(false);
  }

  const inputStyle: React.CSSProperties = {
    backgroundColor: "transparent",
    borderColor: theme.border,
    color: theme.text,
  };

  const ambientBg =
    themeName === "dark"
      ? `radial-gradient(1200px 600px at 80% -10%, rgba(181,123,255,0.18), transparent 60%), radial-gradient(900px 500px at -10% 110%, rgba(122,41,214,0.22), transparent 60%), ${theme.bg}`
      : `radial-gradient(900px 500px at 100% -10%, rgba(122,41,214,0.10), transparent 60%), ${theme.bg}`;

  return (
    <div
      className="min-h-screen transition-colors duration-300"
      style={{
        background: ambientBg,
        color: theme.text,
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
      }}
    >
      <div className="max-w-md mx-auto min-h-screen flex flex-col">
        {/* Header */}
        <div className="px-6 pt-7 pb-4 flex items-start justify-between">
          <div>
            <h1
              className="text-2xl tracking-tight"
              style={{
                fontFamily: "'Bricolage Grotesque', sans-serif",
                fontWeight: 700,
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Varaigya
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: theme.muted }}>
              {greeting}, {USER_NAME}.
            </p>
          </div>
          <button
            onClick={() => setTab("profile")}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold transition-transform active:scale-90 hover:scale-105"
            style={{
              backgroundColor: theme.surfaceAlt,
              color: theme.accent,
              border: `1px solid ${theme.border}`,
            }}
          >
            {initials(USER_NAME)}
          </button>
        </div>

        {tab !== "profile" && (
          <>
            <div className="px-6 pb-5 flex flex-col items-center">
              <SetAsideRing percent={taxRate} amount={setAside} theme={theme} />
            </div>

            <div
              className="mx-6 flex items-center justify-between text-[12px] rounded-lg py-2.5 px-4"
              style={{
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
                color: theme.muted,
              }}
            >
              <span>
                Net{" "}
                <span className="font-medium" style={{ color: theme.text }}>
                  {currency(netIncome)}
                </span>
              </span>
              <span className="w-px h-3" style={{ backgroundColor: theme.border }} />
              <span>
                Runway{" "}
                <span className="font-medium" style={{ color: theme.accent }}>
                  {runwayMonths} mo
                </span>
              </span>
              <span className="w-px h-3" style={{ backgroundColor: theme.border }} />
              <span className="flex items-center gap-1">
                <Calendar size={11} />
                Due in {daysUntilDue}d
              </span>
            </div>

            <div
              className="px-6 flex gap-6 border-b mt-4"
              style={{ borderColor: theme.border }}
            >
              {(["ledger", "expenses"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="pb-3 text-[13px] tracking-wide capitalize transition-all duration-150 active:scale-95"
                  style={{
                    color: tab === t ? theme.accent : theme.mutedDim,
                    borderBottom:
                      tab === t ? `2px solid ${theme.accent}` : "2px solid transparent",
                  }}
                >
                  {t === "ledger" ? "Income" : "Expenses"}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="flex-1 px-6 py-5">
          {tab === "ledger" && (
            <div>
              <div className="flex items-center justify-end mb-3">
                <button
                  onClick={() => setShowAddIncome(!showAddIncome)}
                  className="flex items-center gap-1 text-[12px] active:scale-95 transition-all duration-150 px-2 py-1 rounded-md"
                  style={{ color: theme.accent }}
                >
                  {showAddIncome ? <X size={14} /> : <Plus size={14} />}
                  {showAddIncome ? "Cancel" : "Log income"}
                </button>
              </div>

              {showAddIncome && (
                <div
                  className="mb-4 p-4 rounded-lg space-y-2"
                  style={{
                    backgroundColor: theme.surface,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <input
                    placeholder="Source — e.g. Client name"
                    value={newIncome.source}
                    onChange={(e) => setNewIncome({ ...newIncome, source: e.target.value })}
                    className="w-full border-b pb-2 text-sm focus:outline-none transition-colors"
                    style={inputStyle}
                  />
                  <input
                    placeholder="Amount"
                    type="number"
                    value={newIncome.amount}
                    onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })}
                    className="w-full border-b pb-2 text-sm focus:outline-none transition-colors"
                    style={{ ...inputStyle, fontFamily: "'Space Mono', monospace" }}
                  />
                  <button
                    onClick={addIncome}
                    className="w-full mt-2 text-sm font-semibold py-2.5 rounded-md active:scale-[0.98] transition-all duration-150"
                    style={{
                      background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})`,
                      color: themeName === "dark" ? "#0B0414" : "#FFFFFF",
                    }}
                  >
                    Add entry
                  </button>
                </div>
              )}

              <div className="space-y-0">
                {income.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-3 border-t first:border-t-0 transition-colors duration-150 -mx-2 px-2 rounded-md cursor-default"
                    style={{ borderColor: theme.border }}
                  >
                    <div>
                      <div className="text-[14px]" style={{ color: theme.text }}>
                        {entry.source}
                      </div>
                      <div
                        className="text-[12px] mt-0.5"
                        style={{ color: theme.mutedDim }}
                      >
                        {entry.date}
                      </div>
                    </div>
                    <span
                      className="text-[14px]"
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        color: theme.accent,
                      }}
                    >
                      +{currencyPrecise(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "expenses" && (
            <div>
              <div className="flex items-center justify-end mb-3">
                <button
                  onClick={() => setShowAddExpense(!showAddExpense)}
                  className="flex items-center gap-1 text-[12px] active:scale-95 transition-all duration-150 px-2 py-1 rounded-md"
                  style={{ color: theme.accent }}
                >
                  {showAddExpense ? <X size={14} /> : <Plus size={14} />}
                  {showAddExpense ? "Cancel" : "Log expense"}
                </button>
              </div>

              {showAddExpense && (
                <div
                  className="mb-4 p-4 rounded-lg space-y-2"
                  style={{
                    backgroundColor: theme.surface,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <input
                    placeholder="What was it for?"
                    value={newExpense.label}
                    onChange={(e) => setNewExpense({ ...newExpense, label: e.target.value })}
                    className="w-full border-b pb-2 text-sm focus:outline-none transition-colors"
                    style={inputStyle}
                  />
                  <input
                    placeholder="Amount"
                    type="number"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                    className="w-full border-b pb-2 text-sm focus:outline-none transition-colors"
                    style={{ ...inputStyle, fontFamily: "'Space Mono', monospace" }}
                  />
                  <select
                    value={newExpense.category}
                    onChange={(e) =>
                      setNewExpense({ ...newExpense, category: e.target.value })
                    }
                    className="w-full border-b pb-2 text-sm focus:outline-none transition-colors"
                    style={{
                      backgroundColor: theme.selectBg,
                      color: theme.text,
                      borderColor: theme.border,
                    }}
                  >
                    {["Software", "Office", "Meals (50%)", "Travel", "Equipment", "Other"].map(
                      (c) => (
                        <option
                          key={c}
                          value={c}
                          style={{ backgroundColor: theme.selectBg, color: theme.text }}
                        >
                          {c}
                        </option>
                      ),
                    )}
                  </select>
                  <button
                    onClick={addExpense}
                    className="w-full mt-2 text-sm font-semibold py-2.5 rounded-md active:scale-[0.98] transition-all duration-150"
                    style={{
                      background: `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})`,
                      color: themeName === "dark" ? "#0B0414" : "#FFFFFF",
                    }}
                  >
                    Add entry
                  </button>
                </div>
              )}

              <div className="space-y-0">
                {expenses.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-3 border-t first:border-t-0 transition-colors duration-150 -mx-2 px-2 rounded-md cursor-default"
                    style={{ borderColor: theme.border }}
                  >
                    <div>
                      <div className="text-[14px]" style={{ color: theme.text }}>
                        {entry.label}
                      </div>
                      <div
                        className="text-[12px] mt-0.5"
                        style={{ color: theme.mutedDim }}
                      >
                        {entry.category}
                      </div>
                    </div>
                    <span
                      className="text-[14px]"
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        color: theme.negative,
                      }}
                    >
                      -{currencyPrecise(entry.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "profile" && (
            <div>
              <button
                onClick={() => setTab("ledger")}
                className="flex items-center gap-1 text-[13px] mb-5 active:scale-95 transition-transform"
                style={{ color: theme.muted }}
              >
                <ChevronLeft size={16} /> Back
              </button>

              <div
                className="flex items-center gap-3 p-4 rounded-lg mb-6"
                style={{
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-[15px] font-semibold"
                  style={{
                    background: `linear-gradient(135deg, ${theme.surfaceAlt}, ${theme.bg})`,
                    color: theme.accent,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  {initials(USER_NAME)}
                </div>
                <div>
                  <div
                    className="text-[15px] font-medium"
                    style={{ color: theme.text }}
                  >
                    {USER_NAME}
                  </div>
                  <div className="text-[12px]" style={{ color: theme.muted }}>
                    {USER_EMAIL}
                  </div>
                </div>
              </div>

              <div
                className="text-[11px] uppercase tracking-[0.12em] mb-2"
                style={{ color: theme.mutedDim }}
              >
                Appearance
              </div>
              <div className="mb-6">
                <ToggleRow
                  icon={themeName === "dark" ? Moon : Sun}
                  label="Theme"
                  theme={theme}
                >
                  <div
                    className="flex rounded-full p-0.5"
                    style={{
                      backgroundColor: theme.surfaceAlt,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    {(["dark", "light"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setThemeName(t)}
                        className="px-3 py-1 rounded-full text-[12px] capitalize transition-all duration-200"
                        style={{
                          background:
                            themeName === t
                              ? `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})`
                              : "transparent",
                          color:
                            themeName === t
                              ? themeName === "dark"
                                ? "#0B0414"
                                : "#FFFFFF"
                              : theme.muted,
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </ToggleRow>
              </div>

              <div
                className="text-[11px] uppercase tracking-[0.12em] mb-2"
                style={{ color: theme.mutedDim }}
              >
                Tax settings
              </div>
              <div className="mb-6">
                <ToggleRow icon={Percent} label="Set-aside rate" theme={theme}>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="10"
                      max="40"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseInt(e.target.value))}
                      className="w-20"
                      style={{ accentColor: theme.accent }}
                    />
                    <span
                      className="text-[13px] w-9 text-right"
                      style={{
                        fontFamily: "'Space Mono', monospace",
                        color: theme.text,
                      }}
                    >
                      {taxRate}%
                    </span>
                  </div>
                </ToggleRow>
              </div>

              <div
                className="text-[11px] uppercase tracking-[0.12em] mb-2"
                style={{ color: theme.mutedDim }}
              >
                Notifications
              </div>
              <div className="mb-6 space-y-2">
                <ToggleRow
                  icon={Bell}
                  label="Quarterly due-date reminders"
                  theme={theme}
                >
                  <button
                    onClick={() => setNotifsOn(!notifsOn)}
                    className="w-11 h-6 rounded-full relative transition-colors duration-200"
                    style={{
                      background: notifsOn
                        ? `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover})`
                        : theme.surfaceAlt,
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    <span
                      className="absolute top-0.5 rounded-full bg-white transition-transform duration-200"
                      style={{
                        transform: notifsOn ? "translateX(22px)" : "translateX(2px)",
                        width: 18,
                        height: 18,
                      }}
                    />
                  </button>
                </ToggleRow>
              </div>

              <button
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-[13px] mt-4 transition-colors duration-150"
                style={{
                  color: theme.negative,
                  border: `1px solid ${theme.border}`,
                  backgroundColor: theme.surface,
                }}
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          )}
        </div>

        {tab !== "profile" && (
          <div className="px-6 pb-8">
            <div
              className="rounded-lg p-4 flex items-start gap-3 transition-colors duration-200"
              style={{
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
                boxShadow:
                  themeName === "dark"
                    ? `0 10px 40px -20px ${theme.accent}55`
                    : undefined,
              }}
            >
              <Sparkles
                size={16}
                style={{ color: theme.accent }}
                className="mt-0.5 flex-shrink-0"
              />
              <div
                className="text-[13px] leading-relaxed"
                style={{ color: theme.muted }}
              >
                You've earned{" "}
                <span className="font-medium" style={{ color: theme.text }}>
                  {currency(totalIncome)}
                </span>{" "}
                this month. Once tax is set aside, you're carrying{" "}
                <span className="font-medium" style={{ color: theme.accent }}>
                  {runwayMonths} months
                </span>{" "}
                of runway at your current spend rate.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
