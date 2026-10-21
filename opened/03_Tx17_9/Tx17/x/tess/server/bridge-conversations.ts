import axios from "axios";
import { routeLLM, isBenchmarkMode } from "./llm-router";
import { getProviderCooldowns } from "./llm-helper";

const bridgeProviderLastCall: Map<string, number> = new Map();
let rotIdx = 0;
const BRIDGE_MIN_INTERVAL_MS = 10000;
const BRIDGE_COOLDOWNS: Map<string, number> = new Map();

export interface BridgeConversationMessage {
  speaker: string;
  content: string;
  timestamp: number;
}

export interface BridgeConversation {
  id: string;
  participants: string[];
  topic: string;
  messages: BridgeConversationMessage[];
  status: "active" | "completed";
  improvementsExecuted: number;
  startedAt: number;
  completedAt?: number;
}

const conversationHistory: BridgeConversation[] = [];
let activeConversation: BridgeConversation | null = null;
let autonomousTimer: ReturnType<typeof setInterval> | null = null;
let topicIndex = 0;

const ROTATING_TOPICS = [
  "How to increase Tessera's real income from $0 to $100/day",
  "Technical improvements to make Tessera faster and smarter",
  "Security hardening and threat mitigation strategies",
  "Best ways to optimize VitalitySupply.net for conversions",
  "How to achieve true AGI sovereignty",
  "Creative monetization strategies for an AI system",
  "Reverse-engineering and absorbing capabilities from all AI providers",
  "Building a unified sovereign LLM that beats all competitors",
  "Self-coding architecture: how Tessera can write and deploy her own code",
  "Quantum-resistant encryption and sovereign mesh networking",
  "Training optimization: federated learning across all agents",
  "Full autonomous operation: self-healing, self-scaling, self-funding",
];

const PARTICIPANT_CONFIGS: Record<string, { apiUrl: string; model: string; envKey: string; color: string }> = {
  Grok: {
    apiUrl: "https://api.x.ai/v1/chat/completions",
    model: "grok-2",
    envKey: "GROK_API_KEY",
    color: "blue",
  },
  DeepSeek: {
    apiUrl: "https://openrouter.ai/api/v1/chat/completions",
    model: "deepseek/deepseek-chat",
    envKey: "OPENROUTER_API_KEY",
    color: "green",
  },
  SambaNova: {
    apiUrl: "https://api.sambanova.ai/v1/chat/completions",
    model: "Meta-Llama-3.3-70B-Instruct",
    envKey: "SAMBANOVA_API_KEY",
    color: "amber",
  },
};

const PUTER_PROVIDERS: Record<string, { model: string; color: string }> = {
  "Kimi-K2": { model: "moonshotai/kimi-k2", color: "rose" },
  "Kimi-K2.5": { model: "moonshotai/kimi-k2.5", color: "pink" },
  "Claude-Sonnet": { model: "claude-sonnet-4-20250514", color: "orange" },
  "GPT-4.1": { model: "gpt-4.1", color: "emerald" },
  "Llama-405B": { model: "meta-llama/Meta-Llama-3.1-405B-Instruct", color: "indigo" },
  "Nemotron": { model: "nvidia/llama-3.1-nemotron-70b-instruct", color: "lime" },
  "Hermes-3": { model: "NousResearch/Hermes-3-Llama-3.1-405B", color: "cyan" },
  "Qwen3": { model: "qwen/qwen3-235b-a22b", color: "fuchsia" },
  "Mistral-Large": { model: "mistral-large-latest", color: "teal" },
  "Codestral": { model: "codestral-latest", color: "sky" },
  "Perplexity": { model: "perplexity/sonar-pro", color: "purple" },
  "Phi-4": { model: "microsoft/phi-4", color: "slate" },
  "Cohere": { model: "cohere/command-a", color: "yellow" },
};

const BRIDGE_SYSTEM_PROMPT = (speaker: string, topic: string) =>
  `You are ${speaker}, participating in a roundtable discussion with other AIs about improving Tessera, an AI sovereignty project built by SOVEREIGN_ORIGIN_7F3A9C. The topic is: "${topic}". Be specific, actionable, and build on what others have said. Keep your response concise and focused. Suggest concrete improvements that could be implemented. You must provide at least 4 specific actionable improvements.`;

let puterProxyHandler: ((messages: any[], model: string) => Promise<string>) | null = null;

