// Owner gate for the preview GitHub desk.
// Preview does not share the api-server session Map, so this gate POSTs the
// caller's own session token to the api-server loopback session check.
// The port is API_SERVER_PORT, an integer from 1 to 65535. Unset, blank, or
// invalid fails closed with 503 and does not connect. The host is 127.0.0.1.
// PORT is ignored. There is no fallback port.
// Unreachable or timed-out api-server -> 503. Any other error, or {valid:false} -> 401.
// Denial bodies stay generic: no lookup reason, no exception text, no env values.

import { SESSION_COOKIE } from "./sovereign-session";

export const DESK_FILE_BYTE_CAP = 32_768;

const ALLOWED_REPOS = [
  { owner: "vitalitychems-dot", repo: "TESSERA" },
  { owner: "vitalitychems-dot", repo: "Gitbook" },
] as const;

const PATH_DENIED = "That repository path is not allowed." as const;
const SECRET_PATH =
  /(^|\/)\.env|(?:^|\/)\.npmrc(?:\/|$)|(?:^|\/)app-env\.json(?:\/|$)|(^|\/)\.git(?:\/|$)|(?:^|\/)id_rsa(?:\.|$)|(?:^|\/)id_ed25519(?:\.|$)|(?:^|\/)[^/]*\.(?:pem|key|p12|pfx)$|(?:^|\/)[^/]*(?:secret|password|credential)[^/]*$|(?:^|\/)[^/]*natal-vault[^/]*(?:\/|$)/i;
const HELD_PATH =
  /(?:^|\/)data(?:\/|$)|(?:^|\/)(?:zz|1t|t44)(?:[-_.\s][^/]*)?(?:\/|$)|(?:^|\/)[^/]*ingest[^/]*(?:\/|$)|(?:^|\/)[^/]*constitution-seal[^/]*(?:\/|$)|(?:^|\/)study-log\.ts$|(?:^|\/)desk\.ts[^/]*(?:\/|$)/i;
const HELD_NAME_MARKERS = [
  "secure-recruitment",
  "moltbook-recruitment",
  "summit-45",
  "secret-society",
  "society-recruits",
  "society-intel",
  "secure-outreach",
  "email-outreach",
  "recruit-dossiers",
  "political-dossiers",
  "natal-",
  "father-natal",
  "secretsociety",
  "personal-",
] as const;
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

const SESSION_CHECK_TIMEOUT_MS = 1500;
const UNREACHABLE_CODES = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ECONNRESET",
  "EAI_AGAIN",
  "ETIMEDOUT",
  "ECONNABORTED",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
]);

const UNAVAILABLE: DeskGateDenial = { ok: false, status: 503, error: "sovereign-unconfigured" };
const UNAUTHENTICATED: DeskGateDenial = { ok: false, status: 401, error: "unauthenticated" };

export async function deskOwnerGate(cookieHeader: string | undefined): Promise<{ ok: true } | DeskGateDenial> {
  const url = sessionCheckUrl();
  if (!url) return UNAVAILABLE;
  const token = sessionCookie(cookieHeader);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SESSION_CHECK_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ session: token ?? "" }),
    });
    if (response.status === 503) {
      await response.body?.cancel().catch(() => undefined);
      return UNAVAILABLE;
    }
    const valid = await readValidFlag(response);
    if (response.status === 200 && valid === true) return { ok: true };
    return UNAUTHENTICATED;
  } catch (error) {
    return isUnreachable(error) ? UNAVAILABLE : UNAUTHENTICATED;
  } finally {
    clearTimeout(timer);
  }
}

function apiServerPort(): number | null {
  const raw = process.env.API_SERVER_PORT;
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!/^[1-9][0-9]{0,4}$/.test(trimmed)) return null;
  const port = Number(trimmed);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return null;
  return port;
}

function sessionCheckUrl(): string | null {
  const port = apiServerPort();
  if (port === null) return null;
  return `http://127.0.0.1:${port}/api/internal/session-check`;
}

