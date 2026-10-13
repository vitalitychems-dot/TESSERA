import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  BM25_PARAMS,
  buildIndex,
  buildRouter,
  extractImports,
  filenameKeywordRank,
  hitCounts,
  linkCallSites,
  loadCatalog,
  moduleSignals,
  rankIndex,
  repoRoot,
  tokenize,
} from "../src/brain/router.mjs";

test("tokenizer splits camel case and drops stopwords", () => {
  assert.deepEqual(tokenize("Sign the sessionCookie"), ["sign", "session", "cookie"]);
  assert.deepEqual(tokenize("GitAI"), ["git", "ai"]);
});

test("BM25 name field ranks the rare term", () => {
  const index = buildIndex([
    { path: "src/cookie.mjs", nameText: "src cookie session", docsText: "", callsText: "" },
    { path: "src/session.mjs", nameText: "src session", docsText: "session only", callsText: "" },
  ]);
  const params = { k1: 1.2, b: 0.75, weights: { name: 1, docs: 1, calls: 1 }, filenameMix: 0 };
  const ranked = rankIndex(index, "cookie", 2, params);
  assert.equal(ranked[0].path, "src/cookie.mjs");
  assert.ok(ranked[0].score > ranked[1].score);
});

test("call sites record the importer and the imported names", () => {
  const linked = linkCallSites([
    moduleSignals("artifacts/v2/src/a.mjs", "export function signCookie() {}\n"),
    moduleSignals("artifacts/v2/src/b.mjs", "import { signCookie } from './a.mjs'\n"),
  ]);
  const target = linked.find((row) => row.path.endsWith("a.mjs"));
  assert.match(target.callsText, /signCookie/);
  assert.match(target.callsText, /b\.mjs/);
  assert.equal(extractImports("import { signCookie } from './a.mjs'\n")[0].spec, "./a.mjs");
});

test("filename-keyword baseline overlaps path tokens", () => {
  const ranked = filenameKeywordRank(
    ["artifacts/gitai/src/server.mjs", "artifacts/v2/src/brain/affect.mjs"],
    "gitai server cookie",
    2,
  );
  assert.equal(ranked[0].path, "artifacts/gitai/src/server.mjs");
  assert.ok(ranked[0].score > ranked[1].score);
});

test("registry catalog wins when present, otherwise the module list", () => {
  const root = mkdtempSync(join(tmpdir(), "router-catalog-"));
  try {
    mkdirSync(join(root, "data", "rea"), { recursive: true });
    writeFileSync(join(root, "data", "rea", "registry.json"), "{");
    assert.equal(loadCatalog(root).source, "package/module list");
    writeFileSync(
      join(root, "data", "rea", "registry.json"),
      JSON.stringify({ tools: [{ name: "pen", path: "artifacts/v2/src/studio/serve.mjs", description: "loopback pen" }] }),
    );
    const catalog = loadCatalog(root);
    assert.equal(catalog.source, "data/rea/registry.json");
    assert.equal(catalog.entries[0].tool, "pen");
    assert.equal(catalog.entries[0].path, "artifacts/v2/src/studio/serve.mjs");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  const live = loadCatalog(repoRoot());
  assert.equal(live.source, "package/module list");
  assert.ok(live.entries.some((entry) => entry.path === "artifacts/v2/src/brain/router.mjs"));
});

test("held-out PR file routing beats the filename-keyword baseline", () => {
  const evalPath = fileURLToPath(new URL("../src/brain/router-eval.json", import.meta.url));
  const evalSet = JSON.parse(readFileSync(evalPath, "utf8"));
  const heldOut = evalSet.items.filter((item) => item.split === "test");
  assert.equal(heldOut.length, 44);
  assert.equal(evalSet.items.filter((item) => item.split === "dev").length, 44);
  const router = buildRouter(repoRoot());
  assert.equal(router.source, "package/module list");
  const baseline = hitCounts(heldOut, (query) => router.baseline(query, 3));
  const model = hitCounts(heldOut, (query) => router.rank(query, 3, BM25_PARAMS));
  assert.ok(model.top1 > baseline.top1);
  assert.ok(model.top3 > baseline.top3);
});

test("R4-21: precomputed path token sets rank the same as per-query tokenizing", () => {
  const paths = ["artifacts/gitai/src/server.mjs", "artifacts/v2/src/brain/affect.mjs", "lib/db/src/schema/sessionCookie.ts"];
  const sets = paths.map((p) => new Set(tokenize(p)));
  for (const q of ["gitai server cookie", "brain affect", "session cookie schema db"]) {
    assert.deepEqual(filenameKeywordRank(paths, q, 0, sets), filenameKeywordRank(paths, q, 0));
  }
});
