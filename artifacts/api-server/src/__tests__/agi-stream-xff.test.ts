import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createAgiStreamRouter } from "../routes/agi-stream";

const KEY = "test-admin-key-0123456789abcdef";
let prevKey: string | undefined;
beforeAll(() => { prevKey = process.env.TESSERACT_ADMIN_KEY; process.env.TESSERACT_ADMIN_KEY = KEY; });
afterAll(() => { if (prevKey === undefined) delete process.env.TESSERACT_ADMIN_KEY; else process.env.TESSERACT_ADMIN_KEY = prevKey; });

// Mirrors app.ts: app.set("trust proxy", 1) with no proxy actually in front.
async function start(opts: Record<string, unknown>) {
  const app = express();
  app.set("trust proxy", 1);
  app.use("/api", createAgiStreamRouter(opts as never));
  const server: Server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  return { server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/agi/stream` };
}
const open = (url: string, xff: string, ac: AbortController) =>
  fetch(url, { headers: { "x-tesseract-admin-key": KEY, "x-forwarded-for": xff }, signal: ac.signal });

describe("/api/agi/stream per-IP cap vs X-Forwarded-For", () => {
  it("forged XFF from an untrusted peer still counts against the socket IP", async () => {
    const { server, url } = await start({ maxPerIp: 1, maxGlobal: 10 });
    const acs = [new AbortController(), new AbortController(), new AbortController()];
    try {
      const statuses: number[] = [];
      for (const [i, ac] of acs.entries()) statuses.push((await open(url, `203.0.113.${i + 1}`, ac)).status);
      // Pre-fix: [200, 200, 200] (each forged XFF gets its own slot = bypass).
      expect(statuses).toEqual([200, 429, 429]);
    } finally { acs.forEach((a) => a.abort()); server.close(); }
  });
});

describe("/api/agi/stream trusted-proxy handling (post-fix)", () => {
  it("a trusted proxy's XFF is honored: distinct clients get distinct slots, same client is capped", async () => {
    const { server, url } = await start({ maxPerIp: 1, maxGlobal: 10, trustedProxies: ["127.0.0.0/8"] });
    const acs = [new AbortController(), new AbortController(), new AbortController()];
    try {
      expect((await open(url, "198.51.100.7", acs[0])).status).toBe(200);
      expect((await open(url, "198.51.100.8", acs[1])).status).toBe(200);
      expect((await open(url, "198.51.100.7", acs[2])).status).toBe(429);
    } finally { acs.forEach((a) => a.abort()); server.close(); }
  });

  it("streamClientIp: untrusted peer ignores XFF; trusted chain resolves to first untrusted hop", async () => {
    const { streamClientIp, buildTrustedProxyList } = await import("../routes/agi-stream");
    const none = buildTrustedProxyList([]);
    const t = buildTrustedProxyList(["10.0.0.0/8", "192.0.2.1", "bogus", "1.2.3.4/99"]);
    expect(streamClientIp("::ffff:127.0.0.1", "203.0.113.9", none)).toBe("127.0.0.1");
    expect(streamClientIp("192.0.2.1", "203.0.113.9, 10.1.1.1", t)).toBe("203.0.113.9");
    expect(streamClientIp("192.0.2.1", "203.0.113.9, 6.6.6.6", t)).toBe("6.6.6.6");
    expect(streamClientIp("192.0.2.1", "not-an-ip", t)).toBe("192.0.2.1");
    expect(streamClientIp("8.8.8.8", "203.0.113.9", t)).toBe("8.8.8.8");
    expect(streamClientIp(undefined, undefined, none)).toBe("unknown");
  });
});
