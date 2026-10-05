/**
 * Repeatable eval record writer.
 *
 * Writes JSON {sha, date_ct, model, suite, n, pass, cost_usd} from measured
 * inputs. It does not run a quiz and does not invent scores. Suite names that
 * claim MMLU or MMLU-Pro are refused: homemade quizzes are not those benchmarks.
 *
 * Usage:
 *   node scripts/eval/write-result.mjs \
 *     --sha <git-sha> --model <name> --suite <name> \
 *     --n <int> --pass <int> --cost-usd <number> [--out <file>]
 */
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MMLU_NAME = /mmlu/i;

export function assertNotIndustryMmlu(suite) {
  if (typeof suite !== "string" || suite.trim() === "") {
    throw new Error("suite must be a non-empty name");
  }
  if (MMLU_NAME.test(suite)) {
    throw new Error(
      `Refusing suite name ${JSON.stringify(suite)}: homemade quizzes are not MMLU or MMLU-Pro`,
    );
  }
}

export function formatDateCt(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} CT`;
}

export function buildEvalRecord({ sha, dateCt, model, suite, n, pass, costUsd }) {
  if (typeof sha !== "string" || sha.trim() === "") {
    throw new Error("sha is required");
  }
  if (typeof model !== "string" || model.trim() === "") {
    throw new Error("model is required");
  }
  assertNotIndustryMmlu(suite);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("n must be a non-negative integer");
  }
  if (!Number.isInteger(pass) || pass < 0 || pass > n) {
    throw new Error("pass must be an integer from 0 through n");
  }
  if (typeof costUsd !== "number" || !Number.isFinite(costUsd) || costUsd < 0) {
    throw new Error("cost_usd must be a finite number >= 0");
  }
  return {
    sha,
    date_ct: dateCt ?? formatDateCt(),
    model,
    suite,
    n,
    pass,
    cost_usd: costUsd,
  };
}

function readFlag(argv, name) {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1];
}

export function recordFromArgv(argv, date = new Date()) {
  const n = Number(readFlag(argv, "--n"));
  const pass = Number(readFlag(argv, "--pass"));
  const costUsd = Number(readFlag(argv, "--cost-usd"));
  return buildEvalRecord({
    sha: readFlag(argv, "--sha"),
    dateCt: readFlag(argv, "--date-ct") ?? formatDateCt(date),
    model: readFlag(argv, "--model"),
    suite: readFlag(argv, "--suite"),
    n,
    pass,
    costUsd,
  });
}

function invokedDirectly() {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(entry).href;
}

if (invokedDirectly()) {
  try {
    const record = recordFromArgv(process.argv.slice(2));
    const json = `${JSON.stringify(record, null, 2)}\n`;
    const out = readFlag(process.argv.slice(2), "--out");
    if (out) writeFileSync(out, json);
    else process.stdout.write(json);
  } catch (error) {
    console.error(`[eval-record] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
