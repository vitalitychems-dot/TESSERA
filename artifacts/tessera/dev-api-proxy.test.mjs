import { createHash } from "node:crypto";
import { createServer as createHttpServer } from "node:http";
import { createRequire } from "node:module";
import { createServer as createNetServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import {
  DEV_PROXY_FORWARDING_HEADERS,
  attachDevProxyGuards,
  devApiProxy,
  devApiProxyBypass,
  devApiProxyTarget,
} from "./dev-api-proxy.mjs";

const devEnv = (extra = {}) => ({ PORT: "3000", BASE_PATH: "/", ...extra });

test("development serve proxies /api and /ws to the suite API port", () => {
  const proxy = devApiProxy("serve", "development", devEnv({ TESSERA_API_PORT: "5000" }));
  assert.ok(proxy);
  assert.equal(proxy["/api"].target, "http://127.0.0.1:5000");
  assert.equal(proxy["/ws"].target, "http://127.0.0.1:5000");
  for (const path of ["/api", "/ws"]) {
    assert.equal(proxy[path].changeOrigin, true);
    assert.equal(proxy[path].xfwd, false);
    assert.equal(proxy[path].ws, true);
    assert.equal(proxy[path].configure, attachDevProxyGuards);
  }
  assert.equal(typeof proxy["/api"].bypass, "function");
  assert.equal(proxy["/ws"].bypass, undefined);
});

test("build and production preview install no proxy", () => {
  const env = devEnv({ TESSERA_API_PORT: "5000" });
  assert.equal(devApiProxy("build", "development", env), undefined);
  assert.equal(devApiProxy("build", "production", env), undefined);
  assert.equal(devApiProxy("serve", "production", env), undefined);
});

test("a target that matches the web port is not proxied", () => {
  assert.equal(
    devApiProxyTarget(devEnv({ PORT: "5000", TESSERA_API_PORT: "5000" })),
    undefined,
  );
  assert.equal(
    devApiProxyTarget(devEnv({ PORT: "5000", VITE_API_URL: "http://localhost:5000" })),
    undefined,
  );
  assert.equal(devApiProxyTarget(devEnv({ PORT: "5000" })), undefined);
});

test("uses a loopback VITE_API_URL when the suite port is absent or invalid", () => {
  assert.equal(
    devApiProxyTarget(devEnv({ VITE_API_URL: "http://localhost:5001/api" })),
    "http://127.0.0.1:5001",
  );
  assert.equal(
    devApiProxyTarget(devEnv({ TESSERA_API_PORT: "nope", VITE_API_URL: "http://[::1]:5002" })),
    "http://[::1]:5002",
  );
  assert.equal(
    devApiProxyTarget(devEnv({ TESSERA_API_PORT: "5000", VITE_API_URL: "http://localhost:5001" })),
    "http://127.0.0.1:5000",
  );
});

test("does not proxy an explicit remote or credentialed API URL", () => {
  assert.equal(
    devApiProxyTarget(devEnv({ VITE_API_URL: "https://api.example.com" })),
    undefined,
  );
  assert.equal(
    devApiProxyTarget(devEnv({ VITE_API_URL: "http://user:secret@127.0.0.1:5000" })),
    undefined,
  );
  assert.equal(devApiProxyTarget(devEnv({ VITE_API_URL: "not a url" })), undefined);
});

test("defaults to loopback port 5000 when no API URL is configured", () => {
  assert.equal(devApiProxyTarget(devEnv()), "http://127.0.0.1:5000");
  assert.equal(devApiProxyTarget(devEnv({ VITE_API_URL: "   " })), "http://127.0.0.1:5000");
});

test("bypasses the internal session check and forwards ordinary API paths", () => {
  assert.equal(devApiProxyBypass("/api/internal/session-check"), false);
  assert.equal(devApiProxyBypass("/api/internal/session-check?x=1"), false);
  assert.equal(devApiProxyBypass("/api/internal"), false);
  assert.equal(devApiProxyBypass("/internal/session-check"), false);
  assert.equal(devApiProxyBypass("/api/operational-status"), undefined);
  assert.equal(devApiProxyBypass("/api/internalized"), undefined);
  assert.equal(devApiProxyBypass("/ws"), undefined);
});

test("strips the same forwarding headers the session check rejects", () => {
  const route = readFileSync(
    new URL("../api-server/src/routes/internal-session-check.ts", import.meta.url),
    "utf8",
  );
  const start = route.indexOf("const FORWARDING_HEADERS = [");
  const end = route.indexOf("] as const", start);
  const names = [...route.slice(start, end).matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(names.length >= 10);
  for (const name of names) {
    assert.ok(DEV_PROXY_FORWARDING_HEADERS.includes(name), name);
  }

  const removed = [];
  attachDevProxyGuards({
    on(event, listener) {
      if (event === "proxyReq") {
        listener({
          removeHeader(name) {
            removed.push(name);
          },
        });
      }
    },
  });
  assert.deepEqual(removed, DEV_PROXY_FORWARDING_HEADERS);
});

test("web config installs the dev proxy and preview stays unproxied", () => {
  const web = readFileSync(new URL("./vite.config.ts", import.meta.url), "utf8");
  assert.match(web, /devApiProxy\(command, mode, process\.env\)/);
  const previewBlock = web.slice(web.lastIndexOf("preview:"));
  assert.equal(previewBlock.includes("proxy"), false);
  const preview = readFileSync(new URL("../../preview/vite.config.ts", import.meta.url), "utf8");
  assert.equal(preview.includes("proxy"), false);
});

test("a running dev server reaches the loopback API and drops /api/internal", async () => {
  const require = createRequire(new URL("./package.json", import.meta.url));
  const vite = await import(pathToFileURL(require.resolve("vite")).href);
  const upstreamPort = await listenPort();
  const webPort = await listenPort();
  const seen = [];
  const upstream = createHttpServer((req, res) => {
    seen.push({ url: req.url, forwarded: req.headers["x-forwarded-for"] ?? null, host: req.headers.host });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, url: req.url }));
  });
  upstream.on("upgrade", (req, socket) => {
    seen.push({ url: req.url, upgrade: true, forwarded: req.headers["x-forwarded-for"] ?? null });
    const key = req.headers["sec-websocket-key"];
    const accept = createHash("sha1")
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
  });
  const sockets = new Set();
  upstream.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve) => upstream.listen(upstreamPort, "127.0.0.1", resolve));

  const root = await mkdtemp(`${tmpdir()}/tessera-dev-proxy-`);
  const proxy = devApiProxy("serve", "development", devEnv({
    PORT: String(webPort),
    TESSERA_API_PORT: String(upstreamPort),
  }));
  const server = await vite.createServer({
    configFile: false,
    root,
    logLevel: "error",
    appType: "custom",
    server: {
      host: "127.0.0.1",
      port: webPort,
      strictPort: true,
      proxy,
    },
    optimizeDeps: { noDiscovery: true },
  });
  await server.listen();
  try {
    const status = await fetch(`http://127.0.0.1:${webPort}/api/operational-status`, {
      headers: { "x-forwarded-for": "203.0.113.9", "x-real-ip": "203.0.113.9" },
    });
    assert.equal(status.status, 200);
    assert.deepEqual(await status.json(), { ok: true, url: "/api/operational-status" });

    const blocked = await fetch(`http://127.0.0.1:${webPort}/api/internal/session-check`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: "{}",
    });
    assert.equal(blocked.status, 404);

    const socket = new WebSocket(`ws://127.0.0.1:${webPort}/ws`);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("websocket proxy timed out")), 5000);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("websocket proxy failed"));
      });
    });
    socket.close();

    assert.deepEqual(
      seen.map((hit) => hit.url),
      ["/api/operational-status", "/ws"],
    );
    assert.equal(seen[0].forwarded, null);
    assert.equal(seen[0].host, `127.0.0.1:${upstreamPort}`);
    assert.equal(seen[1].upgrade, true);
    assert.equal(seen[1].forwarded, null);
  } finally {
    for (const socket of sockets) socket.destroy();
    await server.close();
    await new Promise((resolve) => upstream.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

function listenPort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}
