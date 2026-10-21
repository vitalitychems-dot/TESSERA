import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Response } from "express";
import { requireAdminSession, type AdminRequest } from "../lib/sovereign-admin";
import { logger } from "../lib/logger";

const ADMIN_KEY = "synthetic-log-admin-key";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const previousAdminKey = process.env.TESSERACT_ADMIN_KEY;

afterEach(() => {
  if (previousAdminKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
  else process.env.TESSERACT_ADMIN_KEY = previousAdminKey;
});

describe("admin session denial log", () => {
  it("logs the route name when a session is denied", () => {
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    const hash = sha256Hex(ADMIN_KEY);
    const path = `/api/mesh/sessions/${hash}`;
    const warn = vi.spyOn(logger, "warn");
    const status = vi.fn().mockReturnThis();
    const json = vi.fn();
      const req = { path, query: {}, headers: {}, header: () => undefined } as unknown as AdminRequest;
    const res = { status, json } as unknown as Response;
    const next = vi.fn() as unknown as NextFunction;
    try {
      requireAdminSession(req, res, next);
      const output = JSON.stringify(warn.mock.calls);
      expect(output.includes("admin-session denied")).toBe(true);
      expect(output.includes("\"route\":\"admin-session\"")).toBe(false);
      expect(output.includes("\"reason\":\"no-cookie\"")).toBe(true);
      expect(output.includes(path)).toBe(false);
      expect(output.includes(hash)).toBe(false);
      expect(output.includes(ADMIN_KEY)).toBe(false);
      for (let length = 4; length <= hash.length; length += 1) {
        expect(output.includes(hash.slice(0, length))).toBe(false);
      }
      expect(status).toHaveBeenCalledWith(401);
      expect(next).toHaveBeenCalledTimes(0);
    } finally {
      warn.mockRestore();
    }
  });
});
