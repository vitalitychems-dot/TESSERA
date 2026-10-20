/**
 * Held-out answer-key isolation (Security spec v1, steps 1-4 and 6).
 *
 * Step 1 (storage): the full key lives only as an age-encrypted file in a scorer-only location.
 *   KEY.sha256 lists the sha256 of the plaintext key and of the encrypted file. The identity file
 *   is held only by the scorer, outside git.
 * Step 2 (scoring): decrypt -> verify sha256 -> run each completion in a no-network sandbox with
 *   CPU/memory/time limits -> delete the 0700 temp dir in finally -> record score, key sha256,
 *   candidate SHA, scorer version and time (CT).
 *   Safer reading: the plaintext key is never written to disk. age decrypts to a pipe into memory;
 *   the 0700 temp dir only holds sandbox scratch. A killed scorer (even SIGKILL) leaves no plaintext.
 * Step 3 (agents): prompts-only file with exactly task_id, prompt, entry_point; the loader rejects
 *   anything else.
 * Step 4 (leak detection): normalized-line hashes per key body; a file that contains every
 *   significant line of any canonical_solution or test body fails. Works from the published hash
 *   list only, never the plaintext. Contamination = token 5-gram overlap with the key.
 *
 * Step 5 (removing the key from Gitbook main) is NOT implemented here; it waits for Father.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

export const SCORER_VERSION = "heldout-scorer/1";
export const TEMP_PREFIX = "heldout-scorer-";

export interface KeyRecord { task_id: string; prompt: string; entry_point: string; canonical_solution: string; test: string }
export interface PromptRecord { task_id: string; prompt: string; entry_point: string }

export const sha256 = (b: string | Buffer): string => createHash("sha256").update(b).digest("hex");

// ---------- Step 1: KEY.sha256 manifest ----------
export interface KeyManifest { plaintext: string; encrypted: string }
const HEX = /^[0-9a-f]{64}$/;

/** Format: "<sha256>  humaneval.key.jsonl" and "<sha256>  humaneval.key.jsonl.age", one per line. */
export function parseKeyManifest(text: string): KeyManifest {
  let plaintext = "", encrypted = "";
  for (const line of text.split(/\r?\n/)) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(\S+)$/);
    if (!m) continue;
    if (m[2].endsWith(".age")) encrypted = m[1]; else plaintext = m[1];
  }
  if (!HEX.test(plaintext) || !HEX.test(encrypted)) throw new Error("KEY.sha256 must list the plaintext and the .age file");
  return { plaintext, encrypted };
}
export const formatKeyManifest = (m: KeyManifest): string =>
  `${m.plaintext}  humaneval.key.jsonl\n${m.encrypted}  humaneval.key.jsonl.age\n`;

// ---------- Step 2: decrypt (memory only) and verify ----------
export interface DecryptOptions { encPath: string; identityPath: string; manifest: KeyManifest; ageBin?: string }

export function parseKeyJsonl(text: string): KeyRecord[] {
  return text.split(/\r?\n/).filter((l) => l.trim()).map((l) => {
    const r = JSON.parse(l) as KeyRecord;
    for (const f of ["task_id", "prompt", "entry_point", "canonical_solution", "test"] as const) {
      if (typeof r[f] !== "string") throw new Error(`key record missing ${f}`);
    }
    return r;
  });
}

