import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MeshNode } from "../../../preview/src/lib/mesh-node/mesh-node.ts";

function dataDir() {
  return mkdtempSync(join(tmpdir(), "v2-mesh-"));
}

async function waitFor(ready) {
  const start = Date.now();
  while (!ready()) {
    if (Date.now() - start > 5000) throw new Error("mesh peers did not meet");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

test("an agent join and leave are written to the mesh log", () => {
  const dir = mkdtempSync(join(tmpdir(), "v2-mesh-"));
  try {
    const node = new MeshNode({ dataDir: dir });
    assert.equal(node.enabled, false);
    assert.equal(node.agentJoin("worker", "share pages").ok, false);
    node.setEnabled(true);
    assert.equal(node.agentJoin("worker", "share pages").ok, true);
    node.agentLeave("worker", "done");
    assert.deepEqual(
      node.choices().map((row) => [row.agent, row.action, row.ok]),
      [
        ["worker", "join", false],
        ["worker", "join", true],
        ["worker", "leave", true],
      ],
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("two local nodes discover each other and sync one signed page", async () => {
  const port = 47000 + Math.floor(Math.random() * 1000);
  const a = new MeshNode({ dataDir: dataDir(), discoveryPort: port });
  const b = new MeshNode({ dataDir: dataDir(), discoveryPort: port });
  a.setEnabled(true);
  b.setEnabled(true);
  a.cachePage({ path: "mesh/offline-internet.md", text: "# Offline internet" });
  await a.start();
  await b.start();
  try {
    await waitFor(() => b.peers.has(a.id.nodeId) && a.peers.has(b.id.nodeId));
    assert.equal(await b.syncPage(a.id.nodeId, "mesh/offline-internet.md"), true);
    assert.equal(b.pages.get("mesh/offline-internet.md")?.text, "# Offline internet");
  } finally {
    await a.stop();
    await b.stop();
  }
});
