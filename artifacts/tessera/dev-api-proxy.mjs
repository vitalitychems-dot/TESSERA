// Development-only proxy for the Tessera web Vite server.
//
// Pages such as the operational cycle fetch relative /api and open
// ws://${location.host}/ws. Vite does not forward those unless server.proxy
// is set, and the suite runs the web app and the API on different ports.
//
// This module is intentionally plain JavaScript so the dev server and
// node:test can share it. It returns nothing for build and for vite preview
// (serve + production). It never targets a non-loopback host. /api/internal
// is not forwarded: the session check accepts only a loopback socket with no
// forwarding headers, and preview/vite.config.ts stays without a proxy.

const PORT_TEXT = /^[1-9][0-9]{0,4}$/;
const DEFAULT_API_PORT = 5000;

// Keep this list aligned with FORWARDING_HEADERS in
// artifacts/api-server/src/routes/internal-session-check.ts.
export const DEV_PROXY_FORWARDING_HEADERS = [
  "x-forwarded-for",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
  "x-forwarded-server",
  "x-forwarded-prefix",
  "forwarded",
  "x-real-ip",
  "via",
  "x-original-forwarded-for",
  "cf-connecting-ip",
  "true-client-ip",
  "x-client-ip",
  "x-forwarded-ssl",
  "x-envoy-external-address",
];

function validPort(value) {
  const text = value?.trim();
  if (!text || !PORT_TEXT.test(text)) return null;
  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
  return port;
}

function requestPath(url) {
  if (!url) return "";
  const query = url.indexOf("?");
  const hash = url.indexOf("#");
  let end = url.length;
  if (query >= 0) end = Math.min(end, query);
  if (hash >= 0) end = Math.min(end, hash);
  return url.slice(0, end);
}

function isBlockedDevProxyPath(path) {
  return (
    path === "/api/internal" ||
    path.startsWith("/api/internal/") ||
    path === "/internal" ||
    path.startsWith("/internal/")
  );
}

export function devApiProxyBypass(url) {
  if (isBlockedDevProxyPath(requestPath(url))) return false;
  return undefined;
}

function loopbackOrigin(value) {
  const text = value?.trim();
  if (!text) return null;
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") return null;
  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
  const hostname = host === "::1" ? "[::1]" : "127.0.0.1";
  return { port, origin: `${url.protocol}//${hostname}:${port}` };
}

export function devApiProxyTarget(env = process.env) {
  const webPort = validPort(env.PORT);
  const suitePort = validPort(env.TESSERA_API_PORT);
  if (suitePort) {
    if (suitePort === webPort) return undefined;
    return `http://127.0.0.1:${suitePort}`;
  }

  const configured = env.VITE_API_URL?.trim();
  if (configured) {
    const origin = loopbackOrigin(configured);
    if (!origin || origin.port === webPort) return undefined;
    return origin.origin;
  }

  if (webPort === DEFAULT_API_PORT) return undefined;
  return `http://127.0.0.1:${DEFAULT_API_PORT}`;
}

export function attachDevProxyGuards(proxy) {
  const strip = (proxyReq) => {
    for (const name of DEV_PROXY_FORWARDING_HEADERS) {
      proxyReq.removeHeader(name);
    }
  };
  proxy.on("proxyReq", strip);
  proxy.on("proxyReqWs", strip);
}

function proxyEntry(target) {
  return {
    target,
    changeOrigin: true,
    xfwd: false,
    ws: true,
    configure: attachDevProxyGuards,
  };
}

export function devApiProxy(command, mode, env = process.env) {
  if (command !== "serve" || mode !== "development") return undefined;
  const target = devApiProxyTarget(env);
  if (!target) return undefined;
  return {
    "/api": {
      ...proxyEntry(target),
      bypass(req) {
        return devApiProxyBypass(req?.url);
      },
    },
    "/ws": proxyEntry(target),
  };
}
