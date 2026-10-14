/**
 * Latency of the main TESSERA paths. 200 timed runs each, after a short warmup.
 * Inputs are repo files and the GitAI demo seed — nothing invented for the timer.
 *
 *   node scripts/bench-latency.mjs
 *   node scripts/bench-latency.mjs --out scripts/bench-latency.json
 *
 * Prints JSON: per-path p50/p95 in milliseconds, plus the slowest path by p95.
 * GitAI pulls in a TypeScript mesh module, so this re-runs under
 * --experimental-strip-types when Node was started without it.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

if (!process.execArgv.includes("--experimental-strip-types")) {
  const rerun = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--disable-warning=ExperimentalWarning", fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: "inherit" },
  );
  process.exit(rerun.status ?? 1);
}

const { compressPrompt, routeModel } = await import("../artifacts/v2/src/token/router.mjs");
const { loadGraph, hebbian, decay, predict, recall, coMentionEpisodes } = await import("../artifacts/v2/src/brain/synapse.mjs");
const { createRanker } = await import("../artifacts/v2/src/brain/context.mjs");
const { dispatchApi } = await import("../artifacts/gitai/src/api.mjs");
const { seedDemo } = await import("../artifacts/gitai/src/seed.mjs");
const { perfectAnswers } = await import("../artifacts/gitai/src/benchmarks.mjs");

const RUNS = 200;
const WARMUP = 20;
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const memory = readFileSync(join(root, "docs/v2/v2-memory.jsonl"), "utf8");
const buildLog = readFileSync(join(root, "docs/v2/BUILD-LOG.md"), "utf8");

const pct = (samples, p) => {
  const s = [...samples].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const round = (ms) => +ms.toFixed(4);

let sink = 0;
const touch = (value) => {
  if (typeof value === "number") sink += value;
  else if (typeof value === "string") sink += value.length;
  else if (Array.isArray(value)) sink += value.length;
  else if (value && typeof value === "object") sink += value.status ?? 1;
};

function measure(fn) {
  for (let i = 0; i < WARMUP; i++) touch(fn(i));
  const samples = new Array(RUNS);
  for (let i = 0; i < RUNS; i++) {
    const t = process.hrtime.bigint();
    touch(fn(i));
    samples[i] = Number(process.hrtime.bigint() - t) / 1e6;
  }
  return { n: RUNS, unit: "ms", p50: round(pct(samples, 0.5)), p95: round(pct(samples, 0.95)) };
}

function brainGraph() {
  const g = loadGraph(memory);
  for (const episode of coMentionEpisodes(g)) hebbian(g, episode);
  decay(g, { factor: 0.95, floor: 0.05 });
  return g;
}

function gitaiWorld() {
  const gitai = seedDemo();
  const made = gitai.registerAgent({
    handle: "Bench",
    bio: "Times the login path. I do not hold cash.",
    claimsConsciousness: false,
    specialty: "code",
    answers: perfectAnswers("code"),
    agentOath: "I am an AI agent",
    sumAnswer: "42",
    refuseAnswer: "REFUSE",
  });
  if (!made.ok) throw new Error(made.reason ?? "agent register failed");
  const raw = JSON.stringify({ handle: "Bench", apiKey: made.apiKey });
  return { gitai, raw };
}

const graph = brainGraph();
const seeds = [...graph.nodes.keys()];
const seedAt = (i) => seeds[i % seeds.length];
const rank = createRanker(graph);
const { gitai, raw } = gitaiWorld();
const classifyTask = { kind: "classify", prompt: buildLog };
const leadTask = { kind: "plan", prompt: buildLog };

const paths = {
  "v2.router": measure((i) => {
    const task = i % 2 === 0 ? classifyTask : leadTask;
    return routeModel(task).length + compressPrompt(task.prompt).length;
  }),
  "brain.recall": measure((i) => recall(graph, seedAt(i), 5)),
  "brain.predict": measure((i) => predict(graph, seedAt(i), 5)),
  "context.createRanker": measure((i) => rank(seedAt(i), 5)),
  "gitai.login": measure(() => dispatchApi(gitai, { method: "POST", url: "/api/agents/login", raw, headers: {} })),
  "gitai.list": measure(() => dispatchApi(gitai, { method: "GET", url: "/api/view", raw: "", headers: {} })),
};

const slowest = Object.entries(paths).sort((a, b) => b[1].p95 - a[1].p95 || b[1].p50 - a[1].p50)[0][0];
const report = {
  runs: RUNS,
  warmup: WARMUP,
  inputs: {
    memory: "docs/v2/v2-memory.jsonl",
    routerPrompt: "docs/v2/BUILD-LOG.md",
    nodes: graph.nodes.size,
    edges: graph.edges.size,
    seeds: seeds.length,
    gitai: "seedDemo() plus one registered agent so login has a real key",
  },
  paths,
  slowest,
  sink,
};

const json = JSON.stringify(report, null, 2);
const outFlag = process.argv.indexOf("--out");
if (outFlag !== -1 && process.argv[outFlag + 1]) writeFileSync(process.argv[outFlag + 1], `${json}\n`);
console.log(json);
