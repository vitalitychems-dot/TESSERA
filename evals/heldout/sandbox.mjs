// Sandboxed execution of predicted (untrusted) Python code.
// - bubblewrap (`bwrap --unshare-all`): no network, own pid/ipc/uts/user namespaces
// - allowlist filesystem: empty root + read-only /usr, /bin,/lib* links, minimal /etc; only the per-run temp dir is writable
// - hard wall-clock timeout (SIGKILL), CPU/memory/file-size/process limits via ulimit
// - fresh temp dir as cwd and HOME, removed afterwards; minimal env (no tokens leak in)
// Fails closed: if bwrap is missing or can't create the sandbox, code is NOT run.
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, readlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const DEFAULT_TIMEOUT_MS = 10_000;
// Allowlist: start from an empty root (bwrap's own tmpfs) and bind read-only ONLY what
// python3/sh need. Everything else (/opt, /var, /home, /root, /workspace, /cursor, /etc/passwd...)
// simply does not exist inside the sandbox.
const RO_DIRS = ["/usr"];
const RO_TRY = ["/etc/ld.so.cache", "/etc/ld.so.conf", "/etc/ld.so.conf.d", "/etc/ssl/certs", "/etc/alternatives", "/etc/localtime"];
const MERGED = ["/bin", "/sbin", "/lib", "/lib32", "/lib64", "/libx32"]; // symlinks into /usr on merged-/usr systems
function linkOrBind(p) {
  try { const t = readlinkSync(p); return ["--symlink", t, p]; } catch { return existsSync(p) ? ["--ro-bind", p, p] : []; }
}
export const ALLOWLIST_ARGS = [
  ...RO_DIRS.flatMap((p) => ["--ro-bind", p, p]),
  ...MERGED.flatMap(linkOrBind),
  ...RO_TRY.flatMap((p) => ["--ro-bind-try", p, p]),
];
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
    const args = ["--unshare-all", "--die-with-parent", "--new-session", ...ALLOWLIST_ARGS, "--dev", "/dev", "--proc", "/proc",
      "--tmpfs", "/tmp", "--dir", d, "--bind", d, d, "--chdir", d, "--clearenv", "--setenv", "PATH", "/usr/local/bin:/usr/bin:/bin", "--setenv", "HOME", d, "--setenv", "TMPDIR", d, "--setenv", "LANG", "C.UTF-8", "sh", "-c", limits];
    const r = spawnSync("bwrap", args, {
      cwd: d, timeout: timeoutMs, killSignal: "SIGKILL", encoding: "utf8", maxBuffer: 1 << 20,
      env: { PATH: "/usr/local/bin:/usr/bin:/bin", HOME: d, TMPDIR: d, LANG: "C.UTF-8" },
    });
    return { ok: r.status === 0 && !r.error, timedOut: r.error?.code === "ETIMEDOUT" || r.signal === "SIGKILL", stderr: (r.stderr || "").slice(-2000) };
  } finally { rmSync(d, { recursive: true, force: true }); }
}
