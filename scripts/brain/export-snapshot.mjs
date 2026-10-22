import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const DISCLAIMER = "Visualization of TESSERA's memory index (snapshot), not a model of her mind.";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function orderedPair(a, b) {
  return a < b ? [a, b] : [b, a];
}

function isFacet(entity) {
  if (entity.entityType.toLowerCase() === "facet") return true;
  return entity.observations.some((line) => line.toLowerCase().startsWith("category:ui"));
}

export function exportSnapshot(jsonl, { source = "" } = {}) {
  const entities = new Map();
  const linkCounts = new Map();
  for (const line of String(jsonl).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let row;
    try {
      row = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (row.type === "entity" && typeof row.name === "string" && row.name.length > 0) {
      const observations = Array.isArray(row.observations)
        ? row.observations.filter((item) => typeof item === "string")
        : [];
      entities.set(row.name, {
        entityType: typeof row.entityType === "string" ? row.entityType : "",
        observations,
      });
      continue;
    }
    if (row.type !== "relation" || typeof row.from !== "string" || typeof row.to !== "string") continue;
    if (!row.from || !row.to || row.from === row.to) continue;
    if (!entities.has(row.from)) entities.set(row.from, { entityType: "", observations: [] });
    if (!entities.has(row.to)) entities.set(row.to, { entityType: "", observations: [] });
    const [left, right] = orderedPair(row.from, row.to);
    const key = `${left}\0${right}`;
    linkCounts.set(key, (linkCounts.get(key) ?? 0) + 1);
  }

  const names = [...entities.keys()].filter((name) => name.length >= 4);
  const lower = names.map((name) => name.toLowerCase());
  const recallCounts = new Map();
  for (const [name, entity] of entities) {
    const text = `${name} ${entity.observations.join(" ")}`.toLowerCase();
    for (let i = 0; i < names.length; i += 1) {
      if (names[i] === name || !text.includes(lower[i])) continue;
      const [left, right] = orderedPair(name, names[i]);
      const key = `${left}\0${right}`;
      recallCounts.set(key, (recallCounts.get(key) ?? 0) + 1);
    }
  }

  const nodeRecalls = new Map();
  for (const [key, recalls] of recallCounts) {
    const [left, right] = key.split("\0");
    nodeRecalls.set(left, (nodeRecalls.get(left) ?? 0) + recalls);
    nodeRecalls.set(right, (nodeRecalls.get(right) ?? 0) + recalls);
  }

  const nodes = [...entities.keys()]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((id) => {
      const entity = entities.get(id);
      return {
        id,
        kind: isFacet(entity) ? "facet" : "card",
        entityType: entity.entityType,
        recalls: nodeRecalls.get(id) ?? 0,
      };
    });

  const edges = [];
  for (const [key, links] of linkCounts) {
    const [source, target] = key.split("\0");
    edges.push({ source, target, kind: "link", recalls: 0, links });
  }
  for (const [key, recalls] of recallCounts) {
    const [source, target] = key.split("\0");
    edges.push({ source, target, kind: "recall", recalls });
  }
  edges.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    if (a.source !== b.source) return a.source < b.source ? -1 : 1;
    if (a.target !== b.target) return a.target < b.target ? -1 : 1;
    return 0;
  });

  return {
    disclaimer: DISCLAIMER,
    source,
    sampleFixture: source.includes("fixtures/"),
    nodes,
    edges,
    counts: {
      nodes: nodes.length,
      edges: edges.length,
      links: edges.filter((edge) => edge.kind === "link").length,
      recalls: edges.filter((edge) => edge.kind === "recall").length,
    },
  };
}

export function repoRelative(filePath) {
  const absolute = path.resolve(filePath);
  const relative = path.relative(repoRoot, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return absolute.split(path.sep).join("/");
  return relative.split(path.sep).join("/");
}

export function writeSnapshot(input, output) {
  const jsonl = readFileSync(input, "utf8");
  const snapshot = exportSnapshot(jsonl, { source: repoRelative(input) });
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

function parseArgs(argv) {
  let input = path.join(repoRoot, "docs/v2/v2-memory.jsonl");
  let output = path.join(repoRoot, "artifacts/console/public/brain-snapshot.json");
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--input") {
      input = path.resolve(argv[i + 1] ?? "");
      i += 1;
    } else if (argv[i] === "--output") {
      output = path.resolve(argv[i + 1] ?? "");
      i += 1;
    }
  }
  return { input, output };
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url)) {
  const { input, output } = parseArgs(process.argv.slice(2));
  const snapshot = writeSnapshot(input, output);
  console.log(`${repoRelative(output)} nodes=${snapshot.counts.nodes} edges=${snapshot.counts.edges}`);
}
