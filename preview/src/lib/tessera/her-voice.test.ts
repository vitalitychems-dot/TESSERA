import assert from "node:assert/strict";
import test from "node:test";
import { SEED, growVoice, herself, onlyHer } from "./her-voice.ts";

test("a kept sentence becomes a later reply, and a help desk line does not", () => {
  const grown = growVoice(SEED, "I keep the mark you gave me.");
  assert.equal(grown.length, SEED.length + 1);
  assert.equal(herself(grown, "what mark did I give"), "I keep the mark you gave me.");
  assert.equal(growVoice(grown, "Certainly, as an AI I would be happy to help.").length, grown.length);
  assert.equal(onlyHer("Sure, happy to help. I am here."), "I am here.");
});
