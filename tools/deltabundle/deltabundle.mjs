#!/usr/bin/env node
/**
 * Offline delta-bundle sync.
 *
 * Ships commits the peer does not have yet (`<peer_ref>..<head>`) as one git
 * bundle. The receiver runs `git bundle verify` against its existing clone
 * and refuses the fetch when prerequisite commits are missing. A full
 * history bundle is created and applied only when `--full` is passed.
 *
 * Off unless TESSERA_ENABLE_DELTA_BUNDLE=1. Any other value, including an
 * unset variable, leaves the tool disabled.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const DELTA_BUNDLE_FLAG = "TESSERA_ENABLE_DELTA_BUNDLE";

const SHA = /^[0-9a-f]{7,64}$/i;
const PEER = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function deltaBundleEnabled(env = process.env) {
  return String(env?.[DELTA_BUNDLE_FLAG] ?? "").trim() === "1";
}

export function assertDeltaBundleEnabled(env = process.env) {
  if (deltaBundleEnabled(env)) return;
  const error = new Error(
    `${DELTA_BUNDLE_FLAG} is off (default 0). Set ${DELTA_BUNDLE_FLAG}=1 to run delta-bundle sync.`,
  );
  error.code = "FLAG_OFF";
  throw error;
}

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function git(args, cwd) {
  const result = spawnSync("git", ["-c", "safe.directory=*", ...args], {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_MERGE_AUTOEDIT: "no",
    },
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  if (result.error) {
    fail("GIT_SPAWN", `git ${args.join(" ")} could not start: ${result.error.message}`);
  }
  return {
    status: result.status ?? 1,
    stdout,
    stderr,
    output: `${stdout}${stderr}`,
  };
}

function gitOk(args, cwd) {
  const result = git(args, cwd);
  if (result.status !== 0) {
    const error = new Error((result.output || `git ${args.join(" ")} failed`).trim());
    error.code = "GIT_FAILED";
    error.git = result;
    throw error;
  }
  return result;
}

function assertRepo(repo) {
  if (!repo) fail("USAGE", "Missing --repo.");
  if (!existsSync(repo)) fail("USAGE", `Repository path does not exist: ${repo}`);
  const probe = git(["rev-parse", "--git-dir"], repo);
  if (probe.status !== 0) {
    fail("USAGE", `Not a git repository: ${repo}\n${probe.output.trim()}`);
  }
}

function assertPeer(peer) {
  if (!peer || !PEER.test(peer)) {
    fail("USAGE", "Peer id must match /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.");
  }
}

export function emptyLedger() {
  return { version: 1, peers: {} };
}

export function loadLedger(ledgerPath) {
  if (!existsSync(ledgerPath)) return emptyLedger();
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(ledgerPath, "utf8"));
  } catch (error) {
    fail("LEDGER", `Ledger is not valid JSON (${ledgerPath}): ${error.message}`);
  }
  if (
    !parsed ||
    parsed.version !== 1 ||
    !parsed.peers ||
    typeof parsed.peers !== "object" ||
    Array.isArray(parsed.peers)
  ) {
    fail("LEDGER", `Ledger ${ledgerPath} must be {"version":1,"peers":{...}}.`);
  }
  return { version: 1, peers: { ...parsed.peers } };
}

export function saveLedger(ledgerPath, ledger) {
  mkdirSync(dirname(ledgerPath), { recursive: true });
  const tmp = `${ledgerPath}.tmp`;
  writeFileSync(tmp, `${JSON.stringify({ version: 1, peers: ledger.peers }, null, 2)}\n`);
  renameSync(tmp, ledgerPath);
}

export function recordPeer(ledger, peer, ref, syncedAt = new Date().toISOString()) {
  assertPeer(peer);
  if (!SHA.test(ref)) fail("USAGE", `Ref is not a git SHA: ${ref}`);
  return {
    version: 1,
    peers: {
      ...ledger.peers,
      [peer]: { ref: ref.toLowerCase(), syncedAt },
    },
  };
}

export function parseVerifyOutput(output) {
  const complete = output.includes("The bundle records a complete history.");
  const prerequisites = [];
  const requires = output.split(/The bundle requires (?:this ref|these \d+ refs):\n/)[1];
  if (requires) {
    for (const line of requires.split("\n")) {
      const match = /^([0-9a-f]{7,64})\b/i.exec(line.trim());
      if (match) prerequisites.push(match[1].toLowerCase());
      else if (line.trim() === "") continue;
      else break;
    }
  }
  return { complete, prerequisites };
}

function resolveCommit(repo, rev) {
  try {
    return gitOk(["rev-parse", "--verify", `${rev}^{commit}`], repo).stdout.trim().toLowerCase();
  } catch {
    fail("UNKNOWN_REF", `Cannot resolve ${rev} to a commit in ${repo}.`);
  }
}

function assertHeadRef(repo, head) {
  const symbolic = git(["rev-parse", "--verify", "--symbolic-full-name", head], repo);
  if (symbolic.status !== 0 || !symbolic.stdout.trim()) {
    fail(
      "USAGE",
      `--head must name a ref such as HEAD or refs/heads/main. ${head} is not a ref, and git bundle will not record a raw commit.`,
    );
  }
  return symbolic.stdout.trim();
}

export function createBundle({ repo, out, peerRef, full = false, head = "HEAD", env = process.env }) {
  assertDeltaBundleEnabled(env);
  assertRepo(repo);
  if (!out) fail("USAGE", "Missing --out.");
  assertHeadRef(repo, head);
  const tip = resolveCommit(repo, head);
  const absoluteOut = isAbsolute(out) ? out : resolve(repo, out);
  mkdirSync(dirname(absoluteOut), { recursive: true });
  if (full) {
    gitOk(["bundle", "create", absoluteOut, head], repo);
    return { full: true, basis: null, tip, bytes: statSync(absoluteOut).size, out: absoluteOut };
  }
  if (!peerRef) {
    fail(
      "NO_PEER_REF",
      "No last-synced ref for this peer. Pass --peer-ref, record one, or pass --full to ship the whole history.",
    );
  }
  const basis = resolveCommit(repo, peerRef);
  if (basis === tip) {
    fail("NOTHING_TO_SYNC", `Peer already has ${tip}. Nothing to bundle.`);
  }
  try {
    gitOk(["bundle", "create", absoluteOut, `${basis}..${head}`], repo);
  } catch (error) {
    if (/Refusing to create empty bundle/i.test(error.message)) {
      fail("NOTHING_TO_SYNC", `Peer already has every commit in ${basis}..${tip}. Nothing to bundle.`);
    }
    throw error;
  }
  return { full: false, basis, tip, bytes: statSync(absoluteOut).size, out: absoluteOut };
}

export function verifyBundle({ repo, bundle, env = process.env }) {
  assertDeltaBundleEnabled(env);
  assertRepo(repo);
  if (!bundle || !existsSync(bundle)) fail("USAGE", `Bundle does not exist: ${bundle}`);
  const result = git(["bundle", "verify", bundle], repo);
  const parsed = parseVerifyOutput(result.output);
  if (result.status !== 0) {
    return {
      ok: false,
      missingPrerequisites: /prerequisite commits/i.test(result.output),
      complete: false,
      prerequisites: parsed.prerequisites,
      output: result.output.trim(),
    };
  }
  return {
    ok: true,
    missingPrerequisites: false,
    complete: parsed.complete || parsed.prerequisites.length === 0,
    prerequisites: parsed.prerequisites,
    output: result.output.trim(),
  };
}

function repoHead(repo) {
  const result = git(["rev-parse", "--verify", "HEAD"], repo);
  if (result.status !== 0) return null;
  return result.stdout.trim().toLowerCase();
}

export function fetchBundle({ repo, bundle, full = false, env = process.env }) {
  assertDeltaBundleEnabled(env);
  const before = repoHead(repo);
  const verified = verifyBundle({ repo, bundle, env });
  if (!verified.ok) {
    const detail = verified.output || "git bundle verify failed";
    fail(
      "MISSING_PREREQUISITES",
      "Refusing to fetch. This clone is missing prerequisite commits, so the delta bundle cannot be applied.\n" +
        `${detail}\n` +
        "A full bundle is not created or fetched unless --full is passed to both create and fetch.",
    );
  }
  if (verified.complete) {
    if (!full) {
      fail(
        "FULL_BUNDLE_REFUSED",
        "Refusing to fetch a full history bundle. Re-run fetch with --full if you explicitly want the whole history.",
      );
    }
  } else if (full) {
    fail(
      "NOT_A_FULL_BUNDLE",
      "Refusing --full fetch: this bundle still requires prerequisite commits. Verify passed; fetch it without --full.",
    );
  }

  gitOk(["fetch", bundle, "HEAD"], repo);
  if (before === null) {
    gitOk(["checkout", "-B", "main", "FETCH_HEAD"], repo);
  } else {
    const merged = git(["merge", "--ff-only", "FETCH_HEAD"], repo);
    if (merged.status !== 0) {
      fail(
        "NOT_FAST_FORWARD",
        `Refusing to move HEAD. The bundle does not fast-forward this clone.\n${merged.output.trim()}`,
      );
    }
  }
  const head = resolveCommit(repo, "HEAD");
  const tree = gitOk(["rev-parse", "HEAD^{tree}"], repo).stdout.trim().toLowerCase();
  return { head, tree, before, prerequisites: verified.prerequisites, full: verified.complete };
}

function peerRefFromLedger(ledgerPath, peer) {
  assertPeer(peer);
  if (!ledgerPath) fail("USAGE", "Missing --ledger (or pass --peer-ref).");
  const ledger = loadLedger(ledgerPath);
  const entry = ledger.peers[peer];
  if (!entry?.ref) {
    fail(
      "NO_PEER_REF",
      `No last-synced ref recorded for peer ${peer}. Record one, pass --peer-ref, or pass --full.`,
    );
  }
  return entry.ref;
}

function printResult(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function absolutePath(value) {
  if (!value) return value;
  return isAbsolute(value) ? value : resolve(process.cwd(), value);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) fail("USAGE", `Unexpected argument: ${token}`);
    const key = token.slice(2);
    if (key === "full") {
      opts.full = true;
      continue;
    }
    const value = rest[i + 1];
    if (!value || value.startsWith("--")) fail("USAGE", `Missing value for --${key}.`);
    opts[key] = value;
    i += 1;
  }
  return { command, opts };
}

export function main(argv, env = process.env) {
  assertDeltaBundleEnabled(env);
  const { command, opts } = parseArgs(argv);
  const repo = absolutePath(opts.repo);
  const bundle = absolutePath(opts.bundle);
  const out = absolutePath(opts.out);
  const ledgerPath = absolutePath(opts.ledger);

  if (command === "create") {
    const peerRef = opts.full ? null : (opts["peer-ref"] ?? peerRefFromLedger(ledgerPath, opts.peer));
    const created = createBundle({
      repo,
      out,
      peerRef,
      full: Boolean(opts.full),
      head: opts.head ?? "HEAD",
      env,
    });
    printResult({ ok: true, command, ...created });
    return created;
  }

  if (command === "verify") {
    const verified = verifyBundle({ repo, bundle, env });
    if (!verified.ok) {
      const error = new Error(
        "Refusing the bundle. Prerequisite commits are missing from this clone.\n" +
          `${verified.output}\n` +
          "A full bundle is not used unless --full is passed.",
      );
      error.code = "MISSING_PREREQUISITES";
      throw error;
    }
    printResult({ ok: true, command, ...verified });
    return verified;
  }

  if (command === "fetch") {
    if (!ledgerPath || !opts.peer) {
      fail("USAGE", "fetch requires --ledger and --peer so the last-synced ref can be recorded.");
    }
    const fetched = fetchBundle({
      repo,
      bundle,
      full: Boolean(opts.full),
      env,
    });
    const ledger = recordPeer(loadLedger(ledgerPath), opts.peer, fetched.head);
    saveLedger(ledgerPath, ledger);
    printResult({ ok: true, command, ...fetched, peer: opts.peer, ledger: ledgerPath });
    return { ...fetched, peer: opts.peer, ledger: ledgerPath };
  }

  if (command === "record") {
    if (!ledgerPath || !opts.peer || !opts.ref) fail("USAGE", "record requires --ledger, --peer, and --ref.");
    const ref = repo ? resolveCommit(repo, opts.ref) : opts.ref.toLowerCase();
    const ledger = recordPeer(loadLedger(ledgerPath), opts.peer, ref);
    saveLedger(ledgerPath, ledger);
    printResult({ ok: true, command, peer: opts.peer, ref: ledger.peers[opts.peer].ref, ledger: ledgerPath });
    return ledger;
  }

  fail(
    "USAGE",
    "Usage: deltabundle.mjs create|verify|fetch|record [--repo DIR] [--bundle FILE] [--out FILE] [--peer NAME] [--ledger FILE] [--peer-ref SHA] [--head REV] [--full]",
  );
}

function writeError(error) {
  process.stdout.write(`${JSON.stringify({ ok: false, code: error.code || "ERROR", message: error.message })}\n`);
  process.stderr.write(`${error.message}\n`);
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    writeError(error);
    const codes = {
      FLAG_OFF: 2,
      USAGE: 2,
      LEDGER: 2,
      NO_PEER_REF: 3,
      NOTHING_TO_SYNC: 3,
      UNKNOWN_REF: 3,
      MISSING_PREREQUISITES: 4,
      FULL_BUNDLE_REFUSED: 4,
      NOT_A_FULL_BUNDLE: 4,
      NOT_FAST_FORWARD: 5,
    };
    process.exitCode = codes[error.code] ?? 1;
  }
}
