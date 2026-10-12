import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runGoal, simPen } from "../src/studio/planner.mjs";

test("the sim pen finishes a two-task goal", async () => {
  let calls = 0;
  const pen = {
    name: "sim-hook",
    async complete(prompt) {
      calls += 1;
      assert.match(prompt, /^Plan: /);
      return simPen().complete(prompt);
    },
  };
  const snap = await runGoal("open the studio", pen);
  assert.equal(calls, 1);
  assert.equal(snap.tasks.length, 2);
  assert.ok(snap.tasks.every((task) => task.status === "done"));
  assert.deepEqual(snap.tasks[1].dependsOn, ["t1"]);
});

test("the first twenty merges are written in the build log", () => {
  const log = readFileSync(new URL("../../../docs/v2/BUILD-LOG.md", import.meta.url), "utf8");
  const shas = log.match(/`[0-9a-f]{40}`/g) ?? [];
  assert.equal(shas.length, 20);
  assert.match(log, /V2-015/);
  assert.match(log, /V2-027/);
  assert.match(log, /914cb6a5a551c88e3e323d47015663e647693be0/);
});
