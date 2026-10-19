import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

vi.mock("../lib/logger", () => {
  const logger: Record<string, unknown> = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
  logger.child = () => logger;
  return { logger };
});

const SRC = path.resolve(__dirname, "..");

const ORPHANS = [
  "centrality-boundary",
  "grand-council-universalis",
  "income-executor",
  "moltbook-sandbox-test",
  "prompt-builder",
] as const;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return entry === "__tests__" || entry === "node_modules" ? [] : walk(full);
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

describe("orphan lib modules are documented and not silently wired in", () => {
  const productionFiles = walk(SRC);
  const doc = readFileSync(path.resolve(SRC, "../../../docs/ORPHAN-LIB-MODULES.md"), "utf8");

  for (const name of ORPHANS) {
    it(`${name} has no production importer and is documented`, () => {
      const importer = new RegExp(`["'][^"'\\n]*/${name}(?:\\.js|\\.ts)?["']`);
      const hits = productionFiles
        .filter((f) => !f.endsWith(`/lib/${name}.ts`))
        .filter((f) => importer.test(readFileSync(f, "utf8")))
        .map((f) => path.relative(SRC, f));
      expect(hits, `${name} is now imported by production code; update docs/ORPHAN-LIB-MODULES.md`).toEqual([]);
      expect(doc).toContain(`lib/${name}.ts`);
    });
  }
});

describe("centrality-boundary", () => {
  it("declares sovereign contexts as a no-op and rejects centrality calls with a recorded violation", async () => {
    const mod = await import("../lib/centrality-boundary");
    expect(() => mod.assertSovereignContext("council")).not.toThrow();
    const before = mod.getCentralityViolations().length;
    expect(() => mod.rejectCentralityInSovereignPath("council", "openai", "unit test")).toThrow(
      /CENTRALITY_BOUNDARY_VIOLATION: openai called from sovereign context "council"/,
    );
    expect(mod.getCentralityViolations().length).toBe(before + 1);
    expect(() => mod.declareSandboxedUse("anthropic", "training", "unit test")).not.toThrow();
    expect(mod.CENTRALITY_DOCTRINE).toContain("NEVER AUTHORITIES");
  });
});

describe("grand-council-universalis", () => {
  it("convene() returns an all-yea unanimous record: the votes are hard-coded, not deliberated", async () => {
    const { convene } = await import("../lib/grand-council-universalis");
    const record = convene();
    expect(record.votes.length).toBeGreaterThan(0);
    expect(record.votes.every((v) => v.vote === "yea")).toBe(true);
    expect(record.tally).toMatchObject({ yea: record.votes.length, nay: 0, abstain: 0, total: record.votes.length });
    expect(record.tally.threshold).toBe(Math.ceil((record.votes.length * 2) / 3));
    expect(record.ratified).toBe(true);
    const source = readFileSync(path.join(SRC, "lib/grand-council-universalis.ts"), "utf8");
    expect(source).toMatch(/vote: "yea",\s*\n\s*reasoning: `\$\{m\.domain\} satisfied/);
    const registry = readFileSync(path.join(SRC, "lib/tool-registry.ts"), "utf8");
    expect(registry).toContain('name: "convene_grand_council_universalis"');
    expect(registry).not.toMatch(/\bconvene\s*\(/);
  });
});

describe("moltbook-sandbox-test", () => {
  it("is a stale standalone script: it forbids every relative import, which the live boundary test allows for ./shepherd-outbound", () => {
    const stale = readFileSync(path.join(SRC, "lib/moltbook-sandbox-test.ts"), "utf8");
    const live = readFileSync(path.join(SRC, "__tests__/moltbook-sandbox-boundary.test.ts"), "utf8");
    const bridge = readFileSync(path.join(SRC, "lib/moltbook-bridge.ts"), "utf8");
    expect(stale).toContain('/import\\s+.*from\\s+["\']\\.\\.?\\//');
    expect(live).toContain('toEqual(["./shepherd-outbound"])');
    expect(bridge).toMatch(/from\s+["']\.\/shepherd-outbound["']/);
  });
});

describe("income-executor", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("is not started by import and has no production caller", () => {
    const source = readFileSync(path.join(SRC, "lib/income-executor.ts"), "utf8");
    expect(source).toMatch(/export function startIncomeExecutor\(\): void/);
    expect(source).not.toMatch(/^startIncomeExecutor\(\)/m);
    const callers = walk(SRC)
      .filter((f) => !f.endsWith("/lib/income-executor.ts"))
      .filter((f) => /startIncomeExecutor\s*\(/.test(readFileSync(f, "utf8")));
    expect(callers).toEqual([]);
  });
});

describe("prompt-builder", () => {
  it("buildPrompt places the system prompt first and the user query last without truncating a short prompt", async () => {
    const { buildPrompt } = await import("../lib/prompt-builder");
    const built = buildPrompt({ systemPrompt: "SYSTEM_TEXT", userQuery: "USER_QUERY_TEXT" });
    expect(built.truncated).toBe(false);
    expect(built.messages[0].role).toBe("system");
    expect(String(built.messages[0].content)).toContain("SYSTEM_TEXT");
    const last = built.messages[built.messages.length - 1];
    expect(last.role).toBe("user");
    expect(String(last.content)).toContain("USER_QUERY_TEXT");
  });
});
