import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

export const DISCLAIMER = "Visualization of TESSERA's memory index (snapshot), not a model of her mind.";
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pair = (a, b) => (a < b ? [a, b] : [b, a]);
const idOk = (value) => typeof value === "string" && value.length > 0 && !value.includes("\0");
const facet = (entity) => entity.entityType.toLowerCase() === "facet" || entity.observations.some((line) => line.toLowerCase().startsWith("category:ui"));

/**
 * Recall matching is a case-insensitive substring match, so it can give false
 * positives (e.g. "water" matches "underwater"). Mentions in both directions
 * collapse into one edge.
 */
export function exportSnapshot(jsonl, { source = "" } = {}) {
  const entities = new Map();
  const links = new Map();
  for (const line of String(jsonl).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row;
    try { row = JSON.parse(trimmed); } catch { continue; }
    if (row === null || typeof row !== "object" || Array.isArray(row)) continue;
    if (row.type === "entity" && idOk(row.name)) {
      entities.set(row.name, {
        entityType: typeof row.entityType === "string" ? row.entityType : "",
        observations: Array.isArray(row.observations) ? row.observations.filter((item) => typeof item === "string") : [],
      });
    } else if (row.type === "relation" && idOk(row.from) && idOk(row.to) && row.from !== row.to) {
      for (const name of [row.from, row.to]) if (!entities.has(name)) entities.set(name, { entityType: "", observations: [] });
      const [left, right] = pair(row.from, row.to);
      links.set(`${left}\0${right}`, (links.get(`${left}\0${right}`) ?? 0) + 1);
    }
  }
  const names = [...entities.keys()].filter((name) => name.length >= 4);
  const lower = names.map((name) => name.toLowerCase());
  const recalls = new Map();
  for (const [name, entity] of entities) {
    const text = `${name} ${entity.observations.join(" ")}`.toLowerCase();
    for (let i = 0; i < names.length; i += 1) {
      if (names[i] === name || !text.includes(lower[i])) continue;
      const [left, right] = pair(name, names[i]);
      recalls.set(`${left}\0${right}`, (recalls.get(`${left}\0${right}`) ?? 0) + 1);
    }
  }
  const nodeRecalls = new Map();
  for (const [key, count] of recalls) for (const name of key.split("\0")) nodeRecalls.set(name, (nodeRecalls.get(name) ?? 0) + count);
  const nodes = [...entities.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map((id) => {
    const entity = entities.get(id);
    return { id, kind: facet(entity) ? "facet" : "card", entityType: entity.entityType, recalls: nodeRecalls.get(id) ?? 0 };
  });
  const edges = [
    ...[...links].map(([key, count]) => { const [source, target] = key.split("\0"); return { source, target, kind: "link", recalls: 0, links: count }; }),
    ...[...recalls].map(([key, count]) => { const [source, target] = key.split("\0"); return { source, target, kind: "recall", recalls: count }; }),
  ].sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : a.source < b.source ? -1 : a.source > b.source ? 1 : a.target < b.target ? -1 : a.target > b.target ? 1 : 0));
  return {
    disclaimer: DISCLAIMER, source, sampleFixture: source.includes("fixtures/"), nodes, edges,
    counts: { nodes: nodes.length, edges: edges.length, links: edges.filter((edge) => edge.kind === "link").length, recalls: edges.filter((edge) => edge.kind === "recall").length },
  };
}

export function repoRelative(filePath) {
  const relative = path.relative(repoRoot, path.resolve(filePath));
  if (relative.startsWith("..") || path.isAbsolute(relative)) return path.basename(filePath);
  return relative.split(path.sep).join("/");
}

