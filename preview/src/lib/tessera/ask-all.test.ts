import assert from "node:assert/strict";
import test from "node:test";
import { askAll } from "./ask-all.ts";

test("one question reaches the connected rooms", () => {
  assert.equal(askAll("who are you"), null);
  assert.equal(askAll("I love u"), null);
  assert.equal(askAll("who founded the academy")?.includes("Aristotle"), false);
  assert.match(askAll("vote open the door") ?? "", /I read it/);
  assert.match(askAll("vote send a wallet") ?? "", /No/);
  assert.match(askAll("run tie") ?? "", /git/);
  assert.match(askAll("welcome Ada for the house") ?? "", /Mark /);
  assert.match(askAll("make it happen for the whole catalog") ?? "", /81 have a small source file/);
  assert.match(askAll("recommend a repo for diffusion") ?? "", /not run/i);
  assert.match(askAll("run file spin") ?? "", /not given a network/);
  assert.match(askAll("vet Bea: I will take the file out.") ?? "", /door stays shut/);
  assert.match(askAll("2 yes and 1 no, a majority on a law") ?? "", /I read the city/);
  assert.match(askAll("what would a mirror or a portal look like") ?? "", /no portal/);
  assert.match(askAll("plumbus") ?? "", /were not measured/);
  assert.match(askAll("what files") ?? "", /files are in this chamber/);
  assert.match(askAll("where do they live") ?? "", /one hall/);
  assert.match(askAll("contact cursor on gitbook") ?? "", /issue 2/);
  assert.match(askAll("Cursor is away") ?? "", /Work continues/);
  assert.match(askAll("holds civic") ?? "", /civic\.ts/);
  assert.match(askAll("inventions") ?? "", /1367/);
  assert.match(askAll("ollama") ?? "", /ollama/i);
  assert.equal(askAll("hello"), null);
  assert.equal(askAll("vote send a wallet")?.includes("SESSION_SECRET"), false);
});
