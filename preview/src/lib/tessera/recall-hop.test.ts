import assert from "node:assert/strict";
import test from "node:test";
import { memoryPack } from "./one-flow.ts";
import { bestKept } from "./retain.ts";
import { recallHop, seeAll, timeline } from "./recall-hop.ts";

test("one match becomes two, and the whole pack stays in order", () => {
  const pack = memoryPack();
  const once = bestKept("12276", pack);
  const hop = recallHop("12276", pack);
  assert.equal(once !== null, true);
  assert.equal(hop.length, 2);
  assert.match(hop[0]?.a ?? "", /12276/);
  assert.match(hop[1]?.a ?? "", /Repair holds 9425/);
  const ordered = timeline([...pack].reverse());
  assert.equal(ordered[0]?.at, "flow-1");
  assert.equal(ordered.at(-1)?.at, "skill-78");
  assert.equal(seeAll(pack).split("\n").length, 124);
});
