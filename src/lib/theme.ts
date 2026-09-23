// Canvas code can't use CSS variables directly, so read them once from :root.
const cache = new Map<string, string>();

export function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  let value = cache.get(name);
  if (value === undefined) {
    value = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
    cache.set(name, value);
  }
  return value;
}

export function withAlpha(hex: string, alpha: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, "$&$&") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
