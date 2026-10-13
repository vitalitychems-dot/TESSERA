import { canon, identityFromSeed, idFromPub, sha256, verifySig } from "./identity.js";
import { longestPrefix, makeData, parseName, verifyData } from "./names.js";

export const DEFAULTS = Object.freeze({
  helloEvery: 2,
  neighborTtl: 5,
  annEvery: 10,
  annTtl: 40,
  pitLifetime: 8,
  maxHops: 8,
  csSize: 64,
  maxBundles: 32,
  bundleCopies: 4,
  helloBundleIds: 16,
  seenLimit: 512,
});

const bounded = (set, limit) => {
  while (set.size > limit) set.delete(set.values().next().value);
};

/**
 * One mesh node. It never touches a socket: it emits packets with send() and
 * consumes them in receive(), so a simulator (or later a real radio driver)
 * decides what "in range" means. There is no IP address anywhere; a node is
 * its public-key hash, and content is found by name.
 */
export class MeshNode {
  constructor({ label, seed = label, ...cfg }) {
    this.label = label;
    this.identity = identityFromSeed(`node:${seed}`);
    this.id = this.identity.id;
    this.cfg = { ...DEFAULTS, ...cfg };
    this.now = 0;
    this.helloSeq = 0;
    this.annSeq = 0;
    this.bundleSeq = 0;

    this.neighbors = new Map();
    this.cs = new Map();
    this.pit = new Map();
    this.fib = new Map();
    this.seenInterests = new Set();
    this.seenAnn = new Map();
    this.produced = new Map();
    this.resolvers = [];
    this.pending = new Map();
    this.bundles = new Map();
    this.inbox = new Map();
    this.services = [];
    this.outbox = [];
    this.stats = {};
  }

  count(key, n = 1) {
    this.stats[key] = (this.stats[key] ?? 0) + n;
  }

  send(to, pkt) {
    this.outbox.push({ to, pkt });
    this.count(`tx_${pkt.kind}`);
  }

  attach(service) {
    this.services.push(service);
    return service;
  }

  liveNeighbors() {
    return [...this.neighbors.keys()].sort();
  }

  tick(t) {
    this.now = t;
    for (const [id, n] of this.neighbors) {
      if (t - n.lastSeen > this.cfg.neighborTtl) this.neighbors.delete(id);
    }
    for (const [name, e] of this.pit) if (e.expires <= t) this.pit.delete(name);
    for (const [prefix, e] of this.fib) if (e.expires <= t) this.fib.delete(prefix);
    for (const [id, e] of this.bundles) if (e.b.expires <= t) this.bundles.delete(id);

    if (t % this.cfg.helloEvery === 0) this.sendHello();
    if (this.produced.size > 0 && t % this.cfg.annEvery === 0) this.announce();
    for (const s of this.services) s.tick?.(t);
  }

  sendHello() {
    const bundles = [...this.bundles.keys()].sort().slice(0, this.cfg.helloBundleIds);
    const body = { id: this.id, seq: ++this.helloSeq, bundles };
    this.send(null, { kind: "hello", ...body, pub: this.identity.pub, sig: this.identity.sign(canon(body)) });
  }

  receive(pkt, from, t) {
    this.now = t;
    this.count(`rx_${pkt.kind}`);
    for (const s of this.services) if (s.onPacket?.(pkt, from, t)) return;
    switch (pkt.kind) {
      case "hello":
        return this.onHello(pkt, t);
      case "ann":
        return this.onAnn(pkt, from, t);
      case "interest":
        return this.onInterest(pkt, from, t);
      case "data":
        return this.onData(pkt, from, t);
      case "bundle":
        return this.onBundle(pkt, from, t);
      default:
        this.count("rx_unknown");
    }
  }

