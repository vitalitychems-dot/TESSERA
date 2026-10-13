/**
 * Shepherd pull loop. The gateway node is the only one that talks to the web.
 * Each pull: per-source token bucket -> politeFetch (Retry-After) -> relay (fetch-once,
 * coalescing) -> conditional GET (ETag/Last-Modified) -> normalize -> signed snapshot.
 * Snapshots are content-addressed files under <cache>/snapshots, listed in a signed
 * manifest that offline nodes delta-sync (USB/LAN/GitMesh) and verify with the pinned key.
 */
import { createHash, generateKeyPairSync, sign, verify, createPublicKey } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, statSync, lstatSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { createBucket, politeFetch } from "../opt/relay.mjs";
import { SOURCES, UA, parseSse } from "./sources.mjs";

const sha = (s) => createHash("sha256").update(s).digest("hex");
const canon = (o) => JSON.stringify(o, Object.keys(o).sort());

export function newKeys() { return generateKeyPairSync("ed25519"); }

/** Real HTTP transport. Bounded SSE read; one connection; no proxies. */
export function httpTransport({ timeoutMs = 20000 } = {}) {
  return async (src, url, cond = {}) => {
    const headers = { "User-Agent": UA, Accept: "application/json", ...(src.headers || {}) };
    if (cond.etag) headers["If-None-Match"] = cond.etag;
    if (cond.lastModified) headers["If-Modified-Since"] = cond.lastModified;
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: ac.signal, redirect: "follow" });
      let body = "";
      if (src.format === "sse" && res.ok) {
        const reader = res.body.getReader(); const dec = new TextDecoder();
        while (parseSse(body, src.maxEvents).length < src.maxEvents) { const { value, done } = await reader.read(); if (done) break; body += dec.decode(value); }
        ac.abort();
      } else if (res.status !== 304) body = await res.text();
      return { status: res.status, retryAfter: res.headers.get("retry-after"), etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified"), body };
    } finally { clearTimeout(t); }
  };
}

export function createShepherd({ transport, cacheDir, keys, now = () => Date.now(), sleep = (ms) => new Promise((r) => setTimeout(r, ms)), sources = SOURCES }) {
  const buckets = new Map(); const cond = new Map(); const lastPull = new Map(); const latest = new Map();
  mkdirSync(join(cacheDir, "snapshots"), { recursive: true });
  const pubPem = keys.publicKey.export({ type: "spki", format: "pem" });
  writeFileSync(join(cacheDir, "shepherd.pub.pem"), pubPem);

  async function pull(src) {
    if (src.disabled) return { id: src.id, status: "disabled", reason: src.disabled };
    const url = src.url();
    const last = lastPull.get(src.id);
    if (last !== undefined && now() - last < src.ttlS * 1000) return { id: src.id, status: "cached", hash: latest.get(src.id) };
    if (!buckets.has(src.id)) buckets.set(src.id, createBucket({ ratePerSec: src.rps, burst: 1, now }));
    for (let w = buckets.get(src.id).take(); w > 0; w = buckets.get(src.id).take()) await sleep(w);
    let res, calls;
    try { ({ res, calls } = await politeFetch(() => transport(src, url, cond.get(src.id) || {}), { sleep })); }
    catch (e) { lastPull.set(src.id, now()); return { id: src.id, status: "net-error", error: String(e.cause?.code || e.message).slice(0, 80) }; }
    lastPull.set(src.id, now());
    if (res.status === 304) return { id: src.id, status: "not-modified", calls, hash: latest.get(src.id) };
    if (res.status !== 200) return { id: src.id, status: `http-${res.status}`, calls };
    cond.set(src.id, { etag: res.etag, lastModified: res.lastModified });
    let items;
    try {
      const data = src.format === "text" ? res.body : src.format === "sse" ? parseSse(res.body, src.maxEvents) : JSON.parse(res.body);
      items = src.parse(data).filter((x) => x && Object.values(x).some(Boolean));
    } catch (e) { return { id: src.id, status: "parse-error", error: String(e.message).slice(0, 120) }; }
    const fetchedAt = new Date(now()).toISOString();
    const payload = { source: src.id, url, fetched_at: fetchedAt, ttl_s: src.ttlS, license: src.license, items };
    const bodyHash = sha(canon(payload));
    const sig = sign(null, Buffer.from(bodyHash), keys.privateKey).toString("base64");
    const snap = { ...payload, sha256: bodyHash, sig };
    writeFileSync(join(cacheDir, "snapshots", `${bodyHash}.json`), JSON.stringify(snap));
    latest.set(src.id, bodyHash);
    return { id: src.id, status: "ok", calls, items: items.length, hash: bodyHash };
  }

  function writeManifest() {
    const entries = Object.fromEntries([...latest].sort());
    const body = canon({ generated_at: new Date(now()).toISOString(), entries: canon(entries) });
    const m = { generated_at: new Date(now()).toISOString(), entries, sig: sign(null, Buffer.from(sha(body)), keys.privateKey).toString("base64") };
    writeFileSync(join(cacheDir, "manifest.json"), JSON.stringify(m, null, 1));
    return m;
  }

  /** One pass over all sources, sequential so pacing is honest. */
  async function runOnce(ids) {
    const out = [];
    for (const s of sources) if (!ids || ids.includes(s.id)) out.push(await pull(s));
    writeManifest();
    return out;
  }
  return { pull, runOnce, writeManifest, pubPem };
}

