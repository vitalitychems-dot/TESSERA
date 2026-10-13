#!/usr/bin/env node
// needs-agent worker: one issue -> a candidate fix -> local tests -> (optionally) a PR. Never merges.
// Model: any OpenAI-compatible endpoint. Default is a local llama.cpp server (sovereign, $0).
// Fallback: GitHub Models free tier (WORKER_ENDPOINT=https://models.github.ai/inference, token=GITHUB_TOKEN).
// Issue contract (written by findings.mjs or a human): lines "file: <path>" and "test: <command>".
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { evaluate, parseLockList } from "../../gate/moderator-lock.mjs";

export function parseIssue(body) {
  const file = body.match(/^file:\s*(\S+)/m)?.[1];
  const test = body.match(/^test:\s*(.+)$/m)?.[1]?.trim();
  return { file, test };
}

// --- Input hardening (Security #71 / #294): issue bodies are untrusted. ---
// Never run arbitrary shell from an issue. file:/test: are validated before use.
export function isSafeRelPath(p) {
  if (!p || typeof p !== "string") return false;
  if (p.includes("\0")) return false;
  if (p.startsWith("/") || p.startsWith("~")) return false;   // no absolute / home paths
  if (/(^|\/)\.\.(\/|$)/.test(p)) return false;                 // no ../ traversal
  return true;
}

const DEFAULT_TEST_ALLOW = [
  "npm test", "npm run test", "npm run lint",
  "pnpm test", "pnpm run test", "pnpm -r test", "pnpm vitest run",
  "npx vitest run", "node --test",
];
export function parseTestAllow(env) {
  const v = (env ?? "").trim();
  return v ? v.split(",").map((s) => s.trim()).filter(Boolean) : DEFAULT_TEST_ALLOW;
}
// A test line must be exactly an allowlisted command (optionally followed by a
// space and plain relative-path args). No shell metacharacters, no ../, no absolute paths.
export function validateTest(test, allow = DEFAULT_TEST_ALLOW) {
  if (!test || typeof test !== "string") return { ok: false, why: "missing test:" };
  if (/[;&|`$><\n\r\\(){}*?!]/.test(test)) return { ok: false, why: "test has shell metacharacters" };
  if (/(^|\s)~?\//.test(test)) return { ok: false, why: "test has an absolute/home path" };
  if (/(^|\s)\.\.(\/|\s|$)/.test(test)) return { ok: false, why: "test has a ../ path" };
  const base = allow.find((a) => test === a || test.startsWith(a + " "));
  if (!base) return { ok: false, why: `test not in allowlist: ${JSON.stringify(test)}` };
  return { ok: true };
}

export function extractCode(text) {
  const m = [...text.matchAll(/```[a-zA-Z]*\n([\s\S]*?)```/g)];
  return m.length ? m[m.length - 1][1] : text;
}

export function changedLines(a, b) {
  const A = a.split("\n"), B = b.split("\n");
  const setA = new Map(); for (const l of A) setA.set(l, (setA.get(l) ?? 0) + 1);
  let same = 0; for (const l of B) { const n = setA.get(l) ?? 0; if (n) { same++; setA.set(l, n - 1); } }
  return (A.length - same) + (B.length - same);
}

export async function ask({ endpoint, model, token, prompt, temperature: cfg_t }) {
  const res = await fetch(`${endpoint.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ model, temperature: cfg_t ?? 0, max_tokens: 1200, messages: [
      { role: "system", content: "You fix bugs. Reply with ONLY the complete corrected file in one fenced code block." },
      { role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`model HTTP ${res.status}`);
  const j = await res.json();
  return { text: j.choices[0].message.content, usage: j.usage ?? {} };
}

export async function attempt({ cwd, issue, locked, cfg }) {
  const { file, test } = parseIssue(issue.body);
  if (!file || !test) return { ok: false, why: "issue lacks file:/test: lines" };
  if (!isSafeRelPath(file)) return { ok: false, why: `refused: unsafe file path ${JSON.stringify(file)}` };
  const tv = validateTest(test, cfg.testAllow);
  if (!tv.ok) return { ok: false, why: `refused: ${tv.why}` };
  const lock = evaluate({ files: [{ filename: file, additions: 1 }], lockedPatterns: locked, headSha: "x" }).lock;
  if (lock.lockedHits.length) return { ok: false, why: `refused: ${file} is locked` };
  const path = `${cwd}/${file}`;
  const before = readFileSync(path, "utf8");
  let testOut = "";
  try { execSync(test, { cwd, stdio: "pipe" }); } catch (e) { testOut = String(e.stdout) + String(e.stderr); }
  const prompt = `Issue: ${issue.title}\n${issue.body}\n\nFailing test output:\n${testOut.slice(-1500)}\n\nFile ${file}:\n\`\`\`\n${before}\n\`\`\``;
  const testSrc = (() => { const m = test.match(/(\S+\.test\.\w+)/); if (!m || !isSafeRelPath(m[1])) return ""; try { return readFileSync(`${cwd}/${m[1]}`, "utf8"); } catch { return ""; } })();
  const full = prompt + (testSrc ? `\n\nThe test that must pass:\n\`\`\`\n${testSrc}\n\`\`\`` : "");
  const t0 = Date.now(); const usage = { prompt_tokens: 0, completion_tokens: 0 }; let pass = false, n = 0, tries = 0;
  for (tries = 1; tries <= cfg.tries; tries++) {
    const r = await ask({ ...cfg, prompt: full, temperature: tries === 1 ? 0 : 0.6 });
    usage.prompt_tokens += r.usage.prompt_tokens ?? 0; usage.completion_tokens += r.usage.completion_tokens ?? 0;
    const after = extractCode(r.text);
    n = changedLines(before, after);
    if (n === 0 || n > cfg.lineCap) continue;
    writeFileSync(path, after);
    try { execSync(test, { cwd, stdio: "pipe" }); pass = true; break; } catch { writeFileSync(path, before); }
  }
  return { ok: pass, why: pass ? "tests pass" : "no candidate passed (reverted)", tries: Math.min(tries, cfg.tries), lines: n, ms: Date.now() - t0, usage };
}

if (process.argv[1]?.endsWith("worker.mjs")) {
  const [cwd = ".", issueFile] = process.argv.slice(2);
  const issue = JSON.parse(readFileSync(issueFile, "utf8"));
  const locked = parseLockList(readFileSync(new URL("../../gate/locked-paths.txt", import.meta.url), "utf8"));
  const cfg = { endpoint: process.env.WORKER_ENDPOINT ?? "http://127.0.0.1:8080/v1", model: process.env.WORKER_MODEL ?? "local",
    token: process.env.WORKER_TOKEN ?? "", lineCap: Number(process.env.WORKER_LINE_CAP ?? 60), tries: Number(process.env.WORKER_TRIES ?? 4),
    testAllow: parseTestAllow(process.env.WORKER_TEST_ALLOW) };
  const r = await attempt({ cwd, issue, locked, cfg });
  console.log(JSON.stringify(r));
  process.exit(r.ok ? 0 : 1);
}