  // Peer discovery: signed beacons. A spoofed hello fails the id/pubkey check.
  onHello(pkt, t) {
    const body = { id: pkt.id, seq: pkt.seq, bundles: pkt.bundles };
    if (
      typeof pkt.pub !== "string" ||
      idFromPub(pkt.pub) !== pkt.id ||
      !verifySig(pkt.pub, canon(body), pkt.sig) ||
      pkt.id === this.id
    ) {
      this.count("drop_bad_hello");
      return;
    }
    const known = this.neighbors.get(pkt.id);
    const entry = { lastSeen: t, bundles: new Set(pkt.bundles ?? []), pub: pkt.pub };
    this.neighbors.set(pkt.id, entry);
    if (!known) for (const s of this.services) s.onEncounter?.(pkt.id, t);
    this.offerBundles(pkt.id);
  }

  // Name routing: producers flood a prefix announcement; receivers learn the next hop.
  publish(name, payload) {
    const [ns, owner] = parseName(name);
    if (ns !== "id" || owner !== this.id) throw new Error("can only publish under own /id namespace");
    const data = makeData({ name, payload, identity: this.identity });
    this.produced.set(name, data);
    return data;
  }

  announce() {
    const prefix = `/id/${this.id}`;
    const body = { prefix, origin: this.id, seq: ++this.annSeq, hops: 0 };
    this.send(null, { kind: "ann", ...body, pub: this.identity.pub, sig: this.identity.sign(canon({ prefix, origin: this.id, seq: body.seq })) });
  }

  onAnn(pkt, from, t) {
    const signed = { prefix: pkt.prefix, origin: pkt.origin, seq: pkt.seq };
    if (
      pkt.prefix !== `/id/${pkt.origin}` ||
      idFromPub(pkt.pub ?? "") !== pkt.origin ||
      !verifySig(pkt.pub, canon(signed), pkt.sig) ||
      pkt.origin === this.id
    ) {
      this.count("drop_bad_ann");
      return;
    }
    if ((this.seenAnn.get(pkt.origin) ?? -1) >= pkt.seq && !this.fibImproves(pkt)) return;
    this.seenAnn.set(pkt.origin, Math.max(this.seenAnn.get(pkt.origin) ?? -1, pkt.seq));
    const hops = pkt.hops + 1;
    const cur = this.fib.get(pkt.prefix);
    if (!cur || hops <= cur.hops || cur.expires <= t) {
      this.fib.set(pkt.prefix, { nextHop: from, hops, expires: t + this.cfg.annTtl });
    }
    if (hops < this.cfg.maxHops) this.send(null, { ...pkt, hops });
  }

  fibImproves(pkt) {
    const cur = this.fib.get(pkt.prefix);
    return !cur || pkt.hops + 1 < cur.hops;
  }

  /** Ask for a name. onData(data) fires when verified data arrives (cache hits fire immediately). */
  request(name, onData) {
    if (this.cs.has(name)) {
      const hit = this.cs.get(name);
      this.cs.delete(name);
      this.cs.set(name, hit);
      this.count("cs_hit_local");
      onData(hit);
      return;
    }
    const list = this.pending.get(name) ?? [];
    list.push(onData);
    this.pending.set(name, list);
    const pkt = { kind: "interest", name, nonce: sha256(`${this.id}|${name}|${this.now}|${list.length}`).slice(0, 16), hops: 0 };
    this.seenInterests.add(pkt.nonce);
    this.pit.set(name, { faces: new Set(["local"]), expires: this.now + this.cfg.pitLifetime });
    this.forwardInterest(pkt, null);
  }

  forwardInterest(pkt, from) {
    if (pkt.hops >= this.cfg.maxHops) return;
    const next = { ...pkt, hops: pkt.hops + 1 };
    const prefix = longestPrefix(this.fib, pkt.name);
    const route = prefix && this.fib.get(prefix);
    if (route && route.nextHop !== from && this.neighbors.has(route.nextHop)) {
      this.send(route.nextHop, next);
      this.count("interest_routed");
    } else {
      this.send(null, next);
      this.count("interest_flooded");
    }
  }

