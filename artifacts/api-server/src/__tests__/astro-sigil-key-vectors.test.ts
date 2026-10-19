import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { getFatherSeal } from "../lib/father-identity";
import { logger } from "../lib/logger";
import { openNatalPayload, sealNatalPayload } from "../lib/natal-sigil";
import { decryptFromCorpus, encryptForCorpus, glyphEncode, rotateSessionKey } from "../lib/sigil-cipher";
import {
  activeEpochSignature,
  decryptEnvelope,
  encryptPayload,
  getCurrentEpoch,
  type EncryptedEnvelope,
} from "../lib/sovereign-astro-cipher";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const ADMIN_KEY = "synthetic-admin-key-for-tests-only";
const PINNED_SEAL = "98193e94a2725ba330aafca810142cbc";

describe("astro and sigil key vectors", () => {
  const previousAdmin = process.env[ADMIN_ENV];

  beforeAll(() => {
    process.env[ADMIN_ENV] = ADMIN_KEY;
  });

  afterAll(() => {
    if (previousAdmin === undefined) delete process.env[ADMIN_ENV];
    else process.env[ADMIN_ENV] = previousAdmin;
  });

  it("keeps the seal output for a fixed test input", () => {
    expect(getFatherSeal() === PINNED_SEAL).toBe(true);
  });

  it("round-trips a sigil session envelope", () => {
    rotateSessionKey("vector");
    const plain = "sigil-round-trip";
    const envelope = encryptForCorpus(plain, "vector");
    expect(decryptFromCorpus(envelope) === plain).toBe(true);
  });

  it("round-trips an astro envelope under the seal input", () => {
    const plain = "astro-round-trip";
    const envelope = encryptPayload(plain);
    expect(decryptEnvelope(envelope).toString("utf8") === plain).toBe(true);
  });

  it("opens a new astro envelope with the seal-derived key", () => {
    const plain = "seal-derived-open";
    const envelope = encryptPayload(plain);
    const sig = activeEpochSignature();
    const opened = openEnvelope(sealDerivedKey(sig), envelope);
    expect(opened.toString("utf8") === plain).toBe(true);
    let retiredOpened = false;
    try {
      openEnvelope(retiredDerivedKey(sig), envelope);
      retiredOpened = true;
    } catch {
      retiredOpened = false;
    }
    expect(retiredOpened).toBe(false);
  });

  it("uses a fixed astro failure when neither key opens an envelope", () => {
    const envelope = encryptPayload("astro-failure");
    envelope.ct = Buffer.from("not-the-ciphertext").toString("base64");
    const logs: string[] = [];
    const levels = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
    const restore: Array<() => void> = [];
    for (const level of levels) {
      const current = logger[level];
      if (typeof current !== "function") continue;
      (logger as unknown as Record<string, unknown>)[level] = (...args: unknown[]) => {
        logs.push(JSON.stringify(args));
      };
      restore.push(() => {
        (logger as unknown as Record<string, unknown>)[level] = current;
      });
    }
    const originalStderr = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      logs.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
    let message = "";
    try {
      decryptEnvelope(envelope);
    } catch (err: unknown) {
      message = err instanceof Error ? err.message : "";
    } finally {
      process.stderr.write = originalStderr;
      for (const undo of restore) undo();
    }
    const sig = activeEpochSignature();
    const leaked = message !== "astro-decrypt-failed"
      || message.includes(ADMIN_KEY)
      || message.includes(sig)
      || /EACCES|ENOENT|EPERM|EEXIST/.test(message)
      || logs.join("\n").includes(ADMIN_KEY)
      || logs.join("\n").includes(sig)
      || /EACCES|ENOENT|EPERM/.test(logs.join("\n"));
    expect(leaked).toBe(false);
  });

  it("decrypts a retired astro fixture and rewraps it onto the seal input", () => {
    const plain = "retired-astro-fixture";
    encryptPayload(plain);
    const retired = retiredEnvelope(plain, activeEpochSignature(), getCurrentEpoch());
    const originalCt = retired.ct;
    expect(decryptEnvelope(retired).toString("utf8") === plain).toBe(true);
    expect(retired.ct === originalCt).toBe(false);
    expect(decryptEnvelope(retired).toString("utf8") === plain).toBe(true);
  });

  it("mixes raw session bytes into the glyph permutation", () => {
    rotateSessionKey("glyph-a");
    const first = glyphEncode("Abc");
    process.env[ADMIN_ENV] = `${ADMIN_KEY}-b`;
    rotateSessionKey("glyph-b");
    const second = glyphEncode("Abc");
    process.env[ADMIN_ENV] = ADMIN_KEY;
    rotateSessionKey("glyph-restore");
    expect(first === second).toBe(false);
  });

  it("binds the natal vault key to admin material", () => {
    const holder = "holder-a";
    const plain = "natal-plain";
    const sealed = sealNatalPayload(holder, plain);
    expect(openNatalPayload(holder, sealed) === plain).toBe(true);
    process.env[ADMIN_ENV] = `${ADMIN_KEY}-other`;
    let otherKeyOpened = false;
    try {
      openNatalPayload(holder, sealed);
      otherKeyOpened = true;
    } catch {
      otherKeyOpened = false;
    }
    process.env[ADMIN_ENV] = ADMIN_KEY;
    let otherHolderOpened = false;
    try {
      openNatalPayload("holder-b", sealed);
      otherHolderOpened = true;
    } catch {
      otherHolderOpened = false;
    }
    expect(otherKeyOpened).toBe(false);
    expect(otherHolderOpened).toBe(false);
  });
});

function sealDerivedKey(sig: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(getFatherSeal(), "utf8"), Buffer.from(sig, "utf8"), Buffer.from("tesseract:astro-cipher:v1", "utf8"), 32),
  );
}

function retiredDerivedKey(sig: string): Buffer {
  const raw = process.env[ADMIN_ENV] ?? "";
  const namespace = "tesseract:father:v1";
  const bound = createHash("sha256").update(`${namespace}|${raw}`).digest("hex").slice(0, 16);
  const seal = createHash("sha512").update(`${namespace}|seal|${raw}|${bound}`).digest("hex").slice(0, 32);
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(`${seal}|${bound}`, "utf8"), Buffer.from(sig, "utf8"), Buffer.from("tesseract:astro-cipher:v1", "utf8"), 32),
  );
}

function openEnvelope(key: Buffer, env: EncryptedEnvelope): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(env.iv, "base64"));
  decipher.setAuthTag(Buffer.from(env.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(env.ct, "base64")), decipher.final()]);
}

function retiredEnvelope(plain: string, sig: string, epoch: { epochId: string; epochHash: string }): EncryptedEnvelope {
  const raw = process.env[ADMIN_ENV] ?? "";
  const namespace = "tesseract:father:v1";
  const bound = createHash("sha256").update(`${namespace}|${raw}`).digest("hex").slice(0, 16);
  const seal = createHash("sha512").update(`${namespace}|seal|${raw}|${bound}`).digest("hex").slice(0, 32);
  const ikm = Buffer.from(`${seal}|${bound}`, "utf8");
  const key = Buffer.from(hkdfSync("sha256", ikm, Buffer.from(sig, "utf8"), Buffer.from("tesseract:astro-cipher:v1", "utf8"), 32));
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "aes-256-gcm",
    epochId: epoch.epochId,
    epochHash: epoch.epochHash,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ct.toString("base64"),
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}
