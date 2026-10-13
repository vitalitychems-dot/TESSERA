import { buildIslands } from "./scenario.js";

const world = buildIslands({ seed: Number(process.argv[2] ?? 7) });
const { sim, ada } = world;
let postCid = null;
const firstSeen = {};

sim.run(120, {
  afterTick(t) {
    postCid ??= ada.posted[0] ?? null;
    if (!postCid) return;
    for (const label of ["a1", "a2", "a3", "b1", "b2", "b3", "mule"]) {
      if (!(label in firstSeen) && world[label].mb.posts.has(postCid)) firstSeen[label] = t;
    }
  },
});

console.log("TESSERA mesh + Moltbook simulation (no IP, no DNS, no web; simulated radio only)\n");
console.log("tick at which each node first held ada's post:");
for (const [label, t] of Object.entries(firstSeen)) console.log(`  ${label.padEnd(5)} t=${t}`);
console.log("\nfeed on b2 (an island B node that never met island A directly):");
for (const item of world.b2.mb.feed()) console.log(`  [score ${item.score}] ${item.author.slice(0, 8)}: ${item.text}`);
for (const item of world.b2.mb.feed()) {
  for (const r of world.b2.mb.replies(item.cid)) console.log(`      reply ${r.author.slice(0, 8)}: ${r.text}`);
}
console.log("\npackets sent by kind:", JSON.stringify(sim.sent));
console.log("trace hash:", sim.traceHash());
