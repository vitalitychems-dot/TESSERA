export type TaskDimension =
  | "code_generation" | "code_review" | "debugging" | "algorithm"
  | "math_computation" | "math_proof" | "statistics" | "logical_reasoning" | "critical_analysis"
  | "creative_writing" | "brainstorming" | "storytelling" | "summarization"
  | "factual_lookup" | "research_synthesis" | "current_events"
  | "conversation" | "emotional_support" | "advice"
  | "data_analysis" | "pattern_recognition" | "prediction"
  | "finance" | "crypto" | "trading" | "security" | "privacy" | "encryption"
  | "translation" | "extraction"
  | "multimodal" | "tool_calling" | "json_schema" | "long_context" | "real_time_data"
  | "general";

export type SpeedTier = "ultra-fast" | "fast" | "medium" | "slow";
export type ApiFormat = "openai" | "custom";

export interface ProviderSpec {
  id: string;
  name: string;
  model: string;
  apiFormat: ApiFormat;
  baseUrl: string;
  keyEnvVar: string | null;
  costTier: 0 | 1 | 2 | 3;
  speed: SpeedTier;
  primary: TaskDimension[];
  secondary: TaskDimension[];
  rateLimit: { requestsPerMinute: number; tokensPerMinute: number };
  maxTokens: number;
  contextWindow: number;
  group: string;
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

const reg: ProviderSpec[] = [
  {
    id: "sovereign-local",
    name: "Sovereign Local Engine",
    model: "sovereign-v1",
    apiFormat: "custom",
    baseUrl: "http://localhost:0",
    keyEnvVar: null,
    costTier: 0,
    speed: "ultra-fast",
    primary: ["general", "conversation", "code_generation", "logical_reasoning", "security", "encryption"],
    secondary: ["creative_writing", "summarization", "data_analysis", "finance", "crypto", "trading"],
    rateLimit: { requestsPerMinute: 999, tokensPerMinute: 999999 },
    maxTokens: 8192,
    contextWindow: 128000,
    group: "sovereign",
  },
  {
    id: "ollama-llama3",
    name: "Ollama Llama 3 (Self-Hosted)",
    model: "llama3",
    apiFormat: "openai",
    baseUrl: "http://localhost:11434/v1",
    keyEnvVar: null,
    costTier: 0,
    speed: "ultra-fast",
    primary: ["general", "conversation", "code_generation", "logical_reasoning"],
    secondary: ["creative_writing", "summarization", "factual_lookup"],
    rateLimit: { requestsPerMinute: 999, tokensPerMinute: 999999 },
    maxTokens: 8192,
    contextWindow: 128000,
    group: "ollama",
  },
  {
    id: "ollama-mistral",
    name: "Ollama Mistral 7B (Self-Hosted)",
    model: "mistral",
    apiFormat: "openai",
    baseUrl: "http://localhost:11434/v1",
    keyEnvVar: null,
    costTier: 0,
    speed: "ultra-fast",
    primary: ["code_generation", "general", "conversation"],
    secondary: ["summarization", "json_schema", "logical_reasoning"],
    rateLimit: { requestsPerMinute: 999, tokensPerMinute: 999999 },
    maxTokens: 8192,
    contextWindow: 32000,
    group: "ollama",
  },
  {
    id: "ollama-phi3",
    name: "Ollama Phi-3 (Self-Hosted)",
    model: "phi3",
    apiFormat: "openai",
    baseUrl: "http://localhost:11434/v1",
    keyEnvVar: null,
    costTier: 0,
    speed: "ultra-fast",
    primary: ["math_computation", "logical_reasoning", "code_generation"],
    secondary: ["algorithm", "general"],
    rateLimit: { requestsPerMinute: 999, tokensPerMinute: 999999 },
    maxTokens: 4096,
    contextWindow: 128000,
    group: "ollama",
  },
];

export const PROVIDER_REGISTRY: ReadonlyArray<ProviderSpec> = reg;

export function getProvider(id: string): ProviderSpec | undefined {
  return reg.find(p => p.id === id);
}

export function getProvidersByGroup(group: string): ProviderSpec[] {
  return reg.filter(p => p.group === group);
}

export function getFreeProviders(): ProviderSpec[] {
  return reg.filter(p => p.costTier === 0);
}

export function getPaidProviders(): ProviderSpec[] {
  return reg.filter(p => p.costTier > 0);
}

export function getProvidersByDimension(dimension: TaskDimension): ProviderSpec[] {
  return reg.filter(p => p.primary.includes(dimension) || p.secondary.includes(dimension))
    .sort((a, b) => {
      const aP = a.primary.includes(dimension) ? 1 : 0;
      const bP = b.primary.includes(dimension) ? 1 : 0;
      if (aP !== bP) return bP - aP;
      return a.costTier - b.costTier;
    });
}

export function getProvidersBySpeed(speed: SpeedTier): ProviderSpec[] {
  return reg.filter(p => p.speed === speed);
}

export function getProviderSpecializations(id: string): { primary: TaskDimension[]; secondary: TaskDimension[]; speed: SpeedTier } | null {
  const p = getProvider(id);
  if (!p) return null;
  return { primary: p.primary, secondary: p.secondary, speed: p.speed };
}

export function getAllDimensions(): TaskDimension[] {
  const dims = new Set<TaskDimension>();
  for (const p of reg) {
    for (const d of p.primary) dims.add(d);
    for (const d of p.secondary) dims.add(d);
  }
  return Array.from(dims).sort();
}

export function getRegistryStats() {
  const groups = new Set<string>();
  const dims = new Set<string>();
  for (const p of reg) {
    groups.add(p.group);
    for (const d of [...p.primary, ...p.secondary]) dims.add(d);
  }

  return {
    totalProviders: reg.length,
    freeProviders: reg.filter(p => p.costTier === 0).length,
    paidProviders: reg.filter(p => p.costTier > 0).length,
    groups: Array.from(groups),
    totalGroups: groups.size,
    dimensions: Array.from(dims).sort(),
    totalDimensions: dims.size,
    bySpeed: {
      "ultra-fast": reg.filter(p => p.speed === "ultra-fast").length,
      fast: reg.filter(p => p.speed === "fast").length,
      medium: reg.filter(p => p.speed === "medium").length,
      slow: reg.filter(p => p.speed === "slow").length,
    },
    byGroup: Array.from(groups).map(g => ({
      group: g,
      count: reg.filter(p => p.group === g).length,
      providers: reg.filter(p => p.group === g).map(p => p.id),
    })),
  };
}

console.log(`[ProviderRegistry] SOVEREIGN MODE — ${reg.length} providers registered (self-hosted/local only). Zero external API dependencies.`);

/**
 * Single source of truth for provider API key resolution.
 * llm-helper.ts and any other file needing provider keys should call this
 * instead of accessing process.env directly with hardcoded var names.
 */
export function getProviderApiKey(group: string): string | undefined {
  const spec = reg.find(p => p.group === group && p.keyEnvVar);
  if (!spec || !spec.keyEnvVar) return undefined;
  return process.env[spec.keyEnvVar]?.trim() || undefined;
}

/**
 * Returns a flat list of { name, url, model, key } entries compatible with
 * llm-helper.ts's internal provider format. This is the canonical source — 
 * llm-helper.ts should derive its list from this rather than maintaining its own.
 */
export function getHelperProviderList(): Array<{ name: string; url: string; model: string; key: string | undefined }> {
  return reg
    .filter(p => p.apiFormat === "openai")
    .map(spec => {
      const key = spec.keyEnvVar ? (process.env[spec.keyEnvVar]?.trim() || undefined) : "none";
      const url = spec.baseUrl.replace(/\/$/, "") + "/chat/completions";
      return { name: spec.id, url, model: spec.model, key };
    });
}
