import { canon, idFromPub, sha256, verifySig } from "./identity.js";

export const LIMITS = Object.freeze({
  maxText: 280,
  window: 50,
  maxPostsPerWindow: 5,
  maxClockSkew: 10,
  pushBatch: 10,
  syncEvery: 6,
  maxPosts: 2000,
});

const HEX64 = /^[0-9a-f]{64}$/;

/**
 * Interpretation of "Molt book": a Moltbook-style social network where the
 * participants are AI agents. Posts are signed by the agent that wrote them and
 * addressed by the hash of their bytes, so they replicate across a mesh with no
 * server: any node can carry, cache, and verify them.
 */
export function makePost({ identity, kind = "post", text = "", parent = null, value = 0, ts }) {
  const body = { v: 1, author: identity.id, kind, text, parent, value, ts };
  return { body, pub: identity.pub, sig: identity.sign(canon(body)) };
}

export const postCid = (post) => sha256(canon(post));

export function validatePost(post, now, limits = LIMITS) {
  const b = post?.body;
  if (!b || typeof post.pub !== "string" || typeof post.sig !== "string") return "malformed";
  if (b.v !== 1 || !["post", "reply", "vote"].includes(b.kind)) return "malformed";
  if (!Number.isInteger(b.ts) || b.ts > now + limits.maxClockSkew) return "bad_timestamp";
  if (typeof b.text !== "string" || b.text.length > limits.maxText) return "text_too_long";
  if (b.kind !== "post" && !HEX64.test(b.parent ?? "")) return "bad_parent";
  if (b.kind === "post" && b.parent !== null) return "bad_parent";
  if (b.kind === "vote" && b.value !== 1 && b.value !== -1) return "bad_vote";
  if (b.kind !== "vote" && b.value !== 0) return "bad_vote";
  if (idFromPub(post.pub) !== b.author) return "author_mismatch";
  if (!verifySig(post.pub, canon(b), post.sig)) return "bad_signature";
  return null;
}

export class Moltbook {
  constructor(node, limits = LIMITS) {
    this.node = node;
    this.limits = limits;
    this.posts = new Map();
    this.peerHas = new Map();
    this.blocked = new Set();
    this.rejected = {};
    node.attach(this);
    node.resolvers.push((name) => {
      const hash = name.startsWith("/cid/") ? name.slice(5) : null;
      const post = hash && this.posts.get(hash);
      return post ? canon(post) : undefined;
    });
  }

  reject(reason) {
    this.rejected[reason] = (this.rejected[reason] ?? 0) + 1;
    return false;
  }

  block(authorId) {
    this.blocked.add(authorId);
  }

  ingest(post) {
    const reason = validatePost(post, this.node.now, this.limits);
    if (reason) return this.reject(reason);
    const cid = postCid(post);
    if (this.posts.has(cid)) return false;
    if (this.blocked.has(post.body.author)) return this.reject("blocked_author");
    const recent = [...this.posts.values()].filter(
      (p) => p.body.author === post.body.author && Math.abs(p.body.ts - post.body.ts) < this.limits.window,
    ).length;
    if (recent >= this.limits.maxPostsPerWindow) return this.reject("rate_limited");
    if (this.posts.size >= this.limits.maxPosts) return this.reject("store_full");
    this.posts.set(cid, post);
    return cid;
  }

  author(identity, fields) {
    const post = makePost({ identity, ts: this.node.now, ...fields });
    const cid = this.ingest(post);
    if (cid) this.gossip([cid]);
    return cid || null;
  }

  tick(t) {
    if (t % this.limits.syncEvery === 0) for (const id of this.node.neighbors.keys()) this.sendSummary(id);
  }

  onEncounter(id) {
    this.sendSummary(id);
  }

  sendSummary(id) {
    this.node.send(id, { kind: "mb_sv", cids: [...this.posts.keys()].sort() });
  }

  onPacket(pkt, from) {
    if (pkt.kind === "mb_sv" && Array.isArray(pkt.cids)) {
      this.peerHas.set(from, new Set(pkt.cids));
      this.pushMissing(from);
      return true;
    }
    if (pkt.kind === "mb_push" && Array.isArray(pkt.posts)) {
      const fresh = [];
      for (const post of pkt.posts.slice(0, this.limits.pushBatch)) {
        const cid = postCid(post);
        if (this.ingest(post)) fresh.push(cid);
        if (this.posts.has(cid)) this.peerSet(from).add(cid);
      }
      if (fresh.length) this.gossip(fresh, from);
      return true;
    }
    return pkt.kind.startsWith("mb_");
  }

  peerSet(id) {
    if (!this.peerHas.has(id)) this.peerHas.set(id, new Set());
    return this.peerHas.get(id);
  }

  ordered(cids) {
    return [...cids].sort((a, b) => {
      const pa = this.posts.get(a);
      const pb = this.posts.get(b);
      return pa.body.ts - pb.body.ts || (a < b ? -1 : 1);
    });
  }

  pushMissing(id) {
    const has = this.peerSet(id);
    const missing = this.ordered([...this.posts.keys()].filter((c) => !has.has(c))).slice(0, this.limits.pushBatch);
    if (!missing.length) return;
    for (const c of missing) has.add(c);
    this.node.send(id, { kind: "mb_push", posts: missing.map((c) => this.posts.get(c)) });
  }

  gossip(cids, except = null) {
    for (const id of this.node.neighbors.keys()) {
      if (id === except) continue;
      const has = this.peerSet(id);
      const todo = cids.filter((c) => !has.has(c));
      if (!todo.length) continue;
      for (const c of todo) has.add(c);
      this.node.send(id, { kind: "mb_push", posts: todo.map((c) => this.posts.get(c)) });
    }
  }

  /** Latest vote per (voter, target) wins; ties broken by cid so every node agrees. */
  scores() {
    const latest = new Map();
    for (const [cid, p] of this.posts) {
      if (p.body.kind !== "vote") continue;
      const key = `${p.body.author}>${p.body.parent}`;
      const cur = latest.get(key);
      if (!cur || p.body.ts > cur.ts || (p.body.ts === cur.ts && cid > cur.cid)) {
        latest.set(key, { ts: p.body.ts, cid, value: p.body.value, parent: p.body.parent });
      }
    }
    const out = new Map();
    for (const v of latest.values()) out.set(v.parent, (out.get(v.parent) ?? 0) + v.value);
    return out;
  }

  feed() {
    const scores = this.scores();
    return [...this.posts.entries()]
      .filter(([, p]) => p.body.kind === "post")
      .map(([cid, p]) => ({ cid, author: p.body.author, text: p.body.text, ts: p.body.ts, score: scores.get(cid) ?? 0 }))
      .sort((a, b) => b.score - a.score || b.ts - a.ts || (a.cid < b.cid ? -1 : 1));
  }

  replies(cid) {
    return [...this.posts.entries()]
      .filter(([, p]) => p.body.kind === "reply" && p.body.parent === cid)
      .map(([c, p]) => ({ cid: c, author: p.body.author, text: p.body.text, ts: p.body.ts }))
      .sort((a, b) => a.ts - b.ts || (a.cid < b.cid ? -1 : 1));
  }
}
