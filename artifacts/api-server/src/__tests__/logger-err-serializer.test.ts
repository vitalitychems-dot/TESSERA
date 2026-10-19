import { DrizzleQueryError } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { logger } from "../lib/logger";

type WritableStream = { write: (chunk: unknown, ...rest: unknown[]) => unknown };

function loggerDestination(target: object): WritableStream | undefined {
  let current: object | null = target;
  while (current) {
    for (const symbol of Object.getOwnPropertySymbols(current)) {
      const value = (current as Record<symbol, unknown>)[symbol];
      if (
        value
        && typeof value === "object"
        && "write" in value
        && typeof (value as { write?: unknown }).write === "function"
      ) {
        return value as WritableStream;
      }
    }
    current = Object.getPrototypeOf(current) as object | null;
  }
  return undefined;
}

function capture(run: () => void): string {
  const destination = loggerDestination(logger);
  expect(destination === undefined).toBe(false);
  const chunks: string[] = [];
  const originalWrite = destination?.write.bind(destination);
  if (destination && originalWrite) {
    destination.write = (chunk: unknown, ...rest: unknown[]) => {
      chunks.push(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8"));
      return originalWrite(chunk, ...rest);
    };
  }
  try {
    run();
  } finally {
    if (destination && originalWrite) destination.write = originalWrite;
  }
  return chunks.join("");
}

describe("pino err serializer", () => {
  it("writes name and code and drops message and stack", () => {
    const marker = "synthetic-log-fault-marker";
    const stackMarker = "synthetic-stack-frame";
    const err = new Error(marker);
    err.stack = `${stackMarker}\n${err.stack ?? ""}`;
    (err as { code?: string }).code = "EACCES";
    const cause = new Error("synthetic-inner-query-text");
    (cause as { code?: string }).code = "23505";
    const wrapped = new Error("synthetic-outer-log-fault");
    wrapped.stack = `synthetic-outer-stack\n${wrapped.stack ?? ""}`;
    (wrapped as { cause?: unknown }).cause = cause;

    const queryMarker = "synthetic-wrapped-query-text";
    const wrappedQuery = new DrizzleQueryError(queryMarker, [], cause);

    const output = capture(() => {
      logger.error({ err }, "serializer probe");
      logger.error({ err: wrapped }, "cause probe");
      logger.error({ err: marker }, "string probe");
      logger.error({ err: wrappedQuery }, "wrapped query probe");
      logger.error(
        { err: { name: "DrizzleQueryError", code: "23505", message: "Failed query: synthetic" } },
        "shaped probe",
      );
    });

    expect(output.includes('"name":"Error"')).toBe(true);
    expect(output.includes('"code":"EACCES"')).toBe(true);
    expect(output.includes('"name":"DrizzleQueryError"')).toBe(true);
    expect(output.includes('"code":"23505"')).toBe(true);
    expect(output.includes(marker)).toBe(false);
    expect(output.includes(stackMarker)).toBe(false);
    expect(output.includes("synthetic-outer-log-fault")).toBe(false);
    expect(output.includes("synthetic-outer-stack")).toBe(false);
    expect(output.includes("synthetic-inner-query-text")).toBe(false);
    expect(output.includes("Failed query")).toBe(false);
    expect(output.includes(queryMarker)).toBe(false);
  });
});
