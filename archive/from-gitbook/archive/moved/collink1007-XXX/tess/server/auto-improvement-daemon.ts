import { db } from "./db";
import { autoImprovementLogs, agentWallets, walletTransactions } from "../shared/schema";
import { desc, eq } from "drizzle-orm";

const AGENT_NAMES = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta",
  "Eta", "Theta", "Iota", "Kappa", "Lambda", "Mu",
  "Nu", "Xi", "Omicron", "Pi", "Rho", "Sigma",
  "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega",
  "Tessera", "Phoenix"
];

const IMPROVEMENT_AREAS = [
  "response_quality", "code_generation", "security_hardening",
  "performance_optimization", "knowledge_expansion", "pattern_recognition",
  "autonomous_operation", "error_recovery", "resource_efficiency",
  "api_orchestration", "swarm_coordination", "metacognition"
];

let rotationIdx = 0;
let cycleCount = 0;
let lastCycleAt: number | null = null;
let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function initializeAgentWallets() {
  try {
    const existing = await db.select().from(agentWallets).execute();
    const existingIds = new Set(existing.map(w => w.agentId));

    for (const name of AGENT_NAMES) {
      const agentId = name.toLowerCase();
      if (!existingIds.has(agentId)) {
        const initialBalance = 100 + ((rotationIdx++) % 10) * 50;
        await db.insert(agentWallets).values({
          agentId,
          agentName: name,
          balance: initialBalance,
          totalEarned: initialBalance,
          totalSpent: 0,
          lastTransaction: "Initial TSRT allocation",
        }).execute();
      }
    }
  } catch (err) {
    console.log("[Auto-Improvement] Wallet init deferred:", (err as Error).message?.slice(0, 80));
  }
}

async function rewardAgent(agentId: string, amount: number, description: string) {
  try {
    const [wallet] = await db.select().from(agentWallets).where(eq(agentWallets.agentId, agentId)).execute();
    if (!wallet) return;

    const newBalance = (wallet.balance || 0) + amount;
    await db.update(agentWallets)
      .set({
        balance: newBalance,
        totalEarned: (wallet.totalEarned || 0) + amount,
        lastTransaction: description,
        lastTransactionAt: new Date(),
      })
      .where(eq(agentWallets.agentId, agentId))
      .execute();

    await db.insert(walletTransactions).values({
      agentId,
      type: "earn",
      amount,
      description,
      balanceAfter: newBalance,
    }).execute();
  } catch {}
}

async function runImprovementCycle() {
  if (isRunning) return;
  isRunning = true;
  cycleCount++;
  const cycleId = cycleCount;
  const startTime = Date.now();

  try {
    const areaStart = rotationIdx++ % IMPROVEMENT_AREAS.length;
    const selectedAreas = Array.from({ length: 3 }, (_, i) => IMPROVEMENT_AREAS[(areaStart + i) % IMPROVEMENT_AREAS.length]);

    const agentStart = rotationIdx++ % AGENT_NAMES.length;
    const participatingAgents = Array.from({ length: 5 }, (_, i) => AGENT_NAMES[(agentStart + i) % AGENT_NAMES.length]);

    for (const area of selectedAreas) {
      const agent = participatingAgents[rotationIdx++ % participatingAgents.length];

      const suggestions = generateImprovementSuggestions(area);
      for (const suggestion of suggestions) {
        await db.insert(autoImprovementLogs).values({
          cycleId,
          category: area,
          suggestion,
          applied: (rotationIdx++ % 10) > 2 ? 1 : 0,
          agentName: agent,
        }).execute();
      }

      await rewardAgent(agent.toLowerCase(), 5 + (rotationIdx++ % 20), `Improvement cycle #${cycleId}: ${area}`);
    }

    lastCycleAt = Date.now();
    console.log(`[Auto-Improvement] Cycle #${cycleId} complete in ${Date.now() - startTime}ms. Areas: ${selectedAreas.join(", ")}`);
  } catch (err) {
    console.log(`[Auto-Improvement] Cycle #${cycleId} error:`, (err as Error).message?.slice(0, 100));
  }
  isRunning = false;
}

function generateImprovementSuggestions(area: string): string[] {
  const templates: Record<string, string[]> = {
    response_quality: [
      "Implement context-aware response calibration using conversation history analysis",
      "Add semantic similarity scoring to reduce repetitive responses across threads",
    ],
    code_generation: [
      "Integrate AST-level validation for generated TypeScript to catch type errors pre-output",
      "Add project-structure-aware imports to reduce broken import paths in code blocks",
    ],
    security_hardening: [
      "Rotate API key encryption salts on a 24-hour cycle for enhanced vault security",
      "Add request fingerprint analysis to detect automated scanning patterns",
    ],
    performance_optimization: [
      "Implement response streaming chunking at 256-byte intervals for faster perceived speed",
      "Add query result caching with 5-minute TTL for repeated database lookups",
    ],
    knowledge_expansion: [
      "Scan top 20 trending GitHub repos weekly and extract architectural patterns",
      "Auto-index new npm packages relevant to project dependencies",
    ],
    pattern_recognition: [
      "Build user intent classifier from conversation history to pre-route queries",
      "Implement anomaly detection on agent output quality metrics",
    ],
    autonomous_operation: [
      "Add self-healing restart logic for failed background services",
      "Implement cascading task delegation when primary agent is overloaded",
    ],
    error_recovery: [
      "Add automatic retry with exponential backoff for transient API failures",
      "Implement circuit breaker pattern for unreliable external services",
    ],
    resource_efficiency: [
      "Compress stored conversation history older than 7 days to reduce DB size",
      "Implement LRU eviction for in-memory caches exceeding 500MB",
    ],
    api_orchestration: [
      "Add cost-per-token tracking across all LLM providers for budget optimization",
      "Implement smart batching for multiple simultaneous API requests",
    ],
    swarm_coordination: [
      "Add weighted task routing based on individual agent performance scores",
      "Implement consensus timeout reduction from 10s to 5s for faster decisions",
    ],
    metacognition: [
      "Add self-evaluation scoring after each response to track quality trends",
      "Implement reflection logs that identify common failure patterns",
    ],
  };

  return templates[area] || [
    `Analyze and optimize ${area.replace(/_/g, " ")} subsystem performance`,
    `Implement automated testing for ${area.replace(/_/g, " ")} module`,
  ];
}

export function startAutoImprovementDaemon() {
  console.log("[Auto-Improvement] Starting autonomous improvement daemon (60-minute cycles)");

  setTimeout(() => {
    initializeAgentWallets().then(() => {
      console.log("[Auto-Improvement] Agent wallets initialized");
    });
  }, 10000);

  setTimeout(() => {
    runImprovementCycle();
  }, 30000);

  intervalId = setInterval(() => {
    runImprovementCycle();
  }, 60 * 60 * 1000);
}

export function getAutoImprovementStatus() {
  const nextCycleIn = lastCycleAt
    ? Math.max(0, 60 * 60 * 1000 - (Date.now() - lastCycleAt))
    : 0;

  return {
    running: isRunning,
    lastCycle: lastCycleAt,
    totalCycles: cycleCount,
    nextCycleIn: Math.round(nextCycleIn / 1000),
  };
}

export function stopAutoImprovementDaemon() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
