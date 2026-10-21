/**
 * Facet feed: watches one local folder and streams add/change/delete events
 * to the HUD over Server-Sent Events on the same 127.0.0.1 Vite server.
 * No network calls. Each file in the folder is one facet tile.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, watch } from "node:fs";
import { join, resolve } from "node:path";

const MAX_TILES = 4096;
const HASH_LIMIT = 8 * 1024 * 1024; // files larger than this are keyed by size+mtime, not hashed
const STREAM_PATH = "/facets/stream";
const STATE_PATH = "/facets/state";

/** Read one facet file into the record the client renders. */
export function readFacet(dir, name) {
  const full = join(dir, name);
  const st = statSync(full);
  if (!st.isFile()) return null;
  let hash;
  let lane = "unknown";
  let rows = 0;
  if (st.size <= HASH_LIMIT) {
    const buf = readFileSync(full);
    hash = createHash("sha1").update(buf).digest("hex").slice(0, 12);
    // crystal.tsv shape (vitalitychems-dot/memory crystal/): date \t lane \t kind \t name \t path
    for (const line of buf.toString("utf8").split("\n")) {
      if (!line.trim() || line.startsWith("#")) continue;
      rows += 1;
      if (lane === "unknown") {
        const cols = line.split("\t");
        if (cols.length >= 2 && cols[1].trim()) lane = cols[1].trim();
      }
    }
  } else {
    hash = createHash("sha1").update(`${st.size}:${st.mtimeMs}`).digest("hex").slice(0, 12);
  }
  return { name, size: st.size, mtimeMs: st.mtimeMs, hash, lane, rows };
}

export function scanFacets(dir) {
  const out = new Map();
  let names = [];
  try {
    names = readdirSync(dir).filter((n) => !n.startsWith(".") && n !== "README.md").sort();
  } catch {
    return out;
  }
  for (const name of names.slice(0, MAX_TILES)) {
    try {
      const rec = readFacet(dir, name);
      if (rec) out.set(name, rec);
    } catch {
      /* file vanished mid-scan; the next scan reports the delete */
    }
  }
  return out;
}

/** Compare two snapshots and return add/change/delete events. */
export function diffFacets(before, after, at = Date.now()) {
  const events = [];
  for (const [name, rec] of after) {
    const old = before.get(name);
    if (!old) events.push({ type: "add", at, ...rec });
    else if (old.hash !== rec.hash || old.size !== rec.size) events.push({ type: "change", at, ...rec });
  }
  for (const [name, rec] of before) {
    if (!after.has(name)) events.push({ type: "delete", at, ...rec });
  }
  return events;
}

/** Watch a folder; call onEvents(list) for every batch of changes. */
export function watchFacets(dir, onEvents, { debounceMs = 120, pollMs = 3000 } = {}) {
  let snap = scanFacets(dir);
  let timer = null;
  const rescan = () => {
    timer = null;
    const next = scanFacets(dir);
    const events = diffFacets(snap, next);
    snap = next;
    if (events.length) onEvents(events);
  };
  const kick = () => {
    if (!timer) timer = setTimeout(rescan, debounceMs);
  };
  let watcher = null;
  let mode = "fs.watch";
  try {
    watcher = watch(dir, { persistent: false }, kick);
    watcher.on("error", () => {});
  } catch {
    // Folder missing, or no inotify instance left (EMFILE): poll faster instead.
    mode = "poll";
    pollMs = Math.min(pollMs, 1000);
  }
  const poll = setInterval(kick, pollMs);
  poll.unref?.();
  return {
    mode: () => mode,
    snapshot: () => [...snap.values()],
    close() {
      watcher?.close();
      clearInterval(poll);
      if (timer) clearTimeout(timer);
    },
  };
}

function hostAllowed(req) {
  const host = String(req.headers.host || "").replace(/:\d+$/, "");
  return host === "127.0.0.1" || host === "localhost" || host === "[::1]";
}

/** Vite plugin: same middleware on dev and preview, so the HUD needs one port. */
export function facetFeedPlugin({ dir }) {
  const folder = resolve(dir);
  const clients = new Set();
  let feed = null;
  const log = [];

  const start = () => {
    if (feed) return;
    feed = watchFacets(folder, (events) => {
      for (const ev of events) {
        log.push(ev);
        if (log.length > 200) log.shift();
        const line = `event: facet\ndata: ${JSON.stringify(ev)}\n\n`;
        for (const res of clients) res.write(line);
      }
    });
  };

  const middleware = (req, res, next) => {
    const path = (req.url || "").split("?")[0];
    if (path !== STREAM_PATH && path !== STATE_PATH) return next();
    if (!hostAllowed(req)) {
      res.statusCode = 403;
      res.end("local only");
      return;
    }
    start();
    if (path === STATE_PATH) {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ dir: folder, mode: feed.mode(), facets: feed.snapshot(), recent: log.slice(-20) }));
      return;
    }
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(`event: snapshot\ndata: ${JSON.stringify({ dir: folder, mode: feed.mode(), facets: feed.snapshot() })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 15000);
    req.on("close", () => {
      clearInterval(ping);
      clients.delete(res);
    });
  };

  return {
    name: "tessera-facet-feed",
    configureServer(server) {
      server.middlewares.use(middleware);
      server.httpServer?.on("close", () => feed?.close());
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
      server.httpServer?.on("close", () => feed?.close());
    },
  };
}
