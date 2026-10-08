export type KeptPage = { path: string; q: string; fact: string };

const TEXT = /\.(md|txt)$/i;

export function nextUnread(paths: string[], done: string[]) {
  const seen = new Set(done);
  return (
    paths.find((path) => !seen.has(path) && TEXT.test(path) && !/secret|\.env|vitality|\.zip$/i.test(path)) ?? ""
  );
}

export function noteFor(question: string, notes: KeptPage[]) {
  const q = question.trim().toLowerCase();
  return notes.find((note) => note.q.toLowerCase() === q)?.fact ?? "";
}
