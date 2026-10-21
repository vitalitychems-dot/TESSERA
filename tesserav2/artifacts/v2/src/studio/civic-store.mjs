/**
 * Disk copy of the agent world. The simulation itself stays off the network.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { reviewPath } from "../hyb011-denylist.mjs";

export function saveCivic(state, path) {
  const decision = reviewPath(path);
  if (!decision.allowed) throw new Error("refused path");
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, JSON.stringify(state));
  renameSync(temporary, path);
}

export function loadCivic(path) {
  const decision = reviewPath(path);
  if (!decision.allowed) throw new Error("refused path");
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}
