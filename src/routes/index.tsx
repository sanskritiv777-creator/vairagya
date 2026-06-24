import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Lock, Sparkles, TrendingUp } from "lucide-react";
import splashBg from "@/assets/splash-bg.jpg";

export const Route = createFileRoute("/")({
  component: SplashScreen,
});

const SLIDES = [
  {
    eyebrow: "VARAIGYA",
    version: "V1",
    titleLead: "Clarity in",
    titleAccent: "every rupee.",
    sub: "Track, manage & grow\nyour runway with purpose.",
    metricLabel: "Runway",
    metricValue: "1.3 months",
    metricCaption: "and counting...",
  },
  {
    eyebrow: "VARAIGYA",
    version: "V1",
    titleLead: "Know what's",
    titleAccent: "truly yours.",
    sub: "Auto set-aside for taxes,\nso the rest is safe to spend.",
    metricLabel: "Safe to spend",
    metricValue: "₹ 42,800",
    metricCaption: "after tax jar",
  },
  {
    eyebrow: "VARAIGYA",
    version: "V1",
    titleLead: "Built for",
    titleAccent: "freelancers.",
    sub: "Income, expenses & quarterly\nreminders — all in one place.",
    metricLabel: "Next reminder",
    metricValue: "Q3 Tax",
    metricCaption: "Sept 15",
  },
];

function SplashScreen() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5000);
    return () => clearInterval(id);
  }, []);

  const isLast = index === SLIDES.length - 1;
  const advance = () => {
    if (isLast) navigate({ to: "/app" });
    else setIndex((i) => i + 1);
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#07050F] text-white">
      {/* Background image */}
      <img
        src={splashBg}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover opacity-90"
      />
      {/* Vignettes & glows */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#07050F]/70 via-[#0B0718]/30 to-[#07050F]" />
      <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-10 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full border border-purple-400/30 shadow-[0_0_120px_30px_rgba(168,85,247,0.35)]" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col px-7 pt-14 pb-8">
        {/* Brand */}
        <div className="text-center">
          <p className="text-[11px] font-medium tracking-[0.45em] text-white/70">
            {slide.eyebrow}
          </p>
          <p className="mt-1 text-[10px] tracking-[0.3em] text-white/40">
            {slide.version}
          </p>
        </div>

        {/* Headline */}
        <div className="mt-10 relative">
          <Sparkles
            className="absolute -left-1 -top-2 h-5 w-5 text-white/70"
            strokeWidth={1.2}
          />
          <h1
            key={index}
            className="animate-[fadeUp_0.6s_ease-out] font-serif text-5xl leading-[1.05] tracking-tight text-white"
            style={{ fontFamily: "'Cormorant Garamond', 'Bricolage Grotesque', serif" }}
          >
            {slide.titleLead}
            <br />
            <span className="bg-gradient-to-r from-purple-200 via-purple-300 to-purple-500 bg-clip-text text-transparent">
              {slide.titleAccent}
            </span>
          </h1>
          <p
            key={`sub-${index}`}
            className="mt-5 whitespace-pre-line text-base leading-relaxed text-white/65 animate-[fadeUp_0.7s_ease-out]"
          >
            {slide.sub}
          </p>
        </div>

        {/* Glass metric card */}
        <div className="mt-auto flex justify-center pt-10">
          <div
            key={`card-${index}`}
            className="animate-[fadeUp_0.8s_ease-out] w-64 rounded-3xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(168,85,247,0.4)]"
          >
            <div className="flex items-center justify-between text-purple-200/80">
              <Sparkles className="h-4 w-4" strokeWidth={1.3} />
              <TrendingUp className="h-4 w-4" strokeWidth={1.3} />
            </div>
            <p className="mt-4 text-sm text-white/70">{slide.metricLabel}</p>
            <p
              className="mt-1 text-3xl font-light text-white"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              {slide.metricValue}
            </p>
            <p className="mt-1 text-sm italic text-white/50">{slide.metricCaption}</p>
          </div>
        </div>

        {/* Dots */}
        <div className="mt-8 flex justify-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-purple-400" : "w-2 bg-white/25"
              }`}
            />
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={advance}
          className="group relative mt-6 flex h-16 w-full items-center justify-between rounded-full bg-gradient-to-r from-purple-400 via-purple-300 to-purple-500 px-6 text-[#1a0b2e] shadow-[0_15px_50px_-10px_rgba(168,85,247,0.7)] transition active:scale-[0.98]"
        >
          <span className="flex-1 text-center text-base font-semibold tracking-wide">
            {isLast ? "Begin your runway" : "Continue"}
          </span>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1a0b2e]/80 text-white transition group-hover:translate-x-0.5">
            <ArrowRight className="h-5 w-5" />
          </span>
        </button>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-center gap-3 text-xs text-white/45">
          <span className="h-px w-8 bg-white/15" />
          <Lock className="h-3.5 w-3.5" />
          <span>Your data is private &amp; secure</span>
          <span className="h-px w-8 bg-white/15" />
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