export function writeSnapshot(input, output) {
  const snapshot = exportSnapshot(readFileSync(input, "utf8"), { source: repoRelative(input) });
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(snapshot)}\n`);
  return snapshot;
}

function parseArgs(argv) {
  let input = path.join(repoRoot, "docs/v2/v2-memory.jsonl");
  let output = path.join(repoRoot, "artifacts/console/public/brain-snapshot.json");
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--input") {
      const value = argv[++i];
      if (!value) {
        console.error("error: --input requires a path");
        process.exit(1);
      }
      input = path.resolve(value);
    } else if (argv[i] === "--output") {
      const value = argv[++i];
      if (!value) {
        console.error("error: --output requires a path");
        process.exit(1);
      }
      output = path.resolve(value);
    }
  }
  return { input, output };
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (!process.env.NODE_TEST_CONTEXT && entry === fileURLToPath(import.meta.url)) {
  const { input, output } = parseArgs(process.argv.slice(2));
  const snapshot = writeSnapshot(input, output);
  console.log(`${repoRelative(output)} nodes=${snapshot.counts.nodes} edges=${snapshot.counts.edges}`);
}

if (process.env.NODE_TEST_CONTEXT) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fixturePath = path.join(here, "fixtures/memory-index.sample.jsonl");
  const committedPath = path.join(here, "../../artifacts/console/public/brain-snapshot.json");
  test("fixture export counts nodes and edges", () => {
    const snapshot = exportSnapshot(readFileSync(fixturePath, "utf8"), { source: "scripts/brain/fixtures/memory-index.sample.jsonl" });
    assert.equal(snapshot.disclaimer, DISCLAIMER);
    assert.equal(snapshot.sampleFixture, true);
    assert.equal(snapshot.counts.nodes, 4);
    assert.equal(snapshot.counts.edges, 3);
    assert.equal(snapshot.counts.links, 2);
    assert.equal(snapshot.counts.recalls, 1);
    assert.deepEqual(snapshot.nodes.map((node) => [node.id, node.kind, node.recalls]), [
      ["TESSERA_v2", "card", 0], ["cap_api_adapters", "card", 0], ["cap_chamber_board_ui", "facet", 1], ["water", "facet", 1],
    ]);
    assert.deepEqual(snapshot.edges, [
      { source: "TESSERA_v2", target: "cap_chamber_board_ui", kind: "link", recalls: 0, links: 1 },
      { source: "cap_chamber_board_ui", target: "water", kind: "link", recalls: 0, links: 1 },
      { source: "cap_chamber_board_ui", target: "water", kind: "recall", recalls: 1 },
    ]);
    assert.equal(JSON.stringify(snapshot).includes("collink1007"), false);
    assert.deepEqual(JSON.parse(readFileSync(committedPath, "utf8")), snapshot);
  });
  test("cli writes the fixture counts", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "brain-export-"));
    const output = path.join(dir, "out.json");
    try {
      const env = { ...process.env };
      delete env.NODE_TEST_CONTEXT;
      const result = spawnSync(process.execPath, [path.join(here, "export-snapshot.mjs"), "--input", fixturePath, "--output", output], { encoding: "utf8", env });
      assert.equal(result.status, 0, result.stderr);
      const written = JSON.parse(readFileSync(output, "utf8"));
      assert.equal(written.counts.nodes, 4);
      assert.equal(written.counts.edges, 3);
      assert.equal(written.disclaimer, DISCLAIMER);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  test("null line is skipped", () => {
    const snapshot = exportSnapshot('null\n{"type":"entity","name":"water","entityType":"facet","observations":[]}\n');
    assert.deepEqual(snapshot.nodes.map((node) => node.id), ["water"]);
  });
  test("array line is skipped", () => {
    const snapshot = exportSnapshot('[{"type":"entity","name":"water"}]\n');
    assert.equal(snapshot.counts.nodes, 0);
    assert.equal(snapshot.counts.edges, 0);
  });
  test("object from is rejected", () => {
    const snapshot = exportSnapshot('{"type":"relation","from":{"id":"water"},"to":"cap_chamber_board_ui"}\n');
    assert.equal(snapshot.counts.nodes, 0);
    assert.equal(snapshot.counts.edges, 0);
  });
  test("id containing NUL is rejected", () => {
    const snapshot = exportSnapshot('{"type":"entity","name":"bad\\u0000id","entityType":"card","observations":[]}\n{"type":"relation","from":"water\\u0000x","to":"cap_chamber_board_ui"}\n');
    assert.equal(snapshot.counts.nodes, 0);
    assert.equal(snapshot.counts.edges, 0);
    assert.equal(JSON.stringify(snapshot).includes("\0"), false);
  });
  test("source outside the repo is the basename", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "brain-basename-"));
    const input = path.join(dir, "local-memory.jsonl");
    const output = path.join(dir, "out.json");
    try {
      writeFileSync(input, '{"type":"entity","name":"water","entityType":"facet","observations":[]}\n');
      const snapshot = writeSnapshot(input, output);
      assert.equal(snapshot.source, "local-memory.jsonl");
      assert.equal(JSON.stringify(snapshot).includes(dir), false);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  test("bare --output exits nonzero", () => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [path.join(here, "export-snapshot.mjs"), "--output"], { encoding: "utf8", env });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--output requires a path/);
  });
  test("bare --input exits nonzero", () => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [path.join(here, "export-snapshot.mjs"), "--input"], { encoding: "utf8", env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /--input requires a path/);
  });
}
