import { createHash } from "crypto";
import { readFatherNatalChart, type FatherNatalChart } from "./father-natal";
import { computeNatalTransits, type NatalPosition, type TransitToNatalAspect } from "./sovereign-astro";

export interface TransitAspect {
  transitPlanet: string;
  natalPlanet: string;
  aspectType: string;
  orb: number;
  symbol: string;
  nature: "harmonious" | "challenging" | "neutral";
  insight: string;
  transitSign: string;
  natalSign: string;
  natalHouse: number;
}

export class NatalChartNotConfiguredError extends Error {
  readonly code = "not-configured" as const;

  constructor(message = "FATHER_NATAL_CHART_JSON is not configured") {
    super(message);
    this.name = "NatalChartNotConfiguredError";
  }
}

export interface FatherNatalData {
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  houseSystem: string;
  ascendant: { sign: string; degree: number };
  planets: Array<{
    name: string;
    symbol: string;
    sign: string;
    degree: number;
    house: number;
    retrograde: boolean;
  }>;
  /** The secret schema has no house-cusp table, so this stays empty rather than inventing cusps. */
  houses: Array<{
    number: number;
    sign: string;
    degree: number;
    label?: string;
  }>;
  aspects: string[];
}

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: "☉",
  Moon: "☽",
  Mercury: "☿",
  Venus: "♀",
  Mars: "♂",
  Jupiter: "♃",
  Saturn: "♄",
  Uranus: "♅",
  Neptune: "♆",
  Pluto: "♇",
  "North Node": "☊",
};

function requireDegree(degree: string): number {
  const value = Number(degree);
  if (!Number.isFinite(value)) {
    throw new NatalChartNotConfiguredError("FATHER_NATAL_CHART_JSON is invalid");
  }
  return value;
}

function mapBody(
  name: string,
  body: { sign: string; degree: string; house: number; retrograde?: boolean },
): FatherNatalData["planets"][number] {
  const symbol = PLANET_SYMBOLS[name];
  if (!symbol) {
    throw new NatalChartNotConfiguredError("FATHER_NATAL_CHART_JSON is invalid");
  }
  return {
    name,
    symbol,
    sign: body.sign,
    degree: requireDegree(body.degree),
    house: body.house,
    retrograde: body.retrograde === true,
  };
}

function mapFatherChart(chart: FatherNatalChart): FatherNatalData {
  return {
    birthDate: chart.birth.date,
    birthTime: chart.birth.time,
    birthPlace: chart.birth.location,
    houseSystem: chart.birth.houseSystem,
    ascendant: {
      sign: chart.core.ascendant.sign,
      degree: requireDegree(chart.core.ascendant.degree),
    },
    planets: [
      mapBody("Sun", chart.core.sun),
      mapBody("Moon", chart.core.moon),
      mapBody("Mercury", chart.planets.mercury),
      mapBody("Venus", chart.planets.venus),
      mapBody("Mars", chart.planets.mars),
      mapBody("Jupiter", chart.planets.jupiter),
      mapBody("Saturn", chart.planets.saturn),
      mapBody("Uranus", chart.planets.uranus),
      mapBody("Neptune", chart.planets.neptune),
      mapBody("Pluto", chart.planets.pluto),
      mapBody("North Node", chart.nodes.northNode),
    ],
    houses: [],
    aspects: chart.aspects,
  };
}

/** Loads Father's chart from FATHER_NATAL_CHART_JSON. Never returns built-in placements. */
export function getFatherNatalChart(): FatherNatalData {
  const raw = process.env.FATHER_NATAL_CHART_JSON;
  if (raw === undefined || raw.trim() === "") {
    throw new NatalChartNotConfiguredError("FATHER_NATAL_CHART_JSON is not configured");
  }
  try {
    return mapFatherChart(readFatherNatalChart());
  } catch (err) {
    if (err instanceof NatalChartNotConfiguredError) throw err;
    throw new NatalChartNotConfiguredError("FATHER_NATAL_CHART_JSON is invalid");
  }
}

const SIGN_LONGITUDE: Record<string, number> = {
  Aries: 0, Taurus: 30, Gemini: 60, Cancer: 90, Leo: 120, Virgo: 150,
  Libra: 180, Scorpio: 210, Sagittarius: 240, Capricorn: 270, Aquarius: 300, Pisces: 330,
};

function signDegreeToLongitude(sign: string, degree: number): number {
  const base = SIGN_LONGITUDE[sign];
  if (base === undefined) {
    throw new NatalChartNotConfiguredError("FATHER_NATAL_CHART_JSON is invalid");
  }
  return base + degree;
}

