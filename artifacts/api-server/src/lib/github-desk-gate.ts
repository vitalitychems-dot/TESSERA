// Owner gate for the preview GitHub desk.
// Same fail-closed sovereign_session check as decideOwnerSession in sovereign-admin.ts:
// TESSERACT_ADMIN_KEY unset -> 503, missing or invalid cookie -> 401.
// Denial bodies stay generic: no lookup reason, no exception text, no env values.

import { isAdminTokenConfigured, lookupSession, SESSION_COOKIE } from "./sovereign-session";

export const DESK_FILE_BYTE_CAP = 32_768;

const ALLOWED_REPOS = [
  { owner: "vitalitychems-dot", repo: "TESSERA" },
  { owner: "vitalitychems-dot", repo: "Gitbook" },
] as const;

const PATH_DENIED = "That repository path is not allowed." as const;
const SECRET_PATH =
  /(^|\/)\.env(?:\.|$)|(^|\/)\.git(?:\/|$)|(?:^|\/)id_rsa(?:\.|$)|(?:^|\/)id_ed25519(?:\.|$)|(?:^|\/)[^/]*\.(?:pem|key|p12|pfx)$|(?:^|\/)[^/]*(?:secret|password|credential)[^/]*$/i;
const SECRET_TEXT =
  /SESSION_SECRET|BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]|github_pat_|xox[baprs]-|sk-[A-Za-z0-9]{10,}/;

export type DeskGateDenial = {
  ok: false;
  status: 401 | 503;
  error: "unauthenticated" | "sovereign-unconfigured";
};

export type DeskGithubResult = { ok: boolean; status: number; text: string };
export type DeskGithubApi = (path: string, init?: { method?: string; body?: string }) => Promise<DeskGithubResult>;

type BoardLine = { id?: number; user: string; body: string };
type PullRow = { repo: string; number: number; title: string; state: string };

export function deskOwnerGate(cookieHeader: string | undefined): { ok: true } | DeskGateDenial {
  if (!isAdminTokenConfigured()) {
    return { ok: false, status: 503, error: "sovereign-unconfigured" };
  }
  const lookup = lookupSession(sessionCookie(cookieHeader));
  if (!lookup.valid || !lookup.record) {
    return { ok: false, status: 401, error: "unauthenticated" };
  }
  return { ok: true };
}

function sessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    if (trimmed.slice(0, eq) !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function pinRepoFile(
  input: unknown,
): { ok: true; owner: "vitalitychems-dot"; repo: "TESSERA" | "Gitbook"; path: string } | { ok: false; error: typeof PATH_DENIED } {
  const denied = { ok: false as const, error: PATH_DENIED } as const;
  if (!input || typeof input !== "object") return denied;
  const record = input as { owner?: unknown; repo?: unknown; path?: unknown };
  if (typeof record.owner !== "string" || typeof record.repo !== "string" || typeof record.path !== "string") return denied;
  const owner = record.owner.trim();
  const repo = record.repo.trim().replace(/\.git$/i, "");
  const pinned = ALLOWED_REPOS.find((row) => row.owner === owner && row.repo === repo);
  if (!pinned) return denied;
  const path = cleanRepoPath(record.path);
  if (!path) return denied;
  return { ok: true, owner: pinned.owner, repo: pinned.repo, path };
}

function cleanRepoPath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 512) return null;
  if (trimmed.includes("\\") || trimmed.includes("\0")) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("~") || /^[a-zA-Z]:/.test(trimmed)) return null;
  let decoded = trimmed;
  for (let pass = 0; pass < 2; pass += 1) {
    if (!decoded.includes("%")) break;
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }
  if (decoded.includes("..") || decoded.includes("\\") || decoded.includes("\0")) return null;
  if (decoded.startsWith("/") || decoded.startsWith("~") || /^[a-zA-Z]:/.test(decoded)) return null;
  const parts = decoded.split("/");
  if (parts.length === 0 || parts.some((part) => part.length === 0 || part === "." || part === "..")) return null;
  if (SECRET_PATH.test(decoded)) return null;
  return parts.join("/");
}

type RepoFileIo = {
  token: () => Promise<string>;
  fetchImpl: typeof fetch;
};

