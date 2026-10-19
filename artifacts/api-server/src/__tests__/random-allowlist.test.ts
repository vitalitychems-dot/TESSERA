import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

// Chainable no-op DB: every call returns the chain; awaiting it yields [].
vi.mock("@workspace/db", () => {
  const chain: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return (ok: (v: unknown[]) => unknown) => ok([]);
      return chain;
    },
    apply() { return chain; },
  });
  return { db: chain, pool: chain };
});

/**
 * Math.random allowlist (release gate M4).
 *
 * Every use of Math.random under src/routes and src/lib must be listed here with a kind and a reason, and the
 * count per file is pinned. A new use fails the test until someone classifies it. Physical randomness (the Born
 * rule), collision-avoidance id suffixes, nonces, retry/scheduler jitter and crawl shuffles are legitimate.
 * Anything that fabricates a number a user or dashboard reads (status, confidence, votes, scores) is NOT
 * allowlistable: convert it to a deterministic FNV-1a / SHA-256 derivation (lib/deterministic-selectors.ts) or
 * remove it. Sites that still need that conversion live in PENDING_CONVERSION, whose counts may only go down.
 *
 * Baseline measured on main 15732f9 (read through the GitHub contents API, not by running this test): 76 literal
 * occurrences in 44 files, 52 of them executable calls. Counts below are exact for the code lines this scanner
 * sees (whole-line comments are ignored).
 */

type Kind = "born-rule" | "id-suffix" | "nonce" | "jitter" | "shuffle" | "sampled-maintenance" | "audit-text";

interface AllowEntry {
  count: number;
  kind: Kind;
  reason: string;
}

const KINDS: readonly Kind[] = ["born-rule", "id-suffix", "nonce", "jitter", "shuffle", "sampled-maintenance", "audit-text"];

const ID_REASON = "Collision-avoidance suffix on a Date.now() id; the id carries no simulated value.";
const id = (count = 1): AllowEntry => ({ count, kind: "id-suffix", reason: ID_REASON });

const ALLOWLIST: Record<string, AllowEntry> = {
  "lib/quantum-tesseract.ts": {
    count: 1,
    kind: "born-rule",
    reason: "measureQubit collapses a superposed qubit by the Born rule; measurement is intrinsically probabilistic.",
  },

  "lib/agent-comms.ts": id(),
  "lib/agent-spawner.ts": id(),
  "lib/code-bounties-real.ts": id(),
  "lib/consensus-engine.ts": id(),
  "lib/cross-domain-synthesis.ts": id(),
  "lib/evolution-attempt-ledger.ts": id(),
  "lib/external-tool-sandbox.ts": id(),
  "lib/lattice-store.ts": id(),
  "lib/memory-consolidation-engine.ts": id(),
  "lib/omniversal-quantum-lattice.ts": id(),
  "lib/problem-solver.ts": id(),
  "lib/recursive-reflection-loop.ts": id(),
  "lib/recursive-self-improvement.ts": id(),
  "lib/response-validation-engine.ts": id(),
  "lib/rick-improvement-program.ts": id(),
  "lib/routing-graph.ts": id(),
  "lib/self-code-evolution.ts": id(),
  "lib/session-handoff.ts": id(),
  "lib/sovereign-knowledge-autonomy.ts": id(),
  "lib/sovereign-memory-vault.ts": id(),
  "routes/council.ts": id(),
  "routes/council-meeting.ts": id(),
  "routes/improvement.ts": id(),
  "routes/inventions.ts": id(),
  "routes/knowledge.ts": id(),
  "routes/swarm.ts": id(),
  "routes/theorem-lab.ts": id(2),

  "lib/sacred-conference-orchestrator.ts": {
    count: 1,
    kind: "nonce",
    reason: "Run nonce mixed into a hash so two conference runs never share a seed; not shown as a measurement.",
  },
  "lib/lattice-identity.ts": {
    count: 1,
    kind: "nonce",
    reason: "Entropy for an ephemeral development secret that is hashed before use; must not be reproducible.",
  },

  "lib/ingestion/scheduler.ts": {
    count: 3,
    kind: "jitter",
    reason: "Retry backoff jitter and scheduler interval jitter; deterministic jitter would synchronise retries.",
  },

  "lib/ingestion/shepherd-agents.ts": {
    count: 2,
    kind: "shuffle",
    reason: "Shuffles crawl categories and URLs so successive runs cover different pages; no value is reported.",
  },
  "lib/ml-training-domains.ts": {
    count: 1,
    kind: "shuffle",
    reason: "Shuffles sample order for a training pass; ordering is the mechanism and no value is reported.",
  },

  "lib/father-verify-throttle.ts": {
    count: 1,
    kind: "sampled-maintenance",
    reason: "Probabilistic pruning of an in-memory throttle map so the cost is spread across requests.",
  },

  "lib/reality-audit.ts": {
    count: 19,
    kind: "audit-text",
    reason: "Registry descriptions and the scanner label name the pattern as text. They are strings, not calls, and the scanner skips this file.",
  },
  "lib/tessera-codex.ts": {
    count: 1,
    kind: "audit-text",
    reason: "Seed doctrine text that defines the SIMULATED label. It is a string, not a call.",
  },
};

