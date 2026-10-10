import assert from "node:assert/strict";
import test from "node:test";
import { issuePass, mark } from "./pass.ts";

test("a pass rides in git and does not treat Moltbook as a key", () => {
  const issued = issuePass("Ada", "to study the light", 401);
  assert.equal(issued.ok, true);
  if (!issued.ok || !issued.pass) return;
  assert.equal(issued.pass.needsWeb, false);
  assert.equal(issued.pass.carriedBy, "git");
  assert.match(issued.pass.moltbook, /not attached/);
  assert.equal(issued.pass.mark, mark(`Ada\n${issued.pass.turn}\nto study the light`));
  assert.equal(issuePass("Ada", "store the api_key", 200).ok, false);
});
