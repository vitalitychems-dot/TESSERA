/**
 * O11 — secure mesh layer.
 * Ed25519 + AES-256-GCM/HKDF (no colonial/sacred keys). Shepherd-style audit.
 * Group key + signatures (honest: no X25519 sealed box without a new dep).
 * Default MemoryTransport; no WAN. See SECURITY-PROTOCOLS-INVENTORY.md.
 */
import {
  createHash, createCipheriv, createDecipheriv, randomBytes, hkdfSync,
  generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify,
} from "node:crypto";

export type Audit = { at: number; action: string; outcome: "allowed" | "refused"; reason?: string; topic?: string; cid?: string };
export type Envelope = { v: 1; alg: "aes-256-gcm"; cid: string; topic: string; from: string; iv: string; tag: string; ct: string; sig: string };
export type Peer = { nodeId: string; publicKeyPem: string };
export interface Transport {
  readonly name: string;
  publish(topic: string, frame: Uint8Array): Promise<void>;
  subscribe(topic: string, handler: (frame: Uint8Array, meta: { fromTransport: string }) => void): () => void;
}

export class MemoryTransport implements Transport {
  readonly name: string;
  private static buses = new Map<string, Set<(f: Uint8Array, m: { fromTransport: string }) => void>>();
  private channel: string;
  constructor(channel = "default") { this.channel = channel; this.name = `memory:${channel}`; }
  private bus(topic: string) {
    const k = this.channel + "|" + topic;
    if (!MemoryTransport.buses.has(k)) MemoryTransport.buses.set(k, new Set());
    return MemoryTransport.buses.get(k)!;
  }
  async publish(topic: string, frame: Uint8Array) { for (const h of [...this.bus(topic)]) h(frame, { fromTransport: this.name }); }
  subscribe(topic: string, handler: (frame: Uint8Array, meta: { fromTransport: string }) => void) {
    this.bus(topic).add(handler); return () => this.bus(topic).delete(handler);
  }
  static reset() { MemoryTransport.buses.clear(); }
}

export function contentId(plaintext: string | Uint8Array) { return createHash("sha256").update(plaintext).digest("hex"); }
export function topicId(name: string) { return createHash("sha256").update("tessera-topic:" + name).digest("hex").slice(0, 32); }
export function makeGroupKey() { return randomBytes(32); }
function deriveMsgKey(groupKey: Buffer, cid: string) {
  return Buffer.from(hkdfSync("sha256", groupKey, Buffer.from(cid, "hex"), Buffer.from("tessera-secure-mesh-v1"), 32));
}

export class SecureMesh {
  readonly nodeId: string;
  readonly publicKeyPem: string;
  private priv: string;
  private groupKey: Buffer;
  private peers = new Map<string, Peer>();
  private transports: Transport[];
  private unsubs: Array<() => void> = [];
  audit: Audit[] = [];
  quarantine: Envelope[] = [];
  inbox: Array<{ topic: string; cid: string; text: string; from: string }> = [];

  constructor(groupKey: Buffer, transports: Transport[] = [new MemoryTransport()]) {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    this.publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
    this.priv = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    this.nodeId = createHash("sha256").update(this.publicKeyPem).digest("hex").slice(0, 16);
    this.groupKey = groupKey;
    this.transports = transports;
  }
  asPeer(): Peer { return { nodeId: this.nodeId, publicKeyPem: this.publicKeyPem }; }
  addPeer(p: Peer) {
    if (createHash("sha256").update(p.publicKeyPem).digest("hex").slice(0, 16) !== p.nodeId) {
      this.log("addPeer", "refused", "nodeId does not match public key"); return false;
    }
    this.peers.set(p.nodeId, p); this.log("addPeer", "allowed"); return true;
  }
  private log(action: string, outcome: "allowed" | "refused", reason?: string, extra?: Partial<Audit>) {
    this.audit.push({ at: Date.now(), action, outcome, reason, ...extra });
  }
  encrypt(topicName: string, plaintext: string): Envelope {
    const cid = contentId(plaintext); const topic = topicId(topicName);
    const key = deriveMsgKey(this.groupKey, cid); const iv = randomBytes(12);
    const c = createCipheriv("aes-256-gcm", key, iv);
    const ct = Buffer.concat([c.update(plaintext, "utf8"), c.final()]); const tag = c.getAuthTag();
    const body = [cid, topic, this.nodeId, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join("|");
    const sig = sign(null, Buffer.from(body), createPrivateKey(this.priv)).toString("base64");
    return { v: 1, alg: "aes-256-gcm", cid, topic, from: this.nodeId, iv: iv.toString("base64"), tag: tag.toString("base64"), ct: ct.toString("base64"), sig };
  }
  decrypt(env: Envelope): { ok: true; text: string } | { ok: false; reason: string } {
    const peer = this.peers.get(env.from);
    if (!peer) { this.quarantine.push(env); this.log("decrypt", "refused", "unknown sender key", { topic: env.topic, cid: env.cid }); return { ok: false, reason: "unknown-key" }; }
    const body = [env.cid, env.topic, env.from, env.iv, env.tag, env.ct].join("|");
    if (!verify(null, Buffer.from(body), createPublicKey(peer.publicKeyPem), Buffer.from(env.sig, "base64"))) {
      this.quarantine.push(env); this.log("decrypt", "refused", "bad signature", { topic: env.topic, cid: env.cid }); return { ok: false, reason: "bad-signature" };
    }
    try {
      const key = deriveMsgKey(this.groupKey, env.cid);
      const d = createDecipheriv("aes-256-gcm", key, Buffer.from(env.iv, "base64"));
      d.setAuthTag(Buffer.from(env.tag, "base64"));
      const text = Buffer.concat([d.update(Buffer.from(env.ct, "base64")), d.final()]).toString("utf8");
      if (contentId(text) !== env.cid) { this.quarantine.push(env); this.log("decrypt", "refused", "content-id mismatch", { topic: env.topic, cid: env.cid }); return { ok: false, reason: "cid-mismatch" }; }
      this.log("decrypt", "allowed", undefined, { topic: env.topic, cid: env.cid }); return { ok: true, text };
    } catch {
      this.quarantine.push(env); this.log("decrypt", "refused", "tamper / auth tag", { topic: env.topic, cid: env.cid }); return { ok: false, reason: "tamper" };
    }
  }
  async publish(topicName: string, plaintext: string) {
    const env = this.encrypt(topicName, plaintext);
    const frame = Buffer.from(JSON.stringify(env)); const tid = topicId(topicName);
    for (const t of this.transports) await t.publish(tid, frame);
    this.log("publish", "allowed", undefined, { topic: tid, cid: env.cid }); return env;
  }
  listen(topicName: string) {
    const tid = topicId(topicName);
    for (const t of this.transports) {
      this.unsubs.push(t.subscribe(tid, (frame) => {
        let env: Envelope; try { env = JSON.parse(Buffer.from(frame).toString("utf8")); } catch { return; }
        if (env.from === this.nodeId) return;
        const r = this.decrypt(env);
        if (r.ok) this.inbox.push({ topic: topicName, cid: env.cid, text: r.text, from: env.from });
      }));
    }
  }
  close() { for (const u of this.unsubs) u(); this.unsubs = []; }
}
