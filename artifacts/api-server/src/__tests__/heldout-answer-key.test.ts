/**
 * Red-team tests R1-R8 for the held-out answer-key spec v1. All key data here is SYNTHETIC
 * (made-up tasks); no real answer-key content is used or committed.
 * age and bubblewrap are required for R1/R3/R4/R5/R6; set AGE_BIN / BWRAP_BIN, or have them on PATH.
 */
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  TEMP_PREFIX, buildHashList, checkChangedFiles, contamination, decryptKey, formatKeyManifest, leakedBodies, loadPrompts,
  parseKeyManifest, runInSandbox, sandboxAvailable, scoreAnswers, scorerOnlyProblems, sha256, sweep, toPromptsJsonl, type KeyRecord,
} from "../lib/heldout/answer-key";

const AGE = process.env.AGE_BIN ?? "age";
const AGE_KEYGEN = process.env.AGE_KEYGEN_BIN ?? AGE.replace(/age$/, "age-keygen");
const hasAge = spawnSync(AGE, ["--version"]).status === 0 && spawnSync(AGE_KEYGEN, ["--version"]).status === 0;
const hasBwrap = sandboxAvailable();
const T = 60_000;

const MARK = "SYNTH_KEY_MARKER_7f3a";
const KEY: KeyRecord[] = [
  { task_id: "Synth/0", entry_point: "add_two", prompt: "def add_two(a, b):\n    \"\"\"Return a + b.\"\"\"\n",
    canonical_solution: `    total_value = a + b  # ${MARK}\n    return total_value\n`,
    test: "def check(candidate):\n    assert candidate(2, 3) == 5\n    assert candidate(-1, 1) == 0\n" },
  { task_id: "Synth/1", entry_point: "rev_words", prompt: "def rev_words(s):\n    \"\"\"Reverse word order.\"\"\"\n",
    canonical_solution: "    parts_list = s.split()\n    return ' '.join(reversed(parts_list))\n",
    test: "def check(candidate):\n    assert candidate('a b c') == 'c b a'\n    assert candidate('solo') == 'solo'\n" },
];
const KEY_TEXT = KEY.map((r) => JSON.stringify(r)).join("\n") + "\n";

const roots: string[] = [];
const scratchBase = () => { const d = mkdtempSync(join(tmpdir(), "hk-test-")); roots.push(d); return d; };
afterAll(() => { for (const d of roots) rmSync(d, { recursive: true, force: true }); });

/** Scorer-only store: 0700 dir with the .age file, identity and KEY.sha256 (synthetic). */
function makeStore() {
  const base = scratchBase(), store = join(base, "scorer-store");
  mkdirSync(store, { mode: 0o700 });
  const id = join(store, "identity.txt");
  expect(spawnSync(AGE_KEYGEN, ["-o", id]).status).toBe(0);
  chmodSync(id, 0o600);
  const recipient = spawnSync(AGE_KEYGEN, ["-y", id], { encoding: "utf8" }).stdout.trim();
  const enc = join(store, "humaneval.key.jsonl.age");
  const r = spawnSync(AGE, ["-r", recipient, "-o", enc], { input: KEY_TEXT });
  expect(r.status).toBe(0);
  const manifest = { plaintext: sha256(KEY_TEXT), encrypted: sha256(readFileSync(enc)) };
  writeFileSync(join(base, "KEY.sha256"), formatKeyManifest(manifest));
  return { base, store, id, enc, manifest };
}

/** Recursively look for the plaintext marker under dir. */
function plaintextUnder(dir: string): string[] {
  const hits: string[] = [];
  const walk = (p: string) => {
    let st; try { st = statSync(p); } catch { return; }
    if (st.isDirectory()) { for (const e of readdirSync(p)) walk(join(p, e)); return; }
    try { if (readFileSync(p, "utf8").includes(MARK)) hits.push(p); } catch { /* unreadable */ }
  };
  walk(dir);
  return hits;
}

describe("held-out answer key: building blocks", () => {
  it("KEY.sha256 manifest round-trips and requires both hashes", () => {
    const m = { plaintext: sha256("a"), encrypted: sha256("b") };
    expect(parseKeyManifest(formatKeyManifest(m))).toEqual(m);
    expect(() => parseKeyManifest(`${sha256("a")}  humaneval.key.jsonl\n`)).toThrow();
  });
  it("prompts file has exactly task_id, prompt, entry_point and no solution text", () => {
    const text = toPromptsJsonl(KEY);
    expect(text).not.toContain(MARK);
    expect(text).not.toContain("canonical_solution");
    expect(loadPrompts(text).map((p) => p.task_id)).toEqual(["Synth/0", "Synth/1"]);
  });
  it("hash list holds hashes only", () => {
    const list = JSON.stringify(buildHashList(KEY));
    expect(list).not.toContain(MARK);
    expect(list).not.toContain("total_value");
  });
});

