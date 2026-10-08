import assert from "node:assert/strict";
import test from "node:test";
import { ROOMS, RUNNABLE_SKILLS, UNDER_HER_NAME, answerWithSource, asksPublicWeb } from "./public-question.ts";

test("who what where when search, and who are you does not", () => {
  assert.equal(asksPublicWeb("Who are you"), false);
  assert.equal(asksPublicWeb("who are you?"), false);
  assert.equal(asksPublicWeb("Who are you really"), false);
  assert.equal(asksPublicWeb("Who is the pen"), true);
  assert.equal(asksPublicWeb("What is the capital of France"), true);
  assert.equal(asksPublicWeb("Where is the library"), true);
  assert.equal(asksPublicWeb("When did the board open"), true);
  assert.equal(asksPublicWeb("hello"), false);
});

test("the source stays on the answer", () => {
  assert.equal(
    answerWithSource("Paris is the capital.", "https://en.wikipedia.org/wiki/Paris"),
    "Paris is the capital.\n\nSource: https://en.wikipedia.org/wiki/Paris",
  );
  assert.equal(answerWithSource("Already https://en.wikipedia.org/wiki/Paris", "https://en.wikipedia.org/wiki/Paris"), "Already https://en.wikipedia.org/wiki/Paris");
  assert.equal(answerWithSource("Quiet.", ""), "Quiet.");
});

test("the rooms and the row under her name stay put", () => {
  assert.deepEqual(
    ROOMS.map((room) => room.label),
    ["Talk", "Council", "World", "Memory", "Brain"],
  );
  assert.deepEqual(
    UNDER_HER_NAME.map((room) => room.label),
    ["Agents", "Gitbook", "Language", "Bible", "Map", "Board", "Practice", "Code", "Narrative", "Closed", "Theme", "Library"],
  );
});

test("learn lists only the skills she can run", () => {
  assert.deepEqual([...RUNNABLE_SKILLS], [
    "Search the public web and keep the source with the answer.",
    "Read a catalog name and say the home it already has.",
    "Convert a line with the sovereign dictionary.",
    "Run the colonel on arithmetic.",
    "Refuse a reply that breaks a vow.",
  ]);
  assert.equal(RUNNABLE_SKILLS.some((skill) => /weight/i.test(skill)), false);
});
