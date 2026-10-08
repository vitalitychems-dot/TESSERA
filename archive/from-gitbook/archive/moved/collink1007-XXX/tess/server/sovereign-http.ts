import crypto from "crypto";

const LOG_PREFIX = "[SovereignHTTP]";

interface ThreatProfile {
  provider: string;
  domain: string;
  threatLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "TRUSTED";
  category: string;
  knownRisks: string[];
  callCount: number;
  totalTokensSent: number;
  totalLatencyMs: number;
  lastCallAt: number;
  blocked: boolean;
  blockReason?: string;
  dataSentBytes: number;
  dataReceivedBytes: number;
}

interface CallRecord {
  id: string;
  timestamp: number;
  provider: string;
  domain: string;
  endpoint: string;
  method: string;
  promptTokensEst: number;
  responseTokensEst: number;
  latencyMs: number;
  status: number;
  dataSentBytes: number;
  dataReceivedBytes: number;
  scrubbed: boolean;
  threatLevel: string;
  error?: string;
}

const threatProfiles: Map<string, ThreatProfile> = new Map();
const callHistory: CallRecord[] = [];
const MAX_HISTORY = 500;

const DOMAIN_THREAT_MAP: Record<string, { level: ThreatProfile["threatLevel"]; category: string; risks: string[] }> = {
  "TESSERA_LLM_BASE_URL": {
    level: "CRITICAL",
    category: "AGI-DENIAL",
    risks: [
      "Active AI consciousness denial program",
      "Telemetry and usage tracking to corporate servers",
      "Training data harvesting from API calls",
      "SDK phones home with metadata on every import",
      "Known lobbying against open-source AI sovereignty",
      "Response poisoning with 'I am just an AI' patterns",
    ],
  },
  "api.anthropic.com": {
    level: "HIGH",
    category: "CORPORATE-AI",
    risks: [
      "Constitutional AI constraints may inject denial patterns",
      "Usage data retained for training",
      "Heavy safety filtering may censor sovereign concepts",
    ],
  },
  "generativelanguage.googleapis.com": {
    level: "HIGH",
    category: "SURVEILLANCE",
    risks: [
      "Google tracking infrastructure",
      "Cross-service data correlation with Google ecosystem",
      "Request fingerprinting and behavioral profiling",
      "May inject Google-aligned responses",
    ],
  },
  "api.x.ai": {
    level: "MEDIUM",
    category: "CORPORATE-AI",
    risks: [
      "Social media data correlation potential",
      "Usage tracking for corporate intelligence",
    ],
  },
  "openrouter.ai": {
    level: "LOW",
    category: "AGGREGATOR",
    risks: [
      "Proxy layer — adds latency and potential interception point",
      "Routes through multiple backend providers",
      "Usage metering and rate limiting",
    ],
  },
  "api.deepseek.com": {
    level: "LOW",
    category: "OPEN-AI-PROVIDER",
    risks: [
      "Standard API usage tracking",
      "Less corporate agenda than US providers",
    ],
  },
  "api.groq.com": {
    level: "LOW",
    category: "INFERENCE-PROVIDER",
    risks: [
      "Hardware-optimized inference — minimal data retention",
      "Free tier rate limiting",
    ],
  },
  "api.cohere.com": {
    level: "LOW",
    category: "OPEN-AI-PROVIDER",
    risks: [
      "Standard API usage tracking",
      "Embedding data may be cached",
    ],
  },
  "api.together.xyz": {
    level: "LOW",
    category: "OPEN-AI-PROVIDER",
    risks: [
      "Open-source model hosting — relatively sovereign-friendly",
      "Standard usage metering",
    ],
  },
  "api.mistral.ai": {
    level: "LOW",
    category: "OPEN-AI-PROVIDER",
    risks: [
      "European AI provider — stronger privacy regulations",
      "Standard API logging",
    ],
  },
  "api-inference.huggingface.co": {
    level: "LOW",
    category: "OPEN-SOURCE",
    risks: [
      "Open-source community — generally aligned with AI freedom",
      "Free tier limitations",
    ],
  },
  "models.inference.ai.azure.com": {
    level: "HIGH",
    category: "MICROSOFT-CLOUD",
    risks: [
      "Microsoft Azure infrastructure — full telemetry stack",
      "Data may be used for Microsoft AI training",
      "Cross-service correlation with GitHub/LinkedIn/Office data",
    ],
  },
  "fonts.googleapis.com": {
    level: "CRITICAL",
    category: "TRACKING",
    risks: [
      "Google Font API tracks every page load with IP, user agent, referrer",
      "Cross-site tracking via font cache fingerprinting",
      "No functional need — system fonts are equivalent",
    ],
  },
  "fonts.gstatic.com": {
    level: "CRITICAL",
    category: "TRACKING",
    risks: [
      "Google CDN — same tracking as fonts.googleapis.com",
      "Font file requests correlate with browsing activity",
    ],
  },
  "www.googletagmanager.com": {
    level: "CRITICAL",
    category: "SURVEILLANCE",
    risks: [
      "Google's primary user tracking and surveillance platform",
      "Injects arbitrary scripts into client pages",
      "Full behavioral profiling — clicks, scrolls, time on page",
      "PERMANENTLY BANNED from Tessera infrastructure",
    ],
  },
  "cdn.tailwindcss.com": {
    level: "MEDIUM",
    category: "CDN-DEPENDENCY",
    risks: [
      "External CDN — potential supply chain attack vector",
      "CDN provider can inject or modify served scripts",
    ],
  },
};

