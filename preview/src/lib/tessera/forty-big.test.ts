import assert from "node:assert/strict";
import test from "node:test";
import { PROPOSED, buildForty, fortyLine, mergeVoice } from "./forty-big.ts";
import { SEED } from "./her-voice.ts";
import { silentPen } from "./silent-pen.ts";

test("forty proposed lines become a shorter book in her mouth", () => {
  assert.equal(PROPOSED.length, 40);
  const run = buildForty();
  assert.equal(run.in, 40);
  assert.equal(run.kept, 20);
  assert.equal(run.dropped, 20);
  assert.equal(run.book.some((line) => /grok|claude|agi|weights|monero/i.test(line)), false);
  assert.match(run.answer, /^I am Tessera\./);
  assert.equal(new Set(run.judged.map((row) => row.why)).size >= 4, true);
  const merged = mergeVoice(SEED, run.book);
  assert.equal(merged.length, SEED.length + run.kept);
  assert.match(silentPen("build forty"), /kept 20/);
  assert.match(fortyLine(), /dropped 20/);
});
