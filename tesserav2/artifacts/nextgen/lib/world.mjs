// Tessera next-gen data layer. Every payload is derived from real repo state:
// the memory graph (docs/v2/v2-memory.jsonl via console/lib/sources.mjs) and the
// in-process AGI modules in artifacts/api-server/src/lib/agi. No mock data.
import { existsSync } from "node:fs";
import path from "node:path";
import { brainPayload, repoRoot } from "../../console/lib/sources.mjs";

export const THREE_PATH = path.join(repoRoot, "artifacts/v2/node_modules/three/build/three.module.js");
export const threeAvailable = () => existsSync(THREE_PATH);

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Voxel world: one column per memory node; column height = node degree
 * (relations + synapses) at time t; block "material" = node type. */
export function worldPayload(t) {
  const b = brainPayload(t);
  const degree = new Map();
  for (const e of [...b.relations, ...b.synapses]) {
    degree.set(e.a, (degree.get(e.a) ?? 0) + 1);
    degree.set(e.b, (degree.get(e.b) ?? 0) + 1);
  }
  const side = Math.max(4, Math.ceil(Math.sqrt(b.nodes.length)) + 2);
  const used = new Set();
  const columns = b.nodes.map((n) => {
    let slot = hash(n.id) % (side * side);
    while (used.has(slot)) slot = (slot + 1) % (side * side);
    used.add(slot);
    return { id: n.id, type: n.type, x: slot % side, z: Math.floor(slot / side), h: 1 + Math.min(24, degree.get(n.id) ?? 0) };
  });
  const types = [...new Set(columns.map((c) => c.type))].sort();
  return {
    source: b.source,
    derivation: "column per memory node; height = 1 + degree (relations + top synapses) at time t",
    t: b.t,
    events: b.events,
    side,
    types,
    blocks: columns.reduce((s, c) => s + c.h, 0),
    columns,
  };
}

/** Global-workspace view: the candidates REA-06 would weigh right now, read-only
 * (does not call broadcastWinner, so it never mutates inhibition state). */
export async function workspacePayload() {
  const bus = await import("../../api-server/src/lib/agi/agent-bus.ts");
  const candidates = bus.pullTopK(10, undefined, 60_000).map((m) => ({ id: m.id, from: m.from, topic: m.topic, attention: m.attention }));
  return {
    source: "artifacts/api-server/src/lib/agi/{agent-bus,global-workspace}.ts",
    candidates,
    leader: candidates[0] ?? null,
    metacognition: "NOT WIRED: metacognition.ts pulls llm-batcher (type-only import breaks under node strip mode); read via api-server GET /api/agi/metacognition (GOAL)",
    note: candidates.length ? "" : "Bus is empty in this process. NOT WIRED: live api-server state needs a /api/agi/snapshot proxy (GOAL).",
  };
}
