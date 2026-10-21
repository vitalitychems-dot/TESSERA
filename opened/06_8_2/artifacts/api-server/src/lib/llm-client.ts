import OpenAI from "openai";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  console.warn("[LLM Client] AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY not set. LLM features will use fallbacks.");
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy",
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export function isLLMConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}

export async function llmChat(params: {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  maxTokens?: number;
}): Promise<string | null> {
  if (!isLLMConfigured()) return null;

  try {
    const response = await openai.chat.completions.create({
      model: params.model ?? "gpt-5-mini",
      max_completion_tokens: params.maxTokens ?? 1024,
      messages: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
    });
    return response.choices[0]?.message?.content ?? null;
  } catch (err) {
    console.error("[LLM Client] Chat call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
