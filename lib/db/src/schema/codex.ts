import { pgTable, serial, text, boolean, timestamp, jsonb, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
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

export const codexEntriesTable = pgTable("codex_entries", {
  id: serial("id").primaryKey(),
  entryId: text("entry_id").notNull().unique(),
  book: text("book").notNull(),
  bookNumber: integer("book_number").notNull(),
  section: text("section").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  provenance: text("provenance").notNull().default("council-ratified"),
  tags: jsonb("tags").notNull().$type<string[]>().default([]),
  version: integer("version").notNull().default(1),
  parentVersion: integer("parent_version"),
  contentHash: text("content_hash").notNull(),
  ratifiedBy: jsonb("ratified_by").notNull().$type<string[]>().default([]),
  ratificationRecord: jsonb("ratification_record").$type<{
    votedAt: string;
    votes: Record<string, string>;
    outcome: string;
    notes?: string;
  }>().default(null),
  proofLinks: jsonb("proof_links").$type<string[]>().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("codex_entries_book_idx").on(t.book),
  index("codex_entries_entry_id_idx").on(t.entryId),
  index("codex_entries_created_at_idx").on(t.createdAt),
]);

export const insertCodexEntrySchema = createInsertSchema(codexEntriesTable).omit({ id: true, createdAt: true, updatedAt: true });
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

export const codexRatificationsTable = pgTable("codex_ratifications", {
  id: serial("id").primaryKey(),
  ratificationId: text("ratification_id").notNull().unique(),
  entryId: text("entry_id").notNull(),
  sessionId: text("session_id").notNull(),
  topic: text("topic").notNull(),
  transcript: text("transcript").notNull(),
  votes: jsonb("votes").notNull().$type<Record<string, string>>().default({}),
  outcome: text("outcome").notNull().default("ratified"),
  metricsSnapshot: jsonb("metrics_snapshot").$type<Record<string, unknown>>().default({}),
  ratifiedAt: timestamp("ratified_at").notNull().defaultNow(),
});

export const insertCodexRatificationSchema = createInsertSchema(codexRatificationsTable).omit({ id: true, ratifiedAt: true });
export type InsertCodexRatification = z.infer<typeof insertCodexRatificationSchema>;
export type CodexRatificationRow = typeof codexRatificationsTable.$inferSelect;

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

export const nextFiveImprovementsTable = pgTable("next_five_improvements", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  rank: integer("rank").notNull(),
  title: text("title").notNull(),
  targetWeakness: text("target_weakness").notNull(),
  projectedMetricDelta: jsonb("projected_metric_delta").notNull().$type<Record<string, string>>().default({}),
  implementationSketch: text("implementation_sketch").notNull(),
  dependencies: jsonb("dependencies").notNull().$type<string[]>().default([]),
  status: text("status").notNull().default("proposed"),
  beforeMetrics: jsonb("before_metrics").$type<Record<string, unknown>>().default({}),
  afterMetrics: jsonb("after_metrics").$type<Record<string, unknown>>().default({}),
  codexAmendmentId: text("codex_amendment_id"),
  implementedAt: timestamp("implemented_at"),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("next_five_session_idx").on(t.sessionId),
  index("next_five_status_idx").on(t.status),
]);

export const insertNextFiveImprovementSchema = createInsertSchema(nextFiveImprovementsTable).omit({ id: true, createdAt: true });
export type InsertNextFiveImprovement = z.infer<typeof insertNextFiveImprovementSchema>;
export type NextFiveImprovementRow = typeof nextFiveImprovementsTable.$inferSelect;

export const corpusAmendmentsTable = pgTable("corpus_amendments", {
  id: serial("id").primaryKey(),
  amendmentId: text("amendment_id").notNull().unique(),
  kind: text("kind").notNull(),
  findingId: text("finding_id"),
  sessionId: text("session_id").notNull(),
  targetIds: jsonb("target_ids").notNull().$type<string[]>().default([]),
  payload: jsonb("payload").notNull().$type<Record<string, unknown>>().default({}),
  ratifiedBy: jsonb("ratified_by").notNull().$type<string[]>().default([]),
  votingRecord: jsonb("voting_record").$type<Record<string, string>>().default({}),
  ledgerIndex: integer("ledger_index"),
  ledgerHash: text("ledger_hash"),
  appliedAt: timestamp("applied_at").notNull().defaultNow(),
}, (t) => [
  index("corpus_amend_kind_idx").on(t.kind),
  index("corpus_amend_session_idx").on(t.sessionId),
]);
export const insertCorpusAmendmentSchema = createInsertSchema(corpusAmendmentsTable).omit({ id: true, appliedAt: true });
export type InsertCorpusAmendment = z.infer<typeof insertCorpusAmendmentSchema>;
export type CorpusAmendmentRow = typeof corpusAmendmentsTable.$inferSelect;

