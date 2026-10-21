/**
 * Offline file mesh. Pages already on disk. A query never opens the live web.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reviewFile } from "../hyb011-denylist.mjs";
import { buildIndex, searchIndex } from "../../../../preview/src/lib/tessera/offline-index.ts";

const SKIP_DIR = new Set(["node_modules", ".git"]);

export function gitbookRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../../../archive/from-gitbook");
}

export function loadGitbookPages(root = gitbookRoot()) {
  const pages = [];
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIR.has(name)) continue;
      const abs = join(dir, name);
      const rel = relative(root, abs);
      if (!reviewFile(rel).allowed) continue;
      const info = statSync(abs);
      if (info.isDirectory()) walk(abs);
      else if (name.endsWith(".md")) {
        pages.push({ path: rel, text: readFileSync(abs, "utf8").slice(0, 2048) });
      }
    }
  }
  // tesserav2 leaves archive/from-gitbook out (docs/EXCLUDED.md); no archive means an empty mesh.
  if (existsSync(root)) walk(root);
  return pages;
}

export function queryFileMesh(query, root = gitbookRoot()) {
  const pages = loadGitbookPages(root);
  const index = buildIndex(pages);
  const found = searchIndex(index, query, 20);
  return { ...found, count: index.pages.length };
}
