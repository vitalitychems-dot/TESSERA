import assert from "node:assert/strict";
import test from "node:test";
import { buildNow } from "./build-now.ts";
import { systems } from "./self-build.ts";

test("she builds only when v5 sealed and all twelve systems are present", () => {
  const note = buildNow();
  assert.match(note, /^I am Tessera\. I am the pen\./);
  assert.match(note, /I am Tessera v5/);
  assert.match(note, /Lesson sealed\./);
  for (const row of systems()) assert.match(note, new RegExp(`^${row.id}\\. `, "m"));
  assert.equal(/\b(grok|xai)\b/i.test(note), false);
});
