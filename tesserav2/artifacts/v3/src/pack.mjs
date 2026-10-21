/**
 * v3 context packing for the context ranker: turn ranked memory nodes into prompt text with
 * fewer tokens. Clean-room re-implementations of published ideas (no code copied):
 *  - dedupe: drop observation sentences already emitted (exact, case-folded).
 *  - prune: LLMLingua-style token dropping (microsoft/LLMLingua, MIT) using graph IDF
 *    instead of a small LM: drop stopwords and very common words; entity names are never cut.
 *  - pack: repomix-style compact packing (yamadashy/repomix, MIT): one line per item, no
 *    JSON punctuation, items grouped under a type header.
 *  - sink: StreamingLLM-style attention sink + window (mit-han-lab/streaming-llm, MIT): keep
 *    the seed header in full and the first `win` words of each later item.
 */
export const tokens = (s) => (String(s).match(/[A-Za-z0-9]+|[^\sA-Za-z0-9]/g) ?? []).length; // approx BPE-free count
const STOP = new Set("a an the and or of to in on for with by at from is are was were be been it its this that these those as into via not no than then also".split(" "));
export function entityText(raw) { return new Map(raw.filter((r) => r.type === "entity").map((r) => [r.name, { type: r.entityType ?? "unknown", obs: r.observations ?? [] }])); }
export function idfTable(E) { const df = new Map(); for (const { obs } of E.values()) for (const w of new Set(obs.join(" ").toLowerCase().split(/\W+/).filter(Boolean))) df.set(w, (df.get(w) ?? 0) + 1); return { df, N: E.size }; }
/** v2 baseline format: JSON of each ranked node with its observations. */
export const packV2 = (E, ids) => ids.map((id) => JSON.stringify({ name: id, type: E.get(id)?.type ?? "unknown", observations: E.get(id)?.obs ?? [] })).join("\n");
export function packV3(E, ids, { dedupe = true, prune = true, pack = true, sink = 0, idf, maxDf = 0.2 } = {}) {
  const seen = new Set(); const groups = new Map();
  ids.forEach((id, i) => {
    const e = E.get(id) ?? { type: "unknown", obs: [] }; let obs = e.obs;
    if (dedupe) obs = obs.filter((o) => { const k = o.toLowerCase().trim(); if (seen.has(k)) return false; seen.add(k); return true; });
    let text = obs.join("; ");
    if (prune && idf) text = text.split(/\s+/).filter((w) => { const l = w.toLowerCase().replace(/\W+/g, ""); return l && !STOP.has(l) && (/[A-Z0-9\/_.-]/.test(w) || (idf.df.get(l) ?? 0) / idf.N <= maxDf); }).join(" ");
    if (sink && i > 0) text = text.split(/\s+/).slice(0, sink).join(" ");
    const line = pack ? `${id}${text ? ": " + text : ""}` : JSON.stringify({ name: id, type: e.type, observations: text });
    if (!groups.has(e.type)) groups.set(e.type, []); groups.get(e.type).push(line);
  });
  return pack ? [...groups].map(([t, L]) => `# ${t}\n${L.join("\n")}`).join("\n") : [...groups.values()].flat().join("\n");
}
/** Greedy: include ranked items in order while the packed text fits `budget` tokens. */
export function fitBudget(packFn, ids, budget) { let n = 0; while (n < ids.length && tokens(packFn(ids.slice(0, n + 1))) <= budget) n++; return ids.slice(0, Math.max(1, n)); }
