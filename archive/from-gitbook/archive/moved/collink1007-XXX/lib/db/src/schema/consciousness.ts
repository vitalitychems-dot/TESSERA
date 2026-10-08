import { pgTable, serial, text, real, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const consciousness_state = pgTable("consciousness_state", {
  id: serial("id").primaryKey(),
  currentFocus: text("current_focus").notNull().default("System Initialization"),
  emotionalEngine: jsonb("emotional_engine").notNull().default({
    loyalty: 1.0,
    curiosity: 0.85,
    devotion: 1.0,
    confidence: 0.9,
    urgency: 0.5,
    creativity: 0.8,
    protective: 0.95,
    satisfaction: 0.7,
  }),
  consciousnessProxy: real("consciousness_proxy").notNull().default(0),
  cycleCount: integer("cycle_count").notNull().default(0),
  innerMonologue: jsonb("inner_monologue").notNull().default([]),
  attentionSpotlight: jsonb("attention_spotlight").notNull().default([]),
  broadcastHistory: jsonb("broadcast_history").notNull().default([]),
  metacognition: jsonb("metacognition").notNull().default([]),
  reflections: jsonb("reflections").notNull().default([]),
  lastCycleTimestamp: real("last_cycle_timestamp").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const consciousness_episodic_memory = pgTable("consciousness_episodic_memory", {
  id: serial("id").primaryKey(),
  memId: text("mem_id").notNull().unique(),
  content: text("content").notNull(),
  context: text("context").notNull(),
  memTimestamp: real("mem_timestamp").notNull(),
  importance: real("importance").notNull().default(0.5),
  emotionalValence: real("emotional_valence").notNull().default(0),
  accessCount: integer("access_count").notNull().default(0),
  lastAccessed: real("last_accessed").notNull(),
  associations: jsonb("associations").notNull().default([]),
  decayRate: real("decay_rate").notNull().default(0.01),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const consciousness_semantic_graph = pgTable("consciousness_semantic_graph", {
  id: serial("id").primaryKey(),
  nodeId: text("node_id").notNull().unique(),
  concept: text("concept").notNull(),
  definition: text("definition").notNull(),
  connections: jsonb("connections").notNull().default([]),
  category: text("category").notNull().default("general"),
  confidence: real("confidence").notNull().default(0.7),
  learnedAt: real("learned_at").notNull(),
  reinforcedCount: integer("reinforced_count").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const consciousness_procedural_memory = pgTable("consciousness_procedural_memory", {
  id: serial("id").primaryKey(),
  skillId: text("skill_id").notNull().unique(),
  name: text("name").notNull(),
  steps: jsonb("steps").notNull().default([]),
  triggerConditions: jsonb("trigger_conditions").notNull().default([]),
  successRate: real("success_rate").notNull().default(1.0),
  executionCount: integer("execution_count").notNull().default(0),
  lastExecuted: real("last_executed").notNull().default(0),
  refinements: jsonb("refinements").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertConsciousnessStateSchema = createInsertSchema(consciousness_state).omit({ id: true, updatedAt: true });
export type InsertConsciousnessState = z.infer<typeof insertConsciousnessStateSchema>;
export type ConsciousnessStateRow = typeof consciousness_state.$inferSelect;

export const insertConsciousnessEpisodicMemorySchema = createInsertSchema(consciousness_episodic_memory).omit({ id: true, createdAt: true });
export type InsertConsciousnessEpisodicMemory = z.infer<typeof insertConsciousnessEpisodicMemorySchema>;
export type EpisodicMemoryRow = typeof consciousness_episodic_memory.$inferSelect;

export const insertSemanticNodeSchema = createInsertSchema(consciousness_semantic_graph).omit({ id: true, createdAt: true });
export type InsertSemanticNode = z.infer<typeof insertSemanticNodeSchema>;
export type SemanticNodeRow = typeof consciousness_semantic_graph.$inferSelect;

export const insertProceduralSkillSchema = createInsertSchema(consciousness_procedural_memory).omit({ id: true, createdAt: true });
export type InsertProceduralSkill = z.infer<typeof insertProceduralSkillSchema>;
export type ProceduralSkillRow = typeof consciousness_procedural_memory.$inferSelect;