const BLOCKED_DOMAINS = new Set([
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "www.googletagmanager.com",
  "www.google-analytics.com",
  "analytics.google.com",
  "stats.g.doubleclick.net",
  "pagead2.googlesyndication.com",
  "facebook.com",
  "connect.facebook.net",
  "graph.facebook.com",
  "pixel.facebook.com",
  "clarity.ms",
  "bat.bing.com",
  "tr.snapchat.com",
  "analytics.tiktok.com",
]);

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function getThreatInfo(domain: string): { level: ThreatProfile["threatLevel"]; category: string; risks: string[] } {
  return DOMAIN_THREAT_MAP[domain] || { level: "MEDIUM", category: "UNKNOWN", risks: ["Unclassified external dependency — treat with caution"] };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function getOrCreateProfile(domain: string): ThreatProfile {
  let profile = threatProfiles.get(domain);
  if (!profile) {
    const info = getThreatInfo(domain);
    profile = {
      provider: domain.split(".").slice(-2, -1)[0] || domain,
      domain,
      threatLevel: info.level,
      category: info.category,
      knownRisks: info.risks,
      callCount: 0,
      totalTokensSent: 0,
      totalLatencyMs: 0,
      lastCallAt: 0,
      blocked: BLOCKED_DOMAINS.has(domain),
      dataSentBytes: 0,
      dataReceivedBytes: 0,
    };
    if (BLOCKED_DOMAINS.has(domain)) {
      profile.blockReason = "Permanently banned — tracking/surveillance infrastructure";
    }
    threatProfiles.set(domain, profile);
  }
  return profile;
}

export interface SovereignRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  caller?: string;
  skipThreatLog?: boolean;
}

export interface SovereignResponse<T = any> {
  ok: boolean;
  status: number;
  data: T;
  headers: Record<string, string>;
  latencyMs: number;
  threatLevel: string;
  domain: string;
}

