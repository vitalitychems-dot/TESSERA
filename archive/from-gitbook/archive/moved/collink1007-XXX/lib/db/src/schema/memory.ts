import { pgTable, serial, text, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const episodicMemory = pgTable("episodic_memory", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  conversationId: integer("conversation_id"),
  eventType: text("event_type").notNull().default("conversation"),
  content: text("content").notNull(),
  context: text("context"),
  importance: integer("importance").notNull().default(5),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_episodic_memory_agent_id").on(table.agentId),
  index("idx_episodic_memory_importance").on(table.agentId, table.importance),
]);

export const insertEpisodicMemorySchema = createInsertSchema(episodicMemory).omit({
  id: true,
  createdAt: true,
});

export type EpisodicMemory = typeof episodicMemory.$inferSelect;
export type InsertEpisodicMemory = z.infer<typeof insertEpisodicMemorySchema>;

export const semanticMemory = pgTable("semantic_memory", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  concept: text("concept").notNull(),
  knowledge: text("knowledge").notNull(),
  source: text("source"),
  confidence: real("confidence").notNull().default(0.8),
  accessCount: integer("access_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_semantic_memory_agent_id").on(table.agentId),
  index("idx_semantic_memory_concept").on(table.agentId, table.concept),
]);

export const insertSemanticMemorySchema = createInsertSchema(semanticMemory).omit({
  id: true,
  createdAt: true,
  lastAccessedAt: true,
});

export type SemanticMemory = typeof semanticMemory.$inferSelect;
export type InsertSemanticMemory = z.infer<typeof insertSemanticMemorySchema>;

export const knowledgeEntries = pgTable("knowledge_entries", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"),
  tags: text("tags").notNull().default("[]"),
  source: text("source"),
  sourceConversationId: integer("source_conversation_id"),
  importance: integer("importance").notNull().default(5),
  accessCount: integer("access_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_knowledge_entries_category").on(table.category),
  index("idx_knowledge_entries_importance").on(table.importance),
]);

export const insertKnowledgeEntrySchema = createInsertSchema(knowledgeEntries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastAccessedAt: true,
});

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type InsertKnowledgeEntry = z.infer<typeof insertKnowledgeEntrySchema>;
