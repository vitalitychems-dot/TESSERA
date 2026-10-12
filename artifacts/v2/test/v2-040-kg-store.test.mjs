import assert from "node:assert/strict";
import test from "node:test";
import { loadGraphFile, openNodes } from "../src/knowledge/graph.mjs";

test("open_nodes returns observations for an entity name", () => {
  const graph = loadGraphFile(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url));
  const opened = openNodes(graph, ["TESSERA_v2"]);
  assert.equal(opened.entities.length, 1);
  assert.equal(opened.entities[0].name, "TESSERA_v2");
  assert.ok(opened.entities[0].observations.some((line) => line.includes("vitalitychems-dot/TESSERA")));
  assert.ok(opened.relations.some((rel) => rel.from === "TESSERA_v2"));
  const missing = openNodes(graph, ["not-a-node"]);
  assert.deepEqual(missing.entities, []);
});
