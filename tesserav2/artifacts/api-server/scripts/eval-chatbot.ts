/**
 * Chatbot regression eval harness.
 * Runs a golden Q&A set against the running API and scores responses.
 *
 * Usage:  pnpm tsx artifacts/api-server/scripts/eval-chatbot.ts
 * Env:    EVAL_BASE_URL (default http://localhost:5000)
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { pathToFileURL } from "node:url";
import { CASES, type EvalCase } from "../src/eval/chatbot-cases.ts";

const BASE_URL = process.env.EVAL_BASE_URL || "http://localhost:5000";

async function ownerCookie(): Promise<string> {
  const token = (process.env.TESSERACT_ADMIN_KEY ?? "").trim();
  if (token.length < 16) {
    throw new Error("TESSERACT_ADMIN_KEY is required; conversation routes require an owner session");
  }
  const origin = new URL(BASE_URL).origin;
  const res = await fetch(`${BASE_URL}/api/admin/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error(`owner session failed (${res.status})`);
  }
  const cookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const raw = cookies.find((entry) => entry.startsWith("sovereign_session=")) ?? res.headers.get("set-cookie") ?? "";
  const match = /sovereign_session=([^;]+)/.exec(raw);
  if (!match?.[1]) throw new Error("owner session response did not set sovereign_session");
  return `sovereign_session=${match[1]}`;
}

interface CaseResult {
  id: string;
  category: string;
  prompt: string;
  response: string;
  passed: boolean;
  failures: string[];
  latencyMs: number;
  routing?: unknown;
  citations?: unknown;
}

async function runCase(c: EvalCase, cookie: string): Promise<CaseResult> {
  const start = Date.now();
  const failures: string[] = [];
  let response = "";
  let routing: unknown;
  let citations: unknown;

  try {
    const convoRes = await fetch(`${BASE_URL}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ title: `eval-${c.id}` }),
    });
    const convo = await convoRes.json();
    const conversationId = convo.id;

    const msgRes = await fetch(`${BASE_URL}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ conversationId, content: c.prompt }),
    });

    const reader = msgRes.body?.getReader();
    if (!reader) throw new Error("no body");
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const data = line.replace(/^data:\s*/, "").trim();
        if (!data) continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.content) response = parsed.content;
          if (parsed.done) {
            response = parsed.finalContent || response;
            routing = parsed.routing;
            citations = parsed.citations;
          }
        } catch {}
      }
    }
  } catch (err) {
    failures.push(`request failed: ${(err as Error).message}`);
  }

  for (const m of c.mustInclude || []) {
    if (!response.toLowerCase().includes(m.toLowerCase())) failures.push(`missing: "${m}"`);
  }
  for (const m of c.mustNotInclude || []) {
    if (response.toLowerCase().includes(m.toLowerCase())) failures.push(`forbidden present: "${m}"`);
  }

  return {
    id: c.id,
    category: c.category,
    prompt: c.prompt,
    response: response.slice(0, 800),
    passed: failures.length === 0,
    failures,
    latencyMs: Date.now() - start,
    routing,
    citations,
  };
}

async function main() {
  console.log(`[eval] running ${CASES.length} cases against ${BASE_URL}`);
  const cookie = await ownerCookie();
  const results: CaseResult[] = [];
  for (const c of CASES) {
    process.stdout.write(`  [${c.id}] ... `);
    const r = await runCase(c, cookie);
    results.push(r);
    console.log(r.passed ? `PASS (${r.latencyMs}ms)` : `FAIL — ${r.failures.join("; ")}`);
  }

  const passed = results.filter(r => r.passed).length;
  const score = passed / results.length;
  const avgLatency = results.reduce((s, r) => s + r.latencyMs, 0) / results.length;
  const byCategory: Record<string, { pass: number; total: number }> = {};
  for (const r of results) {
    if (!byCategory[r.category]) byCategory[r.category] = { pass: 0, total: 0 };
    byCategory[r.category].total++;
    if (r.passed) byCategory[r.category].pass++;
  }

  const summary = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    total: results.length,
    passed,
    score,
    avgLatencyMs: Math.round(avgLatency),
    byCategory,
    results,
  };

  const outPath = resolve(process.cwd(), `.local/eval-results-${Date.now()}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\n[eval] score: ${(score * 100).toFixed(1)}% (${passed}/${results.length})`);
  console.log(`[eval] avg latency: ${summary.avgLatencyMs}ms`);
  console.log(`[eval] results written to ${outPath}`);

  if (score < 0.6) process.exit(1);
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main().catch((err) => {
    console.error("[eval] fatal:", err);
    process.exit(2);
  });
}