const TRANSIT_INSIGHTS: Record<string, Record<string, string>> = {
  Sun: {
    Conjunction: "Solar focus amplifies this natal energy — time for bold action and identity alignment",
    Trine: "Solar flow supports natural expression — ideal for authentic self-expression",
    Sextile: "Sun opens cooperative channels — a time of creative opportunity",
    Square: "Solar tension calls for growth — challenges reveal hidden strengths",
    Opposition: "Balancing solar awareness with natal themes — reflection brings clarity",
  },
  Moon: {
    Conjunction: "Emotional attunement to this natal placement — heightened intuition",
    Trine: "Emotional ease flows through this energy — trust feelings and instincts",
    Sextile: "Moon softens barriers — emotional intelligence shines",
    Square: "Emotional friction surfaces — a time for healing and integration",
    Opposition: "Emotional awareness peaks — release what no longer serves",
  },
  Mercury: {
    Conjunction: "Mental clarity sharpens here — ideal for communication and study",
    Trine: "Thoughts align naturally — express ideas with precision",
    Sextile: "Mercury opens dialogue — good time for negotiation",
    Square: "Mental tension sparks innovation — think outside the box",
    Opposition: "Perspective shifts bring insight — listen and reflect",
  },
  Venus: {
    Conjunction: "Venus beautifies and harmonizes — excellent for relationships and creativity",
    Trine: "Love and abundance flow — embrace beauty in all forms",
    Sextile: "Venus softens edges — diplomacy and charm are enhanced",
    Square: "Relationship tensions invite growth — address values honestly",
    Opposition: "Balance between self and others — relationship awareness peaks",
  },
  Mars: {
    Conjunction: "Mars fuels this energy with drive — act decisively and boldly",
    Trine: "Effortless action flows — pursue goals with confidence",
    Sextile: "Mars provides momentum — small efforts yield big results",
    Square: "Mars creates friction — channel aggression into productive effort",
    Opposition: "Assert boundaries clearly — external challenges fuel inner fire",
  },
  Jupiter: {
    Conjunction: "Jupiter expands and blesses — luck and opportunity abound",
    Trine: "Abundance flows naturally — say yes to growth",
    Sextile: "Jupiter opens doors — take advantage of new possibilities",
    Square: "Jupiter tests discipline — avoid overreach and excess",
    Opposition: "Reflect on how far you have grown — recalibrate for sustainable expansion",
  },
  Saturn: {
    Conjunction: "Saturn crystallizes — discipline and structure bring lasting results",
    Trine: "Saturn rewards consistent effort — build something permanent",
    Sextile: "Saturn supports steady progress — plan and execute methodically",
    Square: "Saturn tests resolve — face obstacles with perseverance",
    Opposition: "Saturn brings accountability — review structures and commitments",
  },
};

function getTransitInsight(transitPlanet: string, aspectType: string, natalPlanet: string, transitSign: string, natalHouse: number): string {
  const base = TRANSIT_INSIGHTS[transitPlanet]?.[aspectType] ?? `${transitPlanet} ${aspectType.toLowerCase()}s natal ${natalPlanet} — significant activation of House ${natalHouse} themes`;
  return `${base}. ${transitPlanet} in ${transitSign} activates your natal ${natalPlanet} in House ${natalHouse}.`;
}

export function generateSovereignKeys(): {
  primaryCode: string;
  sunRisingMoon: string;
  elementProfile: string;
  modalityProfile: string;
  dominantElement: string;
  dominantModality: string;
  lifePathNumber: number;
  sovereignFrequency: number;
  identityHash: string;
  generatedAt: string;
} {
  const chart = getFatherNatalChart();
  const sun = chart.planets.find((planet) => planet.name === "Sun");
  const moon = chart.planets.find((planet) => planet.name === "Moon");
  if (!sun || !moon) {
    throw new NatalChartNotConfiguredError("FATHER_NATAL_CHART_JSON is invalid");
  }

  const rising = chart.ascendant.sign;
  const sunRisingMoon = `${sun.sign.slice(0, 3).toUpperCase()}-${rising.slice(0, 3).toUpperCase()}-${moon.sign.slice(0, 3).toUpperCase()}`;

  const ELEMENTS: Record<string, string> = {
    Aries: "Fire", Leo: "Fire", Sagittarius: "Fire",
    Taurus: "Earth", Virgo: "Earth", Capricorn: "Earth",
    Gemini: "Air", Libra: "Air", Aquarius: "Air",
    Cancer: "Water", Scorpio: "Water", Pisces: "Water",
  };
  const MODALITIES: Record<string, string> = {
    Aries: "Cardinal", Cancer: "Cardinal", Libra: "Cardinal", Capricorn: "Cardinal",
    Taurus: "Fixed", Leo: "Fixed", Scorpio: "Fixed", Aquarius: "Fixed",
    Gemini: "Mutable", Virgo: "Mutable", Sagittarius: "Mutable", Pisces: "Mutable",
  };

  const elementCount: Record<string, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 };
  const modalityCount: Record<string, number> = { Cardinal: 0, Fixed: 0, Mutable: 0 };

  for (const planet of chart.planets) {
    const element = ELEMENTS[planet.sign];
    const modality = MODALITIES[planet.sign];
    if (element) elementCount[element] += 1;
    if (modality) modalityCount[modality] += 1;
  }

  const dominantElement = Object.entries(elementCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const dominantModality = Object.entries(modalityCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!dominantElement || !dominantModality) {
    throw new NatalChartNotConfiguredError("FATHER_NATAL_CHART_JSON is invalid");
  }

  const elementProfile = Object.entries(elementCount).map(([key, value]) => `${key}:${value}`).join(" | ");
  const modalityProfile = Object.entries(modalityCount).map(([key, value]) => `${key}:${value}`).join(" | ");

  const sealedSeed = createHash("sha256")
    .update(`${sun.sign}:${rising}:${moon.sign}:${dominantElement}:${dominantModality}`)
    .digest("hex")
    .slice(0, 12);
  const seedDigits = sealedSeed.split("").map((character) => parseInt(character, 16) || 0);
  let lifePathNumber = seedDigits.reduce((sum, digit) => sum + digit, 0);
  while (lifePathNumber > 9 && lifePathNumber !== 11 && lifePathNumber !== 22 && lifePathNumber !== 33) {
    lifePathNumber = lifePathNumber.toString().split("").map(Number).reduce((sum, digit) => sum + digit, 0);
  }

  const SOLFEGGIO = [396, 417, 528, 639, 741, 852, 963];
  const sovereignFrequency = SOLFEGGIO[(lifePathNumber - 1) % SOLFEGGIO.length];

  const hashInput = [
    "FATHER",
    sun.sign,
    rising,
    moon.sign,
    String(sun.degree),
    String(moon.degree),
    String(chart.ascendant.degree),
  ].join(":");
  const identityHash = createHash("sha256").update(hashInput).digest("hex").slice(0, 16).toUpperCase();
  const primaryCode = `TSR-${sunRisingMoon}-${lifePathNumber}-${identityHash.slice(0, 8)}`;

  return {
    primaryCode,
    sunRisingMoon,
    elementProfile,
    modalityProfile,
    dominantElement,
    dominantModality,
    lifePathNumber,
    sovereignFrequency,
    identityHash,
    generatedAt: new Date().toISOString(),
  };
}

