import assert from "node:assert/strict";
import test from "node:test";
import { REPO_LEDGER, fileFor, ledgerCount, ledgerLine } from "./repo-ledger.ts";

test("every catalog name is counted once, and a known file is the one the API returned", () => {
  const count = ledgerCount();
  assert.equal(REPO_LEDGER.length, 272);
  assert.equal(count.picked + count.empty + count.missing + count.held + count.nota, 272);
  assert.equal(count.picked, 81);
  assert.equal(REPO_LEDGER.find((row) => row.name === "appwrite/appwrite")?.file, "mongo-init.js");
  assert.equal(REPO_LEDGER.find((row) => row.name === "Brain-Cog-Lab/sgad")?.file, "global_v.py");
  assert.equal(REPO_LEDGER.find((row) => row.name === "Calamari/BehaviorTree.js")?.file, "");
  assert.match(ledgerLine(), /81 have a small source file at the root/);
  assert.match(fileFor("appwrite"), /mongo-init.js/);
  assert.match(fileFor("collink1007/Vitalitychems"), /not found/);
});
