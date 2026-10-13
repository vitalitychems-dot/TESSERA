import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MESHLOG } from "../src/brain/meshlog-labels.mjs";
import { isOldFallbackVector, localFallbackEmbedding, main } from "../scripts/reembed-fallback.mjs";

function repoRoot() {
  return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
}

function stripTypes(source) {
  return source
    .replace(/<[A-Za-z0-9_,\s[\]|&]+>/g, "")
    .replace(/:\s*[A-Za-z_][A-Za-z0-9_]*\[\]/g, "")
    .replace(/:\s*[A-Za-z_][A-Za-z0-9_]*/g, "");
}

// The pre-fix function, loaded from git rather than retyped. Parent of the commit
// that removed `(i % 32)` from neural-embeddings.ts.
function loadOldFallback(root) {
  const commit = execFileSync(
    "git",
    ["log", "-1", "--format=%H", "-S", "(i % 32)", "--", "artifacts/api-server/src/lib/neural-embeddings.ts"],
    { cwd: root, encoding: "utf8" },
  ).trim();
  assert.ok(commit, "git history has the pre-fix fallback");
  const src = execFileSync(
    "git",
    ["show", `${commit}^:artifacts/api-server/src/lib/neural-embeddings.ts`],
    { cwd: root, encoding: "utf8" },
  );
  const start = src.indexOf("const STOPWORDS");
  const end = src.indexOf("export async function generateEmbedding");
  assert.ok(start > 0 && end > start, "old fallback source is present");
  const chunk = src.slice(start, end);
  assert.match(chunk, /\(i % 32\)/);
  assert.doesNotMatch(chunk, /7919 \* block/);
  const factory = new Function(`${stripTypes(`const EMBEDDING_DIM = 256;\n${chunk}`)}\nreturn localFallbackEmbedding;`);
  return factory();
}

