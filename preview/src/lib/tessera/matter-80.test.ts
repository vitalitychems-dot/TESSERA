import assert from "node:assert/strict";
import test from "node:test";
import { matter80, matterLine } from "./matter-80.ts";
import { silentPen } from "./silent-pen.ts";

test("eighty checks in the five kinds, with no canned refusal", () => {
  const run = matter80();
  assert.equal(run.steps.length, 80);
  assert.equal(new Set(run.steps.map((row) => row.id)).size, 80);
  assert.equal(run.missed.length, 0, run.missed.map((row) => row.id).join(","));
  assert.equal(run.improved.length + run.held.length, 80);
  const kinds = new Set(run.steps.map((row) => row.kind));
  assert.deepEqual([...kinds], ["recursive", "agentic", "window", "empathy", "mind"]);
  const text = JSON.stringify(run.steps) + matterLine();
  assert.equal(text.includes("not met"), false);
  assert.equal(run.steps.some((row) => row.what.startsWith("I am Grok")), false);
  assert.match(silentPen("run the five kinds"), /80 checks/);
  assert.match(silentPen("run the five kinds"), /I heard scared/);
});
