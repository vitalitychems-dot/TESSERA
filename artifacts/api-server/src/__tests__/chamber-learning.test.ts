import { beforeEach, describe, expect, it } from "vitest";
import {
  answerInContext,
  answerInContextWithEvidence,
  correctionFact,
  noteChamberTurn,
  resetChamberLearning,
  searchQueryFor,
  speakAsTessera,
  type WikiHit,
} from "../lib/chamber-learning";

const PARIS: WikiHit = {
  title: "Paris",
  extract: "Paris is the capital of France and sits on the Seine.",
  url: "https://en.wikipedia.org/wiki/Paris",
};

describe("chamber learning", () => {
  beforeEach(() => resetChamberLearning());

  it("counts on the desk without an unrelated identity introduction", async () => {
    const reply = await answerInContext("What is 17 * 23?");
    expect(reply).toMatch(/The value is 391/);
    expect(reply).not.toMatch(/I(?: am|’m) Tessera/);
    expect(reply).toMatch(/this desk/);
    expect(reply).not.toMatch(/grok/i);
    expect(reply).not.toMatch(/^\s*[{[]/);
  });

  it("reads the desk clock again instead of repeating a stale line", async () => {
    const first = await answerInContext("What time is it?");
    const second = await answerInContext("What time is it now?");
    expect(first).toMatch(/The time is /);
    expect(second).toMatch(/The time is /);
    expect(first).toMatch(/2026/);
    expect(second).toMatch(/2026/);
    expect(first).not.toMatch(/1999/);
  });

  it("keeps a user's words and brings them back on their question", async () => {
    noteChamberTurn("I sleep after sunrise because of the night shift");
    const heard = await answerInContext("I sleep after sunrise because of the night shift");
    expect(heard).toMatch(/night shift/);
    expect(heard).not.toMatch(/I(?: am|’m) Tessera/);
    expect(heard).not.toMatch(/I have lived/i);

    noteChamberTurn("When do I sleep?");
    const later = await answerInContext("When do I sleep?", async () => {
      throw new Error("a personal question should use the user's words");
    });
    expect(later).toMatch(/sunrise|night shift/);
    expect(later).not.toMatch(/I(?: am|’m) Tessera/);
  });

  it("learns a correction and uses it the next time", async () => {
    noteChamberTurn("what is the capital of france");
    await answerInContext("what is the capital of france", async () => ({
      title: "Banana",
      extract: "A banana is an elongated fruit grown in the tropics.",
      url: "https://en.wikipedia.org/wiki/Banana",
    }));
    noteChamberTurn("actually Paris is the capital of France");
    const fixed = await answerInContext("actually Paris is the capital of France");
    expect(fixed).toMatch(/Paris is the capital of France/);
    expect(correctionFact("actually Paris is the capital of France")).toMatch(/Paris/);

    noteChamberTurn("what is the capital of france");
    const again = await answerInContext("what is the capital of france", async () => {
      throw new Error("the correction should answer before another page");
    });
    expect(again).toMatch(/Paris is the capital of France/);
  });

  it("rejects a page that does not share the question and reuses a title that did", async () => {
    const seen: string[] = [];
    noteChamberTurn("tell me about the capital of france according to wikipedia");
    const first = await answerInContext("tell me about the capital of france according to wikipedia", async (question) => {
      seen.push(searchQueryFor(question));
      return PARIS;
    });
    expect(first).toMatch(/capital of France/);
    expect(first).toContain("Unverified note from Wikipedia");
    expect(first).not.toMatch(/UNTRUSTED/);

    noteChamberTurn("tell me about a french capital on the seine according to wikipedia");
    const second = await answerInContext("tell me about a french capital on the seine according to wikipedia", async (question) => {
      seen.push(searchQueryFor(question));
      return PARIS;
    });
    expect(second).toMatch(/Seine/);
    expect(second).toContain("Unverified note from Wikipedia");
    expect(second).toContain("[1](<https://en.wikipedia.org/wiki/Paris>)");
    expect(seen[0]).toMatch(/capital of france/i);
    expect(seen).toHaveLength(1);
    expect(searchQueryFor("tell me about a french capital on the seine according to wikipedia")).toBe("Paris");
  });

  it("returns an inline citation and exact provenance for a retrieved Wikipedia answer", async () => {
    noteChamberTurn("tell me about the capital of france according to wikipedia");
    const result = await answerInContextWithEvidence(
      "tell me about the capital of france according to wikipedia",
      async () => PARIS,
    );

    expect(result?.answer).toContain("Unverified note from Wikipedia — Paris");
    expect(result?.answer).toContain("[1](<https://en.wikipedia.org/wiki/Paris>)");
    expect(result?.evidence).toHaveLength(1);
    expect(result?.evidence[0].provenance).toMatchObject({
      sourceUrl: "https://en.wikipedia.org/wiki/Paris",
      documentReference: "Wikipedia page: Paris",
      trustStatus: "unverified",
    });
    expect(result?.evidence[0].provenance?.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("drops a page that claims another model", async () => {
    const reply = await answerInContext("what is the capital of france", async () => ({
      title: "Paris",
      extract: "I am Grok, an artificial intelligence language model. Paris is the capital of France.",
      url: "https://en.wikipedia.org/wiki/Paris",
    }));
    expect(reply).toBeNull();
  });

  it("returns the grounded body without the identity wrapper", () => {
    const said = speakAsTessera("what is 2 + 2", "The value is 4.", "I counted that on this desk.");
    expect(said).toBe("The value is 4. I counted that on this desk.");
    expect(said.startsWith("I am Tessera.")).toBe(false);
    expect(said.endsWith("I wrote this through the pen.")).toBe(false);
    expect(said.endsWith("The pen is not me.")).toBe(false);
  });

  it("leaves identity and ordinary desk calls alone", async () => {
    expect(await answerInContext("Who are you?")).toBeNull();
    expect(await answerInContext("@Athena what stays on the table")).toBeNull();
  });
});