function cosine(a, b) {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleWords(words, n, rand) {
  const bag = words.slice();
  const out = [];
  const take = Math.min(n, bag.length);
  for (let i = 0; i < take; i++) {
    const j = Math.floor(rand() * (bag.length - i)) + i;
    const swap = bag[i];
    bag[i] = bag[j];
    bag[j] = swap;
    out.push(bag[i]);
  }
  return out;
}

function top1(docs, docVecs, embedQuery, seeds) {
  let hits = 0;
  let queries = 0;
  for (const seed of seeds) {
    const rand = mulberry32(seed);
    for (let i = 0; i < docs.length; i++) {
      const words = docs[i].split(/\s+/).filter(Boolean);
      const query = sampleWords(words, 6, rand).join(" ");
      const q = embedQuery(query);
      let best = -Infinity;
      let bestAt = -1;
      for (let j = 0; j < docVecs.length; j++) {
        const score = cosine(q, docVecs[j]);
        if (score > best) {
          best = score;
          bestAt = j;
        }
      }
      queries += 1;
      if (bestAt === i) hits += 1;
    }
  }
  return { hits, queries, recall: hits / queries };
}

const root = repoRoot();
const oldFallback = loadOldFallback(root);
const corpus = MESHLOG.map((row) => row.text).filter((text) => text.split(/\s+/).filter(Boolean).length >= 8);

test("old-fallback detection precision and recall against git history", () => {
  assert.ok(corpus.length >= 100, `MESHLOG corpus too small: ${corpus.length}`);
  const oldVecs = corpus.map((text) => oldFallback(text));
  const newVecs = corpus.map((text) => localFallbackEmbedding(text));
  const tp = oldVecs.filter((vec) => isOldFallbackVector(vec)).length;
  const fn = oldVecs.length - tp;
  const fp = newVecs.filter((vec) => isOldFallbackVector(vec)).length;
  const tn = newVecs.length - fp;
  const precision = tp / (tp + fp);
  const recall = tp / (tp + fn);
  const emptyOld = oldFallback("");
  const emptyNew = localFallbackEmbedding("");
  assert.equal(isOldFallbackVector(emptyOld), false);
  assert.equal(isOldFallbackVector(emptyNew), false);
  console.log(`DETECT precision=${precision.toFixed(4)} recall=${recall.toFixed(4)} tp=${tp} fp=${fp} fn=${fn} tn=${tn} n=${corpus.length}`);
  assert.equal(fp, 0);
  assert.equal(fn, 0);
  assert.equal(precision, 1);
  assert.equal(recall, 1);
});

test("top-1 recall on MESHLOG before and after re-embedding", () => {
  const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const oldVecs = corpus.map((text) => oldFallback(text));
  const newVecs = corpus.map((text) => localFallbackEmbedding(text));
  const before = top1(corpus, oldVecs, localFallbackEmbedding, seeds);
  const after = top1(corpus, newVecs, localFallbackEmbedding, seeds);
  const oldSpace = top1(corpus, oldVecs, oldFallback, seeds);
  console.log(`TOP1 docs=${corpus.length} queries=${before.queries} before=${before.recall.toFixed(4)} after=${after.recall.toFixed(4)} gain=${(after.recall - before.recall).toFixed(4)} oldSpace=${oldSpace.recall.toFixed(4)}`);
  assert.equal(before.queries, corpus.length * seeds.length);
  assert.ok(before.recall < 0.05);
  assert.ok(after.recall > 0.8);
  assert.ok(after.recall > before.recall);
});

test("dry-run prints counts and does not write; apply needs TESSERA_REEMBED_APPLY=1", () => {
  const dir = mkdtempSync(join(tmpdir(), "reembed-fallback-"));
  const file = join(dir, "memories.jsonl");
  const rows = corpus.slice(0, 4).map((text) => ({ content: text, embedding: oldFallback(text), source: "meshlog" }));
  rows.push({ content: corpus[4], embedding: localFallbackEmbedding(corpus[4]), source: "already-fixed" });
  rows.push({ embedding: oldFallback(corpus[5]), source: "no-text" });
  const original = `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`;
  writeFileSync(file, original);

  const dry = main(["--dry-run", file], { TESSERA_REEMBED_APPLY: "0" });
  assert.equal(dry.code, 0);
  assert.equal(dry.report.mode, "dry-run");
  assert.equal(dry.report.wrote, false);
  assert.equal(dry.report.oldFallback, 5);
  assert.equal(dry.report.eligible, 4);
  assert.equal(dry.report.skippedNoText, 1);
  assert.equal(dry.report.rewritten, 0);
  assert.equal(readFileSync(file, "utf8"), original);

  const implicit = main([file], {});
  assert.equal(implicit.code, 0);
  assert.equal(implicit.report.mode, "dry-run");
  assert.equal(implicit.report.flag, "0");
  assert.equal(readFileSync(file, "utf8"), original);

  const blocked = main(["--apply", file], { TESSERA_REEMBED_APPLY: "0" });
  assert.equal(blocked.code, 2);
  assert.equal(blocked.report.wrote, false);
  assert.equal(blocked.report.rewritten, 0);
  assert.equal(blocked.report.eligible, 4);
  assert.equal(readFileSync(file, "utf8"), original);

  const unset = main(["--apply", file], {});
  assert.equal(unset.code, 2);
  assert.equal(unset.report.flag, "0");
  assert.equal(readFileSync(file, "utf8"), original);

  const applied = main(["--apply", file], { TESSERA_REEMBED_APPLY: "1" });
  assert.equal(applied.code, 0);
  assert.equal(applied.report.wrote, true);
  assert.equal(applied.report.rewritten, 4);
  const written = readFileSync(file, "utf8").trim().split("\n").map((line) => JSON.parse(line));
  for (let i = 0; i < 4; i++) {
    assert.deepEqual(written[i].embedding, localFallbackEmbedding(rows[i].content));
    assert.equal(isOldFallbackVector(written[i].embedding), false);
    assert.equal(written[i].source, "meshlog");
  }
  assert.deepEqual(written[4].embedding, rows[4].embedding);
  assert.deepEqual(written[5].embedding, rows[5].embedding);
  assert.equal(written[5].content, undefined);
  rmSync(dir, { recursive: true, force: true });
});