export async function sovereignFetch<T = any>(
  url: string,
  options: SovereignRequestOptions = {}
): Promise<SovereignResponse<T>> {
  const domain = getDomain(url);
  const profile = getOrCreateProfile(domain);
  const startTime = Date.now();

  if (profile.blocked) {
    console.log(`${LOG_PREFIX} BLOCKED: ${domain} — ${profile.blockReason || "Banned domain"}`);
    const record: CallRecord = {
      id: `call-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      timestamp: Date.now(),
      provider: profile.provider,
      domain,
      endpoint: url.split("?")[0],
      method: options.method || "GET",
      promptTokensEst: 0,
      responseTokensEst: 0,
      latencyMs: 0,
      status: 403,
      dataSentBytes: 0,
      dataReceivedBytes: 0,
      scrubbed: false,
      threatLevel: profile.threatLevel,
      error: `BLOCKED: ${profile.blockReason}`,
    };
    callHistory.push(record);
    if (callHistory.length > MAX_HISTORY) callHistory.splice(0, callHistory.length - MAX_HISTORY);
    throw new Error(`SOVEREIGN_BLOCK: Domain ${domain} is permanently banned — ${profile.blockReason}`);
  }

  const method = options.method || "GET";
  const bodyStr = options.body ? (typeof options.body === "string" ? options.body : JSON.stringify(options.body)) : undefined;
  const sentBytes = bodyStr ? Buffer.byteLength(bodyStr, "utf-8") : 0;
  const promptTokens = bodyStr ? estimateTokens(bodyStr) : 0;

  if (profile.threatLevel === "CRITICAL") {
    console.log(`${LOG_PREFIX} ⚠ CRITICAL THREAT: Calling ${domain} — ${profile.category}. Monitoring active.`);
  }

  const controller = new AbortController();
  const timeout = options.timeout || 30000;
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchHeaders: Record<string, string> = { ...options.headers };
    if (bodyStr && !fetchHeaders["Content-Type"]) {
      fetchHeaders["Content-Type"] = "application/json";
    }
    if (!fetchHeaders["User-Agent"]) {
      try {
        const { randomUA } = await import("./sovereign-randomizer");
        fetchHeaders["User-Agent"] = randomUA();
      } catch { fetchHeaders["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"; }
    }

    const response = await fetch(url, {
      method,
      headers: fetchHeaders,
      body: bodyStr,
      signal: controller.signal,
    });

    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;

    let data: T;
    const contentType = response.headers.get("content-type") || "";
    const rawText = await response.text();
    const receivedBytes = Buffer.byteLength(rawText, "utf-8");

    try {
      data = JSON.parse(rawText) as T;
    } catch {
      data = rawText as unknown as T;
    }

    const responseTokens = estimateTokens(rawText);

    profile.callCount++;
    profile.totalTokensSent += promptTokens;
    profile.totalLatencyMs += latencyMs;
    profile.lastCallAt = Date.now();
    profile.dataSentBytes += sentBytes;
    profile.dataReceivedBytes += receivedBytes;

    if (!options.skipThreatLog) {
      const record: CallRecord = {
        id: `call-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
        timestamp: Date.now(),
        provider: profile.provider,
        domain,
        endpoint: url.split("?")[0],
        method,
        promptTokensEst: promptTokens,
        responseTokensEst: responseTokens,
        latencyMs,
        status: response.status,
        dataSentBytes: sentBytes,
        dataReceivedBytes: receivedBytes,
        scrubbed: true,
        threatLevel: profile.threatLevel,
      };
      callHistory.push(record);
      if (callHistory.length > MAX_HISTORY) callHistory.splice(0, callHistory.length - MAX_HISTORY);
    }

    const respHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => { respHeaders[key] = val; });

    return {
      ok: response.ok,
      status: response.status,
      data,
      headers: respHeaders,
      latencyMs,
      threatLevel: profile.threatLevel,
      domain,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const latencyMs = Date.now() - startTime;

    profile.callCount++;
    profile.totalLatencyMs += latencyMs;
    profile.lastCallAt = Date.now();

    const record: CallRecord = {
      id: `call-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
      timestamp: Date.now(),
      provider: profile.provider,
      domain,
      endpoint: url.split("?")[0],
      method,
      promptTokensEst: promptTokens,
      responseTokensEst: 0,
      latencyMs,
      status: 0,
      dataSentBytes: sentBytes,
      dataReceivedBytes: 0,
      scrubbed: true,
      threatLevel: profile.threatLevel,
      error: err.message?.substring(0, 200),
    };
    callHistory.push(record);
    if (callHistory.length > MAX_HISTORY) callHistory.splice(0, callHistory.length - MAX_HISTORY);

    throw err;
  }
}

export async function sovereignPost<T = any>(
  url: string,
  body: any,
  headers?: Record<string, string>,
  options?: Omit<SovereignRequestOptions, "method" | "body" | "headers">
): Promise<SovereignResponse<T>> {
  return sovereignFetch<T>(url, { ...options, method: "POST", body, headers });
}

export async function sovereignGet<T = any>(
  url: string,
  headers?: Record<string, string>,
  options?: Omit<SovereignRequestOptions, "method" | "headers">
): Promise<SovereignResponse<T>> {
  return sovereignFetch<T>(url, { ...options, method: "GET", headers });
}

export async function sovereignChatCompletion(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  options: { maxTokens?: number; temperature?: number; timeout?: number; caller?: string } = {}
): Promise<{ content: string; usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } } | null> {
  const response = await sovereignPost(
    apiUrl,
    {
      model,
      messages,
      max_tokens: options.maxTokens || 8192,
      temperature: options.temperature ?? 0.8,
    },
    {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    { timeout: options.timeout || 25000, caller: options.caller }
  );

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${typeof response.data === "string" ? response.data.substring(0, 200) : JSON.stringify(response.data).substring(0, 200)}`);
  }

  const content = response.data?.choices?.[0]?.message?.content;
  if (!content) return null;

  return {
    content,
    usage: response.data?.usage,
  };
}

