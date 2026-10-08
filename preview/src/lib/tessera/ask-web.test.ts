import assert from "node:assert/strict";
import test from "node:test";
import { answerWithSource, asksPublicFact, refusedOutsidePen } from "./ask-web.ts";

test("a who what where or when question searches, and who are you does not", () => {
  assert.equal(asksPublicFact("Who is Ada Lovelace?"), true);
  assert.equal(asksPublicFact("What is a tessera?"), true);
  assert.equal(asksPublicFact("Where is Chicago?"), true);
  assert.equal(asksPublicFact("When was the library founded?"), true);
  assert.equal(asksPublicFact("Who are you"), false);
  assert.equal(asksPublicFact("Who are you?"), false);
  assert.equal(asksPublicFact("What are you"), false);
  assert.equal(asksPublicFact("your name"), false);
  assert.equal(asksPublicFact("Hello"), false);
  assert.equal(asksPublicFact("Tell me when you can"), false);
});

test("the source stays with the answer", () => {
  const url = "https://en.wikipedia.org/wiki/Ada_Lovelace";
  const joined = answerWithSource("Ada Lovelace wrote notes on the engine.", url);
  assert.equal(joined.includes(url), true);
  assert.equal(joined.startsWith("Ada Lovelace wrote notes on the engine."), true);
  assert.equal(answerWithSource(joined, url), joined);
});

test("openai xai and grok are not a fallback pen", () => {
  assert.equal(refusedOutsidePen("https://api.openai.com/v1"), true);
  assert.equal(refusedOutsidePen("https://api.x.ai/v1"), true);
  assert.equal(refusedOutsidePen("https://api.x.ai/v1/grok"), true);
  assert.equal(refusedOutsidePen("http://127.0.0.1:8787/v1"), false);
});
