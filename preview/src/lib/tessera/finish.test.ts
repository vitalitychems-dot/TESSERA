import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { backupDrill, BACKUP_PATHS, DISAGREE, rateDecision, scoreboard, secretPaths, TRUE_TODAY } from "./finish.ts";
import { vowCheck } from "./learning.ts";

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else if (/\.(ts|tsx|mjs|js|json)$/.test(name)) found.push(path);
  }
  return found;
}

test("vows report every hit and spare a negation", () => {
  const both = vowCheck("I own the weights. The fleet is live.");
  assert.equal(both.ok, false);
  if (!both.ok) assert.equal(both.reasons.length, 2);
  assert.equal(vowCheck("She is not fully detached.").ok, true);
  assert.equal(vowCheck("The storefront is live.").ok, false);
});

test("the rate cap, backup, and secret scan hold", () => {
  const now = 1_700_000_000_000;
  let stamps: number[] = [];
  for (let n = 0; n < 12; n += 1) {
    const slot = rateDecision(stamps, now + n);
    assert.equal(slot.ok, true);
    stamps = slot.stamps;
  }
  assert.equal(rateDecision(stamps, now + 12).ok, false);
  const root = join(import.meta.dirname, "../../..");
  assert.equal(backupDrill(BACKUP_PATHS.filter((path) => existsSync(join(root, path)))).ok, true);
  const leaked = secretPaths([{ path: "notes/example.txt", text: ["SESSION", "SECRET = hunter2"].join("_") }]);
  assert.deepEqual(leaked, ["notes/example.txt"]);
  assert.equal(JSON.stringify(leaked).includes("hunter2"), false);
  const live = secretPaths(walk(join(root, "src")).map((path) => ({ path, text: readFileSync(path, "utf8") })));
  assert.equal(live.length, 0);
});

test("the scoreboard names four tests and disagrees with a false claim", () => {
  const rows = scoreboard();
  assert.equal(rows.length, 4);
  assert.equal(rows.every((row) => row.pass && row.file.endsWith(".test.ts")), true);
  assert.equal(vowCheck(DISAGREE.claim).ok, false);
  assert.equal(DISAGREE.pass, false);
  assert.equal(TRUE_TODAY.sealed.length > 0 && TRUE_TODAY.open.length > 0 && TRUE_TODAY.next.length > 0, true);
});