interface PendingEntry {
  count: number;
  note: string;
}

/**
 * Known sites that fabricate or randomise a number and are outside the item 3 file lane. Counts are pinned so the
 * list can only shrink. Release gate M4 needs this to be empty.
 */
const PENDING_CONVERSION: Record<string, PendingEntry> = {
  "lib/department-competition.ts": {
    count: 4,
    note: "generateScore base and the yes/no/abstain vote tallies written to the competition log are fabricated.",
  },
  "routes/evaluation.ts": {
    count: 3,
    note: "Two hits fabricate the confidence of a scripted answer; one is a run id suffix.",
  },
  "lib/personality-evolution.ts": {
    count: 2,
    note: "Random initial trait value and per-step drift noise; item 6 lane.",
  },
};

const SRC = resolve(__dirname, "..");
const SCAN_DIRS = ["routes", "lib"];
const SOURCE_EXT = /\.(?:ts|tsx|mts|mjs)$/;
const DECLARATION_EXT = /\.d\.(?:ts|mts)$/;
const NEEDLE = /Math\.random/g;

function stripTrailingLineComment(line: string): string {
  let from = 0;
  for (;;) {
    const idx = line.indexOf("//", from);
    if (idx === -1) return line;
    const prefix = line.slice(0, idx);
    const balanced = ['"', "'", "`"].every((q) => (prefix.split(q).length - 1) % 2 === 0);
    if (balanced && !prefix.endsWith(":")) return prefix;
    from = idx + 2;
  }
}

/** Source lines with whole-line comments, block comments that start a line, and trailing // comments removed. */
function codeLinesOf(source: string): string[] {
  const out: string[] = [];
  let inBlock = false;
  for (const raw of source.split(/\r?\n/)) {
    let line = raw;
    if (inBlock) {
      const end = line.indexOf("*/");
      if (end === -1) continue;
      inBlock = false;
      line = line.slice(end + 2);
    }
    const trimmed = line.trimStart();
    if (trimmed.startsWith("/*")) {
      const end = trimmed.indexOf("*/", 2);
      if (end === -1) {
        inBlock = true;
        continue;
      }
      line = trimmed.slice(end + 2);
    } else if (trimmed.startsWith("//")) {
      continue;
    } else {
      line = stripTrailingLineComment(line);
    }
    out.push(line);
  }
  return out;
}

