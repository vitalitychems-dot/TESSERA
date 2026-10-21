import { pgTable, serial, text, real, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const evaluation_runs = pgTable("evaluation_runs", {
  id: serial("id").primaryKey(),
  runId: text("run_id").notNull().unique(),
  runType: text("run_type").notNull().default("agi_benchmark"),
  totalScore: real("total_score").notNull().default(0),
  maxPossible: real("max_possible").notNull().default(0),
  percentile: real("percentile").notNull().default(0),
  grade: text("grade").notNull().default("F"),
  dimensionScores: jsonb("dimension_scores").notNull().default({}),
  regressions: jsonb("regressions").notNull().default([]),
  improvements: jsonb("improvements").notNull().default([]),
  improvementPlan: jsonb("improvement_plan").notNull().default([]),
  summary: text("summary"),
  metadata: jsonb("metadata").notNull().default({}),
  ranAt: timestamp("ran_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertEvaluationRunSchema = createInsertSchema(evaluation_runs).omit({ id: true, createdAt: true });
export type InsertEvaluationRun = z.infer<typeof insertEvaluationRunSchema>;
export type EvaluationRun = typeof evaluation_runs.$inferSelect;

export const provider_benchmarks = pgTable("provider_benchmarks", {
  id: serial("id").primaryKey(),
  benchmarkId: text("benchmark_id").notNull().unique(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  latencyMs: real("latency_ms").notNull().default(0),
  p50LatencyMs: real("p50_latency_ms").notNull().default(0),
  p95LatencyMs: real("p95_latency_ms").notNull().default(0),
  accuracyScore: real("accuracy_score").notNull().default(0),
  tokensPerSecond: real("tokens_per_second").notNull().default(0),
  costPerThousandTokens: real("cost_per_thousand_tokens").notNull().default(0),
  testsPassed: integer("tests_passed").notNull().default(0),
  testsTotal: integer("tests_total").notNull().default(0),
  testResults: jsonb("test_results").notNull().default([]),
  available: boolean("available").notNull().default(false),
  errorMessage: text("error_message"),
  ranAt: timestamp("ran_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertProviderBenchmarkSchema = createInsertSchema(provider_benchmarks).omit({ id: true, createdAt: true });
export type InsertProviderBenchmark = z.infer<typeof insertProviderBenchmarkSchema>;
export type ProviderBenchmark = typeof provider_benchmarks.$inferSelect;

export const agi_category_scores = pgTable("agi_category_scores", {
  id: serial("id").primaryKey(),
  category_name: text("category_name").notNull().unique(),
  score: real("score").notNull().default(0),
  trained: boolean("trained").notNull().default(false),
  sessions: integer("sessions").notNull().default(0),
  last_trained: timestamp("last_trained").defaultNow(),
  insights: jsonb("insights").notNull().default([]),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const insertAgiCategoryScoreSchema = createInsertSchema(agi_category_scores).omit({ id: true, updated_at: true });
export type InsertAgiCategoryScore = z.infer<typeof insertAgiCategoryScoreSchema>;
export type AgiCategoryScore = typeof agi_category_scores.$inferSelect;

export const agi_training_history = pgTable("agi_training_history", {
  id: serial("id").primaryKey(),
  cycle_number: integer("cycle_number").notNull(),
  categories_trained: jsonb("categories_trained").notNull().default([]),
  avg_score_before: real("avg_score_before").notNull().default(0),
  avg_score_after: real("avg_score_after").notNull().default(0),
  insights: jsonb("insights").notNull().default([]),
  completed_at: timestamp("completed_at").defaultNow(),
});

export const insertAgiTrainingHistorySchema = createInsertSchema(agi_training_history).omit({ id: true, completed_at: true });
export type InsertAgiTrainingHistory = z.infer<typeof insertAgiTrainingHistorySchema>;
export type AgiTrainingHistory = typeof agi_training_history.$inferSelect;
