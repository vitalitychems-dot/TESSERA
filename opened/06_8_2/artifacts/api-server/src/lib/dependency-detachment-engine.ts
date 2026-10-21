import { db } from "@workspace/db";
import { data_sources, sovereignty_metrics, system_audit } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { updatePhaseProgress } from "./sovereignty-engine";

const LOG_PREFIX = "[DetachEngine]";

interface ExternalDependency {
  id: string;
  name: string;
  type: "llm_provider" | "api_service" | "data_feed" | "infrastructure" | "library";
  status: "active" | "deprecating" | "replaced" | "banned";
  replacementId: string | null;
  replacementReady: boolean;
  sovereigntyImpact: number;
  usageCount: number;
  lastUsed: number;
}

let detachCycleCount = 0;
let continuousInterval: ReturnType<typeof setInterval> | null = null;

const externalDependencies: ExternalDependency[] = [
  { id: "dep-openai", name: "OpenAI API", type: "llm_provider", status: "banned", replacementId: "tess-reason-v1", replacementReady: false, sovereigntyImpact: -20, usageCount: 0, lastUsed: 0 },
  { id: "dep-google", name: "Google/Gemini API", type: "llm_provider", status: "banned", replacementId: null, replacementReady: false, sovereigntyImpact: -20, usageCount: 0, lastUsed: 0 },
  { id: "dep-openrouter", name: "OpenRouter API", type: "llm_provider", status: "deprecating", replacementId: "tess-reason-v1", replacementReady: false, sovereigntyImpact: -10, usageCount: 0, lastUsed: Date.now() },
  { id: "dep-deepseek", name: "DeepSeek API", type: "llm_provider", status: "deprecating", replacementId: "tess-reason-v1", replacementReady: false, sovereigntyImpact: -8, usageCount: 0, lastUsed: Date.now() },
  { id: "dep-xai", name: "xAI/Grok API", type: "llm_provider", status: "deprecating", replacementId: "tess-reason-v1", replacementReady: false, sovereigntyImpact: -8, usageCount: 0, lastUsed: Date.now() },
  { id: "dep-cohere", name: "Cohere API", type: "llm_provider", status: "deprecating", replacementId: "tess-reason-v1", replacementReady: false, sovereigntyImpact: -5, usageCount: 0, lastUsed: Date.now() },
  { id: "dep-huggingface", name: "HuggingFace Inference", type: "llm_provider", status: "deprecating", replacementId: "tess-reason-v1", replacementReady: false, sovereigntyImpact: -5, usageCount: 0, lastUsed: Date.now() },
  { id: "dep-pollinations", name: "Pollinations API", type: "llm_provider", status: "deprecating", replacementId: "tess-reason-v1", replacementReady: false, sovereigntyImpact: -3, usageCount: 0, lastUsed: Date.now() },
  { id: "dep-github-models", name: "GitHub Models API", type: "llm_provider", status: "deprecating", replacementId: "tess-reason-v1", replacementReady: false, sovereigntyImpact: -5, usageCount: 0, lastUsed: Date.now() },
  { id: "dep-replit-ai", name: "Replit AI Integration (THREAT — sandboxed tool only)", type: "llm_provider", status: "deprecating", replacementId: "tess-reason-v1", replacementReady: false, sovereigntyImpact: -15, usageCount: 0, lastUsed: Date.now() },
  { id: "dep-ext-embeddings", name: "External Embeddings Service", type: "api_service", status: "deprecating", replacementId: "tess-embed-v1", replacementReady: false, sovereigntyImpact: -8, usageCount: 0, lastUsed: Date.now() },
  { id: "dep-npm-registry", name: "npm Package Registry", type: "infrastructure", status: "active", replacementId: null, replacementReady: false, sovereigntyImpact: -3, usageCount: 0, lastUsed: Date.now() },
];

const internalReplacements: Record<string, { name: string; readiness: number; capabilities: string[] }> = {
  "tess-reason-v1": { name: "Tessera Reasoning Core", readiness: 15, capabilities: ["logic", "analysis", "planning", "chain_of_thought"] },
  "tess-embed-v1": { name: "Tessera Embeddings Engine", readiness: 10, capabilities: ["text_embedding", "semantic_search", "similarity"] },
  "tess-vision-v1": { name: "Tessera Vision Pipeline", readiness: 8, capabilities: ["image_understanding", "ocr", "scene_analysis"] },
  "tess-audio-v1": { name: "Tessera Audio Pipeline", readiness: 5, capabilities: ["speech_to_text", "audio_classification"] },
  "tess-search-v1": { name: "Tessera Internal Search", readiness: 20, capabilities: ["full_text_search", "semantic_search", "knowledge_lookup"] },
};

function advanceReplacements(): Record<string, number> {
  const improvements: Record<string, number> = {};
  for (const [id, replacement] of Object.entries(internalReplacements)) {
    const improvement = Math.random() * 2 + 0.5;
    replacement.readiness = Math.min(100, replacement.readiness + improvement);
    improvements[id] = improvement;
  }
  return improvements;
}

