import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, X, Bell, Menu, ArrowUpRight, ArrowDownLeft, Wallet,
  Percent, CalendarClock, Home, PieChart, Sparkles, ChevronRight,
  User, Receipt, LogOut, Loader2, Calculator, BellRing, Delete, Trash2,
  Smartphone, Brain, RefreshCw, TrendingUp, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ilog } from "@/lib/ingest-log";
import { fetchInsights } from "@/lib/insights-client";
import { useAutoImport, isNativeAndroidRuntime } from "@/hooks/use-auto-import";
type AutoImport = ReturnType<typeof useAutoImport>;

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Varaigya — Your dashboard" },
      { name: "description", content: "Track income, expenses, tax set-aside, and runway." },
    ],
  }),
  component: Dashboard,
});

type Txn = {
  id: string;
  kind: "income" | "expense";
  label: string;
  amount: number;
  category: string | null;
  occurred_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
  tax_rate: number;
  monthly_base_expenses: number;
};

function currency(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function currencyShort(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit" });
}

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [greeting, setGreeting] = useState("Hello");
  useEffect(() => setGreeting(getGreeting()), []);

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async (): Promise<Profile> => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (error) throw error;
      if (data) return data as Profile;
      // fallback: create if trigger missed
      const { data: created, error: cErr } = await supabase
        .from("profiles")
        .insert({ id: uid })
        .select()
        .single();
      if (cErr) throw cErr;
      return created as Profile;
    },
  });

  const txnsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: async (): Promise<Txn[]> => {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });

  const upiQuery = useQuery({
    queryKey: ["upi_transactions"],
    queryFn: async (): Promise<UpiTxn[]> => {
      const { data, error } = await supabase
        .from("upi_transactions" as never)
        .select("*")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UpiTxn[];
    },
  });

  const addTxn = useMutation({
    mutationFn: async (t: { kind: "income" | "expense"; label: string; amount: number; category?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("transactions").insert({
        user_id: u.user!.id,
        kind: t.kind,
        label: t.label,
        amount: t.amount,
        category: t.category ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });

  const deleteTxn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["transactions"] }),
  });

  const updateProfile = useMutation({
    mutationFn: async (p: Partial<Profile>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").update(p).eq("id", u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });

  const profile = profileQuery.data;
  const txns = txnsQuery.data ?? [];
  const upiTxns = upiQuery.data ?? [];
  const taxRate = profile?.tax_rate ?? 27;
  const baseExpenses = Number(profile?.monthly_base_expenses ?? 2400);

  const income = useMemo(() => txns.filter((t) => t.kind === "income"), [txns]);
  const expenses = useMemo(() => txns.filter((t) => t.kind === "expense"), [txns]);
  const upiIn = useMemo(() => upiTxns.filter((u) => u.direction === "credit").reduce((s, u) => s + Number(u.amount), 0), [upiTxns]);
  const upiOut = useMemo(() => upiTxns.filter((u) => u.direction === "debit").reduce((s, u) => s + Number(u.amount), 0), [upiTxns]);
  const totalIncome = income.reduce((s, i) => s + Number(i.amount), 0) + upiIn;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0) + upiOut;
  const netIncome = totalIncome - totalExpenses;
  const setAside = Math.max(0, netIncome * (taxRate / 100));
  const safeToSpend = netIncome - setAside;
  const runwayMonths = safeToSpend > 0 ? (safeToSpend / baseExpenses).toFixed(1) : "0.0";

  const dueDates = ["2026-09-15", "2027-01-15"];
  const today = new Date();
  const nextDue = dueDates.find((d) => new Date(d) >= today) || dueDates[0];
  const daysUntilDue = Math.ceil((new Date(nextDue).getTime() - today.getTime()) / 86400000);

  const [tab, setTab] = useState<"home" | "ledger" | "expenses" | "profile" | "insights" | "reminders" | "calc" | "upi" | "ai">("home");
  const [sheet, setSheet] = useState<null | "income" | "expense" | "transfer" | "menu" | "add">(null);
  const [newIncome, setNewIncome] = useState({ source: "", amount: "" });
  const [newExpense, setNewExpense] = useState({ label: "", amount: "", category: "Software" });
  const [newTransfer, setNewTransfer] = useState({ label: "", amount: "" });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const recent = useMemo(() => {
    const a = txns.map((t) => ({
      key: t.id,
      kind: t.kind === "income" ? ("in" as const) : ("out" as const),
      label: t.label,
      meta: t.kind === "income" ? fmtDate(t.occurred_at) : (t.category ?? "—"),
      amount: Number(t.amount),
      at: t.occurred_at,
      upi: false,
    }));
    const b = upiTxns.map((u) => ({
      key: `upi-${u.id}`,
      kind: u.direction === "credit" ? ("in" as const) : ("out" as const),
      label: u.counterparty,
      meta: `UPI · ${u.upi_id ?? "—"}`,
      amount: Number(u.amount),
      at: u.occurred_at,
      upi: true,
    }));
    return [...a, ...b].sort((x, y) => (x.at < y.at ? 1 : -1));
  }, [txns, upiTxns]);

  const userName = profile?.display_name ?? "there";


  if (profileQuery.isLoading) {
    return (
      <div className="va-root min-h-screen text-white flex items-center justify-center"
        style={{ background: "radial-gradient(900px 500px at 80% -10%, rgba(168,85,247,0.35), transparent 60%), #07050F" }}>
        <Loader2 className="animate-spin text-fuchsia-300" />
      </div>
    );
  }

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
        .va-display { font-family: 'Bricolage Grotesque', serif; font-weight: 600; letter-spacing: -0.02em; }
        .va-mono { font-family: 'Space Mono', monospace; }
        .va-glass { background: linear-gradient(150deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); border: 1px solid rgba(168,85,247,0.18); backdrop-filter: blur(12px); }
        .va-balance-card {
          background: radial-gradient(120% 120% at 0% 0%, rgba(216,180,254,0.35), transparent 50%), linear-gradient(135deg, #6B21A8 0%, #4C1D95 60%, #2E1065 100%);
          box-shadow: 0 30px 60px -30px rgba(168,85,247,0.55), inset 0 1px 0 rgba(255,255,255,0.18);
        }
        .va-quick { background: linear-gradient(160deg, rgba(168,85,247,0.10), rgba(255,255,255,0.02)); border: 1px solid rgba(168,85,247,0.22); transition: transform .15s ease, background .2s ease, border-color .2s ease; }
        .va-quick:hover { background: linear-gradient(160deg, rgba(168,85,247,0.20), rgba(255,255,255,0.04)); border-color: rgba(216,180,254,0.45); }
        .va-quick:active { transform: scale(0.97); }
        .va-fab { background: radial-gradient(circle at 30% 20%, #D8B4FE, #A855F7 55%, #6B21A8); box-shadow: 0 18px 40px -12px rgba(168,85,247,0.8), inset 0 1px 0 rgba(255,255,255,0.4); }
        .va-dock { background: rgba(15, 8, 30, 0.85); backdrop-filter: blur(16px); border: 1px solid rgba(168,85,247,0.22); }
        .va-chip { background: rgba(168,85,247,0.15); border: 1px solid rgba(216,180,254,0.25); }
        .va-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(168,85,247,0.25); color: #F5F3FF; }
        .va-input::placeholder { color: rgba(216,180,254,0.5); }
        .va-input:focus { outline: none; border-color: #C084FC; box-shadow: 0 0 0 3px rgba(192,132,252,0.18); }
        @keyframes pulseRing { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:1;transform:scale(1.02)} }
        .va-ring { animation: pulseRing 3.5s ease-in-out infinite; }
        @keyframes sheetUp { from{transform:translateY(100%);opacity:0} to{transform:translateY(0);opacity:1} }
        .va-sheet { animation: sheetUp .25s ease-out; }
        .va-divider { height:1px; background: linear-gradient(90deg, transparent, rgba(168,85,247,0.35), transparent); }
      `}</style>

      <div className="max-w-md mx-auto min-h-screen pb-32 relative">
        <div className="flex items-center justify-between px-6 pt-6">
          <button onClick={() => setSheet("menu")} className="w-10 h-10 rounded-full va-glass flex items-center justify-center active:scale-95 transition">
            <Menu size={18} />
          </button>
          <div className="text-[11px] uppercase tracking-[0.25em] text-purple-200/60">Varaigya · v1</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTab("ai")} className="w-10 h-10 rounded-full va-glass flex items-center justify-center relative active:scale-95 transition" aria-label="AI insights">
              <Brain size={17} className="text-fuchsia-200" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </button>
            <button onClick={() => setTab("reminders")} className="w-10 h-10 rounded-full va-glass flex items-center justify-center relative active:scale-95 transition" aria-label="Reminders">
              <Bell size={17} />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
            </button>
          </div>
        </div>

        <div className="px-6 pt-6">
          <p className="text-purple-200/70 text-[13px]">{greeting},</p>
          <h1 className="va-display text-3xl mt-1 truncate">{userName}</h1>
          <p className="va-display text-2xl mt-3 leading-snug">
            You're carrying <span className="text-fuchsia-300">{runwayMonths} months</span><br />of runway.
          </p>
        </div>

        <div className="px-6 mt-6">

          <div className="va-balance-card rounded-3xl p-5 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-fuchsia-400/30 blur-3xl va-ring" />
            <div className="flex items-center justify-between relative gap-3">
              <div className="min-w-0">
                <div className="text-purple-200/80 text-[12px] tracking-wide">Safe to spend</div>
                <div className="va-display text-[34px] mt-1 leading-none">{currency(safeToSpend)}</div>
              </div>
              <div className="va-chip rounded-full px-3 py-1 text-[11px] text-purple-100 shrink-0">{taxRate}% set aside</div>
            </div>
            <div className="va-divider my-4 opacity-60" />
            <div className="flex items-center justify-between text-[12px] relative">
              <div><div className="text-purple-200/60">Earned</div><div className="va-mono text-purple-50 mt-0.5">{currencyShort(totalIncome)}</div></div>
              <div><div className="text-purple-200/60">Spent</div><div className="va-mono text-purple-50 mt-0.5">{currencyShort(totalExpenses)}</div></div>
              <div><div className="text-purple-200/60">Tax jar</div><div className="va-mono text-fuchsia-200 mt-0.5">{currencyShort(setAside)}</div></div>
            </div>
          </div>
        </div>

        <div className="px-6 mt-6">
          <div className="grid grid-cols-4 gap-3">
            {[
              { icon: ArrowDownLeft, label: "Income", onClick: () => setSheet("income") },
              { icon: ArrowUpRight, label: "Expense", onClick: () => setSheet("expense") },
              { icon: Percent, label: "Tax %", onClick: () => setTab("profile") },
              { icon: CalendarClock, label: `${daysUntilDue}d`, onClick: () => setTab("profile") },
            ].map((q) => (
              <button key={q.label} onClick={q.onClick} className="va-quick rounded-2xl py-3 flex flex-col items-center gap-1.5">
                <q.icon size={18} className="text-fuchsia-200" />
                <span className="text-[11px] text-purple-100/80">{q.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 mt-7">
          <div className="flex items-center justify-between mb-3">
            <h2 className="va-display text-[17px]">Transactions</h2>
            {recent.length > 8 && (
              <span className="text-[11px] text-purple-200/50">{recent.length} total</span>
            )}
          </div>

          {upiTxns.length === 0 && (
            <button
              onClick={() => setTab("upi")}
              className="w-full mb-3 rounded-2xl px-4 py-3 flex items-center gap-3 text-left active:scale-[0.99] transition"
              style={{
                background: "linear-gradient(135deg, rgba(168,85,247,0.14), rgba(34,211,238,0.06))",
                border: "1px dashed rgba(216,180,254,0.35)",
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-fuchsia-400/15 text-fuchsia-200 flex items-center justify-center shrink-0">
                <Smartphone size={14} />
              </div>
              <p className="text-[12.5px] leading-snug text-purple-100/85 flex-1">
                Connect your UPI to automatically import your transactions.
              </p>
              <ChevronRight size={14} className="text-purple-300/60" />
            </button>
          )}

          {recent.length === 0 ? (
            <div className="va-glass rounded-2xl p-6 text-center">
              <p className="text-[13px] text-purple-200/70">No transactions yet.</p>
              <button onClick={() => setSheet("add")} className="mt-3 text-[12.5px] text-fuchsia-300">
                Add your first transaction →
              </button>
            </div>
          ) : (
            <div className="va-glass rounded-2xl divide-y divide-purple-500/10">
              {recent.map((r) => (
                <div key={r.key} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${r.kind === "in" ? "bg-emerald-400/15 text-emerald-300" : "bg-fuchsia-400/15 text-fuchsia-300"}`}>
                    {r.kind === "in" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-purple-50 truncate flex items-center gap-1.5">
                      {r.label}
                      {r.upi && <span className="text-[9px] px-1.5 py-0.5 rounded bg-fuchsia-500/20 text-fuchsia-200 tracking-wide">UPI</span>}
                    </div>
                    <div className="text-[11px] text-purple-200/50 truncate">{fmtDate(r.at)} · {r.meta}</div>
                  </div>
                  <div className={`va-mono text-[13px] shrink-0 ${r.kind === "in" ? "text-emerald-300" : "text-fuchsia-200"}`}>
                    {r.kind === "in" ? "+" : "−"}{currency(r.amount)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        <div className="px-6 mt-5">
          <div className="va-glass rounded-2xl p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-200 shrink-0">
              <Sparkles size={15} />
            </div>
            <p className="text-[12.5px] leading-relaxed text-purple-100/80">
              Next quarterly estimate due in <span className="text-fuchsia-300 font-medium">{daysUntilDue} days</span>. Your tax jar already covers <span className="text-white">{currencyShort(setAside)}</span>.
            </p>
          </div>
        </div>

        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 w-[88%] max-w-md">
          <div className="va-dock rounded-full px-3 py-2 flex items-center justify-between">
            <DockBtn icon={Home} active={tab === "home"} onClick={() => setTab("home")} />
            <DockBtn icon={Receipt} active={tab === "ledger"} onClick={() => setTab("ledger")} />
            <button onClick={() => setSheet("add")} className="va-fab w-14 h-14 rounded-full flex items-center justify-center -mt-8 active:scale-95 transition" aria-label="Add">
              <Plus size={24} className="text-white" />
            </button>
            <DockBtn icon={PieChart} active={tab === "expenses"} onClick={() => setTab("expenses")} />
            <DockBtn icon={User} active={tab === "profile"} onClick={() => setTab("profile")} />
          </div>
        </div>

        {tab !== "home" && (
          <SecondarySheet
            title={
              tab === "ledger" ? "Income" :
              tab === "expenses" ? "Expenses" :
              tab === "profile" ? "Profile" :
              tab === "insights" ? "Insights" :
              tab === "reminders" ? "Reminders & alarms" :
              tab === "upi" ? "UPI transactions" :
              tab === "ai" ? "AI insights" :
              "Calculator"
            }
            onClose={() => setTab("home")}
          >
            {tab === "ledger" && (
              <LedgerList
                items={income.map((i) => ({ id: i.id, primary: i.label, secondary: fmtDate(i.occurred_at), amount: Number(i.amount), positive: true }))}
                onDelete={(id) => deleteTxn.mutate(id)}
                emptyText="No income logged yet."
              />
            )}
            {tab === "expenses" && (
              <LedgerList
                items={expenses.map((e) => ({ id: e.id, primary: e.label, secondary: e.category ?? "—", amount: Number(e.amount), positive: false }))}
                onDelete={(id) => deleteTxn.mutate(id)}
                emptyText="No expenses logged yet."
              />
            )}
            {tab === "insights" && (
              <InsightsPanel
                income={totalIncome}
                expenses={totalExpenses}
                setAside={setAside}
                safeToSpend={safeToSpend}
                taxRate={taxRate}
              />
            )}
            {tab === "reminders" && (
              <RemindersPanel nextDue={nextDue} daysUntilDue={daysUntilDue} />
            )}
            {tab === "calc" && <CalculatorPanel />}
            {tab === "upi" && <UpiPanel />}
            {tab === "ai" && <AIInsightsPanel />}
            {tab === "profile" && (
              <ProfilePanel
                taxRate={taxRate}
                onTaxRate={(n) => updateProfile.mutate({ tax_rate: n })}
                baseExpenses={baseExpenses}
                onBaseExpenses={(n) => updateProfile.mutate({ monthly_base_expenses: n })}
                displayName={userName}
                runway={runwayMonths}
                onSignOut={signOut}
              />
            )}
          </SecondarySheet>
        )}

        {sheet === "income" && (
          <BottomSheet title="Log income" onClose={() => setSheet(null)}>
            <input className="va-input w-full rounded-xl px-4 py-3 text-[14px]" placeholder="Source — e.g. Client name" value={newIncome.source} onChange={(e) => setNewIncome({ ...newIncome, source: e.target.value })} />
            <input className="va-input va-mono w-full rounded-xl px-4 py-3 text-[14px]" placeholder="Amount" type="number" inputMode="decimal" value={newIncome.amount} onChange={(e) => setNewIncome({ ...newIncome, amount: e.target.value })} />
            <button
              disabled={addTxn.isPending || !newIncome.source || !newIncome.amount}
              onClick={() => {
                addTxn.mutate(
                  { kind: "income", label: newIncome.source, amount: parseFloat(newIncome.amount) },
                  { onSuccess: () => { setNewIncome({ source: "", amount: "" }); setSheet(null); } },
                );
              }}
              className="va-fab w-full rounded-xl py-3 text-[14px] font-semibold text-white active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {addTxn.isPending ? <Loader2 size={16} className="animate-spin" /> : "Add income"}
            </button>
          </BottomSheet>
        )}

        {sheet === "expense" && (
          <BottomSheet title="Log expense" onClose={() => setSheet(null)}>
            <input className="va-input w-full rounded-xl px-4 py-3 text-[14px]" placeholder="What was it for?" value={newExpense.label} onChange={(e) => setNewExpense({ ...newExpense, label: e.target.value })} />
            <input className="va-input va-mono w-full rounded-xl px-4 py-3 text-[14px]" placeholder="Amount" type="number" inputMode="decimal" value={newExpense.amount} onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} />
            <div className="flex gap-2 flex-wrap">
              {["Software", "Office", "Meals", "Travel", "Equipment", "Other"].map((c) => (
                <button key={c} onClick={() => setNewExpense({ ...newExpense, category: c })} className="px-3 py-1.5 rounded-full text-[12px] transition"
                  style={{
                    background: newExpense.category === c ? "linear-gradient(135deg,#C084FC,#7C3AED)" : "rgba(168,85,247,0.12)",
                    border: "1px solid rgba(216,180,254,0.25)",
                    color: newExpense.category === c ? "#FFF" : "#E9D5FF",
                  }}>{c}</button>
              ))}
            </div>
            <button
              disabled={addTxn.isPending || !newExpense.label || !newExpense.amount}
              onClick={() => {
                addTxn.mutate(
                  { kind: "expense", label: newExpense.label, amount: parseFloat(newExpense.amount), category: newExpense.category },
                  { onSuccess: () => { setNewExpense({ label: "", amount: "", category: "Software" }); setSheet(null); } },
                );
              }}
              className="va-fab w-full rounded-xl py-3 text-[14px] font-semibold text-white active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {addTxn.isPending ? <Loader2 size={16} className="animate-spin" /> : "Add expense"}
            </button>
          </BottomSheet>
        )}

        {sheet === "transfer" && (
          <BottomSheet title="Log transfer" onClose={() => setSheet(null)}>
            <p className="text-[12px] text-purple-200/60 -mt-1">Move money between your own accounts. Doesn't affect income or expenses.</p>
            <input className="va-input w-full rounded-xl px-4 py-3 text-[14px]" placeholder="From → To (e.g. Bank → UPI)" value={newTransfer.label} onChange={(e) => setNewTransfer({ ...newTransfer, label: e.target.value })} />
            <input className="va-input va-mono w-full rounded-xl px-4 py-3 text-[14px]" placeholder="Amount" type="number" inputMode="decimal" value={newTransfer.amount} onChange={(e) => setNewTransfer({ ...newTransfer, amount: e.target.value })} />
            <button
              disabled={addTxn.isPending || !newTransfer.label || !newTransfer.amount}
              onClick={() => {
                addTxn.mutate(
                  { kind: "expense", label: newTransfer.label, amount: parseFloat(newTransfer.amount), category: "Transfer" },
                  { onSuccess: () => { setNewTransfer({ label: "", amount: "" }); setSheet(null); } },
                );
              }}
              className="va-fab w-full rounded-xl py-3 text-[14px] font-semibold text-white active:scale-[0.98] transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {addTxn.isPending ? <Loader2 size={16} className="animate-spin" /> : "Log transfer"}
            </button>
          </BottomSheet>
        )}

        {sheet === "add" && (
          <BottomSheet title="Add transaction" onClose={() => setSheet(null)}>
            {[
              { key: "income" as const, icon: ArrowDownLeft, label: "Add Income", desc: "Client payment, salary, refund", color: "text-emerald-300", bg: "bg-emerald-400/15" },
              { key: "expense" as const, icon: ArrowUpRight, label: "Add Expense", desc: "Software, meals, travel, tools", color: "text-fuchsia-300", bg: "bg-fuchsia-400/15" },
              { key: "transfer" as const, icon: RefreshCw, label: "Add Transfer", desc: "Between your own accounts", color: "text-cyan-300", bg: "bg-cyan-400/15" },
            ].map((o) => (
              <button
                key={o.key}
                onClick={() => setSheet(o.key)}
                className="va-glass rounded-2xl px-4 py-3.5 flex items-center gap-3 w-full text-left active:scale-[0.99] transition"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${o.bg} ${o.color}`}>
                  <o.icon size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-purple-50">{o.label}</div>
                  <div className="text-[11.5px] text-purple-200/60 truncate">{o.desc}</div>
                </div>
                <ChevronRight size={14} className="text-purple-300/60" />
              </button>
            ))}
          </BottomSheet>
        )}


        {sheet === "menu" && (
          <BottomSheet title="Quick menu" onClose={() => setSheet(null)}>
            {[
              { icon: Smartphone, label: "UPI transactions", onClick: () => { setTab("upi"); setSheet(null); } },
              { icon: Brain, label: "AI insights", onClick: () => { setTab("ai"); setSheet(null); } },
              { icon: PieChart, label: "Insights & ring chart", onClick: () => { setTab("insights"); setSheet(null); } },
              { icon: BellRing, label: "Reminders & alarms", onClick: () => { setTab("reminders"); setSheet(null); } },
              { icon: Calculator, label: "Quick calculator", onClick: () => { setTab("calc"); setSheet(null); } },
              { icon: Wallet, label: "View income ledger", onClick: () => { setTab("ledger"); setSheet(null); } },
              { icon: Receipt, label: "View expenses", onClick: () => { setTab("expenses"); setSheet(null); } },
              { icon: Percent, label: "Adjust tax rate", onClick: () => { setTab("profile"); setSheet(null); } },
              { icon: LogOut, label: "Sign out", onClick: signOut },
            ].map((m) => (
              <button key={m.label} onClick={m.onClick} className="va-glass rounded-xl px-4 py-3 flex items-center gap-3 w-full text-left active:scale-[0.99] transition">
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

function DockBtn({ icon: Icon, active, onClick }: { icon: React.ComponentType<{ size?: number; className?: string }>; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-10 h-10 rounded-full flex items-center justify-center transition active:scale-90"
      style={{
        background: active ? "linear-gradient(135deg, rgba(216,180,254,0.25), rgba(168,85,247,0.15))" : "transparent",
        color: active ? "#F5F3FF" : "rgba(216,180,254,0.6)",
      }}>
      <Icon size={18} />
    </button>
  );
}

function BottomSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="va-sheet relative w-full max-w-md rounded-t-3xl p-5 pb-8 va-glass" style={{ background: "linear-gradient(180deg, #15092A 0%, #0B0518 100%)" }}>
        <div className="mx-auto w-10 h-1 rounded-full bg-purple-400/30 mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="va-display text-[18px] text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full va-glass flex items-center justify-center"><X size={14} /></button>
        </div>
        <div className="space-y-3">{children}</div>
      </div>
    </div>
  );
}

function SecondarySheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="va-sheet relative w-full max-w-md rounded-t-3xl p-5 pb-28 max-h-[85vh] overflow-y-auto"
        style={{ background: "linear-gradient(180deg, #15092A 0%, #07050F 100%)", border: "1px solid rgba(168,85,247,0.2)" }}>
        <div className="mx-auto w-10 h-1 rounded-full bg-purple-400/30 mb-4" />
        <div className="flex items-center justify-between mb-5">
          <h3 className="va-display text-[20px] text-white">{title}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full va-glass flex items-center justify-center"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function LedgerList({
  items, onDelete, emptyText,
}: {
  items: { id: string; primary: string; secondary: string; amount: number; positive: boolean }[];
  onDelete: (id: string) => void;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <div className="va-glass rounded-2xl p-6 text-center text-[13px] text-purple-200/70">{emptyText}</div>;
  }
  return (
    <div className="va-glass rounded-2xl divide-y divide-purple-500/10">
      {items.map((it) => (
        <div key={it.id} className="flex items-center gap-3 px-4 py-3.5 group">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${it.positive ? "bg-emerald-400/15 text-emerald-300" : "bg-fuchsia-400/15 text-fuchsia-300"}`}>
            {it.positive ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13.5px] text-purple-50 truncate">{it.primary}</div>
            <div className="text-[11px] text-purple-200/50">{it.secondary}</div>
          </div>
          <div className={`va-mono text-[13px] shrink-0 ${it.positive ? "text-emerald-300" : "text-fuchsia-200"}`}>
            {it.positive ? "+" : "−"}{currency(it.amount)}
          </div>
          <button onClick={() => onDelete(it.id)} className="ml-1 w-7 h-7 rounded-lg flex items-center justify-center text-purple-200/40 hover:text-rose-300 hover:bg-rose-500/10 transition shrink-0" aria-label="Delete">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

function ProfilePanel({
  taxRate, onTaxRate, baseExpenses, onBaseExpenses, displayName, runway, onSignOut,
}: {
  taxRate: number;
  onTaxRate: (n: number) => void;
  baseExpenses: number;
  onBaseExpenses: (n: number) => void;
  displayName: string;
  runway: string;
  onSignOut: () => void;
}) {
  const [localRate, setLocalRate] = useState(taxRate);
  const [localBase, setLocalBase] = useState(String(baseExpenses));
  useEffect(() => setLocalRate(taxRate), [taxRate]);
  useEffect(() => setLocalBase(String(baseExpenses)), [baseExpenses]);

  return (
    <div className="space-y-5">
      <div className="va-balance-card rounded-2xl p-4">
        <div className="text-purple-200/80 text-[12px]">Signed in as</div>
        <div className="va-display text-xl mt-0.5 truncate">{displayName}</div>
        <div className="va-divider my-3 opacity-60" />
        <div className="text-purple-200/80 text-[12px]">Current runway</div>
        <div className="va-display text-3xl mt-0.5">{runway} months</div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-purple-200/60 mb-2">Tax set-aside rate</div>
        <div className="va-glass rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] text-purple-100">Blended rate</span>
            <span className="va-mono text-fuchsia-200 text-[15px]">{localRate}%</span>
          </div>
          <input
            type="range" min={10} max={40} value={localRate}
            onChange={(e) => setLocalRate(parseInt(e.target.value))}
            onMouseUp={() => onTaxRate(localRate)}
            onTouchEnd={() => onTaxRate(localRate)}
            className="w-full" style={{ accentColor: "#C084FC" }}
          />
          <div className="flex justify-between text-[10px] text-purple-200/50 mt-1"><span>10%</span><span>40%</span></div>
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-purple-200/60 mb-2">Monthly base expenses</div>
        <div className="va-glass rounded-2xl p-4 flex items-center gap-3">
          <span className="text-purple-200/60 va-mono text-[14px]">$</span>
          <input
            type="number" inputMode="decimal" value={localBase}
            onChange={(e) => setLocalBase(e.target.value)}
            onBlur={() => onBaseExpenses(Number(localBase) || 0)}
            className="va-input rounded-lg px-3 py-2 flex-1 va-mono text-[14px]"
          />
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-purple-200/60 mb-2">Reminders</div>
        <div className="va-glass rounded-2xl p-4 flex items-center gap-3">
          <CalendarClock size={16} className="text-fuchsia-300" />
          <span className="text-[13px] text-purple-100">Quarterly estimate — Sep 15, 2026</span>
        </div>
      </div>

      <button
        onClick={onSignOut}
        className="w-full va-glass rounded-2xl py-3.5 text-[13.5px] text-rose-300 flex items-center justify-center gap-2 active:scale-[0.99] transition"
      >
        <LogOut size={15} /> Sign out
      </button>
    </div>
  );
}

function InsightsPanel({
  income, expenses, setAside, safeToSpend, taxRate,
}: {
  income: number; expenses: number; setAside: number; safeToSpend: number; taxRate: number;
}) {
  const total = Math.max(1, expenses + setAside + Math.max(0, safeToSpend));
  const segs = [
    { label: "Expenses", value: expenses, color: "#F0ABFC" },
    { label: "Tax jar", value: setAside, color: "#C084FC" },
    { label: "Safe to spend", value: Math.max(0, safeToSpend), color: "#22D3EE" },
  ];
  const R = 70;
  const C = 2 * Math.PI * R;
  let offset = 0;
  const savingsRate = income > 0 ? Math.round((Math.max(0, safeToSpend) / income) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="va-glass rounded-3xl p-5 flex flex-col items-center">
        <div className="text-[11px] uppercase tracking-[0.2em] text-purple-200/60 mb-3">Where your money goes</div>
        <div className="relative w-[200px] h-[200px]">
          <svg viewBox="0 0 180 180" className="w-full h-full -rotate-90">
            <circle cx="90" cy="90" r={R} fill="none" stroke="rgba(168,85,247,0.12)" strokeWidth="18" />
            {segs.map((s) => {
              const len = (s.value / total) * C;
              const dash = `${len} ${C - len}`;
              const el = (
                <circle
                  key={s.label}
                  cx="90" cy="90" r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="18"
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="round"
                />
              );
              offset += len;
              return el;
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[11px] text-purple-200/60">Savings rate</div>
            <div className="va-display text-3xl text-white mt-1">{savingsRate}%</div>
            <div className="text-[10px] text-purple-200/50 mt-0.5">of income</div>
          </div>
        </div>
        <div className="mt-5 w-full space-y-2">
          {segs.map((s) => {
            const pct = Math.round((s.value / total) * 100);
            return (
              <div key={s.label} className="flex items-center gap-3 text-[12.5px]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="text-purple-100/80 flex-1">{s.label}</span>
                <span className="va-mono text-purple-50">${Math.round(s.value).toLocaleString()}</span>
                <span className="va-mono text-purple-200/50 w-9 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="va-glass rounded-2xl p-4">
          <div className="text-[11px] text-purple-200/60">Total earned</div>
          <div className="va-display text-xl text-white mt-1">${Math.round(income).toLocaleString()}</div>
        </div>
        <div className="va-glass rounded-2xl p-4">
          <div className="text-[11px] text-purple-200/60">Effective tax</div>
          <div className="va-display text-xl text-fuchsia-200 mt-1">{taxRate}%</div>
        </div>
      </div>
    </div>
  );
}

type Alarm = { id: string; label: string; time: string; enabled: boolean };
const ALARM_KEY = "va_alarms_v1";

function RemindersPanel({ nextDue, daysUntilDue }: { nextDue: string; daysUntilDue: number }) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [label, setLabel] = useState("");
  const [time, setTime] = useState("09:00");
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ALARM_KEY);
      if (raw) setAlarms(JSON.parse(raw));
    } catch { /* ignore */ }
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    try { localStorage.setItem(ALARM_KEY, JSON.stringify(alarms)); } catch { /* ignore */ }
  }, [alarms]);

  // Alarm ticker
  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      alarms.forEach((a) => {
        if (a.enabled && a.time === hhmm && now.getSeconds() < 30) {
          const key = `va_fired_${a.id}_${now.toDateString()}_${hhmm}`;
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, "1");
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              new Notification("Varaigya reminder", { body: a.label });
            }
            try {
              const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
                ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
              if (AC) {
                const ctx = new AC();
                const o = ctx.createOscillator();
                const g = ctx.createGain();
                o.frequency.value = 880; o.type = "sine";
                g.gain.value = 0.15;
                o.connect(g); g.connect(ctx.destination);
                o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 600);
              }
            } catch { /* ignore */ }
          }
        }
      });
    }, 15000);
    return () => clearInterval(id);
  }, [alarms]);

  async function requestPerm() {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermission(p);
  }

  function add() {
    if (!label.trim()) return;
    setAlarms((a) => [...a, { id: crypto.randomUUID(), label: label.trim(), time, enabled: true }]);
    setLabel("");
  }

  return (
    <div className="space-y-5">
      <div className="va-balance-card rounded-2xl p-4">
        <div className="flex items-center gap-2 text-purple-200/80 text-[12px]">
          <CalendarClock size={14} /> Upcoming tax reminder
        </div>
        <div className="va-display text-2xl mt-1 text-white">In {daysUntilDue} days</div>
        <div className="text-[12px] text-purple-200/70 mt-0.5">{nextDue}</div>
      </div>

      {permission !== "granted" && typeof Notification !== "undefined" && (
        <button onClick={requestPerm} className="va-glass w-full rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition">
          <BellRing size={16} className="text-fuchsia-300" />
          <div className="flex-1">
            <div className="text-[13px] text-purple-50">Enable notifications</div>
            <div className="text-[11px] text-purple-200/60">So your alarms actually ring</div>
          </div>
          <ChevronRight size={14} className="text-purple-300/60" />
        </button>
      )}

      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-purple-200/60 mb-2">New alarm</div>
        <div className="va-glass rounded-2xl p-4 space-y-3">
          <input
            value={label} onChange={(e) => setLabel(e.target.value)}
            placeholder="Label — e.g. Log today's income"
            className="va-input w-full rounded-xl px-4 py-2.5 text-[13.5px]"
          />
          <div className="flex items-center gap-3">
            <input
              type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="va-input va-mono rounded-xl px-3 py-2 text-[14px] flex-1"
            />
            <button
              onClick={add}
              disabled={!label.trim()}
              className="va-fab rounded-xl px-4 py-2 text-[13px] font-semibold text-white active:scale-[0.98] transition disabled:opacity-50"
            >
              Set alarm
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-purple-200/60 mb-2">Your alarms</div>
        {alarms.length === 0 ? (
          <div className="va-glass rounded-2xl p-6 text-center text-[13px] text-purple-200/70">No alarms set.</div>
        ) : (
          <div className="va-glass rounded-2xl divide-y divide-purple-500/10">
            {alarms.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${a.enabled ? "bg-fuchsia-400/15 text-fuchsia-200" : "bg-white/5 text-purple-200/40"}`}>
                  <BellRing size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] text-purple-50 truncate">{a.label}</div>
                  <div className="va-mono text-[11px] text-purple-200/60">{a.time}</div>
                </div>
                <button
                  onClick={() => setAlarms((list) => list.map((x) => x.id === a.id ? { ...x, enabled: !x.enabled } : x))}
                  className="text-[11px] px-2.5 py-1 rounded-full va-chip text-purple-100"
                >
                  {a.enabled ? "On" : "Off"}
                </button>
                <button
                  onClick={() => setAlarms((list) => list.filter((x) => x.id !== a.id))}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-purple-200/40 hover:text-rose-300 hover:bg-rose-500/10 transition"
                  aria-label="Delete alarm"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CalculatorPanel() {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState<string>("0");

  const evaluate = (s: string): string => {
    if (!s) return "0";
    // Only allow digits, operators, parens, decimals, spaces
    if (!/^[\d+\-*/().%\s]+$/.test(s)) return "—";
    try {
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict"; return (${s});`)();
      if (typeof v !== "number" || !isFinite(v)) return "—";
      return String(Math.round(v * 1e8) / 1e8);
    } catch {
      return "—";
    }
  };

  const push = (t: string) => {
    const next = expr + t;
    setExpr(next);
    setResult(evaluate(next));
  };
  const clear = () => { setExpr(""); setResult("0"); };
  const back = () => {
    const next = expr.slice(0, -1);
    setExpr(next);
    setResult(evaluate(next));
  };
  const equals = () => {
    const r = evaluate(expr);
    if (r !== "—") { setExpr(r); setResult(r); }
  };

  const keys: { label: string; onClick: () => void; kind?: "op" | "eq" | "fn" }[] = [
    { label: "C", onClick: clear, kind: "fn" },
    { label: "( )", onClick: () => push(expr.split("(").length > expr.split(")").length ? ")" : "("), kind: "fn" },
    { label: "%", onClick: () => push("%"), kind: "op" },
    { label: "÷", onClick: () => push("/"), kind: "op" },
    { label: "7", onClick: () => push("7") },
    { label: "8", onClick: () => push("8") },
    { label: "9", onClick: () => push("9") },
    { label: "×", onClick: () => push("*"), kind: "op" },
    { label: "4", onClick: () => push("4") },
    { label: "5", onClick: () => push("5") },
    { label: "6", onClick: () => push("6") },
    { label: "−", onClick: () => push("-"), kind: "op" },
    { label: "1", onClick: () => push("1") },
    { label: "2", onClick: () => push("2") },
    { label: "3", onClick: () => push("3") },
    { label: "+", onClick: () => push("+"), kind: "op" },
    { label: "0", onClick: () => push("0") },
    { label: ".", onClick: () => push(".") },
    { label: "⌫", onClick: back, kind: "fn" },
    { label: "=", onClick: equals, kind: "eq" },
  ];

  return (
    <div className="space-y-4">
      <div className="va-balance-card rounded-2xl p-5 min-h-[130px] flex flex-col justify-end">
        <div className="va-mono text-right text-purple-100/70 text-[14px] break-all min-h-[20px]">
          {expr || " "}
        </div>
        <div className="va-display text-right text-white text-4xl mt-2 break-all">
          {result}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {keys.map((k) => {
          const base = "rounded-2xl h-14 text-[17px] active:scale-95 transition flex items-center justify-center";
          const style =
            k.kind === "eq" ? "va-fab text-white font-semibold" :
            k.kind === "op" ? "va-quick text-fuchsia-200 font-semibold" :
            k.kind === "fn" ? "va-glass text-purple-100" :
            "va-glass text-white va-mono";
          return (
            <button key={k.label} onClick={k.onClick} className={`${base} ${style}`}>
              {k.label === "⌫" ? <Delete size={18} /> : k.label}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-purple-200/50 text-center">
        Tip: use it to preview an expense before logging it.
      </p>
    </div>
  );
}

type UpiCategory = "client_payment" | "personal" | "business_expense" | "refund" | "other";
type UpiTxn = {
  id: string;
  amount: number;
  direction: "credit" | "debit";
  counterparty: string;
  upi_id: string | null;
  note: string | null;
  category: UpiCategory;
  occurred_at: string;
};

const UPI_CATEGORIES: { value: UpiCategory; label: string }[] = [
  { value: "client_payment", label: "Client Payment" },
  { value: "personal", label: "Personal" },
  { value: "business_expense", label: "Business Expense" },
  { value: "refund", label: "Refund" },
  { value: "other", label: "Other" },
];

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ============================================================================
// SMS / notification → transaction parsing lives in src/lib/txn-parser.ts and
// database ingestion (with duplicate prevention) in src/lib/ingest.ts.
// ============================================================================


function UpiPanel() {
  const qc = useQueryClient();
  
  const [form, setForm] = useState<{ amount: string; direction: "credit" | "debit"; counterparty: string; upi_id: string; category: UpiCategory; note: string }>({
    amount: "", direction: "debit", counterparty: "", upi_id: "", category: "other", note: "",
  });

  const list = useQuery({
    queryKey: ["upi_transactions"],
    queryFn: async (): Promise<UpiTxn[]> => {
      const { data, error } = await supabase
        .from("upi_transactions" as never)
        .select("*")
        .order("occurred_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UpiTxn[];
    },
  });

  const add = useMutation({
    mutationFn: async (row: Omit<UpiTxn, "id" | "occurred_at"> & { occurred_at?: string }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("upi_transactions" as never).insert({
        user_id: u.user!.id,
        ...row,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["upi_transactions"] }),
  });

  const updateCat = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: UpiCategory }) => {
      const { error } = await supabase.from("upi_transactions" as never).update({ category } as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["upi_transactions"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("upi_transactions" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["upi_transactions"] }),
  });


  function addManual() {
    const amt = parseFloat(form.amount);
    if (!isFinite(amt) || !form.counterparty.trim()) return;
    add.mutate(
      {
        amount: amt,
        direction: form.direction,
        counterparty: form.counterparty.trim(),
        upi_id: form.upi_id.trim() || null,
        note: form.note.trim() || null,
        category: form.category,
      },
      {
        onSuccess: () => setForm({ amount: "", direction: "debit", counterparty: "", upi_id: "", category: "other", note: "" }),
      },
    );
  }

  const items = list.data ?? [];
  const totals = items.reduce(
    (acc, t) => {
      if (t.direction === "credit") acc.in += Number(t.amount);
      else acc.out += Number(t.amount);
      return acc;
    },
    { in: 0, out: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="va-glass rounded-2xl p-3.5 flex items-start gap-2.5 border border-emerald-400/25">
        <div className="w-7 h-7 rounded-lg bg-emerald-400/15 text-emerald-300 flex items-center justify-center shrink-0">
          <Sparkles size={13} />
        </div>
        <div className="text-[11.5px] leading-relaxed text-purple-100/80">
          <span className="text-emerald-200 font-medium">Safe by design.</span> Varaigya never asks for your UPI PIN, bank login, or OTP. Entries stay in your private account — only you can see them.
        </div>
      </div>
      <div className="va-balance-card rounded-2xl p-4">
        <div className="flex items-center gap-2 text-purple-200/80 text-[12px]"><Smartphone size={14} /> UPI activity</div>
        <div className="flex items-end gap-6 mt-2">
          <div>
            <div className="text-[11px] text-purple-200/60">Received</div>
            <div className="va-display text-xl text-emerald-200">₹{Math.round(totals.in).toLocaleString("en-IN")}</div>
          </div>
          <div>
            <div className="text-[11px] text-purple-200/60">Sent</div>
            <div className="va-display text-xl text-fuchsia-200">₹{Math.round(totals.out).toLocaleString("en-IN")}</div>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-purple-200/60 mb-2">Automatic import</div>
        <AutoImportCard existing={items} onImported={() => qc.invalidateQueries({ queryKey: ["upi_transactions"] })} />
      </div>




      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-purple-200/60 mb-2">Add manually</div>
        <div className="va-glass rounded-2xl p-4 space-y-3">
          <div className="flex gap-2">
            {(["debit", "credit"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setForm({ ...form, direction: d })}
                className="flex-1 rounded-xl py-2 text-[12.5px]"
                style={{
                  background: form.direction === d ? "linear-gradient(135deg,#C084FC,#7C3AED)" : "rgba(168,85,247,0.10)",
                  border: "1px solid rgba(216,180,254,0.25)",
                  color: form.direction === d ? "#fff" : "#E9D5FF",
                }}
              >
                {d === "credit" ? "Money in" : "Money out"}
              </button>
            ))}
          </div>
          <input className="va-input va-mono w-full rounded-xl px-4 py-2.5 text-[14px]" placeholder="Amount ₹" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <input className="va-input w-full rounded-xl px-4 py-2.5 text-[13.5px]" placeholder="Sender / Receiver" value={form.counterparty} onChange={(e) => setForm({ ...form, counterparty: e.target.value })} />
          <input className="va-input va-mono w-full rounded-xl px-4 py-2.5 text-[13px]" placeholder="UPI ID (name@bank)" value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            {UPI_CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setForm({ ...form, category: c.value })}
                className="px-3 py-1.5 rounded-full text-[11.5px]"
                style={{
                  background: form.category === c.value ? "linear-gradient(135deg,#C084FC,#7C3AED)" : "rgba(168,85,247,0.10)",
                  border: "1px solid rgba(216,180,254,0.25)",
                  color: form.category === c.value ? "#fff" : "#E9D5FF",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
          <button
            onClick={addManual}
            disabled={add.isPending || !form.amount || !form.counterparty}
            className="va-fab w-full rounded-xl py-2.5 text-[13px] font-semibold text-white active:scale-[0.98] transition disabled:opacity-50"
          >
            {add.isPending ? <Loader2 size={14} className="inline animate-spin" /> : "Save UPI transaction"}
          </button>
        </div>
      </div>

      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-purple-200/60 mb-2">History</div>
        {list.isLoading ? (
          <div className="va-glass rounded-2xl p-6 text-center"><Loader2 size={16} className="animate-spin inline text-fuchsia-300" /></div>
        ) : items.length === 0 ? (
          <div className="va-glass rounded-2xl p-6 text-center text-[13px] text-purple-200/70">No UPI transactions yet.</div>
        ) : (
          <div className="va-glass rounded-2xl divide-y divide-purple-500/10">
            {items.map((t) => (
              <div key={t.id} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${t.direction === "credit" ? "bg-emerald-400/15 text-emerald-300" : "bg-fuchsia-400/15 text-fuchsia-300"}`}>
                    {t.direction === "credit" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13.5px] text-purple-50 truncate">{t.counterparty}</div>
                    <div className="text-[11px] text-purple-200/50 truncate">
                      {t.upi_id ?? "—"} · {fmtDateTime(t.occurred_at)}
                    </div>
                  </div>
                  <div className={`va-mono text-[13px] shrink-0 ${t.direction === "credit" ? "text-emerald-300" : "text-fuchsia-200"}`}>
                    {t.direction === "credit" ? "+" : "−"}₹{Number(t.amount).toLocaleString("en-IN")}
                  </div>
                  <button onClick={() => del.mutate(t.id)} className="ml-1 w-7 h-7 rounded-lg flex items-center justify-center text-purple-200/40 hover:text-rose-300 hover:bg-rose-500/10 transition" aria-label="Delete">
                    <X size={13} />
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
                  {UPI_CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => updateCat.mutate({ id: t.id, category: c.value })}
                      className="px-2.5 py-1 rounded-full text-[10.5px] transition"
                      style={{
                        background: t.category === c.value ? "linear-gradient(135deg,#C084FC,#7C3AED)" : "rgba(168,85,247,0.08)",
                        border: "1px solid rgba(216,180,254,0.18)",
                        color: t.category === c.value ? "#fff" : "#DDD6FE",
                      }}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AIInsightsPanel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<{ title: string; body: string; tone: "positive" | "neutral" | "warning" }[]>([]);
  const [lastRun, setLastRun] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchInsights();
      setInsights(list);
      setLastRun(new Date().toLocaleTimeString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate insights");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="space-y-5">
      <div className="va-balance-card rounded-2xl p-4 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <Brain size={18} className="text-fuchsia-100" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="va-display text-lg text-white">Your money, analyzed</div>
          <div className="text-[12px] text-purple-100/70 mt-0.5">
            AI reviews your ledger + UPI activity and surfaces patterns.
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="w-9 h-9 rounded-xl va-glass flex items-center justify-center shrink-0 disabled:opacity-50"
          aria-label="Refresh insights"
        >
          {loading ? <Loader2 size={15} className="animate-spin text-fuchsia-200" /> : <RefreshCw size={15} className="text-fuchsia-200" />}
        </button>
      </div>

      {error && (
        <div className="va-glass rounded-2xl p-4 flex items-start gap-3 border border-rose-400/30">
          <AlertTriangle size={16} className="text-rose-300 shrink-0 mt-0.5" />
          <div className="text-[12.5px] text-rose-100/90 break-words">{error}</div>
        </div>
      )}

      {loading && insights.length === 0 ? (
        <div className="va-glass rounded-2xl p-8 text-center">
          <Loader2 size={20} className="animate-spin inline text-fuchsia-300" />
          <div className="text-[12.5px] text-purple-200/70 mt-3">Reading your patterns…</div>
        </div>
      ) : insights.length === 0 && !error ? (
        <div className="va-glass rounded-2xl p-6 text-center text-[13px] text-purple-200/70">
          Add a few transactions, then hit refresh.
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((ins, i) => {
            const toneStyle =
              ins.tone === "positive" ? { color: "#6EE7B7", bg: "bg-emerald-400/15", Icon: TrendingUp } :
              ins.tone === "warning" ? { color: "#FCA5A5", bg: "bg-rose-400/15", Icon: AlertTriangle } :
              { color: "#F0ABFC", bg: "bg-fuchsia-400/15", Icon: Sparkles };
            const Icon = toneStyle.Icon;
            return (
              <div key={i} className="va-glass rounded-2xl p-4 flex gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${toneStyle.bg}`}>
                  <Icon size={16} style={{ color: toneStyle.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] text-white font-medium">{ins.title}</div>
                  <div className="text-[12.5px] text-purple-100/75 mt-1 leading-relaxed">{ins.body}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lastRun && (
        <div className="text-[11px] text-purple-200/40 text-center">Last updated {lastRun}</div>
      )}
    </div>
  );
}

function HomeAIInsights({ onOpen }: { onOpen: () => void }) {
  const [loading, setLoading] = useState(true);
  const [top, setTop] = useState<{ title: string; body: string; tone: "positive" | "neutral" | "warning" } | null>(null);
  const [count, setCount] = useState(0);

  async function refresh() {
    setLoading(true);
    try {
      const list = await fetchInsights();
      setTop(list[0] ?? null);
      setCount(list.length);
    } catch {
      setTop(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const toneColor =
    top?.tone === "positive" ? "#6EE7B7" :
    top?.tone === "warning" ? "#FCA5A5" :
    "#F0ABFC";

  return (
    <button
      onClick={onOpen}
      className="w-full text-left rounded-2xl p-4 relative overflow-hidden active:scale-[0.99] transition"
      style={{
        background: "linear-gradient(135deg, rgba(168,85,247,0.22), rgba(34,211,238,0.10))",
        border: "1px solid rgba(216,180,254,0.28)",
        boxShadow: "0 20px 40px -24px rgba(168,85,247,0.6)",
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
          <Brain size={14} className="text-fuchsia-100" />
        </div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-purple-100/80">AI insights</div>
        <div className="ml-auto flex items-center gap-1 text-[11px] text-purple-100/70">
          {loading ? <Loader2 size={12} className="animate-spin" /> : count > 1 ? `+${count - 1} more` : "Tap to open"}
          <ChevronRight size={12} />
        </div>
      </div>
      {loading && !top ? (
        <div className="text-[13px] text-purple-100/70">Reading your patterns…</div>
      ) : top ? (
        <>
          <div className="text-[13.5px] text-white font-medium leading-snug">{top.title}</div>
          <div className="text-[12px] text-purple-100/75 mt-1 leading-relaxed line-clamp-2" style={{ color: toneColor + "cc" }}>
            {top.body}
          </div>
        </>
      ) : (
        <div className="text-[13px] text-purple-100/70">Add a few transactions to unlock insights.</div>
      )}
    </button>
  );
}

function isNativeAndroid(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } };
  return !!w.Capacitor?.isNativePlatform?.() && w.Capacitor?.getPlatform?.() === "android";
}

// Attach a background listener on native so new SMS ingest automatically.
async function attachNativeSmsListener(onImport: (count: number) => void) {
  if (typeof window === "undefined") return () => {};
  const w = window as unknown as { Capacitor?: { Plugins?: Record<string, unknown> } };
  const plugin = (w.Capacitor?.Plugins?.SmsInbox ?? w.Capacitor?.Plugins?.SMSInboxReader) as
    | { addListener?: (event: string, cb: (msg: { address?: string; body?: string; date?: number }) => void) => Promise<{ remove: () => Promise<void> }> }
    | undefined;
  if (!plugin?.addListener) {
    ilog("sms", "live listener unavailable (plugin missing)");
    return () => {};
  }
  const sub = await plugin.addListener("smsReceived", async (msg) => {
    ilog("sms", `live SMS received from ${msg.address ?? "unknown"}`);
    const { parsed, failed } = parseMessages(
      [{ address: msg.address, body: msg.body, date: msg.date ?? Date.now() }],
      "sms",
    );
    if (failed) ilog("parse", `live SMS parse failures: ${failed}`);
    if (!parsed.length) return;
    try {
      const { inserted } = await ingestTransactions(parsed);
      if (inserted > 0) onImport(inserted);
    } catch (e) {
      ilog("db", `live SMS write failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
  ilog("sms", "live SMS listener attached");
  return () => { void sub.remove(); };
}

// Attach Android notification-access listener (PhonePe / GPay / Paytm / BHIM / bank apps).
async function attachNotificationListener(onImport: (count: number) => void) {
  return subscribeNotifications(async (n) => {
    const text = [n.title ?? "", n.text ?? ""].filter(Boolean).join(" — ");
    ilog("notification", `notification from ${n.package ?? "unknown"}`, text.slice(0, 120));
    const parsed = parseTransactionText(text, {
      source: "notification",
      sender: n.package ?? "",
      timestamp: n.time ?? Date.now(),
    });
    if (!parsed) {
      ilog("parse", "notification did not look like a transaction");
      return;
    }
    try {
      const { inserted, skipped } = await ingestTransactions([parsed]);
      ilog("notification", `imported ${inserted}, duplicates skipped ${skipped}`);
      if (inserted > 0) onImport(inserted);
    } catch (e) {
      ilog("db", `notification write failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
}

function AutoImportCard({ existing, onImported }: { existing: UpiTxn[]; onImported: () => void }) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [notifGranted, setNotifGranted] = useState(false);
  const native = isNativeAndroid();

  // Existing-row count is only used for status copy — the database's unique
  // (user_id, dedupe_key) index is what actually prevents duplicates.
  const existingCount = existing.length;

  // Live SMS listener.
  useEffect(() => {
    if (!enabled || !native) return;
    let cleanup: (() => void) | undefined;
    void attachNativeSmsListener((n) => {
      setStatus(`Auto-imported ${n} new transaction${n === 1 ? "" : "s"} from a fresh SMS.`);
      onImported();
    }).then((fn) => { cleanup = fn; });
    return () => { cleanup?.(); };
  }, [enabled, native, onImported]);

  // Notification-access listener + permission state.
  useEffect(() => {
    if (!native) return;
    let cleanup: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const granted = await hasNotificationAccess();
      if (cancelled) return;
      setNotifGranted(granted);
      ilog("perm", `notification access ${granted ? "granted" : "not granted"}`);
      if (!granted) return;
      cleanup = await attachNotificationListener((n) => {
        setStatus(`Auto-imported ${n} transaction${n === 1 ? "" : "s"} from a payment notification.`);
        onImported();
      });
    })();
    const onFocus = () => { void hasNotificationAccess().then(setNotifGranted); };
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      cleanup?.();
      window.removeEventListener("focus", onFocus);
    };
  }, [native, onImported]);

  // First-launch auto-request on Android: kick off the permission dialog +
  // full inbox scan the first time the user opens the app. If they deny,
  // the button below still lets them retry manually.
  useEffect(() => {
    if (!native) return;
    if (typeof window === "undefined") return;
    const KEY = "vairagya.autoImportBootstrapped";
    if (window.localStorage.getItem(KEY)) return;
    window.localStorage.setItem(KEY, "1");
    ilog("sms", "first launch — bootstrapping automatic import");
    void handleEnable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native]);

  async function handleEnable() {
    setBusy(true);
    setStatus("Requesting SMS permission…");
    try {
      const granted = await requestSmsPermission();
      ilog("perm", `SMS permission ${granted ? "granted" : "denied"}`);
      if (!granted) {
        setStatus("SMS permission denied. Grant it to import transactions automatically.");
        setEnabled(false);
        return;
      }

      setStatus("Scanning your entire inbox…");
      const messages = await readAllSms();
      ilog("sms", `scanned ${messages.length} SMS from inbox`);

      const { parsed, failed } = parseMessages(messages, "sms");
      ilog("parse", `detected ${parsed.length} transaction(s), ${failed} parse failure(s)`);

      const { inserted, skipped } = await ingestTransactions(parsed);
      ilog("db", `saved ${inserted} new transaction(s), skipped ${skipped} duplicate(s)`);

      setEnabled(true);
      setStatus(
        inserted > 0
          ? `Imported ${inserted} transaction${inserted === 1 ? "" : "s"} from ${messages.length} messages. New SMS now sync automatically.`
          : `Your inbox is up to date (${existingCount} transactions tracked). New SMS sync automatically.`,
      );
      onImported();
    } catch (e) {
      ilog("sms", `import failed: ${e instanceof Error ? e.message : String(e)}`);
      setStatus(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleNotificationAccess() {
    ilog("perm", "opening notification access settings");
    await requestNotificationAccess();
    setStatus("Enable “Vairagya transaction import” in the list, then come back.");
  }

  // ── Web fallback: no paste UI. Honest explanation + install instructions. ──
  if (!native) {
    return (
      <div className="va-glass rounded-2xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/15 text-amber-300 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div className="space-y-1">
            <div className="text-[13.5px] font-semibold text-purple-50">Requires the Android app</div>
            <div className="text-[11.5px] text-purple-200/70 leading-relaxed">
              Web browsers cannot read SMS — Android reserves that permission for installed apps only. To enable
              tap-once automatic import, install Varaigya as an Android app. Everything else keeps working here.
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-purple-400/20 bg-purple-400/5 p-3.5 space-y-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-purple-200/70">How auto-import works on Android</div>
          <ol className="space-y-1.5 text-[12px] text-purple-100/80 list-decimal list-inside">
            <li>Install the Varaigya Android build (Capacitor wrapper).</li>
            <li>Tap <span className="text-purple-100 font-medium">Enable Automatic Import</span> once.</li>
            <li>Android shows the SMS permission dialog — grant it.</li>
            <li>Your full bank / UPI SMS history scans and imports in seconds.</li>
            <li>Every new transaction SMS and payment notification syncs in the background.</li>
          </ol>
        </div>

        <button
          disabled
          className="va-input w-full rounded-xl py-3 text-[13px] font-semibold text-purple-200/60 flex items-center justify-center gap-2 opacity-60 cursor-not-allowed"
        >
          <Smartphone size={15} /> Enable Automatic Import (Android only)
        </button>
        <p className="text-[10.5px] text-purple-200/50 leading-relaxed">
          Only SMS bodies from bank/UPI senders are parsed for amount, party, and time. OTPs, PINs, and login codes are ignored and never leave the device unencrypted.
        </p>
      </div>
    );
  }

  // ── Native Android path: real auto-import ──
  return (
    <div className="va-glass rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${enabled ? "bg-emerald-400/15 text-emerald-300" : "bg-purple-400/15 text-purple-200"}`}>
          <Smartphone size={18} />
        </div>
        <div className="space-y-1">
          <div className="text-[13.5px] font-semibold text-purple-50">
            {enabled ? "Auto-import is on" : "Automatic SMS import"}
          </div>
          <div className="text-[11.5px] text-purple-200/70 leading-relaxed">
            {enabled
              ? "New bank and UPI SMS are silently parsed and added to your timeline. No paste, no manual work."
              : "Grant SMS permission once. Varaigya scans your existing bank/UPI SMS and keeps syncing new ones automatically."}
          </div>
        </div>
      </div>

      <button
        onClick={handleEnable}
        disabled={busy || enabled}
        className="va-fab w-full rounded-xl py-3 text-[13px] font-semibold text-white active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-70"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : enabled ? <Sparkles size={15} /> : <Smartphone size={15} />}
        {busy ? "Scanning inbox…" : enabled ? "Enabled — background sync active" : "Enable Automatic Import"}
      </button>

      <button
        onClick={handleNotificationAccess}
        disabled={notifGranted}
        className="va-input w-full rounded-xl py-3 text-[13px] font-semibold text-purple-100 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {notifGranted ? <Sparkles size={15} className="text-emerald-300" /> : <BellRing size={15} />}
        {notifGranted ? "Payment notifications connected" : "Also import payment app notifications"}
      </button>

      {status && <p className="text-[11px] text-purple-200/70 leading-relaxed">{status}</p>}

      <p className="text-[10.5px] text-purple-200/50 leading-relaxed">
        Varaigya reads only bank/UPI SMS and payment notifications to extract amount, party, reference and time. OTPs, PINs, and login codes are ignored. Duplicates are detected automatically.
      </p>
    </div>
  );
}


