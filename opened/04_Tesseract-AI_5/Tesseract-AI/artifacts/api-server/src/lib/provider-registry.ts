import { db } from "@workspace/db";
import { internal_models } from "@workspace/db";
import { eq } from "drizzle-orm";
import { runInSandbox } from "./external-call-sandbox";
import { logExternalCall } from "./external-call-logger";

const LOG_PREFIX = "[ProviderRegistry]";

export interface ProviderConfig {
  id: string;
  name: string;
  type: "openai-compatible" | "ollama" | "puter" | "custom";
  endpoint: string;
  model: string;
  isLocal: boolean;
  priority: number;
  enabled: boolean;
  apiKeyEnvVar?: string;
}

export interface CapabilityProfile {
  providerId: string;
  probeTimestamp: number;
  avgLatencyMs: number;
  successRate: number;
  maxContextWindow: number;
  supportsStreaming: boolean;
  supportsJsonMode: boolean;
  hallucination: number;
  reasoning: number;
  coding: number;
  overallScore: number;
  lastProbedAt: Date;
  probeCount: number;
  errorLog: string[];
}

const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "replit-openai",
    name: "Replit OpenAI Proxy",
    type: "openai-compatible",
    endpoint: "https://openai.repl.it/v1",
    model: process.env.TESSERA_LLM_MODEL || "gpt-4o",
    isLocal: false,
    priority: 10,
    enabled: true,
    apiKeyEnvVar: "OPENAI_API_KEY",
  },
  {
    id: "local-ollama",
    name: "Local Ollama",
    type: "ollama",
    endpoint: process.env.OLLAMA_ENDPOINT || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "llama3",
    isLocal: true,
    priority: 1,
    enabled: !!process.env.OLLAMA_ENDPOINT,
    apiKeyEnvVar: undefined,
  },
  {
    id: "puter-gpt4o",
    name: "Puter.js GPT-4o Rotator",
    type: "puter",
    endpoint: "https://api.puter.com/drivers/call",
    model: "gpt-4o",
    isLocal: false,
    priority: 5,
    enabled: false,
    apiKeyEnvVar: undefined,
  },
];

const profiles: Map<string, CapabilityProfile> = new Map();
let registryInitialized = false;

export class ProviderRegistry {
  private configs: ProviderConfig[];

  constructor(configs: ProviderConfig[] = PROVIDER_CONFIGS) {
    this.configs = configs;
  }

  getAll(): ProviderConfig[] {
    return this.configs.filter(c => c.enabled);
  }

  getLocal(): ProviderConfig[] {
    return this.configs.filter(c => c.isLocal && c.enabled);
  }

  getExternal(): ProviderConfig[] {
    return this.configs.filter(c => !c.isLocal && c.enabled);
  }

  getPrimary(): ProviderConfig {
    const sorted = this.getAll().sort((a, b) => a.priority - b.priority);
    return sorted[0] || this.configs[0]!;
  }

  getById(id: string): ProviderConfig | undefined {
    return this.configs.find(c => c.id === id);
  }

  disable(id: string): { success: boolean; message: string } {
    const provider = this.configs.find(c => c.id === id);
    if (!provider) return { success: false, message: `Provider ${id} not found` };
    if (!provider.enabled) return { success: true, message: `Provider ${id} already disabled` };
    provider.enabled = false;
    console.log(`${LOG_PREFIX} Provider ${id} DISABLED`);
    return { success: true, message: `Provider ${id} disabled` };
  }

  enable(id: string): { success: boolean; message: string } {
    const provider = this.configs.find(c => c.id === id);
    if (!provider) return { success: false, message: `Provider ${id} not found` };
    if (provider.enabled) return { success: true, message: `Provider ${id} already enabled` };
    provider.enabled = true;
    console.log(`${LOG_PREFIX} Provider ${id} ENABLED`);
    return { success: true, message: `Provider ${id} enabled` };
  }

  getProfile(providerId: string): CapabilityProfile | undefined {
    return profiles.get(providerId);
  }

  getAllProfiles(): CapabilityProfile[] {
    return Array.from(profiles.values());
  }

