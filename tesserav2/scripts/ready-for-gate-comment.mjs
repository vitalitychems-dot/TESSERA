/**
 * Post one "ready for gate <head sha>" comment, then update that same comment.
 *
 * The hidden marker keeps later runs on the original comment. This script
 * lists, creates, and updates comments. It does not delete comments, and it
 * does not push or rewrite git history.
 *
 * Usage:
 *   node scripts/ready-for-gate-comment.mjs
 */
import { pathToFileURL } from "node:url";

export const READY_MARKER = "<!-- tessera-ready-for-gate -->";

export function readyCommentBody(headSha) {
  if (!/^[0-9a-f]{40}$/i.test(String(headSha ?? ""))) throw new Error("unexpected sha");
  return `${READY_MARKER}\nready for gate ${headSha}\n`;
}

export function findReadyComment(comments) {
  const matches = comments.filter((comment) => String(comment?.body ?? "").includes(READY_MARKER));
  if (matches.length === 0) return null;
  return matches.reduce((earliest, comment) => (comment.id < earliest.id ? comment : earliest));
}

function assertRepository(repository) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(String(repository ?? ""))) {
    throw new Error("unexpected repository");
  }
}

function assertPullNumber(prNumber) {
  if (!/^[1-9][0-9]*$/.test(String(prNumber ?? ""))) throw new Error("unexpected pull request");
}

function apiHeaders(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "tessera-ready-for-gate",
  };
}

function nextUrl(link, repository) {
  if (!link) return null;
  const part = link.split(",").find((item) => item.includes('rel="next"'));
  if (!part) return null;
  const match = part.match(/<([^>]+)>/);
  if (!match) return null;
  const url = match[1];
  const prefix = `https://api.github.com/repos/${repository}/`;
  if (!url.startsWith(prefix)) throw new Error("unexpected comments page");
  return url;
}

async function requestJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  if (!response.ok) {
    throw new Error(`github api status ${response.status}`);
  }
  const body = await response.json();
  return { body, link: response.headers?.get?.("link") ?? response.headers?.get?.("Link") ?? null };
}

export async function listIssueComments({ repository, prNumber, token, fetchImpl }) {
  assertRepository(repository);
  assertPullNumber(prNumber);
  const comments = [];
  const seen = new Set();
  let url = `https://api.github.com/repos/${repository}/issues/${prNumber}/comments?per_page=100`;
  while (url) {
    if (seen.has(url)) throw new Error("repeated comments page");
    seen.add(url);
    const page = await requestJson(fetchImpl, url, { method: "GET", headers: apiHeaders(token) });
    if (!Array.isArray(page.body)) throw new Error("comments api returned a non-array");
    comments.push(...page.body);
    url = nextUrl(page.link, repository);
  }
  return comments;
}

export async function upsertReadyComment({ repository, prNumber, headSha, token, fetchImpl = globalThis.fetch }) {
  if (!token) throw new Error("comment token missing");
  assertRepository(repository);
  assertPullNumber(prNumber);
  const body = readyCommentBody(headSha);
  const comments = await listIssueComments({ repository, prNumber, token, fetchImpl });
  const existing = findReadyComment(comments);
  if (existing && existing.body === body) {
    return { action: "unchanged", id: existing.id, body };
  }
  if (existing) {
    const url = `https://api.github.com/repos/${repository}/issues/comments/${existing.id}`;
    const updated = await requestJson(fetchImpl, url, {
      method: "PATCH",
      headers: apiHeaders(token),
      body: JSON.stringify({ body }),
    });
    return { action: "updated", id: updated.body.id, body };
  }
  const created = await requestJson(
    fetchImpl,
    `https://api.github.com/repos/${repository}/issues/${prNumber}/comments`,
    {
      method: "POST",
      headers: apiHeaders(token),
      body: JSON.stringify({ body }),
    },
  );
  return { action: "created", id: created.body.id, body };
}

function invokedDirectly() {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

async function main() {
  const result = await upsertReadyComment({
    repository: process.env.GITHUB_REPOSITORY,
    prNumber: process.env.PR_NUMBER,
    headSha: process.env.HEAD_SHA,
    token: process.env.GITHUB_TOKEN,
  });
  process.stdout.write(`ready-for-gate ${result.action} ${result.id}\n${result.body}`);
}

if (invokedDirectly()) {
  main().catch((error) => {
    process.stderr.write(`ready-for-gate-error: ${error.message}\n`);
    process.exit(1);
  });
}
