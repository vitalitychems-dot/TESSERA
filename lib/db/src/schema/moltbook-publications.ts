import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const moltbookPublicationsTable = pgTable("moltbook_publications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: text("status").notNull().default("draft"),
  moderationPolicyVersion: text("moderation_policy_version"),
  approvedContentHash: text("approved_content_hash"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  externalPostId: text("external_post_id"),
  verificationCodeHash: text("verification_code_hash"),
  verificationExpiresAt: timestamp("verification_expires_at", { withTimezone: true }),
  verificationAttempts: integer("verification_attempts").notNull().default(0),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMoltbookPublicationSchema = createInsertSchema(moltbookPublicationsTable)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type InsertMoltbookPublication = z.infer<typeof insertMoltbookPublicationSchema>;
export type MoltbookPublicationRow = typeof moltbookPublicationsTable.$inferSelect;
