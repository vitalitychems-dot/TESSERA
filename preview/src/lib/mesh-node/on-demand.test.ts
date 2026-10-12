import assert from "node:assert/strict";
import test from "node:test";
import { OnDemandMesh } from "./on-demand.ts";

function rig(owner = true) {
  let t = 0; let starts = 0; let stops = 0; const o = { owner };
  const m = new OnDemandMesh({ ownerOn: () => o.owner, start: async () => { starts++; }, stop: async () => { stops++; }, idleMs: 1000, now: () => t, agent: "cordnation" });
  return { m, o, tick: (ms: number) => { t += ms; }, counts: () => ({ starts, stops }) };
}
const calm = { online: true, queued: 0 };

test("owner toggle off: no trigger switches the mesh on", async () => {
  const r = rig(false);
  assert.equal(await r.m.check({ online: false, queued: 5, wantPeerPage: true }), false);
  assert.deepEqual(r.counts(), { starts: 0, stops: 0 });
  assert.equal(r.m.log.length, 0);
});

for (const [name, need] of [
  ["offline", { online: false, queued: 0 }],
  ["queued-sync", { online: true, queued: 2 }],
  ["peer-only-page", { online: true, queued: 0, wantPeerPage: true }],
] as const) {
  test(`trigger ${name} switches on, idle timeout switches off, both logged`, async () => {
    const r = rig();
    assert.equal(await r.m.check(need), true);
    r.tick(500); assert.equal(await r.m.check(calm), true); // still within idle window
    r.tick(600); assert.equal(await r.m.check(calm), false);
    assert.deepEqual(r.m.log.map((s) => [s.to, s.trigger, s.agent]), [["on", name, "cordnation"], ["off", "idle-timeout", "cordnation"]]);
    assert.deepEqual(r.counts(), { starts: 1, stops: 1 });
  });
}

test("continuing need keeps it on; owner turning off forces off", async () => {
  const r = rig();
  await r.m.check({ online: false, queued: 0 });
  r.tick(5000); assert.equal(await r.m.check({ online: false, queued: 0 }), true);
  r.o.owner = false;
  assert.equal(await r.m.check({ online: false, queued: 0 }), false);
  assert.equal(r.m.log.at(-1)?.trigger, "owner-off");
});
