import { createServerFn } from "@tanstack/react-start";

export const runSafeLab = createServerFn({ method: "POST" }).handler(async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const run = promisify(execFile);
  const env = { PATH: process.env.PATH ?? "/usr/bin", HOME: "/tmp" };
  const lines: string[] = [];
  try {
    const result = await run("/tmp/tessera-sb/venv/bin/python", ["/workspace/scripts/run-neuro-workaround.py"], {
      timeout: 20000,
      env,
      cwd: "/tmp",
    });
    lines.push(result.stdout.trim() || "The agent returned no text.");
  } catch (error) {
    lines.push(`Their agent did not finish: ${error instanceof Error ? error.message : "unknown error"}`.slice(0, 300));
  }
  try {
    const result = await run("/tmp/tessera-sb/our_neuron", [], { timeout: 5000, env });
    lines.push(`Our neuron: ${result.stdout.trim()}`);
  } catch (error) {
    lines.push(`Our neuron did not run: ${error instanceof Error ? error.message : "unknown error"}`.slice(0, 200));
  }
  return { ok: true as const, text: lines.join("\n") };
});

export const readLessons = createServerFn({ method: "POST" }).handler(async () => {
  const { readFile } = await import("node:fs/promises");
  try {
    const text = await readFile("/workspace/data/checkouts/LESSONS.txt", "utf8");
    return { text };
  } catch {
    return { text: "No lesson file yet." };
  }
});
