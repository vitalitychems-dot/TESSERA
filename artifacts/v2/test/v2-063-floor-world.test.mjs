import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import test from "node:test";
import { chromium } from "playwright-core";
import { checkMessage } from "../src/studio/protocol.mjs";
import { openDemoStudio } from "../src/studio/serve.mjs";
import { liveMessages } from "../src/studio/live.mjs";
import { createStudio, listenStudio } from "../src/studio/wall.mjs";
import { createMonitor, fakeWorker } from "../src/studio/worker-stream.mjs";
import { buildWorld } from "../src/studio/world.mjs";

test("offices grow from the task graph, worker events, and the build log", () => {
  const world = buildWorld({
    desks: [
      { id: "tessera", role: "lead", lamp: "idle" },
      { id: "worker", role: "worker", lamp: "idle" },
    ],
    tasks: [
      { id: "t1", title: "Plan: offices", status: "done" },
      { id: "t2", title: "Work: offices", status: "running" },
    ],
    events: [{ taskId: "t2", name: "tool.write", detail: "desk note" }],
    log: Array.from({ length: 6 }, (_, index) => ({ id: `V2-0${index}`, title: `row ${index}` })),
  });
  assert.equal(world.offices.length, 2);
  for (const office of world.offices) {
    assert.deepEqual(office.pieces, ["desk", "nameplate", "status-light"]);
  }
  assert.equal(world.offices[0].name, "Tessera");
  assert.ok(world.offices[0].artifacts.some((item) => item.kind === "book" && item.id === "t1"));
  assert.equal(world.offices[1].walking, true);
  assert.ok(world.offices[1].artifacts.some((item) => item.kind === "page"));
  assert.equal(world.rooms.length, 2);
  assert.equal(world.rooms[0].title, "V2-00");
});

test("live messages match the websocket schemas and the monitor stream", async () => {
  const studio = createStudio();
  studio.postGoal("Raise a desk");
  const monitor = createMonitor();
  fakeWorker(monitor, "g1-work");
  const messages = liveMessages(studio.state(), monitor.list());
  assert.ok(messages.some((message) => message.type === "task.upsert"));
  assert.ok(messages.some((message) => message.type === "worker.event" && message.name === "tool.write"));
  for (const message of messages) assert.deepEqual(checkMessage(message), []);

  const { server, url } = await listenStudio(studio, { monitor, buildLogPath: null });
  const received = [];
  const socket = new WebSocket(url.replace("http", "ws") + "live");
  socket.addEventListener("message", (event) => received.push(JSON.parse(event.data)));
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no live message")), 3000);
    socket.addEventListener("message", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", reject);
  });
  assert.equal(received[0].type, "task.upsert");
  const events = await (await fetch(`${url}events`)).json();
  assert.equal(events.events.length, 2);
  socket.close();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test("the 3D floor renders offices in a browser", async () => {
  const { server, url } = await openDemoStudio();
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url);
    await page.waitForFunction(() => window.__FLOOR_READY === true);
    const offices = await (await fetch(`${url}world`)).json();
    assert.ok(offices.offices.length >= 2);
    assert.ok(offices.rooms.length >= 1);
    const shot = "/opt/cursor/artifacts/studio-3d-floor.png";
    mkdirSync("/opt/cursor/artifacts", { recursive: true });
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
    await page.click("#view-toggle");
    await page.waitForSelector("body[data-mode='2d']");
    assert.equal(await page.locator("#floor-3d").count(), 0);
    assert.ok((await page.locator(".task-card").count()) >= 2);
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
