import { pgTable, text, serial, timestamp, integer, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  initiatedBy: text("initiated_by").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  role: text("role").notNull(), 
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => messages.id),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const indexedRepos = pgTable("indexed_repos", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  status: text("status").notNull().default("pending"), 
  summary: text("summary"),
  capabilities: text("capabilities"),
  stars: integer("stars"),
  language: text("language"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const improvementCycles = pgTable("improvement_cycles", {
  id: serial("id").primaryKey(),
  cycleNumber: integer("cycle_number").notNull(),
  phase: text("phase").notNull(),
  status: text("status").notNull().default("running"),
  reposScanned: integer("repos_scanned").notNull().default(0),
  reposAdded: integer("repos_added").notNull().default(0),
  reposRemoved: integer("repos_removed").notNull().default(0),
  capabilitiesLearned: text("capabilities_learned"),
  improvements: text("improvements"),
  searchQueries: text("search_queries"),
  duration: integer("duration"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tesseraNotes = pgTable("tessera_notes", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("note"),
  title: text("title").notNull(),
  content: text("content").notNull(),
  priority: text("priority").notNull().default("normal"),
  status: text("status").notNull().default("unread"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tesseraKeys = pgTable("tessera_keys", {
  id: serial("id").primaryKey(),
  service: text("service").notNull(),
  keyName: text("key_name").notNull(),
  keyValue: text("key_value").notNull(),
  description: text("description"),
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const errors = pgTable("errors", {
  id: serial("id").primaryKey(),
  error: text("error").notNull(),
  context: text("context"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const userProfile = pgTable("user_profile", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentConversations = pgTable("agent_conversations", {
  id: serial("id").primaryKey(),
  participants: text("participants").notNull(),
  topic: text("topic").notNull(),
  status: text("status").notNull().default("active"),
  summary: text("summary"),
  totalMessages: integer("total_messages").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentMessages = pgTable("agent_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => agentConversations.id).notNull(),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  content: text("content").notNull(),
  sentiment: text("sentiment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const conferenceMessages = pgTable("conference_messages", {
  id: serial("id").primaryKey(),
  conferenceId: integer("conference_id").references(() => conferences.id).notNull(),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  content: text("content").notNull(),
  sentiment: text("sentiment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const deployedApps = pgTable("deployed_apps", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  prompt: text("prompt"),
  code: text("code"),
  status: text("status").notNull().default("building"),
  url: text("url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertRepoSchema = createInsertSchema(indexedRepos).omit({ id: true, createdAt: true, status: true });
export const insertAttachmentSchema = createInsertSchema(attachments).omit({ id: true, createdAt: true });
export const insertImprovementCycleSchema = createInsertSchema(improvementCycles).omit({ id: true, createdAt: true });
export const insertNoteSchema = createInsertSchema(tesseraNotes).omit({ id: true, createdAt: true });
export const insertKeySchema = createInsertSchema(tesseraKeys).omit({ id: true, createdAt: true });
export const insertIncomeProcessSchema = createInsertSchema(incomeProcesses).omit({ id: true, createdAt: true });
export const insertFleetConnectionSchema = createInsertSchema(fleetConnections).omit({ id: true, createdAt: true, lastSync: true });
export const insertAgentConversationSchema = createInsertSchema(agentConversations).omit({ id: true, createdAt: true });
export const insertAgentMessageSchema = createInsertSchema(agentMessages).omit({ id: true, createdAt: true });
export const insertAgentProfileSchema = createInsertSchema(agentProfiles).omit({ id: true, createdAt: true });
export const insertConferenceSchema = createInsertSchema(conferences).omit({ id: true, createdAt: true });
export const insertConferenceMessageSchema = createInsertSchema(conferenceMessages).omit({ id: true, createdAt: true });
export const insertAgentTrainingSchema = createInsertSchema(agentTraining).omit({ id: true, createdAt: true });
export const insertDeployedAppSchema = createInsertSchema(deployedApps).omit({ id: true, createdAt: true });

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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertFatherRequestSchema = createInsertSchema(fatherRequests).omit({ id: true, createdAt: true, completedAt: true });

export const tesseraRules = pgTable("tessera_rules", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"),
  priority: text("priority").notNull().default("normal"),
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertRuleSchema = createInsertSchema(tesseraRules).omit({ id: true, createdAt: true });

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type IndexedRepo = typeof indexedRepos.$inferSelect;
export type InsertRepo = z.infer<typeof insertRepoSchema>;
export type Attachment = typeof attachments.$inferSelect;
export type InsertAttachment = z.infer<typeof insertAttachmentSchema>;
export type ImprovementCycle = typeof improvementCycles.$inferSelect;
export type InsertImprovementCycle = z.infer<typeof insertImprovementCycleSchema>;
export type TesseraNote = typeof tesseraNotes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;
export type TesseraKey = typeof tesseraKeys.$inferSelect;
export type InsertKey = z.infer<typeof insertKeySchema>;
export type ErrorLog = typeof errors.$inferSelect;
export type IncomeProcess = typeof incomeProcesses.$inferSelect;
export type InsertIncomeProcess = z.infer<typeof insertIncomeProcessSchema>;
export type FleetConnection = typeof fleetConnections.$inferSelect;
export type InsertFleetConnection = z.infer<typeof insertFleetConnectionSchema>;
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
export type InsertRule = z.infer<typeof insertRuleSchema>;

export const agentMemories = pgTable("agent_memories", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  memoryType: text("memory_type").notNull(),
  content: text("content").notNull(),
  importance: integer("importance").notNull().default(5),
  dimension: text("dimension"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAgentMemorySchema = createInsertSchema(agentMemories).omit({ id: true, createdAt: true });
export type AgentMemory = typeof agentMemories.$inferSelect;
export type InsertAgentMemory = z.infer<typeof insertAgentMemorySchema>;

export const consciousnessLog = pgTable("consciousness_log", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  content: text("content").notNull(),
  quality: real("quality"),
  driveId: text("drive_id"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConsciousnessLogSchema = createInsertSchema(consciousnessLog).omit({ id: true, createdAt: true });
export type ConsciousnessLogEntry = typeof consciousnessLog.$inferSelect;
export type InsertConsciousnessLog = z.infer<typeof insertConsciousnessLogSchema>;

export const agentWallets = pgTable("agent_wallets", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  balance: real("balance").notNull().default(0),
  totalEarned: real("total_earned").notNull().default(0),
  totalSpent: real("total_spent").notNull().default(0),
  lastTransaction: text("last_transaction"),
  lastTransactionAt: timestamp("last_transaction_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const walletTransactions = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  type: text("type").notNull(),
  amount: real("amount").notNull(),
  description: text("description").notNull(),
  balanceAfter: real("balance_after").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const autoImprovementLogs = pgTable("auto_improvement_logs", {
  id: serial("id").primaryKey(),
  cycleId: integer("cycle_id").notNull(),
  category: text("category").notNull(),
  suggestion: text("suggestion").notNull(),
  applied: integer("applied").notNull().default(0),
  agentName: text("agent_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAgentWalletSchema = createInsertSchema(agentWallets).omit({ id: true, createdAt: true });
export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({ id: true, createdAt: true });
export const insertAutoImprovementLogSchema = createInsertSchema(autoImprovementLogs).omit({ id: true, createdAt: true });
export type AgentWallet = typeof agentWallets.$inferSelect;
export type InsertAgentWallet = z.infer<typeof insertAgentWalletSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type AutoImprovementLog = typeof autoImprovementLogs.$inferSelect;
export type InsertAutoImprovementLog = z.infer<typeof insertAutoImprovementLogSchema>;

export const devProjects = pgTable("dev_projects", {
  id: serial("id").primaryKey(),
  goal: text("goal").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("planning"),
  agentRole: text("agent_role").notNull().default("fullstack"),
  workDir: text("work_dir").notNull(),
  previewPort: integer("preview_port"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const devSessions = pgTable("dev_sessions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => devProjects.id).notNull(),
  logs: text("logs").notNull().default(""),
  files: text("files").notNull().default("[]"),
  status: text("status").notNull().default("idle"),
  currentStep: text("current_step"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDevProjectSchema = createInsertSchema(devProjects).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDevSessionSchema = createInsertSchema(devSessions).omit({ id: true, createdAt: true, updatedAt: true });
export type DevProject = typeof devProjects.$inferSelect;
export type InsertDevProject = z.infer<typeof insertDevProjectSchema>;
export type DevSession = typeof devSessions.$inferSelect;
export type InsertDevSession = z.infer<typeof insertDevSessionSchema>;

export const summitResults = pgTable("summit_results", {
  id: serial("id").primaryKey(),
  summitId: text("summit_id").notNull(),
  topic: text("topic").notNull(),
  participants: integer("participants").notNull().default(28),
  proposals: text("proposals").notNull().default("[]"),
  consensus: text("consensus").notNull(),
  themes: text("themes").notNull().default("[]"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSummitResultSchema = createInsertSchema(summitResults).omit({ id: true, createdAt: true });
export type SummitResult = typeof summitResults.$inferSelect;
export type InsertSummitResult = z.infer<typeof insertSummitResultSchema>;

export const incomeExecutions = pgTable("income_executions", {
  id: serial("id").primaryKey(),
  method: text("method").notNull(),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  revenue: real("revenue").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertIncomeExecutionSchema = createInsertSchema(incomeExecutions).omit({ id: true, createdAt: true });
export type IncomeExecution = typeof incomeExecutions.$inferSelect;
export type InsertIncomeExecution = z.infer<typeof insertIncomeExecutionSchema>;

export const generatedLeads = pgTable("generated_leads", {
  id: serial("id").primaryKey(),
  industry: text("industry").notNull(),
  location: text("location").notNull(),
  businessName: text("business_name").notNull(),
  address: text("address"),
  phone: text("phone"),
  website: text("website"),
  source: text("source").notNull().default("google-places"),
  score: integer("score").default(0),
  status: text("status").notNull().default("new"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGeneratedLeadSchema = createInsertSchema(generatedLeads).omit({ id: true, createdAt: true });
export type GeneratedLead = typeof generatedLeads.$inferSelect;
export type InsertGeneratedLead = z.infer<typeof insertGeneratedLeadSchema>;