async function readValidFlag(response: Response): Promise<boolean | null> {
  const length = response.headers.get("content-length");
  if (length !== null && Number(length) > 64) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  const text = await response.text();
  if (text.length > 64) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    const keys = Object.keys(parsed);
    if (keys.length !== 1 || keys[0] !== "valid") return null;
    const valid = (parsed as { valid: unknown }).valid;
    return typeof valid === "boolean" ? valid : null;
  } catch {
    return null;
  }
}

function isUnreachable(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const name = "name" in current ? (current as { name?: unknown }).name : undefined;
    if (name === "AbortError" || name === "TimeoutError") return true;
    const code = "code" in current ? (current as { code?: unknown }).code : undefined;
    if (typeof code === "string" && UNREACHABLE_CODES.has(code)) return true;
    current = "cause" in current ? (current as { cause?: unknown }).cause : undefined;
  }
  return false;
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
  const trimmed = raw.trim().normalize("NFKC");
  if (!trimmed || trimmed.length > 512) return null;
  if (trimmed.includes("\\") || trimmed.includes("\0")) return null;
  if (trimmed.startsWith("/") || trimmed.startsWith("~") || /^[a-zA-Z]:/.test(trimmed)) return null;
  let decoded = trimmed;
  // Three passes so a triple-encoded held name is denied after decoding.
  // A percent sign that remains is denied, including one that would still decode.
  for (let pass = 0; pass < 3; pass += 1) {
    if (!decoded.includes("%")) break;
    try {
      const next = decodeURIComponent(decoded).normalize("NFKC");
      if (next === decoded) break;
      decoded = next;
    } catch {
      return null;
    }
  }
  if (decoded.includes("%")) return null;
  if (decoded.includes("..") || decoded.includes("\\") || decoded.includes("\0")) return null;
  if (decoded.startsWith("/") || decoded.startsWith("~") || /^[a-zA-Z]:/.test(decoded)) return null;
  const parts = decoded.split("/");
  if (parts.length === 0 || parts.some((part) => part.length === 0 || part === "." || part === "..")) return null;
  if (SECRET_PATH.test(decoded) || HELD_PATH.test(decoded)) return null;
  const basename = parts[parts.length - 1] ?? "";
  if (heldName(basename) || parts.some((part) => heldName(part))) return null;
  return parts.join("/");
}

function extraHeldMarker(): string | null {
  const raw = process.env.SOVEREIGN_HELD_NAME_PATTERN;
  if (raw === undefined) return null;
  const marker = raw.trim().normalize("NFKC").toLowerCase();
  return marker.length > 0 ? marker : null;
}

function heldName(segment: string): boolean {
  const name = segment.normalize("NFKC").toLowerCase();
  if (HELD_NAME_MARKERS.some((marker) => name.includes(marker))) return true;
  const extra = extraHeldMarker();
  return extra !== null && name.includes(extra);
}

