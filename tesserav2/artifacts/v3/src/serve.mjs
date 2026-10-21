/** Read-only crystal source for /brain/snapshot?src=crystal. Uses docs/v3/crystal.jsonl when it
 * was built from the same memory file (source + line count match), else builds once in memory. */
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url"; import { dirname, join, basename } from "node:path";
import { buildCrystal, parse } from "./crystal.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
export const CRYSTAL_FILE = join(HERE, "../../../docs/v3/crystal.jsonl");
let slot = null;
export function crystalCells(memPath, readMemory) {
  const text = readMemory(); if (slot?.text === text) return slot.cells;
  let cells = null;
  if (existsSync(CRYSTAL_FILE)) { const c = parse(readFileSync(CRYSTAL_FILE, "utf8")); const n = text.split("\n").filter((l) => l.trim()).length; const facts = c.filter((x) => x.k !== "p").length;
    if (facts === n && c.every((x) => !x.src || x.src.startsWith(basename(memPath) + ":"))) cells = c; }
  cells ??= buildCrystal(text, { source: basename(memPath) }); slot = { text, cells }; return cells;
}
import { handleBrain as handleBrainV2 } from "../../v2/src/brain/http.mjs";
import { crystalSnapshot } from "./crystal.mjs";
const MEM = () => process.env.TESSERA_BRAIN_MEMORY || join(HERE, "../../../docs/v2/v2-memory.jsonl");
let httpSnap = null;
function memoryStamp(p) {
  try { const s = statSync(p); return `${s.mtimeMs}:${s.size}`; } catch { return "missing"; }
}
/** /brain routes: GET /brain/snapshot?src=crystal&t=&prev= from the crystal (read-only); everything else goes to v2.
 * Repeat calls with the same t, prev, and unchanged memory file reuse the cached JSON body. */
export function handleBrain(req, res, url) {
  if (req.method === "GET" && url.pathname === "/brain/snapshot" && url.searchParams.get("src") === "crystal") {
    const q = url.searchParams; const p = MEM();
    const key = `${q.has("t") ? q.get("t") : ""}\0${q.has("prev") ? q.get("prev") : ""}`;
    const stamp = memoryStamp(p);
    if (!httpSnap || httpSnap.stamp !== stamp || httpSnap.key !== key || httpSnap.path !== p) {
      const read = () => (existsSync(p) ? readFileSync(p, "utf8") : "");
      const body = JSON.stringify(crystalSnapshot(crystalCells(p, read), q.has("t") ? q.get("t") : undefined, q.has("prev") ? q.get("prev") : undefined));
      httpSnap = { stamp, key, path: p, body };
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(httpSnap.body); return true;
  }
  return handleBrainV2(req, res, url);
}
