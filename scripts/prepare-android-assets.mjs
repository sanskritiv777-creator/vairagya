#!/usr/bin/env node
/**
 * Prepare Capacitor icon/splash source images for the Android build.
 *
 * Reads src/assets/app-icon.png.asset.json (the Lovable CDN pointer for the
 * official Vairagya "V" logo) and downloads it into resources/ in the shape
 * that @capacitor/assets expects, so the CI workflow can run:
 *
 *   bunx @capacitor/assets generate --android \
 *     --iconBackgroundColor "#07050F" \
 *     --iconBackgroundColorDark "#07050F" \
 *     --splashBackgroundColor "#07050F"
 *
 * That produces launcher icons, adaptive icons (Android 8+), monochrome
 * themed icons (Android 13+) and matching splash screens automatically.
 */
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const pointerPath = resolve(root, "src/assets/app-icon.png.asset.json");
const pointer = JSON.parse(readFileSync(pointerPath, "utf8"));

// The pointer stores a relative URL served by the Lovable asset proxy.
// Every deployment host proxies /__l5e/... so any published URL works;
// use the project's canonical published host.
const host =
  process.env.LOVABLE_PUBLIC_HOST ?? "https://vairagya.lovable.app";
const url = pointer.url.startsWith("http") ? pointer.url : host + pointer.url;

console.log(`[prepare-android-assets] Fetching launcher icon from ${url}`);
const res = await fetch(url);
if (!res.ok) {
  console.error(
    `[prepare-android-assets] Failed to fetch icon: ${res.status} ${res.statusText}`,
  );
  process.exit(1);
}
const bytes = new Uint8Array(await res.arrayBuffer());

const resourcesDir = resolve(root, "resources");
mkdirSync(resourcesDir, { recursive: true });

// @capacitor/assets picks these up automatically:
//   - icon.png              → legacy launcher icon
//   - icon-foreground.png   → adaptive icon foreground layer (Android 8+)
//   - icon-only.png         → monochrome themed icon source (Android 13+)
//   - splash.png            → splash screen (falls back to icon-on-bg if missing)
for (const name of [
  "icon.png",
  "icon-foreground.png",
  "icon-only.png",
  "splash.png",
  "splash-dark.png",
]) {
  writeFileSync(resolve(resourcesDir, name), bytes);
}

console.log(
  `[prepare-android-assets] Wrote ${bytes.length} bytes → resources/{icon,icon-foreground,icon-only,splash,splash-dark}.png`,
);
