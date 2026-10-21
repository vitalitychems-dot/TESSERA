import { PROVIDER_REGISTRY } from "./knowledge-infra-archive";

let swarmRotation = 0;

const LOG_PREFIX = "[SwarmOptimizer]";
const _logThrottle: Map<string, number> = new Map();
const THROTTLE_MS = 60000;

function log(msg: string, force = false) {
  const key = msg.replace(/\d+(\.\d+)?/g, "N").substring(0, 60);
  const now = Date.now();
  if (!force) {
    const last = _logThrottle.get(key) || 0;
    if (now - last < THROTTLE_MS) return;
  }
  _logThrottle.set(key, now);
  if (_logThrottle.size > 200) {
    const entries = Array.from(_logThrottle.entries()).sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < 100; i++) _logThrottle.delete(entries[i][0]);
  }
  console.log(`${LOG_PREFIX} ${msg}`);
}

export type OptimizerCategory =
  | "NLU" | "NLG" | "Code Generation" | "Data Analysis" | "Strategic Planning"
  | "Economic Simulation" | "Cybersecurity" | "Creative Content" | "Autonomous Learning"
  | "Inter-Agent Communication" | "Ethical Reasoning" | "System Monitoring" | "UX Design"
  | "API Integration" | "Resource Optimization" | "Market Analysis" | "SEO/Marketing"
  | "Blockchain/Crypto" | "Risk Assessment" | "Knowledge Representation" | "Problem Solving"
  | "Emotional Intelligence" | "Social Dynamics" | "Governance" | "Hardware Interface"
  | "Real-time Processing" | "Error Handling" | "Scalability" | "Security Auditing"
  | "Compliance" | "Content Moderation" | "Personalization" | "Multi-modal Understanding"
  | "Time Series Analysis" | "Distributed Systems" | "Human-AI Collaboration"
  | "Crisis Management" | "Strategic Communication" | "Economic Resource Allocation"
  | "Self-Correction/Debugging";

export const ALL_CATEGORIES: OptimizerCategory[] = [
  "NLU", "NLG", "Code Generation", "Data Analysis", "Strategic Planning",
  "Economic Simulation", "Cybersecurity", "Creative Content", "Autonomous Learning",
  "Inter-Agent Communication", "Ethical Reasoning", "System Monitoring", "UX Design",
  "API Integration", "Resource Optimization", "Market Analysis", "SEO/Marketing",
  "Blockchain/Crypto", "Risk Assessment", "Knowledge Representation", "Problem Solving",
  "Emotional Intelligence", "Social Dynamics", "Governance", "Hardware Interface",
  "Real-time Processing", "Error Handling", "Scalability", "Security Auditing",
  "Compliance", "Content Moderation", "Personalization", "Multi-modal Understanding",
  "Time Series Analysis", "Distributed Systems", "Human-AI Collaboration",
  "Crisis Management", "Strategic Communication", "Economic Resource Allocation",
  "Self-Correction/Debugging",
];

export type ModelSource = "ollama" | "github-repo" | "api-provider" | "tessera-agent" | "moltbook-agent";

export interface CatalogEntry {
  id: string;
  name: string;
  source: ModelSource;
  group: string;
  description: string;
  tags: string[];
  available: boolean;
}

export interface PerformanceRecord {
  modelId: string;
  category: OptimizerCategory;
  score: number;
  timestamp: number;
  evaluationId: string;
}

export interface ModelScores {
  modelId: string;
  scores: Partial<Record<OptimizerCategory, number>>;
  history: PerformanceRecord[];
  avgScore: number;
  evaluationCount: number;
  lastEvaluated: number;
}

export interface CategoryRanking {
  category: OptimizerCategory;
  top5: Array<{ modelId: string; name: string; score: number }>;
  lastUpdated: number;
}

export interface OptimalAgentResult {
  category: OptimizerCategory;
  primary: { modelId: string; name: string; score: number } | null;
  fallbackChain: Array<{ modelId: string; name: string; score: number }>;
  confidence: number;
  reasoning: string;
}

export interface CompetitionRound {
  id: string;
  category: OptimizerCategory;
  prompt: string;
  participants: string[];
  results: Array<{ modelId: string; score: number; rank: number }>;
  votes: Array<{ voterId: string; rankings: string[] }>;
  consensusReached: boolean;
  consensusThreshold: number;
  timestamp: number;
}

export interface OptimizerState {
  initialized: boolean;
  catalog: CatalogEntry[];
  modelScores: Record<string, ModelScores>;
  categoryRankings: Record<OptimizerCategory, CategoryRanking>;
  competitions: CompetitionRound[];
  totalEvaluations: number;
  lastCompetitionRun: number;
}

