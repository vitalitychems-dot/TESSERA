import { createServerFn } from "@tanstack/react-start";

export type PublicIssue = { number: number; title: string; state: string; url: string };

export const readPublicBoard = createServerFn({ method: "GET" }).handler(async () => {
  if (typeof window !== "undefined") return { ok: false as const, error: "The board is read on the server.", issues: [] as PublicIssue[] };
  try {
    const response = await fetch("https://api.github.com/repos/vitalitychems-dot/GitbookAI/issues?state=open&per_page=20", {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "tessera-chamber" },
    });
    if (!response.ok) return { ok: false as const, error: `GitHub returned ${response.status}.`, issues: [] as PublicIssue[] };
    const rows = (await response.json()) as { number: number; title: string; state: string; html_url: string; pull_request?: unknown }[];
    const issues = rows
      .filter((row) => !row.pull_request)
      .map((row) => ({ number: row.number, title: row.title, state: row.state, url: row.html_url }));
    return { ok: true as const, issues };
  } catch {
    return { ok: false as const, error: "The public board could not be read.", issues: [] as PublicIssue[] };
  }
});
