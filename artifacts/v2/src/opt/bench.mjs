/**
 * OPT-26 bench. Runs every improvement against its old behaviour on local inputs
 * and prints real before/after numbers. node src/opt/bench.mjs [--json]
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { countTokens } from "../token/meter.mjs";
import { compressPrompt, routeModel } from "../token/router.mjs";
import { createSummaryCache } from "../token/summary-cache.mjs";
import { createForeman } from "../studio/task-graph.mjs";
import { simPen } from "../studio/planner.mjs";
import { checkMessage, loadProtocolUncached, validate, protocolDir } from "../studio/protocol.mjs";
import * as T from "./token-lab.mjs";
import * as H from "./handoff.mjs";
import * as R from "./relay.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const read = (p) => readFileSync(join(root, p), "utf8");
const buildLog = read("docs/v2/BUILD-LOG.md");
const memory = read("docs/v2/v2-memory.jsonl");
const memRows = memory.trim().split("\n");
const memJson = JSON.stringify(JSON.parse(memRows[0]), null, 2);
const fixture = "Describe the studio wall in one line.";
const tok = countTokens;
const rows = [];
const add = (n, name, metric, before, after, lowerIsBetter = true) => rows.push({ n, name, metric, before, after, lowerIsBetter });

export async function runBench() {
  rows.length = 0;
  // Token lab. "before" is today's compressPrompt (whitespace fold), the existing V2 pass.
  const logTwice = memRows.slice(0, 40).join("\n") + "\n" + memRows.slice(0, 40).join("\n");
  add(1, "dedupe-lines", "tokens (memory rows sent twice)", tok(compressPrompt(logTwice)), tok(T.dedupeLines(logTwice)));
  const ask = "Please could you kindly review the board. I would like you to just check every lane in order to find the blocker. It is important to note that basically nothing merges without the gate.";
  add(2, "cut-filler", "tokens (polite task ask)", tok(compressPrompt(ask)), tok(compressPrompt(T.cutFiller(ask))));
  add(3, "compact-json", "tokens (pretty JSON memory row)", tok(memJson), tok(T.compactJson(memJson)));
  add(4, "ref-legend", "tokens (BUILD-LOG with repeated URLs/SHAs)", tok(buildLog), tok(T.refLegend(buildLog)));
  // 5/6 prompt cache over a 100-task mix with 20 distinct asks, repeats vary in case/space.
  const asks = Array.from({ length: 100 }, (_, i) => { const b = `summarize lane ${i % 20} status`; return i % 3 === 0 ? b.toUpperCase() : i % 3 === 1 ? `  ${b}  ` : b; });
  const model = async () => "ok";
  let calls = 0; for (const a of asks) { calls++; await model(a); }
  const exact = T.createPromptCache({ normalize: false }); for (const a of asks) await exact.get(a, model);
  add(5, "exact-prompt-cache", "model calls per 100 tasks", calls, exact.stats().misses);
  const norm = T.createPromptCache({ normalize: true }); for (const a of asks) await norm.get(a, model);
  add(6, "normalized-cache-key", "model calls per 100 tasks", exact.stats().misses, norm.stats().misses);
  add(7, "fit-budget", "max context tokens (budget 512, memory file)", tok(compressPrompt(memory)), tok(T.fitBudget(memory, 512)));
  // 8 routing: 50 tasks, 40 short "answer" asks, 10 long plans.
  const tasks = [...Array.from({ length: 40 }, () => ({ kind: "answer", prompt: memRows[1].slice(0, 400) })), ...Array.from({ length: 10 }, () => ({ kind: "plan", prompt: buildLog }))];
  const cost = (fn) => tasks.reduce((s, t) => s + T.computeUnits(fn(t), tok(t.prompt)), 0);
  add(8, "route-by-size", "compute units per 50 tasks", +cost(routeModel).toFixed(2), +cost((t) => T.routeBySize(t)).toFixed(2));
  // 9 summary repeat: 10 calls, summary grows by one line each time.
  const old = createSummaryCache(), neu = T.createDiffCache();
  let a = 0, b = 0, s = "";
  for (let i = 0; i < 10; i++) { s += memRows[i].slice(0, 120) + "\n"; a += old.context("p", memory, s).tokens; b += neu.context("p", memory, s).tokens; }
  add(9, "diff-only-summary", "tokens over 10 repeat calls", a, b);
  const toolOut = memRows.slice(0, 200).join("\n");
  add(10, "clip-tool-result", "tokens (200-line tool output)", tok(toolOut), tok(T.clipToolResult(toolOut)));
  add(11, "pack-context chain", "tokens (V2-051 fixture)", tok(fixture), tok(T.packContext(fixture)));
  add(11.1, "pack-context chain", "tokens (BUILD-LOG lossless)", tok(compressPrompt(buildLog)), tok(T.packContext(buildLog)));
  // Task graph and studio.
  const dag = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d", dependsOn: ["a", "b"] }, { id: "e", dependsOn: ["b", "c"] }, { id: "f", dependsOn: ["d"] }, { id: "g", dependsOn: ["e"] }, { id: "h", dependsOn: ["f", "g"] }, { id: "i" }, { id: "j", dependsOn: ["i"] }];
  add(12, "parallel-waves", "sequential steps for 10-task DAG", dag.length, H.waves(dag).length);
  let ok1 = 0, ok3 = 0;
  for (let i = 0; i < 20; i++) {
    const flaky = () => { let n = 0; return async () => { if (n++ < (i % 3)) throw new Error("flake"); return 1; }; };
    try { await H.withRetry(flaky(), { attempts: 1 }); ok1++; } catch {}
    try { await H.withRetry(flaky(), { attempts: 3 }); ok3++; } catch {}
  }
  add(13, "capped-retry", "tasks finished of 20 flaky", ok1, ok3, false);
  const f1 = createForeman(); let errs = 0; f1.addTask({ id: "x" }); f1.start("x"); f1.complete("x"); try { f1.complete("x"); } catch { errs++; }
  const f2 = createForeman(); f2.addTask({ id: "x" }); f2.start("x"); const done = H.idempotentComplete(f2); let errs2 = 0; done("x"); try { done("x"); } catch { errs2++; }
  add(14, "idempotent-complete", "errors from duplicate done event", errs, errs2);
  const row = { type: "worker.event", taskId: "t1", name: "tool.read", detail: "x" };
  const t0 = performance.now(); for (let i = 0; i < 500; i++) { const { schema } = loadProtocolUncached(protocolDir()); validate(schema.messages[row.type], row); } const t1 = performance.now();
  checkMessage(row); const t2 = performance.now(); for (let i = 0; i < 500; i++) checkMessage(row); const t3 = performance.now();
  add(15, "memo-protocol-load", "ms per 500 message checks", +(t1 - t0).toFixed(2), +(t3 - t2).toFixed(2));
  const h = { from: "Gitbook", to: "Build", task: "GB-066", status: "approved", refs: ["/workspace/gitbook-cordnation/GB-066/GB-066.diff", "2344334e"], next: "gate and reply PASS/FAIL" };
  add(16, "handoff-envelope", "tokens per bot handoff", tok(H.proseHandoff(h)), tok(H.handoffEnvelope(h)));
  const reg = H.createRegistry(); ["Build:gate", "Security:secrets", "Moderator:review", "Gitbook:ledger", "Cordnation:intake", "MeshCloud:sync", "CommandCenter:launch"].forEach((x) => { const [id, sk] = x.split(":"); reg.register(id, [sk]); });
  add(17, "capability-route", "messages per handoff (find 'sync' owner)", reg.broadcast("sync").messages, reg.route("sync").messages);
  const mp = H.memoPen(simPen()); for (let i = 0; i < 10; i++) await mp.complete(`Plan: ${["wall", "floor"][i % 2]}`);
  add(18, "plan-memo", "pen calls for 10 goals (2 distinct)", 10, mp.calls());
  const fd = createForeman(); ["p", "q", "r", "s"].forEach((id) => fd.addTask({ id })); const open = ["p", "q", "r", "s"].map((id) => fd.requestDecision({ taskId: id, question: "ok?" }));
  add(19, "batch-decisions", "human round trips for 4 decisions", open.length, H.batchDecisions(fd, open, {}).rounds);
  const votes = [true, true, true, true, true, true, false, true, false];
  add(20, "early-quorum", "votes read (9 voters, 2/3)", votes.length, H.earlyQuorum(votes, 9).read);
  const claims = H.createClaims(); let runsOld = 0, runsNew = 0;
  for (const lane of ["Build", "Security", "Moderator"]) for (let t = 0; t < 5; t++) { runsOld++; if (claims.claim(`t${t}`, lane)) runsNew++; }
  add(21, "single-owner-claim", "task runs (3 lanes x 5 tasks)", runsOld, runsNew);
  // Mesh relay.
  let up0 = 0; const src = async () => { up0++; return "page"; };
  for (let n = 0; n < 12; n++) for (const k of ["wx", "quake", "wiki"]) await src(k);
  let up1 = 0; const relay = R.createRelay(async () => { up1++; return "page"; });
  for (let n = 0; n < 12; n++) for (const k of ["wx", "quake", "wiki"]) await relay.get(k);
  add(22, "fetch-once-relay", "upstream fetches (12 nodes x 3 sources)", up0, up1);
  let clock = 0; const bucket = R.createBucket({ ratePerSec: 5, burst: 1, now: () => clock });
  let over0 = 0, over1 = 0, sent = 0, ts = [];
  for (let i = 0; i < 30; i++) { ts.push(i * 50); }
  const inWin = (arr, t) => arr.filter((x) => x > t - 1000 && x <= t).length;
  ts.forEach((t, i) => { if (inWin(ts.slice(0, i + 1), t) > 5) over0++; });
  const paced = []; for (const t of ts) { clock = Math.max(clock, t); let w; while ((w = bucket.take()) > 0) clock += w; paced.push(clock); sent++; }
  paced.forEach((t, i) => { if (inWin(paced.slice(0, i + 1), t) > 5) over1++; });
  add(23, "token-bucket-pacing", "requests over 5/s limit (30 burst)", over0, over1);
  // A source answers 429 with Retry-After: 1 s twice. Count calls sent while it said wait.
  const mk = (clk) => { let n = 0, until = 0, early = 0; return { early: () => early, call: async () => { if (clk.t < until) early++; if (n++ < 2) { until = clk.t + 1000; return { status: 429, retryAfter: 1 }; } return { status: 200 }; } }; };
  const c0 = { t: 0 }; const s0 = mk(c0); { let r; let i = 0; do { r = await s0.call(); c0.t += 10; } while (r.status === 429 && ++i < 10); }
  const c1 = { t: 0 }; const s1 = mk(c1); await R.politeFetch(s1.call, { sleep: async (ms) => { c1.t += ms; } });
  add(24, "retry-after-backoff", "calls sent inside the source's Retry-After window", s0.early(), s1.early());
  let up2 = 0; const nc = R.createRelay(async () => { up2++; await new Promise((r) => setTimeout(r, 5)); return 1; }, { coalesce: false });
  await Promise.all(Array.from({ length: 10 }, () => nc.get("k")));
  let up3 = 0; const co = R.createRelay(async () => { up3++; await new Promise((r) => setTimeout(r, 5)); return 1; });
  await Promise.all(Array.from({ length: 10 }, () => co.get("k")));
  add(25, "in-flight-coalesce", "upstream fetches (10 concurrent same ask)", up2, up3);
  const pages = Object.fromEntries(memRows.slice(0, 50).map((r, i) => [`p${i}`, memRows[i % 10]]));
  const cas = R.createCasStore(); for (const [k, v] of Object.entries(pages)) cas.put(k, v);
  const raw = Object.values(pages).reduce((n, v) => n + Buffer.byteLength(v), 0);
  add(26, "hash-store + delta-sync", "bytes stored (50 pages, 10 unique)", raw, cas.bytes());
  const remote = { ...pages }; const local = { ...pages, p3: pages.p3 + " edit", p7: "new" };
  const sendBytes = Object.values(R.deltaSync(local, R.manifest(remote))).reduce((n, v) => n + Buffer.byteLength(v), 0);
  add(26.1, "hash-store + delta-sync", "bytes sent to sync 2 changed pages", Object.values(local).reduce((n, v) => n + Buffer.byteLength(v), 0), sendBytes);
  return rows.map((r) => ({ ...r, change: r.before === 0 ? (r.after === 0 ? 0 : null) : +(((r.after - r.before) / r.before) * 100).toFixed(1), improved: r.lowerIsBetter ? r.after < r.before : r.after > r.before }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = await runBench();
  if (process.argv.includes("--json")) console.log(JSON.stringify(out, null, 1));
  else for (const r of out) console.log(`${r.n}\t${r.name}\t${r.metric}\t${r.before}\t${r.after}\t${r.change}%\t${r.improved ? "IMPROVED" : "NO GAIN"}`);
}
