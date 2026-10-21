import assert from "node:assert/strict";
import test from "node:test";
import { NEXT, PORTS, feed, suiteLine } from "./suite-rules.ts";

test("the suite rules from the readme hold, and a camera feed is refused", () => {
  const line = suiteLine();
  assert.equal(line.passed, line.total);
  assert.equal(line.total, 20);
  assert.equal(PORTS.gitai, 4183);
  assert.equal(NEXT.edge, "#7ef0d4");
  assert.equal(feed("cctv"), "refused");
  assert.equal(feed("nasa"), "not fetched");
});
