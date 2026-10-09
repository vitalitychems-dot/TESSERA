import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  COLONIAL_SECRET_MIN_LENGTH,
  COLONIAL_SECRET_NOT_CONFIGURED,
  ColonialSecretNotConfiguredError,
  colonialSecretUnavailableBody,
  isColonialSecretConfigured,
} from "../lib/colonial-master-secret";
import {
  decryptPairMessage,
  decryptWithRotatingCipher,
  encryptPairMessage,
  encryptWithRotatingCipher,
  getCipherSystemStatus,
  stopAutonomousRotation,
} from "../lib/sovereign-cipher";
import {
  forceRotateAllBands,
  getAllBands,
  getBandStatus,
  stopBandRotationScheduler,
} from "../lib/lattice-frequency-bands";
import { deriveKey } from "../lib/colonial-language-kernel";
import { sovereignBinaryPipeline, sovereignBinaryDecrypt } from "../lib/sovereign-kernel";
import colonialLanguageRouter from "../routes/colonial-language";
import sovereignLanguageRouter from "../routes/sovereign-language";
import universeRouter from "../routes/universe";

vi.mock("@workspace/db", () => ({
  db: {},
}));

const AT_MINIMUM = "synthetic-colonial-secret-32xxxx";
const OTHER_SECRET = "synthetic-colonial-secret-32yyyy";
const TOO_SHORT = "synthetic-colonial-secret-short";
const FALLBACK_LITERAL_LENGTH = 47;
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "archive",
  "archives",
  "data",
  "ingest",
  "Zz",
]);

async function withColonialSecret<T>(value: string | undefined, run: () => Promise<T> | T): Promise<T> {
  const had = Object.prototype.hasOwnProperty.call(process.env, "COLONIAL_MASTER_SECRET");
  const previous = process.env.COLONIAL_MASTER_SECRET;
  try {
    if (value === undefined) delete process.env.COLONIAL_MASTER_SECRET;
    else process.env.COLONIAL_MASTER_SECRET = value;
    return await run();
  } finally {
    if (had) process.env.COLONIAL_MASTER_SECRET = previous;
    else delete process.env.COLONIAL_MASTER_SECRET;
  }
}

function expectNotConfigured(run: () => void): void {
  try {
    run();
    throw new Error("expected colonial-secret-not-configured");
  } catch (err) {
    expect(err).toBeInstanceOf(ColonialSecretNotConfiguredError);
    expect((err as Error).message).toBe(COLONIAL_SECRET_NOT_CONFIGURED);
    expect((err as ColonialSecretNotConfiguredError).code).toBe(COLONIAL_SECRET_NOT_CONFIGURED);
  }
}

function sourceHasEnvFallbackLiteral(source: string): boolean {
  const marker = "process.env.COLONIAL_MASTER_SECRET";
  let from = 0;
  while (from < source.length) {
    const idx = source.indexOf(marker, from);
    if (idx === -1) return false;
    const window = source.slice(idx, idx + 500);
    const literal = /["']([^"'\\\n]{47})["']/;
    if (literal.test(window)) return true;
    from = idx + marker.length;
  }
  return false;
}

function hasQuotedLiteralOfLength(source: string, length: number): boolean {
  for (const match of source.matchAll(/["']([^"'\\\n]*)["']/g)) {
    if (match[1]?.length === length) return true;
  }
  return false;
}

function walkSource(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walkSource(path, out);
    else if (/\.(?:ts|tsx|js|mjs|md|example)$/.test(name)) out.push(path);
  }
  return out;
}