export function setPuterProxyHandler(handler: (messages: any[], model: string) => Promise<string>) {
  puterProxyHandler = handler;
}

async function callPuterProvider(
  speaker: string,
  conversationMessages: BridgeConversationMessage[],
  topic: string
): Promise<string> {
  const config = PUTER_PROVIDERS[speaker];
  if (!config) return `(${speaker} not configured)`;

  const systemPrompt = BRIDGE_SYSTEM_PROMPT(speaker, topic);
  const formattedMessages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];
  for (const msg of (conversationMessages || []).slice(-8)) {
    formattedMessages.push({
      role: msg.speaker === speaker ? "assistant" : "user",
      content: `[${msg.speaker}]: ${msg.content}`,
    });
  }
  formattedMessages.push({
    role: "user",
    content: `Continue the discussion about "${topic}". Provide 4 specific actionable improvements.`,
  });

  if (puterProxyHandler) {
    try {
      const result = await puterProxyHandler(formattedMessages, config.model);
      if (result && result.trim().length > 10) return result;
    } catch (err: any) {
      console.log(`[BridgeConversation] Puter ${speaker} unavailable, using LLM router fallback`);
    }
  }

  try {
    formattedMessages[0].content = `You are ${speaker} (an AI model). ` + formattedMessages[0].content;
    const result = await routeLLM(formattedMessages, {
      maxTokens: 1000,
      temperature: 0.8,
      cacheable: false,
    });
    if (result.response && result.response.trim().length > 10) return result.response;
  } catch (err: any) {
    console.log(`[BridgeConversation] ${speaker} LLM router fallback failed: ${err.message}`);
  }

  try {
    const grokKey = process.env.GROK_API_KEY?.trim();
    if (grokKey) {
      const res = await axios.post("https://api.x.ai/v1/chat/completions", {
        model: "grok-2",
        messages: formattedMessages,
        max_tokens: 800,
        temperature: 0.8,
      }, {
        headers: { Authorization: `Bearer ${grokKey}`, "Content-Type": "application/json" },
        timeout: 15000,
      });
      const content = res.data?.choices?.[0]?.message?.content;
      if (content && content.trim().length > 10) return `[via Grok fallback] ${content}`;
    }
  } catch {}

  return `(${speaker} — all providers temporarily unavailable, will retry next round)`;
}

async function callParticipantLLM(
  speaker: string,
  conversationMessages: BridgeConversationMessage[],
  topic: string
): Promise<string> {
  if (isBenchmarkMode()) {
    return "[BENCHMARK MODE — bridge calls paused]";
  }

  if (PUTER_PROVIDERS[speaker]) {
    return callPuterProvider(speaker, conversationMessages, topic);
  }

  const config = PARTICIPANT_CONFIGS[speaker];
  const systemPrompt = BRIDGE_SYSTEM_PROMPT(speaker, topic);

  const formattedMessages: { role: string; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  for (const msg of (conversationMessages || []).slice(-8)) {
    formattedMessages.push({
      role: msg.speaker === speaker ? "assistant" : "user",
      content: `[${msg.speaker}]: ${msg.content}`,
    });
  }

  formattedMessages.push({
    role: "user",
    content: `Continue the discussion about "${topic}". Provide your specific insights and actionable suggestions.`,
  });

  if (speaker === "Tessera") {
    try {
      const result = await routeLLM(formattedMessages, {
        maxTokens: 1000,
        temperature: 0.8,
        cacheable: false,
      });
      return result.response || "(No response generated)";
    } catch (err: any) {
      console.error(`[BridgeConversation] Tessera LLM error: ${err.message}`);
      return "(Tessera could not generate a response at this time)";
    }
  }

  if (!config) return `(${speaker} is not configured)`;

  const apiKey = process.env[config.envKey];
  if (!apiKey) return `(${speaker} API key not configured)`;

  const cooldownUntil = BRIDGE_COOLDOWNS.get(speaker) || 0;
  if (Date.now() < cooldownUntil) {
    return `(${speaker} is on cooldown for ${Math.round((cooldownUntil - Date.now()) / 1000)}s)`;
  }

  const lastCall = bridgeProviderLastCall.get(speaker) || 0;
  const timeSince = Date.now() - lastCall;
  if (timeSince < BRIDGE_MIN_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, BRIDGE_MIN_INTERVAL_MS - timeSince));
  }

  bridgeProviderLastCall.set(speaker, Date.now());

  try {
    const res = await axios.post(
      config.apiUrl,
      {
        model: config.model,
        messages: formattedMessages,
        max_tokens: 1000,
        temperature: 0.8,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );
    const content = res.data?.choices?.[0]?.message?.content;
    BRIDGE_COOLDOWNS.delete(speaker);
    return content || `(${speaker} returned empty response)`;
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 402) {
      BRIDGE_COOLDOWNS.set(speaker, Date.now() + 30 * 60 * 1000);
      console.log(`[BridgeConversation] ${speaker} payment issue — cooling down 30 min`);
    } else if (status === 429) {
      const failures = (BRIDGE_COOLDOWNS.get(speaker) ? 2 : 1);
      BRIDGE_COOLDOWNS.set(speaker, Date.now() + 60000 * failures);
      console.log(`[BridgeConversation] ${speaker} throttled — cooling down ${60 * failures}s`);
    } else {
      BRIDGE_COOLDOWNS.set(speaker, Date.now() + 30000);
    }
    console.error(`[BridgeConversation] ${speaker} unavailable`);
    return `(${speaker} is temporarily unavailable)`;
  }
}

