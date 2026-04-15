import { pgTable, serial, text, real, timestamp, jsonb, integer, boolean, uniqueIndex, index } from "drizzle-orm/pg-core";

export const semanticCacheTable = pgTable("semantic_cache", {
  id: serial("id").primaryKey(),
  promptHash: text("prompt_hash").notNull().unique(),
  promptText: text("prompt_text").notNull(),
  embedding: jsonb("embedding").$type<number[]>().default([]),
  response: text("response").notNull(),
  model: text("model").notNull().default("gpt-5-mini"),
  hitCount: integer("hit_count").notNull().default(0),
  ttlSeconds: integer("ttl_seconds").notNull().default(3600),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  lastHitAt: timestamp("last_hit_at"),
});

export const distilledKnowledgeTable = pgTable("distilled_knowledge", {
  id: serial("id").primaryKey(),
  fact: text("fact").notNull(),
  category: text("category").notNull().default("general"),
  source: text("source").notNull().default("llm"),
  sourcePrompt: text("source_prompt"),
  confidence: real("confidence").notNull().default(0.8),
  accessCount: integer("access_count").notNull().default(0),
  verified: boolean("verified").notNull().default(false),
  lastVerifiedAt: timestamp("last_verified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const selfEvaluationTable = pgTable("self_evaluation_history", {
  id: serial("id").primaryKey(),
  cycleNumber: integer("cycle_number").notNull(),
  overallScore: real("overall_score").notNull(),
  cacheHitRate: real("cache_hit_rate").notNull().default(0),
  knowledgeHitRate: real("knowledge_hit_rate").notNull().default(0),
  embeddingQuality: real("embedding_quality").notNull().default(0),
  llmCallsReduced: integer("llm_calls_reduced").notNull().default(0),
  sourceScores: jsonb("source_scores").$type<Record<string, number>>().default({}),
  adjustments: jsonb("adjustments").$type<Record<string, unknown>>().default({}),
  weakAreas: jsonb("weak_areas").$type<string[]>().default([]),
  strongAreas: jsonb("strong_areas").$type<string[]>().default([]),
  evaluatedAt: timestamp("evaluated_at").notNull().defaultNow(),
});
