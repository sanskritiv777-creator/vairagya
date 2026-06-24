import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Mail, Lock, User as UserIcon, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Varaigya" },
      { name: "description", content: "Sign in to track your freelance income, taxes, and runway." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/app", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/app`,
            data: { display_name: name || email.split("@")[0] },
          },
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-white flex items-center justify-center px-5"
      style={{
        background:
          "radial-gradient(900px 500px at 80% -10%, rgba(168,85,247,0.35), transparent 60%), radial-gradient(700px 500px at -20% 110%, rgba(91,33,182,0.45), transparent 60%), #07050F",
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
      }}
    >
      <style>{`
        .auth-glass { background: linear-gradient(150deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)); border: 1px solid rgba(168,85,247,0.22); backdrop-filter: blur(12px); }
        .auth-input { background: rgba(255,255,255,0.04); border: 1px solid rgba(168,85,247,0.25); color: #F5F3FF; }
        .auth-input::placeholder { color: rgba(216,180,254,0.5); }
        .auth-input:focus { outline: none; border-color: #C084FC; box-shadow: 0 0 0 3px rgba(192,132,252,0.18); }
        .auth-fab { background: radial-gradient(circle at 30% 20%, #D8B4FE, #A855F7 55%, #6B21A8); box-shadow: 0 18px 40px -12px rgba(168,85,247,0.6), inset 0 1px 0 rgba(255,255,255,0.4); }
        .auth-display { font-family: 'Bricolage Grotesque', serif; font-weight: 600; letter-spacing: -0.02em; }
      `}</style>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-[11px] uppercase tracking-[0.3em] text-purple-200/60">Varaigya · v1</div>
          <h1 className="auth-display text-3xl mt-3">
            {mode === "signin" ? "Welcome back." : "Start tracking."}
          </h1>
          <p className="text-purple-200/70 text-[13px] mt-2">
            {mode === "signin"
              ? "Sign in to see what's actually yours to spend."
              : "Know your tax-safe income from day one."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="auth-glass rounded-3xl p-5 space-y-3">
          {mode === "signup" && (
            <label className="flex items-center gap-3 auth-input rounded-xl px-4 py-3">
              <UserIcon size={16} className="text-fuchsia-300" />
              <input
                className="bg-transparent outline-none flex-1 text-[14px]"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label className="flex items-center gap-3 auth-input rounded-xl px-4 py-3">
            <Mail size={16} className="text-fuchsia-300" />
            <input
              type="email"
              required
              autoComplete="email"
              className="bg-transparent outline-none flex-1 text-[14px]"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-3 auth-input rounded-xl px-4 py-3">
            <Lock size={16} className="text-fuchsia-300" />
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="bg-transparent outline-none flex-1 text-[14px]"
              placeholder="Password (min 6 chars)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <div className="text-[12.5px] text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-fab w-full rounded-xl py-3.5 text-[14px] font-semibold text-white active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <>
              {mode === "signin" ? "Sign in" : "Create account"}
              <ArrowRight size={16} />
            </>}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
          className="mt-5 w-full text-center text-[13px] text-purple-200/70 hover:text-fuchsia-200 transition"
        >
          {mode === "signin"
            ? "New here? Create an account →"
            : "Already have an account? Sign in →"}
        </button>
      </div>
    </div>
  );
}
