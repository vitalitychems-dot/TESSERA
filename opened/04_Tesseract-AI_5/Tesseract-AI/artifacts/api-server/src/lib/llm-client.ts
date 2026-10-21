import OpenAI from "openai";
import { runInSandbox } from "./external-call-sandbox";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  console.warn("[LLM Client] AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY not set. LLM features will use fallbacks.");
}

let _externalCallRecorder: (() => void) | null = null;
export function setExternalCallRecorder(fn: () => void): void {
  _externalCallRecorder = fn;
}

type FullCallLogger = (params: {
  providerId: string;
  providerType: string;
  taskType: string;
  requestPayload: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  responseText?: string;
  latencyMs: number;
  success: boolean;
  errorMessage?: string;
  tokensUsed?: number;
  modelUsed?: string;
  metadata?: Record<string, unknown>;
}) => void;

let _fullCallLogger: FullCallLogger | null = null;
export function setFullCallLogger(fn: FullCallLogger): void {
  _fullCallLogger = fn;
}

type InternalRouter = (params: {
  taskType: string;
  prompt: string;
  systemPrompt?: string;
  forceInternal?: boolean;
}) => Promise<{ result: string | null; routedTo: "internal" | "external"; internalCapabilityScore: number }>;

let _internalRouter: InternalRouter | null = null;
export function setInternalRouter(fn: InternalRouter): void {
  _internalRouter = fn;
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export function isLLMConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

let chatEndpointBroken = false;
let chatFailCount = 0;
let lastChatFailTime = 0;

export async function llmChat(params: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
  taskType?: string;
  skipInternalRouter?: boolean;
}): Promise<string | null> {
  if (chatEndpointBroken && Date.now() - lastChatFailTime < 300000) return null;
  if (chatEndpointBroken) {
    chatEndpointBroken = false;
    chatFailCount = 0;
  }

  const taskType = params.taskType ?? "general";

  if (!params.skipInternalRouter && _internalRouter) {
    try {
      const routeResult = await _internalRouter({
        taskType,
        prompt: params.userPrompt,
        systemPrompt: params.systemPrompt,
        forceInternal: false,
      });
      if (routeResult.routedTo === "internal" && routeResult.result !== null) {
        return routeResult.result;
      }
    } catch {
      /* internal router failure is non-fatal — fall through to external */
    }
  }

  if (!isLLMConfigured()) return null;

  const start = Date.now();
  const modelUsed = params.model ?? "gpt-5-mini";

  const requestPayload: Record<string, unknown> = {
    model: modelUsed,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    maxTokens: params.maxTokens ?? 1024,
    taskType,
  };

  _externalCallRecorder?.();

  const sandboxResult = await runInSandbox<OpenAI.Chat.Completions.ChatCompletion>({
    providerId: "openai-integration",
    providerType: "llm",
    taskType,
    payload: requestPayload,
    fn: async (sanitized) => {
      const s = sanitized as Record<string, unknown>;
      const safeModel = (typeof s.model === "string" ? s.model : modelUsed);
      const safeSystem = (typeof s.systemPrompt === "string" ? s.systemPrompt : params.systemPrompt);
      const safeUser = (typeof s.userPrompt === "string" ? s.userPrompt : params.userPrompt);
      const safeTokens = (typeof s.maxTokens === "number" ? s.maxTokens : params.maxTokens ?? 1024);
      return openai.chat.completions.create({
        model: safeModel,
        max_completion_tokens: safeTokens,
        messages: [
          { role: "system", content: safeSystem },
          { role: "user", content: safeUser },
        ],
      });
    },
  });

  if (!sandboxResult.success || !sandboxResult.data) {
    const errorMessage = sandboxResult.blocked ?? sandboxResult.error ?? "sandbox blocked or failed";

    _fullCallLogger?.({
      providerId: "openai-integration",
      providerType: "llm",
      taskType,
      requestPayload,
      responsePayload: { blocked: sandboxResult.blocked, error: sandboxResult.error },
      latencyMs: sandboxResult.latencyMs,
      success: false,
      errorMessage,
      modelUsed,
      metadata: { source: "llm-client", sandboxCallId: sandboxResult.callId, blocked: !!sandboxResult.blocked },
    });

    chatFailCount++;
    lastChatFailTime = Date.now();
    if (chatFailCount >= 3) {
      chatEndpointBroken = true;
      console.log("[LLM Client] Chat endpoint unavailable — skipping for 5 minutes");
    } else if (!sandboxResult.blocked) {
      console.error("[LLM Client] Chat call failed:", errorMessage);
    }
    return null;
  }

  const response = sandboxResult.data;
  const responseText = response.choices[0]?.message?.content ?? null;
  const tokensUsed = response.usage?.total_tokens ?? 0;

  const responsePayload: Record<string, unknown> = {
    id: response.id,
    model: response.model,
    choices: response.choices,
    usage: response.usage,
    created: response.created,
  };

  _fullCallLogger?.({
    providerId: "openai-integration",
    providerType: "llm",
    taskType,
    requestPayload,
    responsePayload,
    responseText: responseText ?? undefined,
    latencyMs: sandboxResult.latencyMs,
    success: true,
    tokensUsed,
    modelUsed,
    metadata: { source: "llm-client", sandboxCallId: sandboxResult.callId, sanitized: sandboxResult.sanitized },
  });

  chatFailCount = 0;
  return responseText;
}