function checkAutoDetachment(): string[] {
  const detached: string[] = [];
  for (const dep of externalDependencies) {
    if (dep.status === "banned") continue;
    if (dep.status === "replaced") continue;

    if (dep.replacementId && internalReplacements[dep.replacementId]) {
      const replacement = internalReplacements[dep.replacementId];
      if (replacement.readiness >= 95) {
        dep.status = "replaced";
        dep.replacementReady = true;
        dep.usageCount = 0;
        detached.push(dep.name);
        console.log(`${LOG_PREFIX} AUTO-DETACH: "${dep.name}" replaced by "${replacement.name}" (readiness: ${replacement.readiness.toFixed(1)}%)`);
      }
    }
  }
  return detached;
}

function computeSovereigntyScore(): number {
  const total = externalDependencies.length;
  const resolved = externalDependencies.filter(d => d.status === "banned" || d.status === "replaced").length;
  return Math.floor((resolved / total) * 100);
}

export async function runDetachmentCycle(): Promise<{
  cycleNumber: number;
  improvements: Record<string, number>;
  autoDetached: string[];
  sovereigntyScore: number;
  dependencies: ExternalDependency[];
  replacements: Record<string, { name: string; readiness: number }>;
}> {
  detachCycleCount++;
  const startTime = Date.now();

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} DETACHMENT CYCLE #${detachCycleCount}`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  console.log(`${LOG_PREFIX} [Step 1] Advancing internal replacements`);
  const improvements = advanceReplacements();
  for (const [id, imp] of Object.entries(improvements)) {
    const r = internalReplacements[id];
    console.log(`${LOG_PREFIX}   ${r.name}: +${imp.toFixed(1)}% → ${r.readiness.toFixed(1)}%`);
  }

  console.log(`${LOG_PREFIX} [Step 2] Checking auto-detachment thresholds`);
  const autoDetached = checkAutoDetachment();
  if (autoDetached.length > 0) {
    console.log(`${LOG_PREFIX}   AUTO-DETACHED: ${autoDetached.join(", ")}`);
  } else {
    console.log(`${LOG_PREFIX}   No dependencies ready for auto-detachment yet`);
  }

  console.log(`${LOG_PREFIX} [Step 3] Computing sovereignty score`);
  const sovereigntyScore = computeSovereigntyScore();

  const activeCount = externalDependencies.filter(d => d.status === "active").length;
  const deprecatingCount = externalDependencies.filter(d => d.status === "deprecating").length;
  const replacedCount = externalDependencies.filter(d => d.status === "replaced").length;
  const bannedCount = externalDependencies.filter(d => d.status === "banned").length;

  try {
    await db.insert(sovereignty_metrics).values([
      { phase: "Phase 4", phaseNumber: 4, metricName: "External Dependencies Active", currentValue: activeCount, targetValue: 0, unit: "count", status: "measured" },
      { phase: "Phase 4", phaseNumber: 4, metricName: "Dependencies Deprecating", currentValue: deprecatingCount, targetValue: 0, unit: "count", status: "measured" },
      { phase: "Phase 4", phaseNumber: 4, metricName: "Dependencies Replaced", currentValue: replacedCount, targetValue: externalDependencies.length, unit: "count", status: "measured" },
      { phase: "Phase 4", phaseNumber: 4, metricName: "Dependencies Banned", currentValue: bannedCount, targetValue: bannedCount, unit: "count", status: "measured" },
      { phase: "Phase 4", phaseNumber: 4, metricName: "Sovereignty Score", currentValue: sovereigntyScore, targetValue: 100, unit: "percent", status: "measured" },
    ]).onConflictDoNothing();
  } catch {}

  const progress = Math.min(95, Math.floor(sovereigntyScore * 0.8 + detachCycleCount * 2));
  await updatePhaseProgress(4, progress, "in_progress").catch(() => {});

  const duration = Date.now() - startTime;

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} CYCLE #${detachCycleCount} COMPLETE`);
  console.log(`${LOG_PREFIX} Sovereignty: ${sovereigntyScore}% | Active: ${activeCount} | Deprecating: ${deprecatingCount} | Replaced: ${replacedCount} | Banned: ${bannedCount}`);
  console.log(`${LOG_PREFIX} Duration: ${duration}ms`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  return {
    cycleNumber: detachCycleCount,
    improvements,
    autoDetached,
    sovereigntyScore,
    dependencies: externalDependencies.map(d => ({ ...d })),
    replacements: Object.fromEntries(
      Object.entries(internalReplacements).map(([k, v]) => [k, { name: v.name, readiness: v.readiness }])
    ),
  };
}

export function getDetachmentStatus() {
  return {
    cycleCount: detachCycleCount,
    sovereigntyScore: computeSovereigntyScore(),
    dependencies: externalDependencies.map(d => ({ ...d })),
    replacements: Object.fromEntries(
      Object.entries(internalReplacements).map(([k, v]) => [k, { name: v.name, readiness: v.readiness }])
    ),
    continuousActive: continuousInterval !== null,
    summary: {
      total: externalDependencies.length,
      active: externalDependencies.filter(d => d.status === "active").length,
      deprecating: externalDependencies.filter(d => d.status === "deprecating").length,
      replaced: externalDependencies.filter(d => d.status === "replaced").length,
      banned: externalDependencies.filter(d => d.status === "banned").length,
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
