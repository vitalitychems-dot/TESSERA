import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (/\.(tsx|ts)$/.test(name)) files.push(path);
  }
  return files;
}

function productCopy(source) {
  return source
    .replace(/https:\/\/(?:api\.)?github\.com\/[^\s"'`)]*GitbookAI[^\s"'`)]*/g, "")
    .replace(/\|GitbookAI/g, "")
    .replace(/const HIS = new Set\(\["TESSERA", "Gitbook", "GitbookAI", "vitality"\]\);/g, "");
}

test("product copy says GitMesh and does not show the old product name", () => {
  const root = new URL("../../../preview/src/", import.meta.url);
  const files = walk(root.pathname);
  const leftovers = [];
  for (const file of files) {
    const stripped = productCopy(readFileSync(file, "utf8"));
    if (stripped.includes("GitbookAI")) leftovers.push(file);
  }
  assert.deepEqual(leftovers, []);

  const rooms = readFileSync(new URL("../../../preview/src/components/tessera/rooms-sheet.tsx", import.meta.url), "utf8");
  assert.match(rooms, /id: "gitbookai"/);
  assert.match(rooms, /label: "GitMesh"/);
  const mesh = readFileSync(new URL("../../../preview/src/lib/tessera/mesh-net.ts", import.meta.url), "utf8");
  assert.match(mesh, /ours: "GitMesh"/);
});
