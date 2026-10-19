import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { startServer } from "../server.mjs";
import { threeAvailable, workspacePayload, worldPayload } from "../lib/world.mjs";

const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");

test("every control has a handler", () => {
  for (const m of html.matchAll(/data-action="([^"]+)"/g)) assert.match(app, new RegExp(`\\b${m[1]}:`), m[1]);
});

test("world is derived from the real memory graph and changes over time", () => {
  const last = worldPayload();
  assert.ok(last.events > 1 && last.columns.length > 0);
  assert.equal(last.blocks, last.columns.reduce((s, c) => s + c.h, 0));
  const early = worldPayload(0);
  assert.ok(early.columns.length < last.columns.length, "4D: earlier t has fewer nodes");
  const cells = new Set(last.columns.map((c) => `${c.x},${c.z}`));
  assert.equal(cells.size, last.columns.length, "no two columns share a cell");
});

test("workspace reflects real bus messages", async () => {
  const bus = await import("../../api-server/src/lib/agi/agent-bus.ts");
  bus.publish("test", "nextgen-probe", { x: 1 }, 99);
  const ws = await workspacePayload();
  assert.ok(ws.candidates.some((c) => c.topic === "nextgen-probe"));
});

test("server serves page, world, brain, three", async () => {
  const s = await startServer(0);
  const base = `http://127.0.0.1:${s.address().port}`;
  try {
    assert.equal((await fetch(base + "/")).status, 200);
    assert.ok((await (await fetch(base + "/api/world?t=3")).json()).t === 3);
    assert.ok((await (await fetch(base + "/api/brain")).json()).nodeCount > 0);
    assert.equal((await fetch(base + "/vendor/three.module.js")).status, threeAvailable() ? 200 : 404);
  } finally { s.close(); }
});
