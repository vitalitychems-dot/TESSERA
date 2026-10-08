import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const APP_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export function appPath(...parts) {
  return join(APP_ROOT, ...parts);
}

export function dataPath(...parts) {
  return appPath("data", ...parts);
}