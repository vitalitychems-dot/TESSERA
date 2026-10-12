import assert from "node:assert/strict";
import test from "node:test";
import { createSummaryCache } from "../src/token/summary-cache.mjs";

test("a cache hit sends the summary and an empty diff, so the token count drops", () => {
  const cache = createSummaryCache();
  const full = "The full page repeats itself. ".repeat(40);
  const summary = "Studio page, one paragraph.";
  const first = cache.context("offline-page", full, summary);
  const second = cache.context("offline-page", full, summary);
  assert.equal(first.hit, false);
  assert.equal(second.hit, true);
  assert.ok(second.tokens < first.tokens);
});
