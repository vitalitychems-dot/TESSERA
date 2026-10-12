/**
 * OPT mesh relay. Fetch once, share everywhere, stay under each source's limit.
 * No proxy rotation. The fetcher is injected so tests never touch the live web.
 */
import { createHash } from "node:crypto";

/** OPT-22 + OPT-25: one upstream fetch per key per TTL; concurrent asks share one in-flight call. */
export function createRelay(fetcher, { ttlMs = 60_000, now = () => Date.now(), coalesce = true } = {}) {
  const cache = new Map();
  const inflight = new Map();
  let upstream = 0, hits = 0;
  return {
    async get(key) {
      const row = cache.get(key);
      if (row && now() - row.at < ttlMs) { hits++; return row.value; }
      if (coalesce && inflight.has(key)) { hits++; return inflight.get(key); }
      upstream++;
      const p = Promise.resolve(fetcher(key)).then((value) => { cache.set(key, { value, at: now() }); inflight.delete(key); return value; });
      inflight.set(key, p);
      return p;
    },
    stats: () => ({ upstream, hits }),
  };
}

/** OPT-23: token bucket paced under a published limit (per second). */
export function createBucket({ ratePerSec, burst = ratePerSec, now = () => Date.now() }) {
  let tokens = burst, last = now();
  return {
    take() {
      const t = now();
      tokens = Math.min(burst, tokens + ((t - last) / 1000) * ratePerSec);
      last = t;
      if (tokens >= 1) { tokens -= 1; return 0; }
      return Math.ceil(((1 - tokens) / ratePerSec) * 1000);
    },
  };
}

/** OPT-24: wait for Retry-After on 429 instead of hammering. */
export async function politeFetch(call, { maxTries = 4, sleep = async () => {} } = {}) {
  let calls = 0;
  for (let i = 0; i < maxTries; i++) {
    calls++;
    const res = await call();
    if (res.status !== 429) return { res, calls };
    await sleep((Number(res.retryAfter) || 2 ** i) * 1000);
  }
  return { res: { status: 429 }, calls };
}

/** OPT-26a: content-addressed store. Same bytes are stored once. */
export function createCasStore() {
  const blobs = new Map();
  const names = new Map();
  return {
    put(name, text) {
      const h = createHash("sha256").update(text).digest("hex");
      if (!blobs.has(h)) blobs.set(h, text);
      names.set(name, h);
      return h;
    },
    get: (name) => blobs.get(names.get(name)),
    bytes: () => [...blobs.values()].reduce((n, b) => n + Buffer.byteLength(b), 0),
  };
}

/** OPT-26b: delta sync by hash manifest. Only changed pages cross the mesh. */
export const manifest = (pages) => Object.fromEntries(Object.entries(pages).map(([k, v]) => [k, createHash("sha256").update(v).digest("hex")]));
export function deltaSync(local, remoteManifest) {
  const send = {};
  for (const [k, v] of Object.entries(local)) if (remoteManifest[k] !== createHash("sha256").update(v).digest("hex")) send[k] = v;
  return send;
}
