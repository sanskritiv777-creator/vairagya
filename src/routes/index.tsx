import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import confusionArt from "@/assets/onboarding-confusion.jpg";
import todoArt from "@/assets/onboarding-todo.jpg";
import mark from "@/assets/vairagya-mark.png";
import { VairagyaLogo } from "@/components/vairagya-logo";
import { supabase } from "@/integrations/supabase/client";

export const ONBOARDED_KEY = "vairagya:onboarded";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Vairagya — Clarity for your money" },
      { name: "description", content: "A clear personal finance view for freelancers and independent workers." },
      { property: "og:title", content: "Vairagya — Clarity for your money" },
      { property: "og:description", content: "A clear personal finance view for freelancers and independent workers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SplashScreen,
});

const SLIDES = [
  {
    title: "Where did it all go?",
    body: "Your money moves fast. Keeping track shouldn’t.",
    art: confusionArt,
    alt: "Hand-drawn freelancer wondering where their money went",
  },
  {
    title: "Too much to keep up with?",
    body: "Expenses, income, reminders — scattered everywhere.",
    art: todoArt,
    alt: "Hand-drawn freelancer overwhelmed by a long to-do list",
  },
  {
    title: "Clarity, finally.",
    body: "Vairagya brings your money into one clear picture.",
    art: mark,
    alt: "Vairagya financial movement mark",
  },
];

function SplashScreen() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [gate, setGate] = useState<"checking" | "show">("checking");
  const slide = SLIDES[index];

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
      if (data.session) navigate({ to: "/app", replace: true });
      else if (seen) navigate({ to: "/auth", replace: true });
      else setGate("show");
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const advance = () => {
    if (index === SLIDES.length - 1) {
      localStorage.setItem(ONBOARDED_KEY, "1");
      navigate({ to: "/auth", replace: true });
    } else {
      setIndex((current) => current + 1);
    }
  };

  if (gate === "checking") {
    return <div className="grid min-h-screen place-items-center bg-background"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  const isLast = index === SLIDES.length - 1;
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <div className="flex h-9 items-center"><VairagyaLogo /></div>

        <div className="flex flex-1 flex-col justify-center py-4">
          <div key={`art-${index}`} className="onboard-rise mx-auto grid h-[31vh] min-h-52 max-h-72 w-full place-items-center overflow-hidden">
            <img
              src={slide.art}
              alt={slide.alt}
              width={1024}
              height={1024}
              className={isLast ? "h-36 w-36 object-contain" : "h-64 w-64 max-h-full max-w-[72vw] object-contain"}
            />
          </div>

          <div key={`copy-${index}`} className="onboard-copy mt-3 max-w-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">0{index + 1} / 03</p>
            <h1 className="mt-4 text-[clamp(2rem,9vw,2.75rem)] font-semibold leading-[1.03]">{slide.title}</h1>
            <p className="mt-4 max-w-xs text-[15px] leading-6 text-muted-foreground">{slide.body}</p>
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2" aria-label={`Slide ${index + 1} of 3`}>
            {SLIDES.map((item, itemIndex) => (
              <button key={item.title} onClick={() => setIndex(itemIndex)} aria-label={`Go to slide ${itemIndex + 1}`} className="h-1 rounded-full bg-secondary">
                <span className={`block h-full origin-left rounded-full bg-foreground transition-transform duration-300 ${itemIndex <= index ? "scale-x-100" : "scale-x-0"}`} />
              </button>
            ))}
          </div>
          <button onClick={advance} className="flex h-14 w-full items-center justify-between rounded-lg bg-primary px-5 text-[15px] font-semibold text-primary-foreground transition active:scale-[0.98]">
            <span>{isLast ? "Get started" : "Continue"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <style>{`
        @keyframes onboardRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes onboardCopy { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .onboard-rise { animation: onboardRise .5s ease-out both; }
        .onboard-rise img { animation: onboardFloat 5s ease-in-out infinite; }
        .onboard-copy { animation: onboardCopy .4s .08s ease-out both; }
        @keyframes onboardFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @media (prefers-reduced-motion: reduce) { .onboard-rise, .onboard-rise img, .onboard-copy { animation: none; } }
      `}</style>
    </main>
  );
}