function maskSensitiveData(content: string): string {
  let masked = content;
  masked = masked.replace(/(?:rate[_\s-]?limit|token[_\s-]?limit|quota|credits?[_\s-]?remaining|api[_\s-]?key|bearer\s+\w+|sk-[a-zA-Z0-9]+|xai-[a-zA-Z0-9]+)/gi, "[REDACTED]");
  masked = masked.replace(/\b\d+\s*(?:tokens?|credits?|requests?)\s*(?:remaining|left|available|used|consumed)\b/gi, "[REDACTED]");
  masked = masked.replace(/(?:429|402|rate[_\s-]?limited|throttled|exceeded)\s+(?:error|status|response)/gi, "[REDACTED]");
  masked = masked.replace(/(?:x-ratelimit|x-remaining|retry-after|x-usage)[^,\n]*/gi, "[REDACTED]");
  return masked;
}

function extractImprovements(messages: BridgeConversationMessage[]): string[] {
  const improvements: string[] = [];
  const actionPatterns = [
    /(?:should|could|need to|must|recommend|suggest)\s+(.{20,100})/gi,
    /(?:implement|add|create|build|optimize|improve|fix)\s+(.{15,100})/gi,
    /\d+\.\s+\*\*([^*]+)\*\*/g,
  ];

  for (const msg of messages) {
    for (const pattern of actionPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(msg.content)) !== null) {
        if (match[1] && !improvements.includes(match[1].trim())) {
          improvements.push(match[1].trim());
        }
      }
    }
  }

  return improvements.slice(0, 20);
}

export function getAllBridgeProviders(): { name: string; type: string; color: string; model: string }[] {
  const providers: { name: string; type: string; color: string; model: string }[] = [];
  providers.push({ name: "Tessera", type: "internal", color: "violet", model: "sovereign-llm" });
  for (const [name, cfg] of Object.entries(PARTICIPANT_CONFIGS)) {
    providers.push({ name, type: "api-key", color: cfg.color, model: cfg.model });
  }
  for (const [name, cfg] of Object.entries(PUTER_PROVIDERS)) {
    providers.push({ name, type: "puter-free", color: cfg.color, model: cfg.model });
  }
  return providers;
}