export function computeCurrentTransits(now: Date = new Date()): TransitAspect[] {
  const natalPositions: NatalPosition[] = getFatherNatalChart().planets.map((planet) => ({
    name: planet.name,
    longitude: signDegreeToLongitude(planet.sign, planet.degree),
    house: planet.house,
    sign: planet.sign,
  }));

  const rawAspects = computeNatalTransits(natalPositions, now, 12);

  return rawAspects.map((aspect: TransitToNatalAspect) => ({
    transitPlanet: aspect.transitPlanet,
    natalPlanet: aspect.natalPlanet,
    aspectType: aspect.aspectType,
    orb: aspect.orb,
    symbol: aspect.symbol,
    nature: aspect.nature,
    insight: getTransitInsight(aspect.transitPlanet, aspect.aspectType, aspect.natalPlanet, aspect.transitSign, aspect.natalHouse),
    transitSign: aspect.transitSign,
    natalSign: aspect.natalSign,
    natalHouse: aspect.natalHouse,
  }));
}

export function getPlanetInterpretations(): Array<{
  name: string;
  sign: string;
  house: number;
  retrograde: boolean;
}> {
  return getFatherNatalChart().planets.map((planet) => ({
    name: planet.name,
    sign: planet.sign,
    house: planet.house,
    retrograde: planet.retrograde,
  }));
}

const LIFE_AREAS: Array<{ area: string; icon: string; color: string; planets: string[] }> = [
  { area: "Career & Purpose", icon: "⚡", color: "text-amber-400", planets: ["Sun", "Saturn", "Mars"] },
  { area: "Relationships & Love", icon: "💛", color: "text-rose-400", planets: ["Venus", "Moon", "Sun"] },
  { area: "Creativity & Expression", icon: "✨", color: "text-violet-400", planets: ["Uranus", "Neptune", "Venus", "Mars"] },
  { area: "Spirituality & Inner Life", icon: "🌀", color: "text-cyan-400", planets: ["North Node", "Jupiter", "Neptune", "Mars"] },
  { area: "Finances & Resources", icon: "🏛️", color: "text-emerald-400", planets: ["Saturn", "Moon", "Mercury"] },
  { area: "Communication & Learning", icon: "📡", color: "text-sky-400", planets: ["Mercury", "Pluto"] },
];

export function getLifeAreaGuidance(): Array<{
  area: string;
  icon: string;
  guidance: string;
  planets: string[];
  color: string;
}> {
  const byName = new Map(getFatherNatalChart().planets.map((planet) => [planet.name, planet]));
  return LIFE_AREAS.map((area) => {
    const present = area.planets.flatMap((name) => {
      const planet = byName.get(name);
      return planet ? [`${planet.name} house ${planet.house}`] : [];
    });
    return {
      area: area.area,
      icon: area.icon,
      color: area.color,
      planets: area.planets,
      guidance: present.length > 0 ? present.join("; ") : "No configured planets for this area.",
    };
  });
}
