import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, statSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MeshNode } from "./mesh-node.ts";

const dir = () => mkdtempSync(join(tmpdir(), "mesh-"));
const wait = async (f: () => boolean, ms = 5000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error("timeout"); await new Promise((r) => setTimeout(r, 25)); } };

test("mesh is off by default and refuses to start", async () => {
  const n = new MeshNode({ dataDir: dir() });
  assert.equal(n.enabled, false);
  await assert.rejects(n.start(), /mesh is off/);
});

test("identity is created once, stored 0600, stable across restarts", () => {
  const d = dir();
  const a = new MeshNode({ dataDir: d });
  const b = new MeshNode({ dataDir: d });
  assert.equal(a.id.nodeId, b.id.nodeId);
  assert.equal(statSync(join(d, "node-identity.json")).mode & 0o777, 0o600);
  assert.ok(!("privateKeyPem" in a.id));
});

test("agent join is refused while owner toggle is off; join/decline/leave are logged with reasons", () => {
  const n = new MeshNode({ dataDir: dir() });
  assert.equal(n.agentJoin("cordnation", "share pages").ok, false);
  n.setEnabled(true);
  assert.equal(n.agentJoin("cordnation", "share pages").ok, true);
  assert.ok(n.agents.has("cordnation"));
  assert.equal(n.agentDecline("security", "not needed for my lane").ok, true);
  assert.ok(!n.agents.has("security"));
  n.agentLeave("cordnation", "done");
  assert.ok(!n.agents.has("cordnation"));
  const log = n.choices();
  assert.deepEqual(log.map((c) => [c.agent, c.action, c.ok]), [
    ["cordnation", "join", false], ["cordnation", "join", true], ["security", "decline", true], ["cordnation", "leave", true],
  ]);
  assert.ok(log.every((c) => c.reason.length > 0));
});

test("two local instances discover each other and sync one signed page", async () => {
  const port = 46000 + Math.floor(Math.random() * 1000);
  const a = new MeshNode({ dataDir: dir(), discoveryPort: port });
  const b = new MeshNode({ dataDir: dir(), discoveryPort: port });
  a.setEnabled(true); b.setEnabled(true);
  a.cachePage({ path: "mesh/offline-internet.md", text: "# Offline internet" });
  await a.start(); await b.start();
  try {
    await wait(() => b.peers.has(a.id.nodeId) && a.peers.has(b.id.nodeId));
    assert.equal(await b.syncPage(a.id.nodeId, "mesh/offline-internet.md"), true);
    assert.equal(b.pages.get("mesh/offline-internet.md")?.text, "# Offline internet");
    const raw = readFileSync(join(a["opt"].dataDir, "node-identity.json"), "utf8");
    assert.ok(raw.includes("PRIVATE KEY")); // stays on disk locally
  } finally { await a.stop(); await b.stop(); }
});

test("turning the toggle off stops the node", async () => {
  const n = new MeshNode({ dataDir: dir(), discoveryPort: 47500 });
  n.setEnabled(true); await n.start();
  n.setEnabled(false);
  await new Promise((r) => setTimeout(r, 50));
  await assert.rejects(n.syncPage("x", "y"), /mesh is off/);
});
