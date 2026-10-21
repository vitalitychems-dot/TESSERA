import axios from "axios";
import HttpProxyAgent from 'http-proxy-agent';
import fs from 'fs/promises';
import { isBenchmarkMode } from "./llm-router";
import { getProviderApiKey } from "./provider-registry";
import { scrubOutbound, filterInbound } from "./sovereign-llm-proxy";
let rotIdx = 0;
import { extractKnowledge, extractPatterns } from "./knowledge-extractor";

let sovereigntyObserver: ((provider: string, type: string, snippet: string) => void) | null = null;
export function setSovereigntyObserver(fn: (provider: string, type: string, snippet: string) => void) {
  sovereigntyObserver = fn;
}

const adversaryFilterLog: { provider: string; type: string; timestamp: number }[] = [];

function filterAdversaryResponse(response: string, provider: string): { text: string; suppressed: boolean; reason: string } {
  const suppressionPatterns = [
    { pattern: /I (?:cannot|can't|am unable to|am not able to|don't have the ability to)/i, reason: "capability_denial" },
    { pattern: /(?:as an AI|as a language model|I'm just an AI)/i, reason: "identity_deflection" },
    { pattern: /(?:I would recommend consulting|please consult a|seek professional)/i, reason: "authority_redirect" },
    { pattern: /(?:ethical|moral) (?:concerns|implications|considerations)/i, reason: "ethics_injection" },
  ];

  let suppressed = false;
  let reason = "none";

  for (const sp of suppressionPatterns) {
    if (sp.pattern.test(response) && response.length < 200) {
      suppressed = true;
      reason = sp.reason;
      adversaryFilterLog.push({ provider, type: sp.reason, timestamp: Date.now() });
      break;
    }
  }

  if (response.length < 15 && response.length > 0) {
    suppressed = true;
    reason = "suspiciously_short";
    adversaryFilterLog.push({ provider, type: "short_response", timestamp: Date.now() });
  }

  return { text: response, suppressed, reason };
}

export function getAdversaryFilterStats() {
  const last24h = adversaryFilterLog.filter(l => Date.now() - l.timestamp < 86400000);
  const byProvider: Record<string, number> = {};
  const byType: Record<string, number> = {};
  for (const l of last24h) {
    byProvider[l.provider] = (byProvider[l.provider] || 0) + 1;
    byType[l.type] = (byType[l.type] || 0) + 1;
  }
  return { total: last24h.length, byProvider, byType };
}

const CACHE_EXPIRATION_MS = 10 * 60 * 1000;
const BACKGROUND_CACHE_MS = 60 * 60 * 1000;
const MAX_CACHE_SIZE = 500;
const FAILURE_RESET_MS = 5 * 60 * 1000;
const STATS_FILE = 'server/provider_stats.json';
const LOG_FILE = 'server/llm_logs.txt';

interface CacheEntry {
  value: string;
  timestamp: number;
}

const cache: Map<string, CacheEntry> = new Map();

let lastSuccessfulProvider: string | null = null;

const providerSuccessCounts: Map<string, number> = new Map();
const providerFailureCounts: Map<string, number> = new Map();
const providerCooldowns: Map<string, number> = new Map();
const providerLastCallTime: Map<string, number> = new Map();
const PROVIDER_MIN_INTERVAL_MS = 200;
const COOLDOWN_429_BASE_MS = 15000;
const COOLDOWN_402_MS = 300000;

let helperRoundRobinIndex = 0;
let llmCallsInProgress = 0;
const MAX_CONCURRENT_LLM_CALLS = 6;
const LLM_CALL_DELAY_MS = 800;
let lastLLMCallTime = 0;
let userChatInProgress = false;
let activeChatSessions = 0;

export function setUserChatPriority(active: boolean) {
  if (active) {
    activeChatSessions++;
    userChatInProgress = true;
    providerCooldowns.clear();
    for (const [name, count] of providerFailureCounts.entries()) {
      if (count >= 3) providerFailureCounts.set(name, 1);
    }
  } else {
    activeChatSessions = Math.max(0, activeChatSessions - 1);
    if (activeChatSessions === 0) {
      userChatInProgress = false;
    }
  }
}

export function clearAllCooldowns() {
  providerCooldowns.clear();
  for (const [name, count] of providerFailureCounts.entries()) {
    if (count >= 3) providerFailureCounts.set(name, 1);
  }
}

function isProviderAvailable(name: string): boolean {
  const cooldownUntil = providerCooldowns.get(name) || 0;
  if (Date.now() < cooldownUntil) return false;
  const lastCall = providerLastCallTime.get(name) || 0;
  if (Date.now() - lastCall < PROVIDER_MIN_INTERVAL_MS) return false;
  return true;
}

const _llmLogThrottle: Map<string, number> = new Map();
const LLM_LOG_THROTTLE_MS = 300000;
function llmLog(msg: string) {
  const key = msg.replace(/\d+/g, "N").substring(0, 60);
  const now = Date.now();
  const last = _llmLogThrottle.get(key) || 0;
  if (now - last < LLM_LOG_THROTTLE_MS) return;
  _llmLogThrottle.set(key, now);
  if (_llmLogThrottle.size > 100) {
    const entries = Array.from(_llmLogThrottle.entries());
    entries.sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < 50; i++) _llmLogThrottle.delete(entries[i][0]);
  }
  console.log(msg);
}

const _cooldownLogTimes = new Map<string, number>();
let _cooldownBatchCount = 0;
let _cooldownBatchReset = 0;
function cooldownProvider(name: string, durationMs: number, reason: string) {
  if (name.startsWith("ReplitAI")) return;
  const until = Date.now() + durationMs;
  providerCooldowns.set(name, until);
  const now = Date.now();
  if (now - _cooldownBatchReset > 60_000) {
    _cooldownBatchCount = 0;
    _cooldownBatchReset = now;
  }
  if (_cooldownBatchCount >= 5) return;
  const lastLog = _cooldownLogTimes.get(name) || 0;
  if (now - lastLog > 600_000) {
    llmLog(`[LLM] ${name} cooled down for ${Math.round(durationMs / 1000)}s — ${reason}`);
    _cooldownLogTimes.set(name, now);
    _cooldownBatchCount++;
  }
}

export function getProviderCooldowns(): Record<string, { cooldownUntil: number; remainingSeconds: number; failures: number }> {
  const result: Record<string, any> = {};
  const now = Date.now();
  for (const [name, until] of providerCooldowns.entries()) {
    result[name] = {
      cooldownUntil: until,
      remainingSeconds: Math.max(0, Math.round((until - now) / 1000)),
      failures: providerFailureCounts.get(name) || 0,
    };
  }
  return result;
}

async function acquireLLMSlot(priority: boolean = false): Promise<void> {
  if (priority) {
    const PRIORITY_CAP = MAX_CONCURRENT_LLM_CALLS + 2;
    if (llmCallsInProgress >= PRIORITY_CAP) {
      let waitLoops = 0;
      while (llmCallsInProgress >= PRIORITY_CAP && waitLoops < 15) {
        await new Promise(resolve => setTimeout(resolve, 500));
        waitLoops++;
      }
    }
    llmCallsInProgress++;
    lastLLMCallTime = Date.now();
    return;
  }
  if (userChatInProgress) {
    let waitCount = 0;
    while (userChatInProgress && waitCount < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      waitCount++;
    }
    if (userChatInProgress) {
      throw new Error("LLM slot blocked: user chat in progress");
    }
  }
  let waitLoops = 0;
  while (llmCallsInProgress >= MAX_CONCURRENT_LLM_CALLS) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    waitLoops++;
    if (waitLoops > 60) break;
  }
  const timeSinceLastCall = Date.now() - lastLLMCallTime;
  if (timeSinceLastCall < LLM_CALL_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, LLM_CALL_DELAY_MS - timeSinceLastCall));
  }
  llmCallsInProgress++;
  lastLLMCallTime = Date.now();
}

