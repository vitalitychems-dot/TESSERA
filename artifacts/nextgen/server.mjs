import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest as consoleHandle } from "../console/server.mjs";
import { THREE_PATH, threeAvailable, workspacePayload, worldPayload } from "./lib/world.mjs";

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
export const DEFAULT_PORT = 4395;
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
]);
const json = (res, code, v) => { res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(v)); };

export async function handleRequest(req, res) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  try {
    if (req.method === "GET" && files.has(url.pathname)) {
      const [name, type] = files.get(url.pathname);
      res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
      res.end(readFileSync(path.join(publicDir, name)));
      return;
    }
    if (req.method === "GET" && url.pathname === "/vendor/three.module.js") {
      if (!threeAvailable()) return json(res, 404, { ok: false, error: "three not installed (artifacts/v2)" });
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
      res.end(readFileSync(THREE_PATH));
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/world") return json(res, 200, worldPayload(url.searchParams.get("t") ?? undefined));
    if (req.method === "GET" && url.pathname === "/api/workspace") return json(res, 200, await workspacePayload());
    // brain / eye / bus / score are served by the console's real data layer.
    if (req.method === "GET" && ["/api/brain", "/api/eye", "/api/bus", "/api/score"].includes(url.pathname)) return consoleHandle(req, res);
    json(res, 404, { ok: false, error: "Not found" });
  } catch (e) {
    json(res, 500, { ok: false, error: e instanceof Error ? e.message : "failed" });
  }
}

export function startServer(port = Number(process.env.TESSERA_NEXTGEN_PORT ?? DEFAULT_PORT)) {
  const server = createServer((q, s) => void handleRequest(q, s));
  return new Promise((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", () => resolve(server)); });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = await startServer();
  console.log(`Tessera next-gen  http://127.0.0.1:${s.address().port}`);
}
