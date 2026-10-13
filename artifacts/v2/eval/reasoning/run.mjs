import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { loadSubset, SOURCE } from "./load.mjs";
import { chatOllama, chooseModel, ollamaEndpoint, probeOllama } from "./ollama.mjs";
import { PROMPT_ID, baselinePrompt } from "./prompt.mjs";
import { extractAnswer, goldAnswer, isCorrect } from "./score.mjs";

function identity(n) {
  return {
    dataset: SOURCE.name,
    license: SOURCE.license,
    commit: SOURCE.commit,
    upstream: SOURCE.upstream,
    subset_rule: SOURCE.subset.rule,
    subset_sha256: SOURCE.subset.sha256,
    subset_n: SOURCE.subset.n,
    n,
    metric: SOURCE.metric,
    prompt: PROMPT_ID,
    adapter: "ollama",
  };
}

/**
 * Score the fixed GSM8K subset against a local Ollama server.
 * When the server or model is missing, accuracy stays null. No number is invented.
 */
export async function runReasoningEval(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const all = options.items ?? loadSubset();
  const limit = options.limit ?? all.length;
  const items = all.slice(0, limit);
  const endpoint = options.endpoint ?? ollamaEndpoint(options.env);
  const base = identity(items.length);
  const probe = await probeOllama(fetchImpl, endpoint);
  if (!probe.ok) {
    return {
      ...base,
      status: "model-unavailable",
      endpoint,
      model: null,
      accuracy: null,
      correct: null,
      error: probe.error ?? `http ${probe.status ?? "unreachable"}`,
    };
  }
  const requested = options.model ?? options.env?.OLLAMA_MODEL ?? process.env.OLLAMA_MODEL ?? null;
  const model = chooseModel(probe.models, requested || null);
  if (!model) {
    return {
      ...base,
      status: "model-unavailable",
      endpoint,
      model: null,
      accuracy: null,
      correct: null,
      error: requested ? `model not pulled: ${requested}` : "no models",
    };
  }
  const rows = [];
  let correct = 0;
  for (const item of items) {
    let text = "";
    let error = null;
    try {
      text = await chatOllama(fetchImpl, endpoint, model, baselinePrompt(item.question), options);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const gold = goldAnswer(item.answer);
    const predicted = error ? null : extractAnswer(text);
    const ok = isCorrect(gold, predicted);
    if (ok) correct += 1;
    rows.push({ index: item.index, gold, predicted, ok, error });
  }
  if (rows.length > 0 && rows.every((row) => row.error)) {
    return {
      ...base,
      status: "model-unavailable",
      endpoint,
      model,
      accuracy: null,
      correct: null,
      errors: rows.length,
      error: rows[0].error,
    };
  }
  return {
    ...base,
    status: "scored",
    endpoint,
    model,
    temperature: options.temperature ?? 0,
    correct,
    errors: rows.filter((row) => row.error).length,
    accuracy: items.length === 0 ? null : correct / items.length,
    items: rows,
  };
}

function parseArgs(argv) {
  const args = { limit: null, model: null, out: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dry-run") args.dryRun = true;
    else if (token === "--help" || token === "-h") args.help = true;
    else if (token === "--limit") args.limit = Number(argv[++i]);
    else if (token === "--model") args.model = argv[++i];
    else if (token === "--out") args.out = argv[++i];
    else throw new Error(`unknown argument: ${token}`);
  }
  if (args.limit != null && (!Number.isInteger(args.limit) || args.limit < 1)) {
    throw new Error("--limit must be a positive integer");
  }
  return args;
}

function emit(report, outPath) {
  const text = `${JSON.stringify(report, null, 2)}\n`;
  process.stdout.write(text);
  if (outPath) writeFileSync(outPath, text);
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
  if (args.help) {
    process.stdout.write(
      "usage: node eval/reasoning/run.mjs [--dry-run] [--limit N] [--model NAME] [--out FILE]\n",
    );
    return;
  }
  if (args.dryRun) {
    const items = loadSubset();
    emit(
      {
        ...identity(items.length),
        status: "not-scored",
        endpoint: ollamaEndpoint(),
        model: null,
        accuracy: null,
        correct: null,
        note: "Dry run loads the fixed subset and does not call a model.",
      },
      args.out,
    );
    return;
  }
  const report = await runReasoningEval({ limit: args.limit ?? undefined, model: args.model ?? undefined });
  emit(report, args.out);
  if (report.status !== "scored") process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}
