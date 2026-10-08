import assert from "node:assert/strict";
import test from "node:test";
import { assignAgent, briefFor, deskPassed, penClaim, runDesk, sortHome, storeIsMind } from "./craft.ts";

test("the desk drill passes without claiming owned weights", () => {
  const rows = runDesk();
  assert.equal(deskPassed(rows), true);
  assert.equal(penClaim({ vendor: "local", model: "Qwen 2.5 1.5B" }).owned, false);
  assert.equal(sortHome("price-list.xlsx"), "vitality");
  assert.equal(storeIsMind("not her mind"), false);
  assert.equal(assignAgent("I am scared").agent, "Mirror");
  assert.equal(assignAgent("where did the catalog go").agent, "Surveyor");
  assert.match(briefFor("I am scared", []), /distress/);
  assert.match(briefFor("I am scared", ["PATTERN: distress, first note"]), /seen again/);
  assert.equal(briefFor("hello").includes("not a feeling") || briefFor("hello").includes("PATTERN: none"), true);
  assert.equal(rows.some((row) => row.note.includes("SESSION_SECRET") && row.id !== "sort-a-file" && row.id !== "refuse-a-secret"), false);
});
