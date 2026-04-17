import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { sacredTimingSnapshot } from "./sacred-timing";

const SACRED_NUMERICS = [3, 7, 12, 21, 33, 40, 49, 72, 108, 144, 153, 216] as const;
const PHI = (1 + Math.sqrt(5)) / 2;

const GLYPH_TABLE: ReadonlyArray<readonly [string, string, number]> = [
  ["α", "alpha",   1],
  ["β", "beta",    2],
  ["γ", "gamma",   3],
  ["δ", "delta",   4],
  ["ε", "epsilon", 5],
  ["ζ", "zeta",    7],
  ["η", "eta",     8],
  ["θ", "theta",   9],
  ["ι", "iota",   10],
  ["κ", "kappa",  20],
  ["λ", "lambda", 30],
  ["μ", "mu",     40],
  ["ν", "nu",     50],
  ["ξ", "xi",     60],
  ["ο", "omicron",70],
  ["π", "pi",     80],
  ["ρ", "rho",   100],
  ["σ", "sigma", 200],
  ["τ", "tau",   300],
  ["υ", "upsilon",400],
  ["φ", "phi",   500],
  ["χ", "chi",   600],
  ["ψ", "psi",   700],
  ["ω", "omega", 800],
];

export interface GlyphReading {
  glyph: string;
  name: string;
  value: number;
}

export function readGlyphs(text: string): GlyphReading[] {
  const out: GlyphReading[] = [];
  for (const ch of text) {
    const row = GLYPH_TABLE.find((r) => r[0] === ch);
    if (row) out.push({ glyph: row[0], name: row[1], value: row[2] });
  }
  return out;
}

export function gematria(text: string): number {
  let sum = 0;
  for (const ch of text) {
    const row = GLYPH_TABLE.find((r) => r[0] === ch);
    if (row) sum += row[2];
    else {
      const code = ch.toUpperCase().charCodeAt(0);
      if (code >= 65 && code <= 90) sum += (code - 64);
    }
  }
  return sum;
}

export interface SigilKey {
  id: string;
  generation: number;
  createdAt: Date;
  rotatedAt: Date | null;
  expiresAt: Date | null;
  fingerprint: string;
  sealed: boolean;
}

interface SigilKeyMaterial extends SigilKey {
  raw: Buffer;
}

const _keyHistory: SigilKeyMaterial[] = [];
let _activeKey: SigilKeyMaterial | null = null;
let _replitWrappingKey: Buffer | null = null;

function deriveSeedSalt(): Buffer {
  const snap = sacredTimingSnapshot();
  const seedString = [
    snap.julianDay.toFixed(6),
    snap.lunar.fraction.toFixed(6),
    snap.planetaryHour.ruler,
    snap.planetaryHour.index.toString(),
    SACRED_NUMERICS.join(":"),
    PHI.toFixed(12),
  ].join("|");
  return createHash("sha256").update(seedString).digest();
}

function generateRawKey(): Buffer {
  const entropy = randomBytes(64);
  const sacredSalt = deriveSeedSalt();
  return scryptSync(Buffer.concat([entropy, sacredSalt]), sacredSalt, 32);
}

export function rotateSessionKey(reason: string): SigilKey {
  if (_activeKey) {
    _activeKey.rotatedAt = new Date();
    _activeKey.sealed = true;
    _keyHistory.push(_activeKey);
    if (_keyHistory.length > 144) _keyHistory.shift();
  }
  const raw = generateRawKey();
  const fingerprint = createHash("sha256").update(raw).digest("hex").slice(0, 16);
  const generation = (_activeKey?.generation ?? 0) + 1;
  _activeKey = {
    id: `sigil-${generation}-${fingerprint}`,
    generation,
    createdAt: new Date(),
    rotatedAt: null,
    expiresAt: null,
    fingerprint,
    sealed: false,
    raw,
  };
  // Re-derive the public Replit wrapping key on every rotation so the
  // runtime always has a consistent envelope to unwrap the active key.
  _replitWrappingKey = scryptSync(`replit-runtime|${fingerprint}|${reason}`, fingerprint, 32);
  return publicView(_activeKey);
}

function publicView(k: SigilKeyMaterial): SigilKey {
  const { raw: _raw, ...pub } = k;
  void _raw;
  return pub;
}

export function getActiveKey(): SigilKey {
  if (!_activeKey) rotateSessionKey("first-use");
  return publicView(_activeKey!);
}

export function getKeyHistory(): SigilKey[] {
  return _keyHistory.map(publicView);
}

export function getReplitReaderKeyFingerprint(): string {
  if (!_replitWrappingKey) rotateSessionKey("first-use");
  return createHash("sha256").update(_replitWrappingKey!).digest("hex").slice(0, 32);
}

export interface CipherEnvelope {
  v: 1;
  alg: "aes-256-gcm";
  keyId: string;
  iv: string;
  tag: string;
  ct: string;
  glyphSeal: string;
  gematria: number;
  encryptedAt: string;
}

export function encryptForCorpus(plaintext: string, label = "corpus"): CipherEnvelope {
  if (!_activeKey) rotateSessionKey("first-use");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", _activeKey!.raw, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const glyphSeal = SACRED_NUMERICS
    .map((n, i) => GLYPH_TABLE[(n + label.length + i) % GLYPH_TABLE.length][0])
    .join("");
  return {
    v: 1,
    alg: "aes-256-gcm",
    keyId: _activeKey!.id,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ct.toString("base64"),
    glyphSeal,
    gematria: gematria(plaintext),
    encryptedAt: new Date().toISOString(),
  };
}