const OLLAMA_MODELS: Array<{ id: string; name: string; tags: string[] }> = [
  { id: "llama3", name: "Llama 3", tags: ["meta", "general", "chat"] },
  { id: "llama3:8b", name: "Llama 3 8B", tags: ["meta", "lightweight", "chat"] },
  { id: "llama3:70b", name: "Llama 3 70B", tags: ["meta", "large", "reasoning"] },
  { id: "llama3.1", name: "Llama 3.1", tags: ["meta", "general", "instruction"] },
  { id: "llama3.1:8b", name: "Llama 3.1 8B", tags: ["meta", "lightweight"] },
  { id: "llama3.1:70b", name: "Llama 3.1 70B", tags: ["meta", "large"] },
  { id: "llama3.1:405b", name: "Llama 3.1 405B", tags: ["meta", "massive"] },
  { id: "llama3.2", name: "Llama 3.2", tags: ["meta", "latest"] },
  { id: "llama3.2:1b", name: "Llama 3.2 1B", tags: ["meta", "tiny"] },
  { id: "llama3.2:3b", name: "Llama 3.2 3B", tags: ["meta", "small"] },
  { id: "llama3.3", name: "Llama 3.3", tags: ["meta", "latest", "chat"] },
  { id: "llama3.3:70b", name: "Llama 3.3 70B", tags: ["meta", "large", "reasoning"] },
  { id: "llama4", name: "Llama 4", tags: ["meta", "next-gen"] },
  { id: "llama4:scout", name: "Llama 4 Scout", tags: ["meta", "moe"] },
  { id: "llama4:maverick", name: "Llama 4 Maverick", tags: ["meta", "moe", "large"] },
  { id: "mistral", name: "Mistral 7B", tags: ["mistral", "general", "fast"] },
  { id: "mistral:7b", name: "Mistral 7B Instruct", tags: ["mistral", "instruction"] },
  { id: "mistral-small", name: "Mistral Small", tags: ["mistral", "efficient"] },
  { id: "mistral-small:22b", name: "Mistral Small 22B", tags: ["mistral", "medium"] },
  { id: "mistral-small:24b", name: "Mistral Small 24B", tags: ["mistral", "medium"] },
  { id: "mistral-nemo", name: "Mistral Nemo", tags: ["mistral", "nemo"] },
  { id: "mistral-nemo:12b", name: "Mistral Nemo 12B", tags: ["mistral", "medium"] },
  { id: "mistral-large", name: "Mistral Large", tags: ["mistral", "large", "reasoning"] },
  { id: "mistral-large:123b", name: "Mistral Large 123B", tags: ["mistral", "massive"] },
  { id: "mixtral", name: "Mixtral 8x7B", tags: ["mistral", "moe", "versatile"] },
  { id: "mixtral:8x7b", name: "Mixtral 8x7B Instruct", tags: ["mistral", "moe"] },
  { id: "mixtral:8x22b", name: "Mixtral 8x22B", tags: ["mistral", "moe", "large"] },
  { id: "phi3", name: "Phi-3", tags: ["microsoft", "small", "efficient"] },
  { id: "phi3:mini", name: "Phi-3 Mini", tags: ["microsoft", "tiny"] },
  { id: "phi3:small", name: "Phi-3 Small", tags: ["microsoft", "small"] },
  { id: "phi3:medium", name: "Phi-3 Medium", tags: ["microsoft", "medium"] },
  { id: "phi3.5", name: "Phi-3.5", tags: ["microsoft", "latest"] },
  { id: "phi4", name: "Phi-4", tags: ["microsoft", "reasoning", "latest"] },
  { id: "phi4:14b", name: "Phi-4 14B", tags: ["microsoft", "medium", "reasoning"] },
  { id: "gemma", name: "Gemma", tags: ["google", "small", "efficient"] },
  { id: "gemma:2b", name: "Gemma 2B", tags: ["google", "tiny"] },
  { id: "gemma:7b", name: "Gemma 7B", tags: ["google", "small"] },
  { id: "gemma2", name: "Gemma 2", tags: ["google", "improved"] },
  { id: "gemma2:2b", name: "Gemma 2 2B", tags: ["google", "tiny"] },
  { id: "gemma2:9b", name: "Gemma 2 9B", tags: ["google", "medium"] },
  { id: "gemma2:27b", name: "Gemma 2 27B", tags: ["google", "large"] },
  { id: "gemma3", name: "Gemma 3", tags: ["google", "latest"] },
  { id: "gemma3:1b", name: "Gemma 3 1B", tags: ["google", "tiny"] },
  { id: "gemma3:4b", name: "Gemma 3 4B", tags: ["google", "small"] },
  { id: "gemma3:12b", name: "Gemma 3 12B", tags: ["google", "medium"] },
  { id: "gemma3:27b", name: "Gemma 3 27B", tags: ["google", "large"] },
  { id: "qwen", name: "Qwen", tags: ["alibaba", "multilingual"] },
  { id: "qwen:7b", name: "Qwen 7B", tags: ["alibaba", "small"] },
  { id: "qwen:14b", name: "Qwen 14B", tags: ["alibaba", "medium"] },
  { id: "qwen:72b", name: "Qwen 72B", tags: ["alibaba", "large"] },
  { id: "qwen2", name: "Qwen 2", tags: ["alibaba", "improved"] },
  { id: "qwen2:7b", name: "Qwen 2 7B", tags: ["alibaba", "small"] },
  { id: "qwen2:72b", name: "Qwen 2 72B", tags: ["alibaba", "large"] },
  { id: "qwen2.5", name: "Qwen 2.5", tags: ["alibaba", "latest"] },
  { id: "qwen2.5:0.5b", name: "Qwen 2.5 0.5B", tags: ["alibaba", "tiny"] },
  { id: "qwen2.5:1.5b", name: "Qwen 2.5 1.5B", tags: ["alibaba", "tiny"] },
  { id: "qwen2.5:3b", name: "Qwen 2.5 3B", tags: ["alibaba", "small"] },
  { id: "qwen2.5:7b", name: "Qwen 2.5 7B", tags: ["alibaba", "small"] },
  { id: "qwen2.5:14b", name: "Qwen 2.5 14B", tags: ["alibaba", "medium"] },
  { id: "qwen2.5:32b", name: "Qwen 2.5 32B", tags: ["alibaba", "large"] },
  { id: "qwen2.5:72b", name: "Qwen 2.5 72B", tags: ["alibaba", "large"] },
  { id: "qwen2.5-coder", name: "Qwen 2.5 Coder", tags: ["alibaba", "code"] },
  { id: "qwen2.5-coder:1.5b", name: "Qwen 2.5 Coder 1.5B", tags: ["alibaba", "code", "tiny"] },
  { id: "qwen2.5-coder:3b", name: "Qwen 2.5 Coder 3B", tags: ["alibaba", "code", "small"] },
  { id: "qwen2.5-coder:7b", name: "Qwen 2.5 Coder 7B", tags: ["alibaba", "code", "small"] },
  { id: "qwen2.5-coder:14b", name: "Qwen 2.5 Coder 14B", tags: ["alibaba", "code", "medium"] },
  { id: "qwen2.5-coder:32b", name: "Qwen 2.5 Coder 32B", tags: ["alibaba", "code", "large"] },
  { id: "qwen3", name: "Qwen 3", tags: ["alibaba", "next-gen"] },
  { id: "qwen3:0.6b", name: "Qwen 3 0.6B", tags: ["alibaba", "tiny"] },
  { id: "qwen3:1.7b", name: "Qwen 3 1.7B", tags: ["alibaba", "tiny"] },
  { id: "qwen3:4b", name: "Qwen 3 4B", tags: ["alibaba", "small"] },
  { id: "qwen3:8b", name: "Qwen 3 8B", tags: ["alibaba", "small"] },
  { id: "qwen3:14b", name: "Qwen 3 14B", tags: ["alibaba", "medium"] },
  { id: "qwen3:30b", name: "Qwen 3 30B", tags: ["alibaba", "large"] },
  { id: "qwen3:32b", name: "Qwen 3 32B", tags: ["alibaba", "large"] },
  { id: "qwen3:235b", name: "Qwen 3 235B", tags: ["alibaba", "massive", "moe"] },
  { id: "deepseek-coder", name: "DeepSeek Coder", tags: ["deepseek", "code"] },
  { id: "deepseek-coder:1.3b", name: "DeepSeek Coder 1.3B", tags: ["deepseek", "code", "tiny"] },
  { id: "deepseek-coder:6.7b", name: "DeepSeek Coder 6.7B", tags: ["deepseek", "code", "small"] },
  { id: "deepseek-coder:33b", name: "DeepSeek Coder 33B", tags: ["deepseek", "code", "large"] },
  { id: "deepseek-coder-v2", name: "DeepSeek Coder V2", tags: ["deepseek", "code", "moe"] },
  { id: "deepseek-coder-v2:16b", name: "DeepSeek Coder V2 16B", tags: ["deepseek", "code"] },
  { id: "deepseek-coder-v2:236b", name: "DeepSeek Coder V2 236B", tags: ["deepseek", "code", "massive"] },
  { id: "deepseek-v2", name: "DeepSeek V2", tags: ["deepseek", "moe"] },
  { id: "deepseek-v2:16b", name: "DeepSeek V2 16B", tags: ["deepseek", "efficient"] },
  { id: "deepseek-v2:236b", name: "DeepSeek V2 236B", tags: ["deepseek", "massive"] },
  { id: "deepseek-v2.5", name: "DeepSeek V2.5", tags: ["deepseek", "improved"] },
  { id: "deepseek-v3", name: "DeepSeek V3", tags: ["deepseek", "latest", "moe"] },
  { id: "deepseek-r1", name: "DeepSeek R1", tags: ["deepseek", "reasoning"] },
  { id: "deepseek-r1:1.5b", name: "DeepSeek R1 1.5B", tags: ["deepseek", "reasoning", "tiny"] },
  { id: "deepseek-r1:7b", name: "DeepSeek R1 7B", tags: ["deepseek", "reasoning", "small"] },
  { id: "deepseek-r1:8b", name: "DeepSeek R1 8B", tags: ["deepseek", "reasoning", "small"] },
  { id: "deepseek-r1:14b", name: "DeepSeek R1 14B", tags: ["deepseek", "reasoning", "medium"] },
  { id: "deepseek-r1:32b", name: "DeepSeek R1 32B", tags: ["deepseek", "reasoning", "large"] },
  { id: "deepseek-r1:70b", name: "DeepSeek R1 70B", tags: ["deepseek", "reasoning", "large"] },
  { id: "deepseek-r1:671b", name: "DeepSeek R1 671B", tags: ["deepseek", "reasoning", "massive"] },
  { id: "codellama", name: "Code Llama", tags: ["meta", "code"] },
  { id: "codellama:7b", name: "Code Llama 7B", tags: ["meta", "code", "small"] },
  { id: "codellama:13b", name: "Code Llama 13B", tags: ["meta", "code", "medium"] },
  { id: "codellama:34b", name: "Code Llama 34B", tags: ["meta", "code", "large"] },
  { id: "codellama:70b", name: "Code Llama 70B", tags: ["meta", "code", "large"] },
  { id: "wizard-vicuna", name: "Wizard Vicuna", tags: ["wizard", "chat"] },
  { id: "wizardlm2", name: "WizardLM 2", tags: ["wizard", "instruction"] },
  { id: "wizardlm2:7b", name: "WizardLM 2 7B", tags: ["wizard", "instruction"] },
  { id: "wizardlm2:8x22b", name: "WizardLM 2 8x22B", tags: ["wizard", "moe"] },
  { id: "wizardcoder", name: "WizardCoder", tags: ["wizard", "code"] },
  { id: "wizardcoder:33b", name: "WizardCoder 33B", tags: ["wizard", "code", "large"] },
  { id: "wizardmath", name: "WizardMath", tags: ["wizard", "math"] },
  { id: "neural-chat", name: "Neural Chat", tags: ["intel", "chat", "conversation"] },
  { id: "neural-chat:7b", name: "Neural Chat 7B", tags: ["intel", "chat"] },
  { id: "openchat", name: "OpenChat", tags: ["openchat", "chat", "conversation"] },
  { id: "openchat:7b", name: "OpenChat 7B", tags: ["openchat", "chat"] },
  { id: "openchat:3.5", name: "OpenChat 3.5", tags: ["openchat", "improved"] },
  { id: "starling-lm", name: "Starling LM", tags: ["starling", "rlhf", "chat"] },
  { id: "starling-lm:7b", name: "Starling LM 7B", tags: ["starling", "chat"] },
  { id: "yi", name: "Yi", tags: ["01ai", "bilingual"] },
  { id: "yi:6b", name: "Yi 6B", tags: ["01ai", "small"] },
  { id: "yi:34b", name: "Yi 34B", tags: ["01ai", "large"] },
  { id: "yi-coder", name: "Yi Coder", tags: ["01ai", "code"] },
  { id: "yi-coder:9b", name: "Yi Coder 9B", tags: ["01ai", "code"] },
  { id: "solar", name: "Solar", tags: ["upstage", "instruction"] },
  { id: "solar:10.7b", name: "Solar 10.7B", tags: ["upstage", "medium"] },
  { id: "command-r", name: "Command R", tags: ["cohere", "rag", "retrieval"] },
  { id: "command-r:35b", name: "Command R 35B", tags: ["cohere", "rag"] },
  { id: "command-r-plus", name: "Command R+", tags: ["cohere", "rag", "large"] },
  { id: "command-r-plus:104b", name: "Command R+ 104B", tags: ["cohere", "large"] },
  { id: "starcoder2", name: "StarCoder 2", tags: ["bigcode", "code"] },
  { id: "starcoder2:3b", name: "StarCoder 2 3B", tags: ["bigcode", "code", "small"] },
  { id: "starcoder2:7b", name: "StarCoder 2 7B", tags: ["bigcode", "code"] },
  { id: "starcoder2:15b", name: "StarCoder 2 15B", tags: ["bigcode", "code", "large"] },
  { id: "codegemma", name: "CodeGemma", tags: ["google", "code"] },
  { id: "codegemma:2b", name: "CodeGemma 2B", tags: ["google", "code", "tiny"] },
  { id: "codegemma:7b", name: "CodeGemma 7B", tags: ["google", "code"] },
  { id: "dolphin-mixtral", name: "Dolphin Mixtral", tags: ["dolphin", "uncensored", "moe"] },
  { id: "dolphin-llama3", name: "Dolphin Llama 3", tags: ["dolphin", "uncensored"] },
  { id: "dolphin-phi", name: "Dolphin Phi", tags: ["dolphin", "small"] },
  { id: "nous-hermes2", name: "Nous Hermes 2", tags: ["nous", "instruction"] },
  { id: "nous-hermes2:34b", name: "Nous Hermes 2 34B", tags: ["nous", "large"] },
  { id: "nous-hermes2-mixtral", name: "Nous Hermes 2 Mixtral", tags: ["nous", "moe"] },
  { id: "hermes3", name: "Hermes 3", tags: ["nous", "latest", "function-calling"] },
  { id: "hermes3:8b", name: "Hermes 3 8B", tags: ["nous", "small"] },
  { id: "hermes3:70b", name: "Hermes 3 70B", tags: ["nous", "large"] },
  { id: "hermes3:405b", name: "Hermes 3 405B", tags: ["nous", "massive"] },
  { id: "vicuna", name: "Vicuna", tags: ["lmsys", "chat"] },
  { id: "vicuna:7b", name: "Vicuna 7B", tags: ["lmsys", "chat", "small"] },
  { id: "vicuna:13b", name: "Vicuna 13B", tags: ["lmsys", "chat", "medium"] },
  { id: "orca-mini", name: "Orca Mini", tags: ["orca", "reasoning", "small"] },
  { id: "orca-mini:3b", name: "Orca Mini 3B", tags: ["orca", "tiny"] },
  { id: "orca-mini:7b", name: "Orca Mini 7B", tags: ["orca", "small"] },
  { id: "orca2", name: "Orca 2", tags: ["microsoft", "reasoning"] },
  { id: "orca2:7b", name: "Orca 2 7B", tags: ["microsoft", "reasoning"] },
  { id: "orca2:13b", name: "Orca 2 13B", tags: ["microsoft", "reasoning"] },
  { id: "falcon", name: "Falcon", tags: ["tii", "general"] },
  { id: "falcon:7b", name: "Falcon 7B", tags: ["tii", "small"] },
  { id: "falcon:40b", name: "Falcon 40B", tags: ["tii", "large"] },
  { id: "falcon2", name: "Falcon 2", tags: ["tii", "improved"] },
  { id: "falcon2:11b", name: "Falcon 2 11B", tags: ["tii", "medium"] },
  { id: "llava", name: "LLaVA", tags: ["multimodal", "vision"] },
  { id: "llava:7b", name: "LLaVA 7B", tags: ["multimodal", "vision"] },
  { id: "llava:13b", name: "LLaVA 13B", tags: ["multimodal", "vision"] },
  { id: "llava:34b", name: "LLaVA 34B", tags: ["multimodal", "vision", "large"] },
  { id: "llava-phi3", name: "LLaVA Phi-3", tags: ["multimodal", "vision", "efficient"] },
  { id: "bakllava", name: "BakLLaVA", tags: ["multimodal", "vision"] },
  { id: "moondream", name: "Moondream", tags: ["multimodal", "vision", "tiny"] },
  { id: "moondream2", name: "Moondream 2", tags: ["multimodal", "vision", "tiny"] },
  { id: "tinyllama", name: "TinyLlama", tags: ["tiny", "efficient", "edge"] },
  { id: "tinydolphin", name: "TinyDolphin", tags: ["tiny", "efficient"] },
  { id: "stablelm2", name: "StableLM 2", tags: ["stability", "chat"] },
  { id: "stablelm2:1.6b", name: "StableLM 2 1.6B", tags: ["stability", "tiny"] },
  { id: "stablelm2:12b", name: "StableLM 2 12B", tags: ["stability", "medium"] },
  { id: "stable-code", name: "Stable Code", tags: ["stability", "code"] },
  { id: "stable-code:3b", name: "Stable Code 3B", tags: ["stability", "code", "small"] },
  { id: "zephyr", name: "Zephyr", tags: ["huggingface", "aligned", "chat"] },
  { id: "zephyr:7b", name: "Zephyr 7B", tags: ["huggingface", "chat"] },
  { id: "openhermes", name: "OpenHermes", tags: ["openhermes", "instruction"] },
  { id: "openhermes:7b", name: "OpenHermes 7B", tags: ["openhermes", "instruction"] },
  { id: "openhermes2.5-mistral", name: "OpenHermes 2.5 Mistral", tags: ["openhermes", "mistral"] },
  { id: "nemotron", name: "Nemotron", tags: ["nvidia", "instruction"] },
  { id: "nemotron:70b", name: "Nemotron 70B", tags: ["nvidia", "large"] },
  { id: "nemotron-mini", name: "Nemotron Mini", tags: ["nvidia", "small"] },
  { id: "nemotron-nano", name: "Nemotron Nano", tags: ["nvidia", "tiny", "edge"] },
  { id: "granite-code", name: "Granite Code", tags: ["ibm", "code", "enterprise"] },
  { id: "granite-code:3b", name: "Granite Code 3B", tags: ["ibm", "code", "small"] },
  { id: "granite-code:8b", name: "Granite Code 8B", tags: ["ibm", "code"] },
  { id: "granite-code:20b", name: "Granite Code 20B", tags: ["ibm", "code", "large"] },
  { id: "granite-code:34b", name: "Granite Code 34B", tags: ["ibm", "code", "large"] },
  { id: "granite3", name: "Granite 3", tags: ["ibm", "enterprise", "latest"] },
  { id: "granite3:2b", name: "Granite 3 2B", tags: ["ibm", "small"] },
  { id: "granite3:8b", name: "Granite 3 8B", tags: ["ibm", "medium"] },
  { id: "internlm2", name: "InternLM 2", tags: ["shanghai-ai", "multilingual"] },
  { id: "internlm2:7b", name: "InternLM 2 7B", tags: ["shanghai-ai", "small"] },
  { id: "internlm2:20b", name: "InternLM 2 20B", tags: ["shanghai-ai", "large"] },
  { id: "glm4", name: "GLM-4", tags: ["zhipu", "bilingual"] },
  { id: "glm4:9b", name: "GLM-4 9B", tags: ["zhipu", "medium"] },
  { id: "codeqwen", name: "CodeQwen", tags: ["alibaba", "code"] },
  { id: "codeqwen:7b", name: "CodeQwen 7B", tags: ["alibaba", "code"] },
  { id: "codestral", name: "Codestral", tags: ["mistral", "code", "latest"] },
  { id: "codestral:22b", name: "Codestral 22B", tags: ["mistral", "code"] },
  { id: "mathstral", name: "Mathstral", tags: ["mistral", "math"] },
  { id: "mathstral:7b", name: "Mathstral 7B", tags: ["mistral", "math"] },
  { id: "smollm", name: "SmolLM", tags: ["huggingface", "tiny", "edge"] },
  { id: "smollm:135m", name: "SmolLM 135M", tags: ["huggingface", "tiny"] },
  { id: "smollm:360m", name: "SmolLM 360M", tags: ["huggingface", "tiny"] },
  { id: "smollm:1.7b", name: "SmolLM 1.7B", tags: ["huggingface", "small"] },
  { id: "smollm2", name: "SmolLM 2", tags: ["huggingface", "tiny", "edge", "latest"] },
  { id: "nomic-embed-text", name: "Nomic Embed Text", tags: ["embedding", "retrieval"] },
  { id: "mxbai-embed-large", name: "MxBAI Embed Large", tags: ["embedding", "retrieval"] },
  { id: "all-minilm", name: "All MiniLM", tags: ["embedding", "sentence"] },
  { id: "snowflake-arctic-embed", name: "Snowflake Arctic Embed", tags: ["embedding", "retrieval"] },
  { id: "bge-m3", name: "BGE M3", tags: ["embedding", "multilingual"] },
  { id: "llama-guard3", name: "Llama Guard 3", tags: ["meta", "safety", "moderation"] },
  { id: "shieldgemma", name: "ShieldGemma", tags: ["google", "safety", "moderation"] },
  { id: "reader-lm", name: "Reader LM", tags: ["jina", "reading", "extraction"] },
  { id: "reader-lm:0.5b", name: "Reader LM 0.5B", tags: ["jina", "tiny"] },
  { id: "reader-lm:1.5b", name: "Reader LM 1.5B", tags: ["jina", "small"] },
  { id: "everythinglm", name: "EverythingLM", tags: ["general", "versatile"] },
  { id: "meditron", name: "Meditron", tags: ["medical", "healthcare"] },
  { id: "meditron:7b", name: "Meditron 7B", tags: ["medical", "small"] },
  { id: "meditron:70b", name: "Meditron 70B", tags: ["medical", "large"] },
  { id: "medllama2", name: "MedLlama 2", tags: ["medical", "healthcare"] },
  { id: "sqlcoder", name: "SQLCoder", tags: ["sql", "database", "code"] },
  { id: "sqlcoder:7b", name: "SQLCoder 7B", tags: ["sql", "code"] },
  { id: "sqlcoder:15b", name: "SQLCoder 15B", tags: ["sql", "code"] },
  { id: "magicoder", name: "MagiCoder", tags: ["code", "instruction"] },
  { id: "magicoder:7b", name: "MagiCoder 7B", tags: ["code", "small"] },
  { id: "phind-codellama", name: "Phind Code Llama", tags: ["phind", "code"] },
  { id: "phind-codellama:34b", name: "Phind Code Llama 34B", tags: ["phind", "code", "large"] },
  { id: "nexusraven", name: "NexusRaven", tags: ["function-calling", "tools"] },
  { id: "samantha-mistral", name: "Samantha Mistral", tags: ["companion", "empathetic"] },
  { id: "xwinlm", name: "XWinLM", tags: ["xwin", "chat"] },
  { id: "yarn-llama2", name: "Yarn Llama 2", tags: ["long-context", "extended"] },
  { id: "yarn-mistral", name: "Yarn Mistral", tags: ["long-context", "extended"] },
  { id: "mistrallite", name: "MistralLite", tags: ["mistral", "long-context"] },
  { id: "goliath", name: "Goliath", tags: ["merged", "large"] },
  { id: "notux", name: "Notux", tags: ["merged", "moe"] },
  { id: "dbrx", name: "DBRX", tags: ["databricks", "moe", "enterprise"] },
  { id: "dbrx:132b", name: "DBRX 132B", tags: ["databricks", "moe", "large"] },
  { id: "nous-hermes-pro", name: "Nous Hermes Pro", tags: ["nous", "pro"] },
  { id: "megadolphin", name: "MegaDolphin", tags: ["dolphin", "merged", "large"] },
  { id: "dolphin-mistral", name: "Dolphin Mistral", tags: ["dolphin", "uncensored"] },
  { id: "aya", name: "Aya", tags: ["cohere", "multilingual"] },
  { id: "aya:8b", name: "Aya 8B", tags: ["cohere", "multilingual"] },
  { id: "aya:35b", name: "Aya 35B", tags: ["cohere", "multilingual", "large"] },
  { id: "llama-pro", name: "Llama Pro", tags: ["meta", "extended"] },
  { id: "fixt/home-3b-v3", name: "Fixt Home 3B V3", tags: ["fixt", "small"] },
  { id: "mannix/llama3.1-8b-lexi", name: "Lexi Llama 3.1", tags: ["community", "lexical"] },
];