function countRandomUses(source: string): number {
  let n = 0;
  for (const line of codeLinesOf(source)) n += line.match(NEEDLE)?.length ?? 0;
  return n;
}

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "__tests__" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) listSourceFiles(full, out);
    else if (entry.isFile() && SOURCE_EXT.test(entry.name) && !DECLARATION_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

function scanTree(): Record<string, number> {
  const found: Record<string, number> = {};
  for (const root of SCAN_DIRS) {
    for (const file of listSourceFiles(join(SRC, root))) {
      const n = countRandomUses(readFileSync(file, "utf-8"));
      if (n > 0) found[relative(SRC, file).split(sep).join("/")] = n;
    }
  }
  return found;
}

const read = (p: string) => readFileSync(resolve(SRC, p), "utf-8");

describe("Math.random allowlist (release gate M4)", () => {
  it("every Math.random use in src/routes and src/lib is classified, with exact per-file counts", () => {
    const actual = scanTree();
    const expected: Record<string, number> = {};
    for (const [file, e] of Object.entries(ALLOWLIST)) expected[file] = e.count;
    for (const [file, e] of Object.entries(PENDING_CONVERSION)) expected[file] = e.count;

    const problems: string[] = [];
    for (const [file, n] of Object.entries(actual)) {
      if (!(file in expected)) problems.push(`unlisted: ${file} has ${n} (classify it or convert it to a deterministic derivation)`);
      else if (expected[file] !== n) problems.push(`count changed: ${file} has ${n}, list says ${expected[file]}`);
    }
    for (const file of Object.keys(expected)) {
      if (!(file in actual)) problems.push(`stale entry: ${file} no longer uses Math.random, remove it from the list`);
    }
    expect(problems).toEqual([]);
  });

  it("allowlist entries are well formed and never overlap the pending list", () => {
    for (const [file, e] of Object.entries(ALLOWLIST)) {
      expect(e.count, file).toBeGreaterThanOrEqual(1);
      expect(KINDS, file).toContain(e.kind);
      expect(e.reason.trim().length, file).toBeGreaterThanOrEqual(20);
      expect(file in PENDING_CONVERSION, file).toBe(false);
    }
    for (const [file, e] of Object.entries(PENDING_CONVERSION)) {
      expect(e.count, file).toBeGreaterThanOrEqual(1);
      expect(e.note.trim().length, file).toBeGreaterThanOrEqual(10);
    }
  });

  it("only measureQubit may claim the Born rule", () => {
    const born = Object.entries(ALLOWLIST).filter(([, e]) => e.kind === "born-rule").map(([f]) => f);
    expect(born).toEqual(["lib/quantum-tesseract.ts"]);
    expect(read("lib/quantum-tesseract.ts")).toMatch(/Math\.random\(\)\s*<\s*prob0/);
  });

  it("converted files stay free of Math.random", () => {
    const converted = [
      "lib/rick-proposals.ts",
      "lib/autonomous-forum-engine.ts",
      "lib/invention-seed.ts",
      "lib/deterministic-selectors.ts",
      "lib/deterministic-content.ts",
      "routes/mysticism.ts",
      "routes/rick.ts",
    ];
    for (const file of converted) expect(countRandomUses(read(file)), file).toBe(0);
  });

  it("comment-only mentions are not counted but real calls are", () => {
    expect(countRandomUses("// Math.random() is gone\n/**\n * no Math.random here\n */\nconst a = 1;")).toBe(0);
    expect(countRandomUses("const a = Math.random(); // trailing Math.random")).toBe(1);
    expect(countRandomUses("const url = \"http://x\"; const b = Math.random();")).toBe(1);
    expect(countRandomUses("id: `x-${Date.now()}-${Math.random().toString(36)}`")).toBe(1);
    expect(countRandomUses("/* start\nMath.random()\n*/ const c = Math.random();")).toBe(1);
  });
});

describe("rick-proposals ids are deterministic", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const diag = {
    weakCategories: [{ category: "memory", score: 20 }],
    weakAgi: [{ category: "math", score: 10 }],
    overallScorePct: 50,
    truthGroundingRate: 0.5,
    truthAvgScore: 0.5,
    meeseeksSuccessRate: 0.5,
  };

  it("the same diagnostics at the same instant give the same, unique, well-formed ids", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { deterministicProposals } = await import("../lib/rick-proposals");
    const a = deterministicProposals(diag).map((p) => p.id);
    const b = deterministicProposals(diag).map((p) => p.id);
    expect(a.length).toBe(5);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
    for (const pid of a) expect(pid).toMatch(/^rp-\d+-(?:\d+|truth|mks|fill-\d+)-[0-9a-f]{6}$/);
  });

  it("different content gives a different id", async () => {
    const { proposalId } = await import("../lib/rick-proposals");
    expect(proposalId("truth", 1, "a")).toBe(proposalId("truth", 1, "a"));
    expect(proposalId("truth", 1, "a")).not.toBe(proposalId("truth", 1, "b"));
    expect(proposalId("truth", 1, "a")).not.toBe(proposalId("mks", 1, "a"));
  });
});

describe("reality-audit scanner does not count its own patterns", () => {
  it("identifies only lib/reality-audit.ts as the scanner source", async () => {
    const { isScannerSelfFile } = await import("../lib/reality-audit");
    expect(isScannerSelfFile(join("artifacts", "api-server", "src", "lib", "reality-audit.ts"))).toBe(true);
    expect(isScannerSelfFile(join("artifacts", "api-server", "src", "routes", "reality-audit.ts"))).toBe(false);
    expect(isScannerSelfFile(join("artifacts", "api-server", "src", "lib", "reality-audit-snapshot.ts"))).toBe(false);
  });

  it("the scan result never lists the scanner file", async () => {
    const { getRealityAudit } = await import("../lib/reality-audit");
    const audit = await getRealityAudit();
    const files = audit.topFiles.map((f) => f.file.split(sep).join("/"));
    expect(files).not.toContain("artifacts/api-server/src/lib/reality-audit.ts");
  }, 30_000);
});
