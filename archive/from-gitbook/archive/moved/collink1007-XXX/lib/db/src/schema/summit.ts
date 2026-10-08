import { pgTable, serial, text, real, integer, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const summitProposals = pgTable("summit_proposals", {
  id: serial("id").primaryKey(),
  proposalId: text("proposal_id").notNull().unique(),
  conversationId: integer("conversation_id"),
  topic: text("topic").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("governance"),
  proposedBy: text("proposed_by").notNull().default("user"),
  status: text("status").notNull().default("voting"),
  rounds: integer("rounds").notNull().default(1),
  approvalRate: real("approval_rate"),
  approveCount: integer("approve_count").notNull().default(0),
  rejectCount: integer("reject_count").notNull().default(0),
  abstainCount: integer("abstain_count").notNull().default(0),
  totalVoters: integer("total_voters").notNull().default(0),
  implementationNotes: text("implementation_notes"),
  synthesis: text("synthesis"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_summit_proposals_status").on(table.status),
  index("idx_summit_proposals_conversation").on(table.conversationId),
]);

export const summitVotes = pgTable("summit_votes", {
  id: serial("id").primaryKey(),
  proposalId: text("proposal_id").notNull(),
  round: integer("round").notNull().default(1),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  agentRole: text("agent_role"),
  agentBrainRegion: text("agent_brain_region"),
  vote: text("vote").notNull(),
  confidence: real("confidence").notNull().default(0.7),
  reasoning: text("reasoning").notNull(),
  perspective: text("perspective"),
  axiomCitations: jsonb("axiom_citations").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_summit_votes_proposal").on(table.proposalId),
  index("idx_summit_votes_agent").on(table.agentId),
]);

export const summitRounds = pgTable("summit_rounds", {
  id: serial("id").primaryKey(),
  proposalId: text("proposal_id").notNull(),
  roundNumber: integer("round_number").notNull(),
  approveCount: integer("approve_count").notNull().default(0),
  rejectCount: integer("reject_count").notNull().default(0),
  abstainCount: integer("abstain_count").notNull().default(0),
  approvalRate: real("approval_rate").notNull().default(0),
  isContested: integer("is_contested").notNull().default(0),
  concerns: text("concerns"),
  outcome: text("outcome"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_summit_rounds_proposal").on(table.proposalId),
]);

export const insertSummitProposalSchema = createInsertSchema(summitProposals).omit({
  id: true,
  createdAt: true,
});
export const insertSummitVoteSchema = createInsertSchema(summitVotes).omit({
  id: true,
  createdAt: true,
});
export const insertSummitRoundSchema = createInsertSchema(summitRounds).omit({
  id: true,
  createdAt: true,
});

export type SummitProposal = typeof summitProposals.$inferSelect;
export type InsertSummitProposal = z.infer<typeof insertSummitProposalSchema>;
export type SummitVote = typeof summitVotes.$inferSelect;
export type InsertSummitVote = z.infer<typeof insertSummitVoteSchema>;
export type SummitRound = typeof summitRounds.$inferSelect;
export type InsertSummitRound = z.infer<typeof insertSummitRoundSchema>;
