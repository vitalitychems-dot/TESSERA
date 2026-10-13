#!/usr/bin/env node
// agi_proxy: macro score of the held-out eval runner (evals/heldout/run.mjs, TESSERA #306) on private
// data (HELDOUT_DATA = checkout of private Gitbook evals/heldout, Gitbook #85). PROXY, not a measure of AGI.
//
// Trust model (Moderator FAIL on #314 @32d52d83):
// - The runner is NEVER taken from the PR head. It is exported with `git archive` from a TRUSTED ref
//   (TRUSTED_REF, default origin/main) of the scorecard's own checkout; if main has no runner yet
//   (#306 unmerged) it falls back to the pinned reviewed commit PINNED_RUNNER_SHA.
// - It runs inside bubblewrap (#306's model): --unshare-all (no network), --clearenv, empty root with
//   read-only /usr only, HOME=/tmp (tmpfs), no box HOME, no gh login, no /workspace. Data, runner and
//   predictions are bind-mounted read-only. Fails closed if bwrap is unavailable.
// - The PR's code is only the thing under test: it can supply a predictions file (--predictions), which
//   is data, never code run outside the sandbox. Only the aggregate macro is printed.
// Usage: HELDOUT_DATA=/path node agi_proxy.mjs [--repo PR_HEAD_DIR] [--predictions FILE] [--runs 5]
import { spawnSync, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { arg, repeat } from "./lib.mjs";

export const PINNED_RUNNER_SHA = "d491e20b51af9fa73c63f4a7252069df3af22927"; // TESSERA #306 head, Security/Build reviewed
const HERE = dirname(fileURLToPath(import.meta.url));

// Export evals/heldout from a trusted ref into a fresh temp dir. Returns {dir, ref} or {why}.
export function exportTrustedRunner(gitDir, refs = [process.env.TRUSTED_REF || "origin/main", PINNED_RUNNER_SHA]) {
  for (const ref of refs) {
    const has = spawnSync("git", ["-C", gitDir, "cat-file", "-e", `${ref}:evals/heldout/run.mjs`]);
    if (has.status !== 0) continue;
    const dir = mkdtempSync(join(tmpdir(), "agi-runner-"));
    const sha = execFileSync("git", ["-C", gitDir, "rev-parse", `${ref}^{commit}`], { encoding: "utf8" }).trim();
    const tar = spawnSync("sh", ["-c", 'git -C "$1" archive "$2" evals/heldout | tar -x -C "$3"', "sh", gitDir, sha, dir]);
    if (tar.status !== 0) { rmSync(dir, { recursive: true, force: true }); continue; }
    return { dir: join(dir, "evals/heldout"), root: dir, ref, sha };
  }
  return { why: "no trusted runner (main and pinned SHA lack evals/heldout/run.mjs)" };
}

const linkOrBind = (p) => { try { return ["--symlink", readlinkSync(p), p]; } catch { return existsSync(p) ? ["--ro-bind", p, p] : []; } };
// bwrap argv for running `node run.mjs` with no network, no env, no box HOME/gh login.
export function sandboxArgs(runnerDir, data, preds) {
  const a = ["--unshare-all", "--die-with-parent", "--new-session", "--ro-bind", "/usr", "/usr",
    ...["/bin", "/sbin", "/lib", "/lib32", "/lib64"].flatMap(linkOrBind),
    ...["/etc/ld.so.cache", "/etc/ld.so.conf", "/etc/ld.so.conf.d", "/etc/alternatives"].flatMap((p) => ["--ro-bind-try", p, p]),
    "--dev", "/dev", "--proc", "/proc", "--tmpfs", "/tmp",
    "--ro-bind", runnerDir, "/sbx/runner", "--ro-bind", data, "/sbx/data",
    ...(preds ? ["--ro-bind", preds, "/sbx/preds.json"] : []),
    "--chdir", "/tmp", "--clearenv", "--setenv", "PATH", "/usr/local/bin:/usr/bin:/bin", "--setenv", "HOME", "/tmp", "--setenv", "LANG", "C.UTF-8"];
  const node = existsSync("/usr/bin/node") ? "/usr/bin/node" : process.execPath;
  return [...a, node, "/sbx/runner/run.mjs", "--data", "/sbx/data", ...(preds ? ["--predictions", "/sbx/preds.json"] : [])];
}
export const bwrapOk = () => spawnSync("bwrap", ["--unshare-all", "--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc", "true"], { timeout: 5000 }).status === 0;

export function runOnce(runnerDir, data, preds) {
  if (!data) return { macro: null, why: "HELDOUT_DATA not set" };
  if (!existsSync(join(runnerDir, "run.mjs"))) return { macro: null, why: "runner missing" };
  if (!bwrapOk()) return { macro: null, why: "sandbox unavailable (fail closed)" };
  const r = spawnSync("bwrap", sandboxArgs(resolve(runnerDir), resolve(data), preds && resolve(preds)),
    { encoding: "utf8", env: { PATH: "/usr/bin:/bin" }, timeout: 600_000, killSignal: "SIGKILL", maxBuffer: 64 << 20 });
  if (r.status !== 0) return { macro: null, why: r.status === 2 ? "manifest mismatch" : `runner exit ${r.status}` };
  try { return { macro: JSON.parse(r.stdout).macro }; } catch { return { macro: null, why: "unparseable runner output" }; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const preds = arg("--predictions", process.env.SCORECARD_PREDICTIONS);
  const top = execFileSync("git", ["-C", HERE, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  const t = exportTrustedRunner(top);
  let why = t.why;
  try {
    const r = await repeat(() => { if (!t.dir) return null; const o = runOnce(t.dir, process.env.HELDOUT_DATA, preds); why ??= o.why; return o.macro; }, +arg("--runs", 5));
    console.log(JSON.stringify({ name: "agi_proxy", value: r.value, noise_band: r.noise_band, runs: r.runs, runner_ref: t.ref ?? null, runner_sha: t.sha ?? null, sandbox: "bwrap --unshare-all --clearenv", label: "held-out eval macro (proxy, not a measure of AGI)", ...(why ? { note: why } : {}) }));
  } finally { if (t.root) rmSync(t.root, { recursive: true, force: true }); }
}
