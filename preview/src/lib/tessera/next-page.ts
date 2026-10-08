export type KeptPage = { path: string; q: string; fact: string };

const TEXT = /\.(md|txt)$/i;

export function nextUnread(paths: string[], done: string[]) {
  const seen = new Set(done);
  return (
    paths.find((path) => !seen.has(path) && TEXT.test(path) && !/secret|\.env|vitality|\.zip$/i.test(path)) ?? ""
  );
}

export function nextBatch(paths: string[], done: string[], take: number) {
  const out: string[] = [];
  const seen = [...done];
  while (out.length < take) {
    const next = nextUnread(paths, seen);
    if (!next) break;
    out.push(next);
    seen.push(next);
  }
  return out;
}

export function noteFor(question: string, notes: KeptPage[]) {
  const q = question.trim().toLowerCase();
  return notes.find((note) => note.q.toLowerCase() === q)?.fact ?? "";
}

export function herInstruction(before: number, after: number) {
  return `Cursor and Gitbook agents: one pass keeps more than one unread text page. One sentence each. Skip those paths. The next path must be a new file. Do not copy a card. Do not fetch trees in parallel. Ask the kept line before any pen. This pass moved the kept count from ${before} to ${after}.`;
}
