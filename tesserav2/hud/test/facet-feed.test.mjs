import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { diffFacets, readFacet, scanFacets, watchFacets } from "../src/facet-feed.mjs";

test("readFacet takes the lane from the crystal.tsv row shape and skips comments", () => {
  const dir = mkdtempSync(join(tmpdir(), "hud-"));
  writeFileSync(join(dir, "a.tsv"), "# sample\n2026-10-21T00:00:00Z\tGitai\tfile\tx\tp/x\n2026-10-21T00:00:00Z\tGitai\tfile\ty\tp/y\n");
  const rec = readFacet(dir, "a.tsv");
  assert.equal(rec.lane, "Gitai");
  assert.equal(rec.rows, 2);
  assert.match(rec.hash, /^[0-9a-f]{12}$/);
  rmSync(dir, { recursive: true });
});

test("diffFacets reports add, change and delete", () => {
  const a = new Map([["x", { name: "x", size: 1, hash: "1" }], ["y", { name: "y", size: 1, hash: "1" }]]);
  const b = new Map([["x", { name: "x", size: 2, hash: "2" }], ["z", { name: "z", size: 1, hash: "1" }]]);
  const types = diffFacets(a, b).map((e) => `${e.type}:${e.name}`).sort();
  assert.deepEqual(types, ["add:z", "change:x", "delete:y"]);
});

test("watchFacets emits events for a real file add, change and delete", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hud-"));
  const seen = [];
  const feed = watchFacets(dir, (evs) => seen.push(...evs.map((e) => e.type)), { debounceMs: 30, pollMs: 200 });
  const wait = (want) => new Promise((ok, bad) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      if (seen.includes(want)) { clearInterval(iv); ok(); }
      else if (Date.now() - t0 > 3000) { clearInterval(iv); bad(new Error(`no ${want}`)); }
    }, 20);
  });
  writeFileSync(join(dir, "f.tsv"), "a\n");
  await wait("add");
  writeFileSync(join(dir, "f.tsv"), "a\nb\n");
  await wait("change");
  unlinkSync(join(dir, "f.tsv"));
  await wait("delete");
  feed.close();
  assert.equal(scanFacets(dir).size, 0);
  rmSync(dir, { recursive: true });
});

test("vite config binds 127.0.0.1, port 4173, strictPort on both server and preview", () => {
  const cfg = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");
  assert.match(cfg, /const HOST = "127\.0\.0\.1"/);
  assert.match(cfg, /HUD_PORT \?\? "4173"/);
  assert.equal((cfg.match(/strictPort: true/g) || []).length, 2);
  assert.doesNotMatch(cfg, /0\.0\.0\.0/);
});

test("tokens are the exact Ink Ground and Glass Edges values", () => {
  const rules = readFileSync(new URL("../../preview/src/lib/tessera/suite-rules.ts", import.meta.url), "utf8");
  assert.match(rules, /ground: "#070b10"/);
  assert.match(rules, /edge: "#7ef0d4"/);
  const tokens = readFileSync(new URL("../src/tokens.ts", import.meta.url), "utf8");
  assert.match(tokens, /from "\.\.\/\.\.\/preview\/src\/lib\/tessera\/suite-rules\.ts"/);
});
