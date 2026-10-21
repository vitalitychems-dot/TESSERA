import crypto from "crypto";

const log = (m: string) => console.log(`[Normalization] ${m}`);

interface RawPayload {
  requestBody: string;
  responseBody: string;
  requestHeaders: Record<string, string>;
  responseHeaders: Record<string, string>;
}

interface NormalizedProviderResponse {
  providerId: string;
  providerName: string;
  model: string;
  content: string;
  tokensUsed: number;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  timestamp: number;
  quality: number;
  format: "openai" | "gemini" | "anthropic" | "puter" | "unknown";
  metadata: {
    rawResponseSize: number;
    contentHash: string;
    truncated: boolean;
    finishReason: string;
    modelVersion: string;
  };
  rawPayload?: RawPayload;
  success: boolean;
  error?: string;
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  model?: string;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  modelVersion?: string;
}

interface AnthropicResponse {
  content?: Array<{ text?: string; type?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
  stop_reason?: string;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

function hashContent(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function normalizeOpenAIResponse(
  data: OpenAIResponse,
  providerId: string,
  providerName: string,
  model: string,
  latencyMs: number,
  raw?: RawPayload,
): NormalizedProviderResponse {
  const content = data.choices?.[0]?.message?.content || "";
  const promptTokens = data.usage?.prompt_tokens || 0;
  const completionTokens = data.usage?.completion_tokens || estimateTokens(content);
  const tokensUsed = data.usage?.total_tokens || (promptTokens + completionTokens);

  return {
    providerId,
    providerName,
    model: data.model || model,
    content,
    tokensUsed,
    promptTokens,
    completionTokens,
    latencyMs,
    timestamp: Date.now(),
    quality: 0,
    format: "openai",
    metadata: {
      rawResponseSize: JSON.stringify(data).length,
      contentHash: hashContent(content),
      truncated: data.choices?.[0]?.finish_reason === "length",
      finishReason: data.choices?.[0]?.finish_reason || "unknown",
      modelVersion: data.model || model,
    },
    rawPayload: raw,
    success: content.length > 0,
    error: content.length === 0 ? "Empty response" : undefined,
  };
}

export function normalizeGeminiResponse(
  data: GeminiResponse,
  providerId: string,
  providerName: string,
  model: string,
  latencyMs: number,
  raw?: RawPayload,
): NormalizedProviderResponse {
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const promptTokens = data.usageMetadata?.promptTokenCount || 0;
  const completionTokens = data.usageMetadata?.candidatesTokenCount || estimateTokens(content);
  const tokensUsed = data.usageMetadata?.totalTokenCount || (promptTokens + completionTokens);

  return {
    providerId,
    providerName,
    model: data.modelVersion || model,
    content,
    tokensUsed,
    promptTokens,
    completionTokens,
    latencyMs,
    timestamp: Date.now(),
    quality: 0,
    format: "gemini",
    metadata: {
      rawResponseSize: JSON.stringify(data).length,
      contentHash: hashContent(content),
      truncated: data.candidates?.[0]?.finishReason === "MAX_TOKENS",
      finishReason: data.candidates?.[0]?.finishReason || "unknown",
      modelVersion: data.modelVersion || model,
    },
    rawPayload: raw,
    success: content.length > 0,
    error: content.length === 0 ? "Empty response" : undefined,
  };
}

export function normalizeAnthropicResponse(
  data: AnthropicResponse,
  providerId: string,
  providerName: string,
  model: string,
  latencyMs: number,
  raw?: RawPayload,
): NormalizedProviderResponse {
  const content = data.content?.filter(c => c.type === "text").map(c => c.text).join("\n") || "";
  const promptTokens = data.usage?.input_tokens || 0;
  const completionTokens = data.usage?.output_tokens || estimateTokens(content);
  const tokensUsed = promptTokens + completionTokens;

  return {
    providerId,
    providerName,
    model: data.model || model,
    content,
    tokensUsed,
    promptTokens,
    completionTokens,
    latencyMs,
    timestamp: Date.now(),
    quality: 0,
    format: "anthropic",
    metadata: {
      rawResponseSize: JSON.stringify(data).length,
      contentHash: hashContent(content),
      truncated: data.stop_reason === "max_tokens",
      finishReason: data.stop_reason || "unknown",
      modelVersion: data.model || model,
    },
    rawPayload: raw,
    success: content.length > 0,
    error: content.length === 0 ? "Empty response" : undefined,
  };
}

export function normalizeGenericResponse(
  responseText: string,
  providerId: string,
  providerName: string,
  model: string,
  latencyMs: number,
  format: NormalizedProviderResponse["format"] = "unknown",
): NormalizedProviderResponse {
  const completionTokens = estimateTokens(responseText);
  return {
    providerId,
    providerName,
    model,
    content: responseText,
    tokensUsed: completionTokens,
    promptTokens: 0,
    completionTokens,
    latencyMs,
    timestamp: Date.now(),
    quality: 0,
    format,
    metadata: {
      rawResponseSize: responseText.length,
      contentHash: hashContent(responseText),
      truncated: false,
      finishReason: "stop",
      modelVersion: model,
    },
    success: responseText.length > 0,
    error: responseText.length === 0 ? "Empty response" : undefined,
  };
}

export function scoreNormalizedQuality(resp: NormalizedProviderResponse, promptLength: number): number {
  if (!resp.success) return 0;
  let score = 0;

  const lengthRatio = resp.content.length / Math.max(promptLength, 1);
  if (lengthRatio > 0.5) score += 20;
  if (lengthRatio > 1.0) score += 10;
  if (lengthRatio > 2.0) score += 5;

  const uniqueWords = new Set(resp.content.toLowerCase().split(/\s+/)).size;
  const totalWords = resp.content.split(/\s+/).length;
  const lexicalDiversity = totalWords > 0 ? uniqueWords / totalWords : 0;
  if (lexicalDiversity > 0.4) score += 15;
  if (lexicalDiversity > 0.6) score += 10;

  if (resp.content.includes("\n")) score += 5;
  if (/```/.test(resp.content)) score += 5;
  if (/^\d+\.|^[-*•]/m.test(resp.content)) score += 5;

  if (resp.latencyMs < 3000) score += 10;
  else if (resp.latencyMs < 5000) score += 5;

  if (!resp.metadata.truncated) score += 10;

  score += 5;

  return Math.min(100, Math.max(0, score));
}

export type { NormalizedProviderResponse, RawPayload };
