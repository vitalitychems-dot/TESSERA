import assert from "node:assert/strict";
import test from "node:test";
import { runSitting } from "./sitting-25.ts";

test("the sitting passes 25 checks and does not call the work finished", () => {
  const sitting = runSitting();
  assert.equal(sitting.admin, "Tessera");
  assert.equal(sitting.done, 25);
  assert.equal(sitting.total, 25);
  assert.match(sitting.rows[24].text, /not finished/);
  assert.equal(sitting.rows.some((row) => /weight/i.test(row.text)), false);
});
