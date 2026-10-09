import { readFile } from "node:fs/promises";
import { prepareLocalPen } from "./config";
import { probeLoopback } from "./loopback";
import { runLocalPen } from "./run";
import { failedChecks, scorePenBatch, type PromptSpec, type ScoreInput } from "./score";
import type { PenNotConfiguredReason } from "./types";

/**
 * Manual full-pen gate. Not part of the test script.
 * Set TESSERA_PEN_LOCAL=1 and TESSERA_PEN_LOCAL_PROMPTS to a prompts JSON file.
 * Prints one JSON object per prompt, then the pass criteria.
 * The summary label stays REPORTED. A person who saw the raw output may relabel it.
 */
export async function main(env: NodeJS.ProcessEnv = process.env): Promise<number> {
  const promptsPath = env.TESSERA_PEN_LOCAL_PROMPTS?.trim() ?? "";
  if (promptsPath.length === 0) {
    console.error("Set TESSERA_PEN_LOCAL_PROMPTS to the prompts JSON path. The local gate was not run.");
    return 2;
  }

  const prompts = await loadPrompts(promptsPath);
  if (!prompts.ok) {
    console.error(prompts.message);
    return 2;
  }
  if (prompts.prompts.length !== 20) {
    console.error(`Expected 20 prompts and found ${prompts.prompts.length}. Scoring the file that was provided.`);
  }

  const prepared = await prepareLocalPen(env);
  if (!prepared.ok) {
    console.error(notConfiguredMessage(prepared.reason));
    return 2;
  }
  const probe = await probeLoopback(prepared.config.url, prepared.config.timeoutMs);
  if (probe === "down") {
    console.error(notConfiguredMessage("runtime_down"));
    return 2;
  }
  if (probe === "redirect") {
    console.error(notConfiguredMessage("non_loopback"));
    return 2;
  }

  const inputs: ScoreInput[] = [];
  for (const prompt of prompts.prompts) {
    const result = await runLocalPen({ text: prompt.text });
    if (result.status === "PEN_NOT_CONFIGURED") {
      console.error(notConfiguredMessage(result.reason));
      console.error("The local gate stopped before a complete score.");
      return 2;
    }
    if (result.status === "PEN_ERROR") {
      console.error("The local pen returned an error and no text. The local gate stopped before a complete score.");
      return 2;
    }
    const output = result.ok ? result.text : "";
    const latency_s = Math.round(result.provenance.latency_ms) / 1000;
    inputs.push({ id: prompt.id, output, latency_s });
    const scored = scorePenBatch(prompts.prompts, [{ id: prompt.id, output, latency_s }]).rows[0];
    console.log(JSON.stringify({
      id: prompt.id,
      status: result.status,
      rule: result.rule,
      gate: result.gate,
      pass: scored?.pass ?? false,
      failed_checks: scored ? failedChecks(scored.checks) : [],
      latency_s,
      output,
    }));
  }

  const summary = scorePenBatch(prompts.prompts, inputs);
  console.log(JSON.stringify({ summary }, null, 2));
  return 0;
}

async function loadPrompts(path: string): Promise<{ ok: true; prompts: PromptSpec[] } | { ok: false; message: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch {
    return { ok: false, message: "Could not read TESSERA_PEN_LOCAL_PROMPTS as JSON. The local gate was not run." };
  }
  const rows = typeof parsed === "object" && parsed !== null && "prompts" in parsed
    ? (parsed as { prompts?: unknown }).prompts
    : null;
  if (!Array.isArray(rows) || rows.length === 0 || !rows.every(isPrompt)) {
    return { ok: false, message: "TESSERA_PEN_LOCAL_PROMPTS has no usable prompt list. The local gate was not run." };
  }
  return { ok: true, prompts: rows };
}

function isPrompt(value: unknown): value is PromptSpec {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.cat !== "string" || typeof row.text !== "string") return false;
  if (row.rule !== undefined && typeof row.rule !== "string") return false;
  if (row.must_any !== undefined && !Array.isArray(row.must_any)) return false;
  if (row.must_not !== undefined && !Array.isArray(row.must_not)) return false;
  if (row.must_regex !== undefined && !Array.isArray(row.must_regex)) return false;
  return true;
}

export function notConfiguredMessage(reason: PenNotConfiguredReason): string {
  switch (reason) {
    case "flag_off":
      return "TESSERA_PEN_LOCAL is not 1. The local pen stayed off and did not call a runtime.";
    case "weights_missing":
      return "Local pen weights are missing. Set TESSERA_PEN_LOCAL_WEIGHTS to a local file. Nothing was generated.";
    case "hash_mismatch":
      return "Weights hash does not match TESSERA_PEN_LOCAL_SHA256. Nothing was generated.";
    case "non_loopback":
      return "TESSERA_PEN_LOCAL_URL must be plain http on 127.0.0.1, ::1, or localhost, with no userinfo and no redirect. Nothing was sent.";
    case "runtime_down":
      return "The local pen runtime is not up. Start the loopback server and re-run. No score was produced.";
    case "system_prompt_missing":
      return "Set TESSERA_PEN_LOCAL_SYSTEM_PROMPT to a local system-prompt file. Nothing was generated.";
    case "model_id_missing":
      return "Set TESSERA_PEN_LOCAL_MODEL_ID to the upstream id and revision. The local pen does not invent a backend name. Nothing was generated.";
    default: {
      const neverReason: never = reason;
      return neverReason;
    }
  }
}