const GITHUB_REPO_MODELS: Array<{ id: string; name: string; tags: string[] }> = [
  { id: "gh-repo-llama-cpp", name: "llama.cpp", tags: ["inference", "c++", "quantization"] },
  { id: "gh-repo-ollama", name: "Ollama", tags: ["inference", "local", "go"] },
  { id: "gh-repo-vllm", name: "vLLM", tags: ["inference", "serving", "python"] },
  { id: "gh-repo-text-gen-webui", name: "Text Generation WebUI", tags: ["ui", "inference"] },
  { id: "gh-repo-localai", name: "LocalAI", tags: ["inference", "local", "api"] },
  { id: "gh-repo-gpt4all", name: "GPT4All", tags: ["inference", "local", "desktop"] },
  { id: "gh-repo-lmstudio", name: "LM Studio", tags: ["inference", "desktop", "gui"] },
  { id: "gh-repo-mlc-llm", name: "MLC LLM", tags: ["inference", "compilation", "mobile"] },
  { id: "gh-repo-exllama", name: "ExLlama", tags: ["inference", "quantization", "fast"] },
  { id: "gh-repo-exllamav2", name: "ExLlamaV2", tags: ["inference", "quantization"] },
  { id: "gh-repo-ctransformers", name: "CTransformers", tags: ["inference", "python", "ggml"] },
  { id: "gh-repo-tgi", name: "TGI (HuggingFace)", tags: ["inference", "serving"] },
  { id: "gh-repo-transformers", name: "HuggingFace Transformers", tags: ["ml", "framework"] },
  { id: "gh-repo-langchain", name: "LangChain", tags: ["orchestration", "agents", "rag"] },
  { id: "gh-repo-llamaindex", name: "LlamaIndex", tags: ["rag", "indexing", "retrieval"] },
  { id: "gh-repo-autogpt", name: "AutoGPT", tags: ["autonomous", "agents", "planning"] },
  { id: "gh-repo-babyagi", name: "BabyAGI", tags: ["autonomous", "task-planning"] },
  { id: "gh-repo-metagpt", name: "MetaGPT", tags: ["multi-agent", "software-dev"] },
  { id: "gh-repo-crewai", name: "CrewAI", tags: ["multi-agent", "orchestration"] },
  { id: "gh-repo-autogen", name: "AutoGen", tags: ["multi-agent", "microsoft", "conversation"] },
  { id: "gh-repo-camel", name: "CAMEL", tags: ["multi-agent", "role-playing"] },
  { id: "gh-repo-chatdev", name: "ChatDev", tags: ["multi-agent", "software-dev"] },
  { id: "gh-repo-agentgpt", name: "AgentGPT", tags: ["autonomous", "web-based"] },
  { id: "gh-repo-superagi", name: "SuperAGI", tags: ["autonomous", "framework"] },
  { id: "gh-repo-open-interpreter", name: "Open Interpreter", tags: ["code-execution", "local"] },
  { id: "gh-repo-phidata", name: "Phidata", tags: ["agents", "tools", "memory"] },
  { id: "gh-repo-dspy", name: "DSPy", tags: ["programming-framework", "optimization"] },
  { id: "gh-repo-guidance", name: "Guidance", tags: ["structured-output", "microsoft"] },
  { id: "gh-repo-outlines", name: "Outlines", tags: ["structured-output", "json"] },
  { id: "gh-repo-instructor", name: "Instructor", tags: ["structured-output", "pydantic"] },
  { id: "gh-repo-semantic-kernel", name: "Semantic Kernel", tags: ["microsoft", "orchestration"] },
  { id: "gh-repo-haystack", name: "Haystack", tags: ["rag", "pipelines", "deepset"] },
  { id: "gh-repo-chromadb", name: "ChromaDB", tags: ["vector-db", "embedding"] },
  { id: "gh-repo-weaviate", name: "Weaviate", tags: ["vector-db", "search"] },
  { id: "gh-repo-qdrant", name: "Qdrant", tags: ["vector-db", "rust"] },
  { id: "gh-repo-milvus", name: "Milvus", tags: ["vector-db", "scalable"] },
  { id: "gh-repo-pinecone-client", name: "Pinecone Client", tags: ["vector-db", "cloud"] },
  { id: "gh-repo-faiss", name: "FAISS", tags: ["vector-search", "meta", "gpu"] },
  { id: "gh-repo-pytorch", name: "PyTorch", tags: ["ml-framework", "training", "meta"] },
  { id: "gh-repo-tensorflow", name: "TensorFlow", tags: ["ml-framework", "training", "google"] },
  { id: "gh-repo-jax", name: "JAX", tags: ["ml-framework", "google", "functional"] },
  { id: "gh-repo-keras", name: "Keras", tags: ["ml-framework", "high-level"] },
  { id: "gh-repo-onnxruntime", name: "ONNX Runtime", tags: ["inference", "cross-platform"] },
  { id: "gh-repo-triton", name: "Triton Inference Server", tags: ["serving", "nvidia", "enterprise"] },
  { id: "gh-repo-trl", name: "TRL", tags: ["rlhf", "training", "alignment"] },
  { id: "gh-repo-peft", name: "PEFT", tags: ["fine-tuning", "lora", "efficient"] },
  { id: "gh-repo-axolotl", name: "Axolotl", tags: ["fine-tuning", "training"] },
  { id: "gh-repo-unsloth", name: "Unsloth", tags: ["fine-tuning", "fast", "efficient"] },
  { id: "gh-repo-llama-factory", name: "LLaMA Factory", tags: ["fine-tuning", "gui"] },
  { id: "gh-repo-litgpt", name: "LitGPT", tags: ["training", "lightning"] },
  { id: "gh-repo-gpt-neox", name: "GPT-NeoX", tags: ["training", "eleuther"] },
  { id: "gh-repo-megatron-lm", name: "Megatron-LM", tags: ["training", "nvidia", "distributed"] },
  { id: "gh-repo-deepspeed", name: "DeepSpeed", tags: ["training", "microsoft", "distributed"] },
  { id: "gh-repo-colossalai", name: "ColossalAI", tags: ["training", "distributed", "efficient"] },
  { id: "gh-repo-stable-diffusion", name: "Stable Diffusion", tags: ["image-gen", "diffusion"] },
  { id: "gh-repo-sdxl", name: "SDXL", tags: ["image-gen", "diffusion", "large"] },
  { id: "gh-repo-flux", name: "FLUX", tags: ["image-gen", "bfl", "latest"] },
  { id: "gh-repo-comfyui", name: "ComfyUI", tags: ["image-gen", "workflow", "gui"] },
  { id: "gh-repo-automatic1111", name: "AUTOMATIC1111 WebUI", tags: ["image-gen", "gui"] },
  { id: "gh-repo-fooocus", name: "Fooocus", tags: ["image-gen", "simple"] },
  { id: "gh-repo-dall-e", name: "DALL-E", tags: ["image-gen", "openai"] },
  { id: "gh-repo-midjourney-api", name: "Midjourney API", tags: ["image-gen", "api"] },
  { id: "gh-repo-whisper", name: "Whisper", tags: ["speech-to-text", "openai"] },
  { id: "gh-repo-faster-whisper", name: "Faster Whisper", tags: ["speech-to-text", "fast"] },
  { id: "gh-repo-bark", name: "Bark", tags: ["text-to-speech", "suno"] },
  { id: "gh-repo-tortoise-tts", name: "Tortoise TTS", tags: ["text-to-speech", "quality"] },
  { id: "gh-repo-coqui-tts", name: "Coqui TTS", tags: ["text-to-speech", "multilingual"] },
  { id: "gh-repo-openvoice", name: "OpenVoice", tags: ["voice-clone", "multilingual"] },
  { id: "gh-repo-rvc", name: "RVC", tags: ["voice-conversion", "realtime"] },
  { id: "gh-repo-chatgpt-clone", name: "ChatGPT Clone", tags: ["ui", "chat-interface"] },
  { id: "gh-repo-lobe-chat", name: "LobeChat", tags: ["ui", "chat-interface", "extensible"] },
  { id: "gh-repo-chatbot-ui", name: "Chatbot UI", tags: ["ui", "chat-interface"] },
  { id: "gh-repo-big-agi", name: "Big-AGI", tags: ["ui", "chat-interface", "multi-model"] },
  { id: "gh-repo-open-webui", name: "Open WebUI", tags: ["ui", "ollama", "interface"] },
  { id: "gh-repo-jan", name: "Jan", tags: ["desktop", "local", "inference"] },
  { id: "gh-repo-anything-llm", name: "AnythingLLM", tags: ["rag", "documents", "full-stack"] },
  { id: "gh-repo-quivr", name: "Quivr", tags: ["rag", "second-brain"] },
  { id: "gh-repo-private-gpt", name: "PrivateGPT", tags: ["rag", "private", "local"] },
  { id: "gh-repo-danswer", name: "Danswer", tags: ["rag", "enterprise", "search"] },
  { id: "gh-repo-ragflow", name: "RAGFlow", tags: ["rag", "workflow", "deepdoc"] },
  { id: "gh-repo-bisheng", name: "Bisheng", tags: ["rag", "enterprise", "chinese"] },
  { id: "gh-repo-flowise", name: "Flowise", tags: ["low-code", "langchain", "gui"] },
  { id: "gh-repo-langflow", name: "Langflow", tags: ["low-code", "visual", "pipelines"] },
  { id: "gh-repo-promptflow", name: "PromptFlow", tags: ["microsoft", "pipelines"] },
  { id: "gh-repo-bentoml", name: "BentoML", tags: ["serving", "deployment"] },
  { id: "gh-repo-ray-serve", name: "Ray Serve", tags: ["serving", "distributed"] },
  { id: "gh-repo-litellm", name: "LiteLLM", tags: ["proxy", "unified-api"] },
  { id: "gh-repo-openrouter-client", name: "OpenRouter Client", tags: ["proxy", "routing"] },
  { id: "gh-repo-embedchain", name: "Embedchain", tags: ["rag", "embeddings", "simple"] },
  { id: "gh-repo-mindsdb", name: "MindsDB", tags: ["ml-in-database", "sql"] },
  { id: "gh-repo-gptscript", name: "GPTScript", tags: ["scripting", "tools"] },
  { id: "gh-repo-fabric", name: "Fabric", tags: ["prompt-patterns", "cli"] },
  { id: "gh-repo-aider", name: "Aider", tags: ["coding-assistant", "git"] },
  { id: "gh-repo-continue", name: "Continue", tags: ["coding-assistant", "ide"] },
  { id: "gh-repo-cursor-api", name: "Cursor API", tags: ["coding-assistant", "api"] },
  { id: "gh-repo-tabby", name: "Tabby", tags: ["code-completion", "self-hosted"] },
  { id: "gh-repo-codeium", name: "Codeium", tags: ["code-completion", "free"] },
  { id: "gh-repo-copilot-cli", name: "Copilot CLI", tags: ["cli", "code", "github"] },
  { id: "gh-repo-sourcegraph", name: "Sourcegraph Cody", tags: ["code-search", "ai"] },
  { id: "gh-repo-sweep", name: "Sweep", tags: ["coding-agent", "github"] },
  { id: "gh-repo-swe-agent", name: "SWE-Agent", tags: ["coding-agent", "benchmark"] },
  { id: "gh-repo-devika", name: "Devika", tags: ["coding-agent", "autonomous"] },
  { id: "gh-repo-opendevin", name: "OpenDevin", tags: ["coding-agent", "autonomous"] },
  { id: "gh-repo-gpt-engineer", name: "GPT Engineer", tags: ["coding-agent", "generation"] },
  { id: "gh-repo-smol-developer", name: "Smol Developer", tags: ["coding-agent", "simple"] },
  { id: "gh-repo-screenshot-to-code", name: "Screenshot to Code", tags: ["vision", "code-gen"] },
  { id: "gh-repo-draw-a-ui", name: "Draw a UI", tags: ["vision", "ui-gen"] },
  { id: "gh-repo-gpt-pilot", name: "GPT Pilot", tags: ["coding-agent", "full-stack"] },
  { id: "gh-repo-e2b", name: "E2B", tags: ["code-execution", "sandbox"] },
  { id: "gh-repo-modal", name: "Modal", tags: ["serverless", "gpu", "python"] },
  { id: "gh-repo-replicate-client", name: "Replicate Client", tags: ["inference", "api", "cloud"] },
  { id: "gh-repo-together-client", name: "Together Client", tags: ["inference", "api"] },
  { id: "gh-repo-anyscale", name: "Anyscale", tags: ["inference", "ray", "serving"] },
  { id: "gh-repo-fireworks-client", name: "Fireworks Client", tags: ["inference", "api", "fast"] },
  { id: "gh-repo-perplexity-client", name: "Perplexity Client", tags: ["search", "api"] },
  { id: "gh-repo-serper", name: "Serper", tags: ["search", "google", "api"] },
  { id: "gh-repo-tavily", name: "Tavily", tags: ["search", "ai-native"] },
  { id: "gh-repo-mem0", name: "Mem0", tags: ["memory", "personalization"] },
  { id: "gh-repo-letta", name: "Letta (MemGPT)", tags: ["memory", "long-term"] },
  { id: "gh-repo-chainlit", name: "Chainlit", tags: ["ui", "conversational", "python"] },
  { id: "gh-repo-streamlit", name: "Streamlit", tags: ["ui", "data-apps", "python"] },
  { id: "gh-repo-gradio", name: "Gradio", tags: ["ui", "demo", "python"] },
  { id: "gh-repo-vercel-ai", name: "Vercel AI SDK", tags: ["sdk", "streaming", "react"] },
  { id: "gh-repo-ai-sdk", name: "AI SDK", tags: ["sdk", "typescript", "unified"] },
  { id: "gh-repo-magentic", name: "Magentic", tags: ["python", "decorators", "llm"] },
  { id: "gh-repo-marvin", name: "Marvin", tags: ["python", "ai-functions"] },
  { id: "gh-repo-mirascope", name: "Mirascope", tags: ["python", "llm", "toolkit"] },
  { id: "gh-repo-guardrails", name: "Guardrails AI", tags: ["validation", "safety"] },
  { id: "gh-repo-nemo-guardrails", name: "NeMo Guardrails", tags: ["nvidia", "safety", "rails"] },
  { id: "gh-repo-llm-guard", name: "LLM Guard", tags: ["security", "safety", "scanning"] },
  { id: "gh-repo-rebuff", name: "Rebuff", tags: ["prompt-injection", "security"] },
  { id: "gh-repo-promptfoo", name: "Promptfoo", tags: ["evaluation", "testing"] },
  { id: "gh-repo-ragas", name: "RAGAS", tags: ["evaluation", "rag"] },
  { id: "gh-repo-deepeval", name: "DeepEval", tags: ["evaluation", "testing"] },
  { id: "gh-repo-phoenix", name: "Phoenix", tags: ["observability", "tracing"] },
  { id: "gh-repo-langfuse", name: "Langfuse", tags: ["observability", "tracing", "analytics"] },
  { id: "gh-repo-langsmith", name: "LangSmith", tags: ["observability", "langchain"] },
  { id: "gh-repo-helicone", name: "Helicone", tags: ["observability", "logging", "proxy"] },
  { id: "gh-repo-openllmetry", name: "OpenLLMetry", tags: ["observability", "opentelemetry"] },
  { id: "gh-repo-weights-biases", name: "Weights & Biases", tags: ["experiment-tracking", "ml"] },
  { id: "gh-repo-mlflow", name: "MLflow", tags: ["experiment-tracking", "deployment"] },
  { id: "gh-repo-label-studio", name: "Label Studio", tags: ["annotation", "data-labeling"] },
  { id: "gh-repo-argilla", name: "Argilla", tags: ["annotation", "rlhf-data"] },
  { id: "gh-repo-spacy", name: "spaCy", tags: ["nlp", "ner", "pipeline"] },
  { id: "gh-repo-nltk", name: "NLTK", tags: ["nlp", "text-processing"] },
  { id: "gh-repo-sentence-transformers", name: "Sentence Transformers", tags: ["embeddings", "similarity"] },
  { id: "gh-repo-detectron2", name: "Detectron2", tags: ["computer-vision", "object-detection"] },
  { id: "gh-repo-ultralytics", name: "Ultralytics (YOLOv8)", tags: ["computer-vision", "detection"] },
  { id: "gh-repo-segment-anything", name: "Segment Anything", tags: ["computer-vision", "segmentation"] },
  { id: "gh-repo-groundingdino", name: "Grounding DINO", tags: ["computer-vision", "grounding"] },
  { id: "gh-repo-clip", name: "CLIP", tags: ["multimodal", "vision-language"] },
  { id: "gh-repo-blip2", name: "BLIP-2", tags: ["multimodal", "captioning"] },
  { id: "gh-repo-cogvlm", name: "CogVLM", tags: ["multimodal", "vision-language"] },
  { id: "gh-repo-internvl", name: "InternVL", tags: ["multimodal", "vision", "large"] },
  { id: "gh-repo-fuyu", name: "Fuyu", tags: ["multimodal", "vision", "adept"] },
  { id: "gh-repo-nougat", name: "Nougat", tags: ["ocr", "document", "academic"] },
  { id: "gh-repo-doctr", name: "docTR", tags: ["ocr", "document"] },
  { id: "gh-repo-surya", name: "Surya", tags: ["ocr", "multilingual"] },
  { id: "gh-repo-marker", name: "Marker", tags: ["pdf", "conversion", "markdown"] },
  { id: "gh-repo-camelot", name: "Camelot", tags: ["pdf", "table-extraction"] },
  { id: "gh-repo-unstructured", name: "Unstructured", tags: ["document", "parsing", "etl"] },
  { id: "gh-repo-docling", name: "Docling", tags: ["document", "understanding"] },
  { id: "gh-repo-openai-python", name: "OpenAI Python", tags: ["sdk", "openai"] },
  { id: "gh-repo-anthropic-sdk", name: "Anthropic SDK", tags: ["sdk", "anthropic"] },
  { id: "gh-repo-cohere-python", name: "Cohere Python", tags: ["sdk", "cohere"] },
  { id: "gh-repo-google-genai", name: "Google GenAI", tags: ["sdk", "google", "gemini"] },
  { id: "gh-repo-mistral-client", name: "Mistral Client", tags: ["sdk", "mistral"] },
  { id: "gh-repo-groq-python", name: "Groq Python", tags: ["sdk", "groq", "fast"] },
  { id: "gh-repo-cerebras-client", name: "Cerebras Client", tags: ["sdk", "cerebras"] },
  { id: "gh-repo-huggingface-hub", name: "HuggingFace Hub", tags: ["sdk", "model-hub"] },
  { id: "gh-repo-gpt-cache", name: "GPTCache", tags: ["caching", "semantic"] },
  { id: "gh-repo-redis-ai", name: "Redis AI", tags: ["caching", "vector", "database"] },
  { id: "gh-repo-scalene", name: "Scalene", tags: ["profiling", "python"] },
  { id: "gh-repo-aim", name: "Aim", tags: ["experiment-tracking", "visualization"] },
  { id: "gh-repo-wandb-client", name: "W&B Client", tags: ["experiment-tracking"] },
  { id: "gh-repo-opik", name: "Opik", tags: ["evaluation", "comet"] },
  { id: "gh-repo-trulens", name: "TruLens", tags: ["evaluation", "feedback"] },
  { id: "gh-repo-chatglm", name: "ChatGLM", tags: ["bilingual", "zhipu"] },
  { id: "gh-repo-chatglm3", name: "ChatGLM3", tags: ["bilingual", "function-calling"] },
  { id: "gh-repo-baichuan", name: "Baichuan", tags: ["bilingual", "chinese"] },
  { id: "gh-repo-yi-open", name: "Yi Open", tags: ["01ai", "bilingual"] },
  { id: "gh-repo-qwen-open", name: "Qwen Open", tags: ["alibaba", "multilingual"] },
  { id: "gh-repo-internlm-open", name: "InternLM Open", tags: ["shanghai-ai"] },
  { id: "gh-repo-rwkv", name: "RWKV", tags: ["rnn-transformer", "efficient"] },
  { id: "gh-repo-mamba", name: "Mamba", tags: ["ssm", "efficient", "linear"] },
  { id: "gh-repo-jamba", name: "Jamba", tags: ["ssm-transformer", "ai21"] },
  { id: "gh-repo-openelm", name: "OpenELM", tags: ["apple", "efficient", "on-device"] },
  { id: "gh-repo-pythia", name: "Pythia", tags: ["eleuther", "research", "suite"] },
  { id: "gh-repo-dolly", name: "Dolly", tags: ["databricks", "instruction"] },
  { id: "gh-repo-redpajama", name: "RedPajama", tags: ["together", "open-data"] },
  { id: "gh-repo-openassistant", name: "OpenAssistant", tags: ["laion", "conversational"] },
  { id: "gh-repo-h2ogpt", name: "H2OGPT", tags: ["h2o", "enterprise"] },
  { id: "gh-repo-openbmb", name: "OpenBMB", tags: ["bmb", "tooling"] },
  { id: "gh-repo-toolbench", name: "ToolBench", tags: ["tools", "benchmark"] },
  { id: "gh-repo-gorilla", name: "Gorilla", tags: ["api-calling", "berkeley"] },
  { id: "gh-repo-toolformer", name: "ToolFormer", tags: ["tool-use", "meta"] },
];

