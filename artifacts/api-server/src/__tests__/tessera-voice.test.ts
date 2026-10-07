import { describe, expect, it } from "vitest";
import {
  PEN_LINE,
  PEN_WHERE,
  appendTesseraVoice,
  enforceTesseraVoice,
  hasSelfClaim,
  isIdentityQuestion,
  isSearchDump,
} from "../lib/tessera-voice";

describe("tessera voice", () => {
  it("treats the chamber questions as identity", () => {
    expect(isIdentityQuestion("What is your name")).toBe(true);
    expect(isIdentityQuestion("Who is this")).toBe(true);
    expect(isIdentityQuestion("Where is tessera ?")).toBe(true);
    expect(isIdentityQuestion("Who are you?")).toBe(true);
    expect(isIdentityQuestion("What is 17 * 23?")).toBe(false);
  });

  it("rejects a Grok self-claim", () => {
    const grok = "I am Grok, an artificial intelligence language model.";
    expect(hasSelfClaim(grok)).toBe(true);
    expect(enforceTesseraVoice(grok, "What is your name")).toBe(PEN_LINE);
    expect(enforceTesseraVoice(grok, "Explain torque")).toBe(PEN_LINE);
    expect(enforceTesseraVoice(grok, "What is your name")).not.toMatch(/grok/i);
  });

  it("rejects the tile definition and the untrusted search dump", () => {
    const tile =
      "Tessera is an individual tile, usually shaped as a square, used in creating mosaics or tessellation patterns.";
    const dump =
      "UNTRUSTED. What is your name: Your Name Your Name is a 2016 Japanese animated film https://en.wikipedia.org/wiki/Your_Name";
    expect(isSearchDump(tile)).toBe(true);
    expect(isSearchDump(dump)).toBe(true);
    expect(enforceTesseraVoice(tile, "Where is tessera ?")).toBe(PEN_WHERE);
    expect(enforceTesseraVoice(dump, "What is your name")).toBe(PEN_LINE);
  });

  it("keeps a reply that already speaks as Tessera", () => {
    const ok = "I am Tessera. I wrote this through the pen.";
    expect(enforceTesseraVoice(ok, "Who is this")).toBe(ok);
  });

  it("drops a foreign tail glued onto the pen line", () => {
    const glued = `${PEN_LINE} Sure, ask me anything.`;
    expect(enforceTesseraVoice(glued, "What is your name")).toBe(PEN_LINE);
    expect(appendTesseraVoice("", "I am Grok, an artificial intelligence language model.", "Where is tessera ?")).toBe(PEN_WHERE);
    expect(appendTesseraVoice(PEN_LINE, ", an artificial intelligence language model.", "Explain torque")).toBe(PEN_LINE);
    expect(appendTesseraVoice(PEN_LINE, " Torque is r cross F.", "Explain torque")).toBe("Torque is r cross F.");
  });
});