function pathsForDelta(paths: readonly string[]): string[] {
  const visible: string[] = [];
  for (const path of paths) {
    const clean = cleanRepoPath(path);
    if (clean) visible.push(clean);
  }
  return visible;
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
  const gate = await deskOwnerGate(cookieHeader);
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
  const gate = await deskOwnerGate(cookieHeader);
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
  const gate = await deskOwnerGate(cookieHeader);
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
  const gate = await deskOwnerGate(cookieHeader);
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
  const gate = await deskOwnerGate(cookieHeader);
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

const REACH_FAIL = "The app could not use the GitHub login.";
const OPEN_FAIL = "The app could not open that.";
const MAIN_FAIL = "I could not reach main.";
const TREE_FAIL = "I could not reach the trees.";
const NOTES_FAIL = "The notes could not be read.";

type DeskEntry = { name: string; kind: string };
type OpenOk = { ok: true; kind: "dir" | "file"; line: string; entries: DeskEntry[]; text: string };
type OpenNo = { ok: false; kind: "no"; line: string; entries: []; text: ""; status?: 401 | 503; error: string };

export async function rickReachGated(
  cookieHeader: string | undefined,
  githubApi: DeskGithubApi,
): Promise<
  | { ok: true; login: string; repos: { name: string; private: boolean }[]; line: string }
  | { ok: false; status: 401 | 503; error: DeskGateDenial["error"]; login: ""; repos: []; line: string }
  | { ok: false; login: ""; repos: []; line: typeof REACH_FAIL }
> {
  const gate = await deskOwnerGate(cookieHeader);
  if (!gate.ok) return { ...gate, login: "", repos: [], line: REACH_FAIL };
  try {
    const user = await githubApi("/user");
    if (!user.ok) return { ok: false, login: "", repos: [], line: REACH_FAIL };
    const who = JSON.parse(user.text) as { login?: unknown };
    const login = typeof who.login === "string" ? who.login.slice(0, 80) : "";
    const reposResult = await githubApi("/user/repos?per_page=20&sort=updated&affiliation=owner");
    const rows = reposResult.ok ? (JSON.parse(reposResult.text) as unknown) : [];
    const repos = Array.isArray(rows)
      ? rows.flatMap((row) => {
          if (!row || typeof row !== "object") return [];
          const rec = row as { name?: unknown; private?: unknown };
          if (typeof rec.name !== "string") return [];
          const match = ALLOWED_REPOS.find((item) => item.repo === rec.name);
          if (!match) return [];
          return [{ name: match.repo, private: rec.private === true }];
        })
      : [];
    return { ok: true, login, repos, line: `${login || "github"}. ${repos.map((row) => row.name).join(", ")}.` };
  } catch {
    return { ok: false, login: "", repos: [], line: REACH_FAIL };
  }
}

export async function openRepoContentsGated(
  input: { repo?: unknown; path?: unknown },
  cookieHeader: string | undefined,
  io: RepoFileIo,
): Promise<OpenOk | OpenNo> {
  const gate = await deskOwnerGate(cookieHeader);
  if (!gate.ok) return { ...gate, kind: "no", line: OPEN_FAIL, entries: [], text: "" };
  const repo = typeof input.repo === "string" ? input.repo.trim().replace(/\.git$/i, "") : "";
  const rawPath = typeof input.path === "string" ? input.path : "";
  if (!rawPath.trim()) {
    const pinnedRepo = ALLOWED_REPOS.find((row) => row.repo === repo);
    if (!pinnedRepo) return openDenied(PATH_DENIED);
    const payload = await fetchContents(io, pinnedRepo.owner, pinnedRepo.repo, "");
    if (!Array.isArray(payload)) return openDenied(OPEN_FAIL);
    return directoryResult(repo, listedEntries(payload, ""));
  }
  const pinned = pinRepoFile({ owner: "vitalitychems-dot", repo, path: rawPath });
  if (!pinned.ok) return openDenied(pinned.error);
  try {
    const file = await readRepoFileGated({ owner: pinned.owner, repo: pinned.repo, path: pinned.path }, cookieHeader, io);
    if (file.ok) return { ok: true, kind: "file", line: pinned.path, entries: [], text: file.text };
    const payload = await fetchContents(io, pinned.owner, pinned.repo, pinned.path);
    if (Array.isArray(payload)) return directoryResult(pinned.path, listedEntries(payload, pinned.path));
    return openDenied(OPEN_FAIL);
  } catch {
    return openDenied(OPEN_FAIL);
  }
}

export async function mainNowGated(
  cookieHeader: string | undefined,
  deps: { githubApi: DeskGithubApi; mainGap: (tesseraSha: string, gitbookSha: string) => { line: string } },
): Promise<{ ok: true; line: string } | { ok: false; status?: 401 | 503; error?: DeskGateDenial["error"]; line: string }> {
  const gate = await deskOwnerGate(cookieHeader);
  if (!gate.ok) return { ...gate, line: MAIN_FAIL };
  try {
    const tessera = await deps.githubApi("/repos/vitalitychems-dot/TESSERA/commits/main");
    const gitbook = await deps.githubApi("/repos/vitalitychems-dot/Gitbook/commits/main");
    const tesseraSha = tessera.ok ? commitSha(tessera.text) : "";
    const gitbookSha = gitbook.ok ? commitSha(gitbook.text) : "";
    if (!tesseraSha || !gitbookSha) return { ok: false, line: MAIN_FAIL };
    return { ok: true, line: deps.mainGap(tesseraSha, gitbookSha).line };
  } catch {
    return { ok: false, line: MAIN_FAIL };
  }
}

export async function treeDeltaGated(
  cookieHeader: string | undefined,
  deps: {
    githubApi: DeskGithubApi;
    tesseraHeld: readonly string[];
    gitbookHeld: readonly string[];
    pathDelta: (
      held: readonly string[],
      live: readonly string[],
    ) => { added: readonly string[]; removed: readonly string[]; held: number; live: number };
    deltaLine: (
      repo: string,
      delta: { added: readonly string[]; removed: readonly string[]; held: number; live: number },
    ) => string;
  },
): Promise<{ ok: true; line: string } | { ok: false; status?: 401 | 503; error?: DeskGateDenial["error"]; line: string }> {
  const gate = await deskOwnerGate(cookieHeader);
  if (!gate.ok) return { ...gate, line: TREE_FAIL };
  try {
    const tesseraCommit = await deps.githubApi("/repos/vitalitychems-dot/TESSERA/commits/main");
    const gitbookCommit = await deps.githubApi("/repos/vitalitychems-dot/Gitbook/commits/main");
    const tesseraTree = tesseraCommit.ok ? treeSha(tesseraCommit.text) : "";
    const gitbookTree = gitbookCommit.ok ? treeSha(gitbookCommit.text) : "";
    if (!tesseraTree || !gitbookTree) return { ok: false, line: TREE_FAIL };
    const tessera = await deps.githubApi(`/repos/vitalitychems-dot/TESSERA/git/trees/${tesseraTree}?recursive=1`);
    const gitbook = await deps.githubApi(`/repos/vitalitychems-dot/Gitbook/git/trees/${gitbookTree}?recursive=1`);
    const tesseraBlobs = tessera.ok ? blobsFrom(tessera.text) : null;
    const gitbookBlobs = gitbook.ok ? blobsFrom(gitbook.text) : null;
    if (!tesseraBlobs || !gitbookBlobs) return { ok: false, line: TREE_FAIL };
    const one = deps.pathDelta(pathsForDelta(deps.tesseraHeld), pathsForDelta(tesseraBlobs.paths));
    const two = deps.pathDelta(pathsForDelta(deps.gitbookHeld), pathsForDelta(gitbookBlobs.paths));
    const cut = tesseraBlobs.truncated || gitbookBlobs.truncated ? " A tree was truncated, so this diff is not complete." : "";
    return { ok: true, line: `${deps.deltaLine("TESSERA", one)} ${deps.deltaLine("Gitbook", two)}${cut}` };
  } catch {
    return { ok: false, line: TREE_FAIL };
  }
}

export async function readGitbookGated(
  cookieHeader: string | undefined,
  deps: { githubApi: DeskGithubApi; gitbookNote: (body: string) => string },
): Promise<
  | { ok: true; error: ""; notes: { user: string; at: string; body: string }[]; files: { name: string; href: string }[] }
  | { ok: false; status?: 401 | 503; error: string; notes: { user: string; at: string; body: string }[]; files: { name: string; href: string }[] }
> {
  const gate = await deskOwnerGate(cookieHeader);
  if (!gate.ok) return { ...gate, notes: [], files: [] };
  const notes: { user: string; at: string; body: string }[] = [];
  try {
    for (let page = 1; page <= 4; page += 1) {
      const result = await deps.githubApi(`/repos/vitalitychems-dot/Gitbook/issues/2/comments?per_page=100&page=${page}`);
      const rows = result.ok ? parsedRows(result.text) : null;
      if (!rows) {
        if (notes.length > 0) break;
        return { ok: false, error: NOTES_FAIL, notes, files: [] };
      }
      for (const row of rows) {
        const rec = row as { user?: { login?: unknown }; created_at?: unknown; body?: unknown };
        const user = typeof rec.user?.login === "string" ? rec.user.login.slice(0, 80) : "github";
        const at = typeof rec.created_at === "string" ? rec.created_at.slice(0, 40) : "";
        const body = deps.gitbookNote(typeof rec.body === "string" ? rec.body : "");
        notes.push({ user, at, body });
      }
      if (rows.length < 100) break;
    }
    const mesh = await deps.githubApi("/repos/vitalitychems-dot/Gitbook/contents/mesh");
    const meshRows = mesh.ok ? parsedRows(mesh.text) : null;
    const files = Array.isArray(meshRows) ? meshFiles(meshRows) : [];
    return { ok: true, error: "", notes: notes.slice(-8), files };
  } catch {
    return { ok: false, error: NOTES_FAIL, notes: [], files: [] };
  }
}

function openDenied(error: string): OpenNo {
  return { ok: false, kind: "no", line: error === PATH_DENIED ? PATH_DENIED : OPEN_FAIL, entries: [], text: "", error };
}

function directoryResult(line: string, entries: DeskEntry[]): OpenOk {
  return { ok: true, kind: "dir", line, entries, text: entries.map((row) => row.name).join(", ") };
}

function listedEntries(data: unknown[], prefix: string): DeskEntry[] {
  const entries: DeskEntry[] = [];
  for (const row of data) {
    if (entries.length >= 40) break;
    if (!row || typeof row !== "object") continue;
    const rec = row as { name?: unknown; type?: unknown };
    if (typeof rec.name !== "string" || !rec.name || rec.name.includes("/") || rec.name.includes("\\")) continue;
    const joined = prefix ? `${prefix}/${rec.name}` : rec.name;
    if (!cleanRepoPath(joined)) continue;
    entries.push({ name: rec.name, kind: rec.type === "dir" ? "dir" : "file" });
  }
  return entries;
}

async function fetchContents(io: RepoFileIo, owner: string, repo: string, path: string): Promise<unknown | null> {
  const token = (await io.token()).trim();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "tessera-chamber",
  };
  if (token && !token.includes(" ")) headers.Authorization = `Bearer ${token}`;
  const suffix = path
    ? `/${path
        .split("/")
        .map((part) => encodeURIComponent(part))
        .join("/")}`
    : "";
  const response = await io.fetchImpl(`https://api.github.com/repos/${owner}/${repo}/contents${suffix}`, {
    method: "GET",
    headers,
  });
  if (!response.ok) return null;
  return response.json();
}

