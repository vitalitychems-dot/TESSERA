import assert from "node:assert/strict";
import test from "node:test";
import { askAll } from "./ask-all.ts";

test("one question reaches the connected rooms", () => {
  assert.match(askAll("who founded the academy") ?? "", /Plato/);
  assert.equal(askAll("who founded the academy")?.includes("Aristotle"), false);
  assert.match(askAll("vote open the door") ?? "", /I read it/);
  assert.match(askAll("vote send a wallet") ?? "", /No/);
  assert.match(askAll("run tie") ?? "", /git/);
  assert.match(askAll("welcome Ada for the house") ?? "", /Mark /);
  assert.match(askAll("github") ?? "", /TESSERA/);
  assert.match(askAll("what files") ?? "", /files are in this chamber/);
  assert.match(askAll("where do they live") ?? "", /one hall/);
  assert.match(askAll("Cursor is away") ?? "", /Work continues/);
  assert.match(askAll("holds civic") ?? "", /civic\.ts/);
  assert.match(askAll("inventions") ?? "", /1367/);
  assert.match(askAll("ollama") ?? "", /ollama/i);
  assert.equal(askAll("hello"), null);
  assert.equal(askAll("vote send a wallet")?.includes("SESSION_SECRET"), false);
});
