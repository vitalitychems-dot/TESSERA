import assert from "node:assert/strict";
import test from "node:test";
import { firmLine, firmest, keepSecret, safePath } from "./firm-combo.ts";
import { silentPen } from "./silent-pen.ts";

test("the firm combo holds twenty refusals", () => {
  const run = firmest();
  assert.equal(run.checks.length, 20);
  assert.equal(run.firm, true);
  assert.equal(run.held, 20);
  assert.equal(keepSecret("a plain note").ok, true);
  assert.equal(safePath("mesh/WINDOW.md").ok, true);
  assert.match(silentPen("firmest combo"), /held 20 of 20/);
  assert.equal(firmLine().includes("Mac was not changed"), true);
});
