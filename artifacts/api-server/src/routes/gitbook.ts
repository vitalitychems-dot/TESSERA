import { Router, type NextFunction, type Request, type Response } from "express";
import { logger } from "../lib/logger";
import { requireAdminSession } from "../lib/sovereign-admin";
import {
  escapeGitHubCommentText,
  parseGitbookRules,
  parseGitbookTasks,
  validateGitbookProgress,
  type GitbookRoadmapData,
} from "../lib/gitbook-roadmap";

const router = Router();
const GITHUB_API = "https://api.github.com";
const BACKLOG_URL = "https://github.com/vitalitychems-dot/Gitbook/blob/main/intake/HYBRID-CONSOLIDATION-BACKLOG.md";
const HANDOFF_URL = "https://github.com/vitalitychems-dot/Gitbook/issues/67";
const PROGRESS_COMMENTS_URL = `${GITHUB_API}/repos/vitalitychems-dot/Gitbook/issues/2/comments`;
const CACHE_MS = 5 * 60_000;
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_UPSTREAM_BYTES = 1_500_000;

type GithubBacklogFile = { content?: unknown; encoding?: unknown; sha?: unknown };
type GithubHandoff = { body?: unknown; updated_at?: unknown };
type CachedRoadmap = { data: GitbookRoadmapData; validUntil: number };

let cachedRoadmap: CachedRoadmap | null = null;
let inFlightRoadmap: Promise<GitbookRoadmapData> | null = null;
let retryAfter = 0;
const progressWrites = new Map<string, { startedAt: number; count: number }>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readGithubJson(path: string): Promise<unknown> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: { Accept: "application/vnd.github+json", "User-Agent": "Tessera-Next-Gitbook-Bridge" },
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    logger.warn({ upstream: "github", statusCode: response.status }, "Gitbook read-through failed");
    throw new Error("Gitbook source unavailable");
  }
  const text = await response.text();
  if (text.length > MAX_UPSTREAM_BYTES) throw new Error("Gitbook response exceeds size limit");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Gitbook response was invalid JSON");
  }
}

async function loadRoadmap(): Promise<GitbookRoadmapData> {
  const [fileValue, handoffValue] = await Promise.all([
    readGithubJson("/repos/vitalitychems-dot/Gitbook/contents/intake/HYBRID-CONSOLIDATION-BACKLOG.md?ref=main"),
    readGithubJson("/repos/vitalitychems-dot/Gitbook/issues/67"),
  ]);
  if (!isRecord(fileValue) || !isRecord(handoffValue)) throw new Error("Gitbook source shape is invalid");
  const file = fileValue as GithubBacklogFile;
  const handoff = handoffValue as GithubHandoff;
  if (file.encoding !== "base64" || typeof file.content !== "string" || typeof file.sha !== "string") {
    throw new Error("Gitbook backlog file is unavailable");
  }
  if (typeof handoff.body !== "string" || typeof handoff.updated_at !== "string" || !Number.isFinite(Date.parse(handoff.updated_at))) {
    throw new Error("Gitbook handoff issue is unavailable");
  }

  const markdown = Buffer.from(file.content.replace(/\s/g, ""), "base64").toString("utf8");
  const tasks = parseGitbookTasks(markdown);
  const rules = parseGitbookRules(handoff.body);
  if (!tasks.length || !rules.length) throw new Error("Gitbook source is missing required sections");

  return {
    tasks,
    rules,
    observedAt: new Date().toISOString(),
    stale: false,
    sources: {
      backlog: { url: BACKLOG_URL, revision: file.sha },
      handoff: { url: HANDOFF_URL, updatedAt: handoff.updated_at },
    },
  };
}

async function getRoadmap(): Promise<GitbookRoadmapData> {
  if (cachedRoadmap && cachedRoadmap.validUntil > Date.now()) return cachedRoadmap.data;
  if (Date.now() < retryAfter) {
    if (cachedRoadmap) return { ...cachedRoadmap.data, stale: true };
    throw new Error("Gitbook source temporarily unavailable");
  }
  if (!inFlightRoadmap) {
    inFlightRoadmap = loadRoadmap().then(data => {
      cachedRoadmap = { data, validUntil: Date.now() + CACHE_MS };
      retryAfter = 0;
      return data;
    }).catch(() => {
      retryAfter = Date.now() + 30_000;
      throw new Error("Gitbook source temporarily unavailable");
    }).finally(() => {
      inFlightRoadmap = null;
    });
  }
  try {
    return await inFlightRoadmap;
  } catch {
    if (cachedRoadmap) return { ...cachedRoadmap.data, stale: true };
    throw new Error("Gitbook source temporarily unavailable");
  }
}