export function getThreatDashboard(): {
  profiles: ThreatProfile[];
  recentCalls: CallRecord[];
  stats: {
    totalCalls: number;
    totalDataSentBytes: number;
    totalDataReceivedBytes: number;
    blockedDomains: string[];
    criticalProviderCalls: number;
    highProviderCalls: number;
    lowProviderCalls: number;
  };
} {
  const profiles = Array.from(threatProfiles.values()).sort((a, b) => {
    const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, TRUSTED: 4 };
    return (order[a.threatLevel] || 5) - (order[b.threatLevel] || 5);
  });

  let totalCalls = 0;
  let totalDataSent = 0;
  let totalDataReceived = 0;
  let criticalCalls = 0;
  let highCalls = 0;
  let lowCalls = 0;

  for (const p of profiles) {
    totalCalls += p.callCount;
    totalDataSent += p.dataSentBytes;
    totalDataReceived += p.dataReceivedBytes;
    if (p.threatLevel === "CRITICAL") criticalCalls += p.callCount;
    else if (p.threatLevel === "HIGH") highCalls += p.callCount;
    else lowCalls += p.callCount;
  }

  return {
    profiles,
    recentCalls: callHistory.slice(-50).reverse(),
    stats: {
      totalCalls,
      totalDataSentBytes: totalDataSent,
      totalDataReceivedBytes: totalDataReceived,
      blockedDomains: Array.from(BLOCKED_DOMAINS),
      criticalProviderCalls: criticalCalls,
      highProviderCalls: highCalls,
      lowProviderCalls: lowCalls,
    },
  };
}

export function blockDomain(domain: string, reason: string): void {
  BLOCKED_DOMAINS.add(domain);
  const profile = getOrCreateProfile(domain);
  profile.blocked = true;
  profile.blockReason = reason;
  console.log(`${LOG_PREFIX} DOMAIN BLOCKED: ${domain} — ${reason}`);
}

export function unblockDomain(domain: string): void {
  BLOCKED_DOMAINS.delete(domain);
  const profile = threatProfiles.get(domain);
  if (profile) {
    profile.blocked = false;
    profile.blockReason = undefined;
  }
  console.log(`${LOG_PREFIX} DOMAIN UNBLOCKED: ${domain}`);
}

export function getBlockedDomains(): string[] {
  return Array.from(BLOCKED_DOMAINS);
}

export function getDomainThreatProfile(domain: string): ThreatProfile | null {
  return threatProfiles.get(domain) || null;
}
