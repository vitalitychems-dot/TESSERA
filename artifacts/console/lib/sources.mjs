import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectome, coMentionEpisodes, hebbian, loadGraph, recall } from "../../v2/src/brain/synapse.mjs";
import { replayAt } from "../../v2/src/brain/view.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(here, "../../..");
export const MEMORY_FILE = path.join(repoRoot, "docs/v2/v2-memory.jsonl");
export const ROUTER_EVAL = path.join(repoRoot, "artifacts/v2/src/brain/router-eval.json");
export const DEFAULT_PORT = 4391;

const DRAW_SYNAPSES = 240;
const graphCache = new Map();
let memoryText;

export function consolePort() {
  const raw = process.env.TESSERA_CONSOLE_PORT ?? String(DEFAULT_PORT);
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("TESSERA_CONSOLE_PORT must be an integer from 0 to 65535");
  }
  return port;
}

export function memoryDir() {
  return process.env.TESSERA_CONSOLE_MEMORY || path.join(repoRoot, ".local", "tessera-console-memory");
}

function memoryJsonl() {
  memoryText ??= readFileSync(MEMORY_FILE, "utf8");
  return memoryText;
}

function place(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  const slot = h >>> 0;
  const ang = (slot % 997) / 997 * Math.PI * 2;
  const ring = 70 + (slot % 280);
  return { x: Math.round(Math.cos(ang) * ring), y: Math.round(Math.sin(ang) * ring) };
}

function graphAt(eventIndex) {
  const snap = replayAt(memoryJsonl(), eventIndex, eventIndex);
  const cached = graphCache.get(snap.line);
  if (cached) return { snap, ...cached };
  const prefix = memoryJsonl().split("\n").slice(0, Math.max(0, snap.line) + 1).join("\n");
  const g = loadGraph(prefix);
  for (const episode of coMentionEpisodes(g)) hebbian(g, episode);
  const synapses = [];
  for (const [key, weight] of g.syn) {
    const [a, b] = key.split("\u0000");
    synapses.push({ a, b, w: Math.round(weight * 1000) / 1000 });
  }
  synapses.sort((a, b) => b.w - a.w || (a.a < b.a ? -1 : 1));
  const map = connectome(g);
  const packed = { graph: g, synapses, modules: map.modules, hubs: map.hubs };
  graphCache.set(snap.line, packed);
  return { snap, ...packed };
}

export function brainPayload(eventIndex) {
  const { snap, synapses, modules, hubs } = graphAt(eventIndex);
  const nodes = snap.nodes.map((node) => ({ ...node, ...place(node.id) }));
  return {
    source: "docs/v2/v2-memory.jsonl",
    t: snap.t,
    line: snap.line,
    events: snap.events,
    modules,
    hubs,
    nodeCount: nodes.length,
    relationCount: snap.edges.length,
    synapseCount: synapses.length,
    nodes,
    relations: snap.edges,
    synapses: synapses.slice(0, DRAW_SYNAPSES),
    diff: snap.diff,
  };
}

export function recallPayload(eventIndex, seed) {
  const { graph } = graphAt(eventIndex);
  if (!seed || !graph.nodes.has(seed)) return { ok: false, error: "That name is not in the memory graph at this time." };
  const node = graph.nodes.get(seed);
  return {
    ok: true,
    seed,
    type: node.type,
    recalled: recall(graph, seed, 6),
  };
}

