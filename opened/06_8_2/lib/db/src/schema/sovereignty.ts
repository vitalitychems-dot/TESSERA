import { pgTable, serial, text, real, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const system_audit = pgTable("system_audit", {
  id: serial("id").primaryKey(),
  auditType: text("audit_type").notNull(),
  moduleName: text("module_name").notNull(),
  moduleType: text("module_type").notNull().default("service"),
  status: text("status").notNull().default("active"),
  externalDependencies: jsonb("external_dependencies").notNull().default([]),
  sovereigntyScore: real("sovereignty_score").notNull().default(0),
  throughput: real("throughput").notNull().default(0),
  bottlenecks: jsonb("bottlenecks").notNull().default([]),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSystemAuditSchema = createInsertSchema(system_audit).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSystemAudit = z.infer<typeof insertSystemAuditSchema>;
export type SystemAudit = typeof system_audit.$inferSelect;

export const sovereignty_metrics = pgTable("sovereignty_metrics", {
  id: serial("id").primaryKey(),
  phase: text("phase").notNull(),
  phaseNumber: integer("phase_number").notNull().default(0),
  metricName: text("metric_name").notNull(),
  currentValue: real("current_value").notNull().default(0),
  targetValue: real("target_value").notNull().default(100),
  unit: text("unit").notNull().default("percent"),
  status: text("status").notNull().default("pending"),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSovereigntyMetricsSchema = createInsertSchema(sovereignty_metrics).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSovereigntyMetrics = z.infer<typeof insertSovereigntyMetricsSchema>;
export type SovereigntyMetrics = typeof sovereignty_metrics.$inferSelect;

export const swarm_nodes = pgTable("swarm_nodes", {
  id: serial("id").primaryKey(),
  nodeId: text("node_id").notNull().unique(),
  nodeName: text("node_name").notNull(),
  nodeType: text("node_type").notNull().default("satellite"),
  status: text("status").notNull().default("online"),
  ipAddress: text("ip_address"),
  region: text("region"),
  capabilities: jsonb("capabilities").notNull().default([]),
  currentLoad: real("current_load").notNull().default(0),
  maxCapacity: real("max_capacity").notNull().default(100),
  lastHeartbeat: timestamp("last_heartbeat", { withTimezone: true }).defaultNow().notNull(),
  syncState: jsonb("sync_state").notNull().default({}),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSwarmNodeSchema = createInsertSchema(swarm_nodes).omit({ id: true, createdAt: true });
export type InsertSwarmNode = z.infer<typeof insertSwarmNodeSchema>;
export type SwarmNode = typeof swarm_nodes.$inferSelect;

export const swarm_sync_logs = pgTable("swarm_sync_logs", {
  id: serial("id").primaryKey(),
  sourceNodeId: text("source_node_id").notNull(),
  targetNodeId: text("target_node_id"),
  syncType: text("sync_type").notNull().default("state"),
  status: text("status").notNull().default("pending"),
  dataSize: integer("data_size").notNull().default(0),
  latencyMs: real("latency_ms").notNull().default(0),
  payload: jsonb("payload").notNull().default({}),
  errorMessage: text("error_message"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSwarmSyncLogSchema = createInsertSchema(swarm_sync_logs).omit({ id: true, createdAt: true });
export type InsertSwarmSyncLog = z.infer<typeof insertSwarmSyncLogSchema>;
export type SwarmSyncLog = typeof swarm_sync_logs.$inferSelect;

export const internal_models = pgTable("internal_models", {
  id: serial("id").primaryKey(),
  modelId: text("model_id").notNull().unique(),
  modelName: text("model_name").notNull(),
  modelType: text("model_type").notNull().default("reasoning"),
  version: text("version").notNull().default("1.0.0"),
  status: text("status").notNull().default("initialized"),
  parameters: jsonb("parameters").notNull().default({}),
  capabilities: jsonb("capabilities").notNull().default([]),
  benchmarkScores: jsonb("benchmark_scores").notNull().default({}),
  trainingConfig: jsonb("training_config").notNull().default({}),
  sovereigntyContribution: real("sovereignty_contribution").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertInternalModelSchema = createInsertSchema(internal_models).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertInternalModel = z.infer<typeof insertInternalModelSchema>;
export type InternalModel = typeof internal_models.$inferSelect;

export const training_pipeline = pgTable("training_pipeline", {
  id: serial("id").primaryKey(),
  pipelineId: text("pipeline_id").notNull().unique(),
  pipelineName: text("pipeline_name").notNull(),
  pipelineType: text("pipeline_type").notNull().default("rlhf"),
  status: text("status").notNull().default("idle"),
  modelId: text("model_id"),
  currentEpoch: integer("current_epoch").notNull().default(0),
  totalEpochs: integer("total_epochs").notNull().default(0),
  lossValue: real("loss_value").notNull().default(0),
  accuracy: real("accuracy").notNull().default(0),
  throughputSamplesPerSec: real("throughput_samples_per_sec").notNull().default(0),
  config: jsonb("config").notNull().default({}),
  checkpoints: jsonb("checkpoints").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertTrainingPipelineSchema = createInsertSchema(training_pipeline).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTrainingPipeline = z.infer<typeof insertTrainingPipelineSchema>;
export type TrainingPipeline = typeof training_pipeline.$inferSelect;

export const knowledge_graph = pgTable("knowledge_graph", {
  id: serial("id").primaryKey(),
  nodeId: text("node_id").notNull().unique(),
  nodeType: text("node_type").notNull().default("concept"),
  label: text("label").notNull(),
  content: text("content"),
  embedding: jsonb("embedding").notNull().default([]),
  edges: jsonb("edges").notNull().default([]),
  dimensionTags: jsonb("dimension_tags").notNull().default([]),
  temporalContext: jsonb("temporal_context").notNull().default({}),
  confidence: real("confidence").notNull().default(0.5),
  sourceType: text("source_type").notNull().default("ingested"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertKnowledgeGraphSchema = createInsertSchema(knowledge_graph).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertKnowledgeGraph = z.infer<typeof insertKnowledgeGraphSchema>;
export type KnowledgeGraph = typeof knowledge_graph.$inferSelect;

export const data_sources = pgTable("data_sources", {
  id: serial("id").primaryKey(),
  sourceId: text("source_id").notNull().unique(),
  sourceName: text("source_name").notNull(),
  sourceType: text("source_type").notNull().default("api"),
  endpoint: text("endpoint"),
  status: text("status").notNull().default("active"),
  isExternal: boolean("is_external").notNull().default(true),
  replacedBy: text("replaced_by"),
  lastPolled: timestamp("last_polled", { withTimezone: true }),
  pollIntervalMs: integer("poll_interval_ms").notNull().default(60000),
  reliability: real("reliability").notNull().default(1.0),
  dataQuality: real("data_quality").notNull().default(1.0),
  totalRecords: integer("total_records").notNull().default(0),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertDataSourceSchema = createInsertSchema(data_sources).omit({ id: true, createdAt: true });
export type InsertDataSource = z.infer<typeof insertDataSourceSchema>;
export type DataSource = typeof data_sources.$inferSelect;

export const geometry_routes = pgTable("geometry_routes", {
  id: serial("id").primaryKey(),
  routeId: text("route_id").notNull().unique(),
  routeName: text("route_name").notNull(),
  topology: text("topology").notNull().default("mesh"),
  sourceNodes: jsonb("source_nodes").notNull().default([]),
  targetNodes: jsonb("target_nodes").notNull().default([]),
  pathOptimization: text("path_optimization").notNull().default("latency"),
  avgLatencyMs: real("avg_latency_ms").notNull().default(0),
  loadBalance: real("load_balance").notNull().default(0.5),
  geometryType: text("geometry_type").notNull().default("voronoi"),
  spatialConfig: jsonb("spatial_config").notNull().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertGeometryRouteSchema = createInsertSchema(geometry_routes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGeometryRoute = z.infer<typeof insertGeometryRouteSchema>;
export type GeometryRoute = typeof geometry_routes.$inferSelect;

export const security_events = pgTable("security_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("info"),
  source: text("source").notNull(),
  description: text("description").notNull(),
  attackSurface: text("attack_surface"),
  mitigationStatus: text("mitigation_status").notNull().default("open"),
  details: jsonb("details").notNull().default({}),
  detectedAt: timestamp("detected_at", { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const insertSecurityEventSchema = createInsertSchema(security_events).omit({ id: true, detectedAt: true });
export type InsertSecurityEvent = z.infer<typeof insertSecurityEventSchema>;
export type SecurityEvent = typeof security_events.$inferSelect;

export const roadmap_phases = pgTable("roadmap_phases", {
  id: serial("id").primaryKey(),
  phaseNumber: integer("phase_number").notNull().unique(),
  phaseName: text("phase_name").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("pending"),
  progress: real("progress").notNull().default(0),
  subTasks: jsonb("sub_tasks").notNull().default([]),
  dependencies: jsonb("dependencies").notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertRoadmapPhaseSchema = createInsertSchema(roadmap_phases).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRoadmapPhase = z.infer<typeof insertRoadmapPhaseSchema>;
export type RoadmapPhase = typeof roadmap_phases.$inferSelect;

export const swarm_training_cycles = pgTable("swarm_training_cycles", {
  id: serial("id").primaryKey(),
  cycleId: text("cycle_id").notNull().unique(),
  cycleNumber: integer("cycle_number").notNull().default(0),
  status: text("status").notNull().default("pending"),
  phase: text("phase").notNull().default("ingestion"),
  dimensionsProcessed: jsonb("dimensions_processed").notNull().default([]),
  knowledgeAbsorbed: integer("knowledge_absorbed").notNull().default(0),
  agentsParticipated: integer("agents_participated").notNull().default(0),
  votesReceived: integer("votes_received").notNull().default(0),
  votesApproved: integer("votes_approved").notNull().default(0),
  convergenceScore: real("convergence_score").notNull().default(0),
  reinforcementSignals: jsonb("reinforcement_signals").notNull().default([]),
  crossDimensionalInsights: jsonb("cross_dimensional_insights").notNull().default([]),
  latencyMs: real("latency_ms").notNull().default(0),
  metadata: jsonb("metadata").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const insertSwarmTrainingCycleSchema = createInsertSchema(swarm_training_cycles).omit({ id: true, startedAt: true });
export type InsertSwarmTrainingCycle = z.infer<typeof insertSwarmTrainingCycleSchema>;
export type SwarmTrainingCycle = typeof swarm_training_cycles.$inferSelect;

export const swarm_votes = pgTable("swarm_votes", {
  id: serial("id").primaryKey(),
  voteId: text("vote_id").notNull().unique(),
  cycleId: text("cycle_id").notNull(),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  proposalType: text("proposal_type").notNull().default("improvement"),
  proposal: text("proposal").notNull(),
  vote: text("vote").notNull().default("approve"),
  confidence: real("confidence").notNull().default(0.5),
  reasoning: text("reasoning"),
  dimensionalPerspective: text("dimensional_perspective"),
  weight: real("weight").notNull().default(1.0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSwarmVoteSchema = createInsertSchema(swarm_votes).omit({ id: true, createdAt: true });
export type InsertSwarmVote = z.infer<typeof insertSwarmVoteSchema>;
export type SwarmVote = typeof swarm_votes.$inferSelect;

export const geometry_computations = pgTable("geometry_computations", {
  id: serial("id").primaryKey(),
  computationId: text("computation_id").notNull().unique(),
  computationType: text("computation_type").notNull().default("voronoi"),
  inputNodes: jsonb("input_nodes").notNull().default([]),
  outputTopology: jsonb("output_topology").notNull().default({}),
  optimizationTarget: text("optimization_target").notNull().default("latency"),
  latencyReduction: real("latency_reduction").notNull().default(0),
  loadBalanceImprovement: real("load_balance_improvement").notNull().default(0),
  pathEfficiency: real("path_efficiency").notNull().default(0),
  spatialLayout: jsonb("spatial_layout").notNull().default({}),
  dimensionalMappings: jsonb("dimensional_mappings").notNull().default([]),
  status: text("status").notNull().default("pending"),
  computeTimeMs: real("compute_time_ms").notNull().default(0),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertGeometryComputationSchema = createInsertSchema(geometry_computations).omit({ id: true, createdAt: true });
export type InsertGeometryComputation = z.infer<typeof insertGeometryComputationSchema>;
export type GeometryComputation = typeof geometry_computations.$inferSelect;
