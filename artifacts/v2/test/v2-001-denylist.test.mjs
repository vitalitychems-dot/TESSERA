import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { createGateServer, reviewFile, reviewRequest } from "../src/hyb011-denylist.mjs";

const REFUSED = [
  "/wallet",
  "/api/wallet/balance",
  "/payments/checkout",
  "/payment/stripe",
  "/vault/secrets",
  "/data/vault/notes.md",
  "/1T/parts/000",
  "/repos/1t/readme",
  "/files?path=vault/hidden",
  "/open?repo=1T",
];

test("fixture requests to wallet, payment, vault, and 1T paths are refused", async () => {
  const gate = createGateServer();
  for (const url of REFUSED) {
    const decision = reviewRequest({ url, method: "GET" });
    assert.equal(decision.allowed, false, url);
    assert.equal(decision.status, 403, url);
    const response = await gate(new Request(`http://v2.local${url}`));
    assert.equal(response.status, 403, url);
    const body = await response.json();
    assert.equal(body.refused, true, url);
    assert.equal(body.reason, "hyb-011-denied");
  }
});

test("ordinary studio and mesh routes stay open", async () => {
  const gate = createGateServer();
  for (const url of ["/studio/tasks", "/mesh/index", "/health", "/knowledge/graph"]) {
    const decision = reviewRequest({ url });
    assert.equal(decision.allowed, true, url);
    const response = await gate(new Request(`http://v2.local${url}`));
    assert.equal(response.status, 200, url);
  }
});

test("file admission refuses vault, wallet, payment, and 1T paths", () => {
  for (const filePath of [
    "1T/secret.md",
    "archive/vault/notes.txt",
    "routes/wallet.ts",
    "routes/payments/checkout.ts",
    "src/sacred-knowledge-vault.ts",
  ]) {
    assert.equal(reviewFile(filePath).allowed, false, filePath);
  }
  assert.equal(reviewFile("docs/v2/BUILD-LOG.md").allowed, true);
  assert.equal(reviewFile("artifacts/v2/src/hyb011-denylist.mjs").allowed, true);
});

test("a loopback fixture server refuses the denylisted routes", async () => {
  const gate = createGateServer();
  const server = createServer(async (req, res) => {
    const response = await gate(new Request(`http://127.0.0.1${req.url}`, { method: req.method }));
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try {
    const denied = await fetch(`http://127.0.0.1:${port}/wallet`);
    assert.equal(denied.status, 403);
    const allowed = await fetch(`http://127.0.0.1:${port}/studio/tasks`);
    assert.equal(allowed.status, 200);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