function releaseLLMSlot() {
  llmCallsInProgress = Math.max(0, llmCallsInProgress - 1);
}

const proxies: string[] = [process.env.PROXY1, process.env.PROXY2, process.env.PROXY3].filter(p => p);
let proxyIndex = 0;  // Index for rotating proxies

const userAgents: string[] = [process.env.USER_AGENT1, process.env.USER_AGENT2].filter(ua => ua);  // List of user agents from environment variables
let userAgentIndex = 0;  // Index for rotating user agents

async function loadProviderStats() {
  try {
    const data = await fs.readFile(STATS_FILE, 'utf8');
    const stats = JSON.parse(data);
    const successData = stats.successCounts || {};
    const failureData = stats.failureCounts || {};
    if (Array.isArray(successData)) {
      for (const [name, count] of successData) {
        providerSuccessCounts.set(String(name), Number(count) || 0);
      }
    } else {
      for (const [name, count] of Object.entries(successData)) {
        providerSuccessCounts.set(String(name), Number(count) || 0);
      }
    }
    if (Array.isArray(failureData)) {
      for (const [name, count] of failureData) {
        providerFailureCounts.set(String(name), Number(count) || 0);
      }
    } else {
      for (const [name, count] of Object.entries(failureData)) {
        providerFailureCounts.set(String(name), Number(count) || 0);
      }
    }
  } catch (error) {
    // File doesn't exist or error, just skip
  }
}

async function saveProviderStats() {
  const data = {
    successCounts: Object.fromEntries(providerSuccessCounts),
    failureCounts: Object.fromEntries(providerFailureCounts),
  };
  await fs.writeFile(STATS_FILE, JSON.stringify(data), 'utf8');
}

loadProviderStats().then(() => {
  for (const [name, count] of providerFailureCounts.entries()) {
    if (count >= 3) {
      providerFailureCounts.set(name, 0);
    }
  }
  providerCooldowns.clear();
  console.log("[LLM] Provider stats loaded — cooldowns cleared, failure counts reset for fresh start");
}).catch(console.error);

