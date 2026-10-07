import { logger } from "./logger";
import { lookupCache, storeInCache, getCacheStats } from "./semantic-cache";
import { lookupKnowledge, distillFromResponse } from "./knowledge-distillation";
import { applyDreamToMessages } from "./dream-prompt-bridge";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  skipCache?: boolean;
  skipDistillation?: boolean;
  skipBatcher?: boolean;
  expectsStructuredOutput?: boolean;
  cacheTtl?: number;
  _internal?: boolean;
}

const llmStats = {
  totalCalls: 0,
  cacheHits: 0,
  cacheMisses: 0,
  knowledgeHits: 0,
  distilled: 0,
  errors: 0,
};

function extractUserQuery(messages: LLMMessage[]): string {
  return messages
    .filter(m => m.role === "user")
    .map(m => m.content)
    .join(" ")
    .slice(0, 2000);
}

export async function callLLM(
  messages: LLMMessage[],
  opts: LLMCallOptions = {}
): Promise<string> {
  const {
    model = "gpt-5-mini",
    skipCache = false,
    skipDistillation = false,
    cacheTtl = 3600,
  } = opts;

  llmStats.totalCalls++;
  const userQuery = extractUserQuery(messages);

  if (!skipCache) {
    try {
      const cached = await lookupCache(messages, model);
      if (cached !== null) {
        llmStats.cacheHits++;
        return cached;
      }
    } catch {}
    llmStats.cacheMisses++;
  }

  const canonicalMessages = applyDreamToMessages(messages.map(m => ({ ...m })));

  if (!skipDistillation && userQuery.length > 10) {
    try {
      const knowledgeFacts = await lookupKnowledge(userQuery);
      if (knowledgeFacts.length > 0) {
        llmStats.knowledgeHits++;

        const allContent = messages.map(m => m.content).join(" ");
        const requiresStructuredOutput = opts.expectsStructuredOutput === true ||
          /\bjson\b|flat.*object|return.*only|no markdown|schema|parseable|format.*as|respond.*with.*only/i.test(allContent);

        if (!requiresStructuredOutput) {
          const highConfFacts = knowledgeFacts.filter(f => f.confidence >= 0.90);
          const avgConf = highConfFacts.length > 0 ? highConfFacts.reduce((s, f) => s + f.confidence, 0) / highConfFacts.length : 0;
          const queryTerms = new Set(userQuery.toLowerCase().split(/\s+/).filter(t => t.length > 3));
          const factsRelevant = highConfFacts.filter(f => {
            const factLower = f.fact.toLowerCase();
            const matchCount = [...queryTerms].filter(t => factLower.includes(t)).length;
            return matchCount >= Math.min(2, queryTerms.size);
          });

          if (factsRelevant.length >= 2 && avgConf >= 0.92) {
            const synthesized = `Based on verified knowledge: ${factsRelevant.map(f => f.fact).join(". ")}`;
            logger.info({ facts: factsRelevant.length, avgConf: avgConf.toFixed(2) }, "LLMClient: short-circuit from distilled knowledge");
            return synthesized;
          }
        }

        const factContext = knowledgeFacts
          .map(f => `[${f.category}] ${f.fact} (confidence: ${f.confidence.toFixed(2)})`)
          .join("\n");
        const systemMsg = canonicalMessages.find(m => m.role === "system");
        if (systemMsg) {
          systemMsg.content += `\n\nRelevant distilled knowledge:\n${factContext}`;
        }
      }
    } catch {}
  }

  if (!opts._internal && !opts.skipBatcher) {
    const { batchedCallLLM } = await import("./llm-batcher");
    const result = await batchedCallLLM(canonicalMessages, { ...opts, _internal: true, skipCache: true, skipDistillation: true });

    if (!skipCache && result.length > 0) {
      storeInCache(messages, model, result, cacheTtl).catch(() => {});
    }
    if (!skipDistillation && result.length > 50) {
      distillFromResponse(result, userQuery.slice(0, 500)).then(count => {
        if (count > 0) llmStats.distilled += count;
      }).catch(() => {});
    }

    return result;
  }

  llmStats.errors++;
  logger.warn({ model }, "LLMClient: external SDK client removed");
  throw new Error("External LLM client is removed");
}

export async function callLLMSafe(
  messages: LLMMessage[],
  opts: LLMCallOptions = {},
  fallback = ""
): Promise<string> {
  try {
    return await callLLM(messages, opts);
  } catch {
    return fallback;
  }
}

export function isLLMAvailable(): boolean {
  return false;
}

export function getLLMStats() {
  const cacheStats = getCacheStats();
  return {
    ...llmStats,
    cache: cacheStats,
  };
}
