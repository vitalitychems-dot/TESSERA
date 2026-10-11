import { findLines, nameQuery } from "./find-line.ts";
import { afterCopy } from "./forty.ts";
import { tokenFind } from "./token-index.ts";
import { COUNT as GITBOOK_FILES, PATHS as GITBOOK_PATHS, SHA as GITBOOK_SHA } from "./gitbook-paths.ts";
import { COUNT as TESSERA_FILES, PATHS as TESSERA_PATHS, SHA as TESSERA_SHA } from "./tessera-paths.ts";

/** Look up a name on the lists. The file body is not opened. */

function lines(block: string) {
  return block.split("\n").filter(Boolean);
}

let cached: Map<string, string[]> | null = null;

export function byName(name: string) {
  return nameIndex().get(name.trim().toLowerCase()) ?? [];
}

export function nameIndex() {
  if (cached) return cached;
  const built = new Map<string, string[]>();
  const add = (block: string, repo: string) => {
    for (const line of lines(block)) {
      const base = line.split("/").pop()?.toLowerCase() ?? "";
      if (!base) continue;
      const row = built.get(base) ?? [];
      row.push(`${repo} ${line}`);
      built.set(base, row);
    }
  };
  add(TESSERA_PATHS, "TESSERA");
  add(GITBOOK_PATHS, "Gitbook");
  cached = built;
  return cached;
}

export function look(query: string, messages: { content: string }[]) {
  const onScreen = findLines(messages, query).map((line) => line.content);
  const asked = nameQuery(query);
  if (!asked) return onScreen.join("\n");
  if (query.trim().includes(" ")) {
    const hits = tokenFind(query);
    const files = hits.length ? `${hits.join("\n")}\nI did not open the bodies.` : "";
    return [onScreen.join("\n"), files].filter(Boolean).join("\n\n");
  }
  const report = findReport(asked);
  const files = report.hits.length
    ? `${report.hits.join("\n")}\nTESSERA left ${report.tesseraLeft}. Gitbook left ${report.gitbookLeft}. I did not open the bodies.`
    : "";
  return [onScreen.join("\n"), files].filter(Boolean).join("\n\n");
}

export function filesIn(repo: "tessera" | "gitbook", folder: string) {
  const prefix = `${folder.replace(/^\/+|\/+$/g, "")}/`;
  const block = repo === "tessera" ? TESSERA_PATHS : GITBOOK_PATHS;
  let count = 0;
  for (const line of lines(block)) if (line.startsWith(prefix)) count += 1;
  return count;
}

export function namesLike(needle: string, limit = 4) {
  return findReport(needle, limit).hits;
}

function rank(line: string, want: string) {
  const lower = line.toLowerCase();
  const exact = lower === want || lower.endsWith(`/${want}`) ? 0 : 1;
  return exact;
}

export function findReport(needle: string, limit = 4) {
  const want = needle.toLowerCase();
  const take = (block: string, repo: string) => {
    const found: string[] = [];
    for (const line of lines(block)) if (line.toLowerCase().includes(want)) found.push(line);
    found.sort((a, b) => rank(a, want) - rank(b, want) || a.length - b.length || a.localeCompare(b));
    return { hits: found.slice(0, limit).map((line) => `${repo} ${line}`), left: Math.max(0, found.length - limit) };
  };
  const tessera = take(TESSERA_PATHS, "TESSERA");
  const gitbook = take(GITBOOK_PATHS, "Gitbook");
  return { hits: [...tessera.hits, ...gitbook.hits], left: tessera.left + gitbook.left, tesseraLeft: tessera.left, gitbookLeft: gitbook.left };
}

export function largestFolder(repo: "tessera" | "gitbook") {
  const block = repo === "tessera" ? TESSERA_PATHS : GITBOOK_PATHS;
  const counts = new Map<string, number>();
  for (const line of lines(block)) {
    if (!line.includes("/")) continue;
    const top = line.split("/")[0] ?? "";
    counts.set(top, (counts.get(top) ?? 0) + 1);
  }
  let name = "";
  let count = 0;
  for (const [folder, total] of counts) {
    if (total > count) {
      name = folder;
      count = total;
    }
  }
  return { name, count };
}

function has(block: string, path: string) {
  return block.includes(`\n${path}\n`);
}

export function shortSha(sha: string) {
  return sha.slice(0, 7);
}

export function askRepo(question: string) {
  const q = question.trim();
  if (/\blargest folders\b/i.test(q)) {
    const tesseraTop = largestFolder("tessera");
    const gitbookTop = largestFolder("gitbook");
    return `Largest on TESSERA is ${tesseraTop.name} with ${tesseraTop.count}. Largest on Gitbook is ${gitbookTop.name} with ${gitbookTop.count}. I did not open the bodies.`;
  }
  if (/\bhow many files\b/i.test(q)) {
    return `TESSERA main ${shortSha(TESSERA_SHA)} has ${TESSERA_FILES} file names. Gitbook main ${shortSha(GITBOOK_SHA)} has ${GITBOOK_FILES} file names. The list can be behind main. I did not open the bodies.`;
  }
  const folder = q.match(/\bfiles in ([a-z0-9._/-]+)/i);
  if (folder?.[1]) {
    const name = folder[1].replace(/\/$/, "");
    if (has(TESSERA_PATHS, name) || has(GITBOOK_PATHS, name)) return `${name} is a file, not a folder. I did not open the body.`;
    const tessera = filesIn("tessera", name);
    const gitbook = filesIn("gitbook", name);
    if (!tessera && !gitbook) return `${name} is not a folder on either list.`;
    const tesseraTop = largestFolder("tessera");
    const gitbookTop = largestFolder("gitbook");
    return `TESSERA has ${tessera} file names under ${name}. Gitbook has ${gitbook}. Largest on TESSERA is ${tesseraTop.name} with ${tesseraTop.count}. Largest on Gitbook is ${gitbookTop.name} with ${gitbookTop.count}. I did not open the bodies.`;
  }
  const held = q.match(/\b(?:have|holds|hold) (\S+)/i);
  if (held?.[1] && /[./]/.test(held[1])) {
    const path = held[1].replace(/[?.,]$/, "");
    const onTessera = has(TESSERA_PATHS, path);
    const onGitbook = has(GITBOOK_PATHS, path);
    if (!onTessera && !onGitbook && afterCopy(path)) return `${path} was written after this list. The list is behind main. I did not open the body.`;
    if (!onTessera && !onGitbook) return `${path} is not on the list. I did not open a body.`;
    const where = [onTessera ? "TESSERA" : "", onGitbook ? "Gitbook" : ""].filter(Boolean).join(" and ");
    return `${path} is on ${where}. I did not open the body.`;
  }
  const found = q.match(/\bfind ([a-z0-9._/-]+)/i);
  if (found?.[1]) {
    const report = findReport(found[1]);
    if (!report.hits.length) return `${found[1]} is not on the list.`;
    return `${report.hits.join("\n")}\nTESSERA left ${report.tesseraLeft}. Gitbook left ${report.gitbookLeft}. I did not open the bodies.`;
  }
  return null;
}
