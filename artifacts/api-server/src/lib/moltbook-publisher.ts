import { recordShepherdAudit, requireShepherdProxy } from "./shepherd-outbound";
import { runWithShepherdContext } from "./sovereign-fetch-guard";

const MOLTBOOK_API_BASE = "https://www.moltbook.com/api/v1";
const SHEPHERD_CALLER = "shepherd-moltbook";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 64_000;

export type MoltbookCreateResult =
  | { kind: "confirmed"; postId: string }
  | {
      kind: "verification_required";
      postId: string;
      verificationCode: string;
      challengeText: string;
      expiresAt: string;
    };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedString(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength ? value : null;
}

function safePostId(value: unknown): string | null {
  const id = boundedString(value, 128);
  return id && /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error("Moltbook response was too large");
  }
  if (!response.body) throw new Error("Moltbook response body was empty");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("Moltbook response was too large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}

async function postJson(path: "/posts" | "/verify", apiKey: string, body: unknown): Promise<unknown> {
  const url = `${MOLTBOOK_API_BASE}${path}`;
  await requireShepherdProxy(SHEPHERD_CALLER, url, "POST");
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await runWithShepherdContext(
      SHEPHERD_CALLER,
      () => fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }),
      "owner-approved Moltbook publication action",
    );
    await recordShepherdAudit({
      caller: SHEPHERD_CALLER,
      targetUrl: url,
      method: "POST",
      outcome: "allowed",
      reason: path === "/posts" ? "Owner-approved and moderator-reviewed Moltbook post" : "Owner-submitted Moltbook verification answer",
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    if (!response.ok) throw new Error("Moltbook did not confirm the requested action");
    return await readBoundedJson(response);
  } finally {
    clearTimeout(timeout);
  }
}

export async function createMoltbookPost(
  apiKey: string,
  input: { title: string; content: string },
): Promise<MoltbookCreateResult> {
  const data = asRecord(await postJson("/posts", apiKey, {
    submolt_name: "general",
    title: input.title,
    content: input.content,
    type: "text",
  }));
  const post = asRecord(data?.post);
  const postId = safePostId(post?.id);
  if (data?.success !== true || !postId) {
    throw new Error("Moltbook did not return a confirmed post identifier");
  }

  const verificationPending = data.verification_required === true || post?.verification_status === "pending";
  if (!verificationPending) return { kind: "confirmed", postId };

  const verification = asRecord(post?.verification);
  const verificationCode = boundedString(verification?.verification_code, 256);
  const challengeText = boundedString(verification?.challenge_text, 2_000);
  const expiresAt = typeof verification?.expires_at === "string" && Number.isFinite(Date.parse(verification.expires_at))
    ? verification.expires_at
    : null;
  if (!verificationCode || !challengeText || !expiresAt) {
    throw new Error("Moltbook returned an incomplete verification challenge");
  }
  return { kind: "verification_required", postId, verificationCode, challengeText, expiresAt };
}

export async function verifyMoltbookPost(
  apiKey: string,
  input: { verificationCode: string; answer: string; expectedPostId: string },
): Promise<boolean> {
  const data = asRecord(await postJson("/verify", apiKey, {
    verification_code: input.verificationCode,
    answer: input.answer,
  }));
  return data?.success === true
    && data.content_type === "post"
    && data.content_id === input.expectedPostId;
}
