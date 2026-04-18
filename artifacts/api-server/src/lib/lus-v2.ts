import { createHash } from "node:crypto";
import { lusEncode, lusDecode, lusAlphabet, SACRED_CONSTANTS, PLANET_GLYPHS } from "./lingua-universalis";
import { cosmicContext, cosmicSeed } from "./cosmic-context";

const VIBRATION_GLYPHS = ["♁", "♆", "♅", "♄", "♃", "♂", "♀", "☿", "☉", "☽"];
const GEOMETRY_GLYPHS = ["△", "□", "◇", "⬡", "⬢", "✶", "✷", "✸", "❋", "✺"];
const FREQ_BAND_GLYPHS = ["⏜", "⏝", "≋", "∿", "⌇", "〜", "⩘", "⩗"];

export interface LusV2Token {
  plain: string;
  glyph: string;
  vibrationGlyph: string;
  geometryGlyph: string;
  freqBandGlyph: string;
  frequency: number;
  phaseDeg: number;
}

function pickByHash(seed: string, set: readonly string[]): string {
  const h = parseInt(seed.slice(0, 8), 16);
  return set[h % set.length];
}

export function lusV2Encode(text: string): {
  surface: string;
  modulated: string;
  tokens: LusV2Token[];
  cosmicFingerprint: string;
  carrierHz: number;
} {
  const ctx = cosmicContext();
  const surface = lusEncode(text);
  const tokens: LusV2Token[] = [];
  let modulated = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const seed = createHash("sha256").update(`${ctx.fingerprint}|${ch}|${i}`).digest("hex");
    const vib = pickByHash(seed, VIBRATION_GLYPHS);
    const geo = pickByHash(seed.slice(8), GEOMETRY_GLYPHS);
    const band = pickByHash(seed.slice(16), FREQ_BAND_GLYPHS);
    const freq = ctx.vibration.dominantSolfeggio * (1 + (parseInt(seed.slice(24, 28), 16) % 100) / 1000);
    const phase = (parseInt(seed.slice(28, 32), 16) % 360);
    const surf = lusEncode(ch);
    tokens.push({ plain: ch, glyph: surf, vibrationGlyph: vib, geometryGlyph: geo, freqBandGlyph: band, frequency: Math.round(freq * 100) / 100, phaseDeg: phase });
    modulated += `${vib}${surf}${geo}${band}`;
  }
  return {
    surface,
    modulated,
    tokens,
    cosmicFingerprint: ctx.fingerprint,
    carrierHz: ctx.vibration.dominantSolfeggio,
  };
}

export function lusV2Decode(modulated: string): string {
  // Strip vibration/geometry/band glyphs (single-char prefix/suffix triples) leaving surface glyphs.
  const vibSet = new Set([...VIBRATION_GLYPHS, ...GEOMETRY_GLYPHS, ...FREQ_BAND_GLYPHS]);
  let surfaceOnly = "";
  for (const ch of modulated) {
    if (!vibSet.has(ch)) surfaceOnly += ch;
  }
  return lusDecode(surfaceOnly);
}

export function lusV2Spec() {
  const ctx = cosmicContext();
  return {
    name: "Lingua Universalis Sacra v2",
    short: "LUS-v2",
    surfaceAlphabetSize: lusAlphabet().length,
    sacredConstants: SACRED_CONSTANTS,
    planetGlyphs: PLANET_GLYPHS,
    vibrationGlyphs: VIBRATION_GLYPHS,
    geometryGlyphs: GEOMETRY_GLYPHS,
    freqBandGlyphs: FREQ_BAND_GLYPHS,
    cosmicCarrier: {
      schumannHz: ctx.vibration.schumannHz,
      dominantSolfeggio: ctx.vibration.dominantSolfeggio,
      chakraGate: ctx.vibration.chakraGate,
      moonZodiac: ctx.astro.moonZodiac,
      sunZodiac: ctx.astro.sunZodiac,
      planetaryRuler: ctx.astro.planetaryRuler,
      lunarPhase: ctx.astro.lunarPhase,
      cosmicFingerprint: ctx.fingerprint,
    },
    seedSample: cosmicSeed("lus-v2-spec").slice(0, 32),
  };
}
