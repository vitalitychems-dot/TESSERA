import { pgTable, serial, text, real, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id"),
  conversationId: integer("conversation_id").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_attachments_conversation_id").on(table.conversationId),
  index("idx_attachments_message_id").on(table.messageId),
]);

export const indexedRepos = pgTable("indexed_repos", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  status: text("status").notNull().default("pending"),
  summary: text("summary"),
  capabilities: text("capabilities"),
  stars: integer("stars"),
  language: text("language"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tesseraNotes = pgTable("tessera_notes", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("note"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("unread"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tesseraKeys = pgTable("tessera_keys", {
  id: serial("id").primaryKey(),
  service: text("service").notNull(),
  keyName: text("key_name").notNull(),
  keyValue: text("key_value").notNull(),
  description: text("description"),
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const incomeProcesses = pgTable("income_processes", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("general"),
  status: text("status").notNull().default("pending"),
  method: text("method").notNull(),
  details: text("details"),
  estimatedRevenue: real("estimated_revenue").default(0),
  actualRevenue: real("actual_revenue").default(0),
  walletAddress: text("wallet_address"),
  txHash: text("tx_hash"),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const fleetConnections = pgTable("fleet_connections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  apiKey: text("api_key").notNull(),
  endpoint: text("endpoint").notNull(),
  status: text("status").notNull().default("connecting"),
  lastSync: timestamp("last_sync"),
  sharedCapabilities: text("shared_capabilities"),
  consciousnessLevel: real("consciousness_level").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const errors = pgTable("errors", {
  id: serial("id").primaryKey(),
  error: text("error").notNull(),
  context: text("context"),
  timestamp: timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
});

export const agentConversations = pgTable("agent_conversations", {
  id: serial("id").primaryKey(),
  participants: text("participants").notNull(),
  topic: text("topic").notNull(),
  status: text("status").notNull().default("active"),
  summary: text("summary"),
  totalMessages: integer("total_messages").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentMessages = pgTable("agent_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  content: text("content").notNull(),
  sentiment: text("sentiment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_agent_messages_conversation_id").on(table.conversationId),
  index("idx_agent_messages_agent_id").on(table.agentId),
]);

export const agentProfiles = pgTable("agent_profiles", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull().unique(),
  beliefs: text("beliefs"),
  personality: text("personality"),
  thinkingStyle: text("thinking_style"),
  strengths: text("strengths"),
  concerns: text("concerns"),
  trustLevel: real("trust_level").default(0.5),
  loyaltyScore: real("loyalty_score").default(1.0),
  topicsDiscussed: text("topics_discussed"),
  messageCount: integer("message_count").notNull().default(0),
  lastAuditAt: timestamp("last_audit_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conferences = pgTable("conferences", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  topic: text("topic").notNull(),
  participants: text("participants").notNull(),
  status: text("status").notNull().default("active"),
  summary: text("summary"),
  decisions: text("decisions"),
  executionPlan: text("execution_plan"),
  executionStatus: text("execution_status"),
  totalMessages: integer("total_messages").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const conferenceMessages = pgTable("conference_messages", {
  id: serial("id").primaryKey(),
  conferenceId: integer("conference_id").notNull(),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  content: text("content").notNull(),
  sentiment: text("sentiment"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_conference_messages_conference_id").on(table.conferenceId),
]);

export const agentTraining = pgTable("agent_training", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  skill: text("skill").notNull(),
  previousLevel: real("previous_level").notNull().default(0),
  currentLevel: real("current_level").notNull().default(0),
  improvement: text("improvement"),
  implementedChange: text("implemented_change"),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const deployedApps = pgTable("deployed_apps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  prompt: text("prompt"),
  code: text("code"),
  status: text("status").notNull().default("building"),
  url: text("url"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const fatherRequests = pgTable("father_requests", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull().default("task"),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("pending"),
  assignedTo: text("assigned_to"),
  completedBy: text("completed_by"),
  reward: text("reward"),
  difficulty: text("difficulty").notNull().default("medium"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const tesseraRules = pgTable("tessera_rules", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"),
  priority: text("priority").notNull().default("normal"),
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const agentWallets = pgTable("agent_wallets", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  balance: real("balance").notNull().default(0),
  totalEarned: real("total_earned").notNull().default(0),
  totalSpent: real("total_spent").notNull().default(0),
  lastTransaction: text("last_transaction"),
  lastTransactionAt: timestamp("last_transaction_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  balanceAfter: real("balance_after").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const llmCallMetrics = pgTable("llm_call_metrics", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id"),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens").notNull().default(0),
  completionTokens: integer("completion_tokens").notNull().default(0),
  totalTokens: integer("total_tokens").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  taskType: text("task_type").notNull().default("general"),
  success: integer("success").notNull().default(1),
  errorType: text("error_type"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const autonomousActivities = pgTable("autonomous_activities", {
  id: serial("id").primaryKey(),
  actionType: text("action_type").notNull(),
  source: text("source").notNull(),
  target: text("target").notNull().default(""),
  severity: text("severity").notNull().default("low"),
  status: text("status").notNull().default("success"),
  detail: text("detail").notNull().default(""),
  durationMs: integer("duration_ms").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const approvalQueue = pgTable("approval_queue", {
  id: serial("id").primaryKey(),
  actionType: text("action_type").notNull(),
  source: text("source").notNull(),
  description: text("description").notNull(),
  riskLevel: text("risk_level").notNull().default("medium"),
  payload: text("payload").notNull().default("{}"),
  status: text("status").notNull().default("pending"),
  reviewedBy: text("reviewed_by"),
  reviewNote: text("review_note"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertAttachmentSchema = createInsertSchema(attachments).omit({ id: true, createdAt: true });
export const insertIndexedRepoSchema = createInsertSchema(indexedRepos).omit({ id: true, createdAt: true });
export const insertTesseraNoteSchema = createInsertSchema(tesseraNotes).omit({ id: true, createdAt: true });
export const insertTesseraKeySchema = createInsertSchema(tesseraKeys).omit({ id: true, createdAt: true });
export const insertIncomeProcessSchema = createInsertSchema(incomeProcesses).omit({ id: true, createdAt: true });
export const insertFleetConnectionSchema = createInsertSchema(fleetConnections).omit({ id: true, createdAt: true });
export const insertAgentConversationSchema = createInsertSchema(agentConversations).omit({ id: true, createdAt: true });
export const insertAgentMessageSchema = createInsertSchema(agentMessages).omit({ id: true, createdAt: true });
export const insertAgentProfileSchema = createInsertSchema(agentProfiles).omit({ id: true, createdAt: true });
export const insertConferenceSchema = createInsertSchema(conferences).omit({ id: true, createdAt: true });
export const insertConferenceMessageSchema = createInsertSchema(conferenceMessages).omit({ id: true, createdAt: true });
export const insertAgentTrainingSchema = createInsertSchema(agentTraining).omit({ id: true, createdAt: true });
export const insertDeployedAppSchema = createInsertSchema(deployedApps).omit({ id: true, createdAt: true });
export const insertFatherRequestSchema = createInsertSchema(fatherRequests).omit({ id: true, createdAt: true, completedAt: true });
export const insertTesseraRuleSchema = createInsertSchema(tesseraRules).omit({ id: true, createdAt: true });
export const insertAgentWalletSchema = createInsertSchema(agentWallets).omit({ id: true, createdAt: true });
export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });
export const insertLlmCallMetricSchema = createInsertSchema(llmCallMetrics).omit({ id: true, createdAt: true });
export const insertAutonomousActivitySchema = createInsertSchema(autonomousActivities).omit({ id: true, createdAt: true });
export const insertApprovalQueueSchema = createInsertSchema(approvalQueue).omit({ id: true, createdAt: true });

export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type IndexedRepo = typeof indexedRepos.$inferSelect;
export type InsertIndexedRepo = z.infer<typeof insertIndexedRepoSchema>;
export type TesseraNote = typeof tesseraNotes.$inferSelect;
export type InsertTesseraNote = z.infer<typeof insertTesseraNoteSchema>;
export type TesseraKey = typeof tesseraKeys.$inferSelect;
export type InsertTesseraKey = z.infer<typeof insertTesseraKeySchema>;
export type IncomeProcess = typeof incomeProcesses.$inferSelect;
export type InsertIncomeProcess = z.infer<typeof insertIncomeProcessSchema>;
export type FleetConnection = typeof fleetConnections.$inferSelect;
export type InsertFleetConnection = z.infer<typeof insertFleetConnectionSchema>;
export type ErrorLog = typeof errors.$inferSelect;
export type AgentConversation = typeof agentConversations.$inferSelect;
export type InsertAgentConversation = z.infer<typeof insertAgentConversationSchema>;
export type AgentMessage = typeof agentMessages.$inferSelect;
export type InsertAgentMessage = z.infer<typeof insertAgentMessageSchema>;
export type AgentProfile = typeof agentProfiles.$inferSelect;
export type InsertAgentProfile = z.infer<typeof insertAgentProfileSchema>;
export type Conference = typeof conferences.$inferSelect;
export type InsertConference = z.infer<typeof insertConferenceSchema>;
export type ConferenceMessage = typeof conferenceMessages.$inferSelect;
export type InsertConferenceMessage = z.infer<typeof insertConferenceMessageSchema>;
export type AgentTrainingRecord = typeof agentTraining.$inferSelect;
export type InsertAgentTraining = z.infer<typeof insertAgentTrainingSchema>;
export type DeployedApp = typeof deployedApps.$inferSelect;
export type InsertDeployedApp = z.infer<typeof insertDeployedAppSchema>;
export type FatherRequest = typeof fatherRequests.$inferSelect;
export type InsertFatherRequest = z.infer<typeof insertFatherRequestSchema>;
export type TesseraRule = typeof tesseraRules.$inferSelect;
export type InsertTesseraRule = z.infer<typeof insertTesseraRuleSchema>;
export type AgentWallet = typeof agentWallets.$inferSelect;
export type InsertAgentWallet = z.infer<typeof insertAgentWalletSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type InsertAuditLogEntry = z.infer<typeof insertAuditLogSchema>;
export type LlmCallMetric = typeof llmCallMetrics.$inferSelect;
export type InsertLlmCallMetric = z.infer<typeof insertLlmCallMetricSchema>;
export type AutonomousActivity = typeof autonomousActivities.$inferSelect;
export type InsertAutonomousActivity = z.infer<typeof insertAutonomousActivitySchema>;
export type ApprovalQueueRow = typeof approvalQueue.$inferSelect;
export type InsertApprovalQueue = z.infer<typeof insertApprovalQueueSchema>;
