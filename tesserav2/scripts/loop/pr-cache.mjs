// Speed of dark: ETag "not changed" cache + skip PRs whose head SHA was already judged.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
export function loadCache(p){ return existsSync(p) ? JSON.parse(readFileSync(p,'utf8')) : { etags:{}, seen:{} }; }
export function saveCache(p,c){ writeFileSync(p, JSON.stringify(c)); }
// fetchFn(url, headers) -> {status, etag, body}
export async function cachedGet(c, url, fetchFn){
  const h = c.etags[url] ? { 'If-None-Match': c.etags[url].etag } : {};
  const r = await fetchFn(url, h);
  if (r.status === 304) return { body: c.etags[url].body, fromCache: true };
  if (r.etag) c.etags[url] = { etag: r.etag, body: r.body };
  return { body: r.body, fromCache: false };
}
export function changedPRs(c, prs){
  const out = prs.filter(p => c.seen[p.number] !== p.head.sha);
  for (const p of prs) c.seen[p.number] = p.head.sha;
  return out;
}
