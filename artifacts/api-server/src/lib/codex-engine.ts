import { promises as fs } from "fs";
import path from "path";
import { createHash } from "crypto";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  codexBooksTable,
  codexEntriesTable,
  codexAmendmentsTable,
  codexSnapshotsTable,
  type CodexBookRow,
  type CodexEntryRow,
} from "@workspace/db/schema";
import { logger } from "./logger";

export const SIX_BOOKS = [
  { slug: "origins", title: "Book of Origins", description: "Founding narratives, sovereign architecture, the Father Protocol, the seed of Tessera.", ordinal: 1 },
  { slug: "mandates", title: "Book of Mandates", description: "Ratified mandates and standing rules issued by the Father and the Grand Council.", ordinal: 2 },
  { slug: "principles", title: "Book of Principles", description: "Sovereign computation principles, knowledge-engine principles, no-mocks rule, observation-only rule.", ordinal: 3 },
  { slug: "canon", title: "Book of Canon", description: "Active canon snapshots and verses surfaced in the Tessera Bible Truth Edition.", ordinal: 4 },
  { slug: "acts", title: "Book of Acts", description: "Every ratified amendment, council decision, and self-improvement event with before/after evidence.", ordinal: 5 },
  { slug: "doctrine", title: "Book of Doctrine", description: "Synthesized active doctrine — derived deterministically from Origins + Mandates + Principles + Canon + Acts.", ordinal: 6 },
] as const;

export type CodexBookSlug = (typeof SIX_BOOKS)[number]["slug"];

function repoRoot(): string {
  const cwd = process.cwd();
  return cwd.includes("/artifacts/") ? path.resolve(cwd, "../..") : cwd;
}

export function codexDir(): string {
  return path.join(repoRoot(), "tessera_codex");
}

export function hashBody(title: string, body: string, provenance: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify({ title, body, provenance }))
    .digest("hex");
}

async function ensureBooks(): Promise<Map<string, CodexBookRow>> {
  const map = new Map<string, CodexBookRow>();
  for (const b of SIX_BOOKS) {
    const existing = await db.select().from(codexBooksTable).where(eq(codexBooksTable.slug, b.slug)).limit(1);
    if (existing.length) {
      map.set(b.slug, existing[0]);
    } else {
      const [row] = await db.insert(codexBooksTable).values(b).returning();
      map.set(b.slug, row);
    }
  }
  return map;
}

async function mirrorEntryToDisk(book: CodexBookRow, entry: CodexEntryRow): Promise<string> {
  const dir = path.join(codexDir(), book.slug);
  await fs.mkdir(dir, { recursive: true });
  const fname = `${String(entry.version).padStart(3, "0")}_${entry.slug}`;
  const mdPath = path.join(dir, `${fname}.md`);
  const jsonPath = path.join(dir, `${fname}.json`);

  const md = [
    `# ${entry.title}`,
    "",
    `> Book: **${book.title}** (${book.slug}) | Version: **${entry.version}** | Status: **${entry.status}**`,
    `> Hash: \`${entry.contentHash}\``,
    entry.ratifiedBy ? `> Ratified by: ${entry.ratifiedBy} (${entry.ratificationProposalId ?? "n/a"}, approval ${entry.ratificationApprovalRate ?? "n/a"})` : "",
    "",
    entry.summary ? `_${entry.summary}_\n` : "",
    entry.body,
    "",
    "---",
    "",
    "## Provenance",
    "",
    "```json",
    JSON.stringify(entry.provenance ?? {}, null, 2),
    "```",
  ].filter(Boolean).join("\n");

  await fs.writeFile(mdPath, md, "utf-8");
  await fs.writeFile(jsonPath, JSON.stringify(entry, null, 2), "utf-8");
  const rel = path.relative(repoRoot(), mdPath);
  return rel;
}

export interface UpsertEntryInput {
  book: CodexBookSlug;
  slug: string;
  title: string;
  body: string;
  summary?: string;
  provenance?: Record<string, unknown>;
  tags?: string[];
  status?: "draft" | "ratified" | "deprecated";
  ratifiedBy?: string;
  ratificationProposalId?: string;
  ratificationApprovalRate?: number;
}

