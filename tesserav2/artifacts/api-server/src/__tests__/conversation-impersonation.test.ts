import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {},
}));

vi.mock("@workspace/db/schema", async () => vi.importActual<Record<string, unknown>>("@workspace/db/schema"));

import { detectImpersonation, guardSovereignVoice } from "../routes/conversations";

describe("conversation impersonation guard", () => {
  it("rejects provider and model impersonation, including phrases the voice helper misses", () => {
    const samples = [
      "I am a language model.",
      "As an AI assistant, here is the answer.",
      "My knowledge cutoff is January.",
      "I cannot browse the internet.",
      "I'm OpenAI.",
      "I am Grok.",
    ];
    for (const sample of samples) {
      expect(detectImpersonation(sample), sample).toBe(true);
      const guarded = guardSovereignVoice(sample, "Explain torque", false);
      expect(guarded, sample).not.toBe(sample);
      expect(guarded.toLowerCase()).not.toContain("i am grok");
      expect(guarded.toLowerCase()).not.toContain("i'm openai");
      expect(guarded.toLowerCase()).not.toContain("language model");
      expect(guarded.toLowerCase()).not.toContain("knowledge cutoff");
      expect(guarded.toLowerCase()).not.toContain("browse the internet");
      expect(guarded.toLowerCase()).not.toContain("as an ai");
    }
  });

  it("keeps an ordinary Tessera sentence", () => {
    const sentence = "Tessera can explain torque with a diagram.";
    expect(detectImpersonation(sentence)).toBe(false);
    expect(guardSovereignVoice(sentence, "Explain torque", false)).toBe(sentence);
  });
});
