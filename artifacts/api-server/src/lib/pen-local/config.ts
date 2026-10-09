import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { classifyLoopbackUrl, DEFAULT_LOCAL_PEN_URL } from "./loopback";
import type { PenNotConfiguredReason } from "./types";
import { pinMatches, sha256File } from "./weights";

export const DEFAULT_TIMEOUT_MS = 30_000;
export const DEFAULT_RUNTIME = "llama.cpp";

export interface PreparedPen {
  weightsPath: string;
  weightsSha256: string;
  modelId: string;
  revision: string | null;
  runtime: string;
  url: URL;
  timeoutMs: number;
  systemPrompt: string;
  systemPromptSha256: string;
  cl1Sim: boolean;
}

export type PrepareResult =
  | { ok: true; config: PreparedPen }
  | { ok: false; reason: PenNotConfiguredReason };

export function isLocalPenFlagOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.TESSERA_PEN_LOCAL ?? "0").trim() === "1";
}

export function isCl1SimFlagOn(env: NodeJS.ProcessEnv = process.env): boolean {
  return (env.TESSERA_PEN_CL1_SIM ?? "0").trim() === "1";
}

export async function prepareLocalPen(env: NodeJS.ProcessEnv = process.env): Promise<PrepareResult> {
  if (!isLocalPenFlagOn(env)) return { ok: false, reason: "flag_off" };

  const rawUrl = env.TESSERA_PEN_LOCAL_URL?.trim() || DEFAULT_LOCAL_PEN_URL;
  const classified = classifyLoopbackUrl(rawUrl);
  if (!classified.ok) return { ok: false, reason: "non_loopback" };

  const modelPin = env.TESSERA_PEN_LOCAL_MODEL_ID?.trim() ?? "";
  if (modelPin.length === 0) return { ok: false, reason: "model_id_missing" };
  const parsed = parseModelPin(modelPin);

  const weightsPath = env.TESSERA_PEN_LOCAL_WEIGHTS?.trim() ?? "";
  if (!(await isWeightsFile(weightsPath))) return { ok: false, reason: "weights_missing" };

  const promptPath = env.TESSERA_PEN_LOCAL_SYSTEM_PROMPT?.trim() ?? "";
  const promptFile = await readPromptFile(promptPath);
  if (promptFile === null) return { ok: false, reason: "system_prompt_missing" };
  const systemPrompt = promptFile.toString("utf8");
  if (systemPrompt.trim().length === 0) return { ok: false, reason: "system_prompt_missing" };

  const pin = env.TESSERA_PEN_LOCAL_SHA256?.trim() ?? "";
  if (pin.length === 0) return { ok: false, reason: "hash_mismatch" };
  let digest: string;
  try {
    digest = await sha256File(weightsPath);
  } catch {
    return { ok: false, reason: "weights_missing" };
  }
  if (!pinMatches(digest, pin)) return { ok: false, reason: "hash_mismatch" };

  const runtime = env.TESSERA_PEN_LOCAL_RUNTIME?.trim() || DEFAULT_RUNTIME;
  return {
    ok: true,
    config: {
      weightsPath,
      weightsSha256: digest,
      modelId: parsed.id,
      revision: parsed.revision,
      runtime,
      url: classified.url,
      timeoutMs: readTimeout(env.TESSERA_PEN_LOCAL_TIMEOUT_MS),
      systemPrompt,
      systemPromptSha256: createHash("sha256").update(promptFile).digest("hex"),
      cl1Sim: isCl1SimFlagOn(env),
    },
  };
}

function parseModelPin(raw: string): { id: string; revision: string | null } {
  const at = raw.lastIndexOf("@");
  if (at <= 0) return { id: raw, revision: null };
  const id = raw.slice(0, at).trim();
  const revision = raw.slice(at + 1).trim();
  if (id.length === 0) return { id: raw, revision: null };
  return { id, revision: revision.length > 0 ? revision : null };
}

function readTimeout(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return DEFAULT_TIMEOUT_MS;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
  return value;
}

async function isWeightsFile(filePath: string): Promise<boolean> {
  if (filePath.length === 0) return false;
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function readPromptFile(filePath: string): Promise<Buffer | null> {
  if (filePath.length === 0) return null;
  try {
    return await readFile(filePath);
  } catch {
    return null;
  }
}
