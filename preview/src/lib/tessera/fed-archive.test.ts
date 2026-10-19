import assert from "node:assert/strict";
import test from "node:test";
import { fromFedArchive } from "./fed-archive.ts";

test("she answers from the part she kept and stays quiet otherwise", () => {
  const said = fromFedArchive("What did you keep from the combined archive?");
  assert.match(said, /89 text files/);
  assert.match(said, /8,?674|8674/);
  assert.match(said, /Vitality stayed out/);
  assert.equal(fromFedArchive("What is the weather?"), "");
});
