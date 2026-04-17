import { pgTable, serial, text, integer, timestamp, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const codexBooksTable = pgTable("codex_books", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  ordinal: integer("ordinal").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertCodexBookSchema = createInsertSchema(codexBooksTable).omit({ id: true, createdAt: true });
export type InsertCodexBook = z.infer<typeof insertCodexBookSchema>;
export type CodexBookRow = typeof codexBooksTable.$inferSelect;

export const codexEntriesTable = pgTable(
  "codex_entries",
  {
    id: serial("id").primaryKey(),
    bookId: integer("book_id").notNull(),
    slug: text("slug").notNull(),
    version: integer("version").notNull().default(1),
    parentVersionId: integer("parent_version_id"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    summary: text("summary").notNull().default(""),
    contentHash: text("content_hash").notNull(),
    provenance: jsonb("provenance").notNull().default({}),
    tags: jsonb("tags").notNull().default([]),
    status: text("status").notNull().default("draft"),
    ratifiedBy: text("ratified_by"),
    ratifiedAt: timestamp("ratified_at"),
    ratificationProposalId: text("ratification_proposal_id"),
    ratificationApprovalRate: text("ratification_approval_rate"),
    diskPath: text("disk_path").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    uniqVersion: uniqueIndex("uniq_codex_entry_book_slug_version").on(t.bookId, t.slug, t.version),
    bookIdx: index("idx_codex_entry_book").on(t.bookId),
    statusIdx: index("idx_codex_entry_status").on(t.status),
  }),
);
export const insertCodexEntrySchema = createInsertSchema(codexEntriesTable).omit({ id: true, createdAt: true });
export type InsertCodexEntry = z.infer<typeof insertCodexEntrySchema>;
export type CodexEntryRow = typeof codexEntriesTable.$inferSelect;

export const codexAmendmentsTable = pgTable(
  "codex_amendments",
  {
    id: serial("id").primaryKey(),
    bookSlug: text("book_slug").notNull(),
    entrySlug: text("entry_slug").notNull(),
    fromVersion: integer("from_version"),
    toVersion: integer("to_version").notNull(),
    proposedBy: text("proposed_by").notNull().default("system"),
    rationale: text("rationale").notNull().default(""),
    proofRef: text("proof_ref").notNull().default(""),
    proposalId: text("proposal_id"),
    approvalRate: text("approval_rate"),
    status: text("status").notNull().default("pending"),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    ratifiedAt: timestamp("ratified_at"),
  },
  (t) => ({
    bookSlugIdx: index("idx_codex_amend_book").on(t.bookSlug),
    statusIdx: index("idx_codex_amend_status").on(t.status),
  }),
);
export type CodexAmendmentRow = typeof codexAmendmentsTable.$inferSelect;
export const insertCodexAmendmentSchema = createInsertSchema(codexAmendmentsTable).omit({ id: true, createdAt: true });
export type InsertCodexAmendment = z.infer<typeof insertCodexAmendmentSchema>;

export const codexSnapshotsTable = pgTable("codex_snapshots", {
  id: serial("id").primaryKey(),
  snapshotHash: text("snapshot_hash").notNull(),
  signature: text("signature").notNull().default(""),
  trigger: text("trigger").notNull().default("manual"),
  bookCount: integer("book_count").notNull().default(0),
  entryCount: integer("entry_count").notNull().default(0),
  amendmentCount: integer("amendment_count").notNull().default(0),
  diskPath: text("disk_path").notNull().default(""),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export type CodexSnapshotRow = typeof codexSnapshotsTable.$inferSelect;
