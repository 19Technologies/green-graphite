// Canvas code can't use CSS variables directly, so read them from :root (cached per theme).
const cache = new Map<string, string>();

export function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const key = (document.documentElement.dataset.theme ?? "") + name;
  let value = cache.get(key);
  if (value === undefined) {
    value = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    cache.set(key, value);
  }
  return value;
}

export function withAlpha(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export type ResolvedTheme = "paper" | "graphite";

/** Apply a theme choice to the page (and the browser's toolbar colour). */
export function applyTheme(choice: "paper" | "graphite" | "system"): ResolvedTheme {
  const theme: ResolvedTheme =
    choice === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "graphite" : "paper") : choice;
  document.documentElement.dataset.theme = theme;
  const color = theme === "paper" ? "#fbf7f0" : "#1b1b1e";
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", color));
  return theme;
}