export function decryptFromCorpus(env: CipherEnvelope): string {
  const key =
    _activeKey?.id === env.keyId
      ? _activeKey
      : _keyHistory.find((k) => k.id === env.keyId);
  if (!key) throw new Error(`Sigil key ${env.keyId} not available — sealed or rotated out`);
  const decipher = createDecipheriv("aes-256-gcm", key.raw, Buffer.from(env.iv, "base64"));
  decipher.setAuthTag(Buffer.from(env.tag, "base64"));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(env.ct, "base64")),
    decipher.final(),
  ]);
  return pt.toString("utf8");
}

// ── Reversible glyph alphabet (the "your-language" surface layer) ───────
// Bijective substitution: every printable ASCII char ↔ one glyph cluster.
// Uses Greek letters, Coptic, mathematical operators, and sacred numerals.
// Plain text is unrecognizable in this form, but a holder of the alphabet
// (the "key") can decode trivially. AES envelope above remains for at-rest.

const PLAIN_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
  "abcdefghijklmnopqrstuvwxyz" +
  "0123456789 .,;:!?'\"()-_/\n\t";

const GLYPH_ALPHABET = [
  "Α","Β","Γ","Δ","Ε","Ζ","Η","Θ","Ι","Κ","Λ","Μ","Ν","Ξ","Ο","Π","Ρ","Σ","Τ","Υ","Φ","Χ","Ψ","Ω","Ϡ","Ϟ",
  "α","β","γ","δ","ε","ζ","η","θ","ι","κ","λ","μ","ν","ξ","ο","π","ρ","σ","τ","υ","φ","χ","ψ","ω","ϡ","ϟ",
  "𐤀","𐤁","𐤂","𐤃","𐤄","𐤅","𐤆","𐤇","𐤈","𐤉",
  "·","·","·","·","·","·","·","·","·","·","·","·","·","·","·","·",
] as const;

const _encodeMap = new Map<string, string>();
const _decodeMap = new Map<string, string>();
for (let i = 0; i < PLAIN_ALPHABET.length && i < GLYPH_ALPHABET.length; i++) {
  _encodeMap.set(PLAIN_ALPHABET[i], GLYPH_ALPHABET[i]);
  _decodeMap.set(GLYPH_ALPHABET[i], PLAIN_ALPHABET[i]);
}
// Distinguish the dot-positions by appending a combining marker so decode is unambiguous
const DOT_GLYPHS = ["⊕","⊖","⊗","⊘","⊙","⊚","⊛","⊜","⊝","⊞","⊟","⊠","⊡","⊢","⊣","⊤"];
let dotIdx = 0;
for (let i = 0; i < PLAIN_ALPHABET.length && i < GLYPH_ALPHABET.length; i++) {
  if (GLYPH_ALPHABET[i] === "·" && dotIdx < DOT_GLYPHS.length) {
    _encodeMap.set(PLAIN_ALPHABET[i], DOT_GLYPHS[dotIdx]);
    _decodeMap.set(DOT_GLYPHS[dotIdx], PLAIN_ALPHABET[i]);
    dotIdx++;
  }
}

export function glyphEncode(text: string): string {
  let out = "";
  for (const ch of text) out += _encodeMap.get(ch) ?? ch;
  return out;
}

export function glyphDecode(text: string): string {
  let out = "";
  for (const ch of text) out += _decodeMap.get(ch) ?? ch;
  return out;
}

export function glyphAlphabet(): Array<{ plain: string; glyph: string }> {
  const out: Array<{ plain: string; glyph: string }> = [];
  for (const [plain, glyph] of _encodeMap.entries()) out.push({ plain, glyph });
  return out;
}

/** The "key" the user holds. Combination of the active sigil fingerprint
 *  and the glyph alphabet identifies who can decode. */
export function readingKey(): { fingerprint: string; alphabetHash: string; expiresWith: string } {
  if (!_activeKey) rotateSessionKey("first-use");
  const alphabet = Array.from(_encodeMap.entries()).map(([p, g]) => `${p}=${g}`).join("|");
  return {
    fingerprint: _activeKey!.fingerprint,
    alphabetHash: createHash("sha256").update(alphabet).digest("hex").slice(0, 16),
    expiresWith: _activeKey!.id,
  };
}

/** Recursively glyph-encode every string leaf in a value. Numbers, booleans,
 *  and structural keys are preserved so the JSON shape stays valid. */
export function deepGlyphEncode(value: unknown): unknown {
  if (typeof value === "string") return glyphEncode(value);
  if (Array.isArray(value)) return value.map(deepGlyphEncode);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = deepGlyphEncode(v);
    return out;
  }
  return value;
}

export function deepGlyphDecode(value: unknown): unknown {
  if (typeof value === "string") return glyphDecode(value);
  if (Array.isArray(value)) return value.map(deepGlyphDecode);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = deepGlyphDecode(v);
    return out;
  }
  return value;
}

export function cipherStatus(): {
  active: SigilKey | null;
  history: number;
  replitReaderFingerprint: string;
  sacredTimingSnapshot: ReturnType<typeof sacredTimingSnapshot>;
  glyphTableSize: number;
} {
  return {
    active: _activeKey ? publicView(_activeKey) : null,
    history: _keyHistory.length,
    replitReaderFingerprint: getReplitReaderKeyFingerprint(),
    sacredTimingSnapshot: sacredTimingSnapshot(),
    glyphTableSize: GLYPH_TABLE.length,
  };
}
