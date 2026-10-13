import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { answerChat, brainPayload, busPayload, consolePort, DEFAULT_PORT, eyePayload, recallPayload, scorePayload } from "./lib/sources.mjs";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const BIND_HOST = "127.0.0.1";
let boundPort = DEFAULT_PORT;
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/console.css", ["console.css", "text/css; charset=utf-8"]],
  ["/console.js", ["console.js", "text/javascript; charset=utf-8"]],
  ["/actions.mjs", ["actions.mjs", "text/javascript; charset=utf-8"]],
  ["/fonts/syne-500.woff2", ["fonts/syne-500.woff2", "font/woff2"]],
  ["/fonts/syne-700.woff2", ["fonts/syne-700.woff2", "font/woff2"]],
  ["/fonts/fragment-mono.woff2", ["fonts/fragment-mono.woff2", "font/woff2"]],
]);

function send(res, code, type, body) {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(body);
}

function sendJson(res, code, value) {
  send(res, code, "application/json; charset=utf-8", JSON.stringify(value));
}

export function normalizePublicPath(pathname) {
  if (typeof pathname !== "string" || pathname.length === 0 || pathname.length > 512) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("\0") || decoded.includes("\\") || !decoded.startsWith("/")) return null;
  const normalized = path.posix.normalize(decoded);
  if (!normalized.startsWith("/") || normalized.includes("..")) return null;
  return normalized;
}

export function publicFilePath(name) {
  if (typeof name !== "string" || name.includes("\0") || path.isAbsolute(name)) return null;
  const root = path.resolve(publicDir);
  const resolved = path.resolve(root, name);
  if (!resolved.startsWith(`${root}${path.sep}`)) return null;
  return resolved;
}

function chatOriginOk(req) {
  const address = req.socket?.localAddress;
  const port = req.socket?.localPort;
  if (address !== BIND_HOST || typeof port !== "number") return false;
  const origin = req.headers.origin;
  if (typeof origin !== "string" || origin.length === 0 || origin === "null") return false;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  return parsed.protocol === "http:" && parsed.hostname === BIND_HOST && parsed.port === String(port);
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 32_000) throw new Error("body too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function handleRequest(req, res) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const pathname = normalizePublicPath(url.pathname);
  try {
    if (!pathname) {
      sendJson(res, 404, { ok: false, error: "Not found" });
      return;
    }
    if (req.method === "GET" && files.has(pathname)) {
      const [name, type] = files.get(pathname);
      const file = publicFilePath(name);
      if (!file) {
        sendJson(res, 404, { ok: false, error: "Not found" });
        return;
      }
      send(res, 200, type, readFileSync(file));
      return;
    }
    if (req.method === "GET" && pathname === "/api/meta") {
      sendJson(res, 200, { port: boundPort, theme: "phosphor-lattice", listen: `127.0.0.1:${boundPort}` });
      return;
    }
    if (req.method === "GET" && pathname === "/api/eye") {
      sendJson(res, 200, await eyePayload());
      return;
    }
    if (req.method === "GET" && pathname === "/api/brain") {
      sendJson(res, 200, brainPayload(url.searchParams.get("t") ?? undefined));
      return;
    }
    if (req.method === "GET" && pathname === "/api/brain/recall") {
      const body = recallPayload(url.searchParams.get("t") ?? undefined, url.searchParams.get("seed") || "");
      sendJson(res, body.ok ? 200 : 404, body);
      return;
    }
    if (req.method === "GET" && pathname === "/api/bus") {
      sendJson(res, 200, await busPayload());
      return;
    }
    if (req.method === "GET" && pathname === "/api/score") {
      sendJson(res, 200, await scorePayload());
      return;
    }
    if (req.method === "POST" && pathname === "/api/chat") {
      if (!chatOriginOk(req)) {
        sendJson(res, 403, { ok: false, error: "Origin is not this console." });
        return;
      }
      const raw = await readBody(req);
      let message = "";
      try {
        message = JSON.parse(raw).message;
      } catch {
        sendJson(res, 400, { ok: false, error: "Send JSON with a message." });
        return;
      }
      const result = await answerChat(message);
      sendJson(res, result.ok ? 200 : 400, result);
      return;
    }
    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Request failed" });
  }
}

export function startServer(port = consolePort()) {
  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, BIND_HOST, () => {
      const address = server.address();
      boundPort = typeof address === "object" && address ? address.port : port;
      resolve(server);
    });
  });
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry === fileURLToPath(import.meta.url)) {
  const server = await startServer();
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : consolePort();
  console.log(`Tessera console  http://127.0.0.1:${port}  theme phosphor-lattice`);
}
