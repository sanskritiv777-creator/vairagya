import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Catch-all. Its main job: if an OAuth redirect ever lands on a path this
 * app doesn't define (static-host fallback, provider-appended path, etc.),
 * forward the sign-in params to /auth/callback instead of showing a 404.
 */
export const Route = createFileRoute("/$")({
  ssr: false,
  component: CatchAll,
});

function hasOAuthParams(): boolean {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return ["code", "access_token", "error", "error_description"].some(
    (k) => search.has(k) || hash.has(k),
  );
}

function CatchAll() {
  const [forwarding, setForwarding] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasOAuthParams()) return;
    setForwarding(true);
    const { search, hash } = window.location;
    window.location.replace(`/auth/callback${search}${hash}`);
  }, []);

  if (forwarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07050F]">
        <Loader2 className="h-6 w-6 animate-spin text-purple-300" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#07050F] px-5 text-white">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <h2 className="mt-3 text-lg font-semibold">Page not found</h2>
        <p className="mt-2 text-[13px] text-purple-200/70">
          That page doesn't exist in Vairagya.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-purple-500 px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-purple-400"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