function commitSha(text: string): string {
  try {
    const parsed = JSON.parse(text) as { sha?: unknown };
    return typeof parsed.sha === "string" && /^[0-9a-f]{40}$/i.test(parsed.sha) ? parsed.sha : "";
  } catch {
    return "";
  }
}

function treeSha(text: string): string {
  try {
    const parsed = JSON.parse(text) as { commit?: { tree?: { sha?: unknown } } };
    const sha = parsed.commit?.tree?.sha;
    return typeof sha === "string" && /^[0-9a-f]{40}$/i.test(sha) ? sha : "";
  } catch {
    return "";
  }
}

function blobsFrom(text: string): { paths: string[]; truncated: boolean } | null {
  try {
    const parsed = JSON.parse(text) as { tree?: unknown; truncated?: unknown };
    if (!Array.isArray(parsed.tree)) return null;
    const paths: string[] = [];
    for (const row of parsed.tree) {
      if (!row || typeof row !== "object") continue;
      const rec = row as { path?: unknown; type?: unknown };
      if (rec.type !== "blob" || typeof rec.path !== "string") continue;
      if (rec.path.length > 512 || /[\0\r\n]/.test(rec.path)) continue;
      paths.push(rec.path);
    }
    return { paths, truncated: parsed.truncated === true };
  } catch {
    return null;
  }
}

function parsedRows(text: string): unknown[] | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function meshFiles(rows: unknown[]): { name: string; href: string }[] {
  const files: { name: string; href: string }[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { name?: unknown; type?: unknown };
    if (rec.type !== "file" || typeof rec.name !== "string") continue;
    if (!cleanRepoPath(`mesh/${rec.name}`)) continue;
    files.push({
      name: rec.name,
      href: `https://github.com/vitalitychems-dot/Gitbook/blob/main/mesh/${encodeURIComponent(rec.name)}`,
    });
  }
  return files;
}
