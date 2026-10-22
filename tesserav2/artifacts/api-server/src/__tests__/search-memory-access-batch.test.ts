import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {} }));

const SOURCE_PATH = fileURLToPath(new URL("../lib/vector-memory.ts", import.meta.url));
const TOP_K_DEFAULT = 10;

function extractFunction(source: string, signature: string, nextSignature: string): string {
  const start = source.indexOf(signature);
  const end = source.indexOf(nextSignature, start + signature.length);
  if (start < 0 || end < 0) {
    throw new Error(`could not slice ${signature}`);
  }
  return source.slice(start, end).trim();
}

async function sequentialAccessUpdates(n: number): Promise<number> {
  let calls = 0;
  const updateOne = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 1));
  };
  for (let i = 0; i < n; i++) {
    await updateOne();
  }
  return calls;
}

async function batchedAccessUpdate(n: number): Promise<number> {
  if (n === 0) return 0;
  let calls = 0;
  const updateMany = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 1));
  };
  await updateMany();
  return calls;
}

describe("searchMemory accessCount batching", () => {
  const source = readFileSync(SOURCE_PATH, "utf8");
  const searchMemory = extractFunction(
    source,
    "export async function searchMemory",
    "export async function getMemoryStats",
  );

  it("bumps accessCount with one inArray update, not a per-id loop", () => {
    expect(source).toMatch(/import\s*\{[^}]*\binArray\b[^}]*\}\s*from\s*["']drizzle-orm["']/);
    expect(searchMemory).toContain("topK = 10");
    expect(searchMemory).not.toMatch(/for\s*\(\s*const\s+id\s+of\s+ids\s*\)/);
    expect(searchMemory).not.toMatch(/\.where\(\s*eq\(\s*vectorEmbeddingsTable\.id\s*,\s*id\s*\)\s*\)/);
    expect(searchMemory.match(/await\s+db\.update\(/g)?.length ?? 0).toBe(1);
    expect(searchMemory).toContain("inArray(vectorEmbeddingsTable.id, ids)");
    expect(searchMemory).toContain("accessCount: sql`${vectorEmbeddingsTable.accessCount} + 1`");
  });

  it("embedText (real, from vector-memory) still returns a 256-dim unit vector", async () => {
    // Imports the real function instead of a frozen source copy, so embedding
    // changes like R3-03 signed hashing (#284) don't break this batching test.
    const { embedText } = await import("../lib/vector-memory");
    const v = embedText("surface code threshold under code capacity noise");
    expect(v).toHaveLength(256);
    expect(Math.hypot(...v)).toBeCloseTo(1, 6);
    expect(embedText("")).toEqual(new Array(256).fill(0));
  });

  it("collapses N sequential access updates into 1", async () => {
    const before = await sequentialAccessUpdates(TOP_K_DEFAULT);
    const after = await batchedAccessUpdate(TOP_K_DEFAULT);
    const line = `ACCESS_COUNT_UPDATES before=${before} after=${after}`;
    console.log(line);
    expect(before).toBe(TOP_K_DEFAULT);
    expect(after).toBe(1);
    expect(line).toBe("ACCESS_COUNT_UPDATES before=10 after=1");
  });
});
