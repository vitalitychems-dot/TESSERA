#!/usr/bin/env node
// Conditional GitHub reads for TESSERA scan endpoints.
//
// PR #295 (scripts/loop/pr-cache.mjs) already caches the open-PR list.
// This wrapper does not call that path. SCAN_ENDPOINTS is the rest of the scan.
//
// TESSERA_ENABLE_ETAG_CACHE is on when unset. Exactly "0" opts out:
// no cache read, no cache write, no If-None-Match.

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
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

export const DEFAULT_ACCEPT = "application/vnd.github+json";
export const DEFAULT_API_VERSION = "2022-11-28";

export const OFF_VALUES = new Set(["0", "false", "off", "no"]);

/** On when unset. 0, false, off or no (any case, surrounding spaces ignored) turn it off. */
export function etagCacheEnabled(env = process.env) {
  const value = env[ENABLE_FLAG];
  if (value === undefined) return true;
  return !OFF_VALUES.has(String(value).trim().toLowerCase());
}

function headerValue(headers, name) {
  if (!headers) return null;
  const want = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === want) return value ?? null;
  }
  return null;
}

/** Token used for the cache key. Never written to the cache file. */
export function resolveToken({ token, headers, env = {} } = {}) {
  if (typeof token === "string") return token;
  const authorization = headerValue(headers, "authorization");
  if (authorization) {
    const bearer = /^Bearer\s+(\S+)/i.exec(String(authorization).trim());
    if (bearer) return bearer[1];
  }
  return env.GH_TOKEN || env.GITHUB_TOKEN || "";
}

/**
 * Cache identity is url + sha256(token) + Accept + X-GitHub-Api-Version.
 * The raw token is only an input to sha256.
 */
export function cacheKeyMaterial({ url, token = "", headers = {} } = {}) {
  const accept = String(headerValue(headers, "accept") ?? DEFAULT_ACCEPT).trim();
  const apiVersion = String(headerValue(headers, "x-github-api-version") ?? DEFAULT_API_VERSION).trim();
  const tokenHash = createHash("sha256").update(String(token)).digest("hex");
  return `${url}\n${tokenHash}\n${accept}\n${apiVersion}`;
}

export function cacheFileForUrl(cacheDir, url, options = {}) {
  const token = resolveToken({ token: options.token, headers: options.headers, env: options.env });
  const key = createHash("sha256").update(cacheKeyMaterial({ url, token, headers: options.headers })).digest("hex");
  return join(cacheDir, `${key}.json`);
}

const CACHE_DIR_MODE = 0o700;
const CACHE_FILE_MODE = 0o600;

export function readCacheEntry(file, deps = {}) {
  const readImpl = deps.readFileSync ?? readFileSync;
  let raw;
  try {
    raw = readImpl(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EPERM") return { ok: false, reason: "miss" };
    return { ok: false, reason: "corrupt" };
  }
  const statImpl = deps.statSync ?? statSync;
  const getuid = deps.getuid ?? (() => (typeof process.getuid === "function" ? process.getuid() : undefined));
  let ownerUid;
  try {
    ownerUid = statImpl(file).uid;
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EPERM") return { ok: false, reason: "miss" };
    return { ok: false, reason: "corrupt" };
  }
  const myUid = getuid();
  if (typeof myUid === "number" && typeof ownerUid === "number" && ownerUid !== myUid) {
    return { ok: false, reason: "miss" };
  }
  const chmodImpl = deps.chmodSync ?? chmodSync;
  try {
    chmodImpl(file, CACHE_FILE_MODE);
  } catch (error) {
    if (error?.code !== "EPERM") throw error;
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
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true, mode: CACHE_DIR_MODE });
  chmodSync(dir, CACHE_DIR_MODE);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ etag: entry.etag, body: entry.body }), {
    encoding: "utf8",
    mode: CACHE_FILE_MODE,
  });
  chmodSync(tmp, CACHE_FILE_MODE);
  renameSync(tmp, file);
  chmodSync(file, CACHE_FILE_MODE);
}

function isApiPath(arg) {
  return typeof arg === "string" && arg.length > 0 && !arg.startsWith("-");
}

/**
 * Cache only an exact allowlist. Anything else, including -f/-F/--raw-field/--field,
 * --jq/-q, -H, -i, and --input, must be passed to gh api unchanged.
 * Allowed: `<path>` or `<path> -X GET` in either order.
 * Bare `graphql`, `/graphql`, and literal `{owner}` / `{repo}` / `{branch}` placeholders pass through.
 * @returns {string|null}
 */
function isPlaceholderPath(path) {
  return path === "graphql"
    || path === "/graphql"
    || path.includes("{owner}")
    || path.includes("{repo}")
    || path.includes("{branch}");
}

export function cacheablePath(argv) {
  let path = null;
  if (argv.length === 1 && isApiPath(argv[0])) path = argv[0];
  else if (argv.length === 3 && argv[0] === "-X" && argv[1] === "GET" && isApiPath(argv[2])) path = argv[2];
  else if (argv.length === 3 && isApiPath(argv[0]) && argv[1] === "-X" && argv[2] === "GET") path = argv[0];
  if (path === null || isPlaceholderPath(path)) return null;
  return path;
}

/**
 * @param {object} options
 * @param {string} options.url
 * @param {string} options.cacheDir directory for `.cache/etag` files (gitignored via `.cache/`)
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {string} [options.token] sent as Authorization by the transport; hashed into the cache key, never stored
 * @param {Record<string, string>} [options.headers]
 * @param {(req: {url: string, headers: Record<string, string>}) => Promise<{status: number, body: string, headers?: Record<string, string>}>} options.request
 * @param {object} [options.readDeps] replacements for readCacheEntry (tests)
 * @returns {Promise<{status: number, body: string, headers: Record<string, string>, etag: string|null, unchanged: boolean}>}
 */
export async function cachedGet({ url, cacheDir, env = process.env, token, headers = {}, request, readDeps }) {
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

  const file = cacheFileForUrl(cacheDir, url, { token, headers, env });
  const cached = readCacheEntry(file, readDeps);
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
    Accept: DEFAULT_ACCEPT,
    "User-Agent": "tessera-etagcache",
    "X-GitHub-Api-Version": DEFAULT_API_VERSION,
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

function spawnGhApi(spawnImpl, argv, env) {
  const result = spawnImpl("gh", ["api", ...argv], {
    stdio: "inherit",
    env,
  });
  return result.status ?? 1;
}

/**
 * Flag unset (or any value other than "0"): allowlisted argv only
 * (`<path>` or `<path> -X GET` in either order) uses a conditional GET.
 * Body on stdout. The line `unchanged` on stderr when the response is a 304
 * served from cache, so callers can skip re-parsing. Every other argv is
 * `gh api` with the same arguments.
 * Flag "0": `gh api <args>` with inherited stdio (same stdout, stderr, and exit code).
 */
export async function runCli(argv, deps = {}) {
  const env = deps.env ?? process.env;
  const spawnImpl = deps.spawnImpl ?? spawnSync;
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const pathArg = etagCacheEnabled(env) ? cacheablePath(argv) : null;
  if (!pathArg) {
    return spawnGhApi(spawnImpl, argv, env);
  }
  const cacheDir = deps.cacheDir ?? join(process.cwd(), ".cache", "etag");
  const token = deps.token ?? (deps.request ? resolveToken({ env }) : readGhToken());
  const request = deps.request ?? (async (req) => githubRequest({ ...req, token }));
  const result = await cachedGet({
    url: toGithubApiUrl(pathArg),
    cacheDir,
    env,
    token,
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
