import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DELTA_BUNDLE_FLAG,
  deltaBundleEnabled,
  loadLedger,
  parseVerifyOutput,
} from "./deltabundle.mjs";

const script = fileURLToPath(new URL("./deltabundle.mjs", import.meta.url));

function toolEnv(flag) {
  const env = {
    ...process.env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Delta Bundle",
    GIT_AUTHOR_EMAIL: "delta@tessera.local",
    GIT_COMMITTER_NAME: "Delta Bundle",
    GIT_COMMITTER_EMAIL: "delta@tessera.local",
  };
  delete env[DELTA_BUNDLE_FLAG];
  if (flag !== undefined) env[DELTA_BUNDLE_FLAG] = flag;
  return env;
}

const enabledEnv = toolEnv("1");

function git(cwd, args) {
  const result = spawnSync("git", ["-c", "commit.gpgsign=false", "-c", "user.name=Delta Bundle", "-c", "user.email=delta@tessera.local", ...args], {
    cwd,
    encoding: "utf8",
    env: enabledEnv,
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || "git failed").trim());
  }
  return (result.stdout || "").trim();
}

function initRepo() {
  const dir = mkdtempSync(join(tmpdir(), "deltabundle-repo-"));
  git(dir, ["init", "-q", "-b", "main"]);
  return dir;
}

function writeCommit(repo, files, message) {
  for (const [path, body] of Object.entries(files)) {
    const full = join(repo, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
    git(repo, ["add", "--", path]);
  }
  git(repo, ["commit", "-qm", message]);
  return git(repo, ["rev-parse", "HEAD"]);
}

function prose(title, blocks) {
  const sentence =
    "The mesh keeps a local clone and ships only the commits a peer has not seen, so a USB stick carries the changed pages instead of the whole history.";
  const parts = [`# ${title}`, ""];
  for (let i = 0; i < blocks; i += 1) {
    parts.push(`## ${title} ${i + 1}`, "", Array.from({ length: 6 }, () => sentence).join(" "), "");
  }
  return `${parts.join("\n")}\n`;
}

function cloneAtBase(sender) {
  const dir = mkdtempSync(join(tmpdir(), "deltabundle-recv-"));
  git(sender, ["clone", "-q", sender, dir]);
  return dir;
}

function run(args, env = enabledEnv) {
  const result = spawnSync(process.execPath, [script, ...args], { encoding: "utf8", env });
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    json = null;
  }
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr, json };
}

function heads(repo) {
  return {
    head: git(repo, ["rev-parse", "HEAD"]),
    tree: git(repo, ["rev-parse", "HEAD^{tree}"]),
  };
}

test("flag defaults off unless the value is exactly 1", () => {
  assert.equal(deltaBundleEnabled({}), false);
  assert.equal(deltaBundleEnabled({ [DELTA_BUNDLE_FLAG]: "0" }), false);
  assert.equal(deltaBundleEnabled({ [DELTA_BUNDLE_FLAG]: "true" }), false);
  assert.equal(deltaBundleEnabled({ [DELTA_BUNDLE_FLAG]: "1" }), true);
  const repo = initRepo();
  writeCommit(repo, { "pages/a.md": prose("Base", 2) }, "base");
  const out = join(tmpdir(), `no-flag-${Date.now()}.bundle`);
  const disabled = run(["create", "--repo", repo, "--out", out, "--full"], toolEnv());
  assert.equal(disabled.status, 2);
  assert.equal(disabled.json?.code, "FLAG_OFF");
  assert.match(disabled.stderr, /default 0/);
  const zero = run(["create", "--repo", repo, "--out", out, "--full"], toolEnv("0"));
  assert.equal(zero.status, 2);
  assert.equal(zero.json?.code, "FLAG_OFF");
});

test("1-commit delta round-trips and records the peer ref", () => {
  const sender = initRepo();
  const base = writeCommit(sender, { "pages/intro.md": prose("Intro", 3) }, "base");
  const receiver = cloneAtBase(sender);
  writeCommit(sender, { "pages/intro.md": `${prose("Intro", 3)}A single new paragraph for the peer.\n` }, "one commit");
  const work = mkdtempSync(join(tmpdir(), "deltabundle-work-"));
  const ledger = join(work, "peers.json");
  const bundle = join(work, "one.bundle");
  const recorded = run(["record", "--ledger", ledger, "--peer", "lan-peer", "--ref", base, "--repo", sender]);
  assert.equal(recorded.status, 0);
  assert.equal(recorded.json.ref, base);
  const created = run([
    "create",
    "--repo",
    sender,
    "--out",
    bundle,
    "--peer",
    "lan-peer",
    "--ledger",
    ledger,
  ]);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(created.json.full, false);
  assert.equal(created.json.basis, base);
  assert.equal(git(sender, ["rev-list", "--count", `${base}..HEAD`]), "1");
  const fetched = run([
    "fetch",
    "--repo",
    receiver,
    "--bundle",
    bundle,
    "--peer",
    "lan-peer",
    "--ledger",
    ledger,
  ]);
  assert.equal(fetched.status, 0, fetched.stderr);
  const senderRev = heads(sender);
  const receiverRev = heads(receiver);
  assert.equal(receiverRev.head, senderRev.head);
  assert.equal(receiverRev.tree, senderRev.tree);
  assert.equal(loadLedger(ledger).peers["lan-peer"].ref, senderRev.head);
  assert.equal(git(receiver, ["rev-list", "--count", `${base}..HEAD`]), "1");
});