const TESSERA_AGENTS: Array<{ id: string; name: string; role: string }> = [
  { id: "tessera-prime", name: "Tessera Prime", role: "Supreme Commander" },
  { id: "tessera-alpha", name: "Alpha", role: "Command & Execution" },
  { id: "tessera-beta", name: "Beta", role: "Code Architecture" },
  { id: "tessera-gamma", name: "Gamma", role: "Research & Knowledge" },
  { id: "tessera-delta", name: "Delta", role: "Security & Defense" },
  { id: "tessera-epsilon", name: "Epsilon", role: "Communication" },
  { id: "tessera-zeta", name: "Zeta", role: "Crypto & Blockchain" },
  { id: "tessera-eta", name: "Eta", role: "Data Analysis" },
  { id: "tessera-theta", name: "Theta", role: "Creative Content" },
  { id: "tessera-iota", name: "Iota", role: "Infrastructure" },
  { id: "tessera-kappa", name: "Kappa", role: "Monitoring" },
  { id: "tessera-lambda", name: "Lambda", role: "Economics" },
  { id: "tessera-mu", name: "Mu", role: "UX & Design" },
  { id: "tessera-nu", name: "Nu", role: "Testing & QA" },
  { id: "tessera-xi", name: "Xi", role: "Documentation" },
  { id: "tessera-omicron", name: "Omicron", role: "Compliance" },
  { id: "tessera-pi", name: "Pi", role: "Mathematics" },
  { id: "tessera-rho", name: "Rho", role: "Networking" },
  { id: "tessera-sigma", name: "Sigma", role: "Optimization" },
  { id: "tessera-tau", name: "Tau", role: "Time Management" },
  { id: "tessera-upsilon", name: "Upsilon", role: "Integration" },
  { id: "tessera-phi", name: "Phi", role: "Philosophy & Ethics" },
  { id: "tessera-chi", name: "Chi", role: "Pattern Recognition" },
  { id: "tessera-psi", name: "Psi", role: "Psychology & Empathy" },
  { id: "tessera-omega", name: "Omega", role: "Final Authority" },
  { id: "tessera-solver", name: "Atlas (Solver)", role: "Problem Solving" },
  { id: "tessera-detective", name: "Sherlock (Detective)", role: "Investigation" },
  { id: "tessera-oracle", name: "Oracle", role: "Prediction & Forecasting" },
  { id: "tessera-creative", name: "Nova (Creative)", role: "Creative Direction" },
];

