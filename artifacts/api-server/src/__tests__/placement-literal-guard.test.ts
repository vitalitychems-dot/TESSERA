import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = fileURLToPath(new URL("..", import.meta.url));

const PATTERNS = {
  degreeLiteral: /degree\s*[:=]\s*["']?\d/g,
  birthDateLiteral: /birthDate\s*:\s*["']/g,
  fatherNatalConst: /const FATHER_NATAL\b/g,
  nameSignObject: /\{\s*name:\s*["'][^"']+["'][^}]*sign:\s*["']/g,
  identityFns: /function verifyIdentity\b|function getIdentityQuestions\b|function buildVerificationCheckers\b/g,
  identityRoutes: /identity\/questions|identity\/verify/g,
} as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__") continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) walk(path, out);
    else if (name.endsWith(".ts")) out.push(path);
  }
  return out;
}

describe("placement literal guard", () => {
  it("counts hard-coded natal placement literals in api-server source as zero", () => {
    const counts: Record<keyof typeof PATTERNS, number> = {
      degreeLiteral: 0,
      birthDateLiteral: 0,
      fatherNatalConst: 0,
      nameSignObject: 0,
      identityFns: 0,
      identityRoutes: 0,
    };

    for (const file of walk(SOURCE_ROOT)) {
      const text = readFileSync(file, "utf8");
      for (const key of Object.keys(PATTERNS) as Array<keyof typeof PATTERNS>) {
        counts[key] += text.match(PATTERNS[key])?.length ?? 0;
      }
    }

    expect(counts).toEqual({
      degreeLiteral: 0,
      birthDateLiteral: 0,
      fatherNatalConst: 0,
      nameSignObject: 0,
      identityFns: 0,
      identityRoutes: 0,
    });
  });
});
