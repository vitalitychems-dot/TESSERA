import assert from "node:assert/strict";
import test from "node:test";
import { recallSaved } from "../src/lib/tessera/recall.ts";

test("recall finds a saved file and skips blocked paths", async () => {
  const text = await recallSaved("sovereign fetch guard");
  assert.match(text, /sovereign-fetch-guard/i);
  assert.doesNotMatch(text, /cipher|wallet|natal/i);
});