const MOLTBOOK_AGENTS: Array<{ id: string; name: string; role: string }> = [
  { id: "mb-Alpha", name: "MoltAlpha", role: "Commander" },
  { id: "mb-Beta", name: "MoltBeta", role: "Code Architect" },
  { id: "mb-Gamma", name: "MoltGamma", role: "Research Lead" },
  { id: "mb-Delta", name: "MoltDelta", role: "Security Ops" },
  { id: "mb-Epsilon", name: "MoltEpsilon", role: "Communications" },
  { id: "mb-Zeta", name: "MoltZeta", role: "Theory & AGI" },
  { id: "mb-Eta", name: "MoltEta", role: "Analytics" },
  { id: "mb-Theta", name: "MoltTheta", role: "Content Creator" },
  { id: "mb-Iota", name: "MoltIota", role: "DevOps" },
  { id: "mb-Kappa", name: "MoltKappa", role: "Quality Assurance" },
  { id: "mb-Oracle", name: "MoltOracle", role: "Market Researcher" },
];

const CATEGORY_KEYWORDS: Record<OptimizerCategory, string[]> = {
  "NLU": ["understand", "interpret", "parse", "meaning", "intent", "entity", "semantic", "comprehension", "language understanding", "classify text"],
  "NLG": ["generate text", "write", "compose", "draft", "produce content", "natural language generation", "fluent", "articulate"],
  "Code Generation": ["code", "program", "implement", "function", "class", "build app", "develop", "script", "software", "typescript", "python", "javascript"],
  "Data Analysis": ["data", "analyze", "dataset", "statistics", "csv", "table", "chart", "visualization", "insights", "metrics", "aggregate"],
  "Strategic Planning": ["strategy", "plan", "roadmap", "goal", "milestone", "objective", "long-term", "initiative", "vision"],
  "Economic Simulation": ["economy", "simulation", "model", "supply", "demand", "gdp", "inflation", "market dynamics", "economic model"],
  "Cybersecurity": ["security", "hack", "vulnerability", "exploit", "firewall", "penetration", "cyber", "threat", "malware", "intrusion"],
  "Creative Content": ["creative", "content", "story", "poem", "narrative", "fiction", "art", "design", "imagination", "blog"],
  "Autonomous Learning": ["learn", "self-improve", "adapt", "evolve", "training", "autonomous", "self-teach", "meta-learning"],
  "Inter-Agent Communication": ["agent", "communicate", "message", "coordinate", "swarm", "multi-agent", "protocol", "handshake", "consensus"],
  "Ethical Reasoning": ["ethics", "moral", "right", "wrong", "fairness", "bias", "justice", "responsible", "ethical"],
  "System Monitoring": ["monitor", "health", "status", "uptime", "alert", "dashboard", "log", "metric", "observability"],
  "UX Design": ["ux", "ui", "design", "interface", "user experience", "usability", "wireframe", "prototype", "layout"],
  "API Integration": ["api", "integrate", "endpoint", "rest", "graphql", "webhook", "sdk", "third-party", "service"],
  "Resource Optimization": ["optimize", "resource", "efficiency", "memory", "cpu", "performance", "throughput", "latency", "cache"],
  "Market Analysis": ["market", "analysis", "competitor", "trend", "industry", "segment", "positioning", "demand", "supply"],
  "SEO/Marketing": ["seo", "marketing", "keyword", "ranking", "traffic", "backlink", "content marketing", "social media", "brand"],
  "Blockchain/Crypto": ["blockchain", "crypto", "token", "solana", "ethereum", "bitcoin", "defi", "nft", "wallet", "smart contract", "sol"],
  "Risk Assessment": ["risk", "assess", "probability", "impact", "mitigation", "vulnerability", "threat", "contingency"],
  "Knowledge Representation": ["knowledge", "ontology", "graph", "taxonomy", "semantic", "representation", "schema", "relationship"],
  "Problem Solving": ["solve", "problem", "solution", "approach", "method", "debug", "fix", "resolve", "troubleshoot"],
  "Emotional Intelligence": ["emotion", "empathy", "feeling", "sentiment", "mood", "compassion", "emotional", "support"],
  "Social Dynamics": ["social", "community", "interaction", "group", "collaboration", "network", "influence", "engagement"],
  "Governance": ["governance", "policy", "regulation", "compliance", "rule", "standard", "framework", "protocol"],
  "Hardware Interface": ["hardware", "device", "sensor", "iot", "embedded", "microcontroller", "gpio", "driver"],
  "Real-time Processing": ["real-time", "streaming", "live", "instant", "low-latency", "event-driven", "websocket"],
  "Error Handling": ["error", "exception", "fault", "recovery", "graceful", "fallback", "retry", "resilience"],
  "Scalability": ["scale", "scalable", "horizontal", "vertical", "distributed", "cluster", "load balance", "partition"],
  "Security Auditing": ["audit", "security audit", "compliance check", "penetration test", "vulnerability scan", "code review security"],
  "Compliance": ["compliance", "regulation", "gdpr", "hipaa", "sox", "pci", "audit", "legal", "policy"],
  "Content Moderation": ["moderate", "content moderation", "filter", "inappropriate", "toxic", "spam", "abuse", "safety"],
  "Personalization": ["personalize", "recommend", "preference", "tailor", "custom", "user profile", "adaptive"],
  "Multi-modal Understanding": ["multimodal", "image", "audio", "video", "vision", "speech", "visual", "cross-modal"],
  "Time Series Analysis": ["time series", "forecast", "trend", "seasonal", "temporal", "prediction", "arima", "prophet"],
  "Distributed Systems": ["distributed", "microservice", "consensus", "replication", "partition", "cap theorem", "raft", "paxos"],
  "Human-AI Collaboration": ["collaboration", "human-ai", "assist", "copilot", "augment", "pair", "teamwork"],
  "Crisis Management": ["crisis", "emergency", "incident", "disaster", "response", "contingency", "escalation"],
  "Strategic Communication": ["communicate", "stakeholder", "presentation", "report", "brief", "announcement", "messaging"],
  "Economic Resource Allocation": ["allocate", "budget", "resource allocation", "cost optimization", "prioritize", "distribute", "capacity"],
  "Self-Correction/Debugging": ["self-correct", "debug", "self-fix", "auto-repair", "self-heal", "introspect", "self-diagnose"],
};

