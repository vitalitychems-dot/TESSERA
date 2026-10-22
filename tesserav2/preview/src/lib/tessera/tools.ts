import { createServerFn } from "@tanstack/react-start";
import { workspacePath } from "./data-path";

export const runLocalTool = createServerFn({ method: "POST" })
  .validator((input: { name: string }) => input)
  .handler(async ({ data }) => {
    const { execFile } = await import("node:child_process");
    const name = data.name.trim().toLowerCase();
    if (!/^[a-z0-9-]{1,40}$/.test(name)) return { ok: false as const, output: "That tool name is not allowed." };
    const output = await new Promise<string>((resolve) => {
      execFile("node", [workspacePath("scripts", "run-tool.mjs"), name], { timeout: 8000 }, (error, stdout, stderr) => {
        resolve(`${stdout}${stderr}`.trim().slice(0, 1200) || (error ? "The tool did not run." : "The tool finished."));
      });
    });
    return { ok: !output.startsWith("refused") as boolean, output };
  });
