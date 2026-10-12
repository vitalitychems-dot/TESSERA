/**
 * Project test runner. No network.
 * The child process gets a clean environment and a denied socket, matching the v2 desk sandbox.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BANNED =
  /\b(fetch|XMLHttpRequest|WebSocket|require|child_process|spawn|exec|dgram|https?|worker_threads|import)\b/;

export function runSandboxed(source, { timeoutMs = 1000 } = {}) {
  if (typeof source !== "string" || !source.trim() || source.length > 20_000) {
    return { ok: false, reason: "The test source is empty or too large." };
  }
  if (BANNED.test(source)) {
    return { ok: false, reason: "Network and host access are not allowed in the project sandbox." };
  }

  const dir = mkdtempSync(join(tmpdir(), "gitai-sandbox-"));
  const file = join(dir, "run.mjs");
  writeFileSync(
    file,
    `import net from "node:net";
const deny = () => { throw new Error("network denied"); };
net.connect = deny;
net.createConnection = deny;
globalThis.fetch = deny;
let value;
try {
  value = await (async () => {
${source}
  })();
} catch (error) {
  process.stdout.write(JSON.stringify({ ok: false, reason: String(error && error.message || error) }));
  process.exit(0);
}
process.stdout.write(JSON.stringify({ ok: true, value }));
`,
  );

  try {
    const result = spawnSync(process.execPath, ["--max-old-space-size=32", file], {
      env: { PATH: process.env.PATH ?? "", SANDBOX_NETWORK: "deny" },
      encoding: "utf8",
      timeout: timeoutMs,
    });
    if (result.error?.code === "ETIMEDOUT") {
      return { ok: false, reason: "The sandbox timed out." };
    }
    if (result.status !== 0) {
      return { ok: false, reason: String(result.stderr || "The sandbox failed.").slice(0, 300) };
    }
    try {
      const parsed = JSON.parse(result.stdout);
      if (parsed.ok) return { ok: true, value: parsed.value ?? null };
      return { ok: false, reason: String(parsed.reason || "The sandbox failed.") };
    } catch {
      return { ok: false, reason: "The sandbox returned no result." };
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
