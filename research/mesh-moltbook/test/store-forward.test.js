import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIslands } from "../src/scenario.js";

test("bundle crosses a gap with no end-to-end path via the data mule", () => {
  const w = buildIslands();
  w.sim.run(6);
  const id = w.a1.node.sendBundle(w.b3.node.id, "ping from a1 to b3");
  let deliveredAt = null;
  w.sim.run(100, {
    afterTick(t) {
      if (deliveredAt === null && w.b3.node.inbox.has(id)) deliveredAt = t;
    },
  });
  assert.ok(deliveredAt !== null, "delivered");
  assert.ok(deliveredAt > 30, `delivered only after the mule reached island B (t=${deliveredAt})`);
  const msg = w.b3.node.inbox.get(id);
  assert.equal(msg.src, w.a1.node.id);
  assert.equal(msg.payload, "ping from a1 to b3");
  assert.equal(w.b3.node.stats.bundle_delivered, 1, "delivered exactly once");
});

test("expired bundles are not delivered and are dropped from carriers", () => {
  const w = buildIslands();
  w.sim.run(6);
  const id = w.a1.node.sendBundle(w.b3.node.id, "too slow", { ttl: 15 });
  w.sim.run(100);
  assert.ok(!w.b3.node.inbox.has(id));
  assert.equal(w.mule.node.bundles.size, 0);
});

test("a tampered bundle is rejected by the next hop", () => {
  const w = buildIslands();
  w.sim.run(6);
  const id = w.a1.node.sendBundle(w.b3.node.id, "original");
  const copy = JSON.parse(JSON.stringify(w.a1.node.bundles.get(id).b));
  const mule = w.mule.node;
  const before = mule.stats.drop_bad_bundle ?? 0;
  mule.receive({ kind: "bundle", b: { ...copy, payload: "tampered" }, copies: 2 }, w.a1.node.id, 7);
  mule.receive({ kind: "bundle", b: { ...copy, dest: w.a2.node.id }, copies: 2 }, w.a1.node.id, 7);
  assert.equal(mule.stats.drop_bad_bundle, before + 2);
});

test("spray-and-wait caps replication: total copies never exceed the budget", () => {
  const w = buildIslands();
  w.sim.run(6);
  const id = w.a1.node.sendBundle(w.b3.node.id, "bounded", { copies: 4 });
  w.sim.run(100);
  const total = Object.values(w.nodes)
    .map((n) => n.bundles.get(id)?.copies ?? 0)
    .reduce((a, b) => a + b, 0);
  assert.ok(total <= 4, `copies in flight ${total} <= 4`);
});
