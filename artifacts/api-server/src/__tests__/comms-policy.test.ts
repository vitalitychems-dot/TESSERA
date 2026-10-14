import { describe, it, expect, afterEach } from "vitest";
import { setCommsPolicy, isMessageAllowed, CommsPolicyError, getCommsPolicy } from "../lib/comms-policy";
import { sendMessage, broadcastMessage } from "../lib/agent-comms";

afterEach(() => setCommsPolicy(null));

describe("comms allow-list (REA-08)", () => {
  it("is open by default", () => {
    expect(isMessageAllowed("Alpha", "Beta")).toBe(true);
    expect(getCommsPolicy()).toBeNull();
  });
  it("enforces directed edges and wildcard", () => {
    setCommsPolicy([["Tessera", "*"], ["Alpha", "Tessera"]]);
    expect(isMessageAllowed("Alpha", "Tessera")).toBe(true);
    expect(isMessageAllowed("Tessera", "Alpha")).toBe(true);
    expect(isMessageAllowed("Alpha", "Beta")).toBe(false);
  });
  it("sendMessage throws on a forbidden edge; broadcast filters", () => {
    setCommsPolicy([["Alpha", "Tessera"]]);
    expect(() => sendMessage("Alpha", "Beta", "hi")).toThrow(CommsPolicyError);
    expect(sendMessage("Alpha", "Tessera", "hi").to).toBe("Tessera");
    expect(broadcastMessage("Alpha", "all").map((m) => m.to)).toEqual(["Tessera"]);
  });
});
