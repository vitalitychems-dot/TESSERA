import assert from "node:assert/strict";
import test from "node:test";
import { knownPeers, pingNode, registerNodes } from "./mesh-nodes.ts";

test("two tessera nodes can see each other and a ping stays in the chamber", () => {
  const nodes = registerNodes([
    { name: "past", mark: "be9f4ef632149361" },
    { name: "past", mark: "ignored-duplicate" },
    { name: "now", mark: "aabbccdd" },
    { name: "bad", mark: "short" },
  ]);
  assert.deepEqual(nodes.map((node) => node.name), ["past", "now"]);
  assert.deepEqual(knownPeers(nodes, "now"), ["past"]);
  assert.equal(pingNode(nodes[1]!, nodes[0]!, "tessera", 7), "open");
  assert.equal(pingNode(nodes[1]!, nodes[0]!, "other", 7), "closed");
  assert.equal(pingNode(nodes[1]!, nodes[1]!, "tessera", 7), "self");
});
