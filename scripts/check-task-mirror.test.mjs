import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  checkMirrorFile,
  defaultMirrorPath,
  validateTaskMirror,
} from "./check-task-mirror.mjs";

const scriptPath = fileURLToPath(new URL("./check-task-mirror.mjs", import.meta.url));

function sample(tasks) {
  return {
    source: "Gitbook mesh/queue/TASKS.json @ 2026-10-13, read-only mirror",
    schema: "mesh-queue/v1",
    rules: "fixture",
    tasks,
  };
}

test("the committed mirror has unique ids, allowed statuses, and scope arrays", () => {
  const result = checkMirrorFile(defaultMirrorPath);
  assert.deepEqual(result, { ok: true, errors: [] });
});

test("duplicate ids, unknown status, and a non-array scope fail", () => {
  const duplicate = validateTaskMirror(
    sample([
      { id: "Q-001", status: "queued", scope: ["a/"] },
      { id: "Q-001", status: "done", scope: ["b/"] },
    ]),
  );
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.errors.join("\n"), /duplicated/);

  const status = validateTaskMirror(
    sample([{ id: "Q-002", status: "open", scope: ["a/"] }]),
  );
  assert.equal(status.ok, false);
  assert.match(status.errors.join("\n"), /status must be one of/);

  const scope = validateTaskMirror(
    sample([{ id: "Q-003", status: "blocked", scope: "artifacts/v2/" }]),
  );
  assert.equal(scope.ok, false);
  assert.match(scope.errors.join("\n"), /scope must be an array/);
});

test("cli exits 0 for the committed mirror and non-zero for a bad file", () => {
  const good = spawnSync(process.execPath, [scriptPath], { encoding: "utf8" });
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /^ok tasks=\d+\n$/);

  const dir = mkdtempSync(join(tmpdir(), "task-mirror-"));
  const badPath = join(dir, "TASKS.mirror.json");
  writeFileSync(
    badPath,
    JSON.stringify(
      sample([
        { id: "Q-001", status: "queued", scope: ["a/"] },
        { id: "Q-001", status: "claimed", scope: [] },
      ]),
    ),
  );
  const bad = spawnSync(process.execPath, [scriptPath, badPath], { encoding: "utf8" });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /duplicated/);

  const missing = spawnSync(process.execPath, [scriptPath, join(dir, "missing.json")], {
    encoding: "utf8",
  });
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /cannot read/);
});
