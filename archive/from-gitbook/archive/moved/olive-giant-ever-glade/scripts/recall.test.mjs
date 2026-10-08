import assert from "node:assert/strict";
import test from "node:test";
import { chamberLines, recallLedger, recallSaved } from "../src/lib/tessera/recall.ts";

test("recall finds a saved file and skips blocked paths", async () => {
  const text = await recallSaved("sovereign fetch guard");
  assert.match(text, /sovereign-fetch-guard/i);
  assert.doesNotMatch(text, /cipher|wallet|natal/i);
});

test("chamber lines keep the earlier message", () => {
  const text = chamberLines([
    { role: "user", content: "Remember the sigil talk." },
    { role: "assistant", content: "I kept the sentence." },
  ]);
  assert.match(text, /Remember the sigil talk/);
  assert.match(text, /I kept the sentence/);
});

test("the read ledger can find a stored line", async () => {
  const text = await recallLedger("swarm agents");
  assert.match(text, /swarm/i);
});