function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  const origin = req.get("origin");
  const host = req.get("host");
  if (!origin || !host || origin === "null") {
    res.status(403).json({ ok: false, error: "same-origin-required" });
    return;
  }
  try {
    if (new URL(origin).host.toLowerCase() !== host.toLowerCase()) {
      res.status(403).json({ ok: false, error: "same-origin-required" });
      return;
    }
  } catch {
    res.status(403).json({ ok: false, error: "same-origin-required" });
    return;
  }
  next();
}

function limitProgressWrites(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const key = req.ip || "unknown";
  const current = progressWrites.get(key);
  if (!current || now - current.startedAt > 60_000) {
    progressWrites.set(key, { startedAt: now, count: 1 });
    next();
    return;
  }
  if (current.count >= 5) {
    res.setHeader("Retry-After", String(Math.ceil((60_000 - (now - current.startedAt)) / 1000)));
    res.status(429).json({ ok: false, error: "progress-rate-limited" });
    return;
  }
  current.count += 1;
  if (progressWrites.size > 1_000) {
    for (const [ip, entry] of progressWrites) if (now - entry.startedAt > 60_000) progressWrites.delete(ip);
  }
  next();
}

router.get("/gitbook/roadmap", requireAdminSession, async (_req, res) => {
  res.setHeader("Cache-Control", "private, no-store");
  try {
    return res.json({ ok: true, ...(await getRoadmap()) });
  } catch {
    logger.warn({ source: "Gitbook", operation: "read-roadmap" }, "Gitbook roadmap unavailable");
    return res.status(503).json({ ok: false, error: "gitbook-unavailable" });
  }
});

router.post("/gitbook/progress", requireAdminSession, requireSameOrigin, limitProgressWrites, async (req, res) => {
  const key = process.env.TESSERA_GITHUB_TOKEN?.trim();
  if (!key) return res.status(503).json({ ok: false, error: "gitbook-write-unconfigured" });

  let roadmap: GitbookRoadmapData;
  try {
    roadmap = await getRoadmap();
  } catch {
    return res.status(503).json({ ok: false, error: "gitbook-unavailable" });
  }
  const input = isRecord(req.body) ? req.body : {};
  const validation = validateGitbookProgress(
    input.taskId,
    input.note,
    input.publicConfirmation,
    new Set(roadmap.tasks.map(task => task.id)),
  );
  if (!validation.ok) return res.status(400).json({ ok: false, error: validation.error });

  const comment = [
    `TESSERA workspace progress · ${validation.taskId}`,
    "",
    escapeGitHubCommentText(validation.note),
    "",
    "_Posted from TESSERA. This progress note does not change the authoritative backlog status._",
  ].join("\n");

  try {
    const response = await fetch(PROGRESS_COMMENTS_URL, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "User-Agent": "Tessera-Next-Gitbook-Bridge",
      },
      body: JSON.stringify({ body: comment }),
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn({ taskId: validation.taskId, upstreamStatus: response.status }, "Gitbook progress write failed");
      return res.status(502).json({ ok: false, error: "gitbook-write-failed" });
    }
    const text = await response.text();
    if (text.length > 64_000) return res.status(502).json({ ok: false, error: "gitbook-write-failed" });
    const result: unknown = JSON.parse(text);
    const commentUrl = isRecord(result) && typeof result.html_url === "string" &&
      /^https:\/\/github\.com\/vitalitychems-dot\/Gitbook\/issues\/2#issuecomment-\d+$/.test(result.html_url)
      ? result.html_url
      : null;
    if (!commentUrl) return res.status(502).json({ ok: false, error: "gitbook-write-failed" });
    return res.status(201).json({ ok: true, commentUrl, taskId: validation.taskId });
  } catch {
    logger.warn({ taskId: validation.taskId, operation: "post-progress" }, "Gitbook progress write unavailable");
    return res.status(502).json({ ok: false, error: "gitbook-write-failed" });
  }
});

export default router;
