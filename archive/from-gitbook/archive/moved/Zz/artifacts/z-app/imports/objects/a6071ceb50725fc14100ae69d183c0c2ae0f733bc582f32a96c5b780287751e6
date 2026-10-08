import { db } from "@workspace/db";
import { providerProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

export interface ProviderConfig {
  id: string;
  name: string;
  isExternal: boolean;
  type: "cloud" | "local" | "proxy";
  models: string[];
  capabilities: string[];
  endpoint?: string;
  tier: 0 | 1 | 2;
}

const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "anthropic",
    name: "Anthropic",
    isExternal: true,
    type: "cloud",
    tier: 2,
    models: ["claude-sonnet-4-20250514", "claude-3-7-sonnet-latest", "claude-3-5-sonnet-latest"],
    capabilities: ["chat", "reasoning", "coding", "analysis", "long-context"],
  },
  {
    id: "openai",
    name: "OpenAI",
    isExternal: true,
    type: "cloud",
    tier: 2,
    models: ["gpt-4o", "gpt-4.1", "gpt-4o-mini"],
    capabilities: ["chat", "coding", "function-calling", "vision", "embeddings"],
  },
  {
    id: "google",
    name: "Google",
    isExternal: true,
    type: "cloud",
    tier: 2,
    models: ["gemini-2.0-flash", "gemini-2.5-flash-preview-05-20"],
    capabilities: ["chat", "vision", "multimodal", "long-context", "reasoning"],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    isExternal: true,
    type: "cloud",
    tier: 2,
    models: ["deepseek-chat", "deepseek-reasoner", "deepseek/deepseek-chimera"],
    capabilities: ["chat", "reasoning", "coding", "math"],
  },
  {
    id: "xai",
    name: "xAI",
    isExternal: true,
    type: "cloud",
    tier: 2,
    models: ["grok-3"],
    capabilities: ["chat", "real-time", "analysis"],
  },
  {
    id: "groq",
    name: "Groq",
    isExternal: true,
    type: "cloud",
    tier: 1,
    models: ["llama-3.3-70b-versatile"],
    capabilities: ["chat", "fast-inference", "open-weights"],
  },
  {
    id: "mistral",
    name: "Mistral",
    isExternal: true,
    type: "cloud",
    tier: 2,
    models: ["mistral-large-latest", "pixtral-large-latest", "codestral-latest"],
    capabilities: ["chat", "coding", "multilingual", "vision"],
  },
  {
    id: "meta",
    name: "Meta",
    isExternal: true,
    type: "cloud",
    tier: 2,
    models: ["meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8", "meta-llama/Meta-Llama-3.1-405B-Instruct"],
    capabilities: ["chat", "open-weights", "reasoning"],
  },
  {
    id: "qwen",
    name: "Qwen",
    isExternal: true,
    type: "cloud",
    tier: 2,
    models: ["qwen/qwen3-32b:free", "qwen/qwen3-235b-a22b"],
    capabilities: ["chat", "coding", "multilingual", "reasoning"],
  },
  {
    id: "moonshot",
    name: "Moonshot",
    isExternal: true,
    type: "cloud",
    tier: 2,
    models: ["moonshotai/kimi-k2", "moonshotai/kimi-k2.5", "moonshotai/kimi-k2-thinking"],
    capabilities: ["chat", "reasoning", "long-context"],
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    isExternal: false,
    type: "local",
    tier: 0,
    endpoint: process.env.OLLAMA_ENDPOINT ?? "http://localhost:11434",
    models: [],
    capabilities: ["chat", "self-hosted", "offline", "privacy"],
  },
  {
    id: "puter",
    name: "Puter Proxy",
    isExternal: false,
    type: "proxy",
    tier: 1,
    models: ["via-puter"],
    capabilities: ["chat", "proxy", "multi-provider"],
  },
];

let providerStatuses = new Map<string, "active" | "degraded" | "offline">();

export function getProviderConfigs(): ProviderConfig[] {
  return PROVIDER_CONFIGS;
}

export function getProviderConfig(id: string): ProviderConfig | undefined {
  return PROVIDER_CONFIGS.find(p => p.id === id);
}

export function setProviderStatus(id: string, status: "active" | "degraded" | "offline"): void {
  providerStatuses.set(id, status);
}

export function getProviderStatus(id: string): "active" | "degraded" | "offline" {
  return providerStatuses.get(id) ?? "active";
}

export async function upsertProviderProfile(providerId: string, updates: Partial<{
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRate: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  capabilities: string[];
  strengths: string[];
  weaknesses: string[];
  capabilityScore: number;
  reliabilityScore: number;
  speedScore: number;
  lastAnalyzedAt: Date;
}>): Promise<void> {
  const config = getProviderConfig(providerId);
  if (!config) return;

  try {
    const existing = await db.select().from(providerProfilesTable)
      .where(eq(providerProfilesTable.providerId, providerId))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(providerProfilesTable).values({
        providerId,
        providerName: config.name,
        isExternal: config.isExternal,
        isActive: true,
        models: config.models,
        capabilities: updates.capabilities ?? config.capabilities,
        strengths: updates.strengths ?? [],
        weaknesses: updates.weaknesses ?? [],
        ...updates,
        updatedAt: new Date(),
      });
    } else {
      await db.update(providerProfilesTable)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(providerProfilesTable.providerId, providerId));
    }
  } catch (err) {
    logger.error({ err, providerId }, "Failed to upsert provider profile");
  }
}

export async function getAllProviderProfiles() {
  try {
    return await db.select().from(providerProfilesTable);
  } catch {
    return [];
  }
}

export async function initializeProviderProfiles(): Promise<void> {
  for (const config of PROVIDER_CONFIGS) {
    await upsertProviderProfile(config.id, {
      capabilities: config.capabilities,
    });
  }
  logger.info({ count: PROVIDER_CONFIGS.length }, "Provider profiles initialized");
}
