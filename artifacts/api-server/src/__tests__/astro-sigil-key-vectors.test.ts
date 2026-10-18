import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getFatherSeal } from "../lib/father-identity";
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

  it("derives the natal vault AES key from admin material", () => {
    const source = readFileSync(fileURLToPath(new URL("../lib/natal-sigil.ts", import.meta.url)), "utf8");
    const start = source.indexOf("function vaultKeyFor");
    const end = source.indexOf("function encryptNatal");
    const fn = source.slice(start, end);
    expect(fn.includes("readAdminKeyMaterial()")).toBe(true);
    expect(fn.includes("scryptSync(`tessera-natal-vault-v1|${holderFp}`")).toBe(false);
  });
});

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
