import assert from "node:assert/strict";
import test from "node:test";
import { strategy } from "./sw-strategy.ts";
test("shell is cache-first, api never cached, posts never cached", () => {
  assert.equal(strategy("/"), "cache-first");
  assert.equal(strategy("/assets/app.js"), "cache-first");
  assert.equal(strategy("/api/ask"), "network-only");
  assert.equal(strategy("/board", "POST"), "network-only");
  assert.equal(strategy("/board"), "network-first");
});
