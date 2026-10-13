#!/usr/bin/env node
// Conditional GitHub reads for TESSERA scan endpoints.
//
// PR #295 (scripts/loop/pr-cache.mjs) already caches the open-PR list.
// This wrapper does not call that path. SCAN_ENDPOINTS is the rest of the scan.
//
// TESSERA_ENABLE_ETAG_CACHE=1 turns the cache on. Any other value, including
// unset, is a passthrough: no cache read, no cache write, no If-None-Match.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ENABLE_FLAG = "TESSERA_ENABLE_ETAG_CACHE";

/** Covered by https://github.com/vitalitychems-dot/TESSERA/pull/295 — do not cache here. */
export const OPEN_PR_LIST_PATH = "/repos/vitalitychems-dot/TESSERA/pulls?state=open&per_page=100";

/** Scan reads #295 does not cover. */
export const SCAN_ENDPOINTS = [
  "/repos/vitalitychems-dot/TESSERA/commits?per_page=100",
  "/repos/vitalitychems-dot/TESSERA/issues?state=open&per_page=100",
  "/repos/vitalitychems-dot/TESSERA/branches?per_page=100",
  "/repos/vitalitychems-dot/TESSERA/contents/",
];

export function etagCacheEnabled(env = process.env) {
  return env[ENABLE_FLAG] === "1";
}

export function cacheFileForUrl(cacheDir, url) {
  const key = createHash("sha256").update(`GET ${url}`).digest("hex");
  return join(cacheDir, `${key}.json`);
}

export function readCacheEntry(file) {
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return { ok: false, reason: "miss" };
    return { ok: false, reason: "corrupt" };
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.etag !== "string" || parsed.etag.length === 0) {
      return { ok: false, reason: "corrupt" };
    }
    if (typeof parsed.body !== "string") return { ok: false, reason: "corrupt" };
    return { ok: true, etag: parsed.etag, body: parsed.body };
  } catch {
    return { ok: false, reason: "corrupt" };
  }
}

export function writeCacheEntry(file, entry) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ etag: entry.etag, body: entry.body }), "utf8");
  renameSync(tmp, file);
}

function headerValue(headers, name) {
  if (!headers) return null;
  const want = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === want) return value ?? null;
  }
  return null;
}

/**
 * @param {object} options
 * @param {string} options.url
 * @param {string} options.cacheDir directory for `.cache/etag` files (gitignored via `.cache/`)
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {Record<string, string>} [options.headers]
 * @param {(req: {url: string, headers: Record<string, string>}) => Promise<{status: number, body: string, headers?: Record<string, string>}>} options.request
 * @returns {Promise<{status: number, body: string, headers: Record<string, string>, etag: string|null, unchanged: boolean}>}
 */
export async function cachedGet({ url, cacheDir, env = process.env, headers = {}, request }) {
  if (!etagCacheEnabled(env)) {
    const response = await request({ url, headers: { ...headers } });
    return {
      status: response.status,
      body: response.body,
      headers: response.headers ?? {},
      etag: headerValue(response.headers, "etag"),
      unchanged: false,
    };
  }

  const file = cacheFileForUrl(cacheDir, url);
  const cached = readCacheEntry(file);
  const outbound = { ...headers };
  if (cached.ok) outbound["If-None-Match"] = cached.etag;

  const response = await request({ url, headers: outbound });
  if (response.status === 304 && cached.ok) {
    return {
      status: 304,
      body: cached.body,
      headers: response.headers ?? {},
      etag: headerValue(response.headers, "etag") || cached.etag,
      unchanged: true,
    };
  }

  let fresh = response;
  if (response.status === 304) {
    const retryHeaders = { ...headers };
    delete retryHeaders["If-None-Match"];
    delete retryHeaders["if-none-match"];
    fresh = await request({ url, headers: retryHeaders });
  }

  const etag = headerValue(fresh.headers, "etag");
  if (fresh.status === 200 && etag && typeof fresh.body === "string") {
    writeCacheEntry(file, { etag, body: fresh.body });
  }
  return {
    status: fresh.status,
    body: fresh.body,
    headers: fresh.headers ?? {},
    etag,
    unchanged: false,
  };
}

export function toGithubApiUrl(pathOrUrl) {
  if (/^https:\/\/api\.github\.com\//.test(pathOrUrl)) return pathOrUrl;
  return `https://api.github.com/${pathOrUrl.replace(/^\//, "")}`;
}

export async function githubRequest({ url, headers, token, fetchImpl = globalThis.fetch }) {
  const outbound = {
    Accept: "application/vnd.github+json",
    "User-Agent": "tessera-etagcache",
    "X-GitHub-Api-Version": "2022-11-28",
    ...headers,
  };
  if (token && !outbound.Authorization && !outbound.authorization) {
    outbound.Authorization = `Bearer ${token}`;
  }
  const response = await fetchImpl(url, { method: "GET", headers: outbound });
  const body = await response.text();
  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key.toLowerCase()] = value;
  });
  return { status: response.status, body, headers: responseHeaders };
}

function readGhToken() {
  const fromEnv = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (fromEnv) return fromEnv;
  const result = spawnSync("gh", ["auth", "token"], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error("gh auth token failed");
  }
  return result.stdout.trim();
}

/**
 * Flag off: `gh api <args>` with inherited stdio (same stdout, stderr, and exit code).
 * Flag on: conditional GET. Body on stdout. The line `unchanged` on stderr when the
 * response is a 304 served from cache, so callers can skip re-parsing.
 */
export async function runCli(argv, deps = {}) {
  const env = deps.env ?? process.env;
  const spawnImpl = deps.spawnImpl ?? spawnSync;
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  if (!etagCacheEnabled(env)) {
    const result = spawnImpl("gh", ["api", ...argv], {
      stdio: "inherit",
      env,
    });
    return result.status ?? 1;
  }
  const pathArg = argv.find((arg) => !arg.startsWith("-"));
  if (!pathArg) {
    stderr.write("usage: etagcache.mjs <gh api path>\n");
    return 2;
  }
  const cacheDir = deps.cacheDir ?? join(process.cwd(), ".cache", "etag");
  const request = deps.request ?? (async (req) => githubRequest({ ...req, token: deps.token ?? readGhToken() }));
  const result = await cachedGet({
    url: toGithubApiUrl(pathArg),
    cacheDir,
    env,
    request,
  });
  stdout.write(result.body);
  if (result.unchanged) stderr.write("unchanged\n");
  return result.status >= 200 && result.status < 300 || result.status === 304 ? 0 : 1;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  runCli(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    },
  );
}
