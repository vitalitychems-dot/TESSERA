/** Pure strategy used by public/sw.js: app shell cache-first, API network-only, pages network-then-cache. */
export const SHELL = ["/", "/index.html"];
export function strategy(url: string, method = "GET"): "cache-first" | "network-first" | "network-only" {
  if (method !== "GET") return "network-only";
  const p = new URL(url, "http://x").pathname;
  if (p.startsWith("/api/")) return "network-only";
  if (SHELL.includes(p) || /\.(js|css|svg|png|woff2?)$/.test(p)) return "cache-first";
  return "network-first";
}
