/** Tessera's ARC score is Icecuber's depth-2 search, invoked from her own module. */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = "/tmp/arc-solution";

export function icecuberAvailable() {
  return existsSync(path.join(ROOT, "run")) && existsSync(path.join(ROOT, "store", "0_out.txt"));
}

function statusWord(text: string) {
  const clean = text.replace(/\u001b\[[0-9;]*m/g, "");
  const match = clean.match(/Task #\s*\d+\s*\(([0-9a-f]+)\):\s*([A-Za-z]+)/);
  if (!match) return null;
  return { task: match[1], word: match[2] };
}

export function icecuberReport() {
  const byTask = new Map<string, string[]>();
  const tally: Record<string, number> = {};
  for (let index = 0; index < 419; index += 1) {
    const text = readFileSync(path.join(ROOT, "store", `${index}_out.txt`), "utf8");
    const found = statusWord(text);
    if (!found) continue;
    tally[found.word] = (tally[found.word] ?? 0) + 1;
    const words = byTask.get(found.task) ?? [];
    words.push(found.word);
    byTask.set(found.task, words);
  }
  const tasks = byTask.size;
  const tasksAllCorrect = [...byTask.values()].filter((words) => words.length > 0 && words.every((word) => word === "Correct")).length;
  return {
    solver: "icecuber-depth-2",
    predictions: Object.values(tally).reduce((sum, count) => sum + count, 0),
    predictionsCorrect: tally.Correct ?? 0,
    tasks,
    tasksAllCorrect,
    tally,
  };
}

/** Runs one task through the compiled search so the score is not only an old log. */
export function icecuberCheck(index = 0, depth = 2) {
  const result = spawnSync(path.join(ROOT, "run"), [String(index), String(depth)], { cwd: ROOT, encoding: "utf8" });
  const found = statusWord(result.stdout);
  return { index, exit: result.status, word: found?.word ?? null, task: found?.task ?? null };
}
