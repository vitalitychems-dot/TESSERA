import { join } from "node:path";

export function workspacePath(...parts: string[]) {
  return join(process.cwd(), ...parts);
}

export function dataPath(...parts: string[]) {
  return workspacePath("data", ...parts);
}