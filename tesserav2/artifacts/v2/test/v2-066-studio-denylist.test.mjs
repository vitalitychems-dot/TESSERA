import assert from "node:assert/strict";
import { request } from "node:http";
import test from "node:test";
import { openDemoStudio } from "../src/studio/serve.mjs";
import { createStudio, listenStudio } from "../src/studio/wall.mjs";
import { listenMonitor } from "../src/studio/worker-stream.mjs";

// Raw paths: the node client sends them as-is, so /a/../vault is not
// normalized away before the denylist sees it.
const REFUSED = ["/wallet", "/api/Payments", "/a/../vault"];

function rawStatus(port, path, method = "GET") {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path, method }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

test("the studio server refuses wallet, payment, and vault paths", async () => {
  const { server, url } = await listenStudio(createStudio(), { buildLogPath: null });
  const { port } = new URL(url);
  try {
    for (const path of REFUSED) {
      const denied = await rawStatus(Number(port), path);
      assert.equal(denied.status, 403, path);
      assert.match(denied.body, /hyb-011-denied/, path);
    }
    const queryDenied = await rawStatus(Number(port), "/state?next=vault/pick");
    assert.equal(queryDenied.status, 403);
    for (const path of ["/", "/state", "/world", "/events", "/civic"]) {
      const open = await rawStatus(Number(port), path);
      assert.equal(open.status, 200, path);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("the demo studio from serve.mjs refuses the same paths", async () => {
  const { server, url } = await openDemoStudio();
  const { port } = new URL(url);
  try {
    for (const path of REFUSED) {
      const denied = await rawStatus(Number(port), path);
      assert.equal(denied.status, 403, path);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("the monitor server refuses the same paths", async () => {
  const { server, url } = await listenMonitor();
  const { port } = new URL(url);
  try {
    for (const path of REFUSED) {
      const denied = await rawStatus(Number(port), path);
      assert.equal(denied.status, 403, path);
      assert.match(denied.body, /hyb-011-denied/, path);
    }
    const open = await rawStatus(Number(port), "/events");
    assert.equal(open.status, 200);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
