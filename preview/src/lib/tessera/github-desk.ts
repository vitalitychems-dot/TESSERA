import { execFile } from "node:child_process";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  openPullsGated,
  postApprovalGated,
  postBoardGated,
  readBoardGated,
  readRepoFileGated,
} from "../../../../artifacts/api-server/src/lib/github-desk-gate";
import { gitbookNote } from "./gitbook-note";
import { dataPath } from "./data-path";
import { repeatedFirstLine } from "./duplicate-guard";
import { writeRefusal } from "./repo-guard";
import { mainGap } from "./main-gap";
import { deltaLine, pathDelta, pathList } from "./path-delta";
import { PATHS as GITBOOK_PATHS } from "./gitbook-paths";
import { PATHS as TESSERA_PATHS } from "./tessera-paths";
import savedBoard from "../../../data/coordination/board.json";

const SECRET = /SESSION_SECRET|BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]|github_pat_|xox[baprs]-|sk-[A-Za-z0-9]{10,}/;

export function noteAllowed(text: string) {
  const body = text.trim();
  if (body.length < 2 || body.length > 12_000) return "The note must stay between 2 and 12000 characters.";
  if (SECRET.test(body)) return "That note contains a secret and was not written.";
  return null;
}

function requestCookie(): string | undefined {
  try {
    const header = getRequest().headers.get("cookie");
    return typeof header === "string" && header.length > 0 ? header : undefined;
  } catch {
    return undefined;
  }
}

async function ghIssueComment(body: string) {
  return new Promise<boolean>((resolve) => {
    execFile(
      "/usr/local/bin/gh",
      ["issue", "comment", "2", "--repo", "vitalitychems-dot/Gitbook", "--body", body],
      { timeout: 20000, env: { ...process.env, HOME: "/root", PATH: "/usr/local/bin:/usr/bin" } },
      (error) => resolve(!error),
    );
  });
}

export const readRepoFile = createServerFn({ method: "POST" })
  .validator((input: { owner: string; repo: string; path: string }) => input)
  .handler(async ({ data }) => readRepoFileGated(data, requestCookie(), { token: githubToken, fetchImpl: fetch }));

export const writeCoordinationNote = createServerFn({ method: "POST" })
  .validator((input: { text: string }) => input)
  .handler(async ({ data }) => {
    const refused = noteAllowed(data.text) ?? writeRefusal("vitalitychems-dot/Gitbook");
    if (refused) return { ok: false as const, error: refused };
    return {
      ok: false as const,
      error: "A file is not written from here. Post the note on Gitbook issue 2. TESSERA changes wait until that note is approved.",
    };
  });

async function readCachedBoard() {
  const { readFile } = await import("node:fs/promises");
  for (const path of [dataPath("coordination", "board.json"), "/workspace/data/coordination/board.json", "/tmp/tessera-board.json"]) {
    try {
      const parsed = JSON.parse(await readFile(path, "utf8")) as { user: string; body: string }[];
      if (Array.isArray(parsed)) return parsed;
    } catch {
      /* try the next copy */
    }
  }
  return null;
}

async function saveCachedBoard(lines: { user: string; body: string }[]) {
  const { writeFile } = await import("node:fs/promises");
  const text = JSON.stringify(lines.slice(-20));
  for (const path of ["/tmp/tessera-board.json", "/workspace/data/coordination/board.json"]) {
    try {
      await writeFile(path, text);
    } catch {
      /* the other copy may still be writable */
    }
  }
}

async function githubToken() {
  const { execFile } = await import("node:child_process");
  const { writeFile } = await import("node:fs/promises");
  const fromGh = await new Promise<string>((resolve) => {
    execFile(
      "/usr/local/bin/gh",
      ["auth", "token"],
      { timeout: 10000, env: { ...process.env, HOME: "/root", PATH: "/usr/local/bin:/usr/bin" } },
      (error, stdout) => resolve(error ? "" : stdout.trim()),
    );
  });
  if (fromGh && !fromGh.includes(" ")) {
    try {
      await writeFile("/tmp/tessera-gh-token", fromGh, { mode: 0o600 });
    } catch {
      /* the live token still works for this call */
    }
    return fromGh;
  }
  const fromEnv = process.env.GH_TOKEN?.trim() || process.env.GITHUB_TOKEN?.trim() || "";
  if (fromEnv && !fromEnv.includes(" ")) return fromEnv;
  const { readFile } = await import("node:fs/promises");
  try {
    const stored = (await readFile("/tmp/tessera-gh-token", "utf8")).trim();
    if (stored && !stored.includes(" ")) return stored;
  } catch {
    /* the login file is optional */
  }
  return "";
}

