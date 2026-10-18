import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sacredTimingSnapshot } from "./sacred-timing";
import { cipherCoherenceSnapshot } from "./sigil-cipher";
import { lusEncode } from "./lingua-universalis";
import { readAdminKeyMaterial } from "./father-identity";
import { NotConfiguredError } from "./not-configured";

const PHI = (1 + Math.sqrt(5)) / 2;
const SACRED_NUMERICS = [3, 7, 12, 21, 33, 40, 49, 72, 108, 144, 153, 216] as const;
const VAULT_DIR = join(process.cwd(), ".local-data");
const VAULT_FILE = join(VAULT_DIR, "natal-vault.json");

interface NatalEnvelope {
  v: 1;
  iv: string;
  tag: string;
  ct: string;
  signatureGlyph: string;
  signatureHashHex: string;
  boundAt: string;
}

type Vault = Record<string, NatalEnvelope>;

function loadVault(): Vault {
  try {
    if (!existsSync(VAULT_FILE)) return {};
    return JSON.parse(readFileSync(VAULT_FILE, "utf8")) as Vault;
  } catch {
    return {};
  }
}

function saveVault(v: Vault): void {
  mkdirSync(VAULT_DIR, { recursive: true });
  writeFileSync(VAULT_FILE, JSON.stringify(v, null, 2), { mode: 0o600 });
}

/** Vault AES key from admin key material. The holder id is only a salt.
 *  Independent of session-rotating keys so natal data survives rotations. */
function vaultKeyFor(holderFp: string): Buffer {
  const material = readAdminKeyMaterial();
  return scryptSync(`tessera-natal-vault-v1|${material}`, `tessera-natal-vault-salt|${holderFp}`, 32);
}

function encryptNatal(holderFp: string, plaintext: string): { iv: string; tag: string; ct: string } {
  const key = vaultKeyFor(holderFp);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { iv: iv.toString("base64"), tag: tag.toString("base64"), ct: ct.toString("base64") };
}

function decryptNatal(holderFp: string, env: NatalEnvelope): string {
  const key = vaultKeyFor(holderFp);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(env.iv, "base64"));
  decipher.setAuthTag(Buffer.from(env.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(env.ct, "base64")), decipher.final()]).toString("utf8");
}

/** Render a hex hash as a permanent glyph signature using the FIXED LUS
 *  alphabet (deterministically permuted from a universal seed at module
 *  load — same across every run, every restart, every process). The
 *  rotating cipher alphabet is intentionally NOT used here: the natal
 *  signature must be time-invariant so the same birth date+time always
 *  produces the same key the user can save and re-present. */
function hexToGlyphSignature(hex: string, length = 33): string {
  const trimmed = hex.slice(0, length * 2);
  let base36 = "";
  for (let i = 0; i < trimmed.length; i += 2) {
    const byte = parseInt(trimmed.slice(i, i + 2), 16);
    base36 += byte.toString(36).padStart(2, "0");
  }
  return lusEncode(base36.slice(0, length).toLowerCase());
}

export interface NatalBindResult {
  bound: true;
  signatureGlyph: string;
  signatureHashShort: string;
  cosmicAnchor: ReturnType<typeof cipherCoherenceSnapshot>["cosmicAnchor"];
  guidance: string;
}

export function bindNatalChart(
  _holderFp: string,
  _birthDateISO: string,
  _birthTimeHHMM: string,
): NatalBindResult {
  throw new NotConfiguredError("natal bind does not derive a key");
}

export function natalStatus(holderFp: string): {
  bound: boolean;
  signatureGlyph?: string;
  signatureHashShort?: string;
  boundAt?: string;
} {
  const vault = loadVault();
  const env = vault[holderFp];
  if (!env) return { bound: false };
  return {
    bound: true,
    signatureGlyph: env.signatureGlyph,
    signatureHashShort: env.signatureHashHex.slice(0, 12),
    boundAt: env.boundAt,
  };
}

export function unbindNatalChart(holderFp: string): { ok: boolean } {
  const vault = loadVault();
  if (!vault[holderFp]) return { ok: false };
  delete vault[holderFp];
  saveVault(vault);
  return { ok: true };
}

export interface RotatingNatalHash {
  rotatingGlyph: string;
  rotatingHashShort: string;
  windowId: string;
  windowStartMs: number;
  expiresInMs: number;
  cosmicAnchor: ReturnType<typeof cipherCoherenceSnapshot>["cosmicAnchor"];
  signatureGlyph: string;
}

/** Compute the live rotating hash for this holder, fused with the current
 *  cosmic moment. Re-derives every coherence window — the universe rotates
 *  the code in real time. Never returns or accepts the natal seed itself. */
export function rotatingNatalHash(holderFp: string): RotatingNatalHash | null {
  const vault = loadVault();
  const env = vault[holderFp];
  if (!env) return null;
  let seedHex: string;
  try {
    seedHex = (JSON.parse(decryptNatal(holderFp, env)) as { seedHex: string }).seedHex;
  } catch {
    return null;
  }

  const coh = cipherCoherenceSnapshot();
  const snap = sacredTimingSnapshot();
  const rotationSeed = [
    "tessera-natal-rot-v1",
    seedHex,
    coh.current.windowId,
    coh.current.permutationFingerprint,
    snap.julianDay.toFixed(8),
    snap.planetaryHour.ruler,
    snap.planetaryHour.index.toString(),
    snap.lunar.fraction.toFixed(8),
    snap.composite.toFixed(8),
    PHI.toFixed(12),
    SACRED_NUMERICS.join(":"),
    holderFp,
  ].join("|");
  const rotHex = createHash("sha512").update(rotationSeed).digest("hex");
  const rotatingGlyph = hexToGlyphSignature(rotHex, 21);

  return {
    rotatingGlyph,
    rotatingHashShort: rotHex.slice(0, 12),
    windowId: coh.current.windowId,
    windowStartMs: coh.current.windowStartMs,
    expiresInMs: coh.current.expiresInMs,
    cosmicAnchor: coh.cosmicAnchor,
    signatureGlyph: env.signatureGlyph,
  };
}

/** Verify a presented signature glyph against any bound holder.
 *  Returns the holder fingerprint if matched. */
export function verifyNatalSignature(presentedGlyph: string): string | null {
  const trimmed = presentedGlyph.trim();
  if (!trimmed) return null;
  const vault = loadVault();
  for (const [fp, env] of Object.entries(vault)) {
    if (env.signatureGlyph === trimmed) return fp;
  }
  return null;
}
