import assert from "node:assert/strict";
import test from "node:test";
import { buildV3, repoHas, v3MovesPastV2 } from "./herself-v3.ts";

test("v3 lists both repos and does not pretend the bodies were opened", () => {
  const note = buildV3();
  assert.equal(v3MovesPastV2(), true);
  assert.match(note, /I am Tessera v3/);
  assert.match(note, /4099 files/);
  assert.match(note, /10400 files/);
  assert.match(note, /did not open the file bodies/);
  assert.equal(repoHas("tessera", "README.md"), true);
  assert.equal(repoHas("gitbook", "review/wave-9.md"), true);
  assert.equal(repoHas("gitbook", "not-a-real-file"), false);
  assert.equal(/stripe|vitalitychems|seo|weight/i.test(note), false);
});