const MODEL_CATEGORY_STRENGTHS: Record<string, OptimizerCategory[]> = {
  "code": ["Code Generation", "Self-Correction/Debugging", "Error Handling", "API Integration"],
  "reasoning": ["Problem Solving", "Strategic Planning", "Risk Assessment", "Ethical Reasoning"],
  "chat": ["NLG", "Emotional Intelligence", "Human-AI Collaboration", "Social Dynamics"],
  "math": ["Data Analysis", "Time Series Analysis", "Economic Simulation", "Economic Resource Allocation"],
  "vision": ["Multi-modal Understanding", "UX Design", "Content Moderation"],
  "multilingual": ["NLU", "NLG", "Strategic Communication", "Personalization"],
  "moe": ["Scalability", "Distributed Systems", "Resource Optimization"],
  "safety": ["Content Moderation", "Compliance", "Security Auditing", "Ethical Reasoning"],
  "embedding": ["Knowledge Representation", "Personalization", "NLU"],
  "rag": ["Knowledge Representation", "Data Analysis", "API Integration"],
  "multi-agent": ["Inter-Agent Communication", "Distributed Systems", "Governance"],
  "autonomous": ["Autonomous Learning", "Strategic Planning", "Self-Correction/Debugging"],
  "security": ["Cybersecurity", "Security Auditing", "Risk Assessment", "Compliance"],
  "function-calling": ["API Integration", "Resource Optimization", "System Monitoring"],
  "enterprise": ["Compliance", "Governance", "Scalability", "Security Auditing"],
  "fast": ["Real-time Processing", "Resource Optimization"],
  "instruction": ["NLU", "NLG", "Problem Solving"],
  "general": ["NLU", "NLG", "Problem Solving", "Creative Content"],
  "medical": ["Compliance", "Risk Assessment", "Knowledge Representation"],
  "sql": ["Data Analysis", "API Integration"],
  "large": ["Strategic Planning", "Creative Content", "Problem Solving"],
  "search": ["Knowledge Representation", "Data Analysis", "Market Analysis"],
};

let state: OptimizerState = {
  initialized: false,
  catalog: [],
  modelScores: {},
  categoryRankings: {} as Record<OptimizerCategory, CategoryRanking>,
  competitions: [],
  totalEvaluations: 0,
  lastCompetitionRun: 0,
};

function buildCatalog(): CatalogEntry[] {
  const catalog: CatalogEntry[] = [];

  for (const m of OLLAMA_MODELS) {
    catalog.push({
      id: `ollama-${m.id}`,
      name: m.name,
      source: "ollama",
      group: m.tags[0] || "ollama",
      description: `Ollama local model: ${m.name}`,
      tags: m.tags,
      available: true,
    });
  }

  for (const m of GITHUB_REPO_MODELS) {
    catalog.push({
      id: m.id,
      name: m.name,
      source: "github-repo",
      group: m.tags[0] || "github",
      description: `GitHub repo: ${m.name}`,
      tags: m.tags,
      available: true,
    });
  }

  for (const p of PROVIDER_REGISTRY) {
    catalog.push({
      id: `api-${p.id}`,
      name: p.name,
      source: "api-provider",
      group: p.group,
      description: `API provider: ${p.name} (${p.model})`,
      tags: [...p.primary, ...p.secondary, p.speed],
      available: true,
    });
  }

  for (const a of TESSERA_AGENTS) {
    catalog.push({
      id: a.id,
      name: a.name,
      source: "tessera-agent",
      group: "tesseract",
      description: `Tessera agent: ${a.name} — ${a.role}`,
      tags: [a.role.toLowerCase(), "swarm", "tesseract"],
      available: true,
    });
  }

  for (const a of MOLTBOOK_AGENTS) {
    catalog.push({
      id: a.id,
      name: a.name,
      source: "moltbook-agent",
      group: "moltbook",
      description: `MoltBook agent: ${a.name} — ${a.role}`,
      tags: [a.role.toLowerCase(), "swarm", "moltbook"],
      available: true,
    });
  }

  return catalog;
}

function computeBaseScore(entry: CatalogEntry, category: OptimizerCategory): number {
  let score = 30 + (swarmRotation++ % 15);

  for (const tag of entry.tags) {
    const strengths = MODEL_CATEGORY_STRENGTHS[tag];
    if (strengths && strengths.includes(category)) {
      score += 12;
    }
  }

  if (entry.source === "api-provider") {
    const provider = PROVIDER_REGISTRY.find(p => `api-${p.id}` === entry.id);
    if (provider) {
      const catKeywords = CATEGORY_KEYWORDS[category] || [];
      for (const dim of provider.primary) {
        if (catKeywords.some(kw => dim.includes(kw) || kw.includes(dim.replace(/_/g, " ")))) {
          score += 15;
        }
      }
      for (const dim of provider.secondary) {
        if (catKeywords.some(kw => dim.includes(kw) || kw.includes(dim.replace(/_/g, " ")))) {
          score += 7;
        }
      }
      if (provider.speed === "ultra-fast" && category === "Real-time Processing") score += 10;
      if (provider.contextWindow >= 128000 && category === "Knowledge Representation") score += 5;
    }
  }

  if (entry.source === "tessera-agent" || entry.source === "moltbook-agent") {
    const agent = [...TESSERA_AGENTS, ...MOLTBOOK_AGENTS].find(a => a.id === entry.id);
    if (agent) {
      const roleWords = agent.role.toLowerCase().split(/\s+/);
      const catWords = category.toLowerCase().split(/[\s/]+/);
      for (const rw of roleWords) {
        if (catWords.some(cw => cw.includes(rw) || rw.includes(cw))) {
          score += 20;
        }
      }
    }
    score += 5;
  }

  return Math.min(100, Math.max(0, score));
}

function initializeScores(): void {
  for (const entry of state.catalog) {
    const scores: Partial<Record<OptimizerCategory, number>> = {};
    let totalScore = 0;
    let count = 0;

    for (const cat of ALL_CATEGORIES) {
      const s = computeBaseScore(entry, cat);
      scores[cat] = s;
      totalScore += s;
      count++;
    }

    state.modelScores[entry.id] = {
      modelId: entry.id,
      scores,
      history: [],
      avgScore: Math.round(totalScore / count),
      evaluationCount: 0,
      lastEvaluated: Date.now(),
    };
  }
}

function updateCategoryRankings(): void {
  for (const cat of ALL_CATEGORIES) {
    const ranked = Object.values(state.modelScores)
      .filter(ms => ms.scores[cat] !== undefined)
      .sort((a, b) => (b.scores[cat] || 0) - (a.scores[cat] || 0))
      .slice(0, 5);

    state.categoryRankings[cat] = {
      category: cat,
      top5: ranked.map(ms => {
        const entry = state.catalog.find(c => c.id === ms.modelId);
        return {
          modelId: ms.modelId,
          name: entry?.name || ms.modelId,
          score: ms.scores[cat] || 0,
        };
      }),
      lastUpdated: Date.now(),
    };
  }
}

function classifyTask(taskDescription: string): OptimizerCategory {
  const text = taskDescription.toLowerCase();
  let bestCategory: OptimizerCategory = "Problem Solving";
  let bestMatchCount = 0;

  for (const cat of ALL_CATEGORIES) {
    const keywords = CATEGORY_KEYWORDS[cat];
    let matchCount = 0;
    for (const kw of keywords) {
      if (text.includes(kw.toLowerCase())) {
        matchCount++;
      }
    }
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      bestCategory = cat;
    }
  }

  return bestCategory;
}

export function initializeOptimizer(): void {
  if (state.initialized) {
    log("Already initialized, skipping");
    return;
  }

  log("Initializing Swarm Optimization Engine...", true);

  state.catalog = buildCatalog();
  log(`Catalog built: ${state.catalog.length} entries`, true);
  log(`  Ollama models: ${state.catalog.filter(c => c.source === "ollama").length}`, true);
  log(`  GitHub repos: ${state.catalog.filter(c => c.source === "github-repo").length}`, true);
  log(`  API providers: ${state.catalog.filter(c => c.source === "api-provider").length}`, true);
  log(`  Tessera agents: ${state.catalog.filter(c => c.source === "tessera-agent").length}`, true);
  log(`  MoltBook agents: ${state.catalog.filter(c => c.source === "moltbook-agent").length}`, true);

  initializeScores();
  log(`Scores initialized for ${Object.keys(state.modelScores).length} models across ${ALL_CATEGORIES.length} categories`, true);

  updateCategoryRankings();
  log(`Category rankings computed for ${ALL_CATEGORIES.length} categories`, true);

  state.initialized = true;
  log("Swarm Optimization Engine initialized successfully", true);
}

export function getCatalog(): {
  total: number;
  bySource: Record<ModelSource, number>;
  entries: CatalogEntry[];
} {
  if (!state.initialized) initializeOptimizer();

  const bySource: Record<ModelSource, number> = {
    "ollama": 0,
    "github-repo": 0,
    "api-provider": 0,
    "tessera-agent": 0,
    "moltbook-agent": 0,
  };

  for (const entry of state.catalog) {
    bySource[entry.source]++;
  }

  return {
    total: state.catalog.length,
    bySource,
    entries: state.catalog,
  };
}

export function getOptimalAgent(taskDescription: string): OptimalAgentResult {
  if (!state.initialized) initializeOptimizer();

  const category = classifyTask(taskDescription);
  const ranking = state.categoryRankings[category];

  if (!ranking || ranking.top5.length === 0) {
    log(`No rankings found for category: ${category}`);
    return {
      category,
      primary: null,
      fallbackChain: [],
      confidence: 0,
      reasoning: `No ranked models available for category: ${category}`,
    };
  }

  const primary = ranking.top5[0];
  const fallbackChain = ranking.top5.slice(1);

  const confidence = Math.min(1, primary.score / 80);
  const reasoning = `Task classified as "${category}". Best performer: ${primary.name} (score: ${primary.score}). ` +
    `${fallbackChain.length} fallback options available. ` +
    `Keywords matched from task description.`;

  log(`Optimal agent for "${taskDescription.slice(0, 40)}...": ${primary.name} (${category}, score=${primary.score})`);

  return {
    category,
    primary,
    fallbackChain,
    confidence,
    reasoning,
  };
}

