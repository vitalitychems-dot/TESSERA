/**
 * Grounded answers over the memory graph.
 * Rank with createRanker, then cite a node only when its observations overlap the
 * question (relation tokens, not the entity's own name) at or above a threshold.
 * Otherwise abstain. The threshold is not baked in from the test split: benchGrounded
 * holds out 20% of observations first, builds the ranker on what remains, and picks
 * the threshold on the dev half only.
 */
import { readFileSync } from "node:fs";
import { loadGraph, hebbian, coMentionEpisodes, decay } from "./synapse.mjs";
import { createRanker } from "./context.mjs";

const KV = /^([^:]{1,80}):\s*(.+)$/;
const toks = (s) => String(s ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export function parseQuestion(question) {
  const m = /^What is (.+)\?$/.exec(String(question ?? "").trim());
  if (!m) return null;
  const i = m[1].lastIndexOf(" of ");
  if (i <= 0) return null;
  return { relation: m[1].slice(0, i), entity: m[1].slice(i + 4) };
}

function valuesFor(list, relation) {
  const rel = norm(relation);
  const out = [];
  for (const raw of list ?? []) {
    const o = String(raw);
    const m = KV.exec(o);
    if (rel === "note") { if (!m) out.push(o.trim()); }
    else if (m && norm(m[1]) === rel) out.push(m[2].trim());
  }
  return out;
}

/** Share of question tokens, minus the entity name and the template word, found in a node. */
export function overlapEvidence(question, entity, name, list) {
  const skip = new Set(toks(entity));
  skip.add("what");
  const q = [];
  for (const w of toks(question)) if (!skip.has(w) && !q.includes(w)) q.push(w);
  if (!q.length) return 0;
  const n = new Set(toks(`${name} ${(list ?? []).join(" ")}`));
  let hit = 0;
  for (const w of q) if (n.has(w)) hit++;
  return hit / q.length;
}

function supports(list, relation, answer) {
  const want = norm(answer);
  return valuesFor(list, relation).some((v) => norm(v) === want);
}

const abstain = () => ({ abstain: true, answer: null, citations: [], claims: [] });

function fallbackNode(g, obs) {
  let best = null;
  let n = -1;
  const names = new Set([...g.nodes.keys(), ...obs.keys()]);
  for (const name of names) {
    const c = (obs.get(name) ?? []).length;
    if (c > n || (c === n && (best === null || name < best))) { best = name; n = c; }
  }
  return best;
}

function candidates(rank, obs, entity, relation, question, k) {
  const names = [];
  if (obs.has(entity)) names.push(entity);
  if (rank) for (const n of rank(entity, k)) if (!names.includes(n)) names.push(n);
  const out = [];
  for (const name of names) {
    const list = obs.get(name) ?? [];
    const values = valuesFor(list, relation);
    if (!values.length) continue;
    out.push({ name, value: values[0], overlap: overlapEvidence(question, entity, name, list) });
  }
  return out;
}

/**
 * Answer from the memory graph. `observations` is a Map of node name -> remaining
 * observation strings (the same strings loadGraph folded into node text).
 * Returns { abstain, answer, citations, claims }.
 */
export function createGroundedAnswerer(g, observations, { threshold = 0.2, k = 12 } = {}) {
  const obs = observations instanceof Map ? observations : new Map(Object.entries(observations ?? {}));
  const rank = createRanker(g);
  const state = { threshold, k };
  function answer(question) {
    const parsed = parseQuestion(question);
    if (!parsed) return abstain();
    const { relation, entity } = parsed;
    if (!g.nodes.has(entity)) return abstain();
    const ok = candidates(rank, obs, entity, relation, question, state.k).filter((c) => c.overlap >= state.threshold);
    if (!ok.length) return abstain();
    ok.sort((a, b) => b.overlap - a.overlap || (a.name < b.name ? -1 : 1));
    const best = ok[0];
    const citations = ok.filter((c) => norm(c.value) === norm(best.value)).map((c) => c.name).sort();
    return {
      abstain: false,
      answer: best.value,
      citations,
      claims: [{ text: best.value, relation, entity, citations: [...citations] }],
    };
  }
  answer.setThreshold = (threshold) => { state.threshold = threshold; };
  return answer;
}

/** Before: always answer from the ranker's top-1 node (or a deterministic fallback). */
export function createTop1Answerer(g, observations, { k = 1 } = {}) {
  const obs = observations instanceof Map ? observations : new Map(Object.entries(observations ?? {}));
  const rank = createRanker(g);
  const fallback = fallbackNode(g, obs);
  return function answer(question) {
    const parsed = parseQuestion(question);
    if (!parsed) return abstain();
    const { relation, entity } = parsed;
    const name = g.nodes.has(entity) ? (rank(entity, k)[0] ?? fallback) : fallback;
    if (!name) return abstain();
    const values = valuesFor(obs.get(name), relation);
    const text = values[0] ?? name;
    return {
      abstain: false,
      answer: text,
      citations: [name],
      claims: [{ text, relation, entity, citations: [name] }],
    };
  };
}

function scoreAnswers(rows, answer, obs) {
  let claims = 0;
  let unsupported = 0;
  let correct = 0;
  for (const q of rows) {
    const out = answer(q.question);
    if (out.abstain) continue;
    claims++;
    const supported = out.claims.length > 0 && out.claims.every((c) => c.citations.length > 0 && c.citations.some((n) => supports(obs.get(n), c.relation, c.text)));
    if (!supported) unsupported++;
    if (q.answerable && norm(out.answer) === norm(q.gold)) correct++;
  }
  return {
    claims,
    unsupported,
    unsupportedClaimRate: claims ? +(unsupported / claims).toFixed(3) : 0,
    correct,
    answeredAccuracy: claims ? +(correct / claims).toFixed(3) : 0,
  };
}

function questionFrom(o, answerable) {
  const m = KV.exec(o.text);
  const relation = m ? m[1].trim() : "note";
  const gold = answerable ? (m ? m[2].trim() : o.text.trim()) : null;
  return { question: `What is ${relation} of ${o.entity}?`, entity: o.entity, relation, gold, answerable };
}

/**
 * Held-out QA on a full-picture memory JSONL.
 * 20% of observations (every 5th, file order) are turned into questions BEFORE the
 * ranker is built, and those strings are removed from the graph. An equal number
 * ask about entities removed from the graph (unanswerable). Dev = even index in
 * each pool; the threshold grid is scored on dev only.
 */
export function benchGrounded(jsonl) {
  const lines = String(jsonl).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const flat = [];
  lines.forEach((r, line) => {
    if (r.type === "entity") (r.observations ?? []).forEach((o, index) => flat.push({ line, index, entity: r.name, text: String(o) }));
  });
  const held = flat.filter((_, i) => i % 5 === 0);
  const count = new Map();
  for (const o of held) count.set(o.entity, (count.get(o.entity) ?? 0) + 1);
  const order = [...count.keys()].sort((a, b) => count.get(a) - count.get(b) || (a < b ? -1 : 1));
  const removed = new Set();
  let removedFacts = 0;
  for (const name of order) {
    const c = count.get(name);
    if (removedFacts + c <= held.length - removedFacts - c) { removed.add(name); removedFacts += c; }
  }
  let answerable = held.filter((o) => !removed.has(o.entity)).map((o) => questionFrom(o, true));
  let unanswerable = held.filter((o) => removed.has(o.entity)).map((o) => questionFrom(o, false));
  const n = Math.min(answerable.length, unanswerable.length);
  answerable = answerable.slice(0, n);
  unanswerable = unanswerable.slice(0, n);
  const hide = new Set(held.filter((o) => !removed.has(o.entity)).slice(0, n).map((o) => `${o.line}:${o.index}`));
  const observations = new Map();
  const kept = [];
  for (let line = 0; line < lines.length; line++) {
    const r = lines[line];
    if (r.type === "entity") {
      if (removed.has(r.name)) continue;
      const left = [];
      (r.observations ?? []).forEach((o, index) => { if (!hide.has(`${line}:${index}`)) left.push(String(o)); });
      observations.set(r.name, left);
      kept.push({ ...r, observations: left });
    } else if (r.type === "relation" && !removed.has(r.from) && !removed.has(r.to)) kept.push(r);
  }
  const g = loadGraph(kept.map((r) => JSON.stringify(r)).join("\n"));
  for (const e of coMentionEpisodes(g)) hebbian(g, e);
  decay(g, { factor: 0.95, floor: 0.05 });
  const dev = [];
  const test = [];
  for (const pool of [answerable, unanswerable]) pool.forEach((q, i) => (i % 2 === 0 ? dev : test).push(q));
  const grounded = createGroundedAnswerer(g, observations);
  const top1 = createTop1Answerer(g, observations);
  const grid = [];
  for (let t = 0; t <= 0.9; t += 0.05) grid.push(+t.toFixed(2));
  let best = null;
  for (const threshold of grid) {
    grounded.setThreshold(threshold);
    const m = scoreAnswers(dev, grounded, observations);
    const key = [m.answeredAccuracy, m.correct, -threshold];
    if (!best || key[0] > best.key[0] || (key[0] === best.key[0] && (key[1] > best.key[1] || (key[1] === best.key[1] && key[2] > best.key[2])))) best = { threshold, dev: m, key };
  }
  grounded.setThreshold(best.threshold);
  const beforeDev = scoreAnswers(dev, top1, observations);
  return {
    heldOutObservations: held.length,
    answerable: answerable.length,
    unanswerable: unanswerable.length,
    removedEntities: removed.size,
    threshold: best.threshold,
    dev: { before: beforeDev, after: best.dev },
    test: { before: scoreAnswers(test, top1, observations), after: scoreAnswers(test, grounded, observations) },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(JSON.stringify(benchGrounded(readFileSync(process.argv[2], "utf8")), null, 1));
}