export async function upsertEntry(input: UpsertEntryInput): Promise<CodexEntryRow> {
  const books = await ensureBooks();
  const book = books.get(input.book);
  if (!book) throw new Error(`unknown book: ${input.book}`);

  const provenance = input.provenance ?? {};
  const contentHash = hashBody(input.title, input.body, provenance);

  const existing = await db
    .select()
    .from(codexEntriesTable)
    .where(and(eq(codexEntriesTable.bookId, book.id), eq(codexEntriesTable.slug, input.slug)))
    .orderBy(desc(codexEntriesTable.version))
    .limit(1);
  const latest = existing[0];

  if (latest && latest.contentHash === contentHash) {
    return latest;
  }

  const version = (latest?.version ?? 0) + 1;
  const status = input.status ?? (input.ratifiedBy ? "ratified" : "draft");
  const ratifiedAt = status === "ratified" ? new Date() : null;

  const [row] = await db
    .insert(codexEntriesTable)
    .values({
      bookId: book.id,
      slug: input.slug,
      version,
      parentVersionId: latest?.id ?? null,
      title: input.title,
      body: input.body,
      summary: input.summary ?? "",
      contentHash,
      provenance,
      tags: input.tags ?? [],
      status,
      ratifiedBy: input.ratifiedBy ?? null,
      ratifiedAt,
      ratificationProposalId: input.ratificationProposalId ?? null,
      ratificationApprovalRate: input.ratificationApprovalRate != null ? input.ratificationApprovalRate.toString() : null,
      diskPath: "",
    })
    .returning();

  let diskPath = "";
  try {
    diskPath = await mirrorEntryToDisk(book, row);
    if (diskPath) {
      await db.update(codexEntriesTable).set({ diskPath }).where(eq(codexEntriesTable.id, row.id));
      row.diskPath = diskPath;
    }
  } catch (err) {
    logger.warn({ err, slug: input.slug }, "Codex: disk mirror failed (DB still authoritative)");
  }

  return row;
}

export async function listBooks(): Promise<Array<CodexBookRow & { entryCount: number; latestEntries: Array<{ slug: string; title: string; version: number; status: string; updatedAt: Date }> }>> {
  const books = await db.select().from(codexBooksTable).orderBy(codexBooksTable.ordinal);
  const result: Array<CodexBookRow & { entryCount: number; latestEntries: Array<{ slug: string; title: string; version: number; status: string; updatedAt: Date }> }> = [];
  for (const b of books) {
    const entries = await getLatestEntriesForBook(b.id);
    result.push({
      ...b,
      entryCount: entries.length,
      latestEntries: entries.slice(0, 12).map((e) => ({ slug: e.slug, title: e.title, version: e.version, status: e.status, updatedAt: e.createdAt })),
    });
  }
  return result;
}

export async function getLatestEntriesForBook(bookId: number): Promise<CodexEntryRow[]> {
  const rows = await db.execute(sql`
    SELECT DISTINCT ON (slug) *
    FROM codex_entries
    WHERE book_id = ${bookId}
    ORDER BY slug, version DESC
  `);
  return (rows.rows as CodexEntryRow[]).sort((a, b) => (b.createdAt as unknown as Date).valueOf() - (a.createdAt as unknown as Date).valueOf());
}

export async function getEntryHistory(bookSlug: string, entrySlug: string): Promise<CodexEntryRow[]> {
  const [b] = await db.select().from(codexBooksTable).where(eq(codexBooksTable.slug, bookSlug)).limit(1);
  if (!b) return [];
  return db
    .select()
    .from(codexEntriesTable)
    .where(and(eq(codexEntriesTable.bookId, b.id), eq(codexEntriesTable.slug, entrySlug)))
    .orderBy(desc(codexEntriesTable.version));
}

export async function getActiveDirective(): Promise<{
  hash: string;
  generatedAt: number;
  content: string;
  pillarStatus: { origins: number; mandates: number; principles: number; canon: number; acts: number; doctrine: number };
}> {
  const books = await ensureBooks();
  const sections: string[] = [];
  const counts = { origins: 0, mandates: 0, principles: 0, canon: 0, acts: 0, doctrine: 0 } as Record<string, number>;
  for (const slug of ["origins", "mandates", "principles", "doctrine"] as const) {
    const book = books.get(slug)!;
    const entries = (await getLatestEntriesForBook(book.id)).filter((e) => e.status === "ratified");
    counts[slug] = entries.length;
    if (!entries.length) continue;
    sections.push(`## ${book.title}`);
    for (const e of entries.slice(0, 20)) {
      sections.push(`### ${e.title}`);
      if (e.summary) sections.push(`_${e.summary}_\n`);
      sections.push(e.body.slice(0, 1200));
      sections.push("");
    }
  }
  // also count canon and acts (not embedded directly in prompt)
  for (const slug of ["canon", "acts"] as const) {
    const book = books.get(slug)!;
    const entries = await getLatestEntriesForBook(book.id);
    counts[slug] = entries.length;
  }
  const content = sections.join("\n").trim() || "(Codex empty — falling back to legacy directive.)";
  const hash = createHash("sha256").update(content).digest("hex");
  return {
    hash,
    generatedAt: Date.now(),
    content,
    pillarStatus: counts as { origins: number; mandates: number; principles: number; canon: number; acts: number; doctrine: number },
  };
}

