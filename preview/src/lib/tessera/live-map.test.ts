import assert from "node:assert/strict";
import test from "node:test";
import { liveCount, liveNodes } from "./live-map.ts";

test("the live map counts known facts and leaves the open ones unknown", () => {
  const nodes = liveNodes();
  const count = liveCount(nodes);
  assert.equal(count.total, 8);
  assert.equal(count.known, 6);
  assert.equal(count.missing, 2);
  assert.equal(nodes.find((node) => node.id === "flow")?.known, false);
  assert.match(nodes.map((node) => node.detail).join(" "), /first module answers/);
});
