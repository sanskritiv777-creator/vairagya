import { getOAuthRedirectUri } from "@/native/oauth";
import { isNative } from "@/native/platform";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { ONBOARDED_KEY } from "../index";
import { Loader2, Mail, Lock, User as UserIcon, ArrowRight } from "lucide-react";
import { VairagyaLogo } from "@/components/vairagya-logo";

export const Route = createFileRoute("/auth/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Varaigya" },
      { name: "description", content: "Sign in to track your freelance income, taxes, and runway." },
      { property: "og:title", content: "Sign in — Vairagya" },
      { property: "og:description", content: "Sign in to track your freelance income, taxes, and runway." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
      if (isNative()) {
        // Native Android: Supabase OAuth in the system browser, returning via
        // the app.vairagya://auth/callback deep link (handled in __root).
        const { data, error: oauthErr } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: getOAuthRedirectUri(), skipBrowserRedirect: true },
        });
        if (oauthErr) throw oauthErr;
        if (!data?.url) throw new Error("Google sign-in URL was not returned.");
        window.location.href = data.url;
        return;
      }
      // Web: /auth/callback finishes the session exchange.
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: getOAuthRedirectUri(),
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6 py-[calc(2rem+env(safe-area-inset-top))] text-foreground">
      <div className="w-full max-w-md">
        <div className="mb-9"><VairagyaLogo /></div>
        <div className="mb-7">
          <h1 className="text-3xl font-semibold">
            {mode === "signin" ? "Welcome back." : "Start tracking."}
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
            {mode === "signin"
              ? "Sign in to see what's actually yours to spend."
              : "Know your tax-safe income from day one."}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" && (
            <label className="flex items-center gap-3 rounded-lg border border-input bg-card px-4 py-3.5 focus-within:border-foreground/50">
              <UserIcon size={16} className="text-muted-foreground" />
              <input
                className="bg-transparent outline-none flex-1 text-[14px]"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          <label className="flex items-center gap-3 rounded-lg border border-input bg-card px-4 py-3.5 focus-within:border-foreground/50">
            <Mail size={16} className="text-muted-foreground" />
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
          <label className="flex items-center gap-3 rounded-lg border border-input bg-card px-4 py-3.5 focus-within:border-foreground/50">
            <Lock size={16} className="text-muted-foreground" />
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
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12.5px] text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3.5 text-[14px] font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <>
              {mode === "signin" ? "Sign in" : "Create account"}
              <ArrowRight size={16} />
            </>}
          </button>

          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            type="button"
            onClick={onGoogle}
            disabled={googleLoading || loading}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-input bg-card py-3.5 text-[14px] font-medium text-foreground transition active:scale-[0.98] disabled:opacity-60"
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
          className="mt-6 w-full text-center text-[13px] text-muted-foreground transition hover:text-foreground"
        >
          {mode === "signin"
            ? "New here? Create an account →"
            : "Already have an account? Sign in →"}
        </button>
      </div>
    </div>
  );
}
