/**
 * "Make it real" bridge: an applied ship proposal becomes a real worktree diff.
 *
 * A ship proposal names a world object (tool | fix | doc). Once a 2/3 vote
 * applies it, applyShip() emits a foreman task, opens a task worktree in
 * repoDir, writes one implementation file + one test file from safe templates,
 * runs the new test through the injected runner, captures `git diff --stat`,
 * and returns a shipment record. The PR draft is metadata only.
 *
 * NEVER pushes: this module takes no push dependency and contains no push call.
 * No network imports. Git and test execution arrive via the
 * injected `tools` argument.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";
import { reviewPath } from "../hyb011-denylist.mjs";

export const SHIP_KINDS = ["tool", "fix", "doc"];
export const SHIP_SPEC_BLOCKED = /(vault|wallets?|payments?|\b1t\b|mining|trading)/i;
export const SHIP_DIFF_STAT_CAP = 1500;

export function normalizeShipChange(change = {}) {
  const objectId = String(change.objectId ?? "").trim();
  if (!/^[a-z0-9][a-z0-9-]{0,48}$/i.test(objectId)) throw new Error("objectId required (letters, digits, dash)");
  const shipKind = String(change.shipKind ?? "").trim();
  if (!SHIP_KINDS.includes(shipKind)) throw new Error("shipKind tool, fix, or doc");
  const specTitle = String(change.specTitle ?? "").trim();
  if (!specTitle || specTitle.length > 120) throw new Error("specTitle 1-120 chars");
  const specDetail = String(change.specDetail ?? "");
  if (specDetail.length > 2000) throw new Error("specDetail too long");
  const targetPath = normalize(String(change.targetPath ?? "").trim().replace(/\\/g, "/"));
  if (!targetPath || targetPath.startsWith("..") || targetPath.startsWith("/") || /^[a-zA-Z]:/.test(targetPath)) {
    throw new Error("targetPath must be relative");
  }
  if (targetPath === ".tessera-worktrees" || targetPath.startsWith(".tessera-worktrees/")) {
    throw new Error("targetPath must be relative");
  }
  if (!reviewPath(targetPath).allowed) throw new Error("targetPath refused");
  const testName = String(change.testName ?? "").trim();
  if (testName.includes("/") || !/^[a-z0-9][\w.-]*\.test\.mjs$/i.test(testName)) {
    throw new Error("testName must be a file.test.mjs basename");
  }
  if (!reviewPath(testName).allowed) throw new Error("testName refused");
  if (SHIP_SPEC_BLOCKED.test(`${specTitle} ${specDetail} ${targetPath} ${testName}`)) {
    throw new Error("spec refused");
  }
  return { objectId, shipKind, specTitle, specDetail, targetPath, testName };
}

export function shipTaskId(proposal) {
  const objectId =
    String(proposal.change?.objectId ?? "ship")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ship";
  return `ship-${proposal.id}-${objectId}`.slice(0, 80);
}

export function buildImplementationSource(change) {
  const meta = JSON.stringify({ objectId: change.objectId, kind: change.shipKind, title: change.specTitle });
  return (
    `/** Ship ${change.shipKind}: ${change.specTitle} (${change.objectId}). */\n` +
    `export const SHIP_META = ${meta};\n\n` +
    `export function describe() {\n` +
    `  return { ...SHIP_META, detail: ${JSON.stringify(change.specDetail)} };\n` +
    `}\n\n` +
    `export function run(input = {}) {\n` +
    `  return { ok: true, objectId: SHIP_META.objectId, input: { ...input } };\n` +
    `}\n`
  );
}

export function buildTestSource({ importPath, change }) {
  return (
    `import assert from "node:assert/strict";\n` +
    `import test from "node:test";\n` +
    `import { describe, run } from ${JSON.stringify(importPath)};\n\n` +
    `test(${JSON.stringify(`ship ${change.objectId}: ${change.specTitle}`)}, () => {\n` +
    `  assert.equal(describe().objectId, ${JSON.stringify(change.objectId)});\n` +
    `  assert.equal(run({}).ok, true);\n` +
    `});\n`
  );
}

export function buildPrDraft(proposal, shipment) {
  const change = normalizeShipChange(proposal.change);
  return {
    title: `Ship ${change.objectId} (${change.shipKind}): ${change.specTitle}`,
    body: [
      `World object ${change.objectId} approved as ${proposal.id}.`,
      ``,
      `Implements ${change.targetPath}.`,
      `Test: test/${change.testName} (${shipment.testsPassed ? "passing" : "not yet passing"}).`,
      `Diff:`,
      shipment.diffStat || "(empty)",
    ].join("\n"),
    branch: shipment.branch,
    base: "main",
    draft: true,
    url: null,
  };
}

export function applyShip({ proposal, foreman, repoDir, tools = {} }) {
  if (!proposal || proposal.kind !== "ship") throw new Error("not a ship proposal");
  if (proposal.status !== "applied") throw new Error("ship is not applied");
  if (!foreman?.addTask || !foreman?.start) throw new Error("foreman required");
  if (!repoDir) throw new Error("repoDir required");
  const { createTaskWorktree, git, runTestFile = () => ({ passed: false, output: "skipped: no runner" }) } = tools;
  if (typeof createTaskWorktree !== "function" || typeof git !== "function") {
    throw new Error("worktree tools required");
  }
  const change = normalizeShipChange(proposal.change);
  const taken = new Set(foreman.snapshot().tasks.map((item) => item.id));
  let taskId = shipTaskId(proposal);
  for (let n = 2; taken.has(taskId) && n < 10; n += 1) taskId = `${shipTaskId(proposal)}-${n}`;
  foreman.addTask({ id: taskId, title: `Ship ${change.objectId}: ${change.specTitle}` });
  foreman.start(taskId);
  const { path: worktreePath, branch } = createTaskWorktree(repoDir, taskId);
  const implAbs = join(worktreePath, change.targetPath);
  const testAbs = join(worktreePath, "test", change.testName);
  mkdirSync(dirname(implAbs), { recursive: true });
  mkdirSync(dirname(testAbs), { recursive: true });
  writeFileSync(implAbs, buildImplementationSource(change));
  let spec = relative(dirname(testAbs), implAbs).replace(/\\/g, "/");
  if (!spec.startsWith(".")) spec = `./${spec}`;
  writeFileSync(testAbs, buildTestSource({ importPath: spec, change }));
  let testsPassed = false;
  try {
    testsPassed = !!runTestFile(testAbs, worktreePath)?.passed;
  } catch {
    testsPassed = false;
  }
  git(worktreePath, ["add", "-A"]);
  const stat = git(worktreePath, ["diff", "--cached", "--stat"]);
  const diffStat = String(stat.stdout ?? "").slice(0, SHIP_DIFF_STAT_CAP);
  git(worktreePath, ["commit", "-qm", `ship ${change.objectId}: ${change.specTitle}`.slice(0, 120)]);
  if (testsPassed) {
    try {
      foreman.complete(taskId);
    } catch {
      // Task already closed; tests still passed.
    }
  }
  const shipment = {
    proposalId: proposal.id,
    objectId: change.objectId,
    taskId,
    branch,
    worktreePath,
    diffStat,
    testsPassed,
    prDraft: null,
    pushed: false,
  };
  shipment.prDraft = buildPrDraft(proposal, shipment);
  return shipment;
}
