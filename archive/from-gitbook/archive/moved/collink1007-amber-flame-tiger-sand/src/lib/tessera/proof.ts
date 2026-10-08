import { createServerFn } from "@tanstack/react-start";

const REPOS = ["Grok-ready", "T44", "1T", "TX", "TESS"] as const;
const LOG = "/workspace/data/tessera-proof.json";

export type ProofRow = {
  at: string;
  target: string;
  ok: boolean;
  detail: string;
};

let cursor = 0;

async function readLog(): Promise<ProofRow[]> {
  const { readFile } = await import("node:fs/promises");
  try {
    const raw = await readFile(LOG, "utf8");
    const parsed = JSON.parse(raw) as ProofRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeLog(rows: ProofRow[]) {
  const { mkdir, writeFile } = await import("node:fs/promises");
  await mkdir("/workspace/data", { recursive: true });
  await writeFile(LOG, JSON.stringify(rows.slice(-30), null, 2));
}

export const readProof = createServerFn({ method: "POST" }).handler(async () => {
  return { rows: await readLog() };
});

/** One real GitHub commit lookup. Writes the HTTP result to disk. */
export const runProof = createServerFn({ method: "POST" }).handler(async () => {
  const repo = REPOS[cursor % REPOS.length];
  cursor += 1;
  const url = `https://api.github.com/repos/vitalitychems-dot/${repo}/commits/main`;
  const at = new Date().toISOString();
  let row: ProofRow;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "tessera-proof",
      },
    });
    if (!res.ok) {
      row = { at, target: repo, ok: false, detail: `HTTP ${res.status}` };
    } else {
      const body = (await res.json()) as { sha?: string; commit?: { committer?: { date?: string } } };
      const sha = (body.sha ?? "").slice(0, 7);
      const when = body.commit?.committer?.date ?? "no date";
      row = { at, target: repo, ok: Boolean(sha), detail: sha ? `${sha} committed ${when}` : "no sha in the response" };
    }
  } catch (error) {
    row = { at, target: repo, ok: false, detail: error instanceof Error ? error.message : "fetch failed" };
  }
  const rows = [...(await readLog()), row].slice(-30);
  await writeLog(rows);
  return { rows };
});