  getBestProvider(task: "reasoning" | "coding" | "general"): ProviderConfig {
    const enabled = this.getAll();
    if (enabled.length === 0) return PROVIDER_CONFIGS[0]!;

    const scored = enabled.map(p => {
      const profile = profiles.get(p.id);
      if (!profile) return { config: p, score: 50 + (10 - p.priority) };
      let score = profile.overallScore;
      if (task === "reasoning") score = profile.reasoning * 0.6 + profile.overallScore * 0.4;
      if (task === "coding") score = profile.coding * 0.6 + profile.overallScore * 0.4;
      score *= profile.successRate;
      score -= profile.avgLatencyMs / 1000;
      return { config: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]!.config;
  }

  async saveProfileToDB(profile: CapabilityProfile): Promise<void> {
    try {
      await db.insert(internal_models).values({
        modelId: `provider-${profile.providerId}`,
        modelName: profile.providerId,
        modelType: "provider-profile",
        status: profile.successRate > 0.7 ? "active" : "degraded",
        parameters: {
          avgLatencyMs: profile.avgLatencyMs,
          maxContextWindow: profile.maxContextWindow,
        } as Record<string, unknown>,
        capabilities: [
          profile.supportsStreaming ? "streaming" : null,
          profile.supportsJsonMode ? "json_mode" : null,
        ].filter(Boolean) as string[],
        benchmarkScores: {
          reasoning: profile.reasoning,
          coding: profile.coding,
          hallucination: profile.hallucination,
          overall: profile.overallScore,
          successRate: profile.successRate,
        } as Record<string, unknown>,
        sovereigntyContribution: profile.overallScore / 100,
      }).onConflictDoUpdate({
        target: internal_models.modelId,
        set: {
          status: profile.successRate > 0.7 ? "active" : "degraded",
          benchmarkScores: {
            reasoning: profile.reasoning,
            coding: profile.coding,
            hallucination: profile.hallucination,
            overall: profile.overallScore,
            successRate: profile.successRate,
          } as Record<string, unknown>,
          sovereigntyContribution: profile.overallScore / 100,
          updatedAt: new Date(),
        },
      });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Failed to save profile to DB:`, err?.message);
    }
  }
}

export const providerRegistry = new ProviderRegistry();

export class ProviderReverseEngineer {
  private registry: ProviderRegistry;

  constructor(registry: ProviderRegistry) {
    this.registry = registry;
  }

  private async probeProvider(config: ProviderConfig): Promise<CapabilityProfile> {
    const existing = profiles.get(config.id);
    const probeCount = (existing?.probeCount ?? 0) + 1;
    const errorLog: string[] = existing?.errorLog ?? [];

    const probePrompts = [
      { prompt: "What is 2+2?", expected: "4", category: "reasoning" },
      { prompt: "Write a one-line JavaScript function that adds two numbers.", expected: "function", category: "coding" },
      { prompt: "What color is the sky on a clear day?", expected: "blue", category: "factual" },
    ];

    let successCount = 0;
    let totalLatency = 0;
    let reasoningScore = 0;
    let codingScore = 0;
    let hallucinationPenalty = 0;

    for (const probe of probePrompts) {
      const start = Date.now();
      try {
        const result = await this.callProvider(config, probe.prompt);
        const latency = Date.now() - start;
        totalLatency += latency;
        const response = result.toLowerCase();

        if (result.length > 0) {
          successCount++;
          if (probe.category === "reasoning" && response.includes(probe.expected)) reasoningScore += 100;
          else if (probe.category === "reasoning") { reasoningScore += 40; hallucinationPenalty += 10; }
          if (probe.category === "coding" && response.includes(probe.expected)) codingScore += 100;
          else if (probe.category === "coding") codingScore += 30;
          if (probe.category === "factual" && !response.includes(probe.expected)) hallucinationPenalty += 20;
        }
      } catch (err: any) {
        const latency = Date.now() - start;
        totalLatency += latency;
        errorLog.push(`[${new Date().toISOString()}] ${probe.category}: ${err?.message?.slice(0, 100)}`);
        if (errorLog.length > 20) errorLog.shift();
      }
    }

    const avgLatencyMs = probePrompts.length > 0 ? Math.round(totalLatency / probePrompts.length) : 9999;
    const successRate = successCount / probePrompts.length;
    const reasoning = Math.max(0, Math.min(100, reasoningScore / Math.max(1, probePrompts.filter(p => p.category === "reasoning").length)));
    const coding = Math.max(0, Math.min(100, codingScore / Math.max(1, probePrompts.filter(p => p.category === "coding").length)));
    const hallucination = Math.max(0, Math.min(100, hallucinationPenalty));
    const overallScore = Math.round(
      successRate * 40 +
      (reasoning / 100) * 25 +
      (coding / 100) * 20 +
      Math.max(0, 100 - hallucination - avgLatencyMs / 200) / 100 * 15
    );

    const profile: CapabilityProfile = {
      providerId: config.id,
      probeTimestamp: Date.now(),
      avgLatencyMs,
      successRate,
      maxContextWindow: config.type === "ollama" ? 8192 : 128000,
      supportsStreaming: true,
      supportsJsonMode: config.type !== "puter",
      hallucination,
      reasoning,
      coding,
      overallScore,
      lastProbedAt: new Date(),
      probeCount,
      errorLog,
    };

    profiles.set(config.id, profile);
    await this.registry.saveProfileToDB(profile);
    console.log(`${LOG_PREFIX} Probed ${config.name}: score=${overallScore}, latency=${avgLatencyMs}ms, success=${(successRate * 100).toFixed(0)}%`);
    return profile;
  }

  private async callProvider(config: ProviderConfig, prompt: string): Promise<string> {
    const start = Date.now();
    const requestPayload = { model: config.model, prompt: prompt.slice(0, 1000), providerId: config.id };

    if (config.type === "ollama") {
      const sandboxResult = await runInSandbox<{ response: string }>({
        providerId: config.id,
        providerType: "llm",
        taskType: "general",
        payload: requestPayload,
        fn: async (sanitized) => {
          const s = sanitized as Record<string, unknown>;
          const safeModel = typeof s.model === "string" ? s.model : config.model;
          const safePrompt = typeof s.prompt === "string" ? s.prompt : prompt.slice(0, 1000);
          const response = await fetch(`${config.endpoint}/api/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: safeModel, prompt: safePrompt, stream: false }),
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
          return response.json() as Promise<{ response: string }>;
        },
      });
      logExternalCall({
        providerId: config.id,
        providerType: "llm",
        endpoint: `${config.endpoint}/api/generate`,
        requestPayload,
        responsePayload: sandboxResult.data ? { response: sandboxResult.data.response?.slice(0, 500) } : {},
        responseText: sandboxResult.data?.response,
        latencyMs: Date.now() - start,
        success: sandboxResult.success,
        errorMessage: sandboxResult.error,
        taskType: "general",
        metadata: { source: "provider-registry", callId: sandboxResult.callId, providerType: config.type },
      });
      if (!sandboxResult.success || !sandboxResult.data) throw new Error(sandboxResult.error ?? "ollama sandbox failed");
      return sandboxResult.data.response || "";
    }

    const apiKey = config.apiKeyEnvVar ? process.env[config.apiKeyEnvVar] : undefined;
    if (!apiKey && config.type === "openai-compatible") {
      throw new Error("No API key available for probe");
    }

    type OpenAIResponse = { choices: Array<{ message: { content: string } }> };
    const sandboxResult = await runInSandbox<OpenAIResponse>({
      providerId: config.id,
      providerType: "llm",
      taskType: "general",
      payload: requestPayload,
      fn: async (sanitized) => {
        const s = sanitized as Record<string, unknown>;
        const safeModel = typeof s.model === "string" ? s.model : config.model;
        const safePrompt = typeof s.prompt === "string" ? s.prompt : prompt.slice(0, 1000);
        const response = await fetch(`${config.endpoint}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: safeModel,
            messages: [{ role: "user", content: safePrompt }],
            max_tokens: 100,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<OpenAIResponse>;
      },
    });
    logExternalCall({
      providerId: config.id,
      providerType: "llm",
      endpoint: `${config.endpoint}/chat/completions`,
      requestPayload,
      responsePayload: sandboxResult.data ? { choices: sandboxResult.data.choices } : {},
      responseText: sandboxResult.data?.choices?.[0]?.message?.content,
      latencyMs: Date.now() - start,
      success: sandboxResult.success,
      errorMessage: sandboxResult.error,
      taskType: "general",
      metadata: { source: "provider-registry", callId: sandboxResult.callId, providerType: config.type },
    });
    if (!sandboxResult.success || !sandboxResult.data) throw new Error(sandboxResult.error ?? "sandbox failed");
    return sandboxResult.data.choices?.[0]?.message?.content || "";
  }

  async probeAll(): Promise<CapabilityProfile[]> {
    const results: CapabilityProfile[] = [];
    const providers = this.registry.getAll();
    for (const config of providers) {
      try {
        const profile = await this.probeProvider(config);
        results.push(profile);
      } catch (err: any) {
        console.error(`${LOG_PREFIX} Probe failed for ${config.id}:`, err?.message);
      }
    }
    return results;
  }

  async probeOne(providerId: string): Promise<CapabilityProfile | null> {
    const config = this.registry.getById(providerId);
    if (!config) return null;
    return this.probeProvider(config);
  }
}

export const providerReverseEngineer = new ProviderReverseEngineer(providerRegistry);

export async function initializeProviderRegistry(): Promise<void> {
  if (registryInitialized) return;
  registryInitialized = true;
  console.log(`${LOG_PREFIX} Initializing provider registry — ${providerRegistry.getAll().length} providers`);
  providerReverseEngineer.probeAll().catch(err =>
    console.error(`${LOG_PREFIX} Background probe failed:`, err?.message)
  );
}

export function getProviderRegistryStatus() {
  return {
    providers: providerRegistry.getAll().map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      isLocal: p.isLocal,
      priority: p.priority,
      enabled: p.enabled,
      profile: providerRegistry.getProfile(p.id) ?? null,
    })),
    totalProviders: providerRegistry.getAll().length,
    localProviders: providerRegistry.getLocal().length,
    externalProviders: providerRegistry.getExternal().length,
    profilesAvailable: profiles.size,
    initialized: registryInitialized,
  };
}
