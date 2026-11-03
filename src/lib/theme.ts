export type ThemePref = "dark" | "light" | "system";

const STORAGE_KEY = "vairagya:theme";

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "dark";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "system" ? v : "dark";
  } catch {
    return "dark";
  }
}

export function resolveTheme(pref: ThemePref): "dark" | "light" {
  if (pref !== "system") return pref;
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(pref: ThemePref): "dark" | "light" {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.classList.toggle("light", resolved === "light");
  root.style.colorScheme = resolved;
  return resolved;
}

export function setThemePref(pref: ThemePref): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* storage unavailable — theme still applies for this session */
  }
  applyTheme(pref);
}

export function watchSystemTheme(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const m = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (getThemePref() === "system") onChange();
  };
  m.addEventListener?.("change", handler);
  return () => m.removeEventListener?.("change", handler);
}
