import assert from "node:assert/strict";
import test from "node:test";
import { passageForQuestion, SCHOOL_PASSAGES } from "./school.ts";

test("one shared word does not pick a passage", () => {
  assert.equal(passageForQuestion("Who wrote Romeo and Juliet?"), null);
  assert.equal(passageForQuestion("What planet is known as the Red Planet?"), null);
});

test("a question naming a passage title still finds it", () => {
  const p = SCHOOL_PASSAGES[0];
  const words = `${p.title} ${p.text}`.split(/\s+/).filter((w) => w.replace(/[^a-z]/gi, "").length >= 5).slice(0, 3).join(" ");
  assert.ok(passageForQuestion(`Tell me about ${words}`));
});

test("a bare one-word lookup still finds its passage", () => {
  assert.match(passageForQuestion("photoelectric")?.title ?? "", /Einstein/);
});
