import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { IMPORT_PASS, STILL_CLOSED, SWARM_ROLES } from "../src/lib/tessera/imported-laws.ts";

test("every imported text was opened and the set-aside files stay out", async () => {
  const ledger = JSON.parse(await readFile(new URL("../data/imports/read.json", import.meta.url), "utf8"));
  assert.equal(ledger.files.length, IMPORT_PASS.opened);
  assert.equal(ledger.read, IMPORT_PASS.read);
  assert.equal(ledger.skipped, IMPORT_PASS.skipped);
  assert.equal(ledger.files.filter((row) => row.status === "read").length, IMPORT_PASS.read);
  const skipped = ledger.files.filter((row) => row.status === "skipped").map((row) => row.path);
  assert.equal(skipped.some((path) => /wallet|secret|EconomyHub|\.vercel/i.test(path)), true);
  assert.equal(ledger.files.some((row) => /vitality|storefront/i.test(row.path)), false);
  const swarm = ledger.files.find((row) => row.path.endsWith("artifacts/tessera/src/lib/swarm-agents.ts"));
  assert.equal(swarm.status, "read");
  assert.equal(SWARM_ROLES.includes("MathAgent"), true);
  assert.equal(SWARM_ROLES.includes("SelfExpansionTutorAgent"), true);
  const kept = ledger.files.filter((row) => row.status === "read").map((row) => `${row.path} ${row.line}`);
  assert.equal(kept.some((line) => /api[_-]?key|wallet|BEGIN /i.test(line)), false);
  assert.equal(STILL_CLOSED.length, 6);
  const names = new Set(ledger.files.map((row) => row.path));
  for (const file of STILL_CLOSED) {
    assert.equal([...names].some((path) => path.endsWith(file.name)), false);
  }
});
