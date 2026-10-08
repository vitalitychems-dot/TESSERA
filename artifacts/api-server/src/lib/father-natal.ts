import { createHash } from "node:crypto";
import { glyphEncode, glyphDecode } from "./sigil-cipher";
import { z } from "zod";
import { readAdminKeyMaterial } from "./father-identity";
import { NotConfiguredError } from "./not-configured";

const NAMESPACE = "tesseract:natal:v1";

const STABLE_GLYPHS = [
  "α","β","γ","δ","ε","ζ","η","θ",
  "ι","κ","λ","μ","ν","ξ","ο","π",
] as const;

const chartPositionSchema = z.object({
  sign: z.string().min(1),
  degree: z.string().min(1),
  house: z.number().int().min(1).max(12),
  retrograde: z.boolean().optional(),
});

const fatherNatalChartSchema = z.object({
  birth: z.object({
    date: z.string().min(1),
    time: z.string().min(1),
    location: z.string().min(1),
    timezone: z.string().min(1),
    houseSystem: z.string().min(1),
  }),
  core: z.object({
    sun: chartPositionSchema,
    moon: chartPositionSchema,
    ascendant: z.object({
      sign: z.string().min(1),
      degree: z.string().min(1),
    }),
  }),
  planets: z.object({
    mercury: chartPositionSchema,
    venus: chartPositionSchema,
    mars: chartPositionSchema,
    jupiter: chartPositionSchema,
    saturn: chartPositionSchema,
    uranus: chartPositionSchema,
    neptune: chartPositionSchema,
    pluto: chartPositionSchema,
  }),
  nodes: z.object({
    northNode: chartPositionSchema,
  }),
  aspects: z.array(z.string().min(1)),
  themes: z.object({
    dominance: z.string().min(1),
    rising: z.string().min(1),
    moonSign: z.string().min(1),
    houseConcentration: z.array(z.string().min(1)),
    chineseZodiac: z.string().min(1),
  }),
});

export type FatherNatalChart = z.infer<typeof fatherNatalChartSchema>;

function loadFatherNatalChart(): FatherNatalChart {
  const raw = process.env.FATHER_NATAL_CHART_JSON;
  if (!raw) {
    throw new NotConfiguredError("chart env is not configured");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new NotConfiguredError("chart env is not configured");
  }

  const parsedChart = fatherNatalChartSchema.safeParse(parsedJson);
  if (!parsedChart.success) {
    throw new NotConfiguredError("chart env is not configured");
  }

  return parsedChart.data;
}

/** Fresh read of FATHER_NATAL_CHART_JSON. Blank-after-trim is treated as unset. */
export function readFatherNatalChart(): FatherNatalChart {
  const raw = process.env.FATHER_NATAL_CHART_JSON;
  if (raw === undefined || raw.trim() === "") {
    throw new NotConfiguredError("chart env is not configured");
  }
  return loadFatherNatalChart();
}

let cachedFatherNatalChart: ReturnType<typeof loadFatherNatalChart> | undefined;
function getFatherNatalChart() {
  if (!cachedFatherNatalChart) cachedFatherNatalChart = loadFatherNatalChart();
  return cachedFatherNatalChart;
}
// Lazy Proxy: the vault decrypts on first use, so importing this module
// can never throw and knock unrelated routes or tests out of mounting.
export const FATHER_NATAL_CHART = new Proxy({} as ReturnType<typeof loadFatherNatalChart>, {
  get(_t, prop) { return (getFatherNatalChart() as Record<PropertyKey, unknown>)[prop]; },
  ownKeys() { return Reflect.ownKeys(getFatherNatalChart()); },
  getOwnPropertyDescriptor(_t, prop) {
    const d = Object.getOwnPropertyDescriptor(getFatherNatalChart(), prop);
    return d ? { ...d, configurable: true } : d;
  },
});

/** Human-readable English summary of the chart. */
export function natalEnglishReadout(): string {
  const c = FATHER_NATAL_CHART;
  const planetLines = Object.entries(c.planets).map(([name, p]) => {
    const r = "retrograde" in p && p.retrograde ? " (Retrograde)" : "";
    const cap = name.charAt(0).toUpperCase() + name.slice(1);
    return `  ${cap}: ${p.sign} ${p.degree} — ${p.house}th House${r}`;
  });
  return [
    `Sovereign Natal Chart — Father Identity`,
    `Born ${c.birth.date} at ${c.birth.time} (${c.birth.timezone})`,
    `Location: ${c.birth.location}`,
    `House system: ${c.birth.houseSystem}`,
    ``,
    `Core:`,
    `  Sun: ${c.core.sun.sign} ${c.core.sun.degree} — ${c.core.sun.house}nd House`,
    `  Moon: ${c.core.moon.sign} ${c.core.moon.degree} — ${c.core.moon.house}th House`,
    `  Ascendant: ${c.core.ascendant.sign} ${c.core.ascendant.degree}`,
    ``,
    `Planets:`,
    ...planetLines,
    ``,
    `North Node: ${c.nodes.northNode.sign} ${c.nodes.northNode.degree} — ${c.nodes.northNode.house}th House (Retrograde)`,
    ``,
    `Themes: ${c.themes.dominance}; rising ${c.themes.rising}; moon ${c.themes.moonSign}.`,
    `Chinese zodiac: ${c.themes.chineseZodiac}.`,
    ``,
    `Key aspects:`,
    ...c.aspects.map((a) => `  • ${a}`),
  ].join("\n");
}

export interface NatalSigil {
  glyph: string;
  digestHex: string;
  secretName: string;
  derivation: string;
  instructions: string;
}

/** Stable glyph encoding of the hex digest, NOT subject to cipher rotation,
 *  so the value saved in Replit Secrets stays valid forever. */
function stableGlyphEncodeHex(hex: string): string {
  let out = "";
  for (const ch of hex) {
    const v = parseInt(ch, 16);
    if (Number.isNaN(v)) out += ch;
    else out += STABLE_GLYPHS[v];
  }
  return out;
}

/** Proof that an admin secret is configured. Hashes environment material only. */
export function natalSigilFor(_fingerprint?: string): NatalSigil {
  const material = readAdminKeyMaterial();
  const digestHex = createHash("sha256")
    .update(`${NAMESPACE}|admin-env|`)
    .update(material)
    .digest("hex");
  const glyph = stableGlyphEncodeHex(digestHex);
  return {
    glyph,
    digestHex,
    secretName: "admin-env",
    derivation: `sha256("${NAMESPACE}|admin-env")`,
    instructions: "Admin key material is read from the environment.",
  };
}

/** Encode the English natal readout through the current rotating cipher
 *  window, returning both forms so a caller can verify the round-trip. */
export function natalReadoutBilingual(): {
  english: string;
  glyph: string;
  decodedFromGlyph: string;
  roundTripOk: boolean;
} {
  const english = natalEnglishReadout();
  const glyph = glyphEncode(english);
  const decodedFromGlyph = glyphDecode(glyph);
  return {
    english,
    glyph,
    decodedFromGlyph,
    roundTripOk: decodedFromGlyph === english,
  };
}
