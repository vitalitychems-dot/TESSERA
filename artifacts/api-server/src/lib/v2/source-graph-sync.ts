// Source Graph auto-population. Scans the LOCAL workspace module tree and
// derives provenance edges from static import statements. No network calls;
// canonical GitHub repos appear as registry nodes, not live-fetched content.
// Every scan limit is returned in the result so consumers can see exactly
// what was and was not covered.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { SourceGraph } from "./source-graph";

const MAX_FILES = 400;
const MAX_DEPTH = 6;
const MAX_BYTES = 256 * 1024;

export interface SyncLimits {
  scannedFiles: number;
  maxFiles: number;
  maxDepth: number;
  truncated: boolean;
  skipped: { symlinks: number; hidden: number; oversized: number; unreadable: number };
  importEdgesAdded: number;
  cycleEdgesSkipped: number;
  scope: string;
}

export interface SyncResult {
  graph: SourceGraph;
  limits: SyncLimits;
}

/** Canonical repositories are registry anchors only — no live fetches here. */
const CANONICAL_REPOS = [
  { id: "repo:TESSERA", label: "vitalitychems-dot/TESSERA (canonical code)" },
  { id: "repo:Gitbook", label: "vitalitychems-dot/Gitbook (coordination/provenance)" },
  { id: "repo:1T", label: "vitalitychems-dot/1T (private, protected)" },
] as const;

/** Known capability anchors: which subtrees feed which Tessera capability. */
const CAPABILITY_MAP: Record<string, { id: string; label: string }> = {
  "memory": { id: "capability:local-memory", label: "Local retrieval memory (BM25, redaction, IMP proposals)" },
  "tessera-model.ts": { id: "capability:chat-voice", label: "Guarded chat voice via owner-approved GLM endpoint" },
  "neural-embeddings.ts": { id: "capability:local-vectors", label: "Deterministic local lexical vectors" },
  "tessera-study-notes.ts": { id: "capability:study-notes", label: "Public-source study notes collector" },
  "v2/evidence-lens.ts": { id: "capability:evidence-reporting", label: "Evidence-attached conclusions" },
  "v2/source-graph.ts": { id: "capability:provenance-graph", label: "Provenance graph" },
  "v2/usage-ledger.ts": { id: "capability:usage-accounting", label: "Per-model usage accounting (no failover)" },
  "v2/scenario-sandbox.ts": { id: "capability:scenario-rehearsal", label: "Lesson-based action rehearsal (heuristic)" },
};

const IMPORT_RE = /(?:from\s*|import\s*\(\s*)["'](\.[^"']+)["']/g;

export async function syncSourceGraph(root: string, scanRoot = "src/lib"): Promise<SyncResult> {
  const limits: SyncLimits = {
    scannedFiles: 0, maxFiles: MAX_FILES, maxDepth: MAX_DEPTH, truncated: false,
    skipped: { symlinks: 0, hidden: 0, oversized: 0, unreadable: 0 },
    importEdgesAdded: 0, cycleEdgesSkipped: 0,
    scope: `local workspace subtree "${scanRoot}"; canonical repos are registry anchors, not live-fetched`,
  };

  // 1. Discover TypeScript modules under scanRoot (bounded, symlink-safe).
  const files: string[] = [];
  async function walk(relative: string, depth: number): Promise<void> {
    if (depth > MAX_DEPTH || files.length >= MAX_FILES) {
      if (files.length >= MAX_FILES) limits.truncated = true;
      return;
    }
    let entries;
    try {
      entries = await readdir(path.join(root, relative), { withFileTypes: true });
    } catch {
      if (depth === 0) return; // absent subtree is an empty scan
      limits.skipped.unreadable++;
      return;
    }
    for (const entry of entries) {
      if (files.length >= MAX_FILES) { limits.truncated = true; return; }
      if (entry.isSymbolicLink()) { limits.skipped.symlinks++; continue; }
      if (entry.name.startsWith(".") || entry.name.startsWith("_")) { limits.skipped.hidden++; continue; }
      const child = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__" || entry.name === "node_modules") { limits.skipped.hidden++; continue; }
        await walk(child, depth + 1);
      } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        files.push(child);
      }
    }
  }
  await walk(scanRoot, 0);
  files.sort();
  const fileSet = new Set(files);

  // 2. Build the graph.
  const graph = new SourceGraph();
  for (const repo of CANONICAL_REPOS) graph.addNode({ id: repo.id, kind: "repo", label: repo.label });
  graph.addNode({ id: "repo:local-draft", kind: "repo", label: "Replit workspace (draft, not canonical)" });
  graph.addEdge({ from: "repo:local-draft", to: "repo:TESSERA", kind: "derived-from" });

  const seenCapabilities = new Set<string>();
  for (const file of files) {
    const moduleId = `module:${file}`;
    graph.addNode({ id: moduleId, kind: "module", label: path.posix.basename(file) });
    graph.addEdge({ from: "repo:local-draft", to: moduleId, kind: "contains" });

    const rel = path.posix.relative(scanRoot, file);
    for (const [prefix, cap] of Object.entries(CAPABILITY_MAP)) {
      const stem = prefix.replace(/\.ts$/, "");
      if (rel === prefix || rel.startsWith(stem + "/")) {
        if (!seenCapabilities.has(cap.id)) {
          graph.addNode({ id: cap.id, kind: "capability", label: cap.label });
          seenCapabilities.add(cap.id);
        }
        try {
          graph.addEdge({ from: moduleId, to: cap.id, kind: "feeds" });
        } catch { limits.cycleEdgesSkipped++; }
      }
    }
  }

  // 3. Import-derived provenance: A imports B  =>  B feeds A.
  for (const file of files) {
    let source: string;
    try {
      const stat = await readFile(path.join(root, file), "utf8");
      if (stat.length > MAX_BYTES) { limits.skipped.oversized++; continue; }
      source = stat;
    } catch {
      limits.skipped.unreadable++;
      continue;
    }
    limits.scannedFiles++;
    const dir = path.posix.dirname(file);
    for (const match of source.matchAll(IMPORT_RE)) {
      const base = path.posix.normalize(path.posix.join(dir, match[1]));
      const target = [`${base}.ts`, `${base}/index.ts`].find((candidate) => fileSet.has(candidate));
      if (!target || target === file) continue;
      try {
        graph.addEdge({ from: `module:${target}`, to: `module:${file}`, kind: "feeds" });
        limits.importEdgesAdded++;
      } catch {
        // Circular imports are real in TS; they are skipped and counted, not fatal.
        limits.cycleEdgesSkipped++;
      }
    }
  }

  return { graph, limits };
}
