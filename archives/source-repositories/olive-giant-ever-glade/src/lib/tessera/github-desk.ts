import { createServerFn } from "@tanstack/react-start";
import { dataPath } from "./data-path";
import { repeatedFirstLine } from "./duplicate-guard";
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
    const refused = noteAllowed(data.text);
    if (refused) return { ok: false as const, error: refused };
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "");
    const path = `notes/${stamp}-chamber.md`;
    const body = `Builder desk. Not Tessera speaking. Father asked for this write.\n\n${data.text.trim()}\n`;
    const content = Buffer.from(body, "utf8").toString("base64");
    const result = await gh([
      "api",
      "--method",
      "PUT",
      "repos/vitalitychems-dot/tessera-coordination/contents/" + path,
      "-f",
      "message=Add a chamber coordination note.",
      "-f",
      `content=${content}`,
      "-f",
      "branch=main",
    ]);
    if (result.code !== 0) return { ok: false as const, error: "The coordination note was not written." };
    return { ok: true as const, url: `https://github.com/vitalitychems-dot/tessera-coordination/blob/main/${path}` };
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
    const result = await githubApi("/repos/vitalitychems-dot/tessera-coordination/issues/4/comments");
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
  for (const issue of [4, 2]) {
    try {
      const result = await githubApi(`/repos/vitalitychems-dot/tessera-coordination/issues/${issue}/comments`);
      if (!result.ok) return `The duplicate guard could not read issue ${issue}, so the comment was not posted.`;
      const existing = JSON.parse(result.text) as { body?: string }[];
      if (repeatedFirstLine(existing, body)) return "That first line is already on the board. The comment was not posted.";
    } catch {
      return "The duplicate guard could not read the board, so the comment was not posted.";
    }
  }
  return null;
}

export function openQuestion(lines: { id?: number; body: string }[]) {
  let closedAt = -1;
  let found: { id: number; index: number } | null = null;
  lines.forEach((line, index) => {
    if (/^Father:\s*(YES|NO)\b/m.test(line.body)) closedAt = index;
    const lane = /^Lane: (Cursor|Grok Bot)/m.test(line.body);
    const asks = /^Question: .+/m.test(line.body) && /Need: yes or no/m.test(line.body);
    if (lane && asks && line.id) found = { id: line.id, index };
  });
  if (!found || found.index <= closedAt) return null;
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
      const result = await githubApi("/repos/vitalitychems-dot/tessera-coordination/issues/4/comments", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      if (result.ok) return { ok: true as const, url: "https://github.com/vitalitychems-dot/tessera-coordination/issues/4" };
      return { ok: false as const, error: `The approval was not posted (${result.status}). ${result.text}`.slice(0, 280) };
    } catch {
      return { ok: false as const, error: "The approval was not posted." };
    }
  });

export const readListComments = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const result = await githubApi("/repos/vitalitychems-dot/tessera-coordination/issues/3/comments");
    if (result.ok) {
      const parsed = JSON.parse(result.text) as { user?: { login?: string }; body?: string }[];
      const lines = parsed.map((row) => ({ user: row.user?.login ?? "github", body: row.body ?? "" }));
      return { ok: true as const, lines: lines.slice(-20), error: "" };
    }
  } catch {
    /* the list itself is already in the page */
  }
  return { ok: true as const, lines: [] as { user: string; body: string }[], error: "" };
});

export const postBoard = createServerFn({ method: "POST" })
  .validator((input: { text: string }) => input)
  .handler(async ({ data }) => {
    const refused = noteAllowed(data.text);
    if (refused) return { ok: false as const, error: refused };
    const body = `Father, from the chamber:\n\n${data.text.trim()}\n\nGrok Bot, Cursor, and Replit: reply on this issue as yourselves. Do not speak as Tessera. Do not push Zz main.`;
    const repeated = await refuseRepeat(body);
    if (repeated) return { ok: false as const, error: repeated };
    try {
      const result = await githubApi("/repos/vitalitychems-dot/tessera-coordination/issues/4/comments", {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      if (result.ok) {
        const cached = (await readCachedBoard()) ?? [];
        await saveCachedBoard([...cached, { user: "vitalitychems-dot", body }]);
        return { ok: true as const, url: "https://github.com/vitalitychems-dot/tessera-coordination/issues/4" };
      }
      const { execFile } = await import("node:child_process");
      const posted = await new Promise<boolean>((resolve) => {
        execFile(
          "/usr/local/bin/gh",
          ["issue", "comment", "2", "--repo", "vitalitychems-dot/tessera-coordination", "--body", body],
          { timeout: 20000, env: { ...process.env, HOME: "/root", PATH: "/usr/local/bin:/usr/bin" } },
          (error) => resolve(!error),
        );
      });
      if (posted) {
        const cached = (await readCachedBoard()) ?? [];
        await saveCachedBoard([...cached, { user: "vitalitychems-dot", body }]);
        return { ok: true as const, url: "https://github.com/vitalitychems-dot/tessera-coordination/issues/4" };
      }
      const reason = result.status === 401 ? `Sign-in failure (401). ${result.text}` : `The command was not posted (${result.status}). ${result.text}`;
      return { ok: false as const, error: reason.slice(0, 280) };
    } catch {
      return { ok: false as const, error: "The command was not posted." };
    }
  });

