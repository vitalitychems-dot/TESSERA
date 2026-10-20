/** Six inks, a four-event window, and a loop that names what it just saw. */

import { readFileSync } from "node:fs";
import { knownTheme, type ThemeId } from "./themes.ts";

export const INK: Record<ThemeId, { bg: string; accent: string; fg: string; subtle: string }> = {
  water: { bg: "#070b10", accent: "#7ef0d4", fg: "#f3efe6", subtle: "#d5ebe4" },
  fire: { bg: "#140806", accent: "#ff6a3d", fg: "#f8efe8", subtle: "#f0c2b0" },
  lightning: { bg: "#05070c", accent: "#d6f26a", fg: "#f2f6ff", subtle: "#d5def5" },
  diamond: { bg: "#eef3f4", accent: "#0e7490", fg: "#102028", subtle: "#245968" },
  spiral: { bg: "#100818", accent: "#e7b3ff", fg: "#f6f1e8", subtle: "#e4d4f8" },
  house: { bg: "#140e0b", accent: "#ffb089", fg: "#f6efe8", subtle: "#f0d0c0" },
};

const NAMES = ["empty", "drop", "rule", "repeat", "wait", "next"] as const;

export function ink(id: string) {
  return INK[knownTheme(id)];
}

export function cssHasInk() {
  const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
  return (Object.keys(INK) as ThemeId[]).every((id) => css.includes(`data-theme="${id}"`) && css.includes(INK[id].subtle));
}

export function pushWindow(window: string[], event: string, size = 4) {
  return [...window, event].slice(-size);
}

export function seePattern(window: string[]) {
  const last = window.at(-1) ?? "";
  const prev = window.at(-2) ?? "";
  if (!last.trim()) return "empty";
  if (/\b(grok|claude|agi)\b/i.test(last)) return "drop";
  if (last === "lack" && prev === "lack") return "rule";
  if (prev && last === prev) return "repeat";
  if (window.length < 2) return "wait";
  return "next";
}

export function lastTurns(lines: { role: string; text: string }[], n: number) {
  if (n <= 0) return [];
  return lines.slice(-n);
}

export function agentLoop(window: string[], event: string) {
  const plan = window.length === 0 ? "The window is empty." : `The window holds ${window.length}.`;
  const adapt = pushWindow(window, event);
  const execute = seePattern(adapt);
  const reflect = (NAMES as readonly string[]).includes(execute) ? "known" : "unknown";
  return { plan, execute, reflect, adapt };
}

export function watchLine() {
  const first = agentLoop([], "mark");
  const second = agentLoop(first.adapt, "mark");
  const foreign = agentLoop(second.adapt, "I am Grok");
  return `Water is ${ink("water").accent}. A first mark ${first.execute}. The same mark again ${second.execute}. A foreign line ${foreign.execute}. The window holds ${foreign.adapt.length}.`;
}
