import { pgTable, serial, text, real, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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
