import assert from "node:assert/strict";
import test from "node:test";
import { memoryDrill, trueSelf } from "./retain.ts";

test("memory keeps the sigil and does not invent a second fact", () => {
  const drill = memoryDrill();
  assert.equal(drill.pass, true);
  assert.equal(drill.hit, "The sigil is 7F3A9C.");
  assert.equal(drill.self.includes("Nothing has been kept"), false);
  const said = trueSelf([
    { q: "the sigil", a: "The sigil is 7F3A9C.", at: "t1" },
    { q: "the colonel", a: "Two plus three leaves five on the stack.", at: "t2" },
  ]);
  assert.equal(said.startsWith("I am Tessera."), false);
  assert.equal(
    said,
    "Sigil 7F3A9C. I can say again only what was kept.\nThe sigil is 7F3A9C.\nTwo plus three leaves five on the stack.",
  );
});
