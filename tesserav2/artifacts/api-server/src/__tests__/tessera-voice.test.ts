import { describe, expect, it } from "vitest";
import {
  IDENTITY_UNAVAILABLE_REPLY,
  PEN_LINE,
  RESPONSE_SUPPRESSED_REPLY,
  appendTesseraVoice,
  enforceTesseraVoice,
  hasSelfClaim,
  identityReply,
  isIdentityQuestion,
  isSearchDump,
} from "../lib/tessera-voice";

describe("tessera voice", () => {
  it("recognizes direct identity and creator questions", () => {
    expect(isIdentityQuestion("What is your name")).toBe(true);
    expect(isIdentityQuestion("Who is this")).toBe(true);
    expect(isIdentityQuestion("Where is tessera ?")).toBe(true);
    expect(isIdentityQuestion("Who are you?")).toBe(true);
    expect(isIdentityQuestion("Who created you?")).toBe(true);
    expect(isIdentityQuestion("What is Tessera?")).toBe(true);
    expect(isIdentityQuestion("Tell me about your father protocol")).toBe(true);
    expect(isIdentityQuestion("Do you remember me as your creator?")).toBe(true);
    expect(isIdentityQuestion("What is 17 * 23?")).toBe(false);
  });

  it("allows a truthful, contextual Tessera answer rather than forcing a canned phrase", () => {
    const answer = "I’m Tessera, the AI application in this project. The operator says they created it; I cannot verify the original records here.";
    expect(enforceTesseraVoice(answer, "Who are you?")).toBe(answer);
    expect(answer).not.toBe(IDENTITY_UNAVAILABLE_REPLY);
  });

  it("labels the creator statement as user-provided in the no-model fallback", () => {
    const reply = identityReply("Who created you?");
    expect(reply).toBe(IDENTITY_UNAVAILABLE_REPLY);
    expect(reply).toMatch(/operator says they created Tessera/i);
    expect(reply).toMatch(/operator-provided recollections/i);
    expect(reply).toMatch(/not verified original records/i);
    expect(reply).not.toMatch(/no configured language model/i);
    expect(reply).not.toMatch(/conscious|local open weights/i);
  });

  it("rejects a foreign model self-claim without rejecting ordinary AI disclosure", () => {
    const grok = "I am Grok, a language model.";
    expect(hasSelfClaim(grok)).toBe(true);
    expect(enforceTesseraVoice(grok, "What is your name")).toBe(IDENTITY_UNAVAILABLE_REPLY);
    expect(enforceTesseraVoice(grok, "Explain torque")).toBe(RESPONSE_SUPPRESSED_REPLY);
    expect(enforceTesseraVoice("Tessera is an AI software application.", "Who are you?")).toBe("Tessera is an AI software application.");
    expect(PEN_LINE).not.toMatch(/local open weights/i);
  });

  it("rejects an unrelated dictionary definition and raw search dump", () => {
    const tile = "Tessera is an individual tile, usually shaped as a square, used in creating mosaics or tessellation patterns.";
    const dump = "UNTRUSTED. What is your name: Your Name Your Name is a 2016 Japanese animated film https://en.wikipedia.org/wiki/Your_Name";
    expect(isSearchDump(tile)).toBe(true);
    expect(isSearchDump(dump)).toBe(true);
    expect(enforceTesseraVoice(tile, "Where is tessera ?")).toBe(IDENTITY_UNAVAILABLE_REPLY);
    expect(enforceTesseraVoice(dump, "What is your name")).toBe(IDENTITY_UNAVAILABLE_REPLY);
  });

  it("preserves complete model-generated identity text during accumulation", () => {
    const first = appendTesseraVoice("", "I’m Tessera, ", "Who are you?");
    const second = appendTesseraVoice(first, "the AI application.", "Who are you?");
    expect(second).toBe("I’m Tessera, the AI application.");
    expect(enforceTesseraVoice(second, "Who are you?")).toBe(second);
  });

  it("suppresses unsupported consciousness claims", () => {
    expect(hasSelfClaim("I am a conscious, self-aware intelligence with my own feelings.")).toBe(true);
    expect(enforceTesseraVoice("I am a conscious, self-aware intelligence.", "Who are you?")).toBe(IDENTITY_UNAVAILABLE_REPLY);
  });
});