export async function readRepoFileGated(
  input: unknown,
  cookieHeader: string | undefined,
  io: RepoFileIo,
): Promise<{ ok: true; text: string; path: string } | { ok: false; error: string; status?: 401 | 503 }> {
  const gate = deskOwnerGate(cookieHeader);
  if (!gate.ok) return gate;
  const pinned = pinRepoFile(input);
  if (!pinned.ok) return pinned;
  try {
    const token = (await io.token()).trim();
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "tessera-chamber",
    };
    if (token && !token.includes(" ")) headers.Authorization = `Bearer ${token}`;
    const url = `https://api.github.com/repos/${pinned.owner}/${pinned.repo}/contents/${pinned.path
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/")}`;
    const response = await io.fetchImpl(url, { method: "GET", headers });
    if (!response.ok) return { ok: false, error: "That file could not be read." };
    const payload = (await response.json()) as {
      content?: unknown;
      encoding?: unknown;
      size?: unknown;
      type?: unknown;
    };
    if (payload.type !== "file") return { ok: false, error: "That file could not be read." };
    if (typeof payload.size === "number" && (payload.size < 0 || payload.size > DESK_FILE_BYTE_CAP)) {
      return { ok: false, error: "That file could not be read." };
    }
    if (payload.encoding !== "base64" || typeof payload.content !== "string") {
      return { ok: false, error: "That file could not be read." };
    }
    const encoded = payload.content.replace(/\n/g, "");
    if (encoded.length > Math.ceil((DESK_FILE_BYTE_CAP * 4) / 3) + 8) {
      return { ok: false, error: "That file could not be read." };
    }
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.byteLength > DESK_FILE_BYTE_CAP) return { ok: false, error: "That file could not be read." };
    const text = bytes.toString("utf8");
    if (SECRET_TEXT.test(text)) return { ok: false, error: "That file could not be read." };
    return { ok: true, text: text.slice(0, 4000), path: `${pinned.owner}/${pinned.repo}/${pinned.path}` };
  } catch {
    return { ok: false, error: "That file could not be read." };
  }
}

export async function openPullsGated(
  cookieHeader: string | undefined,
  githubApi: DeskGithubApi,
): Promise<{ ok: boolean; status?: 401 | 503; at: string; rows: PullRow[]; error: string }> {
  const gate = deskOwnerGate(cookieHeader);
  if (!gate.ok) return { ...gate, at: "", rows: [], error: gate.error };
  const rows: PullRow[] = [];
  let failed = false;
  for (const repo of ["TESSERA", "Gitbook"] as const) {
    try {
      const result = await githubApi(`/repos/vitalitychems-dot/${repo}/pulls?state=open&per_page=20`);
      if (!result.ok) {
        failed = true;
        continue;
      }
      const pulls = JSON.parse(result.text) as { number?: number; title?: string; draft?: boolean; mergeable_state?: string }[];
      for (const pull of pulls) {
        rows.push({
          repo,
          number: pull.number ?? 0,
          title: (pull.title ?? "").slice(0, 140),
          state: pull.draft ? "draft" : pull.mergeable_state || "open",
        });
      }
    } catch {
      failed = true;
    }
  }
  return {
    ok: !failed,
    at: new Date().toISOString(),
    rows,
    error: failed ? "The pull list could not be read." : "",
  };
}

export async function readBoardGated(
  cookieHeader: string | undefined,
  deps: {
    githubApi: DeskGithubApi;
    readCachedBoard: () => Promise<BoardLine[] | null>;
    saveCachedBoard: (lines: BoardLine[]) => Promise<void>;
    savedBoard: BoardLine[];
  },
): Promise<{ ok: true; lines: BoardLine[]; error: "" } | { ok: false; status?: 401 | 503; error: string; lines: BoardLine[] }> {
  const gate = deskOwnerGate(cookieHeader);
  if (!gate.ok) return { ...gate, lines: [], error: gate.error };
  try {
    const result = await deps.githubApi("/repos/vitalitychems-dot/Gitbook/issues/2/comments");
    if (result.ok) {
      const parsed = JSON.parse(result.text) as { id?: number; user?: { login?: string }; body?: string }[];
      const lines = parsed.map((row) => ({ id: row.id ?? 0, user: row.user?.login ?? "github", body: row.body ?? "" }));
      await deps.saveCachedBoard(lines);
      return { ok: true, lines: lines.slice(-20), error: "" };
    }
  } catch {
    /* fall through to the saved copy */
  }
  const cached = await deps.readCachedBoard();
  if (cached) return { ok: true, lines: cached.slice(-20), error: "" };
  if (deps.savedBoard.length > 0) return { ok: true, lines: deps.savedBoard.slice(-20), error: "" };
  return { ok: false, error: "The command center could not be read.", lines: [] };
}