test("10-commit delta is one bundle and fast-forwards the receiver", () => {
  const sender = initRepo();
  const base = writeCommit(sender, { "pages/base.md": prose("Base page", 4) }, "base");
  const receiver = cloneAtBase(sender);
  for (let i = 1; i <= 10; i += 1) {
    writeCommit(
      sender,
      { [`pages/step-${i}.md`]: prose(`Step ${i}`, 2) },
      `commit ${i}`,
    );
  }
  const work = mkdtempSync(join(tmpdir(), "deltabundle-ten-"));
  const delta = join(work, "ten.bundle");
  const full = join(work, "full.bundle");
  const created = run(["create", "--repo", sender, "--out", delta, "--peer-ref", base]);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(created.json.basis, base);
  assert.equal(git(sender, ["rev-list", "--count", `${base}..HEAD`]), "10");
  const fullBundle = run(["create", "--repo", sender, "--out", full, "--full"]);
  assert.equal(fullBundle.status, 0, fullBundle.stderr);
  assert.ok(created.json.bytes < fullBundle.json.bytes);
  const verified = run(["verify", "--repo", receiver, "--bundle", delta]);
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(verified.json.complete, false);
  assert.ok(verified.json.prerequisites.includes(base));
  const ledger = join(work, "peers.json");
  const fetched = run(["fetch", "--repo", receiver, "--bundle", delta, "--peer", "usb-peer", "--ledger", ledger]);
  assert.equal(fetched.status, 0, fetched.stderr);
  const senderRev = heads(sender);
  const receiverRev = heads(receiver);
  assert.equal(receiverRev.head, senderRev.head);
  assert.equal(receiverRev.tree, senderRev.tree);
  assert.equal(git(receiver, ["rev-list", "--count", `${base}..HEAD`]), "10");
  assert.equal(loadLedger(ledger).peers["usb-peer"].ref, senderRev.head);
});

test("multi-file delta round-trips every changed file", () => {
  const sender = initRepo();
  const baseBody = prose("Shared", 2);
  const base = writeCommit(
    sender,
    {
      "pages/alpha.md": baseBody,
      "pages/beta.md": baseBody,
      "pages/gamma.md": baseBody,
    },
    "base files",
  );
  const receiver = cloneAtBase(sender);
  const alpha = `${baseBody}\nAlpha gained a section about bundle prerequisites.\n`;
  const beta = `${baseBody}\nBeta gained a section about the peer ledger.\n`;
  const gamma = `${baseBody}\nGamma gained a section about verify-before-fetch.\n`;
  const deltaNote = `${prose("Field note", 2)}Captured on the node that was offline.\n`;
  writeCommit(
    sender,
    {
      "pages/alpha.md": alpha,
      "pages/beta.md": beta,
      "pages/gamma.md": gamma,
      "notes/field.md": deltaNote,
    },
    "edit four files",
  );
  writeCommit(
    sender,
    {
      "pages/alpha.md": `${alpha}\nSecond pass on alpha.\n`,
      "notes/field.md": `${deltaNote}\nSecond pass on the field note.\n`,
    },
    "edit two of those files again",
  );
  const bundle = join(mkdtempSync(join(tmpdir(), "deltabundle-files-")), "files.bundle");
  const created = run(["create", "--repo", sender, "--out", bundle, "--peer-ref", base]);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(git(sender, ["rev-list", "--count", `${base}..HEAD`]), "2");
  const ledger = join(dirname(bundle), "peers.json");
  const fetched = run(["fetch", "--repo", receiver, "--bundle", bundle, "--peer", "field-node", "--ledger", ledger]);
  assert.equal(fetched.status, 0, fetched.stderr);
  const senderRev = heads(sender);
  const receiverRev = heads(receiver);
  assert.equal(receiverRev.head, senderRev.head);
  assert.equal(receiverRev.tree, senderRev.tree);
  for (const path of ["pages/alpha.md", "pages/beta.md", "pages/gamma.md", "notes/field.md"]) {
    assert.equal(readFileSync(join(receiver, path), "utf8"), readFileSync(join(sender, path), "utf8"));
  }
});