async function githubApi(path: string, init?: { method?: string; body?: string }) {
  const token = await githubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "tessera-chamber",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com${path}`, { method: init?.method ?? "GET", headers, body: init?.body });
  const text = (await res.text()).replace(/ghu_\S+|github_pat_\S+/g, "redacted");
  return { ok: res.ok, status: res.status, text: res.ok ? text : text.slice(0, 400) };
}

export const readBoard = createServerFn({ method: "POST" }).handler(async () => {
  return readBoardGated(requestCookie(), {
    githubApi,
    readCachedBoard,
    saveCachedBoard,
    savedBoard: Array.isArray(savedBoard) ? savedBoard : [],
  });
});

export const openPulls = createServerFn({ method: "POST" }).handler(async () => openPullsGated(requestCookie(), githubApi));

async function refuseRepeat(body: string) {
  const blocked = writeRefusal("vitalitychems-dot/Gitbook");
  if (blocked) return blocked;
  try {
    const result = await githubApi("/repos/vitalitychems-dot/Gitbook/issues/2/comments");
    if (!result.ok) return "The duplicate guard could not read Gitbook issue 2, so the comment was not posted.";
    const existing = JSON.parse(result.text) as { body?: string }[];
    const bodies = existing.flatMap((row) => (typeof row.body === "string" ? [{ body: row.body }] : []));
    if (repeatedFirstLine(bodies, body)) return "That first line is already on the board. The comment was not posted.";
  } catch {
    return "The duplicate guard could not read the board, so the comment was not posted.";
  }
  return null;
}

export function openQuestion(lines: { id?: number; body: string }[]) {
  let closedAt = -1;
  let found: { id: number; index: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^Father:\s*(YES|NO)\b/m.test(line.body)) closedAt = index;
    const lane = /^Lane: (Cursor|Grok Bot)/m.test(line.body);
    const asks = /^Question: .+/m.test(line.body) && /Need: yes or no/m.test(line.body);
    if (lane && asks && line.id) found = { id: line.id, index };
  }
  if (found === null || found.index <= closedAt) return null;
  return found;
}

export const postApproval = createServerFn({ method: "POST" })
  .validator((input: { decision: "YES" | "NO"; commentId: number }) => input)
  .handler(async ({ data }) => postApprovalGated(data, requestCookie(), { githubApi, refuseRepeat }));

export const readListComments = createServerFn({ method: "POST" }).handler(async () => {
  return { ok: true as const, lines: [] as { user: string; body: string }[], error: "" };
});

export const postBoard = createServerFn({ method: "POST" })
  .validator((input: { text: string }) => input)
  .handler(async ({ data }) =>
    postBoardGated(data, requestCookie(), {
      githubApi,
      noteAllowed,
      writeRefusal,
      refuseRepeat,
      readCachedBoard,
      saveCachedBoard,
      ghComment: ghIssueComment,
    }),
  );

const HIS = new Set(["TESSERA", "Gitbook", "GitbookAI", "vitality"]);

async function ghJson(path: string) {
  const token = await githubToken();
  if (!token) return { ok: false as const, status: 0, data: null };
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "User-Agent": "tessera-chamber" },
  });
  if (!res.ok) return { ok: false as const, status: res.status, data: null };
  return { ok: true as const, status: res.status, data: await res.json() };
}

export const rickReach = createServerFn({ method: "POST" }).handler(async () => {
  const user = await ghJson("/user");
  if (!user.ok || !user.data) {
    return { ok: false as const, login: "", repos: [] as { name: string; private: boolean }[], line: "The app could not use the GitHub login." };
  }
  const who = user.data as { login?: string };
  const repos = await ghJson("/user/repos?per_page=20&sort=updated&affiliation=owner");
  const list = Array.isArray(repos.data)
    ? (repos.data as { name?: string; private?: boolean }[]).flatMap((row) =>
        row.name && HIS.has(row.name) ? [{ name: row.name, private: Boolean(row.private) }] : [],
      )
    : [];
  return { ok: true as const, login: who.login ?? "", repos: list, line: `${who.login ?? "github"}. ${list.map((row) => row.name).join(", ")}.` };
});

export async function openRepoContents(repo: string, filePath = "") {
  if (!HIS.has(repo)) return { ok: false as const, kind: "no" as const, line: "That repository is not his.", entries: [] as { name: string; kind: string }[], text: "" };
  const path = filePath.replace(/^\/+/, "").replace(/\.\./g, "");
  const target = path
    ? `/repos/vitalitychems-dot/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`
    : `/repos/vitalitychems-dot/${encodeURIComponent(repo)}/contents`;
  const opened = await ghJson(target);
  if (!opened.ok || !opened.data) {
    return { ok: false as const, kind: "no" as const, line: `Could not open ${repo}. ${opened.status}.`, entries: [], text: "" };
  }
  if (Array.isArray(opened.data)) {
    const entries = (opened.data as { name?: string; type?: string }[])
      .slice(0, 40)
      .flatMap((row) => (row.name ? [{ name: row.name, kind: row.type === "dir" ? "dir" : "file" }] : []));
    return { ok: true as const, kind: "dir" as const, line: path || repo, entries, text: entries.map((row) => row.name).join(", ") };
  }
  const file = opened.data as { content?: string; encoding?: string; size?: number; name?: string };
  if ((file.size ?? 0) > 80_000) return { ok: true as const, kind: "file" as const, line: file.name ?? path, entries: [], text: "That file is too large to bring into the room." };
  const raw = file.encoding === "base64" && file.content ? Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8") : "";
  const text = SECRET.test(raw) ? "A secret is in that file. It was not brought into the room." : raw.slice(0, 1800);
  return { ok: true as const, kind: "file" as const, line: file.name ?? path, entries: [], text };
}

export const rickOpen = createServerFn({ method: "POST" })
  .validator((input: { repo?: string; path?: string }) => ({
    repo: typeof input?.repo === "string" ? input.repo : "",
    path: typeof input?.path === "string" ? input.path : "",
  }))
  .handler(async ({ data }) => openRepoContents(data.repo, data.path));

export const mainNow = createServerFn({ method: "POST" }).handler(async () => {
  const tessera = await ghJson("/repos/vitalitychems-dot/TESSERA/commits/main");
  const gitbook = await ghJson("/repos/vitalitychems-dot/Gitbook/commits/main");
  const tesseraSha = (tessera.data as { sha?: string } | null)?.sha ?? "";
  const gitbookSha = (gitbook.data as { sha?: string } | null)?.sha ?? "";
  if (!tesseraSha || !gitbookSha) return { ok: false as const, line: "I could not reach main." };
  return { ok: true as const, line: mainGap(tesseraSha, gitbookSha).line };
});

type TreeFile = { path?: string; type?: string };

export const treeDelta = createServerFn({ method: "POST" }).handler(async () => {
  const tesseraCommit = await ghJson("/repos/vitalitychems-dot/TESSERA/commits/main");
  const gitbookCommit = await ghJson("/repos/vitalitychems-dot/Gitbook/commits/main");
  const tesseraTree = (tesseraCommit.data as { commit?: { tree?: { sha?: string } } } | null)?.commit?.tree?.sha ?? "";
  const gitbookTree = (gitbookCommit.data as { commit?: { tree?: { sha?: string } } } | null)?.commit?.tree?.sha ?? "";
  if (!tesseraTree || !gitbookTree) return { ok: false as const, line: "I could not reach the trees." };
  const tessera = await ghJson(`/repos/vitalitychems-dot/TESSERA/git/trees/${tesseraTree}?recursive=1`);
  const gitbook = await ghJson(`/repos/vitalitychems-dot/Gitbook/git/trees/${gitbookTree}?recursive=1`);
  const tesseraData = tessera.data as { tree?: TreeFile[]; truncated?: boolean } | null;
  const gitbookData = gitbook.data as { tree?: TreeFile[]; truncated?: boolean } | null;
  if (!tessera.ok || !gitbook.ok || !tesseraData?.tree || !gitbookData?.tree) return { ok: false as const, line: "I could not read the trees." };
  const blobs = (tree: TreeFile[]) => tree.flatMap((row) => (row.type === "blob" && row.path ? [row.path] : []));
  const one = pathDelta(pathList(TESSERA_PATHS), blobs(tesseraData.tree));
  const two = pathDelta(pathList(GITBOOK_PATHS), blobs(gitbookData.tree));
  const cut = tesseraData.truncated || gitbookData.truncated ? " A tree was truncated, so this diff is not complete." : "";
  return { ok: true as const, line: `${deltaLine("TESSERA", one)} ${deltaLine("Gitbook", two)}${cut}` };
});

export { gitbookNote } from "./gitbook-note";

export const readGitbook = createServerFn({ method: "POST" }).handler(async () => {
  const notes: { user: string; at: string; body: string }[] = [];
  for (let page = 1; page <= 4; page += 1) {
    const result = await ghJson(`/repos/vitalitychems-dot/Gitbook/issues/2/comments?per_page=100&page=${page}`);
    if (!result.ok || !Array.isArray(result.data)) {
      if (notes.length > 0) break;
      return { ok: false as const, error: `Gitbook issue 2 could not be read. ${result.status}.`, notes, files: [] as { name: string; href: string }[] };
    }
    for (const row of result.data as { user?: { login?: string }; created_at?: string; body?: string }[]) {
      notes.push({ user: row.user?.login ?? "github", at: row.created_at ?? "", body: gitbookNote(row.body ?? "") });
    }
    if (result.data.length < 100) break;
  }
  const mesh = await ghJson("/repos/vitalitychems-dot/Gitbook/contents/mesh");
  const files = Array.isArray(mesh.data)
    ? (mesh.data as { name?: string; html_url?: string; type?: string }[]).flatMap((row) =>
        row.name && row.type === "file"
          ? [{ name: row.name, href: row.html_url ?? `https://github.com/vitalitychems-dot/Gitbook/blob/main/mesh/${row.name}` }]
          : [],
      )
    : [];
  return { ok: true as const, error: "", notes: notes.slice(-8), files };
});


