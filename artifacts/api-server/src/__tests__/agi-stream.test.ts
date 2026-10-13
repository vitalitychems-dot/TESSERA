import { describe, it, expect } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import { publish } from "../lib/agi/agent-bus";
import { broadcastWinner } from "../lib/agi/global-workspace";
import streamRouter from "../routes/agi-stream";

describe("SSE /api/agi/stream (#7)", () => {
  it("delivers exactly one event per broadcast", async () => {
    const app = express();
    app.use("/api", streamRouter);
    const server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    const { port } = server.address() as AddressInfo;
    const ac = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/api/agi/stream`, { signal: ac.signal });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let buf = "";
    await reader.read(); // ": connected" comment => listener is subscribed
    const winners: string[] = [];
    for (let i = 0; i < 3; i++) {
      publish("sse", `sse-${i}-${Date.now()}`, { v: `stream event number ${i}` }, 100);
      const w = broadcastWinner();
      if (w) winners.push(w.id);
    }
    const deadline = Date.now() + 3000;
    while ((buf.match(/^event: workspace$/gm) ?? []).length < winners.length && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value);
    }
    ac.abort();
    server.close();
    const ids = [...buf.matchAll(/^id: (.+)$/gm)].map((m) => m[1]);
    expect(winners.length).toBe(3);
    expect(ids).toEqual(winners);
  });
});
