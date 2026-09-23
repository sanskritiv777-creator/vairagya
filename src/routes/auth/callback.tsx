import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ONBOARDED_KEY } from "../index";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Signing you in — Vairagya" }],
  }),
  component: AuthCallbackPage,
});

/**
 * Landing page for Google OAuth. Supabase appends either a PKCE `code`
 * query param or hash tokens to this URL; we finish the exchange, then
 * send the user straight to the dashboard. OAuth failures are shown here
 * instead of falling through to the generic 404 page.
 */
function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = new URL(window.location.href);

        // Provider/broker reported an error (access denied, etc.)
        const oauthError =
          url.searchParams.get("error_description") ||
          url.searchParams.get("error") ||
          new URLSearchParams(window.location.hash.replace(/^#/, "")).get("error_description");
        if (oauthError) throw new Error(oauthError);

        // PKCE flow: exchange the code for a session.
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        // Hash-token flow is handled automatically by detectSessionInUrl;
        // poll briefly for the session to materialize.
        let session = null;
        for (let i = 0; i < 20; i++) {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            session = data.session;
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        if (!session) throw new Error("Sign-in could not be completed. Please try again.");

        if (cancelled) return;
        localStorage.setItem(ONBOARDED_KEY, "1");
        navigate({ to: "/app", replace: true });
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Google sign-in failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div
      className="min-h-screen text-white flex items-center justify-center px-5"
      style={{
        background:
          "radial-gradient(900px 500px at 80% -10%, rgba(168,85,247,0.35), transparent 60%), radial-gradient(700px 500px at -20% 110%, rgba(91,33,182,0.45), transparent 60%), #07050F",
        fontFamily: "'Space Grotesk', system-ui, sans-serif",
      }}
    >
      <div className="w-full max-w-md text-center">
        {error ? (
          <>
            <h1 className="text-2xl font-semibold">Sign-in didn't complete</h1>
            <p className="mt-3 text-[13px] text-rose-300 bg-rose-500/10 border border-rose-400/20 rounded-xl px-4 py-3">
              {error}
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-purple-500 px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-purple-400"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-purple-300" />
            <p className="mt-4 text-[14px] text-purple-200/70">Finishing Google sign-in…</p>
          </>
        )}
      </div>
    </div>
  );
}
