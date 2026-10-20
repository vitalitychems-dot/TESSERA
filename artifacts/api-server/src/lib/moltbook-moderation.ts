import { createHash } from "node:crypto";

export const MOLTBOOK_MODERATION_POLICY_VERSION = "owner-review-v1";
export const MOLTBOOK_TITLE_MAX_LENGTH = 300;
export const MOLTBOOK_CONTENT_MAX_LENGTH = 5_000;

export interface MoltbookModerationFinding {
  code: "title_required" | "title_too_long" | "content_required" | "content_too_long" | "control_characters" | "private_data";
  message: string;
}

export interface MoltbookModerationReview {
  allowed: boolean;
  policyVersion: string;
  contentHash: string;
  findings: MoltbookModerationFinding[];
}

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-(?:proj-)?[A-Za-z0-9_-]{16,})\b/i,
  /\b(?:api[_-]?key|access[_-]?token|password|secret|database[_-]?url)\s*[:=]\s*\S{8,}/i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
];

function normalizeText(value: string): string {
  return value.normalize("NFC").trim();
}

export function hashMoltbookContent(title: string, content: string): string {
  return createHash("sha256").update(`${normalizeText(title)}\0${normalizeText(content)}`, "utf8").digest("hex");
}

export function reviewMoltbookDraft(titleValue: unknown, contentValue: unknown): MoltbookModerationReview {
  const title = typeof titleValue === "string" ? normalizeText(titleValue) : "";
  const content = typeof contentValue === "string" ? normalizeText(contentValue) : "";
  const joined = `${title}\n${content}`;
  const findings: MoltbookModerationFinding[] = [];

  if (!title) findings.push({ code: "title_required", message: "A post title is required." });
  if (title.length > MOLTBOOK_TITLE_MAX_LENGTH) {
    findings.push({ code: "title_too_long", message: `The title must be ${MOLTBOOK_TITLE_MAX_LENGTH} characters or fewer.` });
  }
  if (!content) findings.push({ code: "content_required", message: "Post text is required." });
  if (content.length > MOLTBOOK_CONTENT_MAX_LENGTH) {
    findings.push({ code: "content_too_long", message: `Post text must be ${MOLTBOOK_CONTENT_MAX_LENGTH} characters or fewer.` });
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(joined)) {
    findings.push({ code: "control_characters", message: "Remove hidden control characters before review." });
  }
  if (SECRET_PATTERNS.some(pattern => pattern.test(joined))) {
    findings.push({ code: "private_data", message: "The draft appears to contain a credential or personal email address. Remove it before saving or publishing." });
  }

  return {
    allowed: findings.length === 0,
    policyVersion: MOLTBOOK_MODERATION_POLICY_VERSION,
    contentHash: hashMoltbookContent(title, content),
    findings,
  };
}
