import { createServerFn } from "@tanstack/react-start";
import { gitbookNote } from "./gitbook-note";
import { dataPath } from "./data-path";
import { repeatedFirstLine } from "./duplicate-guard";
import { writeRefusal } from "./repo-guard";
import savedBoard from "../../../data/coordination/board.json";

const SECRET = /SESSION_SECRET|BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]|github_pat_|xox[baprs]-|sk-[A-Za-z0-9]{10,}/;

export function noteAllowed(text: string) {
  const body = text.trim();
  if (body.length < 2 || body.length > 12_000) return "The note must stay between 2 and 12000 characters.";
  if (SECRET.test(body)) return "That note contains a secret and was not written.";
  return null;
}

async function gh(args: string[]) {
  const { execFile } = await import("node:child_process");
  const bins = ["/usr/local/bin/gh", "gh"];
  let last = "gh was not found on this machine.";
  for (const bin of bins) {
    const result = await new Promise<{ code: number; out: string }>((resolve) => {
      execFile(
        bin,
        args,
        {
          timeout: 20000,
          maxBuffer: 2_000_000,
          env: { ...process.env, PATH: `/usr/local/bin:/usr/bin:${process.env.PATH ?? ""}` },
        },
        (error, stdout, stderr) => {
          resolve({ code: error ? 1 : 0, out: `${stdout}${stderr}`.replace(/ghu_\S+/g, "ghu_redacted").trim() });
        },
      );
    });
    if (result.code === 0) return result;
    last = result.out || last;
  }
  return { code: 1, out: last.slice(0, 280) };
}

export const readRepoFile = createServerFn({ method: "POST" })
  .validator((input: { owner: string; repo: string; path: string }) => input)
  .handler(async ({ data }) => {
    const owner = data.owner.trim();
    const repo = data.repo.trim().replace(/\.git$/, "");
    const path = data.path.trim().replace(/^\/+/, "");
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo) || !path || path.includes("..")) {
      return { ok: false as const, error: "That repository path is not allowed." };
    }
    const result = await gh(["api", `repos/${owner}/${repo}/contents/${path}`, "--jq", ".content"]);
    if (result.code !== 0) return { ok: false as const, error: "That file could not be read." };
    let text = "";
    try {
      text = Buffer.from(result.out.replace(/\n/g, ""), "base64").toString("utf8");
    } catch {
      return { ok: false as const, error: "That file was not text." };
    }
    if (SECRET.test(text)) return { ok: false as const, error: "That file looks like a secret and was not returned." };
    return { ok: true as const, text: text.slice(0, 4000), path: `${owner}/${repo}/${path}` };
  });

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
  try {
    const result = await githubApi("/repos/vitalitychems-dot/Gitbook/issues/2/comments");
    if (result.ok) {
      const parsed = JSON.parse(result.text) as { id?: number; user?: { login?: string }; body?: string }[];
      const lines = parsed.map((row) => ({ id: row.id ?? 0, user: row.user?.login ?? "github", body: row.body ?? "" }));
      await saveCachedBoard(lines);
      return { ok: true as const, lines: lines.slice(-20), error: "" };
    }
  } catch {
    /* fall through to the saved copy */
  }
  const cached = await readCachedBoard();
  if (cached) return { ok: true as const, lines: cached.slice(-20), error: "" };
  if (Array.isArray(savedBoard) && savedBoard.length > 0) {
    return { ok: true as const, lines: savedBoard.slice(-20), error: "" };
  }
  return { ok: false as const, error: "The command center could not be read.", lines: [] as { id?: number; user: string; body: string }[] };
});

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
  .handler(async ({ data }) => {
    if (data.decision !== "YES" && data.decision !== "NO") return { ok: false as const, error: "The decision must be yes or no." };
    if (!Number.isInteger(data.commentId) || data.commentId < 1) return { ok: false as const, error: "No question is open." };
    const body = `Father: ${data.decision}\nQuestion comment: ${data.commentId}\nMerge: no`;
    const repeated = await refuseRepeat(body);
    if (repeated) return { ok: false as const, error: repeated };
    try {
      const result = await githubApi("/repos/vitalitychems-dot/Gitbook/issues/2/comments", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      if (result.ok) return { ok: true as const, url: "https://github.com/vitalitychems-dot/Gitbook/issues/2" };
      return { ok: false as const, error: `The approval was not posted (${result.status}). ${result.text}`.slice(0, 280) };
    } catch {
      return { ok: false as const, error: "The approval was not posted." };
    }
  });

export const readListComments = createServerFn({ method: "POST" }).handler(async () => {
  return { ok: true as const, lines: [] as { user: string; body: string }[], error: "" };
});

export const postBoard = createServerFn({ method: "POST" })
  .validator((input: { text: string }) => input)
  .handler(async ({ data }) => {
    const refused = noteAllowed(data.text) ?? writeRefusal("vitalitychems-dot/Gitbook");
    if (refused) return { ok: false as const, error: refused };
    const body = `Father, from the chamber:\n\n${data.text.trim()}\n\nGrok Bot, Cursor, and Replit: reply on Gitbook issue 2 as yourselves. Do not speak as Tessera. Do not push any repo but TESSERA, and only after this note is approved.`;
    const repeated = await refuseRepeat(body);
    if (repeated) return { ok: false as const, error: repeated };
    try {
      const result = await githubApi("/repos/vitalitychems-dot/Gitbook/issues/2/comments", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      if (result.ok) {
        const cached = (await readCachedBoard()) ?? [];
        await saveCachedBoard([...cached, { user: "vitalitychems-dot", body }]);
        return { ok: true as const, url: "https://github.com/vitalitychems-dot/Gitbook/issues/2" };
      }
      const { execFile } = await import("node:child_process");
      const posted = await new Promise<boolean>((resolve) => {
        execFile(
          "/usr/local/bin/gh",
          ["issue", "comment", "2", "--repo", "vitalitychems-dot/Gitbook", "--body", body],
          { timeout: 20000, env: { ...process.env, HOME: "/root", PATH: "/usr/local/bin:/usr/bin" } },
          (error) => resolve(!error),
        );
      });
      if (posted) {
        const cached = (await readCachedBoard()) ?? [];
        await saveCachedBoard([...cached, { user: "vitalitychems-dot", body }]);
        return { ok: true as const, url: "https://github.com/vitalitychems-dot/Gitbook/issues/2" };
      }
      const reason = result.status === 401 ? `Sign-in failure (401). ${result.text}` : `The command was not posted (${result.status}). ${result.text}`;
      return { ok: false as const, error: reason.slice(0, 280) };
    } catch {
      return { ok: false as const, error: "The command was not posted." };
    }
  });

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


