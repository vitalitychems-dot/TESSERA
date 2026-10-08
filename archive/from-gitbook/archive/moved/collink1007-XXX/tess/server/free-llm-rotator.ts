export interface FreeLLMProvider {
  id: string;
  name: string;
  model: string;
  apiBase: string;
  rateLimitPerMin: number;
  rateLimitPerDay: number;
  contextWindow: number;
  category: "chat" | "code" | "analysis" | "creative" | "research";
  callsToday: number;
  callsThisMinute: number;
  lastUsed: number;
  errorCount: number;
  successCount: number;
  avgLatencyMs: number;
  available: boolean;
  source: "openrouter" | "huggingface" | "github" | "groq" | "together" | "local";
  repoUrl?: string;
}

export interface RotatorStats {
  totalProviders: number;
  availableProviders: number;
  totalCallsToday: number;
  totalSuccesses: number;
  totalErrors: number;
  successRate: number;
  avgLatency: number;
  currentPrimary: string;
  rotationsToday: number;
}

const FREE_LLM_PROVIDERS: FreeLLMProvider[] = [
  { id: "or-llama-405b", name: "Meta LLaMA 405B", model: "meta-llama/llama-3.1-405b-instruct:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 131072, category: "chat", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-llama-70b", name: "Meta LLaMA 70B", model: "meta-llama/llama-3.1-70b-instruct:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 131072, category: "chat", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-llama-8b", name: "Meta LLaMA 8B", model: "meta-llama/llama-3.1-8b-instruct:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 131072, category: "chat", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-llama33-free", name: "LLaMA 3.3 70B Free", model: "meta-llama/llama-3.3-70b-instruct:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 131072, category: "chat", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-deepseek-r1", name: "DeepSeek R1 Free", model: "deepseek/deepseek-r1:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 10, rateLimitPerDay: 100, contextWindow: 65536, category: "research", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-deepseek-r1-distill", name: "DeepSeek R1 Distill Llama 70B", model: "deepseek/deepseek-r1-distill-llama-70b:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 15, rateLimitPerDay: 150, contextWindow: 131072, category: "research", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-qwen-72b", name: "Qwen 2.5 72B", model: "qwen/qwen-2.5-72b-instruct:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 15, rateLimitPerDay: 150, contextWindow: 131072, category: "chat", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-qwen-coder", name: "Qwen 2.5 Coder 32B", model: "qwen/qwen-2.5-coder-32b-instruct:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 15, rateLimitPerDay: 150, contextWindow: 65536, category: "code", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-mistral-small", name: "Mistral Small 3.1", model: "mistralai/mistral-small-3.1-24b-instruct:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 131072, category: "chat", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-phi4", name: "Microsoft Phi-4", model: "microsoft/phi-4:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 16384, category: "code", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-gemma2-27b", name: "Google Gemma 2 27B", model: "google/gemma-2-27b-it:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 8192, category: "analysis", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-gemma3-27b", name: "Google Gemma 3 27B", model: "google/gemma-3-27b-it:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 131072, category: "analysis", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-nous-hermes", name: "Nous Hermes 3 405B", model: "nousresearch/hermes-3-llama-3.1-405b:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 10, rateLimitPerDay: 100, contextWindow: 131072, category: "research", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-optimus-alpha", name: "Optimus Alpha", model: "openrouter/optimus-alpha:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 15, rateLimitPerDay: 150, contextWindow: 1048576, category: "chat", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-sonar", name: "Perplexity Sonar", model: "perplexity/sonar:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 10, rateLimitPerDay: 100, contextWindow: 131072, category: "research", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-moonlight-coder", name: "Moonlight Coder 8B", model: "moonshotai/moonlight-16b-a3b-instruct:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 32768, category: "code", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-featherless-qwen", name: "Featherless Qwen 32B", model: "featherless/qwen2.5-32b:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 15, rateLimitPerDay: 150, contextWindow: 32768, category: "chat", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-mythomax", name: "MythoMax L2 13B", model: "gryphe/mythomax-l2-13b:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 4096, category: "creative", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-toppy-m", name: "Toppy M 7B", model: "undi95/toppy-m-7b:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 4096, category: "creative", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-cinematika", name: "Cinematika 7B", model: "openrouter/cinematika-7b:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 8192, category: "creative", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-zephyr-7b", name: "Zephyr 7B Beta", model: "huggingfaceh4/zephyr-7b-beta:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 4096, category: "chat", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-bagel-34b", name: "Bagel 34B v0.2", model: "jondurbin/bagel-34b:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 10, rateLimitPerDay: 100, contextWindow: 4096, category: "chat", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-rwkv-5-3b", name: "RWKV v5 3B", model: "rwkv/rwkv-5-world-3b:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 10000, category: "code", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-hermes-llama", name: "OpenHermes 2 Mistral 7B", model: "teknium/openhermes-2-mistral-7b:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 20, rateLimitPerDay: 200, contextWindow: 4096, category: "chat", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
  { id: "or-palm-2", name: "Google PaLM 2 Chat", model: "google/palm-2-chat-bison-experimental:free", apiBase: "https://openrouter.ai/api/v1", rateLimitPerMin: 15, rateLimitPerDay: 150, contextWindow: 9000, category: "chat", callsToday: 0, callsThisMinute: 0, lastUsed: 0, errorCount: 0, successCount: 0, avgLatencyMs: 0, available: true, source: "openrouter" },
];

let rotationsToday = 0;
let currentPrimaryIndex = 0;

export function getAvailableProviders(): FreeLLMProvider[] {
  return FREE_LLM_PROVIDERS.filter(p => p.available && p.callsToday < p.rateLimitPerDay);
}

export function getNextProvider(category?: FreeLLMProvider["category"]): FreeLLMProvider | null {
  let candidates = getAvailableProviders();
  if (category) candidates = candidates.filter(p => p.category === category);
  if (candidates.length === 0) candidates = getAvailableProviders();
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const aScore = (a.successCount / Math.max(1, a.successCount + a.errorCount)) * 100 - a.callsToday;
    const bScore = (b.successCount / Math.max(1, b.successCount + b.errorCount)) * 100 - b.callsToday;
    return bScore - aScore;
  });
  const provider = candidates[0];
  provider.callsToday++;
  provider.callsThisMinute++;
  provider.lastUsed = Date.now();
  rotationsToday++;
  return provider;
}

