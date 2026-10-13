// Offline search: tokenized inverted index over ZIM titles (+ article text), saved as JSON.
import { readFileSync, writeFileSync } from "node:fs";

export const tokenize = (s) => (s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").match(/[a-z0-9]+/g) || []).filter((t) => t.length > 1);
const stripHtml = (s) => s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");

export function buildIndex(zim, { text = true, maxTextBytes = 20000 } = {}) {
  const docs = [], post = new Map();
  const add = (tok, d, w) => { let m = post.get(tok); if (!m) post.set(tok, (m = new Map())); m.set(d, (m.get(d) || 0) + w); };
  for (const e of zim.entries()) {
    if (e.redirect !== undefined || e.ns !== "C" && e.ns !== "A") continue;
    if (e.mime && !/^text\//.test(e.mime)) continue;
    const d = docs.length; docs.push([e.ns, e.url, e.title]);
    for (const t of tokenize(e.title)) add(t, d, 5);
    if (text) { try { for (const t of tokenize(stripHtml(zim.content(e).toString("utf8", 0, maxTextBytes)))) add(t, d, 1); } catch { /* compressed: titles only */ } }
  }
  const terms = {};
  for (const [t, m] of [...post].sort()) terms[t] = [...m].flat();
  return { v: 1, docs, terms };
}
export const saveIndex = (idx, path) => writeFileSync(path, JSON.stringify(idx));
export const loadIndex = (path) => JSON.parse(readFileSync(path, "utf8"));
export function search(idx, q, limit = 10) {
  const toks = tokenize(q); if (!toks.length) return [];
  const score = new Map(), hits = new Map();
  for (const t of toks) {
    const p = idx.terms[t]; if (!p) continue;
    for (let i = 0; i < p.length; i += 2) { score.set(p[i], (score.get(p[i]) || 0) + p[i + 1]); hits.set(p[i], (hits.get(p[i]) || 0) + 1); }
  }
  return [...score].map(([d, s]) => [d, s + 100 * hits.get(d)]).sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, limit)
    .map(([d, s]) => ({ ns: idx.docs[d][0], url: idx.docs[d][1], title: idx.docs[d][2], score: s }));
}