/** Offline node: verify a snapshot against the pinned gateway key, and flag staleness. */
export function verifySnapshot(snap, pubPem, now = Date.now()) {
  const { sha256, sig, ...payload } = snap;
  if (sha(canon(payload)) !== sha256) return { ok: false, why: "hash" };
  if (!verify(null, Buffer.from(sha256), createPublicKey(pubPem), Buffer.from(sig, "base64"))) return { ok: false, why: "sig" };
  return { ok: true, stale: now - Date.parse(payload.fetched_at) > payload.ttl_s * 1000 };
}

export function verifyManifest(m, pubPem) {
  const body = canon({ generated_at: m.generated_at, entries: canon(m.entries) });
  return verify(null, Buffer.from(sha(body)), createPublicKey(pubPem), Buffer.from(m.sig, "base64"));
}

/**
 * Offline sync: copy only snapshots the node doesn't have (delta by content address).
 * Snapshot filenames are their sha256. Size mismatch => re-send without hashing; same size =>
 * byte-compare node vs gateway (no SHA-256 on either side), so same-size corruption is re-sent. Symlinks are never
 * trusted or written through, on either side. Signatures are still checked by verifySnapshot.
 */
const isLink = (p) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };
export function syncTo(gatewayDir, nodeDir) {
  const gwSnaps = join(gatewayDir, "snapshots"), nodeSnaps = join(nodeDir, "snapshots");
  mkdirSync(nodeSnaps, { recursive: true });
  const have = new Map(), links = new Set();
  for (const d of readdirSync(nodeSnaps, { withFileTypes: true })) {
    if (d.isSymbolicLink()) links.add(d.name);
    else if (d.isFile()) have.set(d.name, statSync(join(nodeSnaps, d.name)).size);
  }
  let sent = 0;
  for (const d of readdirSync(gwSnaps, { withFileTypes: true })) {
    if (!d.isFile() || links.has(d.name)) continue;
    const f = d.name, src = join(gwSnaps, f), dst = join(nodeSnaps, f);
    if (have.get(f) === statSync(src).size && readFileSync(dst).equals(readFileSync(src))) continue;
    writeFileSync(dst, readFileSync(src));
    sent++;
  }
  for (const f of ["manifest.json", "shepherd.pub.pem"]) {
    const dst = join(nodeDir, f);
    if (existsSync(join(gatewayDir, f)) && !isLink(dst)) copyFileSync(join(gatewayDir, f), dst);
  }
  return sent;
}
