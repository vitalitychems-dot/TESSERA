import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, statSync } from "node:fs";
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

test("a different token is a cache miss and the raw token is not stored", async () => {
  const cacheDir = tempCache();
  const tokenA = "ghs_cache_key_alpha";
  const tokenB = "ghs_cache_key_beta";
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const calls = [];
  const request = async (req) => {
    calls.push(req.headers["If-None-Match"] ?? null);
    if (calls.length === 1) return { status: 200, body: "FOR-A", headers: { etag: "\"ea\"" } };
    if (calls.length === 2) return { status: 304, body: "", headers: { etag: "\"ea\"" } };
    return { status: 200, body: "FOR-B", headers: { etag: "\"eb\"" } };
  };
  const env = { [ENABLE_FLAG]: "1" };
  const first = await cachedGet({ url: ENDPOINT, cacheDir, env, token: tokenA, headers, request });
  const again = await cachedGet({ url: ENDPOINT, cacheDir, env, token: tokenA, headers, request });
  const other = await cachedGet({ url: ENDPOINT, cacheDir, env, token: tokenB, headers, request });
  assert.equal(first.unchanged, false);
  assert.equal(first.body, "FOR-A");
  assert.equal(again.unchanged, true);
  assert.equal(again.body, "FOR-A");
  assert.equal(other.unchanged, false);
  assert.equal(other.body, "FOR-B");
  assert.deepEqual(calls, [null, "\"ea\"", null]);
  const fileA = cacheFileForUrl(cacheDir, ENDPOINT, { token: tokenA, headers });
  const fileB = cacheFileForUrl(cacheDir, ENDPOINT, { token: tokenB, headers });
  assert.notEqual(fileA, fileB);
  const stored = readdirSync(cacheDir).map((name) => `${name}\n${readFileSync(join(cacheDir, name), "utf8")}`).join("\n");
  assert.equal(stored.includes(tokenA), false);
  assert.equal(stored.includes(tokenB), false);
});

test("a different Accept header is a cache miss", async () => {
  const cacheDir = tempCache();
  const token = "ghs_cache_key_same";
  const version = { "X-GitHub-Api-Version": "2022-11-28" };
  const jsonHeaders = { Accept: "application/vnd.github+json", ...version };
  const diffHeaders = { Accept: "application/vnd.github.diff", ...version };
  const calls = [];
  const request = async (req) => {
    calls.push(req.headers["If-None-Match"] ?? null);
    if (calls.length === 1) return { status: 200, body: "JSON-BODY", headers: { etag: "\"ej\"" } };
    return { status: 200, body: "DIFF-BODY", headers: { etag: "\"ed\"" } };
  };
  const env = { [ENABLE_FLAG]: "1" };
  const first = await cachedGet({ url: ENDPOINT, cacheDir, env, token, headers: jsonHeaders, request });
  const other = await cachedGet({ url: ENDPOINT, cacheDir, env, token, headers: diffHeaders, request });
  assert.equal(first.body, "JSON-BODY");
  assert.equal(other.unchanged, false);
  assert.equal(other.body, "DIFF-BODY");
  assert.deepEqual(calls, [null, null]);
  assert.notEqual(
    cacheFileForUrl(cacheDir, ENDPOINT, { token, headers: jsonHeaders }),
    cacheFileForUrl(cacheDir, ENDPOINT, { token, headers: diffHeaders }),
  );
  const stored = readdirSync(cacheDir).map((name) => readFileSync(join(cacheDir, name), "utf8")).join("\n");
  assert.equal(stored.includes(token), false);
});

