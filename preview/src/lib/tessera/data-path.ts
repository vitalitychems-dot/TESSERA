function joinPath(root: string, parts: string[]) {
  return [root, ...parts].filter((part) => part.length > 0).join("/");
}

export function workspacePath(...parts: string[]) {
  const root = typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : "";
  return joinPath(root, parts);
}

export function dataPath(...parts: string[]) {
  return workspacePath("data", ...parts);
}
