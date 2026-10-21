import { db } from "@workspace/db";
import { internal_models, knowledge_graph } from "@workspace/db";
import { sql, desc } from "drizzle-orm";
import { extractCount } from "./db-utils";
import { recordTask } from "./sovereignty-monitor";
import { logExternalCall } from "./external-call-logger";
import { logger } from "./logger";

const LOG_PREFIX = "[InternalModelRouter]";

export type TaskType =
  | "general"
  | "reasoning"
  | "knowledge_retrieval"
  | "code_generation"
  | "factual_query"
  | "summarization"
  | "classification"
  | "sentiment"
  | "translation"
  | "math";

interface InternalCapability {
  taskType: TaskType;
  readiness: number;
  strategy: string;
  knowledgeThreshold: number;
}

interface RoutingDecision {
  useInternal: boolean;
  reason: string;
  capability?: InternalCapability;
  fallbackProviderId?: string;
}

interface RouterResult {
  result: string | null;
  routedTo: "internal" | "external";
  taskType: TaskType;
  latencyMs: number;
  internalCapabilityScore: number;
  decision: RoutingDecision;
}

let routerBootTime = Date.now();
let totalRouted = 0;
let totalInternal = 0;
let totalExternal = 0;
let routerCycleCount = 0;

const INTERNAL_THRESHOLD = 0.60;

const CAPABILITY_MAP: InternalCapability[] = [
  {
    taskType: "knowledge_retrieval",
    readiness: 0,
    strategy: "Query the knowledge graph for relevant nodes matching the query",
    knowledgeThreshold: 100,
  },
  {
    taskType: "factual_query",
    readiness: 0,
    strategy: "Search knowledge graph and build ledger for established facts",
    knowledgeThreshold: 500,
  },
  {
    taskType: "classification",
    readiness: 0,
    strategy: "Use knowledge graph domain tags and classification patterns",
    knowledgeThreshold: 50,
  },
  {
    taskType: "summarization",
    readiness: 0,
    strategy: "Extract key points from knowledge graph content nodes",
    knowledgeThreshold: 200,
  },
  {
    taskType: "reasoning",
    readiness: 0,
    strategy: "Chain knowledge nodes through edge relationships",
    knowledgeThreshold: 1000,
  },
  {
    taskType: "math",
    readiness: 75,
    strategy: "Apply mathematical knowledge nodes and symbolic reasoning",
    knowledgeThreshold: 10,
  },
  {
    taskType: "sentiment",
    readiness: 0,
    strategy: "Use pattern matching and emotion-tagged knowledge nodes",
    knowledgeThreshold: 50,
  },
  {
    taskType: "code_generation",
    readiness: 0,
    strategy: "Leverage code knowledge nodes and programming patterns",
    knowledgeThreshold: 500,
  },
  {
    taskType: "general",
    readiness: 0,
    strategy: "Best-effort internal retrieval from knowledge graph",
    knowledgeThreshold: 100,
  },
  {
    taskType: "translation",
    readiness: 0,
    strategy: "Use multi-language knowledge nodes",
    knowledgeThreshold: 200,
  },
];

async function measureCapabilityReadiness(): Promise<Map<TaskType, number>> {
  const readinessMap = new Map<TaskType, number>();

  try {
    const totalNodes = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE source_type NOT IN ('insight', 'swarm_training')`);
    const nodeCount = extractCount(totalNodes);

    for (const cap of CAPABILITY_MAP) {
      let readiness = cap.readiness;

      if (nodeCount >= cap.knowledgeThreshold) {
        readiness = Math.min(100, Math.round((nodeCount / (cap.knowledgeThreshold * 10)) * 100));
      } else {
        readiness = Math.round((nodeCount / cap.knowledgeThreshold) * cap.readiness);
      }

      if (cap.taskType === "math") {
        readiness = Math.max(cap.readiness, readiness);
      }

      readinessMap.set(cap.taskType, Math.min(100, readiness));
      cap.readiness = readinessMap.get(cap.taskType) ?? 0;
    }
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Capability measurement failed`);
    for (const cap of CAPABILITY_MAP) {
      readinessMap.set(cap.taskType, cap.readiness);
    }
  }

  return readinessMap;
}

async function handleInternally(params: {
  taskType: TaskType;
  prompt: string;
  context?: string;
}): Promise<string | null> {
  try {
    const { sql: drizzleSql } = await import("drizzle-orm");

    const searchTerm = params.prompt.slice(0, 100).replace(/[%_]/g, "\\$&");

    const nodes = await db.execute(drizzleSql`
      SELECT label, content, source_type, metadata->>'domain' as domain, confidence
      FROM knowledge_graph
      WHERE 
        content IS NOT NULL 
        AND content != ''
        AND (
          label ILIKE ${`%${searchTerm.split(" ").slice(0, 3).join("%")}%`}
          OR content ILIKE ${`%${searchTerm.split(" ").slice(0, 3).join("%")}%`}
        )
      ORDER BY confidence DESC, updated_at DESC
      LIMIT 5
    `);

    type KGRow = { label: string; content: string | null; domain: string | null; confidence: number };
    const rows = ((nodes as { rows?: KGRow[] }).rows ?? (nodes as unknown as KGRow[]));

    if (rows.length === 0) return null;

    const assembled = rows.map(r =>
      `[${r.domain ?? "general"}] ${r.label}: ${(r.content ?? "").slice(0, 300)}`
    ).join("\n---\n");

    return `[Internal Knowledge Response]\n${assembled}\n\n(Retrieved from sovereign knowledge graph — ${rows.length} relevant nodes)`;
  } catch (err) {
    logger.warn({ err }, `${LOG_PREFIX} Internal handling failed`);
    return null;
  }
}

