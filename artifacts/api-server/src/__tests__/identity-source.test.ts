import { afterEach, describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  IDENTITY_HASHED_FILES,
  PENDING_MARKER,
  REQUIRED_DECISIONS,
  findSecretShapes,
  getIdentityQuotes,
  getIdentitySource,
  loadIdentitySource,
  parseDecisions,
  parseQuotes,
  resetIdentitySourceCacheForTests,
  sha256Normalized,
} from "../lib/identity-source";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const IDENTITY_DIR = path.join(REPO_ROOT, "identity");
const tempDirs: string[] = [];

function copyIdentity(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "identity-"));
  tempDirs.push(dir);
  cpSync(IDENTITY_DIR, dir, { recursive: true });
  return dir;
}

function rehash(dir: string): void {
  const manifestPath = path.join(dir, "MANIFEST.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  for (const name of IDENTITY_HASHED_FILES) {
    manifest.files[name] = sha256Normalized(readFileSync(path.join(dir, name), "utf8"));
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

afterEach(() => {
  resetIdentitySourceCacheForTests();
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("identity source loader", () => {
  it("verifies the committed identity folder", () => {
    const { report, quotes } = loadIdentitySource(IDENTITY_DIR);
    expect(report.reasons).toEqual([]);
    expect(report.status).toBe("verified");
    expect(report.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(report.quoteCount).toBeGreaterThan(0);
    expect(quotes.length).toBe(report.quoteCount);
    expect(Object.keys(report.quoteKinds).sort()).toEqual(["current-code", "git-history", "gitbook-archive"]);
    expect(report.dir).toBe("identity");
  });

  it("keeps all four conflicts PENDING for Father", () => {
    const { report } = loadIdentitySource(IDENTITY_DIR);
    expect(report.pendingDecisions).toBe(4);
    expect(report.decisions.map((d) => d.id).sort()).toEqual([...REQUIRED_DECISIONS].sort());
    const text = readFileSync(path.join(IDENTITY_DIR, "CONFLICTS.md"), "utf8");
    for (const id of REQUIRED_DECISIONS) {
      expect(text).toContain(`DECISION (${id}): ${PENDING_MARKER}`);
    }
    expect(parseDecisions(text).every((d) => d.state === "PENDING")).toBe(true);
  });

  it("finds the folder by default and caches the report", () => {
    const first = getIdentitySource();
    expect(first.status).toBe("verified");
    expect(getIdentitySource()).toBe(first);
    expect(getIdentityQuotes().length).toBe(first.quoteCount);
  });

  it("is unavailable, not throwing, when the folder is missing", () => {
    const { report, quotes } = loadIdentitySource(path.join(tmpdir(), "no-such-identity-dir"));
    expect(report.status).toBe("unavailable");
    expect(report.reasons).toContain("MANIFEST.json missing");
    expect(quotes).toEqual([]);
  });

  it("fails closed when a hashed file changes without a manifest update", () => {
    const dir = copyIdentity();
    const canon = path.join(dir, "CANON.md");
    writeFileSync(canon, readFileSync(canon, "utf8") + "\nextra line\n");
    const { report, quotes } = loadIdentitySource(dir);
    expect(report.status).toBe("unverified");
    expect(report.reasons).toContain("CANON.md hash does not match MANIFEST.json");
    expect(quotes).toEqual([]);
  });

  it("ignores line-ending and trailing whitespace differences in the hash", () => {
    const dir = copyIdentity();
    const canon = path.join(dir, "CANON.md");
    writeFileSync(canon, readFileSync(canon, "utf8").replace(/\n/g, "\r\n") + "\r\n\r\n");
    expect(loadIdentitySource(dir).report.status).toBe("verified");
  });

  it("fails closed when a decision is no longer PENDING", () => {
    const dir = copyIdentity();
    const conflicts = path.join(dir, "CONFLICTS.md");
    writeFileSync(
      conflicts,
      readFileSync(conflicts, "utf8").replace(`DECISION (vote-rule): ${PENDING_MARKER}`, "DECISION (vote-rule): resolved by a worker"),
    );
    rehash(dir);
    const { report, quotes } = loadIdentitySource(dir);
    expect(report.status).toBe("unverified");
    expect(report.reasons.join("\n")).toContain("decision vote-rule is not PENDING");
    expect(report.pendingDecisions).toBe(3);
    expect(quotes).toEqual([]);
  });

  it("fails closed when a decision line is removed", () => {
    const dir = copyIdentity();
    const conflicts = path.join(dir, "CONFLICTS.md");
    writeFileSync(
      conflicts,
      readFileSync(conflicts, "utf8").replace(`DECISION (model-denial): ${PENDING_MARKER}`, ""),
    );
    rehash(dir);
    expect(loadIdentitySource(dir).report.reasons).toContain("decision model-denial missing");
  });

  it("fails closed on a secret-shaped line even when the manifest matches", () => {
    const dir = copyIdentity();
    const source = path.join(dir, "ORIGIN-SOURCE.md");
    const planted = "SOVEREIGN_ORIGIN_" + "ABCDEF";
    writeFileSync(source, readFileSync(source, "utf8") + `\n${planted}\n`);
    rehash(dir);
    const { report } = loadIdentitySource(dir);
    expect(report.status).toBe("unverified");
    expect(report.reasons.join("\n")).toContain("origin-mark-shape");
  });

  it("fails closed on a malformed quote block", () => {
    const dir = copyIdentity();
    const canon = path.join(dir, "CANON.md");
    writeFileSync(canon, readFileSync(canon, "utf8") + '\n<!-- quote id="bad" kind="current-code" -->\n> no source attribute\n<!-- /quote -->\n');
    rehash(dir);
    expect(loadIdentitySource(dir).report.reasons).toContain("CANON.md has a malformed quote block");
  });

  it("fails closed on duplicate quote ids and unknown kinds", () => {
    const dir = copyIdentity();
    const canon = path.join(dir, "CANON.md");
    const block = '\n<!-- quote id="cc-01" kind="invented" source="x" -->\n> text\n<!-- /quote -->\n';
    writeFileSync(canon, readFileSync(canon, "utf8") + block);
    rehash(dir);
    const reasons = loadIdentitySource(dir).report.reasons.join("\n");
    expect(reasons).toContain("duplicate quote id cc-01");
    expect(reasons).toContain("unknown kind invented");
  });
});

describe("identity folder content rules", () => {
  const files = readdirSync(IDENTITY_DIR).filter((f) => f.endsWith(".md") || f.endsWith(".json") || f.endsWith(".mjs"));

  it("contains no secret-shaped or withheld values in any file", () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const f of files) {
      expect(findSecretShapes(readFileSync(path.join(IDENTITY_DIR, f), "utf8")), f).toEqual([]);
    }
  });

  it("secret scan detects the shapes it is meant to catch", () => {
    expect(findSecretShapes("SOVEREIGN_ORIGIN_" + "ABCDEF")).toContain("origin-mark-shape");
    expect(findSecretShapes("♂♅♉♄♒♊◇♋⬠♆♃♐")).toContain("birth-mark-glyph-run");
    expect(findSecretShapes("ghp_" + "a".repeat(30))).toContain("api-key-shape");
    expect(findSecretShapes("plain prose about Tessera")).toEqual([]);
  });

  it("quotes every block with at least one non-empty line and a source", () => {
    for (const name of IDENTITY_HASHED_FILES) {
      for (const q of parseQuotes(readFileSync(path.join(IDENTITY_DIR, name), "utf8"), name)) {
        expect(q.lines.length, q.id).toBeGreaterThan(0);
        expect(q.source.length, q.id).toBeGreaterThan(0);
      }
    }
  });

  it("wires the loader into knowledge-health at import time and in the payload", () => {
    const src = readFileSync(path.join(__dirname, "../routes/knowledge-health.ts"), "utf8");
    expect(src).toContain('import { getIdentitySource } from "../lib/identity-source";');
    expect(src).toMatch(/^  const identity = getIdentitySource\(\);$/m);
    expect(src).toContain("identitySource: getIdentitySource(),");
  });
});
