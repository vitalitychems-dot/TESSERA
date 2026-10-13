// Sandboxed execution of predicted (untrusted) Python code.
// - bubblewrap (`bwrap --unshare-all`): no network, own pid/ipc/uts/user namespaces
// - read-only filesystem; only the per-run temp dir is writable; /home, /root, /workspace, /cursor hidden
// - hard wall-clock timeout (SIGKILL), CPU/memory/file-size/process limits via ulimit
// - fresh temp dir as cwd and HOME, removed afterwards; minimal env (no tokens leak in)
// Fails closed: if bwrap is missing or can't create the sandbox, code is NOT run.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const DEFAULT_TIMEOUT_MS = 10_000;
let _avail;
export function sandboxAvailable() {
  if (_avail === undefined) {
    const r = spawnSync("bwrap", ["--unshare-all", "--ro-bind", "/", "/", "--dev", "/dev", "true"], { timeout: 5000 });
    _avail = r.status === 0;
  }
  return _avail;
}
export function runPySandboxed(code, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!sandboxAvailable()) throw new Error("sandbox unavailable (bwrap missing or failed); refusing to run untrusted code");
  const d = mkdtempSync(join(tmpdir(), "heldout-sbx-"));
  try {
    writeFileSync(join(d, "t.py"), code);
    const limits = "ulimit -t 10 -v 1048576 -f 10240 -u 256 2>/dev/null; exec python3 -I -S t.py";
    const args = ["--unshare-all", "--die-with-parent", "--new-session", "--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc",
      ...["/tmp", "/home", "/root", "/workspace", "/cursor", "/run"].flatMap((m) => ["--tmpfs", m]),
      "--bind", d, d, "--chdir", d, "--clearenv", "--setenv", "PATH", "/usr/local/bin:/usr/bin:/bin", "--setenv", "HOME", d, "--setenv", "TMPDIR", d, "--setenv", "LANG", "C.UTF-8", "sh", "-c", limits];
    const r = spawnSync("bwrap", args, {
      cwd: d, timeout: timeoutMs, killSignal: "SIGKILL", encoding: "utf8", maxBuffer: 1 << 20,
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: d, TMPDIR: d, LANG: "C.UTF-8" },
    });
    return { ok: r.status === 0 && !r.error, timedOut: r.error?.code === "ETIMEDOUT" || r.signal === "SIGKILL", stderr: (r.stderr || "").slice(-2000) };
  } finally { rmSync(d, { recursive: true, force: true }); }
}
