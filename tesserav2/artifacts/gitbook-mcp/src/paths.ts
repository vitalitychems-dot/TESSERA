const MARKDOWN = /\.(md|mdx)$/i;

export function assertRepoPath(input: string): string {
  const normalized = input.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("\0")) {
    throw new Error("path is required");
  }
  const parts = normalized.split("/");
  if (parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("path traversal is not allowed");
  }
  if (parts.some((part) => part === "1T" || part.startsWith("1T"))) {
    throw new Error("refusing a path that touches the protected 1T vault");
  }
  return normalized;
}

export function assertOptionalDir(input: string | undefined): string {
  if (input === undefined || input.trim() === "") return "";
  return assertRepoPath(input);
}

export function isMarkdownPath(filePath: string): boolean {
  return MARKDOWN.test(filePath);
}

export function assertAgentName(agent: string): string {
  const name = agent.trim();
  if (!name || /[\r\n]/.test(agent) || name.length > 80) {
    throw new Error("agent name must be a single non-empty line of at most 80 characters");
  }
  return name;
}

export function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "update";
}

export function branchName(kind: "handoff" | "page", label: string, now: Date): string {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const name = `gitbook-mcp/${kind}-${stamp}-${slug(label)}`;
  if (name === "main" || name.endsWith("/main")) {
    throw new Error("refusing to target main");
  }
  return name;
}