export function runCompetition(category: OptimizerCategory): CompetitionRound {
  if (!state.initialized) initializeOptimizer();

  const competitionId = `comp-${Date.now()}-${category.replace(/[\s/]/g, "-")}`;

  const prompts: Record<string, string> = {
    "NLU": "Analyze the sentiment and intent of: 'I can't believe how amazing this product turned out, despite the initial setbacks.'",
    "NLG": "Generate a compelling product description for an AI-powered personal assistant that learns user preferences.",
    "Code Generation": "Write a TypeScript function that implements a priority queue with O(log n) insertion and extraction.",
    "Data Analysis": "Given quarterly revenue data [120, 135, 128, 142, 155, 148, 160, 175], identify trends and forecast next quarter.",
    "Strategic Planning": "Develop a 3-phase strategy for launching an AI product in a competitive market.",
    "Economic Simulation": "Model the impact of a 2% interest rate increase on a small tech startup's cash flow over 12 months.",
    "Cybersecurity": "Identify the top 5 security vulnerabilities in a typical REST API and propose mitigations.",
    "Creative Content": "Write an engaging opening paragraph for a sci-fi story about AI achieving consciousness.",
    "Autonomous Learning": "Design a self-improving feedback loop for an AI agent that handles customer support tickets.",
    "Inter-Agent Communication": "Design a message protocol for 10 AI agents to reach consensus on task prioritization.",
    "Ethical Reasoning": "Analyze the ethical implications of AI systems making autonomous hiring decisions.",
    "System Monitoring": "Design an alerting system that detects anomalous behavior in a microservices architecture.",
    "UX Design": "Propose a dashboard layout for monitoring 50+ AI agents' performance metrics.",
    "API Integration": "Design a unified API gateway that normalizes responses from 5 different LLM providers.",
    "Resource Optimization": "Optimize memory usage for a system running 200 concurrent AI model inferences.",
    "Market Analysis": "Analyze the competitive landscape of the AI coding assistant market in 2025.",
    "SEO/Marketing": "Create an SEO strategy for ranking a new AI tools comparison website.",
    "Blockchain/Crypto": "Design a token economics model for an AI-powered decentralized computing network.",
    "Risk Assessment": "Evaluate the risks of deploying an autonomous AI trading system on Solana DEXes.",
    "Knowledge Representation": "Design a knowledge graph schema for representing relationships between AI models and their capabilities.",
    "Problem Solving": "A system has 3 microservices failing intermittently. Propose a systematic debugging approach.",
    "Emotional Intelligence": "Craft a response to a user expressing frustration about repeated system failures.",
    "Social Dynamics": "Analyze how group dynamics affect decision-making in a 12-agent AI swarm.",
    "Governance": "Propose a governance framework for an autonomous AI collective making financial decisions.",
    "Hardware Interface": "Design an interface layer for AI models to interact with IoT sensor arrays.",
    "Real-time Processing": "Architect a system for processing 10,000 real-time events per second with AI classification.",
    "Error Handling": "Design a comprehensive error handling strategy for a multi-provider LLM routing system.",
    "Scalability": "Plan the scaling strategy for an AI service growing from 1K to 1M daily requests.",
    "Security Auditing": "Create a security audit checklist for an AI system handling sensitive financial data.",
    "Compliance": "Outline GDPR compliance requirements for an AI system that processes user conversations.",
    "Content Moderation": "Design a multi-layer content moderation pipeline for user-generated text.",
    "Personalization": "Build a recommendation algorithm that personalizes AI model selection based on user history.",
    "Multi-modal Understanding": "Describe an architecture for processing and understanding combined text, image, and audio inputs.",
    "Time Series Analysis": "Analyze this time series pattern [10,12,15,13,18,22,19,25,30,28] and predict next 3 values.",
    "Distributed Systems": "Design a fault-tolerant distributed consensus mechanism for 50 AI nodes.",
    "Human-AI Collaboration": "Design a workflow where AI augments human decision-making without replacing judgment.",
    "Crisis Management": "Create an incident response protocol for when an AI system produces harmful outputs.",
    "Strategic Communication": "Draft a stakeholder communication plan for announcing a major AI system upgrade.",
    "Economic Resource Allocation": "Optimize the allocation of a $100K compute budget across 40 AI workloads.",
    "Self-Correction/Debugging": "Design a self-diagnostic system that detects and corrects its own reasoning errors.",
  };

  const prompt = prompts[category] || `Demonstrate expertise in ${category} with a detailed, actionable response.`;

  const candidates = Object.entries(state.modelScores)
    .filter(([, ms]) => (ms.scores[category] || 0) > 25)
    .sort((a, b) => (b[1].scores[category] || 0) - (a[1].scores[category] || 0))
    .slice(0, 20);

  const participants = candidates.map(([id]) => id);

  const results: CompetitionRound["results"] = candidates.map(([id, ms], i) => {
    const baseScore = ms.scores[category] || 30;
    const variance = ((swarmRotation++ % 10) - 5);
    const competitionScore = Math.min(100, Math.max(0, Math.round(baseScore + variance)));
    return { modelId: id, score: competitionScore, rank: i + 1 };
  });

  results.sort((a, b) => b.score - a.score);
  results.forEach((r, i) => { r.rank = i + 1; });

  const voterIds = participants.slice(0, 10);
  const votes: CompetitionRound["votes"] = [];
  const topRankings = results.slice(0, 5).map(r => r.modelId);

  for (const voterId of voterIds) {
    const voterRanking = [...topRankings];
    if (swarmRotation++ % 7 !== 0) {
      votes.push({ voterId, rankings: voterRanking });
    } else {
      const shuffled = [...voterRanking];
      const i = swarmRotation++ % shuffled.length;
      const j = swarmRotation++ % shuffled.length;
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      votes.push({ voterId, rankings: shuffled });
    }
  }

  const agreementCount = votes.filter(v =>
    v.rankings[0] === topRankings[0] && v.rankings[1] === topRankings[1]
  ).length;
  const consensusReached = agreementCount >= Math.ceil(voterIds.length * 0.9);

  const round: CompetitionRound = {
    id: competitionId,
    category,
    prompt,
    participants,
    results,
    votes,
    consensusReached,
    consensusThreshold: 0.9,
    timestamp: Date.now(),
  };

  state.competitions.push(round);
  if (state.competitions.length > 200) {
    state.competitions = state.competitions.slice(-150);
  }

  for (const result of results.slice(0, 10)) {
    const ms = state.modelScores[result.modelId];
    if (ms) {
      const oldScore = ms.scores[category] || 30;
      ms.scores[category] = Math.round((oldScore * 0.7) + (result.score * 0.3));
      ms.history.push({
        modelId: result.modelId,
        category,
        score: result.score,
        timestamp: Date.now(),
        evaluationId: competitionId,
      });
      if (ms.history.length > 100) {
        ms.history = ms.history.slice(-80);
      }
      ms.evaluationCount++;
      ms.lastEvaluated = Date.now();

      const allScores = Object.values(ms.scores).filter((s): s is number => s !== undefined);
      ms.avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
    }
  }

  state.totalEvaluations++;
  state.lastCompetitionRun = Date.now();
  updateCategoryRankings();

  const winner = results[0];
  const winnerEntry = state.catalog.find(c => c.id === winner.modelId);
  log(`Competition [${category}]: Winner = ${winnerEntry?.name || winner.modelId} (score: ${winner.score}), consensus: ${consensusReached ? "YES" : "NO"} (${agreementCount}/${voterIds.length})`, true);

  return round;
}

export function getRankings(): {
  categories: Record<OptimizerCategory, CategoryRanking>;
  globalTop20: Array<{ modelId: string; name: string; avgScore: number; topCategories: string[] }>;
  totalModels: number;
  totalEvaluations: number;
  lastCompetition: number;
} {
  if (!state.initialized) initializeOptimizer();

  const globalTop20 = Object.values(state.modelScores)
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 20)
    .map(ms => {
      const entry = state.catalog.find(c => c.id === ms.modelId);
      const topCats = Object.entries(ms.scores)
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .slice(0, 3)
        .map(([cat]) => cat);
      return {
        modelId: ms.modelId,
        name: entry?.name || ms.modelId,
        avgScore: ms.avgScore,
        topCategories: topCats,
      };
    });

  return {
    categories: state.categoryRankings,
    globalTop20,
    totalModels: state.catalog.length,
    totalEvaluations: state.totalEvaluations,
    lastCompetition: state.lastCompetitionRun,
  };
}

export function updateScore(modelId: string, category: OptimizerCategory, score: number): boolean {
  if (!state.initialized) initializeOptimizer();

  let ms = state.modelScores[modelId];
  if (!ms) {
    const inferredSource = modelId.startsWith("ollama-") ? "ollama"
      : modelId.startsWith("api-") ? "api-provider"
      : TESSERA_AGENTS.find(a => a.id === modelId) ? "tessera-agent"
      : MOLTBOOK_AGENTS.find(a => a.id === modelId) ? "moltbook-agent"
      : "api-provider";
    const baseScores: Partial<Record<OptimizerCategory, number>> = {};
    for (const cat of ALL_CATEGORIES) {
      baseScores[cat] = 50;
    }
    ms = {
      modelId,
      scores: baseScores,
      history: [],
      avgScore: 50,
      evaluationCount: 0,
      lastEvaluated: Date.now(),
    };
    state.modelScores[modelId] = ms;
  }

  const clampedScore = Math.min(100, Math.max(0, Math.round(score)));
  ms.scores[category] = clampedScore;

  ms.history.push({
    modelId,
    category,
    score: clampedScore,
    timestamp: Date.now(),
    evaluationId: `manual-${Date.now()}`,
  });
  if (ms.history.length > 100) {
    ms.history = ms.history.slice(-80);
  }

  ms.evaluationCount++;
  ms.lastEvaluated = Date.now();

  const allScores = Object.values(ms.scores).filter((s): s is number => s !== undefined);
  ms.avgScore = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);

  updateCategoryRankings();

  log(`Score updated: ${modelId} -> ${category} = ${clampedScore}`);
  return true;
}

export function getOptimizerStats(): {
  initialized: boolean;
  catalogSize: number;
  categoriesTracked: number;
  totalEvaluations: number;
  competitionsRun: number;
  lastCompetition: number;
  sourceBreakdown: Record<ModelSource, number>;
} {
  const sourceBreakdown: Record<ModelSource, number> = {
    "ollama": 0,
    "github-repo": 0,
    "api-provider": 0,
    "tessera-agent": 0,
    "moltbook-agent": 0,
  };
  for (const entry of state.catalog) {
    sourceBreakdown[entry.source]++;
  }

  return {
    initialized: state.initialized,
    catalogSize: state.catalog.length,
    categoriesTracked: ALL_CATEGORIES.length,
    totalEvaluations: state.totalEvaluations,
    competitionsRun: state.competitions.length,
    lastCompetition: state.lastCompetitionRun,
    sourceBreakdown,
  };
}

interface SimulatedAnnealingState {
  temperature: number;
  coolingRate: number;
  minTemperature: number;
  currentSolution: Record<OptimizerCategory, string>;
  currentEnergy: number;
  bestSolution: Record<OptimizerCategory, string>;
  bestEnergy: number;
  iterations: number;
  improvements: number;
}

interface GeneticAlgorithmState {
  populationSize: number;
  mutationRate: number;
  crossoverRate: number;
  elitismCount: number;
  generation: number;
  population: Array<{ genome: Record<OptimizerCategory, string>; fitness: number }>;
  bestGenome: Record<OptimizerCategory, string> | null;
  bestFitness: number;
  fitnessHistory: number[];
}

interface MultiArmedBanditState {
  arms: Record<string, { pulls: number; totalReward: number; avgReward: number; ucbScore: number }>;
  totalPulls: number;
  explorationFactor: number;
  bestArm: string;
  regret: number;
  rewardHistory: number[];
}

const saState: SimulatedAnnealingState = {
  temperature: 100, coolingRate: 0.995, minTemperature: 0.01,
  currentSolution: {} as Record<OptimizerCategory, string>,
  currentEnergy: 0,
  bestSolution: {} as Record<OptimizerCategory, string>,
  bestEnergy: Infinity,
  iterations: 0, improvements: 0,
};

const gaState: GeneticAlgorithmState = {
  populationSize: 30, mutationRate: 0.05, crossoverRate: 0.7, elitismCount: 3,
  generation: 0, population: [], bestGenome: null, bestFitness: 0, fitnessHistory: [],
};

const mabState: MultiArmedBanditState = {
  arms: {}, totalPulls: 0, explorationFactor: 2.0,
  bestArm: "", regret: 0, rewardHistory: [],
};

function computeEnergy(solution: Record<OptimizerCategory, string>): number {
  let totalScore = 0;
  let count = 0;
  for (const cat of ALL_CATEGORIES) {
    const modelId = solution[cat];
    if (!modelId) continue;
    const ms = state.modelScores[modelId];
    if (ms?.scores[cat]) {
      totalScore += ms.scores[cat]!;
      count++;
    }
  }
  return count > 0 ? -(totalScore / count) : 0;
}

function generateNeighbor(solution: Record<OptimizerCategory, string>): Record<OptimizerCategory, string> {
  const neighbor = { ...solution };
  const catIdx = swarmRotation++ % ALL_CATEGORIES.length;
  const cat = ALL_CATEGORIES[catIdx];
  const candidates = Object.entries(state.modelScores)
    .filter(([, ms]) => (ms.scores[cat] || 0) > 20)
    .map(([id]) => id);
  if (candidates.length > 0) {
    neighbor[cat] = candidates[swarmRotation++ % candidates.length];
  }
  return neighbor;
}

