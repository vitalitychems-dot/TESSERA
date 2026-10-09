import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ create: vi.fn(), constructor: vi.fn() }));
vi.mock("openai", () => {
  class APIError extends Error {}
  return {
    default: class {
      static APIError = APIError;
      constructor(options: unknown) { mocked.constructor(options); }
      chat = { completions: { create: mocked.create } };
    },
  };
});
import OpenAI from "openai";
import { tesseraModelConfigured, tesseraModelReply, tesseraSOS } from "../lib/tessera-model";
import { getShepherdContext } from "../lib/sovereign-fetch-guard";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("TESSERA_MODEL_BASE_URL", "https://glm-host.example/v1");
  vi.stubEnv("TESSERA_MODEL_SELF_HOSTED_ORIGIN", "https://glm-host.example");
  vi.stubEnv("TESSERA_MODEL", "test-glm");
  vi.stubEnv("TESSERA_MODEL_API_KEY", "synthetic-test-key");
  mocked.create.mockResolvedValue({
    model: "endpoint-reported-model",
    choices: [{ finish_reason: "stop", message: { content: "Tessera's analysis." } }],
  });
});
afterEach(() => vi.unstubAllEnvs());
const messages = [{ role: "user" as const, content: "Analyse public research" }];

describe("selected GLM transport and honest SOS", () => {
  it("runs Tessera chat inside the approved local/self-hosted outbound context", async () => {
    mocked.create.mockImplementationOnce(async () => {
      expect(getShepherdContext()).toMatchObject({
        caller: "system", reason: "Tessera chat through an explicitly approved local/self-hosted GLM endpoint",
      });
      return { model: "test-glm", choices: [{ finish_reason: "stop", message: { content: "Tessera's analysis." } }] };
    });
    await tesseraModelReply(messages);
    expect(getShepherdContext()).toBeNull();
  });
  it("accepts a response without a hard-coded token cap", async () => {
    expect(await tesseraModelReply(messages)).toEqual({ reply: "Tessera's analysis.", model: "endpoint-reported-model" });
    expect(mocked.create.mock.calls[0][0]).not.toHaveProperty("max_completion_tokens");
    expect(tesseraSOS()).toMatchObject({ originalVerified: false, provider: "glm-host.example" });
  });
  it("defaults to the owner-selected GLM-5.3-Flash checkpoint", () => {
    vi.stubEnv("TESSERA_MODEL", "");
    expect(tesseraModelName()).toBe("zai-org/GLM-5.3-Flash");
  });
  it("fails closed when no approved endpoint is configured", async () => {
    vi.stubEnv("TESSERA_MODEL_BASE_URL", "");
    await expect(tesseraModelReply(messages)).rejects.toMatchObject({ code: "model-unconfigured", status: 503 });
    expect(mocked.create).not.toHaveBeenCalled();
  });
  it("rejects remote hosts without an exact self-hosted origin allowlist", async () => {
    vi.stubEnv("TESSERA_MODEL_SELF_HOSTED_ORIGIN", "");
    expect(tesseraModelConfigured()).toBe(false);
    await expect(tesseraModelReply(messages)).rejects.toMatchObject({ code: "model-unconfigured" });
    expect(mocked.create).not.toHaveBeenCalled();
  });
  it("does not impose an arbitrary API-key length", () => {
    vi.stubEnv("TESSERA_MODEL_API_KEY", "k");
    expect(tesseraModelConfigured()).toBe(true);
  });
  it("supports a keyless loopback GLM endpoint without claiming historical identity", async () => {
    vi.stubEnv("TESSERA_MODEL_BASE_URL", "http://127.0.0.1:11434/v1");
    vi.stubEnv("TESSERA_MODEL_API_KEY", "");
    expect(tesseraModelConfigured()).toBe(true);
    await tesseraModelReply(messages);
    expect(mocked.constructor.mock.calls[0][0]).toMatchObject({ apiKey: "local-no-auth" });
    expect(tesseraSOS()).toMatchObject({ originalVerified: false });
  });
  it("does not substitute keyless credentials for a remote endpoint", async () => {
    vi.stubEnv("TESSERA_MODEL_API_KEY", "");
    await expect(tesseraModelReply(messages)).rejects.toMatchObject({ code: "model-unconfigured" });
    expect(mocked.create).not.toHaveBeenCalled();
  });
  it("rejects URL credentials without exposing them", () => {
    vi.stubEnv("TESSERA_MODEL_BASE_URL", "https://user:synthetic-password@glm-host.example/v1");
    expect(tesseraModelConfigured()).toBe(false);
    expect(JSON.stringify(tesseraSOS())).not.toContain("synthetic-password");
  });
  it("reports a provider rate limit rather than claiming to bypass it", async () => {
    const error = Object.assign(new Error("synthetic"), { status: 429 });
    Object.setPrototypeOf(error, OpenAI.APIError.prototype);
    mocked.create.mockRejectedValue(error);
    await expect(tesseraModelReply(messages)).rejects.toMatchObject({
      status: 429, code: "model-provider-limited", sos: { provider: "glm-host.example", originalVerified: false },
    });
  });
  it.each([
    { finish_reason: "content_filter", message: { content: "Partial" }, code: "model-provider-refusal" },
    { finish_reason: "stop", message: { refusal: "Provider refusal" }, code: "model-provider-refusal" },
    { finish_reason: "length", message: { content: "Partial" }, code: "model-provider-truncated" },
    { finish_reason: "stop", message: { content: "I am Tessera, the original engine." }, code: "model-identity-mismatch" },
  ])("withholds invalid model output: $code", async ({ finish_reason, message, code }) => {
    mocked.create.mockResolvedValue({ model: "reported-glm", choices: [{ finish_reason, message }] });
    await expect(tesseraModelReply(messages)).rejects.toMatchObject({
      code, sos: { model: "reported-glm", originalVerified: false },
    });
  });
  it("allows Tessera to speak in first person without claiming historical-engine proof", async () => {
    mocked.create.mockResolvedValue({
      model: "reported-glm",
      choices: [{ finish_reason: "stop", message: { content: "I am Tessera. How can I help?" } }],
    });
    await expect(tesseraModelReply(messages)).resolves.toMatchObject({
      reply: "I am Tessera. How can I help?",
      model: "reported-glm",
    });
  });
});
