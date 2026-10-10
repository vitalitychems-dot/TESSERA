import assert from "node:assert/strict";
import test from "node:test";
import { moltbookLine } from "./moltbook-link.ts";

test("a refused Moltbook reply is not called a connection", () => {
  assert.match(moltbookLine(429, "2026-10-11T02:09:31.000Z"), /refused/);
  assert.match(moltbookLine(409, null), /already taken/);
  assert.match(moltbookLine(401, null), /not attached/);
  assert.equal(moltbookLine(429, null).includes("moltbook_"), false);
});
