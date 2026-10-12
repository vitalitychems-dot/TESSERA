/** Optional read-only Kiwix lookup. OFF by default; only a local kiwix-serve URL the owner sets. */
export type KiwixConfig = { enabled: boolean; baseUrl: string };
export const DEFAULT_KIWIX: KiwixConfig = { enabled: false, baseUrl: "" };
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

export async function kiwixSearch(cfg: KiwixConfig, query: string, fetchFn: typeof fetch = fetch) {
  if (!cfg.enabled) return { used: false as const, reason: "kiwix is off" };
  if (!LOCAL.test(cfg.baseUrl)) return { used: false as const, reason: "kiwix url must be local" };
  const url = `${cfg.baseUrl.replace(/\/$/, "")}/search?pattern=${encodeURIComponent(query)}&format=xml&pageLength=5`;
  const res = await fetchFn(url);
  if (!res.ok) return { used: false as const, reason: `kiwix ${res.status}` };
  const xml = await res.text();
  const titles = [...xml.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]).filter((t) => !/^Search/i.test(t));
  return { used: true as const, titles };
}
export const isOfflineWikiQuery = (q: string) => /\b(offline wiki|kiwix|wikipedia offline)\b/i.test(q);
