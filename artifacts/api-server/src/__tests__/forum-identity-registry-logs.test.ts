import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const ADMIN_KEY = "synthetic-registry-admin-key-1";
const FORUM_TOKEN = "synthetic-registry-forum-token-0";

vi.mock("@workspace/db", () => ({
  db: {
    insert() {
      return {
        values() {
          return {
            onConflictDoNothing() {
              return Promise.resolve();
            },
          };
        },
      };
    },
    select() {
      return {
        from() {
          return Promise.resolve([]);
        },
      };
    },
  },
}));

vi.mock("../lib/lattice-declarations", () => ({
  seedResidentDeclarations: async () => ({ created: 0, existed: 0 }),
}));

import { logger } from "../lib/logger";
import { hashTokenSha256 } from "../lib/mesh-auth";
import { registerAdminPrincipal, seedForumIdentities } from "../lib/forum-identity-registry";

const previousAdminKey = process.env.TESSERACT_ADMIN_KEY;
const previousForumToken = process.env.FORUM_ADMIN_TOKEN;

function restoreEnv(name: "TESSERACT_ADMIN_KEY" | "FORUM_ADMIN_TOKEN", previous: string | undefined): void {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

const adminHash = sha256Hex(ADMIN_KEY);
const tokenHash = sha256Hex(FORUM_TOKEN);

function assertAbsent(haystack: string, needle: string): void {
  expect(needle.length > 0 && haystack.includes(needle)).toBe(false);
}

function assertNoDigestPrefixes(haystack: string, digest: string): void {
  for (let length = 4; length <= digest.length; length += 1) {
    assertAbsent(haystack, digest.slice(0, length));
  }
}

const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

function startCapture(): { text: () => string; restore: () => void } {
  const streams: string[] = [];
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  const stderrWrite = process.stderr.write.bind(process.stderr);
  const record = (chunk: string | Uint8Array) => {
    streams.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
  };
  process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    record(chunk);
    return stdoutWrite(chunk, ...(rest as []));
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
    record(chunk);
    return stderrWrite(chunk, ...(rest as []));
  }) as typeof process.stderr.write;

  const loggerSpies = LOG_LEVELS.map((level) => vi.spyOn(logger, level));
  const consoleSpies = CONSOLE_METHODS.map((method) => vi.spyOn(console, method));

  return {
    text() {
      return [
        JSON.stringify(loggerSpies.map((spy) => spy.mock.calls)),
        JSON.stringify(consoleSpies.map((spy) => spy.mock.calls)),
        streams.join(""),
      ].join("\n");
    },
    restore() {
      for (const spy of loggerSpies) spy.mockRestore();
      for (const spy of consoleSpies) spy.mockRestore();
      process.stdout.write = stdoutWrite;
      process.stderr.write = stderrWrite;
    },
  };
}

describe("forum identity registry logs no key or token hash", () => {
  beforeAll(() => {
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    process.env.FORUM_ADMIN_TOKEN = FORUM_TOKEN;
  });

  afterAll(() => {
    restoreEnv("TESSERACT_ADMIN_KEY", previousAdminKey);
    restoreEnv("FORUM_ADMIN_TOKEN", previousForumToken);
  });

  it("seeds and registers through the real registry without hash prefixes", async () => {
    expect(hashTokenSha256(ADMIN_KEY) === adminHash).toBe(true);
    expect(hashTokenSha256(FORUM_TOKEN) === tokenHash).toBe(true);
    const capture = startCapture();
    try {
      await seedForumIdentities();
      await registerAdminPrincipal(tokenHash, "Father");
      const output = capture.text();
      expect(output.includes("Admin token pre-registered as Father (env-seeded binding)")).toBe(true);
      expect(output.includes("Admin principal registered for forum token")).toBe(true);
      expect(output.includes("\"bound\"")).toBe(true);
      assertAbsent(output, ADMIN_KEY);
      assertAbsent(output, FORUM_TOKEN);
      assertNoDigestPrefixes(output, adminHash);
      assertNoDigestPrefixes(output, tokenHash);
    } finally {
      capture.restore();
    }
  });
});
