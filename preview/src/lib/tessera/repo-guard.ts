export function allowedWriteRepo(name: string) {
  const repo = (name.split("/").pop() ?? "").replace(/\.git$/i, "").trim().toLowerCase();
  if (!repo) return false;
  if (repo === "gitbook") return true;
  return repo.includes("tessera") && !repo.includes("tesseract");
}

export function writeRefusal(name: string) {
  if (allowedWriteRepo(name)) return null;
  return `Refused. Agents may change only a Tessera repository or Gitbook. ${name} is neither.`;
}
