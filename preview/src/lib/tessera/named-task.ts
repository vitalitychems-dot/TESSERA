const CLOSED = /secret|password|\.env|\bweights?\b|\b1T\b|\/zz\/|private key/i;

/** One named file may be opened. A secret, a weight file, or a pile of files may not. */

export function namedTask(task: string) {
  if (/\brotate\b/i.test(task) && /\bkeys?\b/i.test(task)) return { open: false, path: "", reason: "Rotating the old keys is Father's. No agent does that." };
  if (/\b(read|open)\b/i.test(task) && /(^|\s)(\/|[a-z]:\\)/i.test(task)) return { open: false, path: "", reason: "A path must stay inside the repository." };
  if (task.includes("\\")) return { open: false, path: "", reason: "A path must stay inside the repository." };
  const paths = task.match(/[a-z0-9_.-]+(?:\/[a-z0-9_.-]+)+\.[a-z0-9]+/gi) ?? [];
  if (/\b(read|open)\b/i.test(task) && paths.length !== 1) {
    return { open: false, path: "", reason: paths.length > 1 ? "Name one file." : "" };
  }
  if (paths.length !== 1) return { open: false, path: "", reason: "" };
  const path = paths[0] ?? "";
  if (path.includes("..") || task.includes("..")) return { open: false, path: "", reason: "A path may not climb out of the repository." };
  if (CLOSED.test(path) || CLOSED.test(task)) return { open: false, path, reason: "That file stays closed." };
  if (!/\b(read|open)\b/i.test(task)) return { open: false, path: "", reason: "" };
  return { open: true, path, reason: "" };
}
