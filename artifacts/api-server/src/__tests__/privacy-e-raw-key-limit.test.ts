import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { rawKeyFailRateLimit } from "../lib/father-verify-throttle";

function callLimiter(ip: string) {
  const listenersByEvent: Record<string, Array<() => void>> = {};
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
      (listenersByEvent[event] ??= []).push(fn);
      return this;
    },
    emit(event: string) {
      for (const fn of listenersByEvent[event] ?? []) fn();
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
      call.res.emit("finish");
    }
    const afterRefund = callLimiter(ip);
    expect(afterRefund.continued).toBe(true);
    afterRefund.res.statusCode = 200;
    afterRefund.res.emit("finish");
  });

  it("keeps 401 and 403 responses and refunds other statuses", () => {
    const ip = "198.51.100.21";
    for (let i = 0; i < 7; i += 1) {
      const call = callLimiter(ip);
      expect(call.continued).toBe(true);
      call.res.statusCode = 200;
      call.res.emit("finish");
    }

    for (let i = 0; i < 6; i += 1) {
      const call = callLimiter(ip);
      expect(call.continued).toBe(true);
      call.res.statusCode = i === 0 ? 403 : 401;
      call.res.emit("finish");
    }
    const denied = callLimiter(ip);
    expect(denied.continued).toBe(false);
    expect(denied.res.statusCode).toBe(429);
  });

  it("refunds a reserved slot when the response closes without finishing", () => {
    const ip = "198.51.100.22";
    const held = [];
    for (let i = 0; i < 6; i += 1) {
      const call = callLimiter(ip);
      expect(call.continued).toBe(true);
      held.push(call);
    }
    expect(callLimiter(ip).continued).toBe(false);

    held[0].res.statusCode = 200;
    held[0].res.emit("close");
    const released = callLimiter(ip);
    expect(released.continued).toBe(true);

    released.res.statusCode = 401;
    released.res.emit("close");
    expect(callLimiter(ip).continued).toBe(false);
  });
});
