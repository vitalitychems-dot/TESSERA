import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Every handler for these paths, in every route file, must carry
// requireAdminSession. Duplicates that register first would otherwise answer
// anonymously ahead of the gated legacy-engines handler.
const ROUTES_DIR = fileURLToPath(new URL("../routes/", import.meta.url));
const OWNER_ONLY = [
  "/consensus/proposals", "/consensus/propose", "/improvement/cycle",
  "/consciousness/state", "/emotional/profile", "/dual-brain/state",
  "/heartbeat/metrics", "/heartbeat/start", "/heartbeat/stop",
  "/universe/metrics", "/universe/parameters", "/universe/snapshot", "/universe/simulate",
  "/quantum/metrics", "/quantum/state", "/quantum/gate", "/quantum/measure",
  "/truthfulness/metrics", "/truthfulness/analyze", "/truthfulness/verify-claim",
];

function handlers(path: string): { file: string; line: string }[] {
  const out: { file: string; line: string }[] = [];
  for (const file of readdirSync(ROUTES_DIR).filter((f) => f.endsWith(".ts"))) {
    for (const line of readFileSync(join(ROUTES_DIR, file), "utf8").split("\n")) {
      if (line.includes(`router.get("${path}"`) || line.includes(`router.post("${path}"`)) out.push({ file, line });
    }
  }
  return out;
}

describe("shadow-route admin gate", () => {
  for (const path of OWNER_ONLY) {
    it(`every ${path} handler requires an owner session`, () => {
      const found = handlers(path);
      expect(found.length).toBeGreaterThan(0);
      for (const h of found) expect(h.line, `${h.file}: ${h.line.trim()}`).toMatch(/requireAdminSession/);
    });
  }

  it("keeps hallucination-check public", () => {
    const found = handlers("/truthfulness/hallucination-check");
    expect(found.length).toBe(1);
    expect(found[0]!.line).not.toMatch(/requireAdminSession/);
  });

  it("the gate itself was not loosened", () => {
    const src = readFileSync(fileURLToPath(new URL("../lib/sovereign-admin.ts", import.meta.url)), "utf8");
    expect(src).toMatch(/res\.status\(401\)/);
    expect(src).toMatch(/Privileged surfaces are fail-closed/);
  });
});
