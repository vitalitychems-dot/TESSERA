/**
 * IDEAS-B1-06 connectome synapse templates. Each template is a real, aggregated open
 * connectome (region or cell level). Memory modules (label propagation on the memory graph)
 * are mapped onto template regions by rank of size; a seed's region spreads activation over
 * the template's normalized synapse matrix (2 steps; inhibitory synapses subtract), and the
 * result boosts link recall. randomTemplate() gives a same-density, same-weight null model.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { connectome, predict } from "./synapse.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
export const TEMPLATES = {
  human: { file: "human_hcp.json", species: "Human cortex (HCP-MMP1.0, 360 parcels)", license: "CC BY 4.0; Rosen & Halgren, eNeuro 2021 8(1) ENEURO.0416-20.2020, Zenodo 10.5281/zenodo.10150880; HCP-MMP1.0 Glasser et al. Nature 2016; HCP data use terms" },
  celegans: { file: "celegans.json", species: "C. elegans (whole animal)", license: "Data: Cook et al. 2019 Nature 571:63, via OpenWorm ConnectomeToolbox (MIT code); cite Cook 2019" },
  hemibrain: { file: "hemibrain.json", species: "Drosophila (central brain, partial)", license: "Hemibrain v1.2, FlyEM/HHMI Janelia, CC BY 4.0; Scheffer et al. eLife 2020;9:e57443" },
  flywire: { file: "flywire.json", species: "Drosophila (whole brain)", license: "FlyWire FAFB v783, CC BY 4.0; Dorkenwald et al. Nature 2024; Schlegel et al. Nature 2024" },
  gpt2: { file: "gpt2.json", species: "artificial model (not a brain)", kind: "weights", license: "GPT-2 small weights, OpenAI, MIT (openai-community/gpt2 model.safetensors, byte-range slice of h.0.mlp)" },
};
export function loadTemplate(name, dir = join(HERE, "connectomes")) {
  const t = JSON.parse(readFileSync(join(dir, TEMPLATES[name].file), "utf8"));
  return { ...t, key: name, species: TEMPLATES[name].species, kind: TEMPLATES[name].kind ?? "connectome", license: TEMPLATES[name].license };
}
/** Same node count, same edge count, same weight multiset, random endpoints (seeded). */
export function randomTemplate(t, seed = 11) {
  let x = seed >>> 0; const r = () => ((x = (x * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const nodes = [...new Set(t.edges.flatMap((e) => [e.from, e.to]))]; const seen = new Set(); const edges = [];
  for (const e of t.edges) {
    let a, b, k; do { a = nodes[Math.floor(r() * nodes.length)]; b = nodes[Math.floor(r() * nodes.length)]; k = a + "\u0000" + b; } while (seen.has(k));
    seen.add(k); edges.push({ ...e, from: a, to: b });
  }
  return { ...t, name: `${t.name} (random null)`, edges };
}
/** Spread matrix S[r] = Map(region -> activation) after 2 steps from r over row-normalized net weight. */
function spread(t) {
  const out = new Map(); const tot = new Map();
  const E = t.undirected ? t.edges.flatMap((e) => [e, { ...e, from: e.to, to: e.from }]) : t.edges;
  for (const e of E) { const w = e.syn - 2 * e.inh; (out.get(e.from) ?? out.set(e.from, new Map()).get(e.from)).set(e.to, w); tot.set(e.from, (tot.get(e.from) ?? 0) + e.syn); }
  const step = (v) => { const n = new Map(); for (const [r, a] of v) for (const [m, w] of out.get(r) ?? []) n.set(m, (n.get(m) ?? 0) + a * w / (tot.get(r) || 1)); return n; };
  const S = new Map();
  for (const r of out.keys()) { const s1 = step(new Map([[r, 1]])); const s2 = step(s1); const m = new Map(s1); for (const [k, v] of s2) m.set(k, (m.get(k) ?? 0) + 0.5 * v); S.set(r, m); }
  return S;
}
/** Map memory modules -> template regions by size rank (largest module -> busiest region). */
export function mapRegions(g, t) {
  const c = connectome(g); const size = new Map(); for (const m of c.label.values()) size.set(m, (size.get(m) ?? 0) + 1);
  const busy = new Map(); for (const e of t.edges) { busy.set(e.from, (busy.get(e.from) ?? 0) + e.syn); busy.set(e.to, (busy.get(e.to) ?? 0) + e.syn); }
  const regions = [...busy].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([r]) => r);
  const mods = [...size].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([m]) => m);
  const m2r = new Map(mods.map((m, i) => [m, regions[i % regions.length]]));
  return new Map([...c.label].map(([n, m]) => [n, m2r.get(m)]));
}
/** Recall with a template prior: base predict() candidates (top 50) re-scored by region spread. */
export function templatePredictor(g, t, { lambda = 1, pool = 50 } = {}) {
  const region = mapRegions(g, t); const S = spread(t);
  return (seed, k = 5) => {
    const cand = predict(g, seed, pool); const R = S.get(region.get(seed)) ?? new Map();
    const max = Math.max(1e-9, ...[...R.values()].map(Math.abs));
    return cand.map((n, i) => [n, (pool - i) / pool + lambda * ((R.get(region.get(n)) ?? 0) / max)]).sort((a, b) => b[1] - a[1]).slice(0, k).map(([n]) => n);
  };
}
