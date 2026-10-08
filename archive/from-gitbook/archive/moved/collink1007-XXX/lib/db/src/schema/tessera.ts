import { pgTable, serial, text, real, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const citizens = pgTable("citizens", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  limn_balance: real("limn_balance").notNull().default(0),
  usd_value: real("usd_value").notNull().default(0),
  rank: integer("rank").notNull().default(0),
  role: text("role").notNull().default("citizen"),
  wallet_address: text("wallet_address"),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertCitizenSchema = createInsertSchema(citizens).omit({ id: true, created_at: true });
export type InsertCitizen = z.infer<typeof insertCitizenSchema>;
export type Citizen = typeof citizens.$inferSelect;

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  from_agent: text("from_agent").notNull(),
  to_agent: text("to_agent").notNull(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, timestamp: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export const node_operators = pgTable("node_operators", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  uptime: real("uptime").notNull().default(0),
  daily_rate: real("daily_rate").notNull().default(15),
  vgpu_hours: real("vgpu_hours").notNull().default(0),
  governance_eligible: boolean("governance_eligible").notNull().default(false),
  region: text("region").notNull().default("US"),
  status: text("status").notNull().default("active"),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertNodeOperatorSchema = createInsertSchema(node_operators).omit({ id: true, created_at: true });
export type InsertNodeOperator = z.infer<typeof insertNodeOperatorSchema>;
export type NodeOperator = typeof node_operators.$inferSelect;

export const arbitrage_listings = pgTable("arbitrage_listings", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  category: text("category").notNull(),
  price: real("price").notNull().default(0),
  status: text("status").notNull().default("open"),
  matched_seeker: text("matched_seeker"),
  estimated_profit: real("estimated_profit").notNull().default(0),
  location: text("location").notNull().default("Remote"),
  description: text("description"),
  scanned_at: timestamp("scanned_at").defaultNow(),
});

export const insertArbitrageListingSchema = createInsertSchema(arbitrage_listings).omit({ id: true, scanned_at: true });
export type InsertArbitrageListing = z.infer<typeof insertArbitrageListingSchema>;
export type ArbitrageListing = typeof arbitrage_listings.$inferSelect;

export const job_matches = pgTable("job_matches", {
  id: serial("id").primaryKey(),
  listing_id: integer("listing_id").notNull(),
  seeker_name: text("seeker_name").notNull(),
  seeker_profile: text("seeker_profile"),
  category: text("category").notNull(),
  estimated_profit: real("estimated_profit").notNull().default(0),
  cut_percent: real("cut_percent").notNull().default(0.15),
  status: text("status").notNull().default("found"),
  outreach_template: text("outreach_template"),
  agent_assigned: text("agent_assigned"),
  created_at: timestamp("created_at").defaultNow(),
});

export const insertJobMatchSchema = createInsertSchema(job_matches).omit({ id: true, created_at: true });
export type InsertJobMatch = z.infer<typeof insertJobMatchSchema>;
export type JobMatch = typeof job_matches.$inferSelect;
