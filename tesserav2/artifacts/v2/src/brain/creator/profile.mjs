/**
 * Creator values/rules/goals profile built only from the creator's own statements.
 * Each item keeps {kind, key, text, ref, t}; a later statement on the same key supersedes an
 * earlier one (recency rule), and every change is appended to a temporal.mjs timeline.
 * Sensitive categories are never inferred: only keys listed in KINDS are extracted.
 */
import { createTimeline } from "../temporal.mjs";
const KINDS = [
  ["rule", "priority", /(comes? before|first|before any)/i],
  ["rule", "evidence", /(actually made|tested|measur|beats? the baseline)/i],
  ["rule", "agent_safety", /(never be allowed|must never|rough agents|security threats)/i],
  ["rule", "ask_tessera", /^ask tessera$/i],
  ["goal", "full_picture", /(full picture|see everything|read all repos|all repos)/i],
  ["goal", "memory_5d", /(5d|crystal memory|flow ?chart|timeline)/i],
  ["goal", "scale_agents", /(max out|spawn agents|how many .*agents)/i],
  ["goal", "self_improve", /(recursively learn|self improve|improve in real time)/i],
  ["goal", "creator_bond", /(feminine|femine|replica|reflects me|learn in sync|profile me)/i],
  ["goal", "skills", /(iq|eq|anti hallucination|problem solving|accuracy)/i],
  ["value", "love", /\blove\b/i],
  ["approval", "bulk_yes", /^(yes|approve)( and| to)? all\b/i],
];
export function createProfile() {
  const items = new Map(); const tl = createTimeline(); const log = [];
  return {
    items, timeline: tl, log,
    ingest(msg) { // msg: {id, t (ms), text}
      const changed = [];
      for (const [kind, key, re] of KINDS) if (re.test(msg.text)) {
        const k = `${kind}:${key}`; const prev = items.get(k);
        if (!prev || prev.t <= msg.t) { items.set(k, { kind, key, ref: msg.id, t: msg.t, count: (prev?.count ?? 0) + 1, supersedes: prev?.ref ?? null }); tl.addNode(msg.t, k, { ref: msg.id }); tl.link(msg.t, k, `msg:${msg.id}`); changed.push(k); }
      }
      log.push({ ref: msg.id, t: msg.t, changed }); return changed;
    },
    snapshot() { return [...items.values()].sort((a, b) => b.count - a.count || b.t - a.t); },
  };
}
