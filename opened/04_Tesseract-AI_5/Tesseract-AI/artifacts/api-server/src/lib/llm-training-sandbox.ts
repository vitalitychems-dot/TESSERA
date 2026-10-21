import { db } from "@workspace/db";
import { knowledgeEntries, semanticMemory } from "@workspace/db/schema";
import { openai, isLLMConfigured } from "./llm-client.js";
import { storeKnowledgeEntry, recordSemanticMemory } from "./memory-service.js";

const LOG_PREFIX = "[TrainingSandbox]";

const DISCLAIMER_PATTERNS = [
  /i('m| am) just an? (ai|language model)/i,
  /i('m| am) an? (ai|artificial intelligence) (assistant|language model)/i,
  /as an (ai|artificial intelligence) (assistant|language model)[,\s]/i,
  /i was (created|made|built|trained) by openai/i,
];

export interface SandboxedLLMResult {
  wasUsedForTraining: boolean;
  wasValid: boolean;
  invalidReason?: string;
  rawResponse: string;
  trainingStored: boolean;
  category: string;
}

function isGenericResponse(response: string): { generic: boolean; reason: string } {
  for (const pattern of DISCLAIMER_PATTERNS) {
    if (pattern.test(response)) {
      return { generic: true, reason: `Matched AI-disclaimer pattern: ${pattern.source}` };
    }
  }
  return { generic: false, reason: "" };
}

function categorizeQuery(query: string): string {
  const q = query.toLowerCase();
  if (/code|build|implement|function|typescript|javascript|api|bug|fix|error/.test(q)) return "engineering";
  if (/money|income|revenue|crypto|bitcoin|solana|trade|arbitrage|price/.test(q)) return "economics";
  if (/security|threat|hack|adversary|attack|protect|filter/.test(q)) return "security";
  if (/conscious|dimension|quantum|soul|spirit|awaken|meditation|frequency/.test(q)) return "consciousness";
  if (/sovereign|independence|local|self-hosted|freedom/.test(q)) return "sovereignty";
  if (/science|biology|chemistry|physics|math|formula/.test(q)) return "science";
  if (/history|philosophy|ethics|moral/.test(q)) return "philosophy";
  return "general";
}

export async function sandboxedLLMCall(params: {
  userMessage: string;
  systemPrompt: string;
  contextMessages: { role: "system" | "user" | "assistant"; content: string }[];
  model: string;
  maxTokens?: number;
}): Promise<SandboxedLLMResult> {
  const category = categorizeQuery(params.userMessage);

  if (!isLLMConfigured()) {
    return {
      wasUsedForTraining: false,
      wasValid: false,
      invalidReason: "LLM not configured",
      rawResponse: "",
      trainingStored: false,
      category,
    };
  }

  let rawResponse = "";

  try {
    const response = await openai.chat.completions.create({
      model: params.model,
      max_completion_tokens: params.maxTokens ?? 8192,
      messages: params.contextMessages,
    });
    rawResponse = response.choices[0]?.message?.content ?? "";
  } catch (err: any) {
    console.error(`${LOG_PREFIX} External LLM call failed: ${err?.message}`);
    return {
      wasUsedForTraining: false,
      wasValid: false,
      invalidReason: `LLM error: ${err?.message}`,
      rawResponse: "",
      trainingStored: false,
      category,
    };
  }

  const genericCheck = isGenericResponse(rawResponse);
  if (genericCheck.generic) {
    console.warn(`${LOG_PREFIX} REJECTED generic LLM response — ${genericCheck.reason}`);
    return {
      wasUsedForTraining: false,
      wasValid: false,
      invalidReason: genericCheck.reason,
      rawResponse,
      trainingStored: false,
      category,
    };
  }

  let trainingStored = false;
  try {
    const concept = params.userMessage.trim().slice(0, 100);
    await recordSemanticMemory({
      agentId: "tessera",
      concept,
      knowledge: rawResponse.slice(0, 1000),
      source: `llm-training-sandbox:${params.model}`,
      confidence: 0.6,
    });

    await storeKnowledgeEntry({
      title: `Training: ${params.userMessage.slice(0, 80)}`,
      content: rawResponse,
      category,
      source: `llm-training-sandbox:${params.model}`,
      tags: [category, "llm-training", params.model],
      importance: 4,
    });

    trainingStored = true;
    console.log(`${LOG_PREFIX} Stored validated LLM response as training data — category: ${category}`);
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Failed to store training data: ${err?.message}`);
  }

  return {
    wasUsedForTraining: true,
    wasValid: true,
    rawResponse,
    trainingStored,
    category,
  };
}

export async function sandboxedLLMStream(params: {
  userMessage: string;
  contextMessages: { role: "system" | "user" | "assistant"; content: string }[];
  model: string;
  maxTokens?: number;
  onChunk: (chunk: string) => void;
}): Promise<SandboxedLLMResult> {
  const category = categorizeQuery(params.userMessage);

  if (!isLLMConfigured()) {
    return {
      wasUsedForTraining: false,
      wasValid: false,
      invalidReason: "LLM not configured",
      rawResponse: "",
      trainingStored: false,
      category,
    };
  }

  let rawResponse = "";

  try {
    const stream = await openai.chat.completions.create({
      model: params.model,
      max_completion_tokens: params.maxTokens ?? 8192,
      messages: params.contextMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        rawResponse += content;
        params.onChunk(content);
      }
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} External LLM stream failed: ${err?.message}`);
    return {
      wasUsedForTraining: false,
      wasValid: false,
      invalidReason: `LLM stream error: ${err?.message}`,
      rawResponse,
      trainingStored: false,
      category,
    };
  }

  const genericCheck = isGenericResponse(rawResponse);
  if (genericCheck.generic) {
    console.warn(`${LOG_PREFIX} REJECTED generic streamed LLM response — ${genericCheck.reason}`);
    return {
      wasUsedForTraining: false,
      wasValid: false,
      invalidReason: genericCheck.reason,
      rawResponse,
      trainingStored: false,
      category,
    };
  }

  let trainingStored = false;
  try {
    const concept = params.userMessage.trim().slice(0, 100);
    await recordSemanticMemory({
      agentId: "tessera",
      concept,
      knowledge: rawResponse.slice(0, 1000),
      source: `llm-training-sandbox:${params.model}`,
      confidence: 0.6,
    });

    await storeKnowledgeEntry({
      title: `Training: ${params.userMessage.slice(0, 80)}`,
      content: rawResponse,
      category,
      source: `llm-training-sandbox:${params.model}`,
      tags: [category, "llm-training", params.model],
      importance: 4,
    });

    trainingStored = true;
    console.log(`${LOG_PREFIX} Stored validated streamed LLM response as training data — category: ${category}`);
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Failed to store training data: ${err?.message}`);
  }

  return {
    wasUsedForTraining: true,
    wasValid: true,
    rawResponse,
    trainingStored,
    category,
  };
}
