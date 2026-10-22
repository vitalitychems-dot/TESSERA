import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

vi.mock("@workspace/db", () => ({ db: {} }));
vi.mock("@workspace/db/schema", () => ({ semanticCacheTable: {} }));
vi.mock("../lib/neural-embeddings", () => ({ generateEmbedding: async () => [], cosineSimilarity: () => 0 }));
vi.mock("../lib/tessera-codex", () => ({ getAllCodexEntries: async () => [], ensureCodexSeeded: async () => {} }));

import { fingerprintSystemContext } from "../lib/semantic-cache";
import { withCodexDirective } from "../lib/codex-startup-directive";

// Real fixture: the domain system prompts in sovereign-engine-router.ts, each wrapped by the
// real withCodexDirective() exactly as routeToEngine() sends them.
function domainPrompts(): string[] {
  const src = readFileSync(join(__dirname, "../lib/sovereign-engine-router.ts"), "utf8");
  const block = src.slice(src.indexOf("const DOMAIN_SYSTEM_PROMPTS"), src.indexOf("};", src.indexOf("const DOMAIN_SYSTEM_PROMPTS")));
  return [...block.matchAll(/^\s*[a-z_]+:\s*`([^`]+)`/gm)].map((m) => m[1]);
}

describe("semantic cache system fingerprint", () => {
  it("gives each distinct codex-wrapped system prompt its own fingerprint", () => {
    const prompts = domainPrompts();
    expect(prompts.length).toBeGreaterThan(3);
    const fps = new Set(prompts.map((p) => fingerprintSystemContext([{ role: "system", content: withCodexDirective(p) }, { role: "user", content: "q" }], "m")));
    console.log(`SYSFP distinct=${fps.size} of ${prompts.length}`);
    expect(fps.size).toBe(prompts.length);
  });
  it("is stable and model-scoped", () => {
    const m = [{ role: "system", content: "x".repeat(900) }];
    expect(fingerprintSystemContext(m, "a")).toBe(fingerprintSystemContext(m, "a"));
    expect(fingerprintSystemContext(m, "a")).not.toBe(fingerprintSystemContext(m, "b"));
    expect(fingerprintSystemContext([{ role: "user", content: "u" }], "a")).toBe("");
  });
});
