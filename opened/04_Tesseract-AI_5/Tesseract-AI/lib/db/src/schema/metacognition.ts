import { pgTable, serial, text, real, integer, timestamp, jsonb, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const metacognition_log = pgTable("metacognition_log", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").notNull(),
  taskType: text("task_type").notNull(),
  phase: text("phase").notNull().default("plan"),
  plan: text("plan").notNull(),
  risks: jsonb("risks").notNull().default([]),
  assumptions: jsonb("assumptions").notNull().default([]),
  outcome: text("outcome"),
  expectedOutcome: text("expected_outcome"),
  actualOutcome: text("actual_outcome"),
  divergence: real("divergence"),
  mistakes: jsonb("mistakes").notNull().default([]),
  lessonsLearned: jsonb("lessons_learned").notNull().default([]),
  adaptations: jsonb("adaptations").notNull().default([]),
  uncertaintyLevel: real("uncertainty_level").notNull().default(0.5),
  confidenceBefore: real("confidence_before").notNull().default(0.5),
  confidenceAfter: real("confidence_after"),
  durationMs: integer("duration_ms"),
  success: boolean("success"),
  engineSource: text("engine_source").notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const strategy_preferences = pgTable("strategy_preferences", {
  id: serial("id").primaryKey(),
  taskType: text("task_type").notNull(),
  strategyName: text("strategy_name").notNull(),
  description: text("description").notNull(),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  avgDivergence: real("avg_divergence").notNull().default(0),
  avgDurationMs: real("avg_duration_ms").notNull().default(0),
  preferenceScore: real("preference_score").notNull().default(0.5),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }).defaultNow().notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const failure_patterns = pgTable("failure_patterns", {
  id: serial("id").primaryKey(),
  patternName: text("pattern_name").notNull(),
  description: text("description").notNull(),
  occurrenceCount: integer("occurrence_count").notNull().default(1),
  severity: text("severity").notNull().default("medium"),
  category: text("category").notNull().default("general"),
  mitigation: text("mitigation"),
  lastOccurredAt: timestamp("last_occurred_at", { withTimezone: true }).defaultNow().notNull(),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const cognitive_state_snapshots = pgTable("cognitive_state_snapshots", {
  id: serial("id").primaryKey(),
  snapshotType: text("snapshot_type").notNull().default("periodic"),
  cognitiveLoad: real("cognitive_load").notNull().default(0),
  activeEngines: integer("active_engines").notNull().default(0),
  totalCyclesRunning: integer("total_cycles_running").notNull().default(0),
  memoryPressure: real("memory_pressure").notNull().default(0),
  processingLatencyMs: real("processing_latency_ms").notNull().default(0),
  attentionDistribution: jsonb("attention_distribution").notNull().default({}),
  engineHealthMap: jsonb("engine_health_map").notNull().default({}),
  decisionQuality: real("decision_quality").notNull().default(0.5),
  coherenceScore: real("coherence_score").notNull().default(0),
  awarenessLevel: real("awareness_level").notNull().default(0),
  autonomyLevel: real("autonomy_level").notNull().default(0),
  sovereigntyReadiness: real("sovereignty_readiness").notNull().default(0),
  anomalyFlags: jsonb("anomaly_flags").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_cognitive_snapshots_type").on(table.snapshotType),
  index("idx_cognitive_snapshots_created").on(table.createdAt),
]);

export const epistemic_journal = pgTable("epistemic_journal", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull(),
  knowledgeType: text("knowledge_type").notNull().default("factual"),
  certaintyLevel: real("certainty_level").notNull().default(0.5),
  evidenceBasis: text("evidence_basis").notNull(),
  knownUnknowns: jsonb("known_unknowns").notNull().default([]),
  predictions: jsonb("predictions").notNull().default([]),
  predictionOutcomes: jsonb("prediction_outcomes").notNull().default([]),
  calibrationScore: real("calibration_score").notNull().default(0.5),
  sourceEngines: jsonb("source_engines").notNull().default([]),
  lastValidatedAt: timestamp("last_validated_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_epistemic_domain").on(table.domain),
  index("idx_epistemic_certainty").on(table.certaintyLevel),
]);

export const causal_analysis = pgTable("causal_analysis", {
  id: serial("id").primaryKey(),
  triggerEvent: text("trigger_event").notNull(),
  triggerEngine: text("trigger_engine").notNull(),
  effectObserved: text("effect_observed").notNull(),
  causalChain: jsonb("causal_chain").notNull().default([]),
  confidence: real("confidence").notNull().default(0.5),
  analysisType: text("analysis_type").notNull().default("post_hoc"),
  relatedTaskIds: jsonb("related_task_ids").notNull().default([]),
  counterfactual: text("counterfactual"),
  interventionSuggested: text("intervention_suggested"),
  validated: boolean("validated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_causal_trigger_engine").on(table.triggerEngine),
  index("idx_causal_type").on(table.analysisType),
]);

export const insertMetacognitionLogSchema = createInsertSchema(metacognition_log).omit({ id: true, createdAt: true });
export type InsertMetacognitionLog = z.infer<typeof insertMetacognitionLogSchema>;
export type MetacognitionLogRow = typeof metacognition_log.$inferSelect;

export const insertStrategyPreferenceSchema = createInsertSchema(strategy_preferences).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStrategyPreference = z.infer<typeof insertStrategyPreferenceSchema>;
export type StrategyPreferenceRow = typeof strategy_preferences.$inferSelect;

export const insertFailurePatternSchema = createInsertSchema(failure_patterns).omit({ id: true, createdAt: true });
export type InsertFailurePattern = z.infer<typeof insertFailurePatternSchema>;
export type FailurePatternRow = typeof failure_patterns.$inferSelect;

export const insertCognitiveStateSchema = createInsertSchema(cognitive_state_snapshots).omit({ id: true, createdAt: true });
export type InsertCognitiveState = z.infer<typeof insertCognitiveStateSchema>;
export type CognitiveStateRow = typeof cognitive_state_snapshots.$inferSelect;

export const insertEpistemicJournalSchema = createInsertSchema(epistemic_journal).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEpistemicJournal = z.infer<typeof insertEpistemicJournalSchema>;
export type EpistemicJournalRow = typeof epistemic_journal.$inferSelect;

export const insertCausalAnalysisSchema = createInsertSchema(causal_analysis).omit({ id: true, createdAt: true });
export type InsertCausalAnalysis = z.infer<typeof insertCausalAnalysisSchema>;
export type CausalAnalysisRow = typeof causal_analysis.$inferSelect;
