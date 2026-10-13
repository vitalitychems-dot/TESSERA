import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadSubset, SOURCE } from "../eval/reasoning/load.mjs";
import { chooseModel, PREFERRED_MODELS } from "../eval/reasoning/ollama.mjs";
import { PROMPT_ID, baselinePrompt } from "../eval/reasoning/prompt.mjs";
import { runReasoningEval } from "../eval/reasoning/run.mjs";
import { extractAnswer, goldAnswer, isCorrect, normalizeNumber } from "../eval/reasoning/score.mjs";

const runPath = fileURLToPath(new URL("../eval/reasoning/run.mjs", import.meta.url));
const subsetPath = fileURLToPath(new URL("../eval/reasoning/gsm8k-test-200.jsonl", import.meta.url));

test("GSM8K record pins the MIT license, commit, and 200-item subset", () => {
  assert.equal(SOURCE.license, "MIT");
  assert.equal(SOURCE.commit, "3101c7d5072418e28b9008a6636bde82a006892c");
  assert.equal(SOURCE.subset.n, 200);
  assert.match(readFileSync(new URL("../eval/reasoning/LICENSE", import.meta.url), "utf8"), /Copyright \(c\) 2021 OpenAI/);
  const sha256 = createHash("sha256").update(readFileSync(subsetPath)).digest("hex");
  assert.equal(sha256, SOURCE.subset.sha256);
  const items = loadSubset();
  assert.equal(items.length, 200);
  assert.equal(items[0].index, 0);
  assert.match(items[0].question, /ducks/);
  assert.equal(goldAnswer(items[0].answer), "18");
  assert.equal(items.filter((item) => goldAnswer(item.answer) == null).length, 0);
});

test("answer extraction follows the GSM8K final number", () => {
  assert.equal(normalizeNumber("1,000"), "1000");
  assert.equal(normalizeNumber("18.0"), "18");
  assert.equal(goldAnswer("She sells the rest.\n#### 18"), "18");
  assert.equal(extractAnswer("working\n#### 18"), "18");
  assert.equal(extractAnswer("#### 3\nwait\n#### 9"), "9");
  assert.equal(extractAnswer("the remainder is 21 eggs"), "21");
  assert.equal(extractAnswer("no numeric result"), null);
  assert.equal(isCorrect("18", "18"), true);
  assert.equal(isCorrect("18", "17"), false);
  assert.equal(isCorrect(null, null), false);
});

test("model choice follows the existing Ollama preferred names", () => {
  assert.deepEqual(PREFERRED_MODELS, ["llama3.2:3b", "llama3.2:1b", "mistral:7b", "phi3:mini"]);
  assert.equal(chooseModel(["phi3:mini", "llama3.2:3b"], null), "llama3.2:3b");
  assert.equal(chooseModel(["custom:latest"], null), "custom:latest");
  assert.equal(chooseModel(["llama3.2:3b"], "missing"), null);
  assert.equal(chooseModel(["llama3.2:3b"], "llama3.2:3b"), "llama3.2:3b");
  assert.equal(PROMPT_ID, "baseline-v1");
  assert.match(baselinePrompt("How many eggs?"), /####/);
});

test("a missing local model does not invent accuracy", async () => {
  const report = await runReasoningEval({
    endpoint: "http://127.0.0.1:9",
    items: loadSubset().slice(0, 3),
    fetchImpl: async () => {
      throw new Error("connect ECONNREFUSED");
    },
  });
  assert.equal(report.status, "model-unavailable");
  assert.equal(report.accuracy, null);
  assert.equal(report.correct, null);
  assert.equal(report.n, 3);
  assert.equal(report.subset_n, 200);
  assert.equal(report.metric, "exact_match_accuracy");
});

test("a fake local chat is scored by exact match on the public gold", async () => {
  const items = loadSubset().slice(0, 4);
  const fetchImpl = async (url, init) => {
    if (String(url).endsWith("/api/tags")) {
      return { ok: true, json: async () => ({ models: [{ name: "phi3:mini" }] }) };
    }
    const body = JSON.parse(init.body);
    assert.equal(body.options.temperature, 0);
    assert.equal(body.stream, false);
    const question = body.messages[0].content;
    const item = items.find((row) => question.includes(row.question.trim()));
    const gold = goldAnswer(item.answer);
    const content = item.index === 0 ? `steps\n#### ${gold}` : "#### 0";
    return { ok: true, json: async () => ({ message: { content } }) };
  };
  const report = await runReasoningEval({
    fetchImpl,
    items,
    endpoint: "http://ollama.test",
    model: "phi3:mini",
  });
  assert.equal(report.status, "scored");
  assert.equal(report.model, "phi3:mini");
  assert.equal(report.correct, 1);
  assert.equal(report.accuracy, 0.25);
  assert.equal(report.items[0].ok, true);
  assert.equal(report.items[1].ok, false);
});

test("the runner dry-run prints the subset and a dead endpoint stays unscored", () => {
  const dry = spawnSync(process.execPath, [runPath, "--dry-run"], { encoding: "utf8" });
  assert.equal(dry.status, 0, dry.stderr);
  const dryReport = JSON.parse(dry.stdout);
  assert.equal(dryReport.status, "not-scored");
  assert.equal(dryReport.n, 200);
  assert.equal(dryReport.accuracy, null);
  assert.equal(dryReport.commit, SOURCE.commit);

  const dead = spawnSync(process.execPath, [runPath, "--limit", "1"], {
    encoding: "utf8",
    env: { ...process.env, OLLAMA_ENDPOINT: "http://127.0.0.1:9" },
    timeout: 15000,
  });
  assert.equal(dead.status, 2, dead.stderr);
  const deadReport = JSON.parse(dead.stdout);
  assert.equal(deadReport.status, "model-unavailable");
  assert.equal(deadReport.accuracy, null);
  assert.equal(deadReport.correct, null);
  assert.equal(deadReport.subset_n, 200);
});
