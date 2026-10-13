import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ENABLE_FLAG,
  OPEN_PR_LIST_PATH,
  SCAN_ENDPOINTS,
  cacheFileForUrl,
  cachedGet,
  readCacheEntry,
  runCli,
} from "./etagcache.mjs";

const ENDPOINT = "https://api.github.com/repos/vitalitychems-dot/TESSERA/contents/";

function tempCache() {
  return mkdtempSync(join(tmpdir(), "etagcache-"));
}

test("scan endpoints exclude the open-PR list cached by PR #295", () => {
  assert.equal(SCAN_ENDPOINTS.length, 4);
  for (const endpoint of SCAN_ENDPOINTS) {
    assert.equal(endpoint.includes("/pulls"), false, endpoint);
  }
  assert.match(OPEN_PR_LIST_PATH, /\/pulls\?state=open/);
});

test("cache miss stores the ETag and body", async () => {
  const cacheDir = tempCache();
  const calls = [];
  const result = await cachedGet({
    url: ENDPOINT,
    cacheDir,
    env: { [ENABLE_FLAG]: "1" },
    request: async (req) => {
      calls.push(req);
      return { status: 200, body: "{\"ok\":1}", headers: { etag: "\"e1\"" } };
    },
  });
  assert.equal(result.unchanged, false);
  assert.equal(result.status, 200);
  assert.equal(result.body, "{\"ok\":1}");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].headers["If-None-Match"], undefined);
  const stored = readCacheEntry(cacheFileForUrl(cacheDir, ENDPOINT));
  assert.equal(stored.ok, true);
  assert.equal(stored.etag, "\"e1\"");
  assert.equal(stored.body, "{\"ok\":1}");
});

test("304 returns the cached body and an unchanged marker", async () => {
  const cacheDir = tempCache();
  let phase = "miss";
  const calls = [];
  const request = async (req) => {
    calls.push(req.headers["If-None-Match"] ?? null);
    if (phase === "miss") {
      return { status: 200, body: "{\"fresh\":true}", headers: { etag: "\"e1\"" } };
    }
    return { status: 304, body: "", headers: { etag: "\"e1\"" } };
  };
  const first = await cachedGet({ url: ENDPOINT, cacheDir, env: { [ENABLE_FLAG]: "1" }, request });
  phase = "hit";
  const second = await cachedGet({ url: ENDPOINT, cacheDir, env: { [ENABLE_FLAG]: "1" }, request });
  assert.equal(first.unchanged, false);
  assert.equal(second.status, 304);
  assert.equal(second.unchanged, true);
  assert.equal(second.body, "{\"fresh\":true}");
  assert.deepEqual(calls, [null, "\"e1\""]);
});

test("flag off is a passthrough and does not touch the cache", async () => {
  const cacheDir = tempCache();
  const file = join(cacheDir, "seed.json");
  writeFileSync(file, "{\"etag\":\"\\\"stale\\\"\",\"body\":\"CACHED\"}\n");
  const before = statSync(file).mtimeMs;
  const calls = [];
  for (const value of [undefined, "0", "true", "yes", ""]) {
    const env = {};
    if (value !== undefined) env[ENABLE_FLAG] = value;
    const result = await cachedGet({
      url: ENDPOINT,
      cacheDir,
      env,
      headers: { Accept: "application/vnd.github+json" },
      request: async (req) => {
        calls.push(req.headers);
        return { status: 200, body: "LIVE", headers: { etag: "\"live\"" } };
      },
    });
    assert.equal(result.unchanged, false);
    assert.equal(result.body, "LIVE");
  }
  assert.equal(calls.length, 5);
  for (const headers of calls) {
    assert.equal(headers["If-None-Match"], undefined);
    assert.equal(headers.Accept, "application/vnd.github+json");
  }
  assert.equal(readFileSync(file, "utf8"), "{\"etag\":\"\\\"stale\\\"\",\"body\":\"CACHED\"}\n");
  assert.equal(statSync(file).mtimeMs, before);
  assert.deepEqual(readdirSync(cacheDir), ["seed.json"]);
});

test("corrupt cache falls back to a full read and is rewritten", async () => {
  const cacheDir = tempCache();
  const cases = ["{", "{\"etag\":1,\"body\":\"x\"}", "{\"etag\":\"\\\"e\\\"\"}", ""];
  for (const garbage of cases) {
    const dir = tempCache();
    const file = cacheFileForUrl(dir, ENDPOINT);
    writeFileSync(file, garbage);
    const calls = [];
    const result = await cachedGet({
      url: ENDPOINT,
      cacheDir: dir,
      env: { [ENABLE_FLAG]: "1" },
      request: async (req) => {
        calls.push(req.headers["If-None-Match"] ?? null);
        return { status: 200, body: "RECOVERED", headers: { ETag: "\"new\"" } };
      },
    });
    assert.equal(result.unchanged, false);
    assert.equal(result.body, "RECOVERED");
    assert.deepEqual(calls, [null]);
    const stored = readCacheEntry(file);
    assert.equal(stored.ok, true);
    assert.equal(stored.etag, "\"new\"");
    assert.equal(stored.body, "RECOVERED");
  }
});

test("flag off CLI spawns gh api with the same arguments", async () => {
  const spawned = [];
  const code = await runCli(["repos/vitalitychems-dot/TESSERA/contents/", "-H", "Accept: application/json"], {
    env: {},
    spawnImpl: (cmd, args) => {
      spawned.push([cmd, args]);
      return { status: 0 };
    },
    request: async () => {
      throw new Error("passthrough must not call the cache transport");
    },
  });
  assert.equal(code, 0);
  assert.deepEqual(spawned, [[
    "gh",
    ["api", "repos/vitalitychems-dot/TESSERA/contents/", "-H", "Accept: application/json"],
  ]]);
});
