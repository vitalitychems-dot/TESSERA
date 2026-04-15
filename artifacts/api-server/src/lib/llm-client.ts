import OpenAI from "openai";
import { logger } from "./logger";
import { lookupCache, storeInCache, getCacheStats } from "./semantic-cache";
import { lookupKnowledge, distillFromResponse } from "./knowledge-distillation";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "_DUMMY_API_KEY_";
    if (!baseURL) {
      throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL not set");
    }
    _client = new OpenAI({ baseURL, apiKey });
  }
  return _client;
}

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
  cacheTtl?: number;
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
    maxTokens = 2048,
    timeoutMs = 15_000,
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

  const canonicalMessages = messages.map(m => ({ ...m }));

  if (!skipDistillation && userQuery.length > 10) {
    try {
      const knowledgeFacts = await lookupKnowledge(userQuery);
      if (knowledgeFacts.length > 0) {
        llmStats.knowledgeHits++;

        const allContent = messages.map(m => m.content).join(" ");
        const requiresStructuredOutput = /\bjson\b|flat.*object|return.*only|no markdown|schema|parseable|format.*as|respond.*with.*only/i.test(allContent);

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const client = getClient();
    const response = await client.chat.completions.create(
      {
        model,
        max_completion_tokens: maxTokens,
        messages: canonicalMessages,
      },
      { signal: controller.signal as AbortSignal }
    );
    const result = response.choices[0]?.message?.content ?? "";

    if (!skipCache && result.length > 0) {
      storeInCache(messages, model, result, cacheTtl).catch(() => {});
    }

    if (!skipDistillation && result.length > 50) {
      distillFromResponse(result, userQuery.slice(0, 500)).then(count => {
        if (count > 0) llmStats.distilled += count;
      }).catch(() => {});
    }

    return result;
  } catch (err: unknown) {
    llmStats.errors++;
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg, model }, "LLMClient: call failed");
    throw err;
  } finally {
    clearTimeout(timer);
  }
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
  return !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
}

export function getLLMStats() {
  const cacheStats = getCacheStats();
  return {
    ...llmStats,
    cache: cacheStats,
  };
}
