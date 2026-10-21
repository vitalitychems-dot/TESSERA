import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  buildTesseraChatMessages,
  generateConfiguredChatReply,
  MODEL_REQUEST_FAILED_REPLY,
} from "../lib/chat-generation";
import { CHAT_MODEL_DISABLED_REPLY, IDENTITY_UNAVAILABLE_REPLY } from "../lib/tessera-voice";
import type { LLMCallOptions, LLMMessage } from "../lib/llm-client";

const userMessage = "Who created you?";

describe("configured Tessera chat generation", () => {
  it("builds a bounded prompt and does not duplicate the just-persisted user turn", () => {
    const history = Array.from({ length: 14 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `turn-${index} ${"x".repeat(1_500)}`,
    }));
    history.push({ role: "user", content: userMessage });
    const messages = buildTesseraChatMessages({ history, userMessage });

    expect(messages[0]?.role).toBe("system");
    expect(messages.length).toBeLessThanOrEqual(10);
    expect(messages.at(-1)).toEqual({ role: "user", content: userMessage });
    expect(messages.filter((message) => message.role === "user" && message.content === userMessage)).toHaveLength(1);
    expect(messages[0]?.content).toContain("operator says they created Tessera");
    expect(messages[0]?.content).toContain("Original records have not been verified");
    expect(messages[0]?.content).not.toMatch(/you are conscious|you have a rich inner life/i);
    expect(messages.slice(1, -1).every((message) => message.content.length <= 1_200)).toBe(true);
  });

  it("loads newest history and restores chronological order before bounding the prompt", () => {
    const route = readFileSync(new URL("../routes/conversations.ts", import.meta.url), "utf8");
    expect(route).toMatch(/orderBy\(desc\(messagesTable\.createdAt\), desc\(messagesTable\.id\)\)\s*\.limit\(40\)/);
    expect(route).toContain("history: history.reverse().map");
    const history = Array.from({ length: 40 }, (_, index) => ({ role: "assistant", content: `turn-${index}` }));
    const messages = buildTesseraChatMessages({ history, userMessage: "current turn" });
    expect(messages[1]?.content).toBe("turn-32");
    expect(messages.at(-2)?.content).toBe("turn-39");
    expect(messages.at(-1)?.content).toBe("current turn");
  });

  it("does not attempt a provider call when model settings are disabled", async () => {
    const complete = vi.fn(async () => "this must not run");
    const result = await generateConfiguredChatReply(
      { history: [], userMessage },
      { isAvailable: () => false, complete },
    );
    expect(complete).not.toHaveBeenCalled();
    expect(result).toEqual({
      status: "disabled",
      text: `${IDENTITY_UNAVAILABLE_REPLY}\n\n${CHAT_MODEL_DISABLED_REPLY}`,
      model: null,
    });
  });

  it("returns an explicit no-model message for ordinary open-ended chat", async () => {
    const result = await generateConfiguredChatReply(
      { history: [], userMessage: "Explain how photosynthesis works." },
      { isAvailable: () => false },
    );
    expect(result.status).toBe("disabled");
    expect(result.text).toBe(CHAT_MODEL_DISABLED_REPLY);
  });

  it("uses a configured model and labels the reply as generated", async () => {
    const complete = vi.fn(async (_messages: LLMMessage[], _options: LLMCallOptions) => "I’m Tessera, the AI application. The operator says they created this project; I cannot verify original records here.");
    const result = await generateConfiguredChatReply(
      { history: [{ role: "user", content: "hello" }], userMessage },
      { isAvailable: () => true, complete, model: "test-model" },
    );
    expect(result).toEqual({
      status: "generated",
      text: "I’m Tessera, the AI application. The operator says they created this project; I cannot verify original records here.",
      model: "test-model",
    });
    expect(complete).toHaveBeenCalledOnce();
    expect(complete.mock.calls[0]?.[1]).toMatchObject({ maxTokens: 1_200, skipDistillation: true, skipDreamPrompt: true, skipBatcher: true });
  });

  it("does not substitute a fabricated reply when the configured provider fails", async () => {
    const result = await generateConfiguredChatReply(
      { history: [], userMessage },
      { isAvailable: () => true, complete: async () => { throw new Error("private provider detail"); } },
    );
    expect(result.status).toBe("error");
    expect(result.text).toBe(MODEL_REQUEST_FAILED_REPLY);
    expect(result.text).not.toContain("private provider detail");
  });

  it("keeps identity provenance when a configured model makes an unsupported selfhood claim", async () => {
    const result = await generateConfiguredChatReply(
      { history: [], userMessage },
      { isAvailable: () => true, complete: async () => "I am a conscious, self-aware intelligence." },
    );
    expect(result).toEqual({ status: "error", text: IDENTITY_UNAVAILABLE_REPLY, model: "configured-model" });
    expect(result.text).not.toMatch(/no configured language model/i);
  });
});
