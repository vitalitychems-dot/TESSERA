import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { HANDLERS } from "../public/actions.mjs";
import { normalizePublicPath, publicFilePath, startServer } from "../server.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
const memory = readFileSync(path.join(root, "docs/v2/v2-memory.jsonl"), "utf8");

function controls(source) {
  const found = [];
  for (const tag of source.matchAll(/<(button|input)\b[^>]*>/gi)) {
    const action = tag[0].match(/data-action="([^"]+)"/);
    found.push({ tag: tag[1].toLowerCase(), action: action?.[1] ?? "" });
  }
  return found;
}

test("every button and slider maps to a handler", async () => {
  const nodes = controls(html);
  assert.ok(nodes.length >= 10);
  for (const node of nodes) {
    assert.ok(node.action, `${node.tag} is missing data-action`);
    assert.equal(typeof HANDLERS[node.action], "function", node.action);
  }
  const calls = [];
  const io = {
    point: { x: 0, y: 0 },
    async fetchJson(url, options) {
      calls.push({ url, options });
      if (url.startsWith("/api/chat")) return { ok: true, text: "from-files", instrument: "askAll" };
      if (url.startsWith("/api/brain/recall")) return { ok: true, recalled: ["TESSERA_v2"] };
      if (url.startsWith("/api/brain")) return { t: 3, events: 4, nodes: [{ id: "TESSERA_v2", x: 0, y: 0 }], relations: [], synapses: [], hubs: [], modules: 1, source: "mem", nodeCount: 1, relationCount: 0, synapseCount: 0, line: 1 };
      if (url === "/api/eye") return { memoryFile: "docs/v2/v2-memory.jsonl", events: [], bus: { total: 0, capacity: 500 }, working: { observations: 0 }, storedInteractions: 0 };
      if (url === "/api/bus") return { source: "bus", stats: { total: 0, capacity: 500, avgNovelty: 0 }, messages: [], working: { totalGoals: 0 } };
      if (url === "/api/score") return { router: { file: "eval", note: "", dev: { n: 1, routerTop1: 1, routerTop3: 1 }, test: { n: 1, routerTop1: 1, routerTop3: 1 } }, health: [], directories: [], cases: { file: "cases", note: "", rows: [] } };
      return { ok: false, error: "unexpected" };
    },
    paint() {},
    read(id) {
      if (id === "chat-input") return this.chat;
      if (id === "brain-time") return "3";
      return "";
    },
    write(id, value) {
      this.written = `${id}:${value}`;
    },
    chat: "",
  };
  const state = { tab: "", chat: [], brain: { t: 1, nodes: [{ id: "TESSERA_v2", x: 1, y: 1 }] }, selected: null };
  for (const name of ["tab-eye", "tab-brain", "tab-chat", "tab-bus", "tab-score", "eye-refresh", "brain-time", "bus-refresh", "score-refresh"]) {
    await HANDLERS[name](state, io);
  }
  io.point = { x: 1, y: 1 };
  await HANDLERS["brain-pick"](state, io);
  assert.equal(state.selected, "TESSERA_v2");
  await HANDLERS["brain-recall"](state, io);
  assert.equal(state.recall.ok, true);
  state.selected = null;
  await HANDLERS["brain-recall"](state, io);
  assert.match(state.recall.error, /Select a memory node/);
  io.chat = "   ";
  await HANDLERS["chat-send"](state, io);
  assert.match(state.chatError, /empty/);
  io.chat = "help";
  await HANDLERS["chat-send"](state, io);
  assert.equal(state.chat.at(-1).text, "from-files");
  assert.ok(calls.some((call) => call.url === "/api/eye"));
  assert.ok(calls.some((call) => call.url === "/api/brain?t=3"));
  assert.ok(calls.some((call) => call.url.startsWith("/api/brain/recall")));
  assert.ok(calls.some((call) => call.url === "/api/bus"));
  assert.ok(calls.some((call) => call.url === "/api/score"));
  assert.ok(calls.some((call) => call.url === "/api/chat" && call.options.method === "POST"));
});

