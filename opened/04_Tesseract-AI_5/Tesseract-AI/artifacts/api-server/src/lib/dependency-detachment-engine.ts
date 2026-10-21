import { db } from "@workspace/db";
import { data_sources, sovereignty_metrics, system_audit, knowledge_graph } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { updatePhaseProgress } from "./sovereignty-engine";
import { isLLMConfigured } from "./llm-client";
import { logger } from "./logger";
import { extractCount } from "./db-utils";

const LOG_PREFIX = "[DetachEngine]";

interface ExternalDependency {
  id: string;
  name: string;
  type: "llm_provider" | "api_service" | "data_feed" | "infrastructure" | "library";
  status: "active" | "deprecating" | "replaced" | "banned";
  envKey: string;
  isConfigured: boolean;
  sovereigntyImpact: number;
}

let detachCycleCount = 0;
let continuousInterval: ReturnType<typeof setInterval> | null = null;

function scanRealDependencies(): ExternalDependency[] {
  return [
    { id: "dep-openai", name: "OpenAI API", type: "llm_provider", status: "banned", envKey: "OPENAI_API_KEY", isConfigured: !!process.env.OPENAI_API_KEY, sovereigntyImpact: -20 },
    { id: "dep-google", name: "Google/Gemini API", type: "llm_provider", status: "banned", envKey: "GOOGLE_API_KEY", isConfigured: !!process.env.GOOGLE_API_KEY, sovereigntyImpact: -20 },
    { id: "dep-openrouter", name: "OpenRouter API", type: "llm_provider", status: "deprecating", envKey: "OPENROUTER_API_KEY", isConfigured: !!process.env.OPENROUTER_API_KEY, sovereigntyImpact: -10 },
    { id: "dep-deepseek", name: "DeepSeek API", type: "llm_provider", status: "deprecating", envKey: "DEEPSEEK_API_KEY", isConfigured: !!process.env.DEEPSEEK_API_KEY, sovereigntyImpact: -8 },
    { id: "dep-xai", name: "xAI/Grok API", type: "llm_provider", status: "deprecating", envKey: "XAI_API_KEY", isConfigured: !!process.env.XAI_API_KEY, sovereigntyImpact: -8 },
    { id: "dep-cohere", name: "Cohere API", type: "llm_provider", status: "deprecating", envKey: "COHERE_API_KEY", isConfigured: !!process.env.COHERE_API_KEY, sovereigntyImpact: -5 },
    { id: "dep-huggingface", name: "HuggingFace", type: "llm_provider", status: "deprecating", envKey: "HUGGINGFACE_API_KEY", isConfigured: !!process.env.HUGGINGFACE_API_KEY, sovereigntyImpact: -5 },
    { id: "dep-github", name: "GitHub Models", type: "llm_provider", status: "deprecating", envKey: "GITHUB_TOKEN", isConfigured: !!process.env.GITHUB_TOKEN, sovereigntyImpact: -5 },
    { id: "dep-npm", name: "npm Registry", type: "infrastructure", status: "active", envKey: "NPM_TOKEN", isConfigured: true, sovereigntyImpact: -3 },
    { id: "dep-postgres", name: "PostgreSQL (Neon)", type: "infrastructure", status: "active", envKey: "DATABASE_URL", isConfigured: !!process.env.DATABASE_URL, sovereigntyImpact: -2 },
  ];
}

