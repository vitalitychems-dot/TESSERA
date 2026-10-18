import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";

const ADMIN_KEY = "synthetic-evolution-key";
const WRONG_KEY = "wrong-evolution-token";
const MARKER = "synthetic-evolution-fault-marker";

const faults = vi.hoisted(() => ({
  pause: false,
  resume: false,
  reset: false,
}));

function syntheticFailure(): Error {
  const error = new Error(MARKER);
  error.name = "SyntheticFailure";
  return error;
}

vi.mock("../lib/evolution-throttle", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/evolution-throttle")>();
  return {
    ...actual,
    pauseModule(moduleId: string) {
      if (faults.pause) throw syntheticFailure();
      return actual.pauseModule(moduleId);
    },
    resumeModule(moduleId: string) {
      if (faults.resume) throw syntheticFailure();
      return actual.resumeModule(moduleId);
    },
    resetModuleCooldown(moduleId: string) {
      if (faults.reset) throw syntheticFailure();
      return actual.resetModuleCooldown(moduleId);
    },
  };
});

import { logger } from "../lib/logger";
import { _resetThrottleForTests, getThrottleMetrics } from "../lib/evolution-throttle";
import evolutionHealthRouter from "../routes/evolution-health";

const previousKey = process.env.TESSERACT_ADMIN_KEY;

function restoreKey(): void {
  if (previousKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
  else process.env.TESSERACT_ADMIN_KEY = previousKey;
}

describe("evolution-health pause, resume, and reset", () => {
  let server: Server | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use(evolutionHealthRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    faults.pause = false;
    faults.resume = false;
    faults.reset = false;
    _resetThrottleForTests();
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
  });

  afterAll(async () => {
    _resetThrottleForTests();
    restoreKey();
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function post(path: string, token?: string | null): Promise<Response> {
    const headers = new Headers();
    if (token) headers.set("x-admin-token", token);
    return fetch(`${baseUrl}${path}`, { method: "POST", headers });
  }

  const routes = [
    {
      path: "/evolution-health/pause/mod-a",
      message: "Module mod-a paused",
      error: "evolution-pause-failed",
      log: "evolution pause failed",
      fault: "pause" as const,
    },
    {
      path: "/evolution-health/resume/mod-a",
      message: "Module mod-a resumed",
      error: "evolution-resume-failed",
      log: "evolution resume failed",
      fault: "resume" as const,
    },
    {
      path: "/evolution-health/reset/mod-a",
      message: "Cooldown reset for mod-a",
      error: "evolution-reset-failed",
      log: "evolution reset failed",
      fault: "reset" as const,
    },
  ];

  for (const route of routes) {
    it(`returns 401 for ${route.path} with no key and with the wrong key`, async () => {
      const missing = await post(route.path);
      expect(missing.status).toBe(401);
      await expect(missing.json()).resolves.toEqual({ ok: false, error: "Valid sovereign key required" });

      const wrong = await post(route.path, WRONG_KEY);
      expect(wrong.status).toBe(401);
      await expect(wrong.json()).resolves.toEqual({ ok: false, error: "Valid sovereign key required" });
      expect(getThrottleMetrics().modules).toEqual([]);
    });

    it(`accepts a valid key for ${route.path}`, async () => {
      const response = await post(route.path, ADMIN_KEY);
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ ok: true, message: route.message });
    });

    it(`returns a generic error for ${route.path}`, async () => {
      faults[route.fault] = true;
      const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined as never);
      try {
        const response = await post(route.path, ADMIN_KEY);
        expect(response.status).toBe(500);
        const text = await response.text();
        expect(text).not.toContain(MARKER);
        expect(JSON.parse(text)).toEqual({ ok: false, error: route.error });
        expect(errorSpy).toHaveBeenCalledWith({ name: "SyntheticFailure" }, route.log);
        expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(MARKER);
      } finally {
        errorSpy.mockRestore();
      }
    });
  }

  it("pauses and resumes the named module", async () => {
    const paused = await post("/evolution-health/pause/mod-a", ADMIN_KEY);
    expect(paused.status).toBe(200);
    expect(getThrottleMetrics().modules).toEqual([
      expect.objectContaining({ moduleId: "mod-a.ts", paused: true }),
    ]);

    const resumed = await post("/evolution-health/resume/mod-a", ADMIN_KEY);
    expect(resumed.status).toBe(200);
    expect(getThrottleMetrics().modules).toEqual([
      expect.objectContaining({ moduleId: "mod-a.ts", paused: false }),
    ]);
  });
});
