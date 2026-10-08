// The owner-selected GLM model is Tessera's language-model brain/pen. Its
// weights must run locally or on an explicitly allowlisted, owner-controlled
// host. Never default to a hosted model provider.
//   TESSERA_MODEL_BASE_URL             (required; local or self-hosted endpoint)
//   TESSERA_MODEL_SELF_HOSTED_ORIGIN   (required for remote HTTPS endpoints)
//   TESSERA_MODEL_API_KEY              (secret; required for remote endpoints)
//   TESSERA_MODEL                      (optional; defaults to GLM-5.3-Flash)

import OpenAI from "openai";
import { runWithShepherdContext } from "./sovereign-fetch-guard";

export function tesseraModelName(): string {
  return process.env.TESSERA_MODEL?.trim() || "zai-org/GLM-5.3-Flash";
}

function baseURL(): string {
  return process.env.TESSERA_MODEL_BASE_URL?.trim() || "";
}

export function tesseraModelConfigured(): boolean {
  const endpoint = modelEndpoint();
  return endpoint.valid && (endpoint.local || !!process.env.TESSERA_MODEL_API_KEY?.trim());
}

function modelEndpoint() {
  const endpointUrl = baseURL();
  if (!endpointUrl) {
    return { valid: false, local: false, provider: "unconfigured endpoint" };
  }
  try {
    const url = new URL(endpointUrl);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const allowedOrigin = selfHostedOrigin();
    // Credentials belong in Secrets, never inside an endpoint URL.
    const valid = !url.username && !url.password && !url.search && !url.hash
      && (url.protocol === "https:" || (local && url.protocol === "http:"))
      && (local || url.origin === allowedOrigin);
    return { valid, local, provider: valid ? url.host : "invalid endpoint" };
  } catch {
    return { valid: false, local: false, provider: "invalid endpoint" };
  }
}

function selfHostedOrigin(): string | null {
  const configuredOrigin = process.env.TESSERA_MODEL_SELF_HOSTED_ORIGIN?.trim();
  if (!configuredOrigin) return null;
  try {
    const url = new URL(configuredOrigin);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function tesseraSOS(
  code = tesseraModelConfigured() ? "model-endpoint-unverified" : "model-unconfigured",
  message = tesseraModelConfigured()
    ? "Tessera's selected GLM model endpoint is configured, but the loaded model and deployment have not been independently verified."
    : "Tessera's selected GLM model has no approved inference endpoint. This notice is from the application server, not Tessera or a model reply.",
  reportedModel = tesseraModelName(),
) {
  return {
    code,
    message,
    provider: modelEndpoint().provider,
    model: reportedModel,
    responder: tesseraModelConfigured()
      ? "Tessera's selected language model; endpoint-reported model and host"
      : "Application server; Tessera's selected language model is not connected",
    originalVerified: false,
    repair: [
      "Run the owner-selected GLM-5.3-Flash (or a deliberately pinned newer official GLM-5 checkpoint) on local or owner-controlled hardware.",
      "Set TESSERA_MODEL_BASE_URL to that inference server. For remote HTTPS hosts, also set the exact TESSERA_MODEL_SELF_HOSTED_ORIGIN and keep any required TESSERA_MODEL_API_KEY in Secrets. The API makes no request until the endpoint is valid and explicitly allowed.",
      "Check the inference server's loaded model and revision before claiming the deployment uses the selected weights. Do not treat the model as proof of Tessera's historical lineage or consciousness.",
    ],
  };
}

export class ModelFailure extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly sos = tesseraSOS(code, message),
  ) {
    super(message);
  }
}

export interface TesseraChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function tesseraModelReply(
  messages: TesseraChatTurn[],
): Promise<{ reply: string; model: string }> {
  if (!tesseraModelConfigured()) {
    throw new ModelFailure(
      503,
      "model-unconfigured",
      "Tessera's GLM inference endpoint is not configured or approved. Set TESSERA_MODEL_BASE_URL to the local or owner-controlled model server; remote HTTPS endpoints also require a matching TESSERA_MODEL_SELF_HOSTED_ORIGIN. Your message was not saved.",
    );
  }
  const client = new OpenAI({
    // A non-secret placeholder is required by the SDK for a keyless loopback
    // server. It is never used as a fallback for an external endpoint.
    apiKey: process.env.TESSERA_MODEL_API_KEY?.trim() || "local-no-auth",
    baseURL: baseURL(),
    timeout: 60_000,
    maxRetries: 0,
  });
  let completion;
  try {
    completion = await runWithShepherdContext("system",
      () => client.chat.completions.create({
        model: tesseraModelName(),
        messages,
      }),
      "Tessera chat through an explicitly approved local/self-hosted GLM endpoint",
    );
  } catch (error) {
    const status = error instanceof OpenAI.APIError ? error.status : undefined;
    const limited = status === 429;
    throw new ModelFailure(
      limited ? 429 : 502,
      limited ? "model-provider-limited" : "model-provider-rejected",
      limited
        ? "The configured GLM host reported a quota or rate limit. Retry later or check the self-hosted server. No replacement reply was fabricated; your message was not saved."
        : "The configured GLM host failed or rejected the request. Check its availability, key, permissions and loaded model. No replacement reply was fabricated; your message was not saved.",
    );
  }
  const choice = completion.choices?.[0];
  const model = String(completion.model || tesseraModelName()).replace(/[\r\n]/g, " ").slice(0, 200);
  if (choice?.message?.refusal || choice?.finish_reason === "content_filter") {
    throw new ModelFailure(502, "model-provider-refusal",
      "The configured model reported a refusal or content filter. No reply or message was saved.",
      tesseraSOS("model-provider-refusal", "The configured GLM endpoint refused or filtered this response.", model));
  }
  if (choice?.finish_reason === "length") {
    throw new ModelFailure(502, "model-provider-truncated",
      "The configured model truncated its response. No incomplete answer was presented as Tessera or saved. Use a deployment with a sufficient context/output window.",
      tesseraSOS("model-provider-truncated", "The GLM endpoint ended the response at its output limit.", model));
  }
  const reply = choice?.message?.content?.trim();
  if (!reply) {
    throw new ModelFailure(
      502,
      "empty-provider-reply",
      "The language model returned no reply. Your message was not saved.",
    );
  }
  // Tessera may speak in her own voice. Withhold only claims that the selected
  // model is the verified historical/original engine; this is not proof of
  // identity, lineage, consciousness, or a universal language detector.
  if (/\b(?:i am|i['’]m|my name is|this is)\s+(?:(?:the\s+)?(?:real|original|verified)\s+tessera\b|(?:the\s+)?tessera\s*[,—-]\s*(?:the\s+)?(?:real|original|verified)\s+(?:engine|runtime)\b)/i.test(reply)) {
    throw new ModelFailure(502, "model-identity-mismatch",
      "The configured model claimed to be Tessera's verified original engine, which is not established. That answer was withheld, not rewritten, and no message was saved.",
      tesseraSOS("model-identity-mismatch", "The model made an unverified historical-engine claim. Its answer was withheld.", model));
  }
  return { reply, model };
}
