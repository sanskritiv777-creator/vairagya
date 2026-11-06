import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import VairagyaIntro from "@/components/vairagya-intro";
import { getThemePref, resolveTheme, watchSystemTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";

export const ONBOARDED_KEY = "vairagya:onboarded";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vairagya — own less. know more." },
      { name: "description", content: "Vairagya brings your money into one clear picture — income, expenses, tax set-aside and runway for independent workers." },
      { property: "og:title", content: "Vairagya — own less. know more." },
      { property: "og:description", content: "Vairagya brings your money into one clear picture — income, expenses, tax set-aside and runway for independent workers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Vairagya — own less. know more." },
      { name: "twitter:description", content: "Vairagya brings your money into one clear picture — income, expenses, tax set-aside and runway for independent workers." },
    ],
  }),
  component: IntroGate,
});

function IntroGate() {
  const navigate = useNavigate();
  const [gate, setGate] = useState<"checking" | "show">("checking");
  const [introTheme, setIntroTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const search = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hasOAuth = ["code", "access_token", "error", "error_description"].some(
        (key) => search.has(key) || hash.has(key),
      );
      if (hasOAuth) {
        window.location.replace(`/auth/callback${window.location.search}${window.location.hash}`);
        return;
      }
      const seen = localStorage.getItem(ONBOARDED_KEY) === "1";
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      setIntroTheme(resolveTheme(getThemePref()));
      if (data.session) navigate({ to: "/app", replace: true });
      else if (seen) navigate({ to: "/auth", replace: true });
      else setGate("show");
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  useEffect(() => watchSystemTheme(() => setIntroTheme(resolveTheme(getThemePref()))), []);

  if (gate === "checking") {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <VairagyaIntro
      theme={introTheme}
      showToggle={false}
      onGetStarted={() => {
        localStorage.setItem(ONBOARDED_KEY, "1");
        navigate({ to: "/auth", replace: true });
      }}
    />
  );
}
