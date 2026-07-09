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
import { useServerFn } from "@tanstack/react-start";
import { generateInsights } from "@/lib/insights.functions";

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
  const taxRate = profile?.tax_rate ?? 27;
  const baseExpenses = Number(profile?.monthly_base_expenses ?? 2400);

  const income = useMemo(() => txns.filter((t) => t.kind === "income"), [txns]);
  const expenses = useMemo(() => txns.filter((t) => t.kind === "expense"), [txns]);
  const totalIncome = income.reduce((s, i) => s + Number(i.amount), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const netIncome = totalIncome - totalExpenses;
  const setAside = Math.max(0, netIncome * (taxRate / 100));
  const safeToSpend = netIncome - setAside;
  const runwayMonths = safeToSpend > 0 ? (safeToSpend / baseExpenses).toFixed(1) : "0.0";

  const dueDates = ["2026-09-15", "2027-01-15"];
  const today = new Date();
  const nextDue = dueDates.find((d) => new Date(d) >= today) || dueDates[0];
  const daysUntilDue = Math.ceil((new Date(nextDue).getTime() - today.getTime()) / 86400000);

  const [tab, setTab] = useState<"home" | "ledger" | "expenses" | "profile" | "insights" | "reminders" | "calc" | "upi" | "ai">("home");
  const [sheet, setSheet] = useState<null | "income" | "expense" | "menu">(null);
  const [newIncome, setNewIncome] = useState({ source: "", amount: "" });
  const [newExpense, setNewExpense] = useState({ label: "", amount: "", category: "Software" });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const recent = txns.slice(0, 6).map((t) => ({
    key: t.id,
    kind: t.kind === "income" ? ("in" as const) : ("out" as const),
    label: t.label,
    meta: t.kind === "income" ? fmtDate(t.occurred_at) : (t.category ?? "—"),
    amount: Number(t.amount),
  }));

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
          <button onClick={() => setTab("reminders")} className="w-10 h-10 rounded-full va-glass flex items-center justify-center relative active:scale-95 transition" aria-label="Reminders">
            <Bell size={17} />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-fuchsia-400" />
          </button>
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
            <button onClick={() => setTab("ledger")} className="text-[12px] text-fuchsia-300 flex items-center gap-0.5">
              See all <ChevronRight size={14} />
            </button>
          </div>

          {recent.length === 0 ? (
            <div className="va-glass rounded-2xl p-6 text-center">
              <p className="text-[13px] text-purple-200/70">No transactions yet.</p>
              <button onClick={() => setSheet("income")} className="mt-3 text-[12.5px] text-fuchsia-300">
                Log your first income →
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
                    <div className="text-[13.5px] text-purple-50 truncate">{r.label}</div>
                    <div className="text-[11px] text-purple-200/50">{r.meta}</div>
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
            <button onClick={() => setSheet("income")} className="va-fab w-14 h-14 rounded-full flex items-center justify-center -mt-8 active:scale-95 transition" aria-label="Add">
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

        {sheet === "menu" && (
          <BottomSheet title="Quick menu" onClose={() => setSheet(null)}>
            {[
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
