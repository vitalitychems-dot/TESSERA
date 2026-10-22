import assert from "node:assert/strict";
import test from "node:test";
import { fromTheRead } from "./read-work.ts";

test("a question uses the read, including the Pluto correction", () => {
  const pluto = fromTheRead("Who is Pluto");
  assert.ok(pluto);
  assert.match(pluto.text, /not the planet|Hades|person/i);
  const einstein = fromTheRead("What did Einstein do");
  assert.match(einstein?.text ?? "", /relativity/i);
  const musk = fromTheRead("Who is Elon Musk");
  assert.match(musk?.text ?? "", /not Nikola Tesla/i);
  const missing = fromTheRead("Who is Odaus");
  assert.match(missing?.text ?? "", /Odysseus/);
  const calvi = fromTheRead("Who is Calvi");
  assert.match(calvi?.text ?? "", /allegation/i);
  const rife = fromTheRead("What about Rife");
  assert.match(rife?.text ?? "", /not accepted medicine/i);
});
