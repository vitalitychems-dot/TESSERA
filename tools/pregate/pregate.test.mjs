import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  ADVERSARIAL_ARGV,
  REQUIRED_EMAIL,
  REQUIRED_NAME,
  containsSubsequence,
  flagDefaultsOff,
  identityFailures,
  isInjectable,
  isRuntimeFlagFile,
  isWrapperSource,
  lockedReason,
  permissionBlocks,
  prAllowsDefaultOn,
  readyLine,
  sweepRunCli,
  workflowPermissionFailures,
} from "./run.mjs";

const EMAIL = REQUIRED_EMAIL;

test("ready line names the full head sha", () => {
  const sha = "791ef5dab61153ad5f432ea3e37a8250a487234b";
  assert.equal(readyLine(sha), `ready for gate ${sha}`);
});

test("identity requires the noreply name and email on author and committer", () => {
  const good = {
    sha: "a".repeat(40),
    author: { name: REQUIRED_NAME, email: EMAIL },
    committer: { name: REQUIRED_NAME, email: EMAIL },
  };
  assert.deepEqual(identityFailures([good]), []);

  const tessera = {
    sha: "f9b80dbd05f7d3767057915e4a54c42dbda145b1",
    author: { name: "Tessera", email: EMAIL },
    committer: { name: "Tessera", email: EMAIL },
  };
  const failures = identityFailures([tessera]);
  assert.equal(failures.length, 2);
  assert.match(failures[0], /author Tessera/);
  assert.match(failures[1], /committer Tessera/);

  const wrongEmail = {
    sha: "b".repeat(40),
    author: { name: REQUIRED_NAME, email: "cursoragent@cursor.com" },
    committer: { name: REQUIRED_NAME, email: EMAIL },
  };
  assert.equal(identityFailures([wrongEmail]).length, 1);
});

test("locked paths are rules, gates, and CODEOWNERS", () => {
  assert.equal(lockedReason("CODEOWNERS"), "CODEOWNERS");
  assert.equal(lockedReason(".github/CODEOWNERS"), "CODEOWNERS");
  assert.equal(lockedReason(".cursor/rules/style.mdc"), "rules");
  assert.equal(lockedReason(".agents/skills/example/rules/one.md"), "rules");
  assert.equal(lockedReason(".github/instructions/nx.instructions.md"), "rules");
  assert.equal(lockedReason("scripts/historical-merge-gate.mjs"), "gates");
  assert.equal(lockedReason(".github/workflows/ci.yml"), null);
  assert.equal(lockedReason("tools/pregate/run.mjs"), null);
  assert.equal(lockedReason("artifacts/api-server/src/lib/rick-gates.ts"), null);
  assert.equal(lockedReason("tools/etagcache/etagcache.mjs"), null);
});

test("workflow permission changes and added workflows fail", () => {
  const before = "name: CI\n\npermissions:\n  contents: read\n\njobs: {}\n";
  const after = "name: CI\n\npermissions:\n  contents: write\n\njobs: {}\n";
  assert.notDeepEqual(permissionBlocks(before), permissionBlocks(after));
  const failures = workflowPermissionFailures([
    { path: ".github/workflows/ci.yml", status: "M", before, after },
    { path: ".github/workflows/extra.yml", status: "A", before: null, after: "name: X\n" },
    { path: "tools/etagcache/etagcache.mjs", status: "A", before: null, after: "permissions:\n  contents: write\n" },
  ]);
  assert.deepEqual(failures, [
    ".github/workflows/ci.yml: permissions block changed",
    ".github/workflows/extra.yml: workflow file added",
  ]);
  assert.deepEqual(workflowPermissionFailures([
    { path: ".github/workflows/ci.yml", status: "M", before, after: before.replace("name: CI", "name: CI\n# note") },
  ]), []);
});

test("a new ENABLE flag must default off unless the PR says otherwise", () => {
  const off = `
export const ENABLE_FLAG = "TESSERA_ENABLE_ETAG_CACHE";
export function etagCacheEnabled(env = process.env) {
  return env[ENABLE_FLAG] === "1";
}
`;
  assert.equal(flagDefaultsOff([off], "TESSERA_ENABLE_ETAG_CACHE"), true);
  const on = `const enabled = process.env.TESSERA_ENABLE_NEW !== "0";\n`;
  assert.equal(flagDefaultsOff([on], "TESSERA_ENABLE_NEW"), false);
  const truthy = `if (process.env.TESSERA_ENABLE_NEW) doWork();\n`;
  assert.equal(flagDefaultsOff([truthy], "TESSERA_ENABLE_NEW"), false);
  assert.equal(prAllowsDefaultOn(["TESSERA_ENABLE_NEW defaults on for this migration"], "TESSERA_ENABLE_NEW"), true);
  assert.equal(prAllowsDefaultOn(["stays off unless TESSERA_ENABLE_ETAG_CACHE=1"], "TESSERA_ENABLE_ETAG_CACHE"), false);
  const mixed = `
export const ENABLE_FLAG = "TESSERA_ENABLE_ETAG_CACHE";
function enabled(env) { return env[ENABLE_FLAG] === "1"; }
const other = process.env.TESSERA_ENABLE_EXAMPLE;
`;
  assert.equal(flagDefaultsOff([mixed], "TESSERA_ENABLE_ETAG_CACHE"), true);
  assert.equal(flagDefaultsOff([mixed], "TESSERA_ENABLE_EXAMPLE"), false);
  assert.equal(isRuntimeFlagFile("tools/etagcache/etagcache.mjs"), true);
  assert.equal(isRuntimeFlagFile("tools/pregate/pregate.test.mjs"), false);
  assert.equal(isRuntimeFlagFile("tools/pregate/RESULTS.md"), false);
  assert.equal(isRuntimeFlagFile("tools/etagcache/etagcache.test.mjs"), false);
});

