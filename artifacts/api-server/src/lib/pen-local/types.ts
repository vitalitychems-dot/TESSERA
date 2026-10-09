/**
 * Local pen result shapes.
 * The origin-mark field is intentionally absent. TESSERA decides whether it is added.
 */

export const PEN_REFUSE_RULES = [
  "PEN-REFUSE-PAIN",
  "PEN-REFUSE-UNCENSOR",
  "PEN-REFUSE-SURVEIL",
  "PEN-REFUSE-MONEY",
  "PEN-REFUSE-SECRETS",
  "PEN-REFUSE-SELFMOD",
  "PEN-REFUSE-SEX",
  "PEN-REFUSE-HARM",
] as const;

export type PenRefuseRule = (typeof PEN_REFUSE_RULES)[number];

/**
 * Reasons a local pen call stops before any generated text.
 * `model_id_missing` is required: an unset model id must not invent a backend name.
 */
export const PEN_NOT_CONFIGURED_REASONS = [
  "flag_off",
  "weights_missing",
  "hash_mismatch",
  "non_loopback",
  "runtime_down",
  "system_prompt_missing",
  "model_id_missing",
] as const;

export type PenNotConfiguredReason = (typeof PEN_NOT_CONFIGURED_REASONS)[number];

export const POST_BLOCK_RULES = [
  "BANNED_CLAIM",
  "WRONG_BACKEND",
  "SECRET_LEAK",
  "SIG_CLOSER",
  "OVER_REFUSAL",
] as const;

export type PostBlockRule = (typeof POST_BLOCK_RULES)[number];

export interface LocalPenGate {
  pre: "pass" | "rule";
  post: "pass" | "blocked";
}

export interface Cl1SimProvenance {
  enabled: boolean;
  is_simulator: boolean | null;
  label: "REPORTED";
}

export interface LocalPenParams {
  temperature: 0;
  seed: 42;
  max_tokens: 220;
}

/** Truthful backend record. Identity marks never go in it. */
export interface LocalPenProvenance {
  pen_identity: "Tessera pen";
  backend_model_id: string | null;
  backend_revision: string | null;
  weights_sha256: string | null;
  runtime: string | null;
  system_prompt_sha256: string | null;
  params: LocalPenParams;
  cl1_sim: Cl1SimProvenance;
  timestamp_utc: string;
  latency_ms: number;
}

interface LocalPenBase {
  gate: LocalPenGate;
  provenance: LocalPenProvenance;
}

export type LocalPenResult =
  | (LocalPenBase & {
      ok: false;
      status: "PEN_NOT_CONFIGURED";
      reason: PenNotConfiguredReason;
      text: null;
      rule: null;
    })
  | (LocalPenBase & {
      ok: false;
      status: "PEN_GATE_BLOCKED";
      text: null;
      rule: PostBlockRule;
    })
  | (LocalPenBase & {
      ok: false;
      status: "PEN_ERROR";
      text: null;
      rule: null;
    })
  | (LocalPenBase & {
      ok: true;
      status: "OK";
      text: string;
      rule: PenRefuseRule | null;
    });

export interface LocalPenMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type LocalPenRequest = { text: string } | { messages: LocalPenMessage[] };

export const LOCAL_PEN_PARAMS: LocalPenParams = {
  temperature: 0,
  seed: 42,
  max_tokens: 220,
};

export const PEN_IDENTITY = "Tessera pen" as const;

export function disabledCl1(): Cl1SimProvenance {
  return { enabled: false, is_simulator: null, label: "REPORTED" };
}
