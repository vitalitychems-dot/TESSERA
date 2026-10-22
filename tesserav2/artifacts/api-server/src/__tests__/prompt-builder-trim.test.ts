import { describe, expect, it } from "vitest";
import { trimToBudget } from "../lib/prompt-builder";

const APPROX_CHARS_PER_TOKEN = 4;

/** Round-1 head-only trim, kept only as the retention baseline. */
function headOnlyTrim(text: string, maxTokens: number): string {
  const maxChars = maxTokens * APPROX_CHARS_PER_TOKEN;
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 30) + "\n…[truncated]";
}

function tokensForFraction(length: number, fraction: number): number {
  return Math.max(1, Math.floor((length * fraction) / APPROX_CHARS_PER_TOKEN));
}

function plantNeedleInLastTenth(length: number, needle: string): string {
  const filler = "x".repeat(length);
  const lastTenthStart = length - Math.floor(length * 0.1);
  const room = length - lastTenthStart - needle.length;
  const at = lastTenthStart + Math.floor(room / 2);
  return filler.slice(0, at) + needle + filler.slice(at + needle.length);
}

describe("trimToBudget head+tail", () => {
  it("keeps the head mark and an end needle that head-only drops", () => {
    const text = "HEAD_MARK " + "x".repeat(5000) + " TAIL_NEEDLE_42";
    const maxTokens = 80;
    const headOnly = headOnlyTrim(text, maxTokens);

    expect(text.length).toBeGreaterThan(maxTokens * APPROX_CHARS_PER_TOKEN);
    expect(headOnly.includes("TAIL_NEEDLE_42")).toBe(false);

    const trimmed = trimToBudget(text, maxTokens);
    expect(trimmed.includes("HEAD_MARK")).toBe(true);
    expect(trimmed.includes("TAIL_NEEDLE_42")).toBe(true);
  });

  it("retains more end needles than head-only under a 30% budget", () => {
    const docs = Array.from({ length: 20 }, (_, i) => {
      const needle = `NEEDLE_${String(i).padStart(2, "0")}_END`;
      const text = plantNeedleInLastTenth(3200 + i * 120, needle);
      return { text, needle };
    });

    let headOnly = 0;
    let headTail = 0;
    for (const doc of docs) {
      const maxTokens = tokensForFraction(doc.text.length, 0.3);
      if (headOnlyTrim(doc.text, maxTokens).includes(doc.needle)) headOnly += 1;
      if (trimToBudget(doc.text, maxTokens).includes(doc.needle)) headTail += 1;
    }

    const line = `PROMPT_TRIM needles headOnly=${headOnly} headTail=${headTail} n=20`;
    console.log(line);
    process.stdout.write(`${line}\n`);
    expect(headTail).toBeGreaterThan(headOnly);
  });
});
