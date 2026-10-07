import assert from "node:assert/strict";
import test from "node:test";
import { allowedWriteRepo, writeRefusal } from "./repo-guard.ts";

test("writes are allowed only for tessera and gitbook", () => {
  assert.equal(allowedWriteRepo("vitalitychems-dot/tessera-coordination"), true);
  assert.equal(allowedWriteRepo("Gitbook"), true);
  assert.equal(allowedWriteRepo("vitalitychems-dot/Gitbook.git"), true);
  assert.equal(allowedWriteRepo("Zz"), false);
  assert.equal(allowedWriteRepo("collink1007/z"), false);
  assert.equal(allowedWriteRepo("facebookresearch/tribev2"), false);
  assert.equal(allowedWriteRepo("TheTesseractAI/18"), false);
  assert.match(writeRefusal("Zz") ?? "", /Refused/);
  assert.equal(writeRefusal("tessera-coordination"), null);
});
