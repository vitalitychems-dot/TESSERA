/** Read-only crystal source for /brain/snapshot?src=crystal. Uses docs/v3/crystal.jsonl when it
 * was built from the same memory file (source + line count match), else builds once in memory. */
import { readFileSync, existsSync } from "node:fs";
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
