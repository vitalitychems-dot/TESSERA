import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { DISCLAIMER, exportSnapshot } from "./export-snapshot.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(here, "fixtures/memory-index.sample.jsonl");
const fixture = readFileSync(fixturePath, "utf8");
const committedPath = path.join(here, "../../artifacts/console/public/brain-snapshot.json");

test("fixture export counts nodes and edges", () => {
  const snapshot = exportSnapshot(fixture, { source: "scripts/brain/fixtures/memory-index.sample.jsonl" });
  assert.equal(snapshot.disclaimer, DISCLAIMER);
  assert.equal(snapshot.sampleFixture, true);
  assert.equal(snapshot.counts.nodes, 4);
  assert.equal(snapshot.counts.edges, 3);
  assert.equal(snapshot.counts.links, 2);
  assert.equal(snapshot.counts.recalls, 1);
  assert.equal(snapshot.nodes.length, snapshot.counts.nodes);
  assert.equal(snapshot.edges.length, snapshot.counts.edges);
  assert.deepEqual(
    snapshot.nodes.map((node) => [node.id, node.kind, node.recalls]),
    [
      ["TESSERA_v2", "card", 0],
      ["cap_api_adapters", "card", 0],
      ["cap_chamber_board_ui", "facet", 1],
      ["water", "facet", 1],
    ],
  );
  assert.deepEqual(snapshot.edges, [
    { source: "TESSERA_v2", target: "cap_chamber_board_ui", kind: "link", recalls: 0, links: 1 },
    { source: "cap_chamber_board_ui", target: "water", kind: "link", recalls: 0, links: 1 },
    { source: "cap_chamber_board_ui", target: "water", kind: "recall", recalls: 1 },
  ]);
  assert.equal(JSON.stringify(snapshot).includes("collink1007"), false);
  const committed = JSON.parse(readFileSync(committedPath, "utf8"));
  assert.deepEqual(committed, snapshot);
});

test("cli writes the fixture counts", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "brain-export-"));
  const output = path.join(dir, "out.json");
  try {
    const result = spawnSync(process.execPath, [
      path.join(here, "export-snapshot.mjs"),
      "--input",
      fixturePath,
      "--output",
      output,
    ], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    const written = JSON.parse(readFileSync(output, "utf8"));
    assert.equal(written.counts.nodes, 4);
    assert.equal(written.counts.edges, 3);
    assert.equal(written.counts.links, 2);
    assert.equal(written.counts.recalls, 1);
    assert.equal(written.disclaimer, DISCLAIMER);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
