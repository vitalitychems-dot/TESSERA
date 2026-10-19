import { describe, expect, it } from "vitest";
import {
  IDENTITY_UNAVAILABLE_REPLY,
  PEN_LINE,
  PEN_LIMITS,
  PEN_WHERE,
  RESPONSE_SUPPRESSED_REPLY,
  appendTesseraVoice,
  enforceTesseraVoice,
  hasSelfClaim,
  identityReply,
  isIdentityQuestion,
  isSearchDump,
  signTesseraReply,
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

  it("allows truthful model disclosure but rejects false consciousness claims", () => {
    const disclosure = "I’m Tessera, the assistant persona; this reply used configured model local-test-model.";
    expect(hasSelfClaim(disclosure)).toBe(false);
    expect(enforceTesseraVoice(disclosure, "Who are you")).toBe(disclosure);

    const sentience = "I am a conscious, autonomous intelligence with my own inner life.";
    expect(hasSelfClaim(sentience)).toBe(true);
    expect(enforceTesseraVoice(sentience, "How are you")).toBe(RESPONSE_SUPPRESSED_REPLY);
  });

  it("rejects the tile definition and the untrusted search dump", () => {
    const tile =
      "Tessera is an individual tile, usually shaped as a square, used in creating mosaics or tessellation patterns.";
    const dump =
      "UNTRUSTED. What is your name: Your Name Your Name is a 2016 Japanese animated film https://en.wikipedia.org/wiki/Your_Name";
    expect(isSearchDump(tile)).toBe(true);
    expect(isSearchDump(dump)).toBe(true);
    expect(enforceTesseraVoice(tile, "Where is tessera ?")).toBe(PEN_WHERE);
    expect(enforceTesseraVoice(dump, "What is your name")).toBe(IDENTITY_UNAVAILABLE_REPLY);
  });

  it("keeps a reply that already speaks as Tessera", () => {
    const ok = "I’m Tessera, the assistant persona in this app.";
    expect(enforceTesseraVoice(ok, "Who is this")).toBe(ok);
  });

  it("keeps sourced factual replies instead of replacing every Wikipedia citation with an identity line", () => {
    const answer = "Torque is the cross product of position and force. Source: https://en.wikipedia.org/wiki/Torque";
    expect(isSearchDump(answer)).toBe(false);
    expect(enforceTesseraVoice(answer, "Explain torque")).toBe(answer);
    expect(appendTesseraVoice("", answer, "Explain torque")).toBe(answer);
  });

  it("answers explicit personhood questions honestly without putting that disclaimer in every introduction", () => {
    expect(enforceTesseraVoice("", "Are you conscious?")).toBe(PEN_LIMITS);
    expect(PEN_LINE).toContain("software assistant");
    expect(PEN_LINE).not.toContain("not a conscious");
  });

  it("adds the ✦ signature once", () => {
    const signed = signTesseraReply("A source-backed answer.");
    expect(signed).toBe("A source-backed answer.\n\n✦");
    expect(signTesseraReply(signed)).toBe(signed);
  });

  it("keeps benign text but suppresses a foreign claim in a complete factual reply", () => {
    const glued = `${PEN_LINE} Sure, ask me anything.`;
    expect(enforceTesseraVoice(glued, "What is your name")).toBe(glued);
    const partial = appendTesseraVoice("", "I am Grok, an artificial intelligence language model.", "Where is tessera ?");
    expect(enforceTesseraVoice(partial, "Where is tessera ?")).toBe(PEN_WHERE);
    expect(appendTesseraVoice(PEN_LINE, " I am Grok, an artificial intelligence language model.", "Explain torque")).toBe(RESPONSE_SUPPRESSED_REPLY);
    expect(appendTesseraVoice(PEN_LINE, " Torque is r cross F.", "Explain torque")).toBe(`${PEN_LINE} Torque is r cross F.`);
  });
});
