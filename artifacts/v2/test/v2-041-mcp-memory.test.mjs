import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadGraphFile, readGraph } from "../src/knowledge/graph.mjs";

test("the memory server config points at the vendored graph and read_graph is non-empty", () => {
  const config = JSON.parse(readFileSync(new URL("../../../docs/v2/mcp-memory.config.json", import.meta.url), "utf8"));
  const memory = config.mcpServers.memory;
  assert.equal(memory.command, "npx");
  assert.deepEqual(memory.args, ["-y", "@modelcontextprotocol/server-memory"]);
  assert.equal(memory.env.MEMORY_FILE_PATH, "docs/v2/v2-memory.jsonl");

  const graph = readGraph(loadGraphFile(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url)));
  assert.ok(graph.entities.length > 0);
  assert.ok(graph.entities.some((entity) => entity.name === "TESSERA_v2"));
});
