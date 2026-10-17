import {
  callLLM,
  isLLMAvailable,
  type LLMCallOptions,
  type LLMMessage,
} from "./llm-client";
import { getTesseraSystemPrompt } from "./tessera-knowledge";
import { runWithShepherdContext } from "./sovereign-fetch-guard";
import {
  CHAT_MODEL_DISABLED_REPLY,
  IDENTITY_UNAVAILABLE_REPLY,
  RESPONSE_SUPPRESSED_REPLY,
  enforceTesseraVoice,
  isIdentityQuestion,
} from "./tessera-voice";

export interface ChatHistoryMessage {
  role: string;
  content: string;
}

export interface ChatGenerationInput {
  history: ChatHistoryMessage[];
  userMessage: string;
  runtimeContext?: string;
}

export interface ChatGenerationResult {
  status: "generated" | "disabled" | "error";
  text: string;
  model: string | null;
}

export const MODEL_REQUEST_FAILED_REPLY =
  "The configured language model did not respond. No synthetic answer was substituted; retry after checking the model configuration.";

const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 1_200;
const MAX_USER_CHARS = 4_000;

export function buildTesseraChatMessages(input: ChatGenerationInput): LLMMessage[] {
  const history = Array.isArray(input.history) ? input.history : [];
  const current = input.userMessage.trim();
  let currentUserIndex = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.role === "user" && history[i]?.content?.trim() === current) {
      currentUserIndex = i;
      break;
    }
  }

  const prior = history
    .filter((message, index) => index !== currentUserIndex &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" && message.content.trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: message.content.slice(-MAX_HISTORY_CHARS),
    }));

  return [
    { role: "system", content: getTesseraSystemPrompt(input.runtimeContext ?? "") },
    ...prior,
    { role: "user", content: current.slice(0, MAX_USER_CHARS) },
  ];
}

type Completion = (messages: LLMMessage[], options: LLMCallOptions) => Promise<string>;

export interface ChatGenerationDependencies {
  isAvailable?: () => boolean;
  complete?: Completion;
  model?: string;
}

/**
 * Use an explicitly configured model, never a canned response, for open-ended
 * chat. Dependencies are injectable so the contract can be tested offline.
 */
export async function generateConfiguredChatReply(
  input: ChatGenerationInput,
  dependencies: ChatGenerationDependencies = {},
): Promise<ChatGenerationResult> {
  const available = dependencies.isAvailable ?? isLLMAvailable;
  const identityQuestion = isIdentityQuestion(input.userMessage);
  if (!available()) {
    return {
      status: "disabled",
      text: identityQuestion
        ? `${IDENTITY_UNAVAILABLE_REPLY}\n\n${CHAT_MODEL_DISABLED_REPLY}`
        : CHAT_MODEL_DISABLED_REPLY,
      model: null,
    };
  }

  const model = dependencies.model ?? process.env.TESSERA_LLM_MODEL ?? "configured-model";
  const complete = dependencies.complete ?? callLLM;
  try {
    const raw = await runWithShepherdContext("shepherd-proxy", () => complete(buildTesseraChatMessages(input), {
      model,
      maxTokens: 1_200,
      timeoutMs: 20_000,
      skipDistillation: true,
      skipDreamPrompt: true,
      skipBatcher: true,
    }), "configured Tessera chat completion");
    const text = enforceTesseraVoice(raw, input.userMessage);
    if (text === IDENTITY_UNAVAILABLE_REPLY) {
      return { status: "error", text, model };
    }
    if (!text || text === RESPONSE_SUPPRESSED_REPLY) {
      return { status: "error", text: MODEL_REQUEST_FAILED_REPLY, model };
    }
    return { status: "generated", text, model };
  } catch {
    return { status: "error", text: MODEL_REQUEST_FAILED_REPLY, model };
  }
}
