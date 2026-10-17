import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "playwright-core";
import { loadGraph, openNodes } from "../src/knowledge/graph.mjs";
import {
  HOME_OBJECT_CAP,
  MEMORY_CAP,
  TICK_STEP_CAP,
  createCivic,
  presentWorld,
} from "../src/studio/civic.mjs";
import { loadCivic, saveCivic } from "../src/studio/civic-store.mjs";
import { openDemoStudio } from "../src/studio/serve.mjs";
import { createStudio, listenStudio } from "../src/studio/wall.mjs";
import { buildWorld } from "../src/studio/world.mjs";

function graphText(snapshot) {
  const lines = [];
  for (const entity of snapshot.graph.entities) {
    lines.push(JSON.stringify({ type: "entity", name: entity.name, entityType: entity.entityType, observations: entity.observations }));
  }
  for (const relation of snapshot.graph.relations) {
    lines.push(JSON.stringify({ type: "relation", from: relation.from, to: relation.to, relationType: relation.relationType }));
  }
  return lines.join("\n");
}

test("a tick upgrades the home that finished work and writes memory into the graph", () => {
  const civic = createCivic();
  assert.equal(civic.snapshot().agents.tessera.home.rooms[0], "office");
  assert.deepEqual(civic.snapshot().agents.worker.home.objects.slice(0, 3), ["desk", "nameplate", "status-light"]);
  assert.equal(civic.snapshot().agents.worker.life.now, "dawn");
  assert.equal(civic.snapshot().limits.network, "deny");

  civic.tick({
    tasks: [{ id: "g1-plan", title: "Plan: offices", status: "done" }],
    events: [{ taskId: "g1-work", name: "tool.write", detail: "desk note" }],
  });
  const snapshot = civic.snapshot();
  assert.equal(snapshot.agents.worker.life.now, "morning");
  assert.equal(snapshot.agents.worker.life.activity, "plan the next room");
  assert.ok(snapshot.agents.tessera.home.level >= 2);
  assert.ok(snapshot.agents.tessera.home.rooms.includes("library"));
  assert.ok(snapshot.agents.worker.home.objects.includes("shelf"));
  assert.ok(snapshot.agents.worker.life.projects.includes("desk note"));

  const opened = openNodes(loadGraph(graphText(snapshot)), ["tessera"]);
  assert.ok(opened.entities[0].observations.some((line) => line.includes("Finished Plan: offices")));
  assert.ok(opened.relations.some((relation) => relation.relationType === "lives_in" && relation.to === "court"));

  const world = presentWorld(
    buildWorld({
      desks: [
        { id: "tessera", role: "lead", lamp: "idle" },
        { id: "worker", role: "worker", lamp: "idle" },
      ],
      tasks: [],
      events: [],
      log: [],
    }),
    snapshot,
  );
  assert.ok(world.offices.length >= 3);
  assert.equal(world.offices[0].pieces[0], "desk");
  assert.ok(world.plots.some((plot) => plot.id === "court"));
  assert.ok(world.plots.some((plot) => plot.id === "yard"));
});

test("two thirds passes, Tessera can veto, and Father can override", () => {
  const civic = createCivic();
  const rule = civic.propose("worker", {
    title: "Quiet at dusk",
    kind: "rule",
    change: { rule: "Quiet at dusk" },
  });
  assert.equal(civic.vote("worker", rule.id, "yes").status, "open");
  const applied = civic.vote("clerk", rule.id, "yes");
  assert.equal(applied.status, "applied");
  assert.ok(civic.snapshot().rules.includes("Quiet at dusk"));

  const move = civic.propose("clerk", {
    title: "Clerk joins the court",
    kind: "join",
    change: { agentId: "clerk", neighborhood: "court" },
  });
  civic.vote("worker", move.id, "yes");
  assert.equal(civic.veto("tessera", move.id).status, "vetoed");
  assert.throws(() => civic.vote("clerk", move.id, "yes"), /closed/);
  assert.equal(civic.snapshot().agents.clerk.neighborhood, "yard");

  const forced = civic.override("father", move.id, "apply");
  assert.equal(forced.status, "applied");
  assert.equal(forced.overriddenBy, "father");
  assert.equal(civic.snapshot().agents.clerk.neighborhood, "court");
  assert.ok(civic.snapshot().neighborhoods.court.members.includes("clerk"));
  assert.ok(civic.snapshot().graph.relations.some((relation) => relation.from === "clerk" && relation.to === "court"));

  assert.equal(civic.override("father", move.id, "reject").status, "rejected");
  assert.equal(civic.snapshot().agents.clerk.neighborhood, "yard");
  assert.ok(!civic.snapshot().neighborhoods.court.members.includes("clerk"));

  assert.throws(() => civic.override("tessera", rule.id, "reject"), /father/);
  assert.throws(() => civic.veto("worker", rule.id), /queen/);
  assert.throws(() => civic.vote("father", rule.id, "yes"), /resident/);
});

