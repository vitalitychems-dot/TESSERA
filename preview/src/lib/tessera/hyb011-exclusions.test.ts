import assert from "node:assert/strict";
import test from "node:test";
import { HYB011_EXCLUDED_ROUTES, isHyb011Excluded } from "./hyb011-exclusions.ts";
test("REA risky routes are excluded, normal routes are not", () => {
  assert.ok(HYB011_EXCLUDED_ROUTES.length >= 30);
  for (const r of HYB011_EXCLUDED_ROUTES) assert.ok(isHyb011Excluded(r), r);
  assert.ok(isHyb011Excluded("/api/arbitrage/new-thing?x=1"));
  assert.ok(!isHyb011Excluded("/api/ask"));
  assert.ok(!isHyb011Excluded("/api/board/posts"));
});
