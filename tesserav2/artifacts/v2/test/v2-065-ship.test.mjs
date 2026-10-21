import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "playwright-core";
import { createCivic, presentWorld } from "../src/studio/civic.mjs";
import {
  applyShip,
  buildPrDraft,
  normalizeShipChange,
} from "../src/studio/ship.mjs";
import { createForeman } from "../src/studio/task-graph.mjs";
import { createStudio, listenStudio } from "../src/studio/wall.mjs";
import { buildWorld } from "../src/studio/world.mjs";
import { createTaskWorktree, git, initFixtureRepo } from "../src/studio/worktree.mjs";

function shipInput(overrides = {}) {
  return {
    title: "Ship the map tool",
    kind: "ship",
    change: {
      objectId: "map-tool",
      shipKind: "tool",
      specTitle: "Map tool",
      specDetail: "Draw the neighborhood map.",
      targetPath: "src/ship/map-tool.mjs",
      testName: "map-tool.test.mjs",
      ...overrides,
    },
  };
}

function runTestFile(absPath) {
  try {
    execFileSync(process.execPath, ["--test", absPath], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { passed: true, output: "pass" };
  } catch (error) {
    return { passed: false, output: String(error.stdout ?? error.message ?? error) };
  }
}

test("a ship passes on two thirds and records an approved placeholder", () => {
  const civic = createCivic();
  const proposal = civic.propose("worker", shipInput());
  assert.equal(civic.vote("worker", proposal.id, "yes").status, "open");
  const applied = civic.vote("clerk", proposal.id, "yes");
  assert.equal(applied.status, "applied");
  const snapshot = civic.snapshot();
  const placeholder = snapshot.shipments.find((item) => item.proposalId === proposal.id);
  assert.equal(placeholder.objectId, "map-tool");
  assert.equal(placeholder.status, "approved");
  assert.equal(placeholder.pushed, false);
  assert.ok(presentWorld(buildWorld({ desks: [], tasks: [], events: [], log: [] }), snapshot).shipments.length >= 1);
});

test("veto and override still govern a ship", () => {
  const civic = createCivic();
  const blocked = civic.propose("worker", shipInput({ objectId: "blocked-tool" }));
  civic.vote("worker", blocked.id, "yes");
  assert.equal(civic.veto("tessera", blocked.id).status, "vetoed");
  assert.throws(() => civic.vote("clerk", blocked.id, "yes"), /closed/);

  const forced = civic.propose("worker", shipInput({ objectId: "forced-tool" }));
  civic.vote("worker", forced.id, "yes");
  civic.vote("clerk", forced.id, "yes");
  assert.equal(civic.override("father", forced.id, "reject").status, "rejected");
  assert.ok(!civic.snapshot().shipments.some((item) => item.proposalId === forced.id));
});

test("ship specs refuse denylisted paths and blocked words", () => {
  const civic = createCivic();
  assert.throws(() => civic.propose("worker", shipInput({ targetPath: "vault/keys.mjs" })), /refused/);
  assert.throws(() => civic.propose("worker", shipInput({ specDetail: "needs a wallet" })), /refused/);
  assert.throws(() => civic.propose("worker", shipInput({ targetPath: "../escape.mjs" })), /relative/);
  const valid = normalizeShipChange({
    objectId: "map-tool",
    shipKind: "tool",
    specTitle: "Map tool",
    specDetail: "Draw the map.",
    targetPath: "src/ship/map-tool.mjs",
    testName: "map-tool.test.mjs",
  });
  assert.equal(valid.objectId, "map-tool");
});

test("an applied ship emits a real task, a worktree diff, and a draft PR without pushing", () => {
  const source = readFileSync(new URL("../src/studio/ship.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /child_process/);
  assert.doesNotMatch(source, /pushFromWorktree/);
  assert.doesNotMatch(source, /["']push["']/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /node:(net|http|https|dns)/);

  const dir = mkdtempSync(join(tmpdir(), "tessera-ship-"));
  try {
    initFixtureRepo(dir);
    const civic = createCivic();
    const foreman = createForeman();
    const proposal = civic.propose("worker", shipInput());
    civic.vote("worker", proposal.id, "yes");
    const applied = civic.vote("clerk", proposal.id, "yes");
    assert.equal(applied.status, "applied");
    const shipment = applyShip({
      proposal: applied,
      foreman,
      repoDir: dir,
      tools: { createTaskWorktree, git, runTestFile },
    });
    assert.equal(shipment.objectId, "map-tool");
    assert.equal(shipment.pushed, false);
    assert.equal(shipment.testsPassed, true);
    assert.ok(shipment.diffStat.includes("map-tool"));
    assert.equal(shipment.prDraft.draft, true);
    assert.equal(shipment.prDraft.base, "main");
    assert.equal(shipment.prDraft.url, null);
    assert.match(shipment.prDraft.title, /map-tool/);
    assert.equal(shipment.branch, shipment.prDraft.branch);
    const recorded = civic.recordShipment(shipment);
    assert.equal(recorded.taskId, shipment.taskId);
    assert.equal(foreman.snapshot().tasks.find((item) => item.id === shipment.taskId).status, "done");
    assert.match(buildPrDraft(applied, shipment).body, /map-tool/);
    const pushCheck = git(shipment.worktreePath, ["log", "--oneline", "-1"]);
    assert.equal(pushCheck.status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the studio ships a voted object and shows its draft PR", async () => {
  const repo = mkdtempSync(join(tmpdir(), "tessera-ship-http-"));
  let browser = null;
  let server = null;
  try {
    initFixtureRepo(repo);
    const studio = createStudio();
    ({ server } = await listenStudio(studio, {
      shipRepoDir: repo,
      shipRunner: runTestFile,
      buildLogPath: null,
    }));
    const url = `http://127.0.0.1:${server.address().port}/`;
    const proposal = await (
      await fetch(`${url}civic/proposals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: "worker", ...shipInput() }),
      })
    ).json();
    await fetch(`${url}civic/votes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "worker", proposalId: proposal.id, choice: "yes" }),
    });
    const applied = await (
      await fetch(`${url}civic/votes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: "clerk", proposalId: proposal.id, choice: "yes" }),
      })
    ).json();
    assert.equal(applied.status, "applied");
    const shipment = await (
      await fetch(`${url}civic/shipments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposalId: proposal.id }),
      })
    ).json();
    assert.equal(shipment.testsPassed, true);
    assert.equal(shipment.pushed, false);
    const civic = await (await fetch(`${url}civic`)).json();
    assert.ok(civic.shipments.some((item) => item.proposalId === proposal.id && item.taskId));
    const world = await (await fetch(`${url}world`)).json();
    assert.ok(world.shipments.some((item) => item.proposalId === proposal.id));
    const page = await (await fetch(url)).text();
    assert.match(page, /data-shipment/);
    assert.match(page, /Ship map-tool/);

    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
    });
    const view = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await view.goto(url);
    await view.waitForFunction(() => window.__FLOOR_READY === true);
    await view.waitForSelector("#shipment-list .shipment");
    const shot = join(tmpdir(), "tessera-v2-studio-ship-bridge.png");
    await view.screenshot({ path: shot });
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    rmSync(repo, { recursive: true, force: true });
  }
});
