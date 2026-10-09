import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { rawKeyFailRateLimit } from "../lib/father-verify-throttle";

function callLimiter(ip: string) {
  const listeners: Array<() => void> = [];
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    setHeader() {
      return;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    on(event: string, fn: () => void) {
      if (event === "finish") listeners.push(fn);
      return this;
    },
    finish() {
      for (const fn of listeners) fn();
    },
  };
  let continued = false;
  rawKeyFailRateLimit(
    { ip, socket: {} } as Request,
    res as unknown as Response,
    () => {
      continued = true;
    },
  );
  return { res, continued };
}

describe("raw key fail limiter reserve", () => {
  it("blocks a seventh overlapping attempt before any response finishes", () => {
    const ip = "198.51.100.20";
    const held = [];
    for (let i = 0; i < 6; i += 1) {
      const call = callLimiter(ip);
      expect(call.continued).toBe(true);
      held.push(call);
    }
    const blocked = callLimiter(ip);
    expect(blocked.continued).toBe(false);
    expect(blocked.res.statusCode).toBe(429);

    for (const call of held) {
      call.res.statusCode = 200;
      call.res.finish();
    }
    const afterRefund = callLimiter(ip);
    expect(afterRefund.continued).toBe(true);
    afterRefund.res.statusCode = 200;
    afterRefund.res.finish();
  });

  it("keeps 401 and 403 responses and refunds other statuses", () => {
    const ip = "198.51.100.21";
    for (let i = 0; i < 7; i += 1) {
      const call = callLimiter(ip);
      expect(call.continued).toBe(true);
      call.res.statusCode = 200;
      call.res.finish();
    }

    for (let i = 0; i < 6; i += 1) {
      const call = callLimiter(ip);
      expect(call.continued).toBe(true);
      call.res.statusCode = i === 0 ? 403 : 401;
      call.res.finish();
    }
    const denied = callLimiter(ip);
    expect(denied.continued).toBe(false);
    expect(denied.res.statusCode).toBe(429);
  });
});