  lookupLocal(name) {
    const cached = this.cs.get(name);
    if (cached) return cached;
    const own = this.produced.get(name);
    if (own) return own;
    for (const resolve of this.resolvers) {
      const payload = resolve(name);
      if (payload !== undefined) {
        try {
          return makeData({ name, payload, identity: this.identity });
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  onInterest(pkt, from, t) {
    if (this.seenInterests.has(pkt.nonce)) return this.count("drop_dup_interest");
    this.seenInterests.add(pkt.nonce);
    bounded(this.seenInterests, this.cfg.seenLimit);

    const hit = this.lookupLocal(pkt.name);
    if (hit) {
      this.count(this.cs.has(pkt.name) ? "cs_hit_remote" : "served_local");
      this.send(from, hit);
      return;
    }
    const entry = this.pit.get(pkt.name);
    if (entry) {
      entry.faces.add(from);
      return this.count("pit_aggregated");
    }
    this.pit.set(pkt.name, { faces: new Set([from]), expires: t + this.cfg.pitLifetime });
    this.forwardInterest(pkt, from);
  }

  onData(pkt, from, t) {
    if (!verifyData(pkt)) return this.count("drop_bad_data");
    const entry = this.pit.get(pkt.name);
    if (!entry) return this.count("drop_unsolicited_data");
    this.pit.delete(pkt.name);
    this.cs.set(pkt.name, pkt);
    while (this.cs.size > this.cfg.csSize) this.cs.delete(this.cs.keys().next().value);
    for (const face of entry.faces) {
      if (face === "local") {
        for (const cb of this.pending.get(pkt.name) ?? []) cb(pkt);
        this.pending.delete(pkt.name);
      } else {
        this.send(face, pkt);
      }
    }
  }

  // Store-and-forward (delay-tolerant): signed bundles for a node that is not reachable now.
  // Binary spray-and-wait: hand half of the remaining copies to each new carrier,
  // and with one copy left, only deliver directly to the destination.
  sendBundle(dest, payload, { ttl = 200, copies = this.cfg.bundleCopies } = {}) {
    const body = { src: this.id, dest, payload, expires: this.now + ttl, nonce: this.bundleSeq++ };
    const id = sha256(canon(body)).slice(0, 24);
    const b = { id, ...body, pub: this.identity.pub, sig: this.identity.sign(canon({ id, ...body })) };
    this.bundles.set(id, { b, copies, sentTo: new Set() });
    for (const nid of this.neighbors.keys()) this.offerBundles(nid);
    return id;
  }

  verifyBundle(b) {
    const { sig, pub, ...rest } = b;
    return (
      typeof pub === "string" &&
      idFromPub(pub) === b.src &&
      sha256(canon({ src: b.src, dest: b.dest, payload: b.payload, expires: b.expires, nonce: b.nonce })).slice(0, 24) === b.id &&
      verifySig(pub, canon(rest), sig)
    );
  }

  offerBundles(neighborId) {
    const n = this.neighbors.get(neighborId);
    if (!n) return;
    for (const [id, e] of this.bundles) {
      if (n.bundles.has(id) || e.sentTo.has(neighborId) || e.b.expires <= this.now) continue;
      if (neighborId === e.b.dest) {
        this.send(neighborId, { kind: "bundle", b: e.b, copies: 1 });
      } else if (e.copies > 1) {
        const give = Math.floor(e.copies / 2);
        e.copies -= give;
        this.send(neighborId, { kind: "bundle", b: e.b, copies: give });
      } else {
        continue;
      }
      e.sentTo.add(neighborId);
      n.bundles.add(id);
    }
  }

  onBundle(pkt, from, t) {
    const { b } = pkt;
    if (!this.verifyBundle(b) || b.expires <= t) return this.count("drop_bad_bundle");
    if (b.dest === this.id) {
      if (!this.inbox.has(b.id)) {
        this.inbox.set(b.id, { src: b.src, payload: b.payload, at: t });
        this.count("bundle_delivered");
      }
      return;
    }
    if (this.bundles.has(b.id)) return this.count("drop_dup_bundle");
    if (this.bundles.size >= this.cfg.maxBundles) {
      const oldest = this.bundles.keys().next().value;
      this.bundles.delete(oldest);
      this.count("bundle_evicted");
    }
    const copies = Math.max(1, Math.min(pkt.copies ?? 1, this.cfg.bundleCopies));
    this.bundles.set(b.id, { b, copies, sentTo: new Set([from]) });
    for (const nid of this.neighbors.keys()) this.offerBundles(nid);
  }
}
