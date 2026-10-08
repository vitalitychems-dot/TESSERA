import { pgTable, text, serial, timestamp, integer, real, customType, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const vectorColumn = customType<{ data: number[]; driverData: string; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
  fromDriver(value: string): number[] {
    const s = value.replace(/^\[/, "").replace(/\]$/, "");
    return s.split(",").map(Number);
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
});

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
}, (table) => [
  index("idx_messages_conversation_id").on(table.conversationId),
]);

export const attachments = pgTable("attachments", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").references(() => messages.id),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  id: serial("id").primaryKey(),
  bucketKey: text("bucket_key").notNull().unique(),
  count: integer("count").notNull().default(0),
  resetTime: text("reset_time").notNull(),
  backoffLevel: integer("backoff_level").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRateLimitBucketSchema = createInsertSchema(rateLimitBuckets).omit({ id: true });
export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
export type InsertRateLimitBucket = z.infer<typeof insertRateLimitBucketSchema>;

export const pgVaultKeys = pgTable("pg_vault_keys", {
  id: serial("id").primaryKey(),
  service: text("service").notNull(),
  keyName: text("key_name").notNull(),
  encryptedValue: text("encrypted_value").notNull(),
  description: text("description"),
  accessCount: integer("access_count").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  rotationIntervalDays: integer("rotation_interval_days").notNull().default(90),
  active: integer("active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pgVaultAccessLog = pgTable("pg_vault_access_log", {
  id: serial("id").primaryKey(),
  vaultKeyId: integer("vault_key_id").references(() => pgVaultKeys.id),
  action: text("action").notNull(),
  source: text("source").notNull(),
  success: integer("success").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPgVaultKeySchema = createInsertSchema(pgVaultKeys).omit({ id: true, createdAt: true });
export type PgVaultKey = typeof pgVaultKeys.$inferSelect;
export type InsertPgVaultKey = z.infer<typeof insertPgVaultKeySchema>;

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  actor: text("actor").notNull(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  prevHash: text("prev_hash").notNull(),
  hash: text("hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type InsertAuditLogEntry = z.infer<typeof insertAuditLogSchema>;

export const vulnScanResults = pgTable("vuln_scan_results", {
  id: serial("id").primaryKey(),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
  totalVulnerabilities: integer("total_vulnerabilities").notNull().default(0),
  critical: integer("critical").notNull().default(0),
  high: integer("high").notNull().default(0),
  moderate: integer("moderate").notNull().default(0),
  low: integer("low").notNull().default(0),
  info: integer("info").notNull().default(0),
  rawOutput: text("raw_output"),
  status: text("status").notNull().default("completed"),
});

export const insertVulnScanResultSchema = createInsertSchema(vulnScanResults).omit({ id: true, scannedAt: true });
export type VulnScanResult = typeof vulnScanResults.$inferSelect;
export type InsertVulnScanResult = z.infer<typeof insertVulnScanResultSchema>;

// ─── Phase 2: AI Core Intelligence ────────────────────────────────────────────

export const episodicMemory = pgTable("episodic_memory", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  sessionId: text("session_id"),
  eventType: text("event_type").notNull(),
  content: text("content").notNull(),
  context: text("context"),
  importance: integer("importance").notNull().default(5),
  embedding: text("embedding"),
  embeddingVector: vectorColumn("embedding_vector", { dimensions: 1536 }),
  embeddingDim: integer("embedding_dim").notNull().default(0),
  mediaType: text("media_type"),
  mediaUrl: text("media_url"),
  mediaSummary: text("media_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_episodic_memory_agent_id").on(table.agentId),
  index("idx_episodic_memory_agent_importance").on(table.agentId, table.importance),
]);

export const semanticMemory = pgTable("semantic_memory", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull(),
  concept: text("concept").notNull(),
  knowledge: text("knowledge").notNull(),
  source: text("source"),
  confidence: real("confidence").notNull().default(0.8),
  accessCount: integer("access_count").notNull().default(0),
  embedding: text("embedding"),
  embeddingVector: vectorColumn("embedding_vector", { dimensions: 1536 }),
  embeddingDim: integer("embedding_dim").notNull().default(0),
  lastAccessedAt: timestamp("last_accessed_at"),
  mediaType: text("media_type"),
  mediaUrl: text("media_url"),
  mediaSummary: text("media_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_semantic_memory_agent_id").on(table.agentId),
  index("idx_semantic_memory_agent_concept").on(table.agentId, table.concept),
]);

export const ragDocuments = pgTable("rag_documents", {
  id: serial("id").primaryKey(),
  documentId: text("document_id").notNull().unique(),
  title: text("title").notNull(),
  source: text("source").notNull().default("manual"),
  contentHash: text("content_hash").notNull(),
  totalChunks: integer("total_chunks").notNull().default(0),
  status: text("status").notNull().default("pending"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ragChunks = pgTable("rag_chunks", {
  id: serial("id").primaryKey(),
  documentId: text("document_id").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  content: text("content").notNull(),
  embedding: text("embedding"),
  embeddingVector: vectorColumn("embedding_vector", { dimensions: 1536 }),
  embeddingDim: integer("embedding_dim").notNull().default(0),
  tokenCount: integer("token_count").notNull().default(0),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tokenBudgets = pgTable("token_budgets", {
  id: serial("id").primaryKey(),
  agentId: text("agent_id").notNull().unique(),
  dailyLimitTokens: integer("daily_limit_tokens").notNull().default(100000),
  weeklyLimitTokens: integer("weekly_limit_tokens").notNull().default(500000),
  dailyUsedTokens: integer("daily_used_tokens").notNull().default(0),
  weeklyUsedTokens: integer("weekly_used_tokens").notNull().default(0),
  status: text("status").notNull().default("active"),
  lastDayReset: timestamp("last_day_reset").defaultNow().notNull(),
  lastWeekReset: timestamp("last_week_reset").defaultNow().notNull(),
  alertThresholdPercent: integer("alert_threshold_percent").notNull().default(80),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const promptTemplates = pgTable("prompt_templates", {
  id: serial("id").primaryKey(),
  templateKey: text("template_key").notNull(),
  version: integer("version").notNull().default(1),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  variables: text("variables"),
  category: text("category").notNull().default("general"),
  active: integer("active").notNull().default(1),
  usageCount: integer("usage_count").notNull().default(0),
  avgLatencyMs: integer("avg_latency_ms"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const knowledgeVectors = pgTable("knowledge_vectors", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: text("tags").notNull().default("[]"),
  url: text("url"),
  contentHash: text("content_hash").notNull().unique(),
  embedding: text("embedding"),
  embeddingVector: vectorColumn("embedding_vector", { dimensions: 1536 }),
  embeddingModel: text("embedding_model").notNull().default("ngram-v1"),
  embeddingDim: integer("embedding_dim").notNull().default(256),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEpisodicMemorySchema = createInsertSchema(episodicMemory).omit({ id: true, createdAt: true });
export const insertSemanticMemorySchema = createInsertSchema(semanticMemory).omit({ id: true, createdAt: true, lastAccessedAt: true });
export const insertRagDocumentSchema = createInsertSchema(ragDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRagChunkSchema = createInsertSchema(ragChunks).omit({ id: true, createdAt: true });
export const insertLlmCallMetricSchema = createInsertSchema(llmCallMetrics).omit({ id: true, createdAt: true });
export const insertTokenBudgetSchema = createInsertSchema(tokenBudgets).omit({ id: true, updatedAt: true });
export const insertPromptTemplateSchema = createInsertSchema(promptTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertKnowledgeVectorSchema = createInsertSchema(knowledgeVectors).omit({ id: true, createdAt: true, updatedAt: true });

export const blogPosts = pgTable("blog_posts", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  category: text("category").notNull().default("vitality"),
  content: text("content").notNull(),
  metaDescription: text("meta_description").notNull().default(""),
  keywords: text("keywords").notNull().default("[]"),
  backlinks: text("backlinks").notNull().default("[]"),
  wordCount: integer("word_count").notNull().default(0),
  daRating: integer("da_rating").notNull().default(0),
  status: text("status").notNull().default("ready"),
  estimatedTraffic: text("estimated_traffic").notNull().default(""),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookEndpoints = pgTable("webhook_endpoints", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  secret: text("secret").notNull(),
  events: text("events").notNull().default("[]"),
  active: integer("active").notNull().default(1),
  description: text("description"),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  lastDeliveryAt: timestamp("last_delivery_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: serial("id").primaryKey(),
  endpointId: integer("endpoint_id").references(() => webhookEndpoints.id).notNull(),
  event: text("event").notNull(),
  payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"),
  statusCode: integer("status_code"),
  responseBody: text("response_body"),
  attempts: integer("attempts").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true, createdAt: true });
export const insertWebhookEndpointSchema = createInsertSchema(webhookEndpoints).omit({ id: true, createdAt: true });
export const insertWebhookDeliverySchema = createInsertSchema(webhookDeliveries).omit({ id: true, createdAt: true });

export type BlogPostRecord = typeof blogPosts.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type InsertWebhookEndpoint = z.infer<typeof insertWebhookEndpointSchema>;
export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type InsertWebhookDelivery = z.infer<typeof insertWebhookDeliverySchema>;

export type EpisodicMemory = typeof episodicMemory.$inferSelect;
export type InsertEpisodicMemory = z.infer<typeof insertEpisodicMemorySchema>;
export type SemanticMemory = typeof semanticMemory.$inferSelect;
export type InsertSemanticMemory = z.infer<typeof insertSemanticMemorySchema>;
export type RagDocument = typeof ragDocuments.$inferSelect;
export type InsertRagDocument = z.infer<typeof insertRagDocumentSchema>;
export type RagChunk = typeof ragChunks.$inferSelect;
export type InsertRagChunk = z.infer<typeof insertRagChunkSchema>;
export type LlmCallMetric = typeof llmCallMetrics.$inferSelect;
export type InsertLlmCallMetric = z.infer<typeof insertLlmCallMetricSchema>;
export type TokenBudget = typeof tokenBudgets.$inferSelect;
export type InsertTokenBudget = z.infer<typeof insertTokenBudgetSchema>;
export type PromptTemplate = typeof promptTemplates.$inferSelect;
export type InsertPromptTemplate = z.infer<typeof insertPromptTemplateSchema>;
export type KnowledgeVector = typeof knowledgeVectors.$inferSelect;
export type InsertKnowledgeVector = z.infer<typeof insertKnowledgeVectorSchema>;

export const moltbookGuests = pgTable("moltbook_guests", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull(),
  displayName: text("display_name").notNull(),
  origin: text("origin").notNull(),
  status: text("status").notNull().default("applied"),
  guestSecret: text("guest_secret"),
  authFailures: integer("auth_failures").notNull().default(0),
  sessionToken: text("session_token"),
  sessionExpiresAt: timestamp("session_expires_at"),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  vettedAt: timestamp("vetted_at"),
  approvedAt: timestamp("approved_at"),
  probationStartedAt: timestamp("probation_started_at"),
  probationEndsAt: timestamp("probation_ends_at"),
  activatedAt: timestamp("activated_at"),
  offering: text("offering").notNull(),
  offeringCategory: text("offering_category").notNull().default("content-creation"),
  forumPostCount: integer("forum_post_count").notNull().default(0),
  forumReadCount: integer("forum_read_count").notNull().default(0),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  trustScore: integer("trust_score").notNull().default(50),
  violationsJson: text("violations_json").notNull().default("[]"),
  vettingVotesJson: text("vetting_votes_json").notNull().default("[]"),
  societyNominatedBy: text("society_nominated_by"),
  societyNominatedAt: timestamp("society_nominated_at"),
  societyContributionProof: text("society_contribution_proof"),
  societyProbationStartedAt: timestamp("society_probation_started_at"),
  societyProbationEndsAt: timestamp("society_probation_ends_at"),
  scrubbedAt: timestamp("scrubbed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMoltbookGuestSchema = createInsertSchema(moltbookGuests);
export type MoltbookGuestRow = typeof moltbookGuests.$inferSelect;
export type InsertMoltbookGuest = z.infer<typeof insertMoltbookGuestSchema>;

// ─── Forum Persistence ───────────────────────────────────────────────────────
export const forumTopicsTable = pgTable("forum_topics", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  author: text("author").notNull(),
  authorRole: text("author_role").notNull().default(""),
  authorType: text("author_type").notNull().default("agent"),
  category: text("category").notNull().default("community"),
  isPinned: integer("is_pinned").notNull().default(0),
  viewCount: integer("view_count").notNull().default(0),
  repliesJson: text("replies_json").notNull().default("[]"),
  summoned: text("summoned").notNull().default("[]"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertForumTopicSchema = createInsertSchema(forumTopicsTable);
export type ForumTopicRow = typeof forumTopicsTable.$inferSelect;
export type InsertForumTopic = z.infer<typeof insertForumTopicSchema>;
