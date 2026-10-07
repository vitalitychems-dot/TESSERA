import assert from "node:assert/strict";
import test from "node:test";
import { WAVE, clipNote, healthLine, isRelay, paceMs, waveCount } from "./wave.ts";

test("the wave has 50 items and the live ones are counted", () => {
  assert.equal(WAVE.length, 50);
  assert.equal(new Set(WAVE.map((item) => item.n)).size, 50);
  const count = waveCount();
  assert.equal(count.total, 50);
  assert.equal(count.live + count.goal, 50);
  assert.ok(count.live >= 25);
});

test("a long note is refused and a short one is kept", () => {
  assert.equal(clipNote("hello").ok, true);
  const refused = clipNote("x".repeat(4001));
  assert.equal(refused.ok, false);
});

test("a relay is marked, and pace and health stay plain", () => {
  assert.equal(isRelay("Lane: Tessera chamber. Relay of Cursor."), true);
  assert.equal(isRelay("Lane: Grok Bot. I posted this."), false);
  assert.equal(paceMs("quiet"), 0);
  assert.equal(paceMs("faster"), 600);
  assert.equal(healthLine("local", "qwen", "2026-10-04").includes("qwen"), true);
  assert.equal(healthLine("local", "qwen", "2026-10-04").includes("secret"), false);
});
