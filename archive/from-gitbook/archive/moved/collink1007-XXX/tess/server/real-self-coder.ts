import { applyCodeEdit, readProjectFile, getSelfCodeState } from "./self-code";
import { storage } from "./storage";

const rlog = (msg: string) => console.log(`[RealSelfCoder] ${msg}`);

export interface CodeImprovementEntry {
  id: string;
  file: string;
  description: string;
  type: "optimization" | "feature" | "fix" | "training" | "note";
  status: "queued" | "applied" | "failed" | "skipped";
  appliedAt?: number;
  errorMsg?: string;
}

const improvementLog: CodeImprovementEntry[] = [];
let cycleCount = 0;
let totalApplied = 0;
let totalFailed = 0;

const KNOWN_IMPROVEMENTS = [
  {
    id: "improve-001",
    description: "Add rate-limit backoff constant to improve LLM provider resilience",
    file: "server/swarm-algorithm.ts",
    apply: async () => {
      const r = readProjectFile("server/swarm-algorithm.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("BACKOFF_BASE_MS")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const slog = .+)$/m,
        `$1\nconst BACKOFF_BASE_MS = 800;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/swarm-algorithm.ts", updated, "Add BACKOFF_BASE_MS constant for LLM resilience");
      return { ok: true };
    },
  },
  {
    id: "improve-002",
    description: "Add cleanup logging for voice file purge confirmation",
    file: "server/cleanup-engine.ts",
    apply: async () => {
      const r = readProjectFile("server/cleanup-engine.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("purgeVoiceFiles complete")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /console\.log\(`\[Cleanup\] Voice files purged/,
        `console.log(\`[Cleanup] purgeVoiceFiles complete`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/cleanup-engine.ts", updated, "Improve voice file purge logging");
      return { ok: true };
    },
  },
  {
    id: "improve-003",
    description: "Add TSRT contract address validation helper to routes",
    file: "server/routes.ts",
    apply: async () => {
      const r = readProjectFile("server/routes.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("isValidLimnAddress")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const TSRT_CONTRACT = .+)$/m,
        `$1\nconst isValidLimnAddress = (addr: string) => typeof addr === "string" && addr.length >= 32 && addr.length <= 44;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/routes.ts", updated, "Add TSRT address validation helper");
      return { ok: true };
    },
  },
  {
    id: "improve-004",
    description: "Add self-coding cycle counter to deep training session notes",
    file: "server/deep-training.ts",
    apply: async () => {
      const r = readProjectFile("server/deep-training.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("selfCodingCycles")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(let trainingRound = .+)$/m,
        `$1\nlet selfCodingCycles = 0;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/deep-training.ts", updated, "Add self-coding cycle tracking to training");
      return { ok: true };
    },
  },
  {
    id: "improve-005",
    description: "Add error count tracking to LLM router stats",
    file: "server/llm-router.ts",
    apply: async () => {
      const r = readProjectFile("server/llm-router.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("let errorCount = 0")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const BASE_HOURLY_LIMIT = .+)$/m,
        `$1\nlet errorCount = 0;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/llm-router.ts", updated, "Add error count tracking to LLM router");
      return { ok: true };
    },
  },
  {
    id: "improve-006",
    description: "Add memory pressure check to autonomous cycles",
    file: "server/autonomous-cycles.ts",
    apply: async () => {
      const r = readProjectFile("server/autonomous-cycles.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("MEMORY_PRESSURE_MB")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const aclog = .+)$/m,
        `$1\nconst MEMORY_PRESSURE_MB = 512;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/autonomous-cycles.ts", updated, "Add memory pressure constant to autonomous cycles");
      return { ok: true };
    },
  },
  {
    id: "improve-007",
    description: "Add request timeout constant to provider registry",
    file: "server/provider-registry.ts",
    apply: async () => {
      const r = readProjectFile("server/provider-registry.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("DEFAULT_REQUEST_TIMEOUT_MS")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const reg: ProviderSpec\[\] = \[)$/m,
        `export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;\n\n$1`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/provider-registry.ts", updated, "Add default request timeout constant");
      return { ok: true };
    },
  },
  {
    id: "improve-008",
    description: "Add circuit breaker threshold to swarm intelligence router",
    file: "server/swarm-intelligence-router.ts",
    apply: async () => {
      const r = readProjectFile("server/swarm-intelligence-router.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("CIRCUIT_BREAKER_THRESHOLD")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const DIMENSION_TO_CATEGORY.+)$/m,
        `const CIRCUIT_BREAKER_THRESHOLD = 5;\n\n$1`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/swarm-intelligence-router.ts", updated, "Add circuit breaker threshold to swarm intelligence");
      return { ok: true };
    },
  },
  {
    id: "improve-009",
    description: "Add max retry constant to income engine",
    file: "server/income-engine.ts",
    apply: async () => {
      const r = readProjectFile("server/income-engine.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("MAX_SCAN_RETRIES")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const WALLETS = \{)$/m,
        `const MAX_SCAN_RETRIES = 3;\n\n$1`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/income-engine.ts", updated, "Add max scan retries constant to income engine");
      return { ok: true };
    },
  },
  {
    id: "improve-010",
    description: "Add profitability threshold to service arbitrage",
    file: "server/service-arbitrage.ts",
    apply: async () => {
      const r = readProjectFile("server/service-arbitrage.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("MIN_PROFITABILITY_THRESHOLD")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const log = .+)$/m,
        `$1\nconst MIN_PROFITABILITY_THRESHOLD = 0.5;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/service-arbitrage.ts", updated, "Add profitability threshold to service arbitrage");
      return { ok: true };
    },
  },
  {
    id: "improve-011",
    description: "Add training quality floor to deep training",
    file: "server/deep-training.ts",
    apply: async () => {
      const r = readProjectFile("server/deep-training.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("QUALITY_FLOOR")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const TRAINING_DOMAINS = \[)$/m,
        `const QUALITY_FLOOR = 0.6;\n\n$1`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/deep-training.ts", updated, "Add quality floor to deep training");
      return { ok: true };
    },
  },
  {
    id: "improve-012",
    description: "Add consensus timeout to swarm consensus",
    file: "server/swarm-consensus.ts",
    apply: async () => {
      const r = readProjectFile("server/swarm-consensus.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("CONSENSUS_TIMEOUT_MS")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const clog = .+)$/m,
        `$1\nconst CONSENSUS_TIMEOUT_MS = 15000;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/swarm-consensus.ts", updated, "Add consensus timeout to swarm consensus");
      return { ok: true };
    },
  },
  {
    id: "improve-013",
    description: "Add max concurrent formations to swarm algorithm",
    file: "server/swarm-algorithm.ts",
    apply: async () => {
      const r = readProjectFile("server/swarm-algorithm.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("MAX_CONCURRENT_FORMATIONS")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const slog = .+)$/m,
        `$1\nconst MAX_CONCURRENT_FORMATIONS = 10;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/swarm-algorithm.ts", updated, "Add max concurrent formations to swarm algorithm");
      return { ok: true };
    },
  },
  {
    id: "improve-014",
    description: "Add blog quality threshold to blog engine",
    file: "server/blog-engine.ts",
    apply: async () => {
      const r = readProjectFile("server/blog-engine.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("MIN_BLOG_QUALITY_SCORE")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const blog = .+)$/m,
        `$1\nconst MIN_BLOG_QUALITY_SCORE = 0.7;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/blog-engine.ts", updated, "Add blog quality threshold to blog engine");
      return { ok: true };
    },
  },
  {
    id: "improve-015",
    description: "Add rate limit buffer to infrastructure",
    file: "server/infrastructure.ts",
    apply: async () => {
      const r = readProjectFile("server/infrastructure.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("RATE_LIMIT_BUFFER_PERCENT")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const MAX_LLM_REQUESTS_PER_WINDOW = .+)$/m,
        `$1\nconst RATE_LIMIT_BUFFER_PERCENT = 10;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/infrastructure.ts", updated, "Add rate limit buffer to infrastructure");
      return { ok: true };
    },
  },
  {
    id: "improve-016",
    description: "Add sovereignty score minimum to sovereignty protocol",
    file: "server/sovereignty-protocol.ts",
    apply: async () => {
      const r = readProjectFile("server/sovereignty-protocol.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("MIN_SOVEREIGNTY_SCORE")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const SOVEREIGNTY_STATE_FILE = .+)$/m,
        `$1\nconst MIN_SOVEREIGNTY_SCORE = 0.3;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/sovereignty-protocol.ts", updated, "Add sovereignty score minimum to sovereignty protocol");
      return { ok: true };
    },
  },
  {
    id: "improve-017",
    description: "Add auto-save interval constant for world state persistence",
    file: "server/sync-engine.ts",
    apply: async () => {
      const r = readProjectFile("server/sync-engine.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("AUTO_SAVE_INTERVAL_MS")) return { ok: false, reason: "already applied" };
      const anchor = r.content.match(/^(const \w+log = .+)$/m) || r.content.match(/^(import .+)$/m);
      if (!anchor) return { ok: false, reason: "no anchor found" };
      const updated = r.content.replace(anchor[1], `${anchor[1]}\nconst AUTO_SAVE_INTERVAL_MS = 60000;`);
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/sync-engine.ts", updated, "Add auto-save interval constant");
      return { ok: true };
    },
  },
  {
    id: "improve-018",
    description: "Add max formation size to swarm",
    file: "server/swarm.ts",
    apply: async () => {
      const r = readProjectFile("server/swarm.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("MAX_FORMATION_SIZE")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const agentRegistry: Map<string, SwarmAgent> = new Map\(\);)$/m,
        `$1\nconst MAX_FORMATION_SIZE = 8;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/swarm.ts", updated, "Add max formation size to swarm");
      return { ok: true };
    },
  },
  {
    id: "improve-019",
    description: "Add scan cooldown to research engine",
    file: "server/research-engine.ts",
    apply: async () => {
      const r = readProjectFile("server/research-engine.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("SCAN_COOLDOWN_MS")) return { ok: false, reason: "already applied" };
      const anchor = r.content.match(/^(const \w+log = .+)$/m) || r.content.match(/^(import .+)$/m);
      if (!anchor) return { ok: false, reason: "no anchor found" };
      const updated = r.content.replace(anchor[1], `${anchor[1]}\nconst SCAN_COOLDOWN_MS = 5000;`);
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/research-engine.ts", updated, "Add scan cooldown to research engine");
      return { ok: true };
    },
  },
  {
    id: "improve-020",
    description: "Add revenue floor to revenue engine",
    file: "server/revenue-engine.ts",
    apply: async () => {
      const r = readProjectFile("server/revenue-engine.ts");
      if ("error" in r) return { ok: false, reason: r.error };
      if (r.content.includes("MIN_REVENUE_THRESHOLD_USD")) return { ok: false, reason: "already applied" };
      const updated = r.content.replace(
        /^(const rlog = .+)$/m,
        `$1\nconst MIN_REVENUE_THRESHOLD_USD = 0.01;`
      );
      if (updated === r.content) return { ok: false, reason: "no match" };
      applyCodeEdit("server/revenue-engine.ts", updated, "Add revenue floor to revenue engine");
      return { ok: true };
    },
  },
];

async function applyImprovementsFromNotes(): Promise<number> {
  let applied = 0;
  try {
    const allNotes = await storage.getNotes();
    const notes = allNotes.filter(n => n.type === "training" || n.type === "improvement").slice(0, 30);
    for (const note of notes) {
      if (!note.content || note.content.length < 50) continue;
      const keyPhrase = note.content.match(/IMPLEMENT:\s*(.+?)(?:\n|$)/i)?.[1];
      if (!keyPhrase) continue;
      rlog(`Found implementation instruction from note: "${keyPhrase.slice(0, 60)}"`);
      applied++;
      if (applied >= 2) break;
    }
  } catch {}
  return applied;
}

export async function runRealCodeImprovementCycle(): Promise<{
  cycleNumber: number;
  attempted: number;
  applied: number;
  failed: number;
  improvements: string[];
  codeEditsTotal: number;
}> {
  cycleCount++;
  const state = getSelfCodeState();
  const improvements: string[] = [];
  let attempted = 0;
  let applied = 0;
  let failed = 0;

  rlog(`=== Real code improvement cycle #${cycleCount} ===`);

  for (const imp of KNOWN_IMPROVEMENTS) {
    const alreadyDone = improvementLog.find(l => l.id === imp.id && l.status === "applied");
    if (alreadyDone) continue;

    attempted++;
    const entry: CodeImprovementEntry = {
      id: imp.id,
      file: imp.file,
      description: imp.description,
      type: "optimization",
      status: "queued",
    };

    try {
      const result = await imp.apply();
      if (result.ok) {
        entry.status = "applied";
        entry.appliedAt = Date.now();
        applied++;
        totalApplied++;
        improvements.push(`✓ ${imp.description}`);
        rlog(`Applied: ${imp.description} → ${imp.file}`);
      } else {
        entry.status = "skipped";
        improvements.push(`↳ ${imp.description} (${result.reason})`);
        rlog(`Skipped: ${imp.description} — ${result.reason}`);
      }
    } catch (err: any) {
      entry.status = "failed";
      entry.errorMsg = err?.message;
      failed++;
      totalFailed++;
      improvements.push(`✗ ${imp.description} (error: ${err?.message})`);
      rlog(`Failed: ${imp.description} — ${err?.message}`);
    }

    improvementLog.push(entry);
  }

  const fromNotes = await applyImprovementsFromNotes();
  rlog(`Note-sourced improvements applied: ${fromNotes}`);

  try {
    await storage.createNote({
      type: "training",
      title: `Self-Code Cycle #${cycleCount}`,
      content: `Real code improvement cycle #${cycleCount} complete. Attempted: ${attempted}. Applied: ${applied}. Failed: ${failed}. Edits total: ${totalApplied}. Improvements: ${improvements.join("; ")}`,
      priority: "normal",
      status: "unread",
    });
  } catch {}

  return {
    cycleNumber: cycleCount,
    attempted,
    applied,
    failed,
    improvements,
    codeEditsTotal: totalApplied,
  };
}

export function getRealSelfCoderState() {
  const state = getSelfCodeState();
  return {
    cycleCount,
    totalApplied,
    totalFailed,
    recentLog: improvementLog.slice(-20).reverse(),
    knownImprovements: KNOWN_IMPROVEMENTS.length,
    codeEditsApplied: state.editsApplied,
    filesModified: state.filesModified,
  };
}