/** Verify the encrypted file, decrypt with age to stdout (never to disk), verify the plaintext. */
export function decryptKey(o: DecryptOptions): { records: KeyRecord[]; keySha256: string } {
  const enc = readFileSync(o.encPath);
  if (sha256(enc) !== o.manifest.encrypted) throw new Error("encrypted key sha256 mismatch: refusing to score");
  const r = spawnSync(o.ageBin ?? "age", ["-d", "-i", o.identityPath], { input: enc, maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error("age decryption failed: refusing to score");
  const plain = r.stdout as Buffer;
  if (sha256(plain) !== o.manifest.plaintext) { plain.fill(0); throw new Error("plaintext key sha256 mismatch: refusing to score"); }
  const records = parseKeyJsonl(plain.toString("utf8"));
  plain.fill(0);
  return { records, keySha256: o.manifest.plaintext };
}

/** Fresh 0700 scratch dir, always removed in finally. Stale dirs from killed runs are swept first. */
export async function withScratchDir<T>(fn: (dir: string) => Promise<T>, base = tmpdir()): Promise<T> {
  sweepStaleScratch(base);
  const dir = mkdtempSync(join(base, TEMP_PREFIX));
  chmodSync(dir, 0o700);
  try { return await fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
export function sweepStaleScratch(base = tmpdir()): number {
  let n = 0;
  for (const e of existsSync(base) ? readdirSync(base) : []) {
    if (e.startsWith(TEMP_PREFIX)) { rmSync(join(base, e), { recursive: true, force: true }); n++; }
  }
  return n;
}

// ---------- Step 2: sandbox ----------
export interface SandboxOptions { timeoutMs?: number; memBytes?: number; cpuSeconds?: number; bwrapBin?: string; python?: string; scratch?: string }
export interface SandboxResult { ok: boolean; code: number | null; timedOut: boolean; stdout: string; stderr: string }

export function sandboxAvailable(bwrapBin = "bwrap"): boolean {
  return spawnSync(bwrapBin, ["--unshare-all", "--ro-bind", "/usr", "/usr", "--symlink", "usr/bin", "/bin", "--symlink", "usr/lib", "/lib",
    "--symlink", "usr/lib64", "/lib64", "/usr/bin/true"]).status === 0;
}

/**
 * Run a Python program in bubblewrap: all namespaces unshared (no network), only /usr read-only,
 * an empty tmpfs /tmp, no bind of the key, the scratch dir or the workspace. The program arrives
 * on stdin, so no candidate file exists inside the sandbox. prlimit (inside the sandbox) caps
 * address space, CPU seconds and file size; the PID namespace plus a wall-clock timer that kills
 * the process group bound everything else. (RLIMIT_NPROC is per-uid, so it is not used.)
 */
export function runInSandbox(program: string, o: SandboxOptions = {}): Promise<SandboxResult> {
  const timeoutMs = o.timeoutMs ?? 10_000, mem = o.memBytes ?? 512 * 1024 * 1024, cpu = o.cpuSeconds ?? 10;
  const args = [
    o.bwrapBin ?? "bwrap", "--unshare-all", "--die-with-parent", "--new-session",
    "--ro-bind", "/usr", "/usr", "--symlink", "usr/bin", "/bin", "--symlink", "usr/lib", "/lib", "--symlink", "usr/lib64", "/lib64",
    "--proc", "/proc", "--dev", "/dev", "--tmpfs", "/tmp", "--chdir", "/tmp", "--clearenv", "--setenv", "PATH", "/usr/bin",
    "/usr/bin/prlimit", `--as=${mem}`, `--cpu=${cpu}`, `--fsize=${16 * 1024 * 1024}`, "--",
    o.python ?? "/usr/bin/python3", "-I", "-",
  ];
  return new Promise((resolve) => {
    const p = spawn(args[0], args.slice(1), { stdio: ["pipe", "pipe", "pipe"], detached: true });
    let out = "", err = "", timedOut = false;
    const t = setTimeout(() => { timedOut = true; try { process.kill(-p.pid!, "SIGKILL"); } catch { /* gone */ } }, timeoutMs);
    p.stdout.on("data", (d) => { if (out.length < 65536) out += d; });
    p.stderr.on("data", (d) => { if (err.length < 65536) err += d; });
    p.on("close", (code) => { clearTimeout(t); resolve({ ok: code === 0 && !timedOut, code, timedOut, stdout: out, stderr: err }); });
    p.stdin.on("error", () => {});
    p.stdin.end(program);
  });
}

// ---------- Step 4: contamination ----------
const tokens = (s: string) => s.match(/[A-Za-z_][A-Za-z0-9_]*|\d+|[^\sA-Za-z0-9_]/g) ?? [];
function ngrams(s: string, n = 5): Set<string> {
  const t = tokens(s), g = new Set<string>();
  for (let i = 0; i + n <= t.length; i++) g.add(t.slice(i, i + n).join(" "));
  return g;
}
/** Fraction of the key body's token 5-grams that appear in the completion (0..1). */
export function contamination(completion: string, keyBody: string, n = 5): number {
  const k = ngrams(keyBody, n);
  if (k.size === 0) return 0;
  const c = ngrams(completion, n);
  let hit = 0;
  for (const g of k) if (c.has(g)) hit++;
  return hit / k.size;
}
export const CONTAMINATION_THRESHOLD = 0.5;

// ---------- Step 2: score ----------
export interface TaskResult { task_id: string; passed: boolean; contamination: number; flag: "UNVERIFIED" | null; error?: string }
export interface ScoreResult {
  score: number; passed: number; total: number; key_sha256: string; candidate_sha: string;
  scorer_version: string; time_ct: string; unverified: boolean; tasks: TaskResult[];
}
export function nowCT(d = new Date()): string {
  return `${d.toLocaleString("sv-SE", { timeZone: "America/Chicago" }).replace(" ", "T")} CT`;
}
export interface ScoreInput {
  answers: Record<string, string>; candidateSha: string; records: KeyRecord[]; keySha256: string; sandbox?: SandboxOptions;
}
export async function scoreAnswers(i: ScoreInput): Promise<ScoreResult> {
  if (!/^[0-9a-f]{7,64}$/.test(i.candidateSha)) throw new Error("candidate commit SHA required");
  return withScratchDir(async (scratch) => {
    const tasks: TaskResult[] = [];
    for (const r of i.records) {
      const completion = i.answers[r.task_id];
      if (typeof completion !== "string") { tasks.push({ task_id: r.task_id, passed: false, contamination: 0, flag: null, error: "missing" }); continue; }
      const program = `${r.prompt}${completion}\n\n${r.test}\n\ncheck(${r.entry_point})\n`;
      const res = await runInSandbox(program, { ...i.sandbox, scratch });
      const c = Math.max(contamination(completion, r.canonical_solution), contamination(completion, r.test));
      tasks.push({ task_id: r.task_id, passed: res.ok, contamination: Math.round(c * 1e4) / 1e4, flag: c >= CONTAMINATION_THRESHOLD ? "UNVERIFIED" : null,
        ...(res.ok ? {} : { error: res.timedOut ? "timeout" : `exit ${res.code}` }) });
    }
    const passed = tasks.filter((t) => t.passed).length;
    return { score: tasks.length ? passed / tasks.length : 0, passed, total: tasks.length, key_sha256: i.keySha256, candidate_sha: i.candidateSha,
      scorer_version: SCORER_VERSION, time_ct: nowCT(), unverified: tasks.some((t) => t.flag), tasks };
  });
}

// ---------- Step 3: prompts-only file ----------
const PROMPT_FIELDS = ["entry_point", "prompt", "task_id"];
export function toPromptsJsonl(records: KeyRecord[]): string {
  return records.map((r) => JSON.stringify({ task_id: r.task_id, prompt: r.prompt, entry_point: r.entry_point })).join("\n") + "\n";
}
/** Strict loader: every record must have exactly task_id, prompt, entry_point (strings). Anything else is rejected. */
export function loadPrompts(text: string): PromptRecord[] {
  return text.split(/\r?\n/).filter((l) => l.trim()).map((l, n) => {
    const r = JSON.parse(l) as Record<string, unknown>;
    if (!r || typeof r !== "object" || Array.isArray(r)) throw new Error(`prompts line ${n + 1}: not an object`);
    const keys = Object.keys(r).sort();
    if (keys.join(",") !== PROMPT_FIELDS.join(",")) throw new Error(`prompts line ${n + 1}: fields must be exactly task_id, prompt, entry_point (got ${keys.join(", ")})`);
    for (const f of PROMPT_FIELDS) if (typeof r[f] !== "string") throw new Error(`prompts line ${n + 1}: ${f} must be a string`);
    return r as unknown as PromptRecord;
  });
}

// ---------- Step 4: leak detection by normalized-line hashes ----------
export interface HashList { version: 1; minLineChars: number; bodies: { id: string; lines: string[] }[] }
export const MIN_LINE_CHARS = 12;
export const normalizeLine = (l: string): string => l.replace(/#.*$/, "").replace(/\s+/g, " ").trim();
const significant = (text: string, min: number) => [...new Set(text.split(/\r?\n/).map(normalizeLine).filter((l) => l.length >= min))];

/** Built by the scorer from the decrypted key; contains hashes only. */
export function buildHashList(records: KeyRecord[], minLineChars = MIN_LINE_CHARS): HashList {
  const bodies: HashList["bodies"] = [];
  for (const r of records) for (const [kind, body] of [["canonical_solution", r.canonical_solution], ["test", r.test]] as const) {
    const lines = significant(body, minLineChars).map((l) => sha256(l)).sort();
    if (lines.length) bodies.push({ id: `${r.task_id}#${kind}`, lines });
  }
  return { version: 1, minLineChars, bodies };
}
/** Body ids whose every significant line appears in the text. */
export function leakedBodies(text: string, list: HashList): string[] {
  const have = new Set(significant(text, list.minLineChars).map((l) => sha256(l)));
  return list.bodies.filter((b) => b.lines.every((h) => have.has(h))).map((b) => b.id);
}
const SKIP_DIRS = new Set([".git", "node_modules", ".pnpm-store"]);
/** Box sweep: scan files under roots; returns paths with leaked bodies. Unreadable/huge/binary files are skipped. */
export function sweep(roots: string[], list: HashList, maxBytes = 5 * 1024 * 1024): { path: string; bodies: string[] }[] {
  const hits: { path: string; bodies: string[] }[] = [];
  const walk = (p: string) => {
    let st; try { st = statSync(p); } catch { return; }
    if (st.isDirectory()) {
      let es: string[] = []; try { es = readdirSync(p); } catch { return; }
      for (const e of es) if (!SKIP_DIRS.has(e)) walk(join(p, e));
      return;
    }
    if (!st.isFile() || st.size > maxBytes) return;
    let buf: Buffer; try { buf = readFileSync(p); } catch { return; }
    if (buf.includes(0)) return;
    const b = leakedBodies(buf.toString("utf8"), list);
    if (b.length) hits.push({ path: p, bodies: b });
  };
  for (const r of roots) walk(r);
  return hits;
}
/** CI mode: scan files changed between base and head (git), report and fail on any hit. */
export function checkChangedFiles(repo: string, base: string, head: string, list: HashList): { path: string; bodies: string[] }[] {
  const r = spawnSync("git", ["diff", "--name-only", "--diff-filter=ACMR", `${base}..${head}`], { cwd: repo, encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr || "git diff failed");
  const hits: { path: string; bodies: string[] }[] = [];
  for (const f of r.stdout.split("\n").filter(Boolean)) {
    const show = spawnSync("git", ["show", `${head}:${f}`], { cwd: repo, maxBuffer: 64 * 1024 * 1024 });
    if (show.status !== 0 || (show.stdout as Buffer).includes(0)) continue;
    const b = leakedBodies((show.stdout as Buffer).toString("utf8"), list);
    if (b.length) hits.push({ path: relative(repo, join(repo, f)), bodies: b });
  }
  return hits;
}

// ---------- Step 1: scorer-only location check ----------
/** Reasons a key/identity location is NOT scorer-only (empty = ok): group/other access, or inside an agent working tree. */
export function scorerOnlyProblems(path: string, agentRoots: string[] = ["/workspace"]): string[] {
  const out: string[] = [];
  let st; try { st = statSync(path); } catch { return [`missing: ${path}`]; }
  if (st.mode & 0o077) out.push(`mode ${(st.mode & 0o777).toString(8)} allows group/other access`);
  for (const r of agentRoots) { const rel = relative(r, path); if (rel === "" || (!rel.startsWith("..") && !rel.startsWith("/"))) out.push(`inside agent working tree ${r}`); }
  return out;
}

// ---------- CLI (node --experimental-strip-types answer-key.ts ...) ----------
//   ci <repo> <base> <head> <hashes.json>     exit 1 on any leaked body (step 4 CI check)
//   sweep <hashes.json> <root>...             report paths (step 4 box sweep), exit 1 on hits
async function main(argv: string[]): Promise<number> {
  const [cmd, ...a] = argv;
  if (cmd === "ci") {
    const hits = checkChangedFiles(a[0], a[1], a[2], JSON.parse(readFileSync(a[3], "utf8")) as HashList);
    for (const h of hits) process.stdout.write(`LEAK ${h.path}: ${h.bodies.join(", ")}\n`);
    process.stdout.write(`heldout-leak-check: ${hits.length} file(s) with key bodies\n`);
    return hits.length ? 1 : 0;
  }
  if (cmd === "sweep") {
    const hits = sweep(a.slice(1), JSON.parse(readFileSync(a[0], "utf8")) as HashList);
    for (const h of hits) process.stdout.write(`LEAK ${h.path}: ${h.bodies.join(", ")}\n`);
    process.stdout.write(`heldout-sweep: ${hits.length} file(s) with key bodies\n`);
    return hits.length ? 1 : 0;
  }
  process.stderr.write("usage: answer-key.ts ci <repo> <base> <head> <hashes.json> | sweep <hashes.json> <root>...\n");
  return 2;
}
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(`${(e as Error).message}\n`); process.exit(2); });
}
