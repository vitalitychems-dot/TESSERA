import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the LoRa file is a research note and not radio code", () => {
  const note = readFileSync(new URL("../../../docs/v2/offline/LORA-NOTE.md", import.meta.url), "utf8");
  assert.match(note, /^# LoRa research note/);
  assert.match(note, /does not ship radio firmware/);
  assert.doesNotMatch(note, /wallet|payment|mining|firmware\.bin|MHz/i);
  assert.equal(note.includes("```"), false);
});
