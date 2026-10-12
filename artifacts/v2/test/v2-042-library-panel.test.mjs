import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadGraph, loadGraphFile } from "../src/knowledge/graph.mjs";
import { libraryNodes, renderLibrary } from "../src/knowledge/library.mjs";

test("the library panel renders task and doc nodes and calls no enricher", () => {
  const source = readFileSync(new URL("../src/knowledge/library.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /hunter|snusbase|pipl|clearbit|osint|fetch\(/i);

  const fixture = loadGraph(
    [
      JSON.stringify({ type: "entity", name: "Write the note", entityType: "task", observations: ["draft only"] }),
      JSON.stringify({ type: "entity", name: "Offline page", entityType: "doc", observations: ["summary link"] }),
    ].join("\n"),
  );
  const html = renderLibrary(fixture);
  assert.match(html, /data-kind="task"/);
  assert.match(html, /data-kind="doc"/);
  assert.match(html, /Write the note/);
  assert.match(html, /Offline page/);

  const live = libraryNodes(loadGraphFile(new URL("../../../docs/v2/v2-memory.jsonl", import.meta.url)));
  assert.ok(live.some((node) => node.kind === "task"));
  assert.ok(live.some((node) => node.kind === "doc"));
});
