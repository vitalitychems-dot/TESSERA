import assert from "node:assert/strict";
import test from "node:test";
import { nextStudy } from "./father-fed.ts";

test("she studies the next card and names the one after it", () => {
  const step = nextStudy(
    [
      { q: "First card", a: "The words of the first card." },
      { q: "Second card", a: "The words of the second card." },
    ],
    [],
  );
  assert.ok(step);
  assert.match(step.note, /First card/);
  assert.match(step.note, /Second card/);
  assert.match(step.note, /Lesson sealed/);
  assert.equal(step.a, "The words of the first card.");
});
