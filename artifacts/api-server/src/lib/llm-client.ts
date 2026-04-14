import OpenAI from "openai";
import { logger } from "./logger";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
    const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "_DUMMY_API_KEY_";
    if (!baseURL) {
      throw new Error("AI_INTEGRATIONS_OPENAI_BASE_URL not set");
    }
    _client = new OpenAI({ baseURL, apiKey });
  }
  return _client;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMCallOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export async function callLLM(
  messages: LLMMessage[],
  opts: LLMCallOptions = {}
): Promise<string> {
  const {
    model = "gpt-5-mini",
    maxTokens = 2048,
    timeoutMs = 15_000,
  } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const client = getClient();
    const response = await client.chat.completions.create(
      {
        model,
        max_completion_tokens: maxTokens,
        messages,
      },
      { signal: controller.signal as AbortSignal }
    );
    return response.choices[0]?.message?.content ?? "";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg, model }, "LLMClient: call failed");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function callLLMSafe(
  messages: LLMMessage[],
  opts: LLMCallOptions = {},
  fallback = ""
): Promise<string> {
  try {
    return await callLLM(messages, opts);
  } catch {
    return fallback;
  }
}

export function isLLMAvailable(): boolean {
  return !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
}
