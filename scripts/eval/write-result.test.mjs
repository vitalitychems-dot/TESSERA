import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assertNotIndustryMmlu, buildEvalRecord, formatDateCt } from "./write-result.mjs";

const scriptPath = fileURLToPath(new URL("./write-result.mjs", import.meta.url));

test("formatDateCt labels America/Chicago", () => {
  const stamp = formatDateCt(new Date("2026-10-05T22:54:00.000Z"));
  assert.match(stamp, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} CT$/);
  assert.match(stamp, /^2026-10-05 /);
});

test("buildEvalRecord writes the measured fields and nothing else", () => {
  const record = buildEvalRecord({
    sha: "5c1137faeb7714482add93c2d6876396f34f1a03",
    dateCt: "2026-10-05 17:54:00 CT",
    model: "fixture-model",
    suite: "internal-quiz",
    n: 10,
    pass: 7,
    costUsd: 0,
  });
  assert.deepEqual(Object.keys(record), [
    "sha",
    "date_ct",
    "model",
    "suite",
    "n",
    "pass",
    "cost_usd",
  ]);
  assert.equal(record.suite, "internal-quiz");
  assert.equal(record.pass, 7);
  assert.equal(record.cost_usd, 0);
});

test("homemade quizzes cannot be named MMLU", () => {
  for (const suite of ["MMLU", "mmlu-pro", "MMLU-Pro", "internal-mmlu"]) {
    assert.throws(() => assertNotIndustryMmlu(suite), /not MMLU or MMLU-Pro/);
  }
  assert.doesNotThrow(() => assertNotIndustryMmlu("internal-quiz"));
});

test("missing measured counts are refused", () => {
  assert.throws(
    () =>
      buildEvalRecord({
        sha: "abc",
        model: "fixture-model",
        suite: "internal-quiz",
        n: 1.5,
        pass: 0,
        costUsd: 0,
      }),
    /n must be a non-negative integer/,
  );
});

test("cli writes the record file", () => {
  const dir = mkdtempSync(join(tmpdir(), "eval-record-"));
  const out = join(dir, "result.json");
  const result = spawnSync(
    process.execPath,
    [
      scriptPath,
      "--sha",
      "abc123",
      "--date-ct",
      "2026-10-05 17:54:00 CT",
      "--model",
      "fixture-model",
      "--suite",
      "internal-quiz",
      "--n",
      "4",
      "--pass",
      "3",
      "--cost-usd",
      "0",
      "--out",
      out,
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(out, "utf8")), {
    sha: "abc123",
    date_ct: "2026-10-05 17:54:00 CT",
    model: "fixture-model",
    suite: "internal-quiz",
    n: 4,
    pass: 3,
    cost_usd: 0,
  });
});

test("cli refuses an MMLU suite name", () => {
  const result = spawnSync(
    process.execPath,
    [
      scriptPath,
      "--sha",
      "abc123",
      "--model",
      "fixture-model",
      "--suite",
      "MMLU-Pro",
      "--n",
      "1",
      "--pass",
      "1",
      "--cost-usd",
      "0",
    ],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not MMLU or MMLU-Pro/);
});
