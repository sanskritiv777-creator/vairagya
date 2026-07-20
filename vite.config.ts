// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

// Capacitor requires a plain static SPA bundle with an `index.html` entry
// point (Capacitor's `webDir`). TanStack Start's SPA mode prerenders a
// single client-only shell that all routes hydrate against, which is
// exactly what a WebView needs. The web (Lovable) build is unaffected —
// the shell also works as the SSR fallback.
export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    server: { entry: "server" },
    // Emit a static SPA shell at `.output/public/index.html`. Every route
    // hydrates on the client — no per-route prerender, no SSR required at
    // runtime. This is the file Capacitor loads inside the WebView.
    spa: {
      enabled: true,
      maskPath: "/",
      prerender: {
        enabled: true,
        outputPath: "/index.html",
        crawlLinks: false,
      },
    },
  },
  vite: {
    // Force nitro's static preset so the build only writes `.output/public`
    // (no Cloudflare Worker bundle needed for the APK).
    plugins: [nitro({ preset: "static" })],
  },
});