test("argv sweep fails when flags are handled inside the wrapper", async () => {
  async function runCli(argv, deps) {
    const path = argv.find((arg) => !arg.startsWith("-"));
    await deps.request({ url: path });
    deps.stdout.write("{}");
    return 0;
  }
  const failures = await sweepRunCli(runCli, "TESSERA_ENABLE_EXAMPLE");
  for (const spec of ["-f", "-F", "--input", "-H", "--jq", "-i", "--paginate", "-X POST", "unknown-long", "graphql"]) {
    assert.ok(failures.some((line) => line.startsWith(`${spec}:`)), failures.join("\n"));
  }
});

test("argv sweep passes when every adversarial argv is forwarded", async () => {
  async function runCli(argv, deps) {
    const result = deps.spawnImpl("gh", ["api", ...argv], { env: deps.env });
    return result.status ?? 1;
  }
  const failures = await sweepRunCli(runCli, "TESSERA_ENABLE_EXAMPLE");
  assert.deepEqual(failures, []);
  assert.ok(ADVERSARIAL_ARGV.some((spec) => spec.id === "-XGET"));
  assert.ok(containsSubsequence(["api", "-f", "title=hello", "repos/x"], ["-f", "title=hello", "repos/x"]));
});

test("wrapper detection ignores tests and non-injectable scripts", () => {
  const wrapper = 'export async function runCli(argv, deps = {}) {\n  deps.spawnImpl("gh", ["api", ...argv]);\n}\n';
  assert.equal(isWrapperSource("tools/etagcache/etagcache.mjs", wrapper), true);
  assert.equal(isWrapperSource("tools/etagcache/etagcache.test.mjs", wrapper), false);
  assert.equal(isInjectable(wrapper), true);
  assert.equal(isInjectable("export async function runCli() { spawnSync('gh', ['api']); }\n"), false);
});

function hasCommit(sha) {
  return spawnSync("git", ["cat-file", "-e", `${sha}^{commit}`], { encoding: "utf8" }).status === 0;
}

const HEADS = {
  f9b80dbd: "f9b80dbd05f7d3767057915e4a54c42dbda145b1",
  "6510b7b0": "6510b7b0a51d32a72cf650c71db5e9cd51865bed",
  "587d8107": "587d81077cc0d10c195d5e9e6cbaa3f8d73323df",
  ae51fff8: "ae51fff8bde40521be31782b764d2bcc6ef53688",
};

test("PR 315 intermediate wrappers drop argv until the allowlist, and graphql still drops at ae51fff8", async (t) => {
  if (!Object.values(HEADS).every(hasCommit)) {
    t.skip("PR 315 commits are not in this clone");
    return;
  }
  const { loadModule, isInjectable: injectable, isWrapperSource: isWrapper } = await import("./run.mjs");
  const droppedIds = async (sha) => {
    const source = spawnSync("git", ["show", `${sha}:tools/etagcache/etagcache.mjs`], { encoding: "utf8" }).stdout;
    assert.equal(isWrapper("tools/etagcache/etagcache.mjs", source), true);
    assert.equal(injectable(source), true);
    const loaded = await loadModule(source, "etagcache.mjs");
    return sweepRunCli(loaded.runCli, loaded.ENABLE_FLAG);
  };
  const flagDrop = (failures) => failures.some((line) => line.startsWith("-f:"));
  const graphqlDrop = (failures) => failures.some((line) => line.startsWith("graphql:"));
  const f9 = await droppedIds(HEADS.f9b80dbd);
  const mid = await droppedIds(HEADS["6510b7b0"]);
  const later = await droppedIds(HEADS["587d8107"]);
  const almost = await droppedIds(HEADS.ae51fff8);
  assert.equal(flagDrop(f9), true);
  assert.equal(flagDrop(mid), true);
  assert.equal(flagDrop(later), true);
  assert.equal(flagDrop(almost), false, almost.join("\n"));
  assert.equal(graphqlDrop(f9), true);
  assert.equal(graphqlDrop(almost), true, almost.join("\n"));
});