test("each tab endpoint returns data that exists in the repo", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tessera-console-"));
  process.env.TESSERA_CONSOLE_MEMORY = dir;
  const server = await startServer(0);
  const port = server.address().port;
  const get = async (pathname) => {
    const response = await fetch(`http://127.0.0.1:${port}${pathname}`);
    assert.equal(response.status, 200, pathname);
    return response.json();
  };
  try {
    const page = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /data-action="tab-eye"/);
    assert.match(html, /Tessera · Next/);
    const meta = await get("/api/meta");
    assert.equal(meta.theme, "tessera-next");
    const css = await fetch(`http://127.0.0.1:${port}/console.css`);
    assert.equal(css.status, 200);
    const sheet = await css.text();
    assert.match(sheet, /--glass: #7ef0d4/);
    assert.doesNotMatch(sheet, /#d6ff3e/);

    const eye = await get("/api/eye");
    assert.equal(eye.memoryFile, "docs/v2/v2-memory.jsonl");
    assert.equal(eye.bus.capacity, 500);
    assert.ok(eye.events.length > 0);
    assert.ok(eye.events.some((event) => memory.includes(event.text.split(" → ")[0])));

    const brain = await get("/api/brain");
    assert.equal(brain.source, "docs/v2/v2-memory.jsonl");
    assert.ok(brain.events > 100);
    assert.ok(brain.nodes.some((node) => node.id === "TESSERA_v2"));
    assert.ok(brain.relationCount > 0);
    const early = await get("/api/brain?t=0");
    assert.equal(early.t, 0);
    assert.ok(early.nodeCount < brain.nodeCount);
    const recalled = await get(`/api/brain/recall?t=${brain.t}&seed=${encodeURIComponent("TESSERA_v2")}`);
    assert.equal(recalled.ok, true);
    assert.ok(recalled.recalled.length > 0);
    assert.ok(recalled.recalled.every((name) => memory.includes(name)));

    const score = await get("/api/score");
    assert.equal(score.router.dev.n, 44);
    assert.equal(score.router.dev.routerTop1, 37);
    assert.equal(score.router.test.n, 44);
    assert.ok(score.cases.rows.some((row) => row.id === "identity-1" && row.prompt === "Who are you?"));
    assert.ok(score.health.some((row) => row.testId === "process_memory" && Number.isFinite(row.score)));
    assert.equal(score.directories.find((dirRow) => dirRow.path === "scripts/scorecard").present, true);
    assert.equal(score.directories.find((dirRow) => dirRow.path === "evals").present, true);
    assert.equal(score.directories.find((dirRow) => dirRow.path === "scripts/eval").present, true);

    const chat = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: `http://127.0.0.1:${port}` },
      body: JSON.stringify({ message: "help" }),
    });
    assert.equal(chat.status, 200);
    const answered = await chat.json();
    assert.equal(answered.ok, true);
    assert.equal(answered.instrument, "askAll");
    assert.match(answered.text, /catalog has/);

    const bus = await get("/api/bus");
    assert.equal(bus.stats.capacity, 500);
    assert.ok(bus.messages.some((row) => row.from === "console" && row.topic === "chat"));
    const after = await get("/api/eye");
    assert.ok(after.events.some((event) => event.source === "agent-bus" || event.source === "retrieval-memory"));
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
    delete process.env.TESSERA_CONSOLE_MEMORY;
  }
});

test("loopback bind, public paths, and chat origin", async () => {
  assert.equal(normalizePublicPath("/fonts/..%2f..%2f..%2fpackage.json"), null);
  assert.equal(normalizePublicPath("/%2e%2e/package.json"), null);
  assert.equal(normalizePublicPath("/console.css"), "/console.css");
  assert.equal(normalizePublicPath("/%"), null);
  assert.equal(publicFilePath("../../package.json"), null);
  assert.equal(publicFilePath("/etc/passwd"), null);
  assert.ok(publicFilePath("console.css")?.endsWith(`${path.sep}console.css`));

  const dir = await mkdtemp(path.join(tmpdir(), "tessera-console-"));
  process.env.TESSERA_CONSOLE_MEMORY = dir;
  process.env.TESSERA_CONSOLE_HOST = "0.0.0.0";
  process.env.HOST = "0.0.0.0";
  const server = await startServer(0);
  const port = server.address().port;
  try {
    assert.equal(server.address().address, "127.0.0.1");
    const traversal = await fetch(`http://127.0.0.1:${port}/fonts/..%2f..%2f..%2fpackage.json`);
    assert.equal(traversal.status, 404);
    assert.doesNotMatch(await traversal.text(), /@workspace\/console/);
    const encoded = await fetch(`http://127.0.0.1:${port}/%2e%2e/package.json`);
    assert.equal(encoded.status, 404);
    const css = await fetch(`http://127.0.0.1:${port}/console.css`);
    assert.equal(css.status, 200);

    const cross = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://evil.example" },
      body: JSON.stringify({ message: "help" }),
    });
    assert.equal(cross.status, 403);
    const bare = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "help" }),
    });
    assert.equal(bare.status, 403);
    const same = await fetch(`http://127.0.0.1:${port}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: `http://127.0.0.1:${port}` },
      body: JSON.stringify({ message: "help" }),
    });
    assert.equal(same.status, 200);
    assert.equal((await same.json()).instrument, "askAll");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
    delete process.env.TESSERA_CONSOLE_MEMORY;
    delete process.env.TESSERA_CONSOLE_HOST;
    delete process.env.HOST;
  }
});
