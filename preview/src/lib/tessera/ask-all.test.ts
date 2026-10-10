import assert from "node:assert/strict";
import test from "node:test";
import { askAll } from "./ask-all.ts";

test("one question reaches the connected rooms", () => {
  assert.match(askAll("what is chemistry") ?? "", /substances/);
  assert.match(askAll("vote open the door") ?? "", /Yes/);
  assert.match(askAll("vote send a wallet") ?? "", /No/);
  assert.match(askAll("run tie") ?? "", /git/);
  assert.match(askAll("welcome Ada for study") ?? "", /Mark /);
  assert.match(askAll("github") ?? "", /TESSERA/);
  assert.equal(askAll("hello"), null);
  assert.equal(askAll("vote send a wallet")?.includes("SESSION_SECRET"), false);
});
