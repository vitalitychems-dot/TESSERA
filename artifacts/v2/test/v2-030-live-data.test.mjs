import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { SOURCES, byId, parseSse, UA } from "../src/live/sources.mjs";
import { createShepherd, newKeys, verifySnapshot, verifyManifest, syncTo } from "../src/live/shepherd.mjs";

const fx = (id) => new URL(`./fixtures/live/${id}.txt`, import.meta.url);
const fixtureTransport = (log = []) => async (src, url, cond) => {
  log.push({ id: src.id, url, cond });
  return { status: 200, etag: `"${src.id}"`, body: readFileSync(fx(src.id), "utf8") };
};
const tmp = () => mkdtempSync(join(tmpdir(), "live-"));

test("34 sources, all https, keyless, licensed, paced", () => {
  assert.equal(SOURCES.length, 34);
  for (const s of SOURCES) {
    const u = s.url();
    assert.match(u, /^https:\/\//, s.id);
    assert.doesNotMatch(u, /api[_-]?key|token=|apikey|access_token|DEMO_KEY/i, s.id);
    assert.ok(s.license && s.published, s.id);
    if (!s.disabled) assert.ok(s.rps > 0 && s.ttlS > 0, s.id);
  }
  assert.match(UA, /TESSERA-shepherd.*noreply/);
});

test("no excluded categories or proxy settings in the adapter layer", () => {
  const src = readFileSync(new URL("../src/live/sources.mjs", import.meta.url), "utf8") + readFileSync(new URL("../src/live/shepherd.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(src, /coingecko|wallet|proxy|x-forwarded-for|captcha|rotate/i);
});

test("pace stays below published limits for strict sources", () => {
  assert.ok(byId.arxiv.rps < 1 / 3);
  assert.ok(byId.github.rps * 3600 <= 30);
  assert.ok(byId.nominatim.rps < 1);
  assert.ok(byId["ncbi-eutils"].rps < 3);
  assert.ok(byId.gdelt.rps < 0.2);
  assert.ok(byId["open-meteo"].rps * 86400 < 10000);
  assert.ok(byId.celestrak.ttlS >= 7200);
  assert.ok(byId["osm-tiles"].disabled);
});

test("every enabled adapter parses its recorded fixture", () => {
  for (const s of SOURCES.filter((x) => !x.disabled)) {
    assert.ok(existsSync(fx(s.id)), `fixture for ${s.id}`);
    const body = readFileSync(fx(s.id), "utf8");
    const data = s.format === "text" ? body : s.format === "sse" ? parseSse(body, s.maxEvents) : JSON.parse(body);
    const items = s.parse(data);
    assert.ok(items.length >= 1, `${s.id} items`);
    assert.ok(items.some((i) => i.id || i.title), `${s.id} content`);
  }
});

test("shepherd writes signed snapshots; offline node verifies and delta-syncs", async () => {
  const gw = tmp(), node = tmp(), keys = newKeys();
  let t = Date.parse("2026-10-12T20:00:00Z");
  const sh = createShepherd({ transport: fixtureTransport(), cacheDir: gw, keys, now: () => t, sleep: async (ms) => { t += ms; } });
  const res = await sh.runOnce();
  assert.equal(res.filter((r) => r.status === "ok").length, 32);
  assert.equal(res.filter((r) => r.status === "disabled").length, 2);
  const m = JSON.parse(readFileSync(join(gw, "manifest.json"), "utf8"));
  assert.ok(verifyManifest(m, sh.pubPem));
  assert.equal(syncTo(gw, node), 32);
  assert.equal(syncTo(gw, node), 0, "second sync sends nothing");
  const pub = readFileSync(join(node, "shepherd.pub.pem"), "utf8");
  for (const f of readdirSync(join(node, "snapshots"))) {
    const snap = JSON.parse(readFileSync(join(node, "snapshots", f), "utf8"));
    const v = verifySnapshot(snap, pub, t);
    assert.ok(v.ok, f);
    assert.ok(snap.license && snap.fetched_at && snap.url);
  }
  const one = JSON.parse(readFileSync(join(node, "snapshots", readdirSync(join(node, "snapshots"))[0]), "utf8"));
  assert.equal(verifySnapshot({ ...one, items: [] }, pub, t).ok, false, "tamper detected");
  assert.equal(verifySnapshot(one, pub, t + 999_999_999).stale, true);
});

test("TTL cache, conditional GET, 304 and Retry-After are honoured", async () => {
  const log = []; let t = 0; const sleeps = [];
  let calls = 0;
  const transport = async (src, url, cond) => {
    log.push(cond); calls++;
    if (calls === 1) return { status: 200, etag: '"e1"', body: readFileSync(fx("usgs-quakes"), "utf8") };
    if (calls === 2) return { status: 429, retryAfter: "7" };
    return { status: 304 };
  };
  const sh = createShepherd({ transport, cacheDir: tmp(), keys: newKeys(), now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; } });
  const src = byId["usgs-quakes"];
  assert.equal((await sh.pull(src)).status, "ok");
  assert.equal((await sh.pull(src)).status, "cached");
  assert.equal(calls, 1);
  t += src.ttlS * 1000 + 1;
  const r = await sh.pull(src);
  assert.equal(r.status, "not-modified");
  assert.equal(log[1].etag, '"e1"');
  assert.ok(sleeps.includes(7000));
});

test("token bucket spaces requests to the source's pace", async () => {
  let t = 0; const sleeps = [];
  const sh = createShepherd({ transport: fixtureTransport(), cacheDir: tmp(), keys: newKeys(), now: () => t, sleep: async (ms) => { sleeps.push(ms); t += ms; },
    sources: [{ ...byId.arxiv, ttlS: 0.001 }] });
  for (let i = 0; i < 3; i++) { await sh.runOnce(); t += 1; }
  assert.ok(sleeps.filter((s) => s >= 3000).length >= 2, JSON.stringify(sleeps));
});

test("syncTo: content-addressed delta skips present files and repairs truncated ones", async () => {
  const { writeFileSync: w, statSync: st } = await import("node:fs");
  let t = Date.parse("2026-10-13T00:00:00Z");
  const gw = tmp(), node = tmp();
  const sh = createShepherd({ transport: fixtureTransport(), cacheDir: gw, keys: newKeys(), now: () => t, sleep: async () => {} });
  await sh.runOnce();
  const n1 = syncTo(gw, node);
  assert.ok(n1 > 0);
  assert.equal(syncTo(gw, node), 0);
  const f = readdirSync(join(node, "snapshots"))[0];
  w(join(node, "snapshots", f), "x");
  assert.equal(syncTo(gw, node), 1, "size-mismatched file is re-sent");
  assert.equal(st(join(node, "snapshots", f)).size, st(join(gw, "snapshots", f)).size);
  t += 86400e3; await sh.runOnce();
  assert.equal(syncTo(gw, node), n1, "only the new round is sent");
});

test("syncTo: same-size corruption is re-sent; symlinks are skipped and never written through", async () => {
  const { writeFileSync: w, readFileSync: r, symlinkSync, unlinkSync } = await import("node:fs");
  const gw = tmp(), node = tmp(), outside = tmp();
  const sh = createShepherd({ transport: fixtureTransport(), cacheDir: gw, keys: newKeys(), now: () => Date.parse("2026-10-13T00:00:00Z"), sleep: async () => {} });
  await sh.runOnce();
  const n = syncTo(gw, node);
  const [f, g] = readdirSync(join(node, "snapshots"));
  const orig = r(join(node, "snapshots", f), "utf8");
  const i = orig.indexOf('"items"') + 10;
  w(join(node, "snapshots", f), orig.slice(0, i) + (orig[i] === "Z" ? "Y" : "Z") + orig.slice(i + 1));
  assert.equal(r(join(node, "snapshots", f), "utf8").length, orig.length);
  assert.equal(syncTo(gw, node), 1, "same-size corrupt file is re-sent");
  assert.equal(r(join(node, "snapshots", f), "utf8"), orig);
  const target = join(outside, "victim.txt"); w(target, "keep");
  unlinkSync(join(node, "snapshots", g)); symlinkSync(target, join(node, "snapshots", g));
  assert.equal(syncTo(gw, node), 0, "symlinked entry is skipped");
  assert.equal(r(target, "utf8"), "keep", "never written through the link");
  assert.ok(n > 1);
});
