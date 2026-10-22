/**
 * O10 — node per install (opt-in).
 * - Mesh is OFF until the install owner turns it on (visible toggle in settings). Nothing is sent while off.
 * - Node identity: one ed25519 keypair made on first run, stored only in the local data dir (0600). The private key never leaves the device and is never sent.
 * - Agents may join/decline/leave with a logged reason, but only while the owner toggle is on.
 * - Discovery: LAN multicast announce (mDNS-style group 224.0.0.251, own JSON payload, not full DNS-SD).
 * - Sharing: read-only HTTP of cached Gitbook/GitMesh pages; pages are signed by the node key and verified on fetch.
 * - No self-copying, no installing anything on peers, no background traffic while off. No wallet or other keys.
 */
import { createHash, generateKeyPairSync, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import dgram from "node:dgram";
import http from "node:http";

export type Identity = { nodeId: string; publicKeyPem: string };
export type Page = { path: string; text: string };
export type AgentChoice = { at: string; agent: string; action: "join" | "decline" | "leave"; reason: string; ok: boolean; note?: string };

export function loadOrCreateIdentity(dataDir: string): Identity & { privateKeyPem: string } {
  mkdirSync(dataDir, { recursive: true });
  const file = join(dataDir, "node-identity.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const nodeId = createHash("sha256").update(publicKeyPem).digest("hex").slice(0, 16);
  const id = { nodeId, publicKeyPem, privateKeyPem };
  writeFileSync(file, JSON.stringify(id), { mode: 0o600 });
  return id;
}

export type NodeOptions = { dataDir: string; group?: string; discoveryPort?: number; httpHost?: string };

export class MeshNode {
  readonly id: Identity;
  private priv: string;
  private settingsFile: string;
  private logFile: string;
  pages = new Map<string, Page>();
  peers = new Map<string, { nodeId: string; url: string; publicKeyPem: string }>();
  agents = new Set<string>();
  private sock?: dgram.Socket;
  private server?: http.Server;
  url = "";

  private opt: NodeOptions;

  constructor(opt: NodeOptions) {
    this.opt = opt;
    const full = loadOrCreateIdentity(opt.dataDir);
    this.priv = full.privateKeyPem;
    this.id = { nodeId: full.nodeId, publicKeyPem: full.publicKeyPem };
    this.settingsFile = join(opt.dataDir, "mesh-settings.json");
    this.logFile = join(opt.dataDir, "agent-mesh-choices.jsonl");
  }

  /** Owner toggle. Default false. */
  get enabled(): boolean {
    return existsSync(this.settingsFile) ? JSON.parse(readFileSync(this.settingsFile, "utf8")).meshEnabled === true : false;
  }
  setEnabled(on: boolean) {
    writeFileSync(this.settingsFile, JSON.stringify({ meshEnabled: on }));
    if (!on) void this.stop();
  }

  private record(c: Omit<AgentChoice, "at">): AgentChoice {
    const row = { at: new Date().toISOString(), ...c };
    appendFileSync(this.logFile, JSON.stringify(row) + "\n");
    return row;
  }
  agentJoin(agent: string, reason: string) {
    if (!this.enabled) return this.record({ agent, action: "join", reason, ok: false, note: "owner mesh toggle is off" });
    this.agents.add(agent);
    return this.record({ agent, action: "join", reason, ok: true });
  }
  agentDecline(agent: string, reason: string) {
    this.agents.delete(agent);
    return this.record({ agent, action: "decline", reason, ok: true });
  }
  agentLeave(agent: string, reason: string) {
    this.agents.delete(agent);
    return this.record({ agent, action: "leave", reason, ok: true });
  }
  choices(): AgentChoice[] {
    return existsSync(this.logFile) ? readFileSync(this.logFile, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  }

  cachePage(p: Page) { this.pages.set(p.path, p); }

  private signPage(p: Page) {
    return sign(null, Buffer.from(p.path + "\n" + p.text), createPrivateKey(this.priv)).toString("base64");
  }

  async start() {
    if (!this.enabled) throw new Error("mesh is off: the install owner has not turned it on");
    this.server = http.createServer((req, res) => {
      const u = new URL(req.url ?? "/", "http://x");
      if (req.method !== "GET") { res.writeHead(405).end(); return; }
      if (u.pathname === "/mesh/pages") { res.end(JSON.stringify([...this.pages.keys()])); return; }
      if (u.pathname === "/mesh/page") {
        const p = this.pages.get(u.searchParams.get("path") ?? "");
        if (!p) { res.writeHead(404).end(); return; }
        res.end(JSON.stringify({ ...p, nodeId: this.id.nodeId, sig: this.signPage(p) }));
        return;
      }
      res.writeHead(404).end();
    });
    await new Promise<void>((r) => this.server!.listen(0, this.opt.httpHost ?? "127.0.0.1", () => r()));
    const a = this.server.address() as { port: number };
    this.url = `http://${this.opt.httpHost ?? "127.0.0.1"}:${a.port}`;

    const group = this.opt.group ?? "224.0.0.251";
    const port = this.opt.discoveryPort ?? 5354;
    this.sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    this.sock.on("message", (buf) => {
      try {
        const m = JSON.parse(buf.toString());
        if (m.kind !== "tessera-mesh-hello" || m.nodeId === this.id.nodeId) return;
        if (createHash("sha256").update(m.publicKeyPem).digest("hex").slice(0, 16) !== m.nodeId) return;
        const fresh = !this.peers.has(m.nodeId);
        this.peers.set(m.nodeId, { nodeId: m.nodeId, url: m.url, publicKeyPem: m.publicKeyPem });
        if (fresh) this.announce();
      } catch { /* ignore junk */ }
    });
    await new Promise<void>((r) => this.sock!.bind(port, () => r()));
    this.sock.addMembership(group);
    this.sock.setMulticastLoopback(true);
    this.sock.setMulticastTTL(1); // LAN only
    this.announce();
  }

  /** One announce packet. Only called on start and when a new peer appears — no timer. */
  announce() {
    if (!this.sock || !this.enabled) return;
    const msg = Buffer.from(JSON.stringify({ kind: "tessera-mesh-hello", nodeId: this.id.nodeId, url: this.url, publicKeyPem: this.id.publicKeyPem }));
    this.sock.send(msg, this.opt.discoveryPort ?? 5354, this.opt.group ?? "224.0.0.251");
  }

  /** Pull one page from a known peer and verify its signature. */
  async syncPage(peerId: string, path: string) {
    if (!this.enabled) throw new Error("mesh is off");
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error("unknown peer");
    const res = await fetch(`${peer.url}/mesh/page?path=${encodeURIComponent(path)}`);
    if (!res.ok) return false;
    const p = (await res.json()) as Page & { sig: string; nodeId: string };
    const ok = p.nodeId === peerId && verify(null, Buffer.from(p.path + "\n" + p.text), createPublicKey(peer.publicKeyPem), Buffer.from(p.sig, "base64"));
    if (ok) this.cachePage({ path: p.path, text: p.text });
    return ok;
  }

  async stop() {
    try { this.sock?.close(); } catch {}
    this.sock = undefined;
    await new Promise<void>((r) => (this.server ? this.server.close(() => r()) : r()));
    this.server = undefined;
  }
}