test("verify and fetch refuse when prerequisite commits are missing", () => {
  const sender = initRepo();
  const base = writeCommit(sender, { "pages/intro.md": prose("Intro", 2) }, "base");
  writeCommit(sender, { "pages/intro.md": `${prose("Intro", 2)}changed\n` }, "delta");
  const bundle = join(mkdtempSync(join(tmpdir(), "deltabundle-missing-")), "delta.bundle");
  const created = run(["create", "--repo", sender, "--out", bundle, "--peer-ref", base]);
  assert.equal(created.status, 0, created.stderr);

  const stranger = initRepo();
  const strangerHead = writeCommit(stranger, { "pages/other.md": prose("Unrelated", 2) }, "unrelated");
  const before = readFileSync(join(stranger, "pages/other.md"), "utf8");
  const verified = run(["verify", "--repo", stranger, "--bundle", bundle]);
  assert.equal(verified.status, 4);
  assert.equal(verified.json.code, "MISSING_PREREQUISITES");
  assert.match(`${verified.stdout}\n${verified.stderr}`, /prerequisite/i);

  const ledger = join(dirname(bundle), "peers.json");
  const fetched = run(["fetch", "--repo", stranger, "--bundle", bundle, "--peer", "stranger", "--ledger", ledger]);
  assert.equal(fetched.status, 4);
  assert.equal(fetched.json.code, "MISSING_PREREQUISITES");
  assert.match(fetched.stderr, /Refusing to fetch/);
  assert.match(fetched.stderr, /prerequisite/i);
  assert.equal(heads(stranger).head, strangerHead);
  assert.equal(readFileSync(join(stranger, "pages/other.md"), "utf8"), before);
  assert.equal(loadLedger(ledger).peers.stranger, undefined);
});

test("a full bundle is fetched only when --full is explicit", () => {
  const sender = initRepo();
  const base = writeCommit(sender, { "pages/intro.md": prose("Intro", 3) }, "base");
  const receiver = cloneAtBase(sender);
  writeCommit(sender, { "pages/next.md": prose("Next", 2) }, "later");
  const work = mkdtempSync(join(tmpdir(), "deltabundle-full-"));
  const bundle = join(work, "full.bundle");
  const missing = run(["create", "--repo", sender, "--out", join(work, "nope.bundle"), "--peer", "nobody", "--ledger", join(work, "empty.json")]);
  assert.equal(missing.status, 3);
  assert.equal(missing.json.code, "NO_PEER_REF");
  const created = run(["create", "--repo", sender, "--out", bundle, "--full"]);
  assert.equal(created.status, 0, created.stderr);
  assert.equal(created.json.full, true);
  assert.equal(created.json.basis, null);
  const ledger = join(work, "peers.json");
  const refused = run(["fetch", "--repo", receiver, "--bundle", bundle, "--peer", "lan-peer", "--ledger", ledger]);
  assert.equal(refused.status, 4);
  assert.equal(refused.json.code, "FULL_BUNDLE_REFUSED");
  assert.equal(heads(receiver).head, base);
  assert.equal(loadLedger(ledger).peers["lan-peer"], undefined);
  const fetched = run([
    "fetch",
    "--repo",
    receiver,
    "--bundle",
    bundle,
    "--peer",
    "lan-peer",
    "--ledger",
    ledger,
    "--full",
  ]);
  assert.equal(fetched.status, 0, fetched.stderr);
  const senderRev = heads(sender);
  const receiverRev = heads(receiver);
  assert.equal(receiverRev.head, senderRev.head);
  assert.equal(receiverRev.tree, senderRev.tree);
  assert.equal(loadLedger(ledger).peers["lan-peer"].ref, senderRev.head);
});

test("verify output parser reads the prerequisite sha", () => {
  const parsed = parseVerifyOutput(
    "bundle is okay\nThe bundle contains this ref:\nabc HEAD\nThe bundle requires this ref:\n6e4e5e6329e97274ebb10b403a96a750a5374abe \nThe bundle uses this hash algorithm: sha1\n",
  );
  assert.equal(parsed.complete, false);
  assert.deepEqual(parsed.prerequisites, ["6e4e5e6329e97274ebb10b403a96a750a5374abe"]);
  const full = parseVerifyOutput("The bundle records a complete history.\n");
  assert.equal(full.complete, true);
  assert.deepEqual(full.prerequisites, []);
});
