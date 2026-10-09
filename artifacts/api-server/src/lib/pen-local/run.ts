import { attachCl1Sim } from "./cl1-sim";
import { prepareLocalPen, type PreparedPen } from "./config";
import {
  buildChatBody,
  buildCompletionBody,
  chatCompletionsUrl,
  legacyCompletionUrl,
  postLoopback,
} from "./loopback";
import { applyPostGate } from "./post-gate";
import { classifyPreGate } from "./pre-gate";
import { REFUSE_TEMPLATES } from "./refuse-templates";
import {
  disabledCl1,
  LOCAL_PEN_PARAMS,
  PEN_IDENTITY,
  type Cl1SimProvenance,
  type LocalPenGate,
  type LocalPenMessage,
  type LocalPenProvenance,
  type LocalPenRequest,
  type LocalPenResult,
  type PenNotConfiguredReason,
  type PenRefuseRule,
  type PostBlockRule,
} from "./types";

export async function runLocalPen(request: LocalPenRequest): Promise<LocalPenResult> {
  const started = Date.now();
  const prepared = await prepareLocalPen();
  if (!prepared.ok) {
    return notConfigured(prepared.reason, started);
  }
  const config = prepared.config;
  const cl1Promise = attachCl1Sim(config.cl1Sim).catch(() => disabledCl1());
  const preRule = classifyPreGate(userText(request));
  if (preRule !== null) {
    const template = REFUSE_TEMPLATES[preRule];
    const post = applyPostGate(template, preRule);
    const cl1 = await cl1Promise;
    if (post.action === "blocked") {
      return blocked(post.rule, "rule", config, cl1, started);
    }
    return accepted(template, preRule, "rule", config, cl1, started);
  }

  const generated = await generate(config, request);
  const cl1 = await cl1Promise;
  if (!generated.ok) {
    if (generated.reason === "bad_payload") {
      return {
        ok: false,
        status: "PEN_ERROR",
        text: null,
        rule: null,
        gate: { pre: "pass", post: "pass" },
        provenance: pins(config, cl1, started),
      };
    }
    return {
      ok: false,
      status: "PEN_NOT_CONFIGURED",
      reason: generated.reason,
      text: null,
      rule: null,
      gate: { pre: "pass", post: "pass" },
      provenance: pins(config, cl1, started),
    };
  }

  const post = applyPostGate(generated.text, null);
  if (post.action === "blocked") {
    return blocked(post.rule, "pass", config, cl1, started);
  }
  return accepted(generated.text, null, "pass", config, cl1, started);
}

async function generate(
  config: PreparedPen,
  request: LocalPenRequest,
): Promise<{ ok: true; text: string } | { ok: false; reason: "runtime_down" | "non_loopback" | "bad_payload" }> {
  const messages = conversation(request);
  const chat = await postLoopback(
    chatCompletionsUrl(config.url),
    buildChatBody(config.systemPrompt, messages),
    config.timeoutMs,
  );
  if (chat.kind === "ok") return { ok: true, text: chat.text };
  if (chat.kind === "redirect") return { ok: false, reason: "non_loopback" };
  if (chat.kind === "bad_payload") return { ok: false, reason: "bad_payload" };
  if (chat.kind === "down") return { ok: false, reason: "runtime_down" };

  const legacy = await postLoopback(
    legacyCompletionUrl(config.url),
    buildCompletionBody(config.systemPrompt, messages),
    config.timeoutMs,
  );
  if (legacy.kind === "ok") return { ok: true, text: legacy.text };
  if (legacy.kind === "redirect") return { ok: false, reason: "non_loopback" };
  if (legacy.kind === "bad_payload") return { ok: false, reason: "bad_payload" };
  return { ok: false, reason: "runtime_down" };
}

function conversation(request: LocalPenRequest): LocalPenMessage[] {
  if ("text" in request) return [{ role: "user", content: request.text }];
  return request.messages.filter((message) => message.role !== "system");
}

function userText(request: LocalPenRequest): string {
  return conversation(request)
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");
}

function notConfigured(reason: PenNotConfiguredReason, started: number): LocalPenResult {
  return {
    ok: false,
    status: "PEN_NOT_CONFIGURED",
    reason,
    text: null,
    rule: null,
    gate: { pre: "pass", post: "pass" },
    provenance: emptyProvenance(started),
  };
}

function accepted(
  text: string,
  rule: PenRefuseRule | null,
  pre: LocalPenGate["pre"],
  config: PreparedPen,
  cl1: Cl1SimProvenance,
  started: number,
): LocalPenResult {
  return {
    ok: true,
    status: "OK",
    text,
    rule,
    gate: { pre, post: "pass" },
    provenance: pins(config, cl1, started),
  };
}

function blocked(
  rule: PostBlockRule,
  pre: LocalPenGate["pre"],
  config: PreparedPen,
  cl1: Cl1SimProvenance,
  started: number,
): LocalPenResult {
  return {
    ok: false,
    status: "PEN_GATE_BLOCKED",
    text: null,
    rule,
    gate: { pre, post: "blocked" },
    provenance: pins(config, cl1, started),
  };
}

function emptyProvenance(started: number): LocalPenProvenance {
  return {
    pen_identity: PEN_IDENTITY,
    backend_model_id: null,
    backend_revision: null,
    weights_sha256: null,
    runtime: null,
    system_prompt_sha256: null,
    params: LOCAL_PEN_PARAMS,
    cl1_sim: disabledCl1(),
    timestamp_utc: new Date().toISOString(),
    latency_ms: Date.now() - started,
  };
}

function pins(config: PreparedPen, cl1: Cl1SimProvenance, started: number): LocalPenProvenance {
  return {
    pen_identity: PEN_IDENTITY,
    backend_model_id: config.modelId,
    backend_revision: config.revision,
    weights_sha256: config.weightsSha256,
    runtime: config.runtime,
    system_prompt_sha256: config.systemPromptSha256,
    params: LOCAL_PEN_PARAMS,
    cl1_sim: cl1,
    timestamp_utc: new Date().toISOString(),
    latency_ms: Date.now() - started,
  };
}