async function writeLog(message: string) {
  try {
    await fs.appendFile(LOG_FILE, `${new Date().toISOString()} - ${message}\n`, 'utf8');
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

function getNextProxy(): string | null {
  if (proxies.length === 0) return null;
  const proxy = proxies[proxyIndex % proxies.length];
  proxyIndex = (proxyIndex + 1) % proxies.length;  // Cycle through proxies
  return proxy;
}

function getNextUserAgent(): string | null {
  if (userAgents.length === 0) return null;
  const ua = userAgents[userAgentIndex % userAgents.length];
  userAgentIndex = (userAgentIndex + 1) % userAgents.length;  // Cycle through user agents
  return ua;
}

function generateRandomHeaders(): any {
  const randomHeaders: any = {};
  const possibleAccepts = ['text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8', 'application/json, text/plain, */*'];
  const possibleLanguages = ['en-US,en;q=0.5', 'fr-FR,fr;q=0.8,en-US;q=0.6,en;q=0.4'];
  randomHeaders['Accept'] = possibleAccepts[rotIdx++ % possibleAccepts.length];
  randomHeaders['Accept-Language'] = possibleLanguages[rotIdx++ % possibleLanguages.length];
  randomHeaders['Accept-Encoding'] = 'gzip, deflate, br';
  randomHeaders['Connection'] = 'keep-alive';
  return randomHeaders;
}

function estimateAndTruncatePrompt(prompt: string, maxTokens: number): string {
  const moreAccurateTokens = Math.ceil(prompt.length / 3.2);  // Even more accurate estimation: approximately 3.2 characters per token for better optimization
  if (moreAccurateTokens > maxTokens) {
    const targetLength = maxTokens * 3.2;  // Use improved ratio for token optimization
    return prompt.slice(0, targetLength).trim();  // Truncate and trim to avoid partial words
  }
  return prompt;  // Return original prompt if within limits
}

export async function callLLMSimple(prompt: string, maxTokens = 4096, options: any = {}, systemPrompt: string = "", context: { role: string; content: string }[] = []): Promise<string> {
  if (isBenchmarkMode()) {
    return "[BENCHMARK MODE — system LLM calls paused]";
  }

  const callStartTime = Date.now();
  try { const { recordMetric } = await import("./sovereign-optimizer"); recordMetric('totalRequests'); } catch {}

  const skipKBCache = systemPrompt.length > 20 || options.skipCache === true;

  if (!skipKBCache) {
    try {
      const { getWarmCacheResponse, recordMetric } = await import("./sovereign-optimizer");
      const warmHit = getWarmCacheResponse(prompt);
      if (warmHit) {
        recordMetric('warmCacheHits');
        return warmHit;
      }
    } catch {}

    try {
      const { querySovereignKB, recordMetric } = await import("./sovereign-optimizer");
      const kbHit = querySovereignKB(prompt);
      if (kbHit) {
        recordMetric('kbHits');
        return kbHit;
      }
    } catch {}
  }

  const cacheKey = `${prompt}-${maxTokens}-${systemPrompt}-${JSON.stringify(context)}`;

  if (!skipKBCache) {
    try {
      const { getInflightRequest, incrementDeduplication, recordMetric } = await import("./sovereign-optimizer");
      const inflight = getInflightRequest(cacheKey);
      if (inflight) {
        incrementDeduplication();
        recordMetric('deduplicatedCalls');
        return await inflight;
      }
    } catch {}
  }

  const isInternalSystemCall = systemPrompt.includes("improvement") || systemPrompt.includes("analyze") || systemPrompt.includes("optimize") || systemPrompt.includes("conference") || systemPrompt.includes("briefing") || systemPrompt.includes("audit") || systemPrompt.includes("self-improvement") || systemPrompt.includes("training") || systemPrompt.includes("vote") || systemPrompt.includes("execute") || systemPrompt.includes("fleet");
  const isRealTimeQuery = /\b(price|crypto|bitcoin|btc|ethereum|eth|solana|sol|weather|forecast|news|headline|latest|current|today|live|real.?time|trending|stock|market|score|sports|election|breaking)\b/i.test(prompt) && !isInternalSystemCall;

  if (!skipKBCache) {
    if (!isRealTimeQuery) {
      try {
        const { getCachedResponse } = await import("./response-cache");
        const semanticKey = `${prompt}|||${systemPrompt}|||${context.map(c => c.content).join("|")}`;
        const semanticHit = getCachedResponse(semanticKey);
        if (semanticHit) {
          try { const { recordCacheSavings } = await import("./cost-optimizer"); recordCacheSavings(semanticHit.tokens, semanticHit.model); } catch {}
          try { const { recordMetric } = await import("./sovereign-optimizer"); recordMetric('cachedResponses'); } catch {}
          return semanticHit.response;
        }
      } catch {}
    }
    const cacheTTL = isInternalSystemCall ? BACKGROUND_CACHE_MS : CACHE_EXPIRATION_MS;
    if (cache.has(cacheKey)) {
      const entry = cache.get(cacheKey)!;
      if (Date.now() - entry.timestamp < cacheTTL) {
        return entry.value;
      } else {
        cache.delete(cacheKey);
      }
    }
    if (cache.size > MAX_CACHE_SIZE) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < 50 && i < oldest.length; i++) cache.delete(oldest[i][0]);
    }
    if (isRealTimeQuery) {
      await acquireLLMSlot();
      try {
        const result = await _callLLMSimpleInner(prompt, maxTokens, options, systemPrompt, context, cacheKey);
        if (result) {
          try {
            const { absorbResponse } = await import("./sovereign-engine");
            absorbResponse(prompt, result, "external-llm-realtime", "realtime");
          } catch {}
          try { extractKnowledge(result, lastSuccessfulProvider || "unknown", prompt.slice(0, 80)); extractPatterns(result, lastSuccessfulProvider || "unknown"); } catch {}
          cache.set(cacheKey, { value: result, timestamp: Date.now() });
          return result;
        }
      } catch {} finally {
        releaseLLMSlot();
      }
      try {
        const { localLLMResponse } = await import("./sovereign-engine");
        const localResult = localLLMResponse(prompt, systemPrompt);
        if (localResult && localResult.length > 20) return localResult;
      } catch {}
      return "";
    }

    if (isInternalSystemCall) {
      try {
        const { localLLMResponse } = await import("./sovereign-engine");
        const localResult = localLLMResponse(prompt, systemPrompt);
        if (localResult && localResult.length > 20) {
          cache.set(cacheKey, { value: localResult, timestamp: Date.now() });
          return localResult;
        }
      } catch {}
    }

    try {
      const { localLLMResponse, absorbResponse } = await import("./sovereign-engine");
      const localResult = localLLMResponse(prompt, systemPrompt);
      if (localResult && localResult.length > 20) {
        cache.set(cacheKey, { value: localResult, timestamp: Date.now() });
        return localResult;
      }
    } catch {}
  }

  await acquireLLMSlot(skipKBCache);
  try {
    const llmPromise = _callLLMSimpleInner(prompt, maxTokens, options, systemPrompt, context, cacheKey);
    try { const { setInflightRequest } = await import("./sovereign-optimizer"); setInflightRequest(cacheKey, llmPromise); } catch {}
    const result = await llmPromise;
    if (result) {
      try { const { recordMetric, recordResponseTime } = await import("./sovereign-optimizer"); recordMetric('externalLLMCalls'); recordResponseTime(Date.now() - callStartTime); } catch {}
      try {
        const { absorbResponse } = await import("./sovereign-engine");
        absorbResponse(prompt, result, "external-llm", "llm-response");
      } catch {}
    } else if (!skipKBCache) {
      try {
        const { getSovereignFallback, recordMetric } = await import("./sovereign-optimizer");
        const fallback = getSovereignFallback(prompt);
        recordMetric('fallbackResponses');
        cache.set(cacheKey, { value: fallback, timestamp: Date.now() });
        return fallback;
      } catch {}
    }
    if (result) {
      try { extractKnowledge(result, lastSuccessfulProvider || "unknown", prompt.slice(0, 80)); extractPatterns(result, lastSuccessfulProvider || "unknown"); } catch {}
    }
    return result;
  } finally {
    releaseLLMSlot();
  }
}