function makeRoutingDecision(
  taskType: TaskType,
  readinessMap: Map<TaskType, number>,
  forceInternal?: boolean
): RoutingDecision {
  const readiness = (readinessMap.get(taskType) ?? 0) / 100;
  const capability = CAPABILITY_MAP.find(c => c.taskType === taskType);

  if (forceInternal) {
    return {
      useInternal: true,
      reason: "Force internal routing requested",
      capability,
    };
  }

  if (readiness >= INTERNAL_THRESHOLD) {
    return {
      useInternal: true,
      reason: `Internal readiness ${Math.round(readiness * 100)}% meets threshold ${Math.round(INTERNAL_THRESHOLD * 100)}%`,
      capability,
    };
  }

  return {
    useInternal: false,
    reason: `Internal readiness ${Math.round(readiness * 100)}% below threshold ${Math.round(INTERNAL_THRESHOLD * 100)}% — routing to external`,
    capability,
    fallbackProviderId: "openai-integration",
  };
}

export async function routeTask(params: {
  taskType: TaskType;
  prompt: string;
  context?: string;
  systemPrompt?: string;
  forceInternal?: boolean;
  externalFn?: () => Promise<string | null>;
  providerId?: string;
}): Promise<RouterResult> {
  routerCycleCount++;
  totalRouted++;
  const start = Date.now();

  const readinessMap = await measureCapabilityReadiness();
  const decision = makeRoutingDecision(params.taskType, readinessMap, params.forceInternal);
  const internalCapabilityScore = readinessMap.get(params.taskType) ?? 0;

  let result: string | null = null;
  let routedTo: "internal" | "external" = "external";

  if (decision.useInternal) {
    result = await handleInternally({
      taskType: params.taskType,
      prompt: params.prompt,
      context: params.context,
    });

    if (result !== null) {
      routedTo = "internal";
      totalInternal++;
      recordTask({
        taskType: params.taskType,
        handledInternally: true,
        successRate: 1.0,
        latencyMs: Date.now() - start,
      });
      console.log(`${LOG_PREFIX} [INTERNAL] ${params.taskType} — score ${internalCapabilityScore}%`);
    } else {
      console.log(`${LOG_PREFIX} [INTERNAL→FALLBACK] ${params.taskType} — internal returned null, using external`);
    }
  }

  if (result === null) {
    routedTo = "external";
    totalExternal++;

    if (params.externalFn) {
      const extStart = Date.now();
      try {
        result = await params.externalFn();
        const extLatency = Date.now() - extStart;

        recordTask({
          taskType: params.taskType,
          handledInternally: false,
          providerId: params.providerId ?? "external",
          successRate: result !== null ? 1.0 : 0.0,
          latencyMs: extLatency,
        });

        logExternalCall({
          providerId: params.providerId ?? "external",
          providerType: "llm",
          taskType: params.taskType,
          requestPayload: { prompt: params.prompt.slice(0, 500), taskType: params.taskType },
          responseText: result?.slice(0, 1000),
          latencyMs: extLatency,
          success: result !== null,
          metadata: { routedBy: "internal-model-router", internalScore: internalCapabilityScore },
        });

        console.log(`${LOG_PREFIX} [EXTERNAL] ${params.taskType} via ${params.providerId ?? "external"} — ${extLatency}ms`);
      } catch (err) {
        logger.warn({ err }, `${LOG_PREFIX} External fn failed`);
      }
    } else {
      recordTask({
        taskType: params.taskType,
        handledInternally: false,
        providerId: params.providerId ?? "external",
        successRate: 0.0,
        latencyMs: Date.now() - start,
      });
      console.log(`${LOG_PREFIX} [EXTERNAL-NOFN] ${params.taskType} — no external fn provided, routing deferred to caller`);
    }
  }

  return {
    result,
    routedTo,
    taskType: params.taskType,
    latencyMs: Date.now() - start,
    internalCapabilityScore,
    decision,
  };
}

export async function getRouterStatus() {
  const readinessMap = await measureCapabilityReadiness();
  const internalRatio = totalRouted > 0 ? Math.round((totalInternal / totalRouted) * 100) : 0;

  return {
    uptimeMs: Date.now() - routerBootTime,
    totalRouted,
    totalInternal,
    totalExternal,
    internalRatio,
    cycleCount: routerCycleCount,
    capabilities: CAPABILITY_MAP.map(cap => ({
      taskType: cap.taskType,
      readiness: readinessMap.get(cap.taskType) ?? cap.readiness,
      threshold: Math.round(INTERNAL_THRESHOLD * 100),
      ready: (readinessMap.get(cap.taskType) ?? cap.readiness) >= INTERNAL_THRESHOLD * 100,
      strategy: cap.strategy,
    })),
    internalThreshold: Math.round(INTERNAL_THRESHOLD * 100),
  };
}

export async function updateCapabilityReadiness(): Promise<void> {
  await measureCapabilityReadiness();
  logger.info(`${LOG_PREFIX} Capability readiness updated`);
}
