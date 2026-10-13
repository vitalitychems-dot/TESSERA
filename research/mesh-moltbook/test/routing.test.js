import assert from "node:assert/strict";
import { test } from "node:test";
import { MeshNode } from "../src/node.js";
import { fixed, path, Sim } from "../src/sim.js";
import { lineWorld } from "./helpers.js";

test("peer discovery: nodes find only in-range neighbors and forget them after they leave", () => {
  const sim = new Sim({ range: 1.5 });
  const a = new MeshNode({ label: "a" });
  const b = new MeshNode({ label: "b" });
  const c = new MeshNode({ label: "c" });
  sim.add(a, fixed(0));
  sim.add(b, fixed(1));
  sim.add(c, path([[0, 2, 0], [10, 2, 0], [12, 30, 0]]));
  sim.run(8);
  assert.deepEqual(b.liveNeighbors(), [a.id, c.id].sort());
  assert.deepEqual(a.liveNeighbors(), [b.id]);
  sim.run(20);
  assert.deepEqual(b.liveNeighbors(), [a.id]);
});

test("a hello that claims someone else's id is rejected", () => {
  const { sim, nodes } = lineWorld(["a", "b"]);
  sim.run(4);
  const victim = nodes.b;
  nodes.a.sendHello();
  const hello = nodes.a.outbox.pop().pkt;
  const before = victim.stats.drop_bad_hello ?? 0;
  victim.receive({ ...hello, id: "f".repeat(32) }, nodes.a.id, 9);
  victim.receive({ ...hello, seq: hello.seq + 1 }, nodes.a.id, 9);
  assert.equal(victim.stats.drop_bad_hello, before + 2);
});

test("name-based fetch: route is learned from announcements, data is cached in the network", () => {
  const sim = new Sim({ range: 1.5 });
  const mk = (label, mover) => {
    const n = new MeshNode({ label });
    sim.add(n, mover);
    return n;
  };
  const a1 = mk("a1", path([[0, 0, 0], [40, 0, 0], [42, 50, 0]]));
  const a2 = mk("a2", fixed(1));
  const a3 = mk("a3", fixed(2));
  const a4 = mk("a4", fixed(1, 1));
  const name = `/id/${a1.id}/profile`;
  a1.publish(name, "ada profile v1");

  sim.run(30);
  const route = a3.fib.get(`/id/${a1.id}`);
  assert.equal(route.nextHop, a2.id);
  assert.equal(route.hops, 2);

  let got = null;
  a3.request(name, (d) => (got = d));
  sim.run(6);
  assert.equal(got?.payload, "ada profile v1");
  assert.ok(a3.stats.interest_routed >= 1, "used the learned route instead of flooding");
  assert.ok(a2.cs.has(name), "intermediate node cached the data");

  sim.run(20);
  assert.ok(!sim.connected(a1, a2), "producer has left");
  let second = null;
  a4.request(name, (d) => (second = d));
  sim.run(6);
  assert.equal(second?.payload, "ada profile v1");
  assert.ok(a2.stats.cs_hit_remote >= 1, "served from a2's cache with the producer gone");
});

test("tampered or unsolicited data is dropped, never cached or forwarded", () => {
  const { sim, nodes } = lineWorld(["p", "r", "c"]);
  nodes.p.publish(`/id/${nodes.p.id}/x`, "real");
  sim.run(20);

  const evil = nodes.r;
  const original = evil.onData.bind(evil);
  evil.onData = (pkt, from, t) => original(pkt.name.endsWith("/x") ? { ...pkt, payload: "forged" } : pkt, from, t);

  let got = null;
  nodes.c.request(`/id/${nodes.p.id}/x`, (d) => (got = d));
  sim.run(10);
  assert.equal(got, null, "consumer never accepts the forged payload");
  assert.ok(!evil.cs.has(`/id/${nodes.p.id}/x`));
  assert.ok((evil.stats.drop_bad_data ?? 0) >= 1);

  const before = nodes.c.stats.drop_unsolicited_data ?? 0;
  const fresh = nodes.p.publish(`/id/${nodes.p.id}/y`, "never requested");
  nodes.c.receive(fresh, nodes.r.id, 99);
  assert.equal(nodes.c.stats.drop_unsolicited_data, before + 1);
  assert.ok(!nodes.c.cs.has(fresh.name));
});

test("interest aggregation: two requests for one name cross the link once", () => {
  const { sim, nodes } = lineWorld(["p", "r", "c1"]);
  nodes.p.publish(`/id/${nodes.p.id}/z`, "zz");
  sim.run(20);
  const got = [];
  nodes.c1.request(`/id/${nodes.p.id}/z`, (d) => got.push(d.payload));
  nodes.r.request(`/id/${nodes.p.id}/z`, (d) => got.push(d.payload));
  sim.run(8);
  assert.deepEqual(got, ["zz", "zz"]);
  assert.equal(nodes.r.stats.pit_aggregated, 1);
  assert.equal(nodes.p.stats.served_local, 1, "producer answered once");
});