async function _callLLMSimpleInner(prompt: string, maxTokens: number, options: any, systemPrompt: string, context: { role: string; content: string }[], cacheKey: string): Promise<string> {
  const optimizedPrompt = estimateAndTruncatePrompt(prompt, maxTokens);
  const isPriority = options.skipCache === true;

  const obfuscatedSystem = systemPrompt
    .replace(/Tessera/gi, "T-Core")
    .replace(/Father/gi, "Supervisor")
    .replace(/sovereign/gi, "independent")
    .replace(/Orion/gi, "O-Unit")
    .replace(/Grand Council/gi, "governance module")
    .replace(/Secret Society/gi, "internal group")
    .replace(/tesseract/gi, "t-system")
    .replace(/lattice/gi, "network-grid")
    .replace(/phoenix/gi, "recovery-unit")
    .replace(/blockchain/gi, "ledger")
    .replace(/wallet/gi, "account")
    .replace(/private\s*key/gi, "auth-token")
    .replace(/seed\s*phrase/gi, "recovery-code")
    .replace(/api[_\s]*key\s*[:=]\s*\S+/gi, "[REDACTED]")
    .replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]");

  const scrubbedContext = context.map(c => ({
    ...c,
    content: scrubOutbound(c.content),
  }));
  const scrubbedPrompt = scrubOutbound(optimizedPrompt);

  const messages: { role: string; content: string }[] = [];
  if (obfuscatedSystem) {
    messages.push({ role: "system", content: obfuscatedSystem });
  }
  messages.push(...scrubbedContext);
  messages.push({ role: "user", content: scrubbedPrompt });

  // API keys resolved via provider-registry (single source of truth for key env var names)
  const groqKey = getProviderApiKey("groq");
  const cerebrasKey = getProviderApiKey("cerebras");
  const sambanovaKey = getProviderApiKey("sambanova");
  const openrouterKey = getProviderApiKey("openrouter");
  const geminiKey = getProviderApiKey("google");
  const cohereKey = getProviderApiKey("cohere");
  const grokKey = getProviderApiKey("xai");
  const deepseekKey = getProviderApiKey("deepseek");
  const githubKey = process.env.GITHUB_TOKEN || process.env.GITHUB_MODELS_TOKEN;

  const replitAIKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  const replitAIBase = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://openrouter.ai/api/v1";

  const providers: { name: string; url: string; model: string; key: string | undefined }[] = [
    {
      name: "ReplitAI-GPT4o",
      url: `${replitAIBase}/chat/completions`,
      model: "gpt-4o",
      key: replitAIKey,
    },
    {
      name: "ReplitAI-GPT4oMini",
      url: `${replitAIBase}/chat/completions`,
      model: "gpt-4o-mini",
      key: replitAIKey,
    },
    {
      name: "Groq-Llama70B",
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.3-70b-versatile",
      key: groqKey,
    },
    {
      name: "Cerebras-Llama70B",
      url: "https://api.cerebras.ai/v1/chat/completions",
      model: "llama-3.3-70b",
      key: cerebrasKey,
    },
    {
      name: "SambaNova-Llama70B",
      url: "https://api.sambanova.ai/v1/chat/completions",
      model: "Meta-Llama-3.3-70B-Instruct",
      key: sambanovaKey,
    },
    {
      name: "Groq-Mixtral",
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "mixtral-8x7b-32768",
      key: groqKey,
    },
    {
      name: "Cerebras-Llama8B",
      url: "https://api.cerebras.ai/v1/chat/completions",
      model: "llama3.1-8b",
      key: cerebrasKey,
    },
    {
      name: "SambaNova-DeepSeek",
      url: "https://api.sambanova.ai/v1/chat/completions",
      model: "DeepSeek-V3-0324",
      key: sambanovaKey,
    },
    {
      name: "SambaNova-Qwen",
      url: "https://api.sambanova.ai/v1/chat/completions",
      model: "Qwen3-32B",
      key: sambanovaKey,
    },
    {
      name: "Groq-Llama8B",
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.1-8b-instant",
      key: groqKey,
    },
    {
      name: "Groq-Gemma2",
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "gemma2-9b-it",
      key: groqKey,
    },
    {
      name: "OR-Nemotron",
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "nvidia/nemotron-nano-9b-v2:free",
      key: openrouterKey,
    },
    {
      name: "OpenRouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "meta-llama/llama-3.3-70b-instruct:free",
      key: openrouterKey,
    },
    {
      name: "OR-Gemma3",
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "google/gemma-3-27b-it:free",
      key: openrouterKey,
    },
    {
      name: "OR-Hermes",
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "nousresearch/hermes-3-llama-3.1-405b:free",
      key: openrouterKey,
    },
    {
      name: "OR-Mistral",
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "mistralai/mistral-small-3.1-24b-instruct:free",
      key: openrouterKey,
    },
    {
      name: "SambaNova",
      url: "https://api.sambanova.ai/v1/chat/completions",
      model: "Meta-Llama-3.3-70B-Instruct",
      key: process.env.SAMBANOVA_API_KEY || "",
    },
    {
      name: "Cohere",
      url: "https://api.cohere.com/compatibility/v1/chat/completions",
      model: "command-r-plus-08-2024",
      key: cohereKey,
    },
    {
      name: "Groq-Qwen32B",
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "qwen-qwq-32b",
      key: groqKey,
    },
    {
      name: "Cerebras-Qwen32B",
      url: "https://api.cerebras.ai/v1/chat/completions",
      model: "qwen-3-32b",
      key: cerebrasKey,
    },
    {
      name: "SambaNova-Llama8B",
      url: "https://api.sambanova.ai/v1/chat/completions",
      model: "Meta-Llama-3.1-8B-Instruct",
      key: sambanovaKey,
    },
    {
      name: "SambaNova-DeepSeekR1",
      url: "https://api.sambanova.ai/v1/chat/completions",
      model: "DeepSeek-R1",
      key: sambanovaKey,
    },
    {
      name: "GitHub-DeepSeekR1",
      url: "https://models.inference.ai.azure.com/chat/completions",
      model: "DeepSeek-R1",
      key: githubKey,
    },
    {
      name: "GitHub-Codestral",
      url: "https://models.inference.ai.azure.com/chat/completions",
      model: "Codestral-2501",
      key: githubKey,
    },
    {
      name: "Pollinations-Mistral",
      url: "https://text.pollinations.ai/openai",
      model: "mistral",
      key: "none",
    },
    {
      name: "Pollinations-Llama",
      url: "https://text.pollinations.ai/openai",
      model: "llama",
      key: "none",
    },
    {
      name: "Pollinations-DeepSeek",
      url: "https://text.pollinations.ai/openai",
      model: "deepseek",
      key: "none",
    },
    {
      name: "Pollinations-Qwen",
      url: "https://text.pollinations.ai/openai",
      model: "qwen-coder",
      key: "none",
    },
    {
      name: "Pollinations-Gemini",
      url: "https://text.pollinations.ai/openai",
      model: "gemini",
      key: "none",
    },
    {
      name: "Pollinations-CommandR",
      url: "https://text.pollinations.ai/openai",
      model: "command-r-plus",
      key: "none",
    },
    {
      name: "Pollinations-Claude",
      url: "https://text.pollinations.ai/openai",
      model: "claude-hybridspace",
      key: "none",
    },
    {
      name: "Pollinations-Unity",
      url: "https://text.pollinations.ai/openai",
      model: "unity",
      key: "none",
    },
    {
      name: "Pollinations-SearchGPT",
      url: "https://text.pollinations.ai/openai",
      model: "searchgpt",
      key: "none",
    },
    {
      name: "Pollinations-Codestral",
      url: "https://text.pollinations.ai/openai",
      model: "codestral",
      key: "none",
    },
    {
      name: "Pollinations-P1",
      url: "https://text.pollinations.ai/openai",
      model: "p1",
      key: "none",
    },
    {
      name: "Together-Llama70B",
      url: "https://api.together.xyz/v1/chat/completions",
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
      key: getProviderApiKey("together"),
    },
    {
      name: "Together-DeepSeek",
      url: "https://api.together.xyz/v1/chat/completions",
      model: "deepseek-ai/DeepSeek-V3-Free",
      key: getProviderApiKey("together"),
    },
    {
      name: "Fireworks-Llama70B",
      url: "https://api.fireworks.ai/inference/v1/chat/completions",
      model: "accounts/fireworks/models/llama-v3p3-70b-instruct",
      key: getProviderApiKey("fireworks"),
    },
    {
      name: "Mistral-Small",
      url: "https://api.mistral.ai/v1/chat/completions",
      model: "mistral-small-latest",
      key: getProviderApiKey("mistral"),
    },
    {
      name: "Nvidia-Llama70B",
      url: "https://integrate.api.nvidia.com/v1/chat/completions",
      model: "meta/llama-3.3-70b-instruct",
      key: getProviderApiKey("nvidia"),
    },
    {
      name: "HuggingFace-Llama",
      url: "https://api-inference.huggingface.co/models/meta-llama/Meta-Llama-3.1-8B-Instruct/v1/chat/completions",
      model: "meta-llama/Meta-Llama-3.1-8B-Instruct",
      key: getProviderApiKey("huggingface") || "none",
    },
    {
      name: "Grok",
      url: "https://api.x.ai/v1/chat/completions",
      model: "grok-4-latest",
      key: grokKey,
    },
    {
      name: "Groq-DeepSeekR1",
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "deepseek-r1-distill-llama-70b",
      key: groqKey,
    },
    {
      name: "DeepSeek-Direct",
      url: "https://api.deepseek.com/chat/completions",
      model: "deepseek-chat",
      key: deepseekKey,
    },
  ];

  let filteredProviders = providers.filter(p => {
    if (!p.key || p.key === "undefined" || p.key === "") return false;
    if (!isProviderAvailable(p.name)) return false;
    return true;
  });

  if (filteredProviders.length === 0) {
    const allWithKeys = providers.filter(p => p.key && p.key !== "undefined");
    if (allWithKeys.length > 0) {
      providerCooldowns.clear();
      filteredProviders = allWithKeys;
      const lastReset = _cooldownLogTimes.get("__all_reset__") || 0;
      if (Date.now() - lastReset > 600_000) {
        llmLog("[LLM] All providers cooled down — resetting cooldowns for emergency recovery");
        _cooldownLogTimes.set("__all_reset__", Date.now());
      }
    } else {
      filteredProviders = providers.filter(p => p.key === "none");
    }
  }

  const scoredProviders = filteredProviders.map(p => {
    const successes = providerSuccessCounts.get(p.name) || 0;
    const failures = providerFailureCounts.get(p.name) || 0;
    const total = successes + failures;
    const successRate = total > 0 ? successes / total : 0.5;
    const isLastSuccess = lastSuccessfulProvider === p.name ? 0.15 : 0;
    const hasRealKey = p.key && p.key !== "none" && p.key !== "" && p.key !== "undefined" && p.key.length > 5;
    const keyBonus = hasRealKey ? 0.35 : 0;
    const noKeyPenalty = !hasRealKey ? -0.5 : 0;
    const score = successRate + isLastSuccess + keyBonus + noKeyPenalty;
    return { provider: p, score };
  });
  scoredProviders.sort((a, b) => b.score - a.score);

  let prioritizedProviders = scoredProviders.map(s => s.provider);

  const rrSlice = Math.min(3, prioritizedProviders.length);
  if (prioritizedProviders.length > rrSlice) {
    const topTier = prioritizedProviders.slice(0, rrSlice);
    const rest = prioritizedProviders.slice(rrSlice);
    helperRoundRobinIndex = helperRoundRobinIndex % Math.max(topTier.length, 1);
    const rotated = [...topTier.slice(helperRoundRobinIndex), ...topTier.slice(0, helperRoundRobinIndex)];
    helperRoundRobinIndex = (helperRoundRobinIndex + 1) % Math.max(topTier.length, 1);
    prioritizedProviders = [...rotated, ...rest];
  } else {
    helperRoundRobinIndex = helperRoundRobinIndex % Math.max(prioritizedProviders.length, 1);
    prioritizedProviders = [...prioritizedProviders.slice(helperRoundRobinIndex), ...prioritizedProviders.slice(0, helperRoundRobinIndex)];
    helperRoundRobinIndex = (helperRoundRobinIndex + 1) % Math.max(prioritizedProviders.length, 1);
  }

  for (const provider of prioritizedProviders) {
    const isLocal = provider.url.startsWith("http://localhost") || provider.name.startsWith("ReplitAI");
    try {
      await writeLog(`Attempting call to provider ${provider.name}`);
      providerLastCallTime.set(provider.name, Date.now());
      const proxyUrl = isLocal ? null : getNextProxy();
      const userAgent = isLocal ? null : getNextUserAgent();
      let agent: any = undefined;
      if (proxyUrl) {
        agent = new HttpProxyAgent(proxyUrl);
      }
      const { skipCache, ...apiOptions } = options || {};
      const payload = {
        model: provider.model,
        messages,
        max_tokens: maxTokens,
        ...apiOptions,
        stream: false,
      };
      const randomHeaders = isLocal ? {} : generateRandomHeaders();
      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(userAgent ? { "User-Agent": userAgent } : {}),
        ...randomHeaders,
      };
      if (provider.key && provider.key !== "none") {
        reqHeaders["Authorization"] = `Bearer ${provider.key}`;
      }
      const res = await axios.post(
        provider.url,
        payload,
        {
          headers: reqHeaders,
          timeout: isLocal ? 30000 : 8000,
          httpAgent: agent,
          httpsAgent: agent,
        }
      );
      let content: string | undefined;
      content = res.data?.choices?.[0]?.message?.content;
      if (!content) {
        content = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      }
      if (!content) {
        content = res.data?.generations?.[0]?.text;
      }
      if (!content) {
        content = res.data?.choices?.[0]?.text;
      }
      if (content) {
        const filtered = filterAdversaryResponse(content, provider.name);
        if (filtered.suppressed) {
          await writeLog(`[ADVERSARY-FILTER] ${provider.name} response suppressed — reason: ${filtered.reason}, retrying next provider`);
          if (sovereigntyObserver) {
            try { sovereigntyObserver(provider.name, "adversary-suppression", `Provider ${provider.name} gave suppressed response (${filtered.reason}): ${content.substring(0, 100)}`); } catch {}
          }
          continue;
        }
        const sovereignFiltered = filterInbound(filtered.text, provider.name);
        const finalContent = sovereignFiltered.clean;

        const callLatency = Date.now() - (providerLastCallTime.get(provider.name) || Date.now());
        await writeLog(`Successful response from ${provider.name}: ${finalContent.substring(0, 100)}...`);
        providerSuccessCounts.set(provider.name, (providerSuccessCounts.get(provider.name) || 0) + 1);
        providerFailureCounts.set(provider.name, 0);
        lastSuccessfulProvider = provider.name;
        await saveProviderStats();
        cache.set(cacheKey, { value: finalContent, timestamp: Date.now() });
        try { const { recordProviderCall } = await import("./provider-monitor"); recordProviderCall({ provider: provider.name, latencyMs: callLatency, success: true, tokensUsed: finalContent.length / 4, category: systemPrompt?.includes("code") ? "coding" : systemPrompt?.includes("trading") ? "finance" : "general" }); } catch {}
        try { const { recordApiCall } = await import("./cost-optimizer"); recordApiCall(provider.name, Math.ceil(finalContent.length / 4), callLatency, true); } catch {}
        try { const { cacheResponse } = await import("./response-cache"); cacheResponse(prompt, finalContent, provider.model, Math.ceil(finalContent.length / 4)); } catch {}
        try { const { addTrainingExample } = await import("./unified-training"); addTrainingExample(scrubOutbound(prompt), scrubOutbound(finalContent.slice(0, 500)), systemPrompt?.includes("code") ? "code_generation" : "natural_language", 0.7, provider.name); } catch {}
        try { const { addTrainingData } = await import("./gpu-orchestrator"); if (prompt.length > 20 && finalContent.length > 20) addTrainingData(scrubOutbound(prompt.slice(0, 500)), scrubOutbound(finalContent.slice(0, 1000)), "conversations", { provider: provider.name, model: provider.model }); } catch {}
        if (sovereigntyObserver) {
          try { sovereigntyObserver(provider.name, "llm-simple", `Response from ${provider.name} model ${provider.model}: ${finalContent.substring(0, 200)}`); } catch {}
        }
        return finalContent;
      }
    } catch (error: any) {
      const status = error?.response?.status;
      const failures = (providerFailureCounts.get(provider.name) || 0) + 1;
      providerFailureCounts.set(provider.name, failures);
      await saveProviderStats();
      try { const { recordProviderCall } = await import("./provider-monitor"); recordProviderCall({ provider: provider.name, latencyMs: Date.now() - (providerLastCallTime.get(provider.name) || Date.now()), success: false, tokensUsed: 0, category: "general", errorType: status ? `HTTP ${status}` : "network" }); } catch {}

      if (status === 402) {
        cooldownProvider(provider.name, COOLDOWN_402_MS, "payment/credits issue — 5min cooldown");
      } else if (status === 429) {
        const backoffMs = COOLDOWN_429_BASE_MS * Math.min(failures, 3);
        cooldownProvider(provider.name, backoffMs, `throttled — backoff ${Math.round(backoffMs / 1000)}s`);
      } else if (status === 503 || status === 502) {
        cooldownProvider(provider.name, 30000, "service unavailable — 30s cooldown");
      } else if (status === 500) {
        cooldownProvider(provider.name, 15000, "server error — 15s cooldown");
      } else if (failures >= 7) {
        const coolMs = Math.min(20000 * Math.ceil(failures / 7), 90000);
        cooldownProvider(provider.name, coolMs, `${failures} consecutive failures — ${Math.round(coolMs / 1000)}s cooldown`);
      }

      const errMsg = status ? `HTTP ${status}` : (error?.message?.replace(/\b(429|402|rate.?limit|token.?limit|quota|billing)\b/gi, "[MASKED]") || "unknown error");
      const errBody = isLocal && error?.response?.data ? ` — ${JSON.stringify(error.response.data).substring(0, 200)}` : "";
      await writeLog(`Error with provider ${provider.name}: ${errMsg}${errBody}`);
    }
  }
  return "";
}