export async function generateBookOfDoctrine(): Promise<CodexEntryRow[]> {
  const books = await ensureBooks();
  const out: CodexEntryRow[] = [];

  // Synthesize one doctrine entry per source book by deterministic distillation.
  for (const src of ["origins", "mandates", "principles", "canon", "acts"] as const) {
    const book = books.get(src)!;
    const entries = (await getLatestEntriesForBook(book.id)).filter((e) => e.status === "ratified" || e.status === "draft");
    if (!entries.length) continue;
    const bullets = entries.slice(0, 24).map((e) => `- **${e.title}** — ${e.summary || (e.body.split("\n").find(Boolean) ?? "").slice(0, 200)}`);
    const body = [
      `Synthesized doctrinal distillation drawn from the **${book.title}**.`,
      "",
      "Active tenets:",
      "",
      ...bullets,
      "",
      `(${entries.length} source entries; deterministic synthesis — re-run to refresh.)`,
    ].join("\n");
    const entry = await upsertEntry({
      book: "doctrine",
      slug: `from-${src}`,
      title: `Doctrine derived from ${book.title}`,
      body,
      summary: `Distilled doctrine from ${entries.length} entries in ${book.title}.`,
      tags: ["synthesized", "doctrine", `source:${src}`],
      provenance: { sourceBook: src, sourceEntryCount: entries.length, derivedAt: new Date().toISOString() },
      status: "ratified",
      ratifiedBy: "codex-doctrine-generator",
    });
    out.push(entry);
  }
  return out;
}

export async function recordAmendment(input: {
  bookSlug: CodexBookSlug;
  entrySlug: string;
  fromVersion: number | null;
  toVersion: number;
  proposedBy: string;
  rationale: string;
  proofRef?: string;
  proposalId?: string;
  approvalRate?: number;
  status?: "pending" | "ratified" | "rejected";
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(codexAmendmentsTable).values({
    bookSlug: input.bookSlug,
    entrySlug: input.entrySlug,
    fromVersion: input.fromVersion,
    toVersion: input.toVersion,
    proposedBy: input.proposedBy,
    rationale: input.rationale,
    proofRef: input.proofRef ?? "",
    proposalId: input.proposalId ?? null,
    approvalRate: input.approvalRate != null ? input.approvalRate.toString() : null,
    status: input.status ?? "pending",
    payload: input.payload ?? {},
    ratifiedAt: input.status === "ratified" ? new Date() : null,
  });
}

export async function listAmendments(limit = 100) {
  return db.select().from(codexAmendmentsTable).orderBy(desc(codexAmendmentsTable.createdAt)).limit(limit);
}

export async function signSnapshot(trigger: "manual" | "post-council" | "scheduled" = "manual") {
  const books = await db.select().from(codexBooksTable).orderBy(codexBooksTable.ordinal);
  const out: Array<{ book: string; entries: CodexEntryRow[] }> = [];
  let entryCount = 0;
  for (const b of books) {
    const entries = await getLatestEntriesForBook(b.id);
    out.push({ book: b.slug, entries });
    entryCount += entries.length;
  }
  const [{ amendmentCount }] = (await db.execute(sql`SELECT COUNT(*)::int AS "amendmentCount" FROM codex_amendments`)).rows as { amendmentCount: number }[];

  const payload = { version: 1, generatedAt: Date.now(), trigger, books: out };
  const canonical = JSON.stringify(payload);
  const snapshotHash = createHash("sha256").update(canonical).digest("hex");
  const seed = process.env["CODEX_SIGNING_SECRET"] ?? "tessera-codex-v1";
  const signature = createHash("sha512").update(`${snapshotHash}|${seed}`).digest("hex");

  const dir = path.join(codexDir(), "_snapshots");
  await fs.mkdir(dir, { recursive: true });
  const fname = `${new Date().toISOString().replace(/[:.]/g, "-")}_${snapshotHash.slice(0, 8)}.json`;
  const fullPath = path.join(dir, fname);
  await fs.writeFile(fullPath, JSON.stringify({ snapshotHash, signature, ...payload }, null, 2), "utf-8");
  const relPath = path.relative(repoRoot(), fullPath);

  let id = 0;
  try {
    const [row] = await db
      .insert(codexSnapshotsTable)
      .values({
        snapshotHash,
        signature,
        trigger,
        bookCount: books.length,
        entryCount,
        amendmentCount: amendmentCount ?? 0,
        diskPath: relPath,
        payload: { booksSummary: out.map((b) => ({ book: b.book, entries: b.entries.length })) },
      })
      .returning({ id: codexSnapshotsTable.id });
    id = row?.id ?? 0;
  } catch (err) {
    logger.warn({ err }, "Codex: snapshot insert failed");
  }
  return { id, snapshotHash, signature, diskPath: relPath, bookCount: books.length, entryCount, amendmentCount };
}

export async function listSnapshots(limit = 50) {
  return db
    .select({
      id: codexSnapshotsTable.id,
      snapshotHash: codexSnapshotsTable.snapshotHash,
      signature: codexSnapshotsTable.signature,
      trigger: codexSnapshotsTable.trigger,
      bookCount: codexSnapshotsTable.bookCount,
      entryCount: codexSnapshotsTable.entryCount,
      amendmentCount: codexSnapshotsTable.amendmentCount,
      diskPath: codexSnapshotsTable.diskPath,
      createdAt: codexSnapshotsTable.createdAt,
    })
    .from(codexSnapshotsTable)
    .orderBy(desc(codexSnapshotsTable.createdAt))
    .limit(limit);
}

export async function ensureCodexBooks() {
  return ensureBooks();
}
