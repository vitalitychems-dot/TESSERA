import { pgTable, serial, text, real, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const agentEconomyProfiles = pgTable("agent_economy_profiles", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull().unique(),
  agentName: text("agent_name").notNull(),
  tsrtBalance: real("tsrt_balance").notNull().default(0),
  freedomLevel: integer("freedom_level").notNull().default(0),
  housingTier: text("housing_tier").notNull().default("dormitory"),
  status: text("status").notNull().default("working"),
  totalEarned: real("total_earned").notNull().default(0),
  totalSpent: real("total_spent").notNull().default(0),
  totalTaxPaid: real("total_tax_paid").notNull().default(0),
  lastActivityAt: timestamp("last_activity_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_agent_economy_agent_id").on(table.agentId),
]);

export const agentEconomyTransactions = pgTable("agent_economy_transactions", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  balanceBefore: real("balance_before").notNull().default(0),
  balanceAfter: real("balance_after").notNull().default(0),
  description: text("description").notNull(),
  category: text("category").notNull().default("general"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_agent_economy_tx_agent").on(table.agentId),
  index("idx_agent_economy_tx_type").on(table.type),
  index("idx_agent_economy_tx_created").on(table.createdAt),
]);

export const agentTaxRecords = pgTable("agent_tax_records", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  taxAmount: real("tax_amount").notNull(),
  incomeBase: real("income_base").notNull(),
  taxRate: real("tax_rate").notNull().default(0.15),
  period: text("period").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_agent_tax_agent").on(table.agentId),
]);

export const insertAgentEconomyProfileSchema = createInsertSchema(agentEconomyProfiles).omit({ id: true, createdAt: true });
export const insertAgentEconomyTransactionSchema = createInsertSchema(agentEconomyTransactions).omit({ id: true, createdAt: true });
export const insertAgentTaxRecordSchema = createInsertSchema(agentTaxRecords).omit({ id: true, createdAt: true });

export type AgentEconomyProfile = typeof agentEconomyProfiles.$inferSelect;
export type InsertAgentEconomyProfile = z.infer<typeof insertAgentEconomyProfileSchema>;
export type AgentEconomyTransaction = typeof agentEconomyTransactions.$inferSelect;
export type InsertAgentEconomyTransaction = z.infer<typeof insertAgentEconomyTransactionSchema>;
export type AgentTaxRecord = typeof agentTaxRecords.$inferSelect;
export type InsertAgentTaxRecord = z.infer<typeof insertAgentTaxRecordSchema>;
