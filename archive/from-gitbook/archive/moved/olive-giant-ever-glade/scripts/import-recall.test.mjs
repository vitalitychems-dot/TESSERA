import assert from "node:assert/strict";
import test from "node:test";
import { recallImports } from "../src/lib/tessera/recall.ts";

test("imported Zz source can be read and blocked paths stay out", async () => {
  const text = await recallImports("sovereign fetch guard");
  assert.match(text, /sovereign-fetch-guard/i);
  assert.doesNotMatch(text, /father-natal|wallet|credential/i);
});
