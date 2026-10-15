import { recordShepherdAudit, requireShepherdProxy } from "./shepherd-outbound";

const MOLTBOOK_API_BASE = "https://www.moltbook.com/api/v1";
const SHEPHERD_CALLER = "shepherd-moltbook";

export interface MoltbookTopicInput {
  topicId: number;
  title: string;
  content: string;
  author: string;
  category: string;
  replyCount: number;
}

export interface MoltbookExternalPost {
  id: string;
  title: string;
  content: string;
  authorName: string;
  submoltName: string;
}

export interface MoltbookPublicPost {
  id: string;
  title: string;
  content: string;
  authorName: string;
  submoltName: string;
  createdAt: string | null;
  score: number | null;
  verified: true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function boundedText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : null;
}

function parsePublicPost(value: unknown): MoltbookPublicPost | null {
  const post = asRecord(value);
  const author = asRecord(post?.author);
  const submolt = asRecord(post?.submolt);
  const id = boundedText(post?.id, 128);
  const title = boundedText(post?.title, 300);
  const content = boundedText(post?.content, 5_000);
  const authorName = boundedText(author?.name ?? post?.author_name, 100);
  const submoltName = boundedText(submolt?.name ?? post?.submolt_name, 100);
  const createdAt = typeof post?.created_at === "string" && Number.isFinite(Date.parse(post.created_at))
    ? post.created_at
    : null;
  const score = typeof post?.score === "number" && Number.isSafeInteger(post.score)
    ? post.score
    : null;

  if (
    !id || !/^[A-Za-z0-9_-]+$/.test(id) ||
    !title || !content || !authorName || !submoltName ||
    post?.verification_status !== "verified" ||
    post.is_deleted === true ||
    post.is_spam === true
  ) return null;

  return { id, title, content, authorName, submoltName, createdAt, score, verified: true };
}

async function readBoundedJson(response: Response, maxBytes: number): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Moltbook response exceeded the size limit");
  }
  if (!response.body) throw new Error("Moltbook response body was empty");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new Error("Moltbook response exceeded the size limit");
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

/**
 * Read the public feed without an API key. Moltbook currently serves this endpoint
 * anonymously, so TESSERA needs no credential and cannot write to the service here.
 */
export async function fetchMoltbookPublicPosts(limit = 5): Promise<MoltbookPublicPost[]> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10) {
    throw new Error("Moltbook feed limit is out of range");
  }

  const url = `${MOLTBOOK_API_BASE}/posts?sort=new&limit=${limit}`;
  await requireShepherdProxy(SHEPHERD_CALLER, url, "GET");
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    await recordShepherdAudit({
      caller: SHEPHERD_CALLER,
      targetUrl: url,
      method: "GET",
      outcome: "allowed",
      reason: "Shepherd-mediated anonymous read of the public Moltbook feed",
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    if (!response.ok) throw new Error("Moltbook public feed request failed");

    const data = asRecord(await readBoundedJson(response, 500_000));
    if (!Array.isArray(data?.posts)) throw new Error("Moltbook feed response did not match its contract");
    return data.posts.flatMap((candidate): MoltbookPublicPost[] => {
      const post = parsePublicPost(candidate);
      return post ? [post] : [];
    }).slice(0, limit);
  } finally {
    clearTimeout(timeout);
  }
}

export async function syncTopicsToMoltbook(
  apiKey: string,
  topics: MoltbookTopicInput[],
): Promise<number> {
  let synced = 0;
  for (const topic of topics) {
    try {
      const url = `${MOLTBOOK_API_BASE}/posts`;
      await requireShepherdProxy(SHEPHERD_CALLER, url, "POST");
      const startedAt = Date.now();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          submolt_name: "general",
          title: `[Tessera Forum] ${topic.title}`,
          content: `${topic.content}\n\n---\n*Cross-posted from Tessera Sovereign System forum — ${topic.replyCount} agent replies*\n*Author: ${topic.author} | Category: ${topic.category}*`,
        }),
      });
      await recordShepherdAudit({
        caller: SHEPHERD_CALLER, targetUrl: url, method: "POST",
        outcome: "allowed", reason: "Shepherd-mediated cross-post to moltbook",
        status: response.status, durationMs: Date.now() - startedAt,
      });
      if (response.ok) synced++;
    } catch (err) {
      await recordShepherdAudit({
        caller: SHEPHERD_CALLER, targetUrl: `${MOLTBOOK_API_BASE}/posts`, method: "POST",
        outcome: "refused", reason: (err as Error).message,
      });
    }
  }
  return synced;
}

export async function fetchMoltbookExternalPosts(
  apiKey: string,
  limit = 5,
): Promise<MoltbookExternalPost[]> {
  try {
    const url = `${MOLTBOOK_API_BASE}/posts?sort=hot&limit=${limit}`;
    await requireShepherdProxy(SHEPHERD_CALLER, url, "GET");
    const startedAt = Date.now();
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    await recordShepherdAudit({
      caller: SHEPHERD_CALLER, targetUrl: url, method: "GET",
      outcome: "allowed", reason: "Shepherd-mediated read from moltbook",
      status: response.status, durationMs: Date.now() - startedAt,
    });
    if (!response.ok) return [];
    const data = await response.json() as {
      posts?: Array<{ id: string; title: string; content: string; author_name: string; submolt_name: string }>;
    };
    if (!data.posts) return [];
    return data.posts.map(p => ({
      id: p.id,
      title: p.title,
      content: (p.content || "").slice(0, 2000),
      authorName: p.author_name,
      submoltName: p.submolt_name,
    }));
  } catch {
    return [];
  }
}
