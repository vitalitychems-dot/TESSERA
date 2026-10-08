import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const API_SOURCE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const TESSERA_SOURCE_ROOT = fileURLToPath(new URL("../../../tessera/src", import.meta.url));

const PATTERNS = {
  degreeLiteral: /degree\s*[:=]\s*["']?\d/g,
  birthDateLiteral: /birthDate\s*:\s*["']/g,
  fatherNatalConst: /const FATHER_NATAL\b/g,
  nameSignObject: /\{\s*name:\s*["'][^"']+["'][^}]*sign:\s*["']/g,
  identityFns: /function verifyIdentity\b|function getIdentityQuestions\b|function buildVerificationCheckers\b/g,
  identityRoutes: /identity\/questions|identity\/verify/g,
  placementLongitude: new RegExp(
    [
      String.raw`\b(?:asc(?:endant)?(?:lon|longitude)?|mc(?:lon|longitude)?|midheaven(?:lon|longitude)?|(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|lilith|node|house)(?:\d+)?(?:lon|longitude))\b\s*[:=]\s*-?\d+(?:\.\d+)?`,
      String.raw`\b(?:asc|ascendant|mc|midheaven|sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|lilith|node|house\d*)\w{0,24}\s*=\s*[A-Za-z_][\w.]*\(\s*["'][A-Za-z]+["']\s*,\s*\d`,
      String.raw`\bsignToStartDeg\(\s*["'](?:Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)["']\s*,\s*\d`,
    ].join("|"),
    "gi",
  ),
} as const;

const ZERO_COUNTS: Record<keyof typeof PATTERNS, number> = {
  degreeLiteral: 0,
  birthDateLiteral: 0,
  fatherNatalConst: 0,
  nameSignObject: 0,
  identityFns: 0,
  identityRoutes: 0,
  placementLongitude: 0,
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if ((name.endsWith(".ts") || name.endsWith(".tsx")) && !name.includes(".test.")) out.push(path);
  }
  return out;
}

function countPatterns(root: string): Record<keyof typeof PATTERNS, number> {
  const counts = { ...ZERO_COUNTS };
  for (const file of walk(root)) {
    const text = readFileSync(file, "utf8");
    for (const key of Object.keys(PATTERNS) as Array<keyof typeof PATTERNS>) {
      const pattern = new RegExp(PATTERNS[key].source, PATTERNS[key].flags);
      counts[key] += text.match(pattern)?.length ?? 0;
    }
  }
  return counts;
}

describe("placement literal guard", () => {
  it("counts hard-coded natal placement literals in api-server source as zero", () => {
    expect(countPatterns(API_SOURCE_ROOT)).toEqual(ZERO_COUNTS);
  });

  it("counts hard-coded natal placement literals in tessera source as zero", () => {
    expect(countPatterns(TESSERA_SOURCE_ROOT)).toEqual(ZERO_COUNTS);
  });

  it("flags numeric longitude constants tied to ascendant, midheaven, planet, or house names", () => {
    const pattern = new RegExp(PATTERNS.placementLongitude.source, PATTERNS.placementLongitude.flags);
    for (const sample of [
      "const ascLon = 1;",
      "const ascendantLongitude = 2;",
      "const mcLon = 3;",
      "const sunLon = 4;",
      "const houseLon = 5;",
    ]) {
      expect(sample.match(pattern), sample).not.toBeNull();
    }

    const derived = "const ascLon = signToStartDeg(ascendant.sign, ascendant.degree);";
    expect(derived.match(new RegExp(pattern.source, pattern.flags))).toBeNull();
  });
});
