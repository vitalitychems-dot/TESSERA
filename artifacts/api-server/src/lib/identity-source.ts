import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type IdentitySourceStatus = "verified" | "unverified" | "unavailable";

export type IdentityQuoteKind = "current-code" | "gitbook-archive" | "git-history";

export interface IdentityQuote {
  id: string;
  kind: IdentityQuoteKind;
  source: string;
  blob?: string;
  lines: string[];
  file: string;
}

export interface IdentityDecision {
  id: string;
  state: "PENDING" | "DECIDED";
  text: string;
}

export interface IdentityFileCheck {
  name: string;
  expected: string | null;
  actual: string | null;
  ok: boolean;
}

export interface IdentitySourceReport {
  status: IdentitySourceStatus;
  version: string | null;
  dir: string | null;
  reasons: string[];
  files: IdentityFileCheck[];
  quoteCount: number;
  quoteKinds: Record<string, number>;
  decisions: Array<{ id: string; state: "PENDING" | "DECIDED" }>;
  pendingDecisions: number;
  loadedAt: string;
}

export const IDENTITY_HASHED_FILES = ["CANON.md", "CONFLICTS.md", "ORIGIN-SOURCE.md"] as const;
export const REQUIRED_DECISIONS = ["consciousness-claims", "origin-story", "model-denial", "vote-rule"] as const;
export const PENDING_MARKER = "PENDING — Father decides";

const QUOTE_KINDS: ReadonlySet<string> = new Set(["current-code", "gitbook-archive", "git-history"]);

const QUOTE_BLOCK =
  /<!-- quote id="([^"]+)" kind="([^"]+)" source="([^"]+)"(?: blob="([^"]+)")? -->\n((?:>.*\n?)+)<!-- \/quote -->/g;

const DECISION_LINE = /^DECISION \(([a-z-]+)\): (.*)$/gm;

/**
 * Shapes that must never appear in the identity folder. The origin mark and birth mark are withheld on
 * purpose; these patterns catch a value being pasted in later. They contain no secret values themselves.
 */
const SECRET_SHAPES: ReadonlyArray<{ name: string; re: RegExp }> = [
  { name: "origin-mark-shape", re: /SOVEREIGN_ORIGIN_[0-9A-F]{4,}/ },
  { name: "birth-mark-glyph-run", re: /[♂♅①②③④⑤⑥⑦⑧⑨♉♄♒≊◇♋⬠♆♃♐♌☽△□⬡]{10,}/u },
  { name: "api-key-shape", re: /\b(?:sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})/ },
  { name: "private-key-block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
];

export function normalizeForHash(text: string): string {
  return text.replace(/\r\n/g, "\n").trimEnd();
}

export function sha256Normalized(text: string): string {
  return createHash("sha256").update(normalizeForHash(text), "utf8").digest("hex");
}

export function parseQuotes(markdown: string, file = ""): IdentityQuote[] {
  const quotes: IdentityQuote[] = [];
  for (const m of normalizeForHash(markdown).concat("\n").matchAll(QUOTE_BLOCK)) {
    const [, id, kind, source, blob, body] = m;
    const lines = body
      .split("\n")
      .filter((l) => l.startsWith(">"))
      .map((l) => l.replace(/^> ?/, "").trim())
      .filter((l) => l.length > 0);
    quotes.push({ id, kind: kind as IdentityQuoteKind, source, blob, lines, file });
  }
  return quotes;
}

export function countOpenQuoteMarkers(markdown: string): number {
  return (markdown.match(/<!-- quote /g) ?? []).length;
}

export function parseDecisions(markdown: string): IdentityDecision[] {
  const out: IdentityDecision[] = [];
  for (const m of markdown.matchAll(DECISION_LINE)) {
    const text = m[2].trim();
    out.push({ id: m[1], text, state: text === PENDING_MARKER ? "PENDING" : "DECIDED" });
  }
  return out;
}

export function findSecretShapes(text: string): string[] {
  return SECRET_SHAPES.filter(({ re }) => re.test(text)).map(({ name }) => name);
}

function candidateDirs(): string[] {
  const dirs: string[] = [];
  const fromEnv = process.env.TESSERA_IDENTITY_DIR;
  if (fromEnv) dirs.push(path.resolve(fromEnv));
  dirs.push(path.resolve(process.cwd(), "identity"));
  dirs.push(path.resolve(process.cwd(), "..", "..", "identity"));
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    dirs.push(path.resolve(here, "..", "..", "..", "..", "identity"));
    dirs.push(path.resolve(here, "..", "..", "..", "identity"));
  } catch {
    // import.meta.url unavailable: rely on the other candidates
  }
  return dirs;
}