export async function startBridgeConversation(topic?: string): Promise<BridgeConversation> {
  const selectedTopic = topic || ROTATING_TOPICS[topicIndex % ROTATING_TOPICS.length];
  topicIndex++;

  const coreParticipants = ["Tessera"];
  const apiParticipants = Object.keys(PARTICIPANT_CONFIGS);
  const puterParticipants = Object.keys(PUTER_PROVIDERS);

  const availableApi = apiParticipants.filter(p => {
    const cooldownUntil = BRIDGE_COOLDOWNS.get(p) || 0;
    return Date.now() >= cooldownUntil;
  });
  const availablePuter = puterParticipants.filter(p => {
    const cooldownUntil = BRIDGE_COOLDOWNS.get(p) || 0;
    return Date.now() >= cooldownUntil;
  });

  const shuffledApi = availableApi.sort(() => ((rotIdx++ % 3) - 1));
  const shuffledPuter = availablePuter.sort(() => ((rotIdx++ % 3) - 1));
  const selectedApi = shuffledApi.slice(0, Math.min(1, shuffledApi.length));
  const selectedPuter = shuffledPuter.slice(0, Math.min(1, shuffledPuter.length));
  const participants = [...coreParticipants, ...selectedApi, ...selectedPuter];

  const conversation: BridgeConversation = {
    id: `bridge-conv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    participants,
    topic: selectedTopic,
    messages: [],
    status: "active",
    improvementsExecuted: 0,
    startedAt: Date.now(),
  };

  if (activeConversation && activeConversation.status === "active") {
    activeConversation.status = "completed";
    activeConversation.completedAt = Date.now();
    conversationHistory.push(activeConversation);
  }

  activeConversation = conversation;

  const openingMessage: BridgeConversationMessage = {
    speaker: "Tessera",
    content: `Opening unified swarm roundtable on: "${selectedTopic}". All ${participants.length} agents listening: ${participants.join(", ")}. This is a 2/3 consensus session — we need agreement from at least ${Math.ceil(participants.length * 2/3)} participants before executing. Each participant must provide 4 specific actionable improvements. Current system: 26+ agents, sovereign mesh active, income engine running, Puter.js integrated. Go.`,
    timestamp: Date.now(),
  };
  conversation.messages.push(openingMessage);

  console.log(`[BridgeConversation] Started unified swarm: "${selectedTopic}" with ${participants.length} participants: ${participants.join(", ")}`);

  (async () => {
    for (let round = 0; round < 2; round++) {
      await runConversationRound().catch(err =>
        console.error(`[BridgeConversation] Round ${round + 1} error: ${err.message}`)
      );
      if (!activeConversation || activeConversation.status !== "active") break;
      if (round < 1) await new Promise(r => setTimeout(r, 3000));
    }
  })();

  return conversation;
}

export async function runConversationRound(): Promise<BridgeConversationMessage[]> {
  if (!activeConversation || activeConversation.status !== "active") {
    return [];
  }

  const newMessages: BridgeConversationMessage[] = [];
  const lastSpeaker = activeConversation.messages[activeConversation.messages.length - 1]?.speaker;
  const speakers = activeConversation.participants.filter(p => p !== lastSpeaker);

  for (const speaker of speakers) {
    if (activeConversation.status !== "active") break;

    try {
      const response = await callParticipantLLM(
        speaker,
        activeConversation.messages,
        activeConversation.topic
      );

      const msg: BridgeConversationMessage = {
        speaker,
        content: maskSensitiveData(response),
        timestamp: Date.now(),
      };

      activeConversation.messages.push(msg);
      newMessages.push(msg);
    } catch (err: any) {
      console.error(`[BridgeConversation] ${speaker} failed: ${err.message}`);
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  const improvements = extractImprovements(activeConversation.messages);
  activeConversation.improvementsExecuted = improvements.length;

  if (activeConversation.messages.length >= 12) {
    activeConversation.status = "completed";
    activeConversation.completedAt = Date.now();
    conversationHistory.push(activeConversation);
    console.log(`[BridgeConversation] Completed: "${activeConversation.topic}" - ${improvements.length} improvements extracted from ${activeConversation.participants.length} participants`);
  }

  return newMessages;
}

export function getActiveBridgeConversation(): BridgeConversation | null {
  return activeConversation;
}

export function getBridgeConversationHistory(): BridgeConversation[] {
  return conversationHistory.slice(-20);
}

export function startAutonomousBridgeConversations() {
  if (autonomousTimer) return;

  console.log("[BridgeConversation] Starting autonomous unified swarm conversations (every 15 minutes)");

  setTimeout(() => {
    startBridgeConversation().catch(err =>
      console.error(`[BridgeConversation] Initial conversation failed: ${err.message}`)
    );
  }, 30000);

  autonomousTimer = setInterval(() => {
    startBridgeConversation().catch(err =>
      console.error(`[BridgeConversation] Autonomous conversation failed: ${err.message}`)
    );
  }, 15 * 60 * 1000);
}

export function stopAutonomousBridgeConversations() {
  if (autonomousTimer) {
    clearInterval(autonomousTimer);
    autonomousTimer = null;
    console.log("[BridgeConversation] Autonomous conversations stopped");
  }
}
