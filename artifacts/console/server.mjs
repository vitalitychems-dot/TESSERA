import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DISCLAIMER } from "../../scripts/brain/export-snapshot.mjs";
import { answerChat, brainPayload, busPayload, consolePort, DEFAULT_PORT, eyePayload, recallPayload, scorePayload } from "./lib/sources.mjs";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const BIND_HOST = "127.0.0.1";
let boundPort = DEFAULT_PORT;
const files = new Map([
  ["/", ["text/html; charset=utf-8", readFileSync(new URL("./public/index.html", import.meta.url))]],
  ["/console.css", ["text/css; charset=utf-8", readFileSync(new URL("./public/console.css", import.meta.url))]],
  ["/console.js", ["text/javascript; charset=utf-8", readFileSync(new URL("./public/console.js", import.meta.url))]],
  ["/actions.mjs", ["text/javascript; charset=utf-8", readFileSync(new URL("./public/actions.mjs", import.meta.url))]],
  ["/brain-graph.mjs", ["text/javascript; charset=utf-8", readFileSync(new URL("./public/brain-graph.mjs", import.meta.url))]],
  ["/fonts/syne-500.woff2", ["font/woff2", readFileSync(new URL("./public/fonts/syne-500.woff2", import.meta.url))]],
  ["/fonts/syne-700.woff2", ["font/woff2", readFileSync(new URL("./public/fonts/syne-700.woff2", import.meta.url))]],
  ["/fonts/fragment-mono.woff2", ["font/woff2", readFileSync(new URL("./public/fonts/fragment-mono.woff2", import.meta.url))]],
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
  if (!pathname.startsWith("/")) return null;
  if (pathname.includes("%") || pathname.includes("\\") || pathname.includes("\0") || pathname.includes("..")) return null;
  return pathname;
}

function loadBrainSnapshot() {
  try { return JSON.parse(readFileSync(new URL("./public/brain-snapshot.json", import.meta.url), "utf8")); }
  catch { return {}; }
}
const brainSnapshot = loadBrainSnapshot();
let threeModuleBytes = null;
function threeModule() {
  threeModuleBytes ??= readFileSync(fileURLToPath(import.meta.resolve("three")));
  return threeModuleBytes;
}
export function brainTabEnabled() { return process.env.BRAIN_TAB === "1"; }
export function embedSnapshot(snapshot) {
  return JSON.stringify(snapshot).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029");
}

const BRAIN_TAB_STYLE = "html[data-brain-snapshot='1'] #panel-brain>.panel-head .kicker,html[data-brain-snapshot='1'] #panel-brain>.panel-head h2,html[data-brain-snapshot='1'] #panel-brain>.panel-head button,html[data-brain-snapshot='1'] #panel-brain>.slider,html[data-brain-snapshot='1'] #panel-brain>.stage{display:none}#brain-snapshot{display:grid;gap:14px}#brain-snapshot-label{margin:0;max-width:72ch;color:#7ef0d4;font-family:Fragment Mono,ui-monospace,monospace}#brain-snapshot-counts{margin:0;color:#9aa8b2}#brain-snapshot .brain-stage{display:flex;gap:18px}#brain-snapshot-canvas{width:min(100%,900px);height:640px;display:block;background:#070b10;border:1px solid #2c3a46}#brain-snapshot-aside{display:grid;align-content:start;gap:8px;flex:1;min-width:220px}#brain-snapshot-aside button{text-align:left;font:14px/1.4 Fragment Mono,ui-monospace,monospace;color:#f3efe6;background:#12181f;border:1px solid #2c3a46;padding:8px 10px}#brain-snapshot-aside button[aria-current=true]{border-color:#7ef0d4;color:#7ef0d4}";

export function applyBrainTab(html, snapshot, enabled) {
  if (!enabled) return html;
  const json = embedSnapshot(snapshot ?? {});
  const head = `<script type="importmap">{"imports":{"three":"/vendor/three/three.module.js"}}</script><style>${BRAIN_TAB_STYLE}</style>`;
  const block = `<div id="brain-snapshot"><p id="brain-snapshot-label">${DISCLAIMER}</p><p id="brain-snapshot-counts" title="Node recall-degree values add up to twice the header's recall-pair count."></p><div class="brain-stage"><canvas id="brain-snapshot-canvas" aria-label="Memory index snapshot"></canvas><aside id="brain-snapshot-aside"></aside></div></div><script type="application/json" id="brain-snapshot-data">${json}</script>`;
  return html.replace('<html lang="en">', '<html lang="en" data-brain-snapshot="1">').replace("</head>", `${head}</head>`).replace('<section data-panel="brain" id="panel-brain" hidden>', `<section data-panel="brain" id="panel-brain" hidden>${block}`);
}

export function publicFilePath(name) {
  if (typeof name !== "string" || !/^[a-z0-9][a-z0-9./-]*$/i.test(name)) return null;
  if (name.includes("..") || name.includes("//") || name.startsWith("/") || name.startsWith(".")) return null;
  return `${publicDir}${path.sep}${name}`;
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
    if (req.method === "GET" && pathname === "/") {
      const [type, body] = files.get("/");
      send(res, 200, type, brainTabEnabled() ? applyBrainTab(body.toString("utf8"), brainSnapshot, true) : body);
      return;
    }
    if (req.method === "GET" && pathname === "/vendor/three/three.module.js") {
      if (!brainTabEnabled()) { sendJson(res, 404, { ok: false, error: "Not found" }); return; }
      send(res, 200, "text/javascript; charset=utf-8", threeModule());
      return;
    }
    if (req.method === "GET" && files.has(pathname)) {
      const [type, body] = files.get(pathname);
      send(res, 200, type, body);
      return;
    }
    if (req.method === "GET" && pathname === "/api/meta") {
      sendJson(res, 200, { port: boundPort, theme: "tessera-next", listen: `127.0.0.1:${boundPort}` });
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
  console.log(`Tessera console  http://127.0.0.1:${port}  theme tessera-next`);
}
