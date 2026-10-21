import { createServerFn } from "@tanstack/react-start";
import { dataPath, workspacePath } from "./data-path";

export const runSafeLab = createServerFn({ method: "POST" }).handler(async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const env = { PATH: process.env.PATH ?? "/usr/bin", HOME: "/tmp" };
  const lines: string[] = [];
  try {
    const result = await run("/tmp/tessera-sb/venv/bin/python", [workspacePath("scripts", "run-neuro-workaround.py")], {
      timeout: 20000,
      env,
      cwd: "/tmp",
    });
    lines.push(result.stdout.trim() || "The agent returned no text.");
  } catch (error) {
    lines.push("Their agent is not installed on this machine.");
  }
  try {
    const result = await run("/tmp/tessera-sb/our_neuron", [], { timeout: 5000, env });
    lines.push(`Our neuron: ${result.stdout.trim()}`);
  } catch (error) {
    lines.push("Our neuron is not installed on this machine.");
  }
  return { ok: true as const, text: lines.join("\n") };
});

export const readLessons = createServerFn({ method: "POST" }).handler(async () => {
  const { readFile } = await import("node:fs/promises");
  for (const path of [dataPath("checkouts", "LESSONS.txt"), "/workspace/data/checkouts/LESSONS.txt"]) {
    try {
      return { text: await readFile(path, "utf8") };
    } catch {
      /* try the next place */
    }
  }
  return { text: "No lesson file on this host." };
});
