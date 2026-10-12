import { readFileSync } from "node:fs";

export function loadGraph(jsonl) {
  const entities = new Map();
  const relations = [];
  for (const line of jsonl.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const row = JSON.parse(trimmed);
    if (row.type === "entity" && typeof row.name === "string") {
      entities.set(row.name, {
        name: row.name,
        entityType: row.entityType ?? "unknown",
        observations: Array.isArray(row.observations) ? row.observations.map(String) : [],
      });
    } else if (row.type === "relation") {
      relations.push({
        from: String(row.from),
        to: String(row.to),
        relationType: String(row.relationType),
      });
    }
  }
  return { entities, relations };
}

export function loadGraphFile(path) {
  return loadGraph(readFileSync(path, "utf8"));
}

/** MCP memory `open_nodes`: return the named entities and the relations that touch them. */
export function openNodes(graph, names) {
  const wanted = new Set(names);
  const entities = [];
  for (const name of names) {
    const entity = graph.entities.get(name);
    if (entity) entities.push(entity);
  }
  const relations = graph.relations.filter((rel) => wanted.has(rel.from) || wanted.has(rel.to));
  return { entities, relations };
}
