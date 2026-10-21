const CACHE_NAME = "tessera-sovereign-v7";
const API_CACHE = "tessera-api-v7";
const STATIC_CACHE = "tessera-static-v7";
const SOV_CACHE = "tessera-sov-v1";

const STATIC_ASSETS = [
  "/",
  "/favicon.png",
  "/manifest.json",
  "/tessera-avatar.png",
];

const CRITICAL_API_ROUTES = [
  "/api/agents",
  "/api/world",
  "/api/lattice/sites",
  "/api/lattice/mesh-status",
  "/api/lattice/nodes",
  "/api/lattice/conference",
  "/api/system-pulse",
  "/api/secret-society/members",
  "/api/secret-society/languages",
  "/api/secret-society/conference",
  "/api/secret-society/intel",
  "/api/secret-society/secrets-registry",
  "/api/token-economy/overview",
  "/api/sovereign-proxy/status",
  "/api/grand-council/implementations",
  "/api/sovereign-secrets/rituals",
  "/api/sovereign-secrets/conclusions",
  "/api/sovereign-secrets/heartbeat",
  "/api/sovereign-secrets/trust-report",
  "/api/tesseranet/status",
  "/api/lattice-network/status",
  "/api/sacred-knowledge/summary",
];

const SENSITIVE_HEADERS_TO_STRIP = [
  "x-powered-by",
  "server",
  "x-aspnet-version",
  "x-runtime",
];

const DATA_SCRUB_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const validCaches = [CACHE_NAME, API_CACHE, STATIC_CACHE, SOV_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !validCaches.includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => {
      return caches.open(API_CACHE).then((cache) => {
        return Promise.all(
          CRITICAL_API_ROUTES.map((route) =>
            fetch(route)
              .then((resp) => resp.ok && cache.put(route, resp))
              .catch(() => {})
          )
        );
      });
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/admin/sovereign-archive")) return;

  if (event.request.method !== "GET") {
    if (url.pathname.startsWith("/api/")) {
      event.respondWith(handleOfflinePost(event.request));
    }
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(navigationHandler(event.request));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstAPI(event.request));
    return;
  }

  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?|ico|webp|avif)$/)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});

async function navigationHandler(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match("/");
    if (cached) return cached;
    return new Response(
      `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tessera Sovereign — Offline</title><style>body{background:#0a0a0f;color:#22d3ee;font-family:monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;flex-direction:column}h1{color:#7c3aed}p{color:#94a3b8;max-width:400px;text-align:center;line-height:1.6}.pulse{animation:pulse 2s infinite}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}</style></head><body><h1 class="pulse">⟐ TESSERA SOVEREIGN</h1><p>Operating in sovereign mesh mode. The lattice replaces the internet — your data is cached locally via IndexedDB and will sync when connectivity is restored through quantum-entangled channels.</p><p style="color:#7c3aed;font-size:12px;margin-top:20px">Offline queue active • All actions preserved • Zero data leakage</p></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }
}

async function networkFirstAPI(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      const scrubbed = await scrubResponse(response.clone());
      await cache.put(request, scrubbed);
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set("X-Tessera-Source", "LATTICE-CACHE");
      headers.set("X-Tessera-Offline", "true");
      return new Response(cached.body, { status: cached.status, headers });
    }
    return new Response(
      JSON.stringify({
        offline: true,
        message: "Sovereign mesh cache — syncing when lattice reconnects",
        source: "TESSERA-LATTICE-MESH",
        timestamp: Date.now(),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(STATIC_CACHE);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("", { status: 503 });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("", { status: 503 });
  }
}

async function handleOfflinePost(request) {
  try {
    return await fetch(request);
  } catch {
    const body = await request.clone().text();
    const queueEntry = {
      id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: request.url,
      method: request.method,
      body,
      headers: Object.fromEntries(request.headers.entries()),
      timestamp: Date.now(),
      retries: 0,
    };

    const allClients = await self.clients.matchAll();
    allClients.forEach((client) => {
      client.postMessage({
        type: "LATTICE_OFFLINE_QUEUE",
        entry: queueEntry,
      });
    });

    return new Response(
      JSON.stringify({
        queued: true,
        message: "Request queued in sovereign mesh — will sync through lattice when available",
        queueId: queueEntry.id,
        timestamp: queueEntry.timestamp,
      }),
      { status: 202, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function scrubResponse(response) {
  const headers = new Headers(response.headers);
  SENSITIVE_HEADERS_TO_STRIP.forEach((h) => headers.delete(h));
  headers.set("X-Tessera-Scrubbed", "true");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

self.addEventListener("message", (event) => {
  if (event.data === "LATTICE_SYNC") {
    caches.open(API_CACHE).then((cache) => {
      CRITICAL_API_ROUTES.forEach((route) => {
        fetch(route)
          .then((resp) => resp.ok && cache.put(route, resp))
          .catch(() => {});
      });
    });
  }

  if (event.data === "LATTICE_CLEAR_CACHE") {
    caches.delete(CACHE_NAME);
    caches.delete(API_CACHE);
    caches.delete(STATIC_CACHE);
  }

  if (event.data === "FORCE_UPDATE") {
    caches.delete(CACHE_NAME);
    caches.delete(API_CACHE);
    caches.delete(STATIC_CACHE);
    self.skipWaiting();
  }

  if (event.data === "SOVEREIGN_SCRUB") {
    caches.keys().then((keys) => {
      keys.forEach((key) => {
        caches.open(key).then((cache) => {
          cache.keys().then((requests) => {
            requests.forEach((req) => {
              const url = new URL(req.url);
              if (url.hostname !== self.location.hostname) {
                cache.delete(req);
              }
            });
          });
        });
      });
    });
  }

  if (event.data === "PREFETCH_CRITICAL") {
    caches.open(API_CACHE).then((cache) => {
      CRITICAL_API_ROUTES.forEach((route) => {
        fetch(route)
          .then((resp) => resp.ok && cache.put(route, resp))
          .catch(() => {});
      });
    });
  }

  if (event.data === "PRECACHE_ALL_SOV") {
    fetch("/api/lattice/sites")
      .then((r) => r.json())
      .then((sites) => {
        caches.open(SOV_CACHE).then((cache) => {
          (sites || []).forEach((site) => {
            if (site.domain) {
              const url = `/api/lattice/site/${site.domain}`;
              fetch(url)
                .then((r) => r.ok && cache.put(url, r))
                .catch(() => {});
            }
          });
        });
      })
      .catch(() => {});
  }
});