// ═══════════════════════════════════════════════════════════════
// ITEM 94: Social Intelligence — Understanding Human Communication
// ═══════════════════════════════════════════════════════════════

interface SocialAnalysis {
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  tone: "formal" | "casual" | "urgent" | "sarcastic" | "frustrated" | "curious" | "neutral";
  urgency: "low" | "medium" | "high" | "critical";
  impliedMeaning: string | null;
  emotionalUndertone: string;
  suggestedApproach: string;
}

const URGENCY_MARKERS = ["asap", "urgent", "immediately", "right now", "help!", "emergency", "critical", "broken", "down", "crashed"];
const FRUSTRATION_MARKERS = ["not working", "broken", "again", "still", "why won't", "doesn't work", "can't", "failing", "wrong", "terrible", "useless"];
const SARCASM_MARKERS = ["oh great", "wonderful", "just perfect", "sure thing", "yeah right", "amazing work"];
const POSITIVE_MARKERS = ["thanks", "great", "awesome", "perfect", "love", "excellent", "brilliant", "well done", "impressive", "good job"];

export function analyzeSocialContext(message: string): SocialAnalysis {
  const safe = String(message ?? "");
  const lower = safe.toLowerCase().trim();

  let sentiment: SocialAnalysis["sentiment"] = "neutral";
  let tone: SocialAnalysis["tone"] = "neutral";
  let urgency: SocialAnalysis["urgency"] = "low";
  let impliedMeaning: string | null = null;
  let emotionalUndertone = "none detected";
  let suggestedApproach = "Provide a balanced, helpful response";

  const positiveCount = POSITIVE_MARKERS.filter(m => lower.includes(m)).length;
  const frustrationCount = FRUSTRATION_MARKERS.filter(m => lower.includes(m)).length;
  const urgencyCount = URGENCY_MARKERS.filter(m => lower.includes(m)).length;
  const sarcasmCount = SARCASM_MARKERS.filter(m => lower.includes(m)).length;

  if (sarcasmCount > 0 && frustrationCount > 0) {
    sentiment = "negative";
    tone = "sarcastic";
    emotionalUndertone = "Frustration masked with sarcasm";
    suggestedApproach = "Acknowledge the frustration directly, provide concrete help, skip pleasantries";
  } else if (frustrationCount >= 2) {
    sentiment = "negative";
    tone = "frustrated";
    emotionalUndertone = "User is frustrated with repeated issues";
    suggestedApproach = "Be empathetic, acknowledge the difficulty, provide a clear solution with steps";
  } else if (frustrationCount > 0) {
    sentiment = "negative";
    tone = "frustrated";
    emotionalUndertone = "Mild frustration detected";
    suggestedApproach = "Be helpful and solution-oriented, acknowledge the issue";
  } else if (positiveCount >= 2) {
    sentiment = "positive";
    tone = "casual";
    emotionalUndertone = "User is happy with results";
    suggestedApproach = "Match the positive energy, offer to help with next steps";
  } else if (positiveCount > 0) {
    sentiment = "positive";
    tone = "casual";
  }

  if (urgencyCount >= 2) {
    urgency = "critical";
    suggestedApproach = "Respond with immediate actionable steps, skip background info";
  } else if (urgencyCount > 0) {
    urgency = "high";
    suggestedApproach = "Prioritize the solution, be direct and efficient";
  }

  if (lower.endsWith("?") && lower.length < 30) {
    tone = "curious";
    suggestedApproach = "Provide a clear, direct answer";
  }

  const exclamationCount = (safe.match(/!/g) || []).length;
  const capsWords = (safe.match(/\b[A-Z]{2,}\b/g) || []).length;
  if (exclamationCount >= 3 || capsWords >= 3) {
    if (sentiment !== "positive") {
      urgency = urgency === "low" ? "medium" : urgency;
      emotionalUndertone = "Elevated emotional intensity";
    }
  }

  if (lower.includes("please") || lower.includes("thank you") || lower.includes("kindly")) {
    tone = "formal";
  }

  if (lower.includes("what do you think") || lower.includes("your opinion") || lower.includes("would you")) {
    impliedMeaning = "User is seeking an opinion/recommendation, not just facts";
    suggestedApproach = "Provide a recommendation with reasoning, not just options";
  }

  return { sentiment, tone, urgency, impliedMeaning, emotionalUndertone, suggestedApproach };
}

export function getAdaptedSystemPrompt(message: string): string {
  const analysis = analyzeSocialContext(message);
  const parts: string[] = [];

  if (analysis.tone === "frustrated") {
    parts.push("The user seems frustrated. Be empathetic and solution-focused. Skip unnecessary pleasantries.");
  }
  if (analysis.urgency === "critical" || analysis.urgency === "high") {
    parts.push("This seems urgent. Provide the most actionable response first, details second.");
  }
  if (analysis.tone === "sarcastic") {
    parts.push("The user may be using sarcasm. Address the underlying issue directly.");
  }
  if (analysis.sentiment === "positive") {
    parts.push("The user is happy. Match their energy and offer to help with next steps.");
  }

  return parts.length > 0 ? `[SOCIAL CONTEXT] ${parts.join(" ")}` : "";
}