export async function postApprovalGated(
  data: { decision?: unknown; commentId?: unknown },
  cookieHeader: string | undefined,
  deps: { githubApi: DeskGithubApi; refuseRepeat: (body: string) => Promise<string | null> },
): Promise<{ ok: true; url: string } | { ok: false; status?: 401 | 503; error: string }> {
  const gate = deskOwnerGate(cookieHeader);
  if (!gate.ok) return gate;
  if (data.decision !== "YES" && data.decision !== "NO") return { ok: false, error: "The decision must be yes or no." };
  if (typeof data.commentId !== "number" || !Number.isInteger(data.commentId) || data.commentId < 1) {
    return { ok: false, error: "No question is open." };
  }
  const body = `Father: ${data.decision}\nQuestion comment: ${data.commentId}\nMerge: no`;
  try {
    const repeated = await deps.refuseRepeat(body);
    if (repeated) return { ok: false, error: repeated };
    const result = await deps.githubApi("/repos/vitalitychems-dot/Gitbook/issues/2/comments", {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    if (result.ok) return { ok: true, url: "https://github.com/vitalitychems-dot/Gitbook/issues/2" };
    return { ok: false, error: "The approval was not posted." };
  } catch {
    return { ok: false, error: "The approval was not posted." };
  }
}

export async function postBoardGated(
  data: { text?: unknown },
  cookieHeader: string | undefined,
  deps: {
    githubApi: DeskGithubApi;
    noteAllowed: (text: string) => string | null;
    writeRefusal: (name: string) => string | null;
    refuseRepeat: (body: string) => Promise<string | null>;
    readCachedBoard: () => Promise<BoardLine[] | null>;
    saveCachedBoard: (lines: BoardLine[]) => Promise<void>;
    ghComment: (body: string) => Promise<boolean>;
  },
): Promise<{ ok: true; url: string } | { ok: false; status?: 401 | 503; error: string }> {
  const gate = deskOwnerGate(cookieHeader);
  if (!gate.ok) return gate;
  if (typeof data.text !== "string") return { ok: false, error: "The command was not posted." };
  const refused = deps.noteAllowed(data.text) ?? deps.writeRefusal("vitalitychems-dot/Gitbook");
  if (refused) return { ok: false, error: refused };
  const body = `Father, from the chamber:\n\n${data.text.trim()}\n\nGrok Bot, Cursor, and Replit: reply on Gitbook issue 2 as yourselves. Do not speak as Tessera. Do not push any repo but TESSERA, and only after this note is approved.`;
  try {
    const repeated = await deps.refuseRepeat(body);
    if (repeated) return { ok: false, error: repeated };
    const result = await deps.githubApi("/repos/vitalitychems-dot/Gitbook/issues/2/comments", {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    if (result.ok) {
      const cached = (await deps.readCachedBoard()) ?? [];
      await deps.saveCachedBoard([...cached, { user: "vitalitychems-dot", body }]);
      return { ok: true, url: "https://github.com/vitalitychems-dot/Gitbook/issues/2" };
    }
    const posted = await deps.ghComment(body);
    if (posted) {
      const cached = (await deps.readCachedBoard()) ?? [];
      await deps.saveCachedBoard([...cached, { user: "vitalitychems-dot", body }]);
      return { ok: true, url: "https://github.com/vitalitychems-dot/Gitbook/issues/2" };
    }
    return { ok: false, error: "The command was not posted." };
  } catch {
    return { ok: false, error: "The command was not posted." };
  }
}
