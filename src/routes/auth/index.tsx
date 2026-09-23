import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ONBOARDED_KEY } from "../index";
import { Loader2, Mail, Lock, User as UserIcon, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/auth/")({
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
  const [googleLoading, setGoogleLoading] = useState(false);
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
      localStorage.setItem(ONBOARDED_KEY, "1");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setGoogleLoading(true);
    setError(null);
    try {
      // redirect_uri must be a real, existing route: /auth/callback finishes
      // the session exchange and forwards to the dashboard.
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.error) throw result.error;
      // Full-page redirect: the callback route takes it from here.
      if (result.redirected) return;
      localStorage.setItem(ONBOARDED_KEY, "1");
      navigate({ to: "/app", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
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

          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-purple-400/20" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-purple-200/45">or</span>
            <span className="h-px flex-1 bg-purple-400/20" />
          </div>

          <button
            type="button"
            onClick={onGoogle}
            disabled={googleLoading || loading}
            className="auth-input w-full rounded-xl py-3.5 text-[14px] font-medium text-purple-50 active:scale-[0.98] transition flex items-center justify-center gap-2.5 disabled:opacity-60"
          >
            {googleLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden>
                <path
                  fill="#FFC107"
                  d="M43.6 20.1H24v7.9h11.3C33.7 33 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.6-5.6C33.9 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20c11 0 19.4-8 19.4-20 0-1.3-.2-2.6-.8-3.9z"
                />
                <path
                  fill="#FF3D00"
                  d="M6.3 14.7l6.5 4.8C14.6 15.1 18.9 12 24 12c3.1 0 5.8 1.1 7.9 3l5.6-5.6C33.9 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
                />
                <path
                  fill="#4CAF50"
                  d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 34.9 26.8 36 24 36c-5.2 0-9.6-3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"
                />
                <path
                  fill="#1976D2"
                  d="M43.6 20.1H24v7.9h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C40.9 36.3 44 30.8 44 24c0-1.3-.2-2.6-.4-3.9z"
                />
              </svg>
            )}
            Continue with Google
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
