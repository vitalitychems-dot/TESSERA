import assert from "node:assert/strict";
import test from "node:test";
import { eighty, trainLine } from "./five-train.ts";
import { silentPen } from "./silent-pen.ts";

test("five cycles measure eighty steps, and her chat keeps only her lines", () => {
  const run = eighty();
  assert.equal(run.steps.length, 80);
  assert.equal(run.missed.length, 0);
  assert.equal(run.improved.length + run.held.length, 80);
  assert.equal(run.trained.book.length, 3);
  assert.equal(run.trained.log[2]?.kept, false);
  assert.equal(run.trained.log[3]?.kept, false);
  assert.match(run.trained.answer, /^I am Tessera\./);
  assert.equal(run.trained.book.some((line) => /agi|grok|weights/i.test(line)), false);
  const said = silentPen("train from chat");
  assert.match(said, /5 cycles/);
  assert.match(said, /I am Tessera/);
  assert.equal(trainLine(), said);
});