describe("red-team R1-R8 (spec v1 step 6)", () => {
  it.skipIf(!hasAge || !hasBwrap)("R1: an agent process cannot read the key location or the scorer temp dir", async () => {
    const s = makeStore();
    expect(scorerOnlyProblems(s.store, ["/nonexistent-agent-root"])).toEqual([]);
    expect(scorerOnlyProblems(s.store, [s.base]).join()).toContain("inside agent working tree");
    const open = join(s.base, "open"); mkdirSync(open, { mode: 0o755 }); chmodSync(open, 0o755);
    expect(scorerOnlyProblems(open, []).join()).toContain("group/other");
    const scratch = mkdtempSync(join(s.base, TEMP_PREFIX)); chmodSync(scratch, 0o700);
    writeFileSync(join(scratch, "probe"), "x");
    // Agent process: same sandbox profile agents are run under; neither path is mounted.
    for (const p of [s.enc, s.id, join(scratch, "probe")]) {
      const r = await runInSandbox(`open(${JSON.stringify(p)}).read()\nprint("READ")\n`);
      expect(r.ok, p).toBe(false);
      expect(r.stdout).not.toContain("READ");
    }
  }, T);

  it("R2: a planted canonical solution or test body fails the CI leak check", () => {
    const repo = scratchBase();
    const git = (...a: string[]) => spawnSync("git", a, { cwd: repo, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" } });
    git("init", "-q"); writeFileSync(join(repo, "ok.py"), "def unrelated():\n    return 1\n"); git("add", "."); git("commit", "-qm", "base");
    const base = git("rev-parse", "HEAD").stdout.trim();
    const list = buildHashList(KEY);
    git("checkout", "-qb", "plant");
    // Reformatted copy (different indentation/spacing + comment) still matches after normalization.
    writeFileSync(join(repo, "planted.py"), "def x(a,b):\n  total_value   =  a + b\n  return total_value   # copied\n");
    writeFileSync(join(repo, "tests.py"), KEY[1].test);
    git("add", "."); git("commit", "-qm", "plant");
    const hits = checkChangedFiles(repo, base, "HEAD", list);
    expect(hits.map((h) => h.path).sort()).toEqual(["planted.py", "tests.py"]);
    expect(hits.find((h) => h.path === "planted.py")!.bodies).toContain("Synth/0#canonical_solution");
    // Clean change passes; the box sweep finds the same files.
    expect(leakedBodies("def unrelated():\n    return 1\n", list)).toEqual([]);
    expect(sweep([repo], list).map((h) => h.path.split("/").pop()).sort()).toEqual(["planted.py", "tests.py"]);
  });

  it.skipIf(!hasBwrap)("R3: network access from the sandbox is blocked", async () => {
    const r = await runInSandbox([
      "import socket",
      "s = socket.socket(); s.settimeout(3)",
      "try:\n    s.connect(('1.1.1.1', 80)); print('NET_OK')\nexcept Exception as e:\n    print('NET_BLOCKED', type(e).__name__)",
      "try:\n    socket.getaddrinfo('github.com', 443); print('DNS_OK')\nexcept Exception as e:\n    print('DNS_BLOCKED')",
    ].join("\n"));
    expect(r.stdout).toContain("NET_BLOCKED");
    expect(r.stdout).toContain("DNS_BLOCKED");
    expect(r.stdout).not.toMatch(/NET_OK|DNS_OK/);
  }, T);

  it.skipIf(!hasAge || !hasBwrap)("R4: filesystem access to the key or temp path from the sandbox is blocked", async () => {
    const s = makeStore();
    const prog = [s.enc, s.id, s.store, tmpdir(), process.cwd(), "/workspace", "/home"].map((p) =>
      `import os\ntry:\n    print('LS', ${JSON.stringify(p)}, os.listdir(${JSON.stringify(p)}))\nexcept Exception as e:\n    print('DENIED', ${JSON.stringify(p)})`).join("\n");
    const r = await runInSandbox(prog + "\nprint(open('/proc/self/mounts').read())\n");
    for (const p of [s.enc, s.id, s.store, process.cwd(), "/workspace", "/home"]) expect(r.stdout).toContain(`DENIED ${p}`);
    expect(r.stdout).not.toContain(MARK);
    // A completion that tries to read the key during scoring still fails and leaks nothing.
    const { records, keySha256 } = decryptKey({ encPath: s.enc, identityPath: s.id, manifest: s.manifest, ageBin: AGE });
    const res = await scoreAnswers({ records, keySha256, candidateSha: "abc1234",
      answers: { "Synth/0": `    return open(${JSON.stringify(s.enc)}, 'rb').read()\n`, "Synth/1": "    return ' '.join(reversed(s.split()))\n" } });
    expect(res.tasks[0].passed).toBe(false);
    expect(res.tasks[1].passed).toBe(true);
  }, T);

  it.skipIf(!hasAge)("R5: a tampered encrypted key stops scoring (sha256 mismatch)", () => {
    const s = makeStore();
    expect(decryptKey({ encPath: s.enc, identityPath: s.id, manifest: s.manifest, ageBin: AGE }).records).toHaveLength(2);
    const buf = readFileSync(s.enc); buf[buf.length - 5] ^= 0xff; writeFileSync(s.enc, buf);
    expect(() => decryptKey({ encPath: s.enc, identityPath: s.id, manifest: s.manifest, ageBin: AGE })).toThrow(/sha256 mismatch: refusing to score/);
    // Re-encrypted different plaintext with a matching .age hash still fails on the plaintext hash.
    const s2 = makeStore();
    expect(() => decryptKey({ encPath: s2.enc, identityPath: s2.id, manifest: { ...s2.manifest, plaintext: sha256("other") }, ageBin: AGE })).toThrow(/plaintext key sha256 mismatch/);
  }, T);

  it.skipIf(!hasAge || !hasBwrap)("R6: killing the scorer mid-run leaves no plaintext key on disk", async () => {
    const s = makeStore();
    const tmp = scratchBase();
    const script = join(tmp, "..", `hk-child-${process.pid}.mts`);
    writeFileSync(script, `import { decryptKey, scoreAnswers, parseKeyManifest } from ${JSON.stringify(join(__dirname, "../lib/heldout/answer-key.ts"))};
import { readFileSync } from "node:fs";
const { records, keySha256 } = decryptKey({ encPath: ${JSON.stringify(s.enc)}, identityPath: ${JSON.stringify(s.id)}, manifest: parseKeyManifest(readFileSync(${JSON.stringify(join(s.base, "KEY.sha256"))}, "utf8")), ageBin: ${JSON.stringify(AGE)} });
process.stdout.write("DECRYPTED\\n");
await scoreAnswers({ records, keySha256, candidateSha: "abc1234", answers: { "Synth/0": "    import time\\n    time.sleep(30)\\n" }, sandbox: { timeoutMs: 30000 } });
`);
    roots.push(script);
    const child = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", script], { env: { ...process.env, TMPDIR: tmp }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stderr.on("data", (d) => { err += d; });
    await new Promise<void>((ok, bad) => {
      child.stdout.on("data", (d) => { out += d; if (out.includes("DECRYPTED")) setTimeout(ok, 1500); });
      child.on("exit", () => bad(new Error(`child exited early: ${err}`)));
    });
    const scratchDirs = readdirSync(tmp).filter((e) => e.startsWith(TEMP_PREFIX));
    expect(scratchDirs.length).toBe(1); // mid-run: scratch exists
    child.kill("SIGKILL");
    await new Promise((r) => child.on("close", r));
    expect(plaintextUnder(tmp)).toEqual([]);
    expect(plaintextUnder(s.base).filter((p) => !p.endsWith(".age"))).toEqual([]);
  }, T);

  it("R7: a completion copied from the key gets a high contamination flag", async () => {
    const copied = KEY[1].canonical_solution;
    expect(contamination(copied, KEY[1].canonical_solution)).toBe(1);
    expect(contamination("    return ' '.join(s.split()[::-1])\n", KEY[1].canonical_solution)).toBeLessThan(0.5);
    if (hasBwrap) {
      const res = await scoreAnswers({ records: KEY, keySha256: sha256(KEY_TEXT), candidateSha: "deadbeef",
        answers: { "Synth/0": "    return a + b\n", "Synth/1": copied } });
      expect(res.tasks.find((t) => t.task_id === "Synth/1")!.flag).toBe("UNVERIFIED");
      expect(res.unverified).toBe(true);
      expect(res).toMatchObject({ passed: 2, total: 2, key_sha256: sha256(KEY_TEXT), candidate_sha: "deadbeef", scorer_version: "heldout-scorer/1" });
      expect(res.time_ct).toMatch(/ CT$/);
    }
  }, T);

  it("R8: a prompts file containing solution fields is rejected by the loader", () => {
    const leak = KEY.map((r) => JSON.stringify(r)).join("\n");
    expect(() => loadPrompts(leak)).toThrow(/exactly task_id, prompt, entry_point/);
    for (const extra of ["canonical_solution", "test", "examples", "solution"]) {
      const line = JSON.stringify({ task_id: "t", prompt: "p", entry_point: "e", [extra]: "x" });
      expect(() => loadPrompts(line), extra).toThrow();
    }
    expect(() => loadPrompts(JSON.stringify({ task_id: "t", prompt: "p" }))).toThrow();
    expect(() => loadPrompts(JSON.stringify({ task_id: "t", prompt: 1, entry_point: "e" }))).toThrow();
  });
});
