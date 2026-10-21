import { describe, expect, it, beforeEach } from "vitest";
import {
  isChatDeskPrompt,
  recallLesson,
  resetChatDesk,
  runChatDesk,
} from "../lib/chat-collab";

describe("chat desk collab and training", () => {
  beforeEach(() => resetChatDesk());

  it("selects a local role template without claiming a live agent call", () => {
    const turn = runChatDesk("@Athena what stays on the table");
    expect(turn).not.toBeNull();
    expect(turn!.called).toEqual(["Athena"]);
    expect(turn!.reply).toMatch(/\*\*Athena\*\*/);
    expect(turn!.reply).toMatch(/\*\*Tessera\*\*/);
    expect(turn!.reply).toMatch(/local planning template, not a live agent call/i);
    expect(turn!.reply).toMatch(/No independent model\/provider was contacted/i);
    expect(turn!.agents).toEqual([{ id: "tessera", name: "Tessera" }]);
    expect(turn!.reply).not.toMatch(/grok/i);
    expect(turn!.trained).toBe(true);
  });

  it("does not invent a voice for a seat that is not available", () => {
    const turn = runChatDesk("call Omega: open a second project");
    expect(turn!.called).toEqual([]);
    expect(turn!.unavailable).toEqual(["Omega"]);
    expect(turn!.reply).toMatch(/role labels not available/i);
    expect(turn!.reply).toMatch(/local planning template, not a live agent call/i);
    expect(turn!.reply).not.toMatch(/\*\*Omega\*\*/);
  });

  it("refuses a foreign model name", () => {
    const turn = runChatDesk("@Grok who is speaking");
    expect(turn!.refused).toEqual(["Grok"]);
    expect(turn!.reply).not.toMatch(/I am Grok/i);
    expect(turn!.reply).toMatch(/Refused external model names: Grok/);
    expect(turn!.reply).toMatch(/No independent model\/provider was contacted/i);
  });

  it("sits several available seats when asked to collab", () => {
    const turn = runChatDesk("collab Athena, Pi: keep the count as it is");
    expect(turn!.called).toEqual(["Athena", "Pi"]);
    expect(turn!.reply).toMatch(/Selected role labels: Athena, Pi/);
    expect(turn!.reply).toMatch(/Prompt: "keep the count as it is"/);
  });

  it("trains a lesson and recalls it on a later question", () => {
    const trained = runChatDesk("train: the closed vault stays closed");
    expect(trained!.reply).toMatch(/saved this lesson in the running server's in-memory desk/i);
    expect(trained!.reply).toMatch(/not model training/i);
    const lesson = recallLesson("why the closed vault stays closed");
    expect(lesson?.answer).toMatch(/closed vault stays closed/);
  });

  it("gives Tessera's final answer when asked", () => {
    const standing = runChatDesk("Tessera give final answer");
    expect(standing!.reply).toMatch(/No final answer has been saved/);
    expect(standing!.reply).toMatch(/No local Pen model is configured/);
    expect(standing!.called).toEqual([]);
    runChatDesk("train: the closed vault stays closed");
    const held = runChatDesk("give the final answer");
    expect(held!.reply).toMatch(/running server's in-memory desk/i);
    expect(held!.reply).toMatch(/not model training/i);
    expect(held!.reply).toMatch(/closed vault stays closed/);
    expect(held!.reply).not.toMatch(/\*\*Athena\*\*/);
  });

  it("puts Tessera's close ahead of the seats", () => {
    const turn = runChatDesk("@Athena what stays on the table")!;
    expect(turn.reply.indexOf("**Tessera**")).toBeLessThan(turn.reply.indexOf("**Athena**"));
  });

  it("leaves ordinary sentences and identity questions off the desk", () => {
    expect(isChatDeskPrompt("call me tomorrow")).toBe(false);
    expect(isChatDeskPrompt("Who are you?")).toBe(false);
    expect(isChatDeskPrompt("What is 17 * 23?")).toBe(false);
    expect(runChatDesk("hello there")).toBeNull();
  });
});
