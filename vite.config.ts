// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Capacitor needs a plain static site (index.html + JS/CSS), not the
  // Cloudflare-Worker-shaped server bundle this template builds by default.
  // Overriding the nitro preset to "static" here — via the officially
  // documented `vite: { plugins: [...] }` escape hatch — produces real
  // static output instead. The web/Lovable-hosted build is unaffected.
  vite: {
    plugins: [nitro({ preset: "static" })],
  },
});
