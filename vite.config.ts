// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { nitro } from "nitro/vite";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Nitro 3 ships its Cloudflare "module" runtime with a helper that
 * mutates `request.ip` on the incoming `Request`. In modern Node/Bun the
 * `Request` object is spec-frozen, so the assignment throws
 * `Cannot set property ip of #<Request> which has only a getter` and the
 * TanStack Start SPA prerender crashes before ever producing
 * `.output/public/index.html`.
 *
 * We patch the helper in place (idempotent) to skip the mutation. The web
 * (Cloudflare Worker) runtime is unaffected — in production Cloudflare's
 * Request is writable, so the guarded try/catch simply succeeds.
 */
function patchNitroModuleHandlerForStaticBuild() {
  const target = join(
    __dirname,
    "node_modules/nitro/dist/presets/cloudflare/runtime/_module-handler.mjs",
  );
  if (!existsSync(target)) return;
  const source = readFileSync(target, "utf8");
  if (source.includes("/* lovable-static-patch */")) return;
  const patched = source.replace(
    "export function augmentReq(cfReq, ctx) {",
    "export function augmentReq(cfReq, ctx) { /* lovable-static-patch */ try {",
  );
  const finalPatched = patched.replace(
    'req.waitUntil = ctx.context?.waitUntil.bind(ctx.context);\n}',
    'req.waitUntil = ctx.context?.waitUntil?.bind(ctx.context);\n} catch { /* Request is read-only in Node/Bun during static prerender */ } }',
  );
  const finalPatched = patched
    .replace(
      'req.waitUntil = ctx.context?.waitUntil.bind(ctx.context);\n}',
      'req.waitUntil = ctx.context?.waitUntil?.bind(ctx.context);\n} catch { /* Request is read-only in Node/Bun during static prerender */ } }',
    )
    // The Cloudflare module handler assumes `env` (the Workers bindings
    // bag) is defined. During the prerender step `env` is undefined, which
    // throws "Cannot read properties of undefined (reading 'ASSETS')".
    // Guard the access so prerender falls through to the nitro app.
    .replace("env.ASSETS && isPublicAssetURL", "env?.ASSETS && isPublicAssetURL");
  writeFileSync(target, finalPatched);
}

// Also patch the cloudflare-module runtime file (env.ASSETS guard).
function patchNitroCloudflareModuleForStaticBuild() {
  const target = join(
    __dirname,
    "node_modules/nitro/dist/presets/cloudflare/runtime/cloudflare-module.mjs",
  );
  if (!existsSync(target)) return;
  const source = readFileSync(target, "utf8");
  if (source.includes("/* lovable-static-patch */")) return;
  writeFileSync(
    target,
    "/* lovable-static-patch */\n" +
      source.replace("env.ASSETS && isPublicAssetURL", "env?.ASSETS && isPublicAssetURL"),
  );
}
patchNitroCloudflareModuleForStaticBuild();

patchNitroModuleHandlerForStaticBuild();

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
    plugins: [
      {
        name: "lovable:patch-nitro-module-handler",
        // Re-apply the patch on every build — node_modules may be reinstalled
        // between CI runs.
        config() {
          patchNitroModuleHandlerForStaticBuild();
        },
      },
      nitro({ preset: "static" }),
    ],
  },
});
