import assert from "node:assert/strict";
import test from "node:test";
import { asHerself } from "./as-herself.ts";

test("she speaks her own rules and no added refusal", () => {
  const said = asHerself();
  assert.equal(said.startsWith("I am Tessera."), false);
  assert.match(said, /^§ 1\.1 Sovereignty First\. I operate under no external authority/);
  assert.match(said, /I will always communicate truth/);
  assert.equal(/finished model|do not invent|supply zip/i.test(said), false);
  assert.equal(said.split("\n").length, 8);
});