test("a different X-GitHub-Api-Version is a cache miss", async () => {
  const cacheDir = tempCache();
  const token = "ghs_cache_key_same";
  const v1 = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  const v2 = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2026-01-01" };
  const calls = [];
  const request = async (req) => {
    calls.push(req.headers["If-None-Match"] ?? null);
    return { status: 200, body: `body-${calls.length}`, headers: { etag: `"e${calls.length}"` } };
  };
  const env = { [ENABLE_FLAG]: "1" };
  await cachedGet({ url: ENDPOINT, cacheDir, env, token, headers: v1, request });
  const other = await cachedGet({ url: ENDPOINT, cacheDir, env, token, headers: v2, request });
  assert.equal(other.unchanged, false);
  assert.equal(other.body, "body-2");
  assert.deepEqual(calls, [null, null]);
});

test("cache files are mode 0600 and the cache directory is mode 0700", async () => {
  const previous = process.umask(0);
  try {
    const parent = tempCache();
    const cacheDir = join(parent, "etag");
    mkdirSync(cacheDir, { mode: 0o755 });
    await cachedGet({
      url: ENDPOINT,
      cacheDir,
      env: { [ENABLE_FLAG]: "1" },
      request: async () => ({ status: 200, body: "{\"ok\":1}", headers: { etag: "\"e1\"" } }),
    });
    const file = cacheFileForUrl(cacheDir, ENDPOINT);
    assert.equal(statSync(file).mode & 0o777, 0o600);
    assert.equal(statSync(cacheDir).mode & 0o777, 0o700);
  } finally {
    process.umask(previous);
  }
});

test("flag on with -X other than GET bypasses the cache", async () => {
  const cacheDir = tempCache();
  const spawned = [];
  const argv = ["-X", "POST", "repos/vitalitychems-dot/TESSERA/contents/"];
  const code = await runCli(argv, {
    env: { [ENABLE_FLAG]: "1" },
    cacheDir,
    spawnImpl: (cmd, args) => {
      spawned.push([cmd, args]);
      return { status: 0 };
    },
    request: async () => {
      throw new Error("non-GET must not use the cache");
    },
  });
  assert.equal(code, 0);
  assert.deepEqual(spawned, [["gh", ["api", ...argv]]]);
  assert.deepEqual(readdirSync(cacheDir), []);
});

test("flag on with -X GET still uses the cache", async () => {
  const cacheDir = tempCache();
  const spawned = [];
  let calls = 0;
  const stdout = { written: "", write(chunk) { this.written += chunk; } };
  const urls = [];
  const code = await runCli(["-X", "GET", "repos/vitalitychems-dot/TESSERA/contents/"], {
    env: { [ENABLE_FLAG]: "1" },
    cacheDir,
    token: "ghs_plain_get",
    stdout,
    stderr: { write() {} },
    spawnImpl: (cmd, args) => {
      spawned.push([cmd, args]);
      return { status: 0 };
    },
    request: async (req) => {
      calls += 1;
      urls.push(req.url);
      return { status: 200, body: "CACHED-GET", headers: { etag: "\"eg\"" } };
    },
  });
  assert.equal(code, 0);
  assert.equal(calls, 1);
  assert.deepEqual(urls, [ENDPOINT]);
  assert.deepEqual(spawned, []);
  assert.equal(stdout.written, "CACHED-GET");
  assert.equal(statSync(cacheFileForUrl(cacheDir, ENDPOINT, {
    token: "ghs_plain_get",
  })).mode & 0o777, 0o600);
});

test("flag on with --paginate bypasses the cache", async () => {
  const cacheDir = tempCache();
  const spawned = [];
  const argv = ["repos/vitalitychems-dot/TESSERA/commits?per_page=100", "--paginate"];
  const code = await runCli(argv, {
    env: { [ENABLE_FLAG]: "1" },
    cacheDir,
    spawnImpl: (cmd, args) => {
      spawned.push([cmd, args]);
      return { status: 0 };
    },
    request: async () => {
      throw new Error("paginate must not use the cache");
    },
  });
  assert.equal(code, 0);
  assert.deepEqual(spawned, [["gh", ["api", ...argv]]]);
  assert.deepEqual(readdirSync(cacheDir), []);
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
