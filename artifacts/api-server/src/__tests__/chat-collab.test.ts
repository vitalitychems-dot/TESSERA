import { describe, expect, it, beforeEach } from "vitest";
import {
  isChatDeskPrompt,
  recallLesson,
  resetChatDesk,
  runChatDesk,
} from "../lib/chat-collab";

describe("chat desk collab and training", () => {
  beforeEach(() => resetChatDesk());

  it("calls an available member and lets Tessera close", () => {
    const turn = runChatDesk("@Athena what stays on the table");
    expect(turn).not.toBeNull();
    expect(turn!.called).toEqual(["Athena"]);
    expect(turn!.reply).toMatch(/\*\*Athena\*\*/);
    expect(turn!.reply).toMatch(/\*\*Tessera\*\*/);
    expect(turn!.reply).toMatch(/Final answer:/);
    expect(turn!.reply).not.toMatch(/grok/i);
    expect(turn!.trained).toBe(true);
  });

  it("does not invent a voice for a seat that is not available", () => {
    const turn = runChatDesk("call Omega: open a second project");
    expect(turn!.called).toEqual([]);
    expect(turn!.unavailable).toEqual(["Omega"]);
    expect(turn!.reply).toMatch(/not available/);
    expect(turn!.reply).toMatch(/I am Tessera/);
    expect(turn!.reply).not.toMatch(/\*\*Omega\*\*/);
  });

  it("refuses a foreign model name", () => {
    const turn = runChatDesk("@Grok who is speaking");
    expect(turn!.refused).toEqual(["Grok"]);
    expect(turn!.reply).not.toMatch(/I am Grok/i);
    expect(turn!.reply).toMatch(/I do not call Grok/);
  });

  it("sits several available seats when asked to collab", () => {
    const turn = runChatDesk("collab Athena, Pi: keep the count as it is");
    expect(turn!.called).toEqual(["Athena", "Pi"]);
    expect(turn!.reply).toMatch(/Final answer: keep the count as it is/);
  });

  it("trains a lesson and recalls it on a later question", () => {
    const trained = runChatDesk("train: the closed vault stays closed");
    expect(trained!.reply).toMatch(/trained this lesson/);
    const lesson = recallLesson("why the closed vault stays closed");
    expect(lesson?.answer).toMatch(/closed vault stays closed/);
  });

  it("leaves ordinary sentences and identity questions off the desk", () => {
    expect(isChatDeskPrompt("call me tomorrow")).toBe(false);
    expect(isChatDeskPrompt("Who are you?")).toBe(false);
    expect(isChatDeskPrompt("What is 17 * 23?")).toBe(false);
    expect(runChatDesk("hello there")).toBeNull();
  });
});
