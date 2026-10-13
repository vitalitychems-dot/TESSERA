import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SOURCE_PATH = fileURLToPath(new URL("../lib/vector-memory.ts", import.meta.url));
const TOP_K_DEFAULT = 10;

/** Signed embedText owned by R3-03. Later passes must not rewrite this hash. */
const EMBED_TEXT_SOURCE = `export function embedText(text: string, _vocab?: string[]): number[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) return new Array(256).fill(0);
  const vec = new Array(256).fill(0);
  for (let i = 0; i < tokens.length; i++) {
    let h = 0;
    for (let j = 0; j < tokens[i].length; j++) h = ((h << 5) - h + tokens[i].charCodeAt(j)) | 0;
    const a = Math.abs(h);
    const idx = a % 256;
    const sign = (a >> 16) & 1 ? 1 : -1;
    vec[idx] += sign / tokens.length;
  }
  const mag = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0));
  if (mag > 0) for (let i = 0; i < vec.length; i++) vec[i] /= mag;
  return vec;
}`;

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

  it("does not change embedText", () => {
    const embedText = extractFunction(source, "export function embedText", "export async function storeMemory");
    expect(embedText).toBe(EMBED_TEXT_SOURCE);
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
