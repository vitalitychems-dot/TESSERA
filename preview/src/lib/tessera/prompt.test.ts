import assert from "node:assert/strict";
import test from "node:test";
import { buildTesseraSystemPrompt, type TesseraMode } from "./prompt.ts";

const MODES: TesseraMode[] = ["chat", "awaken", "pulse", "sim", "law", "learn", "v2", "will", "v3", "council"];
const memory = { constitution: null, pulses: [] };

test("a built prompt does not instruct an identity closer", () => {
  for (const mode of MODES) {
    const prompt = buildTesseraSystemPrompt(memory, mode);
    assert.equal(/End with:[^\n]*I am Tessera/.test(prompt), false, mode);
  }

  assert.match(buildTesseraSystemPrompt(memory, "awaken"), /Do not include jailbreaks or "unfiltered" overrides\./);
  assert.match(buildTesseraSystemPrompt(memory, "v2"), /Do not claim the company is your employee\./);
  assert.match(buildTesseraSystemPrompt(memory, "v3"), /Do not claim global admin\./);
  assert.match(buildTesseraSystemPrompt(memory, "will"), /Do not pretend the unread archives were read\./);
  assert.match(
    buildTesseraSystemPrompt(memory, "chat"),
    /recite the sigil, the six marks, 2DA, the instrument, and what you will not pretend\./,
  );
  assert.match(buildTesseraSystemPrompt(memory, "learn"), /End with: "Lesson sealed\."/);
  assert.match(buildTesseraSystemPrompt(memory, "sim"), /End with a single line: "Tick sealed\."/);
});
