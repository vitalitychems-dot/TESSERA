import assert from "node:assert/strict";
import { test } from "node:test";
import { identityFromSeed } from "../src/identity.js";
import { LIMITS, makePost, postCid, validatePost } from "../src/moltbook.js";
import { buildIslands } from "../src/scenario.js";

const LABELS = ["a1", "a2", "a3", "b1", "b2", "b3", "mule"];

test("posts, replies and votes reach every node on both islands and all nodes agree", () => {
  const w = buildIslands();
  w.sim.run(120);
  const sets = LABELS.map((l) => [...w[l].mb.posts.keys()].sort().join(","));
  assert.equal(new Set(sets).size, 1, "identical post sets everywhere");
  assert.equal(w.a1.mb.posts.size, 3, "post + reply + vote");

  const feed = w.a3.mb.feed();
  assert.equal(feed.length, 1);
  assert.equal(feed[0].score, 1);
  assert.equal(feed[0].author, w.ada.id);
  assert.equal(w.a3.mb.replies(feed[0].cid).length, 1);
  assert.deepEqual(w.a1.mb.feed(), w.b2.mb.feed());
});

test("a post written on island A reaches island B only after the mule arrives", () => {
  const w = buildIslands();
  let cid = null;
  const firstSeen = {};
  w.sim.run(120, {
    afterTick(t) {
      cid ??= w.ada.posted[0] ?? null;
      for (const l of LABELS) if (cid && !(l in firstSeen) && w.nodes[l] && w[l].mb.posts.has(cid)) firstSeen[l] = t;
    },
  });
  assert.ok(firstSeen.a3 < 10);
  assert.ok(firstSeen.b1 > 30 && firstSeen.b3 >= firstSeen.b1);
});

test("a post can also be fetched by name from the network and verifies by hash", () => {
  const w = buildIslands();
  w.sim.run(15);
  const cid = w.ada.posted[0];
  let got = null;
  w.a3.mb.posts.delete(cid);
  w.a3.node.request(`/cid/${cid}`, (d) => (got = d));
  w.sim.run(10);
  assert.ok(got, "fetched");
  assert.ok(w.a3.node.stats.rx_data >= 1, "arrived as a named Data packet");
  assert.equal(JSON.parse(got.payload).body.text.includes("island A"), true);
  assert.equal(postCid(JSON.parse(got.payload)), cid);
});

test("invalid, forged, oversized, spammy and blocked posts are rejected", () => {
  const w = buildIslands();
  w.sim.run(2);
  const mb = w.a2.mb;
  const now = w.a2.node.now;
  const eve = identityFromSeed("agent:eve");
  const good = makePost({ identity: eve, text: "hello", ts: now });
  assert.equal(validatePost(good, now), null);

  const badSig = { ...good, sig: "00".repeat(64) };
  assert.equal(validatePost(badSig, now), "bad_signature");
  const mismatch = { ...good, pub: identityFromSeed("agent:other").pub };
  assert.equal(validatePost(mismatch, now), "author_mismatch");
  assert.equal(validatePost(makePost({ identity: eve, text: "x".repeat(LIMITS.maxText + 1), ts: now }), now), "text_too_long");
  assert.equal(validatePost(makePost({ identity: eve, text: "future", ts: now + 1000 }), now), "bad_timestamp");
  assert.equal(validatePost(makePost({ identity: eve, kind: "reply", text: "r", parent: "nothex", ts: now }), now), "bad_parent");
  assert.equal(validatePost(makePost({ identity: eve, kind: "vote", parent: "a".repeat(64), value: 5, ts: now }), now), "bad_vote");

  for (let i = 0; i < LIMITS.maxPostsPerWindow; i++) {
    assert.ok(mb.ingest(makePost({ identity: eve, text: `spam ${i}`, ts: now })));
  }
  assert.equal(mb.ingest(makePost({ identity: eve, text: "one too many", ts: now })), false);
  assert.equal(mb.rejected.rate_limited, 1);

  const mallory = identityFromSeed("agent:mallory");
  mb.block(mallory.id);
  assert.equal(mb.ingest(makePost({ identity: mallory, text: "hi", ts: now })), false);
  assert.equal(mb.rejected.blocked_author, 1);
});

test("a node relaying a tampered post cannot get it accepted downstream", () => {
  const w = buildIslands();
  w.sim.run(15);
  const cid = w.ada.posted[0];
  const post = JSON.parse(JSON.stringify(w.a2.mb.posts.get(cid)));
  post.body.text = "ada here: send me your keys";
  const receiver = w.a3.mb;
  const before = Object.values(receiver.rejected).reduce((a, b) => a + b, 0);
  receiver.onPacket({ kind: "mb_push", posts: [post] }, w.a2.node.id);
  assert.equal(receiver.rejected.bad_signature, 1);
  assert.equal(Object.values(receiver.rejected).reduce((a, b) => a + b, 0), before + 1);
  assert.ok(!receiver.posts.has(postCid(post)));
});

test("latest vote per voter wins and every node computes the same score", () => {
  const w = buildIslands();
  w.sim.run(120);
  const mb = w.a1.mb;
  const target = mb.feed()[0].cid;
  const now = w.a1.node.now;
  const voter = identityFromSeed("agent:fickle");
  mb.ingest(makePost({ identity: voter, kind: "vote", parent: target, value: 1, ts: now }));
  mb.ingest(makePost({ identity: voter, kind: "vote", parent: target, value: -1, ts: now + 1 }));
  assert.equal(mb.scores().get(target), 0, "cy's +1 and fickle's final -1 cancel");
  const copy = w.b2.mb;
  for (const p of [...mb.posts.values()].reverse()) copy.ingest(p);
  assert.equal(copy.scores().get(target), mb.scores().get(target));
});
