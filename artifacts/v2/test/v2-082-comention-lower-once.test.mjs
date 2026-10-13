import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadGraph, coMentionEpisodes } from "../src/brain/synapse.mjs";

/** R4-23 reference: the pre-change filter that lowercased every name once per node. */
function coMentionReference(g, { minLen = 4 } = {}) {
  const names = [...g.nodes.keys()].filter((n) => n.length >= minLen);
  const eps = [];
  for (const [n, v] of g.nodes) { const hit = names.filter((m) => m !== n && v.text?.includes(m.toLowerCase())); if (hit.length) eps.push([n, ...hit]); }
  return eps;
}

test("R4-23: co-mention episodes are unchanged when names are lowercased once", () => {
  const g = loadGraph(readFileSync(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url), "utf8"));
  for (const minLen of [2, 4, 8]) assert.deepEqual(coMentionEpisodes(g, { minLen }), coMentionReference(g, { minLen }));
  g.nodes.set("NoText", { type: "unknown", obs: 0 });
  assert.deepEqual(coMentionEpisodes(g), coMentionReference(g));
});