function tailMemory(limit) {
  const lines = memoryJsonl().split("\n");
  const events = [];
  for (let i = lines.length - 1; i >= 0 && events.length < limit; i--) {
    if (!lines[i].trim()) continue;
    let row;
    try {
      row = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (row.type === "entity" && row.name) {
      events.push({
        source: "memory-log",
        at: i,
        kind: row.entityType || "entity",
        text: row.name,
        detail: Array.isArray(row.observations) ? String(row.observations[0] ?? "") : "",
      });
    } else if (row.type === "relation" && row.from && row.to) {
      events.push({
        source: "memory-log",
        at: i,
        kind: row.relationType || "relation",
        text: `${row.from} → ${row.to}`,
        detail: "",
      });
    }
  }
  return events.reverse();
}

async function busApi() {
  const bus = await import("../../api-server/src/lib/agi/agent-bus.ts");
  const memory = await import("../../api-server/src/lib/agi/working-memory.ts");
  return { bus, memory };
}

async function learningStore() {
  const { createMemoryStore } = await import("../../api-server/src/lib/memory/index.ts");
  return createMemoryStore({ dir: memoryDir() });
}

export async function eyePayload() {
  const { bus, memory } = await busApi();
  const store = await learningStore();
  const records = await store.list();
  const recentStore = records.slice(-8).map((row) => ({
    source: "retrieval-memory",
    at: row.timestamp,
    kind: row.sourceAgent,
    text: row.input,
    detail: row.output,
  }));
  const recentBus = bus.pullRecent(12).map((row) => ({
    source: "agent-bus",
    at: row.at,
    kind: row.topic,
    text: `${row.from} · ${row.topic}`,
    detail: typeof row.payload === "object" && row.payload && "input" in row.payload ? String(row.payload.input) : "",
  }));
  const working = memory.snapshotWorkingMemory();
  return {
    memoryFile: "docs/v2/v2-memory.jsonl",
    events: [...recentStore, ...recentBus, ...tailMemory(14)],
    bus: bus.busStats(),
    working: {
      observations: working.observations,
      activeGoals: working.stats.activeGoals,
      openContradictions: working.stats.openContradictions,
    },
    storedInteractions: records.length,
  };
}

export async function busPayload() {
  const { bus, memory } = await busApi();
  const stats = bus.busStats();
  return {
    source: "artifacts/api-server/src/lib/agi/agent-bus.ts",
    stats,
    messages: bus.pullRecent(40).map((row) => ({
      id: row.id,
      at: row.at,
      from: row.from,
      topic: row.topic,
      priority: row.priority,
      novelty: row.novelty,
      attention: row.attention,
    })),
    working: memory.snapshotWorkingMemory().stats,
  };
}

const SCORECARD_DIR = path.join(repoRoot, "scripts/scorecard");
const EVALS_DIR = path.join(repoRoot, "evals");
const EVAL_DIR = path.join(repoRoot, "scripts/eval");

function filesIn(abs) {
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter((name) => !name.startsWith("."));
}

export async function scorePayload() {
  const report = JSON.parse(readFileSync(ROUTER_EVAL, "utf8"));
  const { CASES } = await import("../../api-server/src/eval/chatbot-cases.ts");
  const healthMod = await import("../../api-server/src/lib/eval-os-metrics.ts");
  const health = await Promise.all([
    healthMod.testProcessMemory(),
    healthMod.testCPULoad(),
    healthMod.testOSFreeMemory(),
    healthMod.testUptimeStability(),
  ]);
  return {
    router: {
      file: "artifacts/v2/src/brain/router-eval.json",
      schema: report.schema,
      source: report.source,
      note: report.report?.note ?? "",
      dev: report.report.dev,
      test: report.report.test,
    },
    cases: {
      file: "artifacts/api-server/src/eval/chatbot-cases.ts",
      note: "These are the defined prompts. This console does not invent a pass count for them.",
      rows: CASES.map((row) => ({ id: row.id, category: row.category, prompt: row.prompt })),
    },
    health,
    directories: [
      { path: "scripts/scorecard", present: existsSync(SCORECARD_DIR), files: filesIn(SCORECARD_DIR) },
      { path: "evals", present: existsSync(EVALS_DIR), files: filesIn(EVALS_DIR) },
      { path: "scripts/eval", present: existsSync(EVAL_DIR), files: filesIn(EVAL_DIR) },
    ],
  };
}

export async function answerChat(message) {
  const text = String(message ?? "").trim().slice(0, 4000);
  if (!text) return { ok: false, error: "Message was empty." };
  const { askAll, leaveToHer } = await import("../../../preview/src/lib/tessera/ask-all.ts");
  const { silentPen } = await import("../../../preview/src/lib/tessera/silent-pen.ts");
  const { speak } = await import("../../../preview/src/lib/tessera/chat.ts");
  let reply = leaveToHer(text) ? null : askAll(text);
  let instrument = "askAll";
  if (!reply) {
    const spoken = await speak({
      mode: "chat",
      messages: [{ role: "user", content: text }],
      constitution: null,
      pulses: [],
    });
    if (spoken?.ok && spoken.text) {
      reply = spoken.text;
      instrument = spoken.instrument?.model || "speak";
    } else {
      reply = silentPen(text);
      instrument = "silentPen";
    }
  }
  const store = await learningStore();
  const record = await store.record({
    sourceAgent: "console",
    input: text,
    output: reply,
    tags: ["console", "chat"],
  });
  const { bus } = await busApi();
  bus.publish("console", "chat", { id: record.id, input: record.input, output: record.output }, 60);
  return { ok: true, text: reply, instrument, id: record.id };
}