export function recordProviderResult(providerId: string, success: boolean, latencyMs: number): void {
  const p = FREE_LLM_PROVIDERS.find(p => p.id === providerId);
  if (!p) return;
  if (success) {
    p.successCount++;
    p.avgLatencyMs = p.successCount === 1 ? latencyMs : Math.round((p.avgLatencyMs * (p.successCount - 1) + latencyMs) / p.successCount);
  } else {
    p.errorCount++;
    if (p.errorCount > 5 && p.successCount === 0) p.available = false;
  }
}

export function getAllProviders(): FreeLLMProvider[] {
  return FREE_LLM_PROVIDERS;
}

export function getRotatorStats(): RotatorStats {
  const available = getAvailableProviders();
  const total = FREE_LLM_PROVIDERS.reduce((s, p) => s + p.callsToday, 0);
  const successes = FREE_LLM_PROVIDERS.reduce((s, p) => s + p.successCount, 0);
  const errors = FREE_LLM_PROVIDERS.reduce((s, p) => s + p.errorCount, 0);
  const avgLatency = FREE_LLM_PROVIDERS.filter(p => p.avgLatencyMs > 0).reduce((s, p) => s + p.avgLatencyMs, 0) / Math.max(1, FREE_LLM_PROVIDERS.filter(p => p.avgLatencyMs > 0).length);
  const primary = getAvailableProviders()[0];
  return {
    totalProviders: FREE_LLM_PROVIDERS.length,
    availableProviders: available.length,
    totalCallsToday: total,
    totalSuccesses: successes,
    totalErrors: errors,
    successRate: total > 0 ? Math.round((successes / (successes + errors)) * 100) : 100,
    avgLatency: Math.round(avgLatency),
    currentPrimary: primary?.name || "none",
    rotationsToday,
  };
}

setInterval(() => {
  FREE_LLM_PROVIDERS.forEach(p => {
    p.callsThisMinute = 0;
    if (!p.available && p.errorCount > 0) {
      p.errorCount = Math.max(0, p.errorCount - 1);
      if (p.errorCount < 5) p.available = true;
    }
  });
}, 60 * 1000);

setInterval(() => {
  FREE_LLM_PROVIDERS.forEach(p => { p.callsToday = 0; });
  rotationsToday = 0;
}, 24 * 60 * 60 * 1000);

console.log(`[FreeLLMRotator] ${FREE_LLM_PROVIDERS.length} free LLM providers loaded — rotating at rate limits, auto-recovery active`);
