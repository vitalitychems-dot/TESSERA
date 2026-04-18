import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "node:crypto";
import { cosmicContext } from "./cosmic-context";
import { glyphEncode, glyphDecode, getActiveKey } from "./sigil-cipher";
import { lusV2Encode } from "./lus-v2";

export interface OmniversalCipherEnvelope {
  v: 2;
  alg: "aes-256-gcm";
  layers: ["sigil-glyph", "harmonic-mod", "geometric-shuffle", "astro-key"];
  cosmicFingerprint: string;
  iv: string;
  tag: string;
  ct: string;
  carrierHz: number;
  geometricSalt: string;
  astroEpoch: string;
  surfacePreview: string;
  encryptedAt: string;
}

function deriveLayeredKey(): Buffer {
  const ctx = cosmicContext();
  const sigil = getActiveKey();
  const ikm = Buffer.from(`${sigil.fingerprint}|${sigil.id}`, "utf8");
  const salt = Buffer.from([
    ctx.fingerprint,
    ctx.vibration.dominantSolfeggio,
    ctx.geometry.goldenAngleDeg.toFixed(4),
    ctx.astro.moonZodiac,
    ctx.astro.planetaryRuler,
  ].join("|"), "utf8");
  const info = Buffer.from("omniversal-cipher:v2:layered", "utf8");
  return Buffer.from(hkdfSync("sha256", ikm, salt, info, 32));
}

function geometricShuffle(buf: Buffer, seedHex: string): Buffer {
  const out = Buffer.from(buf);
  let s = parseInt(seedHex.slice(0, 12), 16);
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}

function geometricUnshuffle(buf: Buffer, seedHex: string): Buffer {
  // Replay the same swap sequence in reverse to invert.
  const swaps: Array<[number, number]> = [];
  let s = parseInt(seedHex.slice(0, 12), 16);
  for (let i = buf.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) >>> 0;
    const j = s % (i + 1);
    swaps.push([i, j]);
  }
  const out = Buffer.from(buf);
  for (let k = swaps.length - 1; k >= 0; k--) {
    const [i, j] = swaps[k];
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  return out;
}

export function omniversalEncrypt(plaintext: string, label = "omni"): OmniversalCipherEnvelope {
  const ctx = cosmicContext();
  // Layer 1: sigil glyph encoding
  const layer1 = glyphEncode(plaintext);
  // Layer 2: harmonic modulation via LUS-v2
  const layer2 = lusV2Encode(layer1).modulated;
  // Layer 3: geometric shuffle of bytes
  const geometricSalt = createHash("sha256").update(`${ctx.fingerprint}|${label}|${ctx.geometry.goldenAngleDeg}`).digest("hex");
  const shuffled = geometricShuffle(Buffer.from(layer2, "utf8"), geometricSalt);
  // Layer 4: AES-256-GCM with HKDF-derived astro-bound key
  const key = deriveLayeredKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(ctx.fingerprint, "utf8"));
  const ct = Buffer.concat([cipher.update(shuffled), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 2,
    alg: "aes-256-gcm",
    layers: ["sigil-glyph", "harmonic-mod", "geometric-shuffle", "astro-key"],
    cosmicFingerprint: ctx.fingerprint,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ct: ct.toString("base64"),
    carrierHz: ctx.vibration.dominantSolfeggio,
    geometricSalt: geometricSalt.slice(0, 16),
    astroEpoch: `${ctx.astro.moonZodiac}|${ctx.astro.planetaryRuler}|${ctx.astro.lunarPhase}`,
    surfacePreview: layer2.slice(0, 64),
    encryptedAt: new Date().toISOString(),
  };
}

export function omniversalDecrypt(env: OmniversalCipherEnvelope): string {
  const ctx = cosmicContext();
  if (env.cosmicFingerprint !== ctx.fingerprint) {
    throw new Error(`Cosmic window mismatch — envelope sealed at ${env.cosmicFingerprint}, current ${ctx.fingerprint}`);
  }
  const key = deriveLayeredKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(env.iv, "base64"));
  decipher.setAAD(Buffer.from(ctx.fingerprint, "utf8"));
  decipher.setAuthTag(Buffer.from(env.tag, "base64"));
  const shuffled = Buffer.concat([decipher.update(Buffer.from(env.ct, "base64")), decipher.final()]);
  const geometricSalt = createHash("sha256").update(`${ctx.fingerprint}|omni|${ctx.geometry.goldenAngleDeg}`).digest("hex");
  // Try with default label first — caller should re-encrypt if label differs.
  const unshuf = geometricUnshuffle(shuffled, geometricSalt);
  const layer2 = unshuf.toString("utf8");
  // Strip LUS-v2 vibration/geo/band glyphs to recover layer1
  const vibSet = new Set(["♁","♆","♅","♄","♃","♂","♀","☿","☉","☽","△","□","◇","⬡","⬢","✶","✷","✸","❋","✺","⏜","⏝","≋","∿","⌇","〜","⩘","⩗"]);
  let layer1 = "";
  for (const ch of layer2) if (!vibSet.has(ch)) layer1 += ch;
  return glyphDecode(layer1);
}

export function omniversalCipherSnapshot() {
  const ctx = cosmicContext();
  const sigil = getActiveKey();
  return {
    version: 2,
    layers: [
      { layer: 1, name: "sigil-glyph", source: "sovereign sigil alphabet (cosmic-rotated)" },
      { layer: 2, name: "harmonic-modulation", source: "LUS-v2 vibration/geometry/freq-band glyphs", carrierHz: ctx.vibration.dominantSolfeggio },
      { layer: 3, name: "geometric-shuffle", source: "phi/golden-angle byte permutation" },
      { layer: 4, name: "astro-aes", source: "HKDF(sigil ⊕ cosmic context) → AES-256-GCM" },
    ],
    cosmicFingerprint: ctx.fingerprint,
    sigilFingerprint: sigil.fingerprint,
    bound: {
      moonZodiac: ctx.astro.moonZodiac,
      sunZodiac: ctx.astro.sunZodiac,
      planetaryRuler: ctx.astro.planetaryRuler,
      lunarPhase: ctx.astro.lunarPhase,
      schumannHz: ctx.vibration.schumannHz,
      dominantSolfeggio: ctx.vibration.dominantSolfeggio,
      goldenAngleDeg: ctx.geometry.goldenAngleDeg,
    },
  };
}
