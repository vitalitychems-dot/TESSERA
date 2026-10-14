export interface GitbookTask {
  id: string;
  owner: string;
  status: string;
  deliverable: string;
  acceptanceTest: string;
}

export interface GitbookRoadmapData {
  tasks: GitbookTask[];
  rules: string[];
  conferenceRules: string[];
  activeClaims: string[];
  observedAt: string;
  stale: boolean;
  sources: {
    backlog: { url: string; revision: string };
    handoff: { url: string; updatedAt: string };
    conference: { url: string; revision: string };
    checkins: { url: string; revision: string };
  };
}

const MAX_TASKS = 300;
const MAX_CELL_LENGTH = 2_000;
export const MAX_PROGRESS_NOTE_LENGTH = 2_000;

function cell(value: string | undefined): string {
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_CELL_LENGTH);
}

export function parseGitbookTasks(markdown: string): GitbookTask[] {
  if (markdown.length > 1_500_000) throw new Error("Gitbook backlog is too large.");

  const tasks: GitbookTask[] = [];
  const seen = new Set<string>();
  for (const line of markdown.split(/\r?\n/)) {
    if (!/^\|\s*HYB-\d{3}\s*\|/.test(line)) continue;
    const columns = line.split("|").map(value => value.trim());
    const id = cell(columns[1]);
    if (!/^HYB-\d{3}$/.test(id) || seen.has(id)) continue;
    const owner = cell(columns[2]);
    const status = cell(columns[3]);
    const deliverable = cell(columns[4]);
    const acceptanceTest = cell(columns[5]);
    if (!owner || !status || !deliverable || !acceptanceTest) continue;
    tasks.push({ id, owner, status, deliverable, acceptanceTest });
    seen.add(id);
    if (tasks.length >= MAX_TASKS) break;
  }
  return tasks;
}

export function extractSectionBullets(markdown: string, heading: string, maxBytes = 250_000): string[] {
  if (markdown.length > maxBytes) throw new Error("Gitbook instruction source is too large.");
  const headingIndex = markdown.indexOf(heading);
  if (headingIndex < 0) return [];
  const section = markdown.slice(headingIndex + heading.length);
  const nextHeading = section.search(/^##\s/m);
  const body = nextHeading < 0 ? section : section.slice(0, nextHeading);
  return body.split(/\r?\n/)
    .filter(line => /^\s*[-*]\s+/.test(line))
    .map(line => line.replace(/^\s*[-*]\s+/, "").trim().slice(0, MAX_CELL_LENGTH))
    .filter(Boolean)
    .slice(0, 30);
}

export function parseGitbookRules(handoff: string): string[] {
  return extractSectionBullets(handoff, "## Global rules");
}

export function parseConferenceRules(brief: string): string[] {
  return extractSectionBullets(brief, "## Conference rules");
}

export function parseActiveClaims(ledger: string): string[] {
  if (ledger.length > 1_500_000) throw new Error("Gitbook check-in ledger is too large.");
  const headingIndex = ledger.indexOf("## Active claims");
  if (headingIndex < 0) return [];
  const section = ledger.slice(headingIndex + "## Active claims".length);
  const nextHeading = section.search(/^##\s/m);
  const body = nextHeading < 0 ? section : section.slice(0, nextHeading);
  return [...body.matchAll(/^###\s+(.+)$/gm)]
    .map(match => (match[1] ?? "").trim().slice(0, 240))
    .filter(Boolean)
    .slice(0, 30);
}

export function validateGitbookProgress(
  taskIdValue: unknown,
  noteValue: unknown,
  publicConfirmation: unknown,
  knownTaskIds: ReadonlySet<string>,
): { ok: true; taskId: string; note: string } | { ok: false; error: string } {
  if (typeof taskIdValue !== "string" || !/^HYB-\d{3}$/.test(taskIdValue) || !knownTaskIds.has(taskIdValue)) {
    return { ok: false, error: "Select a task from the current Gitbook backlog." };
  }
  if (typeof noteValue !== "string") return { ok: false, error: "Enter a progress note." };
  const note = noteValue.replace(/\r\n?/g, "\n").trim();
  if (!note || note.length > MAX_PROGRESS_NOTE_LENGTH || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(note)) {
    return { ok: false, error: "Use a note of 1–2,000 characters without control characters." };
  }
  if (publicConfirmation !== true) {
    return { ok: false, error: "Confirm that this public note contains no secrets or private information." };
  }
  return { ok: true, taskId: taskIdValue, note };
}

export function escapeGitHubCommentText(value: string): string {
  return value.split("\n").map(line =>
    `> ${line
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/([\\`*_{}\[\]()#+.!|])/g, "\\$1")
      .replace(/@/g, "@\u200b")}`
  ).join("\n");
}