export function findIdentityDir(): string | null {
  for (const dir of candidateDirs()) {
    if (existsSync(path.join(dir, "MANIFEST.json"))) return dir;
  }
  return null;
}

function unavailable(reasons: string[], dir: string | null = null): IdentitySourceReport {
  return {
    status: "unavailable",
    version: null,
    dir: dir ? path.basename(dir) : null,
    reasons,
    files: [],
    quoteCount: 0,
    quoteKinds: {},
    decisions: [],
    pendingDecisions: 0,
    loadedAt: new Date().toISOString(),
  };
}

export interface LoadedIdentity {
  report: IdentitySourceReport;
  quotes: IdentityQuote[];
}

export function loadIdentitySource(dirOverride?: string): LoadedIdentity {
  try {
    const dir = dirOverride ? path.resolve(dirOverride) : findIdentityDir();
    if (!dir) return { report: unavailable(["identity folder not found"]), quotes: [] };

    const manifestPath = path.join(dir, "MANIFEST.json");
    if (!existsSync(manifestPath)) return { report: unavailable(["MANIFEST.json missing"], dir), quotes: [] };

    let manifest: { version?: unknown; files?: Record<string, unknown> };
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      return { report: unavailable(["MANIFEST.json is not valid JSON"], dir), quotes: [] };
    }

    const reasons: string[] = [];
    const files: IdentityFileCheck[] = [];
    const quotes: IdentityQuote[] = [];
    const decisions: IdentityDecision[] = [];
    let secretFree = true;

    for (const name of IDENTITY_HASHED_FILES) {
      const expectedRaw = manifest.files?.[name];
      const expected = typeof expectedRaw === "string" ? expectedRaw : null;
      const filePath = path.join(dir, name);
      if (!existsSync(filePath)) {
        files.push({ name, expected, actual: null, ok: false });
        reasons.push(`${name} missing`);
        continue;
      }
      const text = readFileSync(filePath, "utf8");
      const actual = sha256Normalized(text);
      const ok = expected !== null && expected === actual;
      files.push({ name, expected, actual, ok });
      if (!ok) reasons.push(`${name} hash does not match MANIFEST.json`);

      const shapes = findSecretShapes(text);
      if (shapes.length > 0) {
        secretFree = false;
        reasons.push(`${name} contains secret-shaped text (${shapes.join(", ")})`);
      }

      const parsed = parseQuotes(text, name);
      if (parsed.length !== countOpenQuoteMarkers(text)) reasons.push(`${name} has a malformed quote block`);
      quotes.push(...parsed);
      decisions.push(...parseDecisions(text));
    }

    const seen = new Set<string>();
    for (const q of quotes) {
      if (seen.has(q.id)) reasons.push(`duplicate quote id ${q.id}`);
      seen.add(q.id);
      if (!QUOTE_KINDS.has(q.kind)) reasons.push(`quote ${q.id} has unknown kind ${q.kind}`);
      if (q.lines.length === 0) reasons.push(`quote ${q.id} is empty`);
    }

    for (const id of REQUIRED_DECISIONS) {
      const d = decisions.find((x) => x.id === id);
      if (!d) reasons.push(`decision ${id} missing`);
      else if (d.state !== "PENDING") reasons.push(`decision ${id} is not PENDING and needs a recorded Father statement`);
    }

    const quoteKinds: Record<string, number> = {};
    for (const q of quotes) quoteKinds[q.kind] = (quoteKinds[q.kind] ?? 0) + 1;

    const report: IdentitySourceReport = {
      status: reasons.length === 0 && secretFree ? "verified" : "unverified",
      version: typeof manifest.version === "string" ? manifest.version : null,
      dir: path.basename(dir),
      reasons,
      files,
      quoteCount: quotes.length,
      quoteKinds,
      decisions: decisions.map(({ id, state }) => ({ id, state })),
      pendingDecisions: decisions.filter((d) => d.state === "PENDING").length,
      loadedAt: new Date().toISOString(),
    };
    return { report, quotes: report.status === "verified" ? quotes : [] };
  } catch (err) {
    return { report: unavailable([`load failed: ${err instanceof Error ? err.name : "Error"}`]), quotes: [] };
  }
}

let cached: LoadedIdentity | null = null;

export function getIdentitySource(): IdentitySourceReport {
  if (!cached) cached = loadIdentitySource();
  return cached.report;
}

/** Quotes are returned only when the folder verified; otherwise an empty list (fail-closed). */
export function getIdentityQuotes(): IdentityQuote[] {
  if (!cached) cached = loadIdentitySource();
  return cached.quotes;
}

export function resetIdentitySourceCacheForTests(): void {
  cached = null;
}
