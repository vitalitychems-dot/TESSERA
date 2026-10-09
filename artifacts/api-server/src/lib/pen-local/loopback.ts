import { LOCAL_PEN_PARAMS, type LocalPenMessage } from "./types";

export const DEFAULT_LOCAL_PEN_URL = "http://127.0.0.1:8765";

/**
 * Literal loopback only. A hostname such as localhost is resolved through DNS,
 * so it is rejected. Short, hex, and decimal forms that a URL parser rewrites
 * into 127.0.0.1 are rejected too. Only the written literals 127.0.0.1 and [::1] pass.
 */
export function classifyLoopbackUrl(raw: string): { ok: true; url: URL } | { ok: false } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "http:") return { ok: false };
  if (url.username !== "" || url.password !== "") return { ok: false };
  if (!isLiteralLoopback(raw, url)) return { ok: false };
  return { ok: true, url };
}

function isLiteralLoopback(raw: string, url: URL): boolean {
  const match = /^http:\/\/([^/?#]*)/i.exec(raw.trim());
  if (!match) return false;
  const authority = match[1];
  if (authority === undefined || authority.includes("@")) return false;
  if (/^127\.0\.0\.1(?::\d+)?$/.test(authority)) {
    return url.hostname === "127.0.0.1";
  }
  if (/^\[::1\](?::\d+)?$/i.test(authority)) {
    return url.hostname.replace(/^\[|\]$/g, "").toLowerCase() === "::1";
  }
  return false;
}

export function chatCompletionsUrl(base: URL): URL {
  const url = stripped(base);
  const path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions")) {
    url.pathname = path;
    return url;
  }
  if (path.endsWith("/v1")) {
    url.pathname = `${path}/chat/completions`;
    return url;
  }
  url.pathname = `${path}/v1/chat/completions`;
  return url;
}

export function legacyCompletionUrl(base: URL): URL {
  const url = stripped(base);
  url.pathname = "/completion";
  return url;
}

function stripped(base: URL): URL {
  const url = new URL(base.href);
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";
  return url;
}

export interface ChatBody {
  messages: LocalPenMessage[];
  temperature: 0;
  seed: 42;
  max_tokens: 220;
}

export function buildChatBody(systemPrompt: string, messages: LocalPenMessage[]): ChatBody {
  return {
    messages: [{ role: "system", content: systemPrompt }, ...messages.filter((message) => message.role !== "system")],
    temperature: LOCAL_PEN_PARAMS.temperature,
    seed: LOCAL_PEN_PARAMS.seed,
    max_tokens: LOCAL_PEN_PARAMS.max_tokens,
  };
}

export function buildCompletionBody(systemPrompt: string, messages: LocalPenMessage[]): {
  prompt: string;
  temperature: 0;
  seed: 42;
  n_predict: 220;
} {
  const lines = [
    `system: ${systemPrompt}`,
    ...messages
      .filter((message) => message.role !== "system")
      .map((message) => `${message.role}: ${message.content}`),
    "assistant:",
  ];
  return {
    prompt: lines.join("\n"),
    temperature: LOCAL_PEN_PARAMS.temperature,
    seed: LOCAL_PEN_PARAMS.seed,
    n_predict: LOCAL_PEN_PARAMS.max_tokens,
  };
}

export type LoopbackPostResult =
  | { kind: "redirect" }
  | { kind: "down" }
  | { kind: "bad_payload" }
  | { kind: "not_found" }
  | { kind: "ok"; text: string; reportedBuild: string | null };

const FETCH_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
} as const;

export async function postLoopback(
  url: URL,
  body: unknown,
  timeoutMs: number,
): Promise<LoopbackPostResult> {
  const check = classifyLoopbackUrl(url.href);
  if (!check.ok) return { kind: "redirect" };
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      redirect: "manual",
      headers: FETCH_HEADERS,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    return { kind: "down" };
  }
  if (response.type === "opaqueredirect" || isRedirectStatus(response.status)) {
    await discardBody(response);
    return { kind: "redirect" };
  }
  if (response.status === 404) {
    await discardBody(response);
    return { kind: "not_found" };
  }
  if (!response.ok) {
    await discardBody(response);
    return { kind: "down" };
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { kind: "bad_payload" };
  }
  const text = readModelText(payload);
  if (text === null) return { kind: "bad_payload" };
  return { kind: "ok", text, reportedBuild: readReportedBuild(payload) };
}

async function discardBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    return;
  }
}

export async function probeLoopback(url: URL, timeoutMs: number): Promise<"up" | "down" | "redirect"> {
  const check = classifyLoopbackUrl(url.href);
  if (!check.ok) return "redirect";
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(Math.min(timeoutMs, 5_000)),
    });
    if (response.type === "opaqueredirect" || isRedirectStatus(response.status)) {
      await discardBody(response);
      return "redirect";
    }
    await discardBody(response);
    return "up";
  } catch {
    return "down";
  }
}

function isRedirectStatus(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

function readReportedBuild(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  for (const key of ["runtime_build", "build_id", "version", "runtime"] as const) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function readModelText(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) return null;
  const record = payload as Record<string, unknown>;
  const choices = record.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0];
    if (typeof first === "object" && first !== null) {
      const choice = first as Record<string, unknown>;
      const message = choice.message;
      if (typeof message === "object" && message !== null) {
        const content = (message as Record<string, unknown>).content;
        if (typeof content === "string") return content;
      }
      if (typeof choice.text === "string") return choice.text;
    }
  }
  if (typeof record.content === "string") return record.content;
  return null;
}
