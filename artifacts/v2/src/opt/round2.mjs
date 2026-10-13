/**
 * OPT round 2 (Rick's inventions R2-1..R2-9). R2-10 resonate-batch skipped (noise).
 * R2-2 key-hoist and R2-8 earth-return change the wire format: they are opt-in and
 * ship with their decode step (unhoist / earth.receive).
 */
import { createHash } from "node:crypto";
import { countTokens } from "../token/meter.mjs";
import { compressPrompt } from "../token/router.mjs";
import { dedupeLines, refLegend, expandLegend } from "./token-lab.mjs";

/** R2-1 prefix-legend (finishes OPT-04): legend for repeated path prefixes. Decode with expandPrefix. */
export function prefixLegend(text, { minLen = 12, minCount = 3, max = 9 } = {}) {
  const s = String(text);
  if (s.includes("§")) return s;
  const cnt = new Map();
  for (const w of s.match(/[\w.:@#-]+(?:\/[\w.:@#-]+)+\/?/g) ?? []) {
    const parts = w.split("/"); let p = "";
    for (let i = 0; i < parts.length - 1; i++) { p += parts[i] + "/"; if (p.length >= minLen) cnt.set(p, (cnt.get(p) ?? 0) + 1); }
  }
  const cand = [...cnt].filter(([, n]) => n >= minCount)
    .map(([p, n]) => [p, n * (p.length - 3) - (p.length + 4)]).filter(([, g]) => g > 0)
    .sort((a, b) => b[0].length - a[0].length);
  const picks = [];
  for (const [p] of cand) { if (!picks.find((q) => q.startsWith(p))) picks.push(p); if (picks.length >= max) break; }
  let out = s; const legend = [];
  picks.forEach((p, i) => { if (!out.includes(p)) return; out = out.split(p).join(`§${legend.length}`); legend.push(`§${legend.length}=${p}`); });
  return legend.length ? legend.join(" ") + "\n" + out : s;
}
export const expandPrefix = (t) => expandLegend(t);

/** R2-2 key-hoist (opt-in wire format): JSONL rows -> key list once per row shape + value arrays. */
export function keyHoist(rows) {
  const groups = new Map();
  rows.forEach((r, i) => {
    const o = typeof r === "string" ? JSON.parse(r) : r;
    const k = JSON.stringify(Object.keys(o));
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push([i, Object.values(o)]);
  });
  return JSON.stringify({ hoist: 1, g: [...groups].map(([k, v]) => ({ k: JSON.parse(k), r: v })) });
}
/** Decode step for keyHoist: returns minified JSON rows in original order. */
export function unhoist(s) {
  const doc = JSON.parse(s);
  if (doc?.hoist !== 1) throw new Error("not a key-hoist payload");
  const out = [];
  for (const g of doc.g) for (const [i, vals] of g.r) out[i] = JSON.stringify(Object.fromEntries(g.k.map((k, j) => [k, vals[j]])));
  return out;
}

/** R2-3 resonate-chain (finishes OPT-11): try every order/subset of passes, keep the smallest verified output. */
export const CHAIN_PASSES = { dedupe: dedupeLines, ws: (t) => compressPrompt(t), prefix: (t) => prefixLegend(t), ref: (t) => refLegend(t) };
const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
/** Default check: decoded output equals the deduped+whitespace-folded input (same contract as packContext). */
export const chainVerifier = (text) => {
  const ok = new Set([compressPrompt(dedupeLines(text)), compressPrompt(text), dedupeLines(compressPrompt(text))]);
  return (out) => ok.has(compressPrompt(expandLegend(out)));
};
export function resonateChain(text, verify = chainVerifier(text), passes = CHAIN_PASSES) {
  const names = Object.keys(passes); let best = { out: String(text), chain: [] };
  for (let m = 1; m < 1 << names.length; m++) {
    const sub = names.filter((_, i) => (m >> i) & 1);
    for (const ch of perms(sub)) {
      const out = ch.reduce((t, n) => passes[n](t), String(text));
      if (countTokens(out) < countTokens(best.out) && verify(out)) best = { out, chain: ch };
    }
  }
  return best;
}

/** R2-4 coincide: act only when every independent check agrees (default 3 of 3). */
export function coincide(checks, need = checks.length) {
  const yes = checks.filter(Boolean).length;
  return { act: yes >= need, yes, of: checks.length };
}

/** R2-5 phase: stagger worker i to start on tick (i mod K). */
export const phaseStarts = (n, K = 4) => Array.from({ length: n }, (_, i) => i % K);
export const peakStarts = (starts) => Math.max(0, ...Object.values(starts.reduce((m, t) => ((m[t] = (m[t] ?? 0) + 1), m), {})));

/** R2-6 valve: append-only log; rewriting an existing index is refused. */
export function valveLog() {
  const lines = [];
  return {
    append: (l) => lines.push(l),
    write: (i, l) => { if (i !== lines.length) return false; lines.push(l); return true; },
    lines: () => lines.slice(),
  };
}

/** R2-7 bifilar: every open must be paired with a close; returns ids left open. */
export function bifilar(events) {
  const open = new Map();
  for (const [t, id] of events) { if (t === "open") open.set(id, (open.get(id) ?? 0) + 1); else if (open.has(id)) { const n = open.get(id) - 1; n ? open.set(id, n) : open.delete(id); } }
  return [...open.keys()];
}

/** R2-8 earth-return (opt-in wire format): body stored once, chain passes a 16-hex ref. */
export function createEarthStore() {
  const store = new Map();
  return {
    send(body) { const ref = createHash("sha256").update(String(body)).digest("hex").slice(0, 16); store.set(ref, String(body)); return { ref }; },
    receive(msg) {
      if (msg && typeof msg.ref === "string") { if (!store.has(msg.ref)) throw new Error(`earth-return: unknown ref ${msg.ref}`); return store.get(msg.ref); }
      return typeof msg === "string" ? msg : msg?.body;
    },
    size: () => store.size,
  };
}

/** R2-9 tuned-clip: keep lines matching the query (then head lines) up to maxLines. */
export function tunedClip(text, query, { maxLines = 40 } = {}) {
  const lines = String(text).split("\n");
  if (lines.length <= maxLines) return String(text);
  const q = String(query).toLowerCase();
  const hit = []; lines.forEach((l, i) => { if (q && l.toLowerCase().includes(q)) hit.push(i); });
  const keep = new Set(hit.slice(0, maxLines - 5));
  for (let i = 0; keep.size < maxLines && i < lines.length; i++) keep.add(i);
  return [...keep].sort((a, b) => a - b).map((i) => lines[i]).join("\n") + `\n[${lines.length - keep.size} lines clipped]`;
}
