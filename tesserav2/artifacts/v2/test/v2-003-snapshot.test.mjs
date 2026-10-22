import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../../../", import.meta.url);

function read(rel) {
  return readFileSync(new URL(rel, root), "utf8");
}

test("vendored memory JSONL matches the MCP memory schema", () => {
  const lines = read("docs/v2/v2-memory.jsonl").trim().split(/\n/);
  assert.ok(lines.length > 10);
  let entities = 0;
  let relations = 0;
  for (const line of lines) {
    const row = JSON.parse(line);
    assert.ok(row.type === "entity" || row.type === "relation", line.slice(0, 80));
    if (row.type === "entity") {
      entities += 1;
      assert.equal(typeof row.name, "string");
      assert.equal(typeof row.entityType, "string");
      assert.ok(Array.isArray(row.observations));
      assert.ok(row.observations.every((item) => typeof item === "string"));
    } else {
      relations += 1;
      assert.equal(typeof row.from, "string");
      assert.equal(typeof row.to, "string");
      assert.equal(typeof row.relationType, "string");
    }
  }
  assert.ok(entities > 0);
  assert.ok(relations > 0);
  const summary = JSON.parse(read("docs/v2/feature-map-summary.json"));
  assert.equal(summary.memoryPointer, "docs/v2/v2-memory.jsonl");
  assert.equal(summary.memoryRecords, lines.length);
  assert.equal(summary.memoryTypes.entity, entities);
  assert.equal(summary.memoryTypes.relation, relations);
  assert.equal(summary.byInclude.y + summary.byInclude.n + summary.byInclude.excluded, summary.featureMapRows);
  assert.ok(summary.featureMapRows > 300);
  assert.match(read("docs/v2/README.md"), /v2-memory\.jsonl/);
});
