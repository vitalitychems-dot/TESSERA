import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { IDENTITY_HASHED_FILES, parseQuotes, type IdentityQuote } from "../lib/identity-source";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const IDENTITY_DIR = path.join(REPO_ROOT, "identity");

const quotes: IdentityQuote[] = IDENTITY_HASHED_FILES.flatMap((name) =>
  parseQuotes(readFileSync(path.join(IDENTITY_DIR, name), "utf8"), name),
);

describe("identity quotes against current code", () => {
  const codeQuotes = quotes.filter((q) => q.kind === "current-code");

  it("has current-code quotes to check", () => {
    expect(codeQuotes.length).toBeGreaterThan(0);
  });

  for (const q of codeQuotes) {
    it(`${q.id} (${q.file}) is still present verbatim in ${q.source}`, () => {
      const sourcePath = path.join(REPO_ROOT, q.source);
      expect(existsSync(sourcePath), `${q.source} must exist`).toBe(true);
      const content = readFileSync(sourcePath, "utf8");
      for (const line of q.lines) {
        expect(content.includes(line), `${q.id}: line no longer in ${q.source}: ${line.slice(0, 80)}`).toBe(true);
      }
    });
  }
});

describe("identity quotes from other sources are well formed", () => {
  it("gitbook-archive blocks name a Gitbook path and an 8-character blob", () => {
    for (const q of quotes.filter((x) => x.kind === "gitbook-archive")) {
      expect(q.source, q.id).toMatch(/^Gitbook:[^\s]+$/);
      expect(q.blob, q.id).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("git-history blocks name a repository path and a commit", () => {
    for (const q of quotes.filter((x) => x.kind === "git-history")) {
      expect(q.source, q.id).toMatch(/^[^\s@]+@[0-9a-f]{7,40}$/);
    }
  });

  it("quote ids are unique across files", () => {
    const ids = quotes.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