test("the tick is capped and the world round-trips to disk", () => {
  const source = readFileSync(new URL("../src/studio/civic.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bfrom\s+["']node:(?:net|http|https|dns|child_process|fs)["']/);
  assert.doesNotMatch(source, /\bfetch\s*\(/);

  const civic = createCivic();
  const events = Array.from({ length: 30 }, (_, index) => ({
    taskId: "t",
    name: "tool.write",
    detail: `note-${index}`,
  }));
  for (let i = 0; i < 10; i += 1) {
    const result = civic.tick({ tasks: [], events });
    assert.ok(result.steps <= TICK_STEP_CAP);
  }
  const snapshot = civic.snapshot();
  assert.ok(snapshot.agents.worker.home.objects.length <= HOME_OBJECT_CAP);
  assert.ok(snapshot.agents.worker.home.objects.length >= 4);
  const memory = snapshot.graph.entities.find((entity) => entity.name === "worker").observations;
  assert.ok(memory.length <= MEMORY_CAP);
  assert.ok(memory.length >= 2);

  const dir = mkdtempSync(join(tmpdir(), "tessera-civic-"));
  const path = join(dir, "civic-world.json");
  try {
    saveCivic(snapshot, path);
    const restored = createCivic(loadCivic(path));
    assert.equal(restored.snapshot().agents.worker.home.level, snapshot.agents.worker.home.level);
    assert.equal(restored.snapshot().tick, snapshot.tick);
    assert.throws(() => saveCivic(snapshot, join(dir, "vault", "state.json")), /refused path/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the studio vote panel and community stay on disk", async () => {
  const dir = mkdtempSync(join(tmpdir(), "tessera-civic-http-"));
  const civicPath = join(dir, "civic-world.json");
  const { server, url } = await listenStudio(createStudio(), { civicPath, buildLogPath: null });
  try {
    const opened = await (await fetch(`${url}civic`)).json();
    assert.equal(opened.limits.network, "deny");
    assert.ok(opened.neighborhoods.yard.members.includes("worker"));
    const proposal = await (
      await fetch(`${url}civic/proposals`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId: "clerk",
          title: "Quiet at dusk",
          kind: "rule",
          change: { rule: "Quiet at dusk" },
        }),
      })
    ).json();
    await fetch(`${url}civic/votes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "clerk", proposalId: proposal.id, choice: "yes" }),
    });
    const applied = await (
      await fetch(`${url}civic/votes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: "tessera", proposalId: proposal.id, choice: "yes" }),
      })
    ).json();
    assert.equal(applied.status, "applied");
    assert.ok(loadCivic(civicPath).rules.includes("Quiet at dusk"));
    const page = await (await fetch(url)).text();
    assert.match(page, /id="vote-panel"/);
    assert.match(page, /id="community"/);
    assert.match(page, /Quiet at dusk/);
    assert.match(page, /data-neighborhood="court"/);
    const world = await (await fetch(`${url}world`)).json();
    assert.ok(world.offices.length >= 3);
    assert.ok(world.plots.length >= 2);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the 3D floor shows homes, the vote panel, and the community", async () => {
  const { server, url } = await openDemoStudio();
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url);
    await page.waitForFunction(() => window.__FLOOR_READY === true);
    await page.waitForSelector("#vote-panel .proposal");
    await page.waitForSelector("#community .neighborhood");
    const title = await page.locator(".proposal-title").first().textContent();
    assert.match(title, /Raise a reading room/);
    const hoods = await page.locator(".neighborhood h3").allTextContents();
    assert.ok(hoods.some((name) => name.includes("Court")));
    assert.ok(hoods.some((name) => name.includes("Yard")));
    const world = await (await fetch(`${url}world`)).json();
    assert.ok(world.offices.some((office) => office.id === "tessera" && office.level >= 2));
    assert.ok(world.offices.some((office) => office.id === "clerk"));
    const shot = join(tmpdir(), "tessera-v2-studio-civic-world.png");
    await page.screenshot({ path: shot });
    const pixels = await page.evaluate(() => {
      const canvas = document.querySelector("#floor-3d");
      const copy = document.createElement("canvas");
      copy.width = 32;
      copy.height = 32;
      const pen = copy.getContext("2d");
      pen.drawImage(canvas, 0, 0, 32, 32);
      const data = pen.getImageData(0, 0, 32, 32).data;
      const colors = new Set();
      for (let i = 0; i < data.length; i += 16) colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
      return colors.size;
    });
    assert.ok(pixels > 2);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