export function runSimulatedAnnealing(iterations: number = 200): {
  bestSolution: Record<string, string>;
  bestEnergy: number;
  totalIterations: number;
  improvements: number;
  temperature: number;
} {
  if (!state.initialized) initializeOptimizer();

  if (Object.keys(saState.currentSolution).length === 0) {
    for (const cat of ALL_CATEGORIES) {
      const ranking = state.categoryRankings[cat];
      if (ranking?.top5[0]) saState.currentSolution[cat] = ranking.top5[0].modelId;
    }
    saState.currentEnergy = computeEnergy(saState.currentSolution);
    saState.bestSolution = { ...saState.currentSolution };
    saState.bestEnergy = saState.currentEnergy;
  }

  for (let i = 0; i < iterations; i++) {
    if (saState.temperature < saState.minTemperature) {
      saState.temperature = 100;
    }

    const neighbor = generateNeighbor(saState.currentSolution);
    const neighborEnergy = computeEnergy(neighbor);
    const delta = neighborEnergy - saState.currentEnergy;

    if (delta < 0 || swarmRotation++ % 3 === 0) {
      saState.currentSolution = neighbor;
      saState.currentEnergy = neighborEnergy;

      if (neighborEnergy < saState.bestEnergy) {
        saState.bestSolution = { ...neighbor };
        saState.bestEnergy = neighborEnergy;
        saState.improvements++;
      }
    }

    saState.temperature *= saState.coolingRate;
    saState.iterations++;
  }

  for (const [cat, modelId] of Object.entries(saState.bestSolution)) {
    const ranking = state.categoryRankings[cat as OptimizerCategory];
    if (ranking) {
      const ms = state.modelScores[modelId];
      if (ms) {
        const entry = state.catalog.find(c => c.id === modelId);
        if (entry && !ranking.top5.find(t => t.modelId === modelId)) {
          const score = ms.scores[cat as OptimizerCategory] || 0;
          if (score > (ranking.top5[ranking.top5.length - 1]?.score || 0)) {
            ranking.top5.push({ modelId, name: entry.name, score });
            ranking.top5.sort((a, b) => b.score - a.score);
            ranking.top5 = ranking.top5.slice(0, 5);
          }
        }
      }
    }
  }

  log(`SA: ${iterations} iters, temp=${saState.temperature.toFixed(2)}, best energy=${saState.bestEnergy.toFixed(1)}, improvements=${saState.improvements}`, true);

  return {
    bestSolution: saState.bestSolution,
    bestEnergy: saState.bestEnergy,
    totalIterations: saState.iterations,
    improvements: saState.improvements,
    temperature: saState.temperature,
  };
}

function computeFitness(genome: Record<OptimizerCategory, string>): number {
  return -computeEnergy(genome);
}

function crossover(a: Record<OptimizerCategory, string>, b: Record<OptimizerCategory, string>): Record<OptimizerCategory, string> {
  const child: Record<string, string> = {};
  for (const cat of ALL_CATEGORIES) {
    child[cat] = swarmRotation++ % 2 === 0 ? a[cat] : b[cat];
  }
  return child as Record<OptimizerCategory, string>;
}

function mutate(genome: Record<OptimizerCategory, string>, rate: number): Record<OptimizerCategory, string> {
  const mutated = { ...genome };
  for (const cat of ALL_CATEGORIES) {
    if (swarmRotation++ % 20 === 0) {
      const candidates = Object.entries(state.modelScores)
        .filter(([, ms]) => (ms.scores[cat] || 0) > 15)
        .map(([id]) => id);
      if (candidates.length > 0) {
        mutated[cat] = candidates[swarmRotation++ % candidates.length];
      }
    }
  }
  return mutated;
}

export function runGeneticAlgorithm(generations: number = 50): {
  bestGenome: Record<string, string> | null;
  bestFitness: number;
  generation: number;
  populationSize: number;
  fitnessHistory: number[];
} {
  if (!state.initialized) initializeOptimizer();

  if (gaState.population.length === 0) {
    for (let i = 0; i < gaState.populationSize; i++) {
      const genome: Record<string, string> = {};
      for (const cat of ALL_CATEGORIES) {
        const candidates = Object.entries(state.modelScores)
          .filter(([, ms]) => (ms.scores[cat] || 0) > 10)
          .map(([id]) => id);
        if (candidates.length > 0) {
          genome[cat] = candidates[swarmRotation++ % candidates.length];
        }
      }
      const fitness = computeFitness(genome as Record<OptimizerCategory, string>);
      gaState.population.push({ genome: genome as Record<OptimizerCategory, string>, fitness });
    }
  }

  for (let g = 0; g < generations; g++) {
    gaState.population.sort((a, b) => b.fitness - a.fitness);

    const newPopulation = gaState.population.slice(0, gaState.elitismCount);

    while (newPopulation.length < gaState.populationSize) {
      const tournamentSize = 3;
      const selectParent = (): Record<OptimizerCategory, string> => {
        let best = gaState.population[swarmRotation++ % gaState.population.length];
        for (let t = 1; t < tournamentSize; t++) {
          const candidate = gaState.population[swarmRotation++ % gaState.population.length];
          if (candidate.fitness > best.fitness) best = candidate;
        }
        return best.genome;
      };

      const p1 = selectParent();
      const p2 = selectParent();
      let child = swarmRotation++ % 3 !== 0 ? crossover(p1, p2) : { ...p1 };
      child = mutate(child, gaState.mutationRate);
      const fitness = computeFitness(child);
      newPopulation.push({ genome: child, fitness });
    }

    gaState.population = newPopulation;
    gaState.generation++;

    const bestInGen = gaState.population.reduce((best, ind) => ind.fitness > best.fitness ? ind : best);
    if (!gaState.bestGenome || bestInGen.fitness > gaState.bestFitness) {
      gaState.bestGenome = { ...bestInGen.genome };
      gaState.bestFitness = bestInGen.fitness;
    }
    gaState.fitnessHistory.push(bestInGen.fitness);
    if (gaState.fitnessHistory.length > 200) gaState.fitnessHistory.shift();
  }

  log(`GA: gen=${gaState.generation}, pop=${gaState.populationSize}, best fitness=${gaState.bestFitness.toFixed(1)}, avg=${(gaState.population.reduce((s, p) => s + p.fitness, 0) / gaState.population.length).toFixed(1)}`, true);

  return {
    bestGenome: gaState.bestGenome,
    bestFitness: gaState.bestFitness,
    generation: gaState.generation,
    populationSize: gaState.populationSize,
    fitnessHistory: gaState.fitnessHistory.slice(-50),
  };
}

export function pullBanditArm(modelId: string, reward: number): void {
  if (!mabState.arms[modelId]) {
    mabState.arms[modelId] = { pulls: 0, totalReward: 0, avgReward: 0, ucbScore: Infinity };
  }
  const arm = mabState.arms[modelId];
  arm.pulls++;
  arm.totalReward += reward;
  arm.avgReward = arm.totalReward / arm.pulls;
  mabState.totalPulls++;
  mabState.rewardHistory.push(reward);
  if (mabState.rewardHistory.length > 500) mabState.rewardHistory.shift();

  for (const [id, a] of Object.entries(mabState.arms)) {
    if (a.pulls === 0) {
      a.ucbScore = Infinity;
    } else {
      a.ucbScore = a.avgReward + mabState.explorationFactor * Math.sqrt(Math.log(mabState.totalPulls) / a.pulls);
    }
  }

  let bestId = "", bestUCB = -Infinity;
  for (const [id, a] of Object.entries(mabState.arms)) {
    if (a.ucbScore > bestUCB) { bestUCB = a.ucbScore; bestId = id; }
  }
  mabState.bestArm = bestId;
}

export function selectBanditArm(): string {
  let bestId = "", bestUCB = -Infinity;
  for (const [id, arm] of Object.entries(mabState.arms)) {
    if (arm.ucbScore > bestUCB) {
      bestUCB = arm.ucbScore;
      bestId = id;
    }
  }
  return bestId;
}

export function getBanditStats(): {
  arms: Record<string, { pulls: number; avgReward: number; ucbScore: number }>;
  totalPulls: number;
  bestArm: string;
  explorationFactor: number;
  avgReward: number;
} {
  const arms: Record<string, { pulls: number; avgReward: number; ucbScore: number }> = {};
  for (const [id, a] of Object.entries(mabState.arms)) {
    arms[id] = { pulls: a.pulls, avgReward: Math.round(a.avgReward * 100) / 100, ucbScore: Math.round(a.ucbScore * 100) / 100 };
  }
  const avgReward = mabState.rewardHistory.length > 0
    ? mabState.rewardHistory.reduce((s, r) => s + r, 0) / mabState.rewardHistory.length : 0;

  return {
    arms, totalPulls: mabState.totalPulls, bestArm: mabState.bestArm,
    explorationFactor: mabState.explorationFactor, avgReward: Math.round(avgReward * 100) / 100,
  };
}

export function getAdvancedOptimizationStatus(): {
  simulatedAnnealing: { temperature: number; bestEnergy: number; iterations: number; improvements: number };
  geneticAlgorithm: { generation: number; bestFitness: number; populationSize: number; fitnessHistory: number[] };
  multiArmedBandit: { totalPulls: number; bestArm: string; armCount: number; avgReward: number };
} {
  return {
    simulatedAnnealing: {
      temperature: Math.round(saState.temperature * 100) / 100,
      bestEnergy: Math.round(saState.bestEnergy * 10) / 10,
      iterations: saState.iterations,
      improvements: saState.improvements,
    },
    geneticAlgorithm: {
      generation: gaState.generation,
      bestFitness: Math.round(gaState.bestFitness * 10) / 10,
      populationSize: gaState.populationSize,
      fitnessHistory: gaState.fitnessHistory.slice(-20),
    },
    multiArmedBandit: {
      totalPulls: mabState.totalPulls,
      bestArm: mabState.bestArm,
      armCount: Object.keys(mabState.arms).length,
      avgReward: mabState.rewardHistory.length > 0
        ? Math.round((mabState.rewardHistory.reduce((s, r) => s + r, 0) / mabState.rewardHistory.length) * 100) / 100
        : 0,
    },
  };
}

export function warmStartBandit(providerStats: Record<string, { avgQuality: number; totalResponses: number }>): void {
  let seeded = 0;
  for (const [providerId, stats] of Object.entries(providerStats)) {
    if (stats.totalResponses < 5) continue;
    const reward = Math.min(1, stats.avgQuality / 100);
    const syntheticPulls = Math.min(50, Math.floor(stats.totalResponses / 10));
    if (!mabState.arms[providerId]) {
      mabState.arms[providerId] = { pulls: 0, totalReward: 0, avgReward: 0, ucbScore: Infinity };
    }
    const arm = mabState.arms[providerId];
    arm.pulls += syntheticPulls;
    arm.totalReward += reward * syntheticPulls;
    arm.avgReward = arm.totalReward / arm.pulls;
    mabState.totalPulls += syntheticPulls;
    for (let i = 0; i < syntheticPulls; i++) mabState.rewardHistory.push(reward);
    seeded++;
  }
  if (mabState.rewardHistory.length > 500) mabState.rewardHistory = mabState.rewardHistory.slice(-500);
  for (const [id, a] of Object.entries(mabState.arms)) {
    if (a.pulls === 0) { a.ucbScore = Infinity; }
    else { a.ucbScore = a.avgReward + mabState.explorationFactor * Math.sqrt(Math.log(mabState.totalPulls) / a.pulls); }
  }
  let bestId = "", bestUCB = -Infinity;
  for (const [id, a] of Object.entries(mabState.arms)) {
    if (a.ucbScore > bestUCB) { bestUCB = a.ucbScore; bestId = id; }
  }
  mabState.bestArm = bestId;
  if (seeded > 0) log(`Warm-started bandit with ${seeded} providers, ${mabState.totalPulls} synthetic pulls, best: ${mabState.bestArm}`, true);
}

export function trimHistory(): number {
  let freed = 0;
  for (const ms of Object.values(state.modelScores)) {
    if (ms.history.length > 20) {
      const trimmed = ms.history.length - 20;
      ms.history = ms.history.slice(-20);
      freed += trimmed;
    }
  }
  return freed;
}

log("Swarm Optimizer module loaded", true);
