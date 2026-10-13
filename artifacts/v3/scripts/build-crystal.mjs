// node artifacts/v3/scripts/build-crystal.mjs [memory.jsonl] [out]  (append-only: existing cells are kept, new facts appended)
import { readFileSync, writeFileSync, existsSync } from "node:fs"; import { basename } from "node:path";
import { buildCrystal, serialize, parse, appendCells, verify } from "../src/crystal.mjs";
const src = process.argv[2] ?? "docs/v2/v2-memory.jsonl", out = process.argv[3] ?? "docs/v3/crystal.jsonl";
const text = readFileSync(src, "utf8"); let cells;
if (existsSync(out)) { const old = parse(readFileSync(out, "utf8")).filter((c) => c.k !== "p"); const n = old.length;
  const lines = text.split("\n"); const add = appendCells(old, lines.slice(n).join("\n"), { source: basename(src) }); cells = [...old, ...add]; }
else cells = buildCrystal(text, { source: basename(src), layoutIters: 0 });
const full = buildCrystal(text, { source: basename(src) }); cells = [...cells, ...full.filter((c) => c.k === "p")];
if (verify(cells)) throw new Error("integrity"); writeFileSync(out, serialize(cells)); console.log(out, cells.length, "cells");