describe("colonial master secret fail closed", () => {
  let server: Server | undefined;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api", colonialLanguageRouter);
    app.use("/api", sovereignLanguageRouter);
    app.use("/api", universeRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    stopAutonomousRotation();
    stopBandRotationScheduler();
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("uses a 32 character minimum", () => {
    expect(COLONIAL_SECRET_MIN_LENGTH).toBe(32);
    expect(AT_MINIMUM.length).toBeGreaterThanOrEqual(COLONIAL_SECRET_MIN_LENGTH);
    expect(OTHER_SECRET.length).toBeGreaterThanOrEqual(COLONIAL_SECRET_MIN_LENGTH);
    expect(TOO_SHORT.length).toBeLessThan(COLONIAL_SECRET_MIN_LENGTH);
  });

  it("reports not configured when unset and does not throw from module load", async () => {
    await withColonialSecret(undefined, () => {
      expect(isColonialSecretConfigured()).toBe(false);
      expect(getCipherSystemStatus().configured).toBe(false);
      expectNotConfigured(() => encryptWithRotatingCipher("payload", "agent-a"));
      expectNotConfigured(() => decryptWithRotatingCipher("aaaa", "agent-a"));
      expectNotConfigured(() => encryptPairMessage("payload", "agent-a", "agent-b"));
      expectNotConfigured(() => getBandStatus());
      expectNotConfigured(() => getAllBands());
      expectNotConfigured(() => forceRotateAllBands());
      expectNotConfigured(() => deriveKey("unit"));
      expectNotConfigured(() => sovereignBinaryPipeline(Buffer.from("payload")));
    });
  });

  it("reports not configured when the secret is empty or shorter than the minimum", async () => {
    for (const value of ["", TOO_SHORT]) {
      await withColonialSecret(value, () => {
        expect(isColonialSecretConfigured()).toBe(false);
        expectNotConfigured(() => encryptWithRotatingCipher("payload", "agent-a"));
        expectNotConfigured(() => getAllBands());
        expectNotConfigured(() => deriveKey("unit"));
      });
    }
  });

  it("does not let NODE_ENV or another flag bypass a missing secret", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const hadBypass = Object.prototype.hasOwnProperty.call(process.env, "TESSERA_ENABLE_COLONIAL_FALLBACK");
    const previousBypass = process.env.TESSERA_ENABLE_COLONIAL_FALLBACK;
    try {
      process.env.TESSERA_ENABLE_COLONIAL_FALLBACK = "1";
      for (const nodeEnv of ["development", "production", "test"]) {
        process.env.NODE_ENV = nodeEnv;
        await withColonialSecret(undefined, () => {
          expect(isColonialSecretConfigured()).toBe(false);
          expectNotConfigured(() => encryptWithRotatingCipher("payload", "agent-a"));
          expectNotConfigured(() => getBandStatus());
        });
      }
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (hadBypass) process.env.TESSERA_ENABLE_COLONIAL_FALLBACK = previousBypass;
      else delete process.env.TESSERA_ENABLE_COLONIAL_FALLBACK;
    }
  });

  it("encrypts and derives band keys from a synthetic secret at the minimum length", async () => {
    const plaintext = "synthetic-payload";
    await withColonialSecret(AT_MINIMUM, () => {
      expect(isColonialSecretConfigured()).toBe(true);
      const encrypted = encryptWithRotatingCipher(plaintext, "agent-a");
      const decrypted = decryptWithRotatingCipher(encrypted.ciphertext, "agent-a");
      expect(decrypted.plaintext).toBe(plaintext);
      const pair = encryptPairMessage(plaintext, "agent-a", "agent-b");
      expect(decryptPairMessage(pair.ciphertext, "agent-a", "agent-b").plaintext).toBe(plaintext);
      const bands = getAllBands();
      expect(bands).toHaveLength(5);
      expect(bands.every((band) => band.cipherKey.length > 0)).toBe(true);
      expect(getBandStatus().bands).toHaveLength(5);
      expect(deriveKey("unit")).toHaveLength(32);
      const piped = sovereignBinaryPipeline(Buffer.from(plaintext));
      expect(sovereignBinaryDecrypt(piped.data, piped.keyId).toString("utf8")).toBe(plaintext);
      expect(getCipherSystemStatus().configured).toBe(true);
    });
  });

  it("derives different band keys for different synthetic secrets", async () => {
    const keyFor = (secret: string) =>
      withColonialSecret(secret, () => getAllBands()[0]?.cipherKey);
    expect(await keyFor(AT_MINIMUM)).not.toBe(await keyFor(OTHER_SECRET));
  });

  it("returns 503 with a generic body from routes that need the secret", async () => {
    const cases = [
      { method: "POST", path: "/api/sovereign-language/cipher/encrypt", body: { text: "payload", agentId: "agent-a" } },
      { method: "POST", path: "/api/sovereign-language/cipher/pair-encrypt", body: { text: "payload", senderAgent: "agent-a", receiverAgent: "agent-b" } },
      { method: "POST", path: "/api/sovereign-language/encrypt", body: { text: "payload" } },
      { method: "GET", path: "/api/sovereign-language/cipher/status" },
      { method: "GET", path: "/api/sovereignty/colonial-language/lattice-frequencies" },
      { method: "GET", path: "/api/sovereignty/colonial-language/status" },
      { method: "POST", path: "/api/sovereignty/colonial-language/rotate" },
      { method: "POST", path: "/api/colonel/compress-encrypt", body: { text: "payload" } },
      { method: "POST", path: "/api/universe/compression-lab/compress", body: { rawBase64: Buffer.from("payload").toString("base64") } },
      { method: "POST", path: "/api/universe/compression-lab/round-trip", body: { rawBase64: Buffer.from("payload").toString("base64") } },
    ];
    for (const secret of [undefined, TOO_SHORT] as const) {
    await withColonialSecret(secret, async () => {
      for (const item of cases) {
        const response = await fetch(`${baseUrl}${item.path}`, {
          method: item.method,
          headers: item.body ? { "content-type": "application/json" } : undefined,
          body: item.body ? JSON.stringify(item.body) : undefined,
        });
        const json: unknown = await response.json();
        expect(response.status, item.path).toBe(503);
        expect(json, item.path).toEqual(colonialSecretUnavailableBody());
        const serialized = JSON.stringify(json);
        expect(serialized.includes(TOO_SHORT), item.path).toBe(false);
        expect(serialized.includes("length"), item.path).toBe(false);
      }
    });
    }
  });

  it("serves cipher encrypt when a synthetic secret is configured", async () => {
    await withColonialSecret(AT_MINIMUM, async () => {
      const response = await fetch(`${baseUrl}/api/sovereign-language/cipher/encrypt`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "synthetic-payload", agentId: "agent-a" }),
      });
      const json: unknown = await response.json();
      expect(response.status).toBe(200);
      expect(JSON.stringify(json).includes(AT_MINIMUM)).toBe(false);
    });
  });

  it("finds no hardcoded env fallback literal in the cipher and frequency band sources", () => {
    const cipherPath = join(REPO_ROOT, "artifacts/api-server/src/lib/sovereign-cipher.ts");
    const bandsPath = join(REPO_ROOT, "artifacts/api-server/src/lib/lattice-frequency-bands.ts");
    const cipher = readFileSync(cipherPath, "utf8");
    const bands = readFileSync(bandsPath, "utf8");
    expect(sourceHasEnvFallbackLiteral(cipher)).toBe(false);
    expect(sourceHasEnvFallbackLiteral(bands)).toBe(false);
    expect(hasQuotedLiteralOfLength(cipher, FALLBACK_LITERAL_LENGTH)).toBe(false);
    expect(hasQuotedLiteralOfLength(bands, FALLBACK_LITERAL_LENGTH)).toBe(false);

    const sample = [
      "const master = process.env.COLONIAL_MASTER_SECRET",
      "  ? Buffer.from(process.env.COLONIAL_MASTER_SECRET, \"utf8\")",
      `  : Buffer.from("${"a".repeat(FALLBACK_LITERAL_LENGTH)}", "utf8");`,
    ].join("\n");
    expect(sourceHasEnvFallbackLiteral(sample)).toBe(true);
    expect(sourceHasEnvFallbackLiteral("const value = process.env.COLONIAL_MASTER_SECRET;")).toBe(false);

    const offenders: string[] = [];
    for (const file of walkSource(REPO_ROOT)) {
      const text = readFileSync(file, "utf8");
      if (!text.includes("COLONIAL_MASTER_SECRET")) continue;
      if (sourceHasEnvFallbackLiteral(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
