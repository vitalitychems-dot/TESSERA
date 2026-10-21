/**
 * App-shell service worker. Navigation while offline returns the shell page.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const SHELL_PATH = "/offline-shell.html";

export const SHELL_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Tessera offline</title></head>
<body><main id="offline-shell"><h1>Offline</h1><p>The studio shell is on this device.</p></main></body>
</html>
`;

export function serviceWorkerSource() {
  return `const CACHE = "tessera-v2-shell";
const SHELL = ${JSON.stringify(SHELL_PATH)};
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(SHELL)));
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(SHELL)));
});
`;
}

export function emitServiceWorker(dir) {
  mkdirSync(dir, { recursive: true });
  const swPath = join(dir, "sw.js");
  const shellPath = join(dir, "offline-shell.html");
  writeFileSync(swPath, serviceWorkerSource());
  writeFileSync(shellPath, SHELL_HTML);
  return { swPath, shellPath };
}

export function navigateOffline({ online, path }) {
  if (online) return { url: path, shell: false, html: "" };
  return { url: SHELL_PATH, shell: true, html: SHELL_HTML };
}