async function measureInternalCapability(): Promise<Record<string, { name: string; readiness: number; evidence: string }>> {
  const capabilities: Record<string, { name: string; readiness: number; evidence: string }> = {};

  try {
    const nodeCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph`);
    const cnt = extractCount(nodeCount);
    const readiness = Math.min(100, Math.round((cnt / 10000) * 100));
    capabilities["tess-knowledge-v1"] = {
      name: "Tessera Knowledge Base",
      readiness,
      evidence: `${cnt} knowledge nodes in graph`,
    };
  } catch {
    capabilities["tess-knowledge-v1"] = { name: "Tessera Knowledge Base", readiness: 0, evidence: "DB query failed" };
  }

  try {
    const domainCount = await db.execute(sql`SELECT COUNT(DISTINCT metadata->>'domain') as cnt FROM knowledge_graph WHERE metadata->>'domain' IS NOT NULL`);
    const cnt = extractCount(domainCount);
    const readiness = Math.min(100, Math.round((cnt / 69) * 100));
    capabilities["tess-search-v1"] = {
      name: "Tessera Internal Search",
      readiness,
      evidence: `${cnt} domains indexed`,
    };
  } catch {
    capabilities["tess-search-v1"] = { name: "Tessera Internal Search", readiness: 0, evidence: "DB query failed" };
  }

  const llmReady = isLLMConfigured();
  capabilities["tess-reason-v1"] = {
    name: "Tessera Reasoning Core",
    readiness: llmReady ? 30 : 0,
    evidence: llmReady ? "LLM integration configured (external proxy — not fully sovereign)" : "No LLM integration configured",
  };

  capabilities["tess-embed-v1"] = {
    name: "Tessera Embeddings",
    readiness: 0,
    evidence: "No sovereign embedding model deployed yet",
  };

  return capabilities;
}

function computeSovereigntyScore(deps: ExternalDependency[]): number {
  const total = deps.length;
  const resolved = deps.filter(d => d.status === "banned" && !d.isConfigured).length;
  const replaced = deps.filter(d => d.status === "replaced").length;
  return Math.floor(((resolved + replaced) / total) * 100);
}

export async function runDetachmentCycle(): Promise<{
  cycleNumber: number;
  dependencies: ExternalDependency[];
  capabilities: Record<string, { name: string; readiness: number; evidence: string }>;
  sovereigntyScore: number;
}> {
  detachCycleCount++;
  const startTime = Date.now();

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} DETACHMENT CYCLE #${detachCycleCount} — REAL DEPENDENCY SCAN`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  console.log(`${LOG_PREFIX} [Step 1] Scanning real external dependencies (env vars)`);
  const deps = scanRealDependencies();
  for (const d of deps) {
    const icon = d.isConfigured ? "●" : "○";
    console.log(`${LOG_PREFIX}   ${icon} ${d.name}: ${d.status} (configured: ${d.isConfigured})`);
  }

  console.log(`${LOG_PREFIX} [Step 2] Measuring internal capability (real DB queries)`);
  const capabilities = await measureInternalCapability();
  for (const [id, cap] of Object.entries(capabilities)) {
    console.log(`${LOG_PREFIX}   ${cap.name}: ${cap.readiness}% — ${cap.evidence}`);
  }

  console.log(`${LOG_PREFIX} [Step 3] Computing sovereignty score`);
  const sovereigntyScore = computeSovereigntyScore(deps);

  const activeCount = deps.filter(d => d.status === "active").length;
  const deprecatingCount = deps.filter(d => d.status === "deprecating").length;
  const configuredCount = deps.filter(d => d.isConfigured).length;
  const bannedCount = deps.filter(d => d.status === "banned").length;

  try {
    await db.insert(sovereignty_metrics).values([
      { phase: "Phase 4", phaseNumber: 4, metricName: "Active Dependencies", currentValue: activeCount, targetValue: 0, unit: "count", status: "measured" },
      { phase: "Phase 4", phaseNumber: 4, metricName: "Deprecating Dependencies", currentValue: deprecatingCount, targetValue: 0, unit: "count", status: "measured" },
      { phase: "Phase 4", phaseNumber: 4, metricName: "Configured Externals", currentValue: configuredCount, targetValue: 0, unit: "count", status: "measured" },
      { phase: "Phase 4", phaseNumber: 4, metricName: "Banned (Enforced)", currentValue: bannedCount, targetValue: bannedCount, unit: "count", status: "measured" },
      { phase: "Phase 4", phaseNumber: 4, metricName: "Sovereignty Score", currentValue: sovereigntyScore, targetValue: 100, unit: "percent", status: "measured" },
    ]).onConflictDoNothing();
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  const progress = Math.min(95, sovereigntyScore);
  await updatePhaseProgress(4, progress, "in_progress").catch(() => {});

  const duration = Date.now() - startTime;
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} CYCLE #${detachCycleCount} COMPLETE`);
  console.log(`${LOG_PREFIX} Sovereignty: ${sovereigntyScore}% | Active: ${activeCount} | Deprecating: ${deprecatingCount} | Configured: ${configuredCount} | Banned: ${bannedCount}`);
  console.log(`${LOG_PREFIX} Duration: ${duration}ms`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  return {
    cycleNumber: detachCycleCount,
    dependencies: deps,
    capabilities,
    sovereigntyScore,
  };
}

export function getDetachmentStatus() {
  const deps = scanRealDependencies();
  return {
    cycleCount: detachCycleCount,
    sovereigntyScore: computeSovereigntyScore(deps),
    dependencies: deps,
    continuousActive: continuousInterval !== null,
    summary: {
      total: deps.length,
      active: deps.filter(d => d.status === "active").length,
      deprecating: deps.filter(d => d.status === "deprecating").length,
      replaced: deps.filter(d => d.status === "replaced").length,
      banned: deps.filter(d => d.status === "banned").length,
      configured: deps.filter(d => d.isConfigured).length,
    },
  };
}

export function startContinuousDetachment() {
  if (continuousInterval) return;
  console.log(`${LOG_PREFIX} Starting continuous detachment engine (every 15 minutes)`);
  runDetachmentCycle().catch(err => console.error(`${LOG_PREFIX} Initial cycle failed:`, err));
  continuousInterval = setInterval(() => {
    runDetachmentCycle().catch(err => console.error(`${LOG_PREFIX} Cycle failed:`, err));
  }, 15 * 60 * 1000);
}

export function stopContinuousDetachment() {
  if (continuousInterval) {
    clearInterval(continuousInterval);
    continuousInterval = null;
    console.log(`${LOG_PREFIX} Continuous detachment engine stopped`);
  }
}
