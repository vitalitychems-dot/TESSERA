import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeBaseline } from "../src/token/meter.mjs";

test("a fixture task writes a token baseline", () => {
  const dir = mkdtempSync(join(tmpdir(), "tessera-meter-"));
  const file = join(dir, "metrics.json");
  try {
    const written = writeBaseline(file, {
      id: "fixture-task",
      prompt: "Describe the studio wall in one line.",
      success: true,
    });
    const saved = JSON.parse(readFileSync(file, "utf8"));
    assert.equal(saved.task, "fixture-task");
    assert.equal(saved.success, true);
    assert.equal(saved.tokens, written.tokens);
    assert.ok(saved.tokens > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
