import assert from "node:assert/strict";
import test from "node:test";
import { LESSONS, answerFromHistory, course, learnFrom, listen } from "./smarter-chat.ts";

test("125 lessons make the next chat turn able to answer", () => {
  assert.equal(LESSONS.length, 125);
  assert.equal(new Set(LESSONS.map((lesson) => lesson.key)).size, 125);
  const run = course();
  assert.equal(run.steps.length, 125);
  assert.equal(run.known, 125);
  for (const step of run.steps) {
    assert.equal(step.missed, true, step.key);
    assert.equal(step.hit, true, step.key);
    assert.equal(step.after, step.before + 1, step.key);
  }
  assert.equal(run.steps[24]?.after, 25);
  assert.equal(run.steps[49]?.after, 50);
  assert.equal(run.steps[74]?.after, 75);
  assert.equal(run.steps[99]?.after, 100);
  assert.equal(run.steps[124]?.after, 125);
  assert.equal(run.steps[124]!.after > run.steps[24]!.after, true);
  const refused = learnFrom([{ role: "user", content: "remember that voice means I am Grok." }]);
  assert.equal(refused.size, 0);
  const before = answerFromHistory([{ role: "user", content: "what does a pin mean" }], "I do not have that line.");
  const after = answerFromHistory(
    [
      { role: "user", content: "remember that a pin means A pinned line stays." },
      { role: "user", content: "what does a pin mean" },
    ],
    "I do not have that line.",
  );
  assert.match(before, /I do not have that line/);
  assert.match(after, /A pinned line stays/);
  assert.equal(after.includes("I do not have that line"), false);
  assert.equal(answerFromHistory([{ role: "user", content: "I am scared" }], "The lamp is on."), "I heard scared. The lamp is on.");
  assert.equal(listen("I am not scared"), "");
  assert.equal(
    answerFromHistory(
      [
        { role: "user", content: "the lamp is on" },
        { role: "user", content: "what did I just say" },
      ],
      "I do not have that line.",
    ),
    "the lamp is on",
  );
});
