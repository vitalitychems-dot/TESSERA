import axios from "axios";
import { logger } from "./logger";
import { PROVIDER_REGISTRY, type ProviderSpec } from "./provider-registry";
import { broadcast } from "./ws-broadcast";
import { getKeyByEnvName } from "./sovereign-key-vault";

const glog = (msg: string) => logger.info("SovInferenceGW", msg);
const gwarn = (msg: string) => logger.warn("SovInferenceGW", msg);

export interface GatewayRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  task?: string;
  preferSelfHosted?: boolean;
  stream?: boolean;
}

export interface GatewayResponse {
  content: string;
  provider: string;
  model: string;
  tier: 0 | 1 | 2;
  latencyMs: number;
  selfHosted: boolean;
  tokensUsed?: number;
}

export interface GatewayStats {
  totalRequests: number;
  selfHostedRequests: number;
  externalRequests: number;
  sovereigntyScore: number;
  providerBreakdown: Record<string, number>;
  avgLatencyMs: number;
  failoverCount: number;
  ollamaAvailable: boolean;
  ollamaEndpoint: string;
}

const OLLAMA_ENDPOINTS = [
  process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  "http://localhost:11434",
  "http://127.0.0.1:11434",
];

const OLLAMA_MODELS = [
  { model: "llama3.3:latest", tasks: ["general", "conversation", "code_generation"] },
  { model: "qwen2.5:latest", tasks: ["code_generation", "algorithm", "math_computation"] },
  { model: "deepseek-r1:latest", tasks: ["math_proof", "logical_reasoning", "algorithm"] },
  { model: "mistral:latest", tasks: ["general", "code_generation", "json_schema"] },
  { model: "llama3.2:latest", tasks: ["general", "conversation"] },
  { model: "gemma2:latest", tasks: ["general", "factual_lookup"] },
  { model: "phi3:latest", tasks: ["code_generation", "logical_reasoning"] },
  { model: "codellama:latest", tasks: ["code_generation", "code_review", "debugging"] },
];

const gatewayStats: GatewayStats = {
  totalRequests: 0,
  selfHostedRequests: 0,
  externalRequests: 0,
  sovereigntyScore: 0,
  providerBreakdown: {},
  avgLatencyMs: 0,
  failoverCount: 0,
  ollamaAvailable: false,
  ollamaEndpoint: "",
};

let totalLatencyMs = 0;
let ollamaHealthy = false;
let ollamaEndpoint = "";
let ollamaAvailableModels: string[] = [];
let lastOllamaHealthCheck = 0;
const OLLAMA_HEALTH_INTERVAL_MS = 30_000;

const providerCooldowns: Map<string, number> = new Map();
const COOLDOWN_MS = 60_000;

function isOnCooldown(providerId: string): boolean {
  const until = providerCooldowns.get(providerId);
  return !!until && Date.now() < until;
}

function setCooldown(providerId: string) {
  providerCooldowns.set(providerId, Date.now() + COOLDOWN_MS);
}

async function checkOllamaHealth(): Promise<void> {
  if (Date.now() - lastOllamaHealthCheck < OLLAMA_HEALTH_INTERVAL_MS) return;
  lastOllamaHealthCheck = Date.now();

  for (const endpoint of OLLAMA_ENDPOINTS) {
    try {
      const resp = await axios.get(`${endpoint}/api/tags`, { timeout: 3000 });
      if (resp.status === 200) {
        ollamaHealthy = true;
        ollamaEndpoint = endpoint;
        ollamaAvailableModels = (resp.data?.models || []).map((m: any) => m.name || m.model || "");
        gatewayStats.ollamaAvailable = true;
        gatewayStats.ollamaEndpoint = endpoint;
        if (ollamaAvailableModels.length > 0) {
          glog(`Ollama available at ${endpoint} — models: ${ollamaAvailableModels.slice(0, 5).join(", ")}`);
        }
        return;
      }
    } catch {}
  }
  ollamaHealthy = false;
  ollamaEndpoint = "";
  ollamaAvailableModels = [];
  gatewayStats.ollamaAvailable = false;
  gatewayStats.ollamaEndpoint = "";
}

async function callOllama(
  endpoint: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 4096,
  temperature = 0.7
): Promise<string | null> {
  try {
    const resp = await axios.post(
      `${endpoint}/api/chat`,
      {
        model,
        messages,
        stream: false,
        options: { num_predict: maxTokens, temperature },
      },
      { timeout: 60_000, headers: { "Content-Type": "application/json" } }
    );
    return resp.data?.message?.content || resp.data?.response || null;
  } catch (err: any) {
    return null;
  }
}

function buildKeyFromEnvOrVault(envVar: string): string | null {
  return getKeyByEnvName(envVar) || process.env[envVar]?.trim() || null;
}

async function callExternalProvider(
  provider: ProviderSpec,
  messages: Array<{ role: string; content: string }>,
  maxTokens = 4096,
  temperature = 0.7
): Promise<string | null> {
  if (provider.apiFormat === "puter") return null;

  const key = provider.keyEnvVar ? buildKeyFromEnvOrVault(provider.keyEnvVar) : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;

  try {
    const resp = await axios.post(
      `${provider.baseUrl}/chat/completions`,
      {
        model: provider.model,
        messages,
        max_tokens: Math.min(maxTokens, provider.maxTokens),
        temperature,
      },
      { headers, timeout: 30_000 }
    );
    return resp.data?.choices?.[0]?.message?.content || null;
  } catch (err: any) {
    if (err.response?.status === 429 || err.response?.status === 503) {
      setCooldown(provider.id);
    }
    return null;
  }
}

function pickOllamaModel(task?: string): string | null {
  if (ollamaAvailableModels.length === 0) return null;

  if (task) {
    for (const m of OLLAMA_MODELS) {
      if (m.tasks.includes(task) && ollamaAvailableModels.some(a => a.startsWith(m.model.split(":")[0]))) {
        const found = ollamaAvailableModels.find(a => a.startsWith(m.model.split(":")[0]));
        if (found) return found;
      }
    }
  }

  return ollamaAvailableModels[0] || null;
}

function getTieredProviders(): { tier0: ProviderSpec[]; tier1: ProviderSpec[]; tier2: ProviderSpec[] } {
  const all = PROVIDER_REGISTRY.filter(p => p.apiFormat !== "puter");

  const tier1 = all.filter(p =>
    p.keyEnvVar && buildKeyFromEnvOrVault(p.keyEnvVar) && !isOnCooldown(p.id)
  );

  const tier2 = all.filter(p =>
    (!p.keyEnvVar || !buildKeyFromEnvOrVault(p.keyEnvVar!)) &&
    !isOnCooldown(p.id)
  );

  return { tier0: [], tier1, tier2 };
}

function updateStats(selfHosted: boolean, providerId: string, latencyMs: number) {
  gatewayStats.totalRequests++;
  if (selfHosted) gatewayStats.selfHostedRequests++;
  else gatewayStats.externalRequests++;

  gatewayStats.providerBreakdown[providerId] = (gatewayStats.providerBreakdown[providerId] || 0) + 1;
  totalLatencyMs += latencyMs;
  gatewayStats.avgLatencyMs = Math.round(totalLatencyMs / gatewayStats.totalRequests);

  const total = gatewayStats.totalRequests;
  gatewayStats.sovereigntyScore = total === 0
    ? 0
    : Math.round((gatewayStats.selfHostedRequests / total) * 100);

  broadcast("sovereignty", "gateway_update", {
    sovereigntyScore: gatewayStats.sovereigntyScore,
    ollamaAvailable: ollamaHealthy,
    totalRequests: gatewayStats.totalRequests,
    latencyMs,
    provider: providerId,
    selfHosted,
  });
}

export async function sovereignInfer(req: GatewayRequest): Promise<GatewayResponse> {
  const start = Date.now();

  await checkOllamaHealth();

  if (ollamaHealthy && (req.preferSelfHosted !== false)) {
    const ollamaModel = pickOllamaModel(req.task);
    if (ollamaModel) {
      const result = await callOllama(
        ollamaEndpoint,
        ollamaModel,
        req.messages,
        req.maxTokens,
        req.temperature
      );
      if (result) {
        const latencyMs = Date.now() - start;
        updateStats(true, `ollama:${ollamaModel}`, latencyMs);
        return {
          content: result,
          provider: "ollama",
          model: ollamaModel,
          tier: 0,
          latencyMs,
          selfHosted: true,
        };
      }
    }
  }

  gatewayStats.failoverCount++;

  const { tier1, tier2 } = getTieredProviders();

  const providers = [
    ...tier1.sort((a, b) => (a.costTier - b.costTier) || (a.speed === "ultra-fast" ? -1 : 0)),
    ...tier2.sort((a, b) => (a.costTier - b.costTier)),
  ];

  for (const provider of providers) {
    const result = await callExternalProvider(
      provider,
      req.messages,
      req.maxTokens,
      req.temperature
    );
    if (result) {
      const latencyMs = Date.now() - start;
      const tier = provider.keyEnvVar && buildKeyFromEnvOrVault(provider.keyEnvVar) ? 1 : 2;
      updateStats(false, provider.id, latencyMs);
      return {
        content: result,
        provider: provider.id,
        model: provider.model,
        tier: tier as 1 | 2,
        latencyMs,
        selfHosted: false,
      };
    }
  }

  const latencyMs = Date.now() - start;
  gwarn("All providers failed — no response available");
  return {
    content: "Sovereign inference gateway: all providers temporarily unavailable. Self-hosted Ollama models are preferred when available.",
    provider: "none",
    model: "none",
    tier: 2,
    latencyMs,
    selfHosted: false,
  };
}

export function getGatewayStats(): GatewayStats {
  return { ...gatewayStats };
}

export async function getGatewayStatus(): Promise<{
  operational: boolean;
  ollamaAvailable: boolean;
  ollamaModels: string[];
  ollamaEndpoint: string;
  externalProvidersAvailable: number;
  sovereigntyScore: number;
  tier0Available: boolean;
  tier1Count: number;
  tier2Count: number;
}> {
  await checkOllamaHealth();
  const { tier1, tier2 } = getTieredProviders();
  return {
    operational: ollamaHealthy || tier1.length > 0 || tier2.length > 0,
    ollamaAvailable: ollamaHealthy,
    ollamaModels: ollamaAvailableModels,
    ollamaEndpoint,
    externalProvidersAvailable: tier1.length + tier2.length,
    sovereigntyScore: gatewayStats.sovereigntyScore,
    tier0Available: ollamaHealthy,
    tier1Count: tier1.length,
    tier2Count: tier2.length,
  };
}

setTimeout(() => checkOllamaHealth(), 2000);
setInterval(() => checkOllamaHealth(), OLLAMA_HEALTH_INTERVAL_MS);

glog("Sovereign Inference Gateway initialized — Tier 0 (Ollama) > Tier 1 (own keys) > Tier 2 (free/proxy)");
