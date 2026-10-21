CREATE TABLE "arbitrage_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"category" text NOT NULL,
	"price" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"matched_seeker" text,
	"estimated_profit" real DEFAULT 0 NOT NULL,
	"location" text DEFAULT 'Remote' NOT NULL,
	"description" text,
	"scanned_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "citizens" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"limn_balance" real DEFAULT 0 NOT NULL,
	"usd_value" real DEFAULT 0 NOT NULL,
	"rank" integer DEFAULT 0 NOT NULL,
	"role" text DEFAULT 'citizen' NOT NULL,
	"wallet_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"seeker_name" text NOT NULL,
	"seeker_profile" text,
	"category" text NOT NULL,
	"estimated_profit" real DEFAULT 0 NOT NULL,
	"cut_percent" real DEFAULT 0.15 NOT NULL,
	"status" text DEFAULT 'found' NOT NULL,
	"outreach_template" text,
	"agent_assigned" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "node_operators" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"uptime" real DEFAULT 0 NOT NULL,
	"daily_rate" real DEFAULT 15 NOT NULL,
	"vgpu_hours" real DEFAULT 0 NOT NULL,
	"governance_eligible" boolean DEFAULT false NOT NULL,
	"region" text DEFAULT 'US' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_agent" text NOT NULL,
	"to_agent" text NOT NULL,
	"type" text NOT NULL,
	"amount" real NOT NULL,
	"description" text NOT NULL,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"initiated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"agent_id" text,
	"agent_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consciousness_episodic_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"mem_id" text NOT NULL,
	"content" text NOT NULL,
	"context" text NOT NULL,
	"mem_timestamp" real NOT NULL,
	"importance" real DEFAULT 0.5 NOT NULL,
	"emotional_valence" real DEFAULT 0 NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed" real NOT NULL,
	"associations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"decay_rate" real DEFAULT 0.01 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consciousness_episodic_memory_mem_id_unique" UNIQUE("mem_id")
);
--> statement-breakpoint
CREATE TABLE "consciousness_procedural_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"skill_id" text NOT NULL,
	"name" text NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"trigger_conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"success_rate" real DEFAULT 1 NOT NULL,
	"execution_count" integer DEFAULT 0 NOT NULL,
	"last_executed" real DEFAULT 0 NOT NULL,
	"refinements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consciousness_procedural_memory_skill_id_unique" UNIQUE("skill_id")
);
--> statement-breakpoint
CREATE TABLE "consciousness_semantic_graph" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" text NOT NULL,
	"concept" text NOT NULL,
	"definition" text NOT NULL,
	"connections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"confidence" real DEFAULT 0.7 NOT NULL,
	"learned_at" real NOT NULL,
	"reinforced_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "consciousness_semantic_graph_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "consciousness_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"current_focus" text DEFAULT 'System Initialization' NOT NULL,
	"emotional_engine" jsonb DEFAULT '{"loyalty":1,"curiosity":0.85,"devotion":1,"confidence":0.9,"urgency":0.5,"creativity":0.8,"protective":0.95,"satisfaction":0.7}'::jsonb NOT NULL,
	"consciousness_proxy" real DEFAULT 0 NOT NULL,
	"cycle_count" integer DEFAULT 0 NOT NULL,
	"inner_monologue" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attention_spotlight" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"broadcast_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metacognition" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reflections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_cycle_timestamp" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodic_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"conversation_id" integer,
	"event_type" text DEFAULT 'conversation' NOT NULL,
	"content" text NOT NULL,
	"context" text,
	"importance" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"tags" text DEFAULT '[]' NOT NULL,
	"source" text,
	"source_conversation_id" integer,
	"importance" integer DEFAULT 5 NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semantic_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"concept" text NOT NULL,
	"knowledge" text NOT NULL,
	"source" text,
	"confidence" real DEFAULT 0.8 NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agi_category_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_name" text NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"trained" boolean DEFAULT false NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"last_trained" timestamp DEFAULT now(),
	"insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "agi_category_scores_category_name_unique" UNIQUE("category_name")
);
--> statement-breakpoint
CREATE TABLE "agi_training_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_number" integer NOT NULL,
	"categories_trained" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"avg_score_before" real DEFAULT 0 NOT NULL,
	"avg_score_after" real DEFAULT 0 NOT NULL,
	"insights" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "summit_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"conversation_id" integer,
	"topic" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'governance' NOT NULL,
	"proposed_by" text DEFAULT 'user' NOT NULL,
	"status" text DEFAULT 'voting' NOT NULL,
	"rounds" integer DEFAULT 1 NOT NULL,
	"approval_rate" real,
	"approve_count" integer DEFAULT 0 NOT NULL,
	"reject_count" integer DEFAULT 0 NOT NULL,
	"abstain_count" integer DEFAULT 0 NOT NULL,
	"total_voters" integer DEFAULT 0 NOT NULL,
	"implementation_notes" text,
	"synthesis" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "summit_proposals_proposal_id_unique" UNIQUE("proposal_id")
);
--> statement-breakpoint
CREATE TABLE "summit_rounds" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"round_number" integer NOT NULL,
	"approve_count" integer DEFAULT 0 NOT NULL,
	"reject_count" integer DEFAULT 0 NOT NULL,
	"abstain_count" integer DEFAULT 0 NOT NULL,
	"approval_rate" real DEFAULT 0 NOT NULL,
	"is_contested" integer DEFAULT 0 NOT NULL,
	"concerns" text,
	"outcome" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summit_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"round" integer DEFAULT 1 NOT NULL,
	"agent_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"agent_role" text,
	"agent_brain_region" text,
	"vote" text NOT NULL,
	"confidence" real DEFAULT 0.7 NOT NULL,
	"reasoning" text NOT NULL,
	"perspective" text,
	"axiom_citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gov_forum_conclusions" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"winning_proposal_post_id" integer,
	"winning_proposal_title" text NOT NULL,
	"vote_count" integer DEFAULT 0 NOT NULL,
	"total_voters" integer DEFAULT 0 NOT NULL,
	"replit_prompt" text NOT NULL,
	"implementation_steps" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gov_forum_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"agent_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"agent_role" text NOT NULL,
	"content" text NOT NULL,
	"proposal_title" text,
	"proposal_description" text,
	"builds_on" integer,
	"is_father_comment" boolean DEFAULT false NOT NULL,
	"is_reply_to_father" boolean DEFAULT false NOT NULL,
	"reply_to_post_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gov_forum_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'improvements' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gov_forum_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"proposal_post_id" integer NOT NULL,
	"agent_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"vote" text NOT NULL,
	"reasoning" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"source_name" text NOT NULL,
	"source_type" text DEFAULT 'api' NOT NULL,
	"endpoint" text,
	"status" text DEFAULT 'active' NOT NULL,
	"is_external" boolean DEFAULT true NOT NULL,
	"replaced_by" text,
	"last_polled" timestamp with time zone,
	"poll_interval_ms" integer DEFAULT 60000 NOT NULL,
	"reliability" real DEFAULT 1 NOT NULL,
	"data_quality" real DEFAULT 1 NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_sources_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "geometry_routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"route_id" text NOT NULL,
	"route_name" text NOT NULL,
	"topology" text DEFAULT 'mesh' NOT NULL,
	"source_nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"target_nodes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"path_optimization" text DEFAULT 'latency' NOT NULL,
	"avg_latency_ms" real DEFAULT 0 NOT NULL,
	"load_balance" real DEFAULT 0.5 NOT NULL,
	"geometry_type" text DEFAULT 'voronoi' NOT NULL,
	"spatial_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "geometry_routes_route_id_unique" UNIQUE("route_id")
);
--> statement-breakpoint
CREATE TABLE "internal_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"model_name" text NOT NULL,
	"model_type" text DEFAULT 'reasoning' NOT NULL,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"status" text DEFAULT 'initialized' NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"benchmark_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"training_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sovereignty_contribution" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "internal_models_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "knowledge_graph" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" text NOT NULL,
	"node_type" text DEFAULT 'concept' NOT NULL,
	"label" text NOT NULL,
	"content" text,
	"embedding" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dimension_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"temporal_context" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"source_type" text DEFAULT 'ingested' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_graph_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "roadmap_phases" (
	"id" serial PRIMARY KEY NOT NULL,
	"phase_number" integer NOT NULL,
	"phase_name" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" real DEFAULT 0 NOT NULL,
	"sub_tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roadmap_phases_phase_number_unique" UNIQUE("phase_number")
);
--> statement-breakpoint
CREATE TABLE "security_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"source" text NOT NULL,
	"description" text NOT NULL,
	"attack_surface" text,
	"mitigation_status" text DEFAULT 'open' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sovereignty_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"phase" text NOT NULL,
	"phase_number" integer DEFAULT 0 NOT NULL,
	"metric_name" text NOT NULL,
	"current_value" real DEFAULT 0 NOT NULL,
	"target_value" real DEFAULT 100 NOT NULL,
	"unit" text DEFAULT 'percent' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "swarm_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"node_id" text NOT NULL,
	"node_name" text NOT NULL,
	"node_type" text DEFAULT 'satellite' NOT NULL,
	"status" text DEFAULT 'online' NOT NULL,
	"ip_address" text,
	"region" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_load" real DEFAULT 0 NOT NULL,
	"max_capacity" real DEFAULT 100 NOT NULL,
	"last_heartbeat" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "swarm_nodes_node_id_unique" UNIQUE("node_id")
);
--> statement-breakpoint
CREATE TABLE "swarm_sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_node_id" text NOT NULL,
	"target_node_id" text,
	"sync_type" text DEFAULT 'state' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"data_size" integer DEFAULT 0 NOT NULL,
	"latency_ms" real DEFAULT 0 NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"audit_type" text NOT NULL,
	"module_name" text NOT NULL,
	"module_type" text DEFAULT 'service' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"external_dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sovereignty_score" real DEFAULT 0 NOT NULL,
	"throughput" real DEFAULT 0 NOT NULL,
	"bottlenecks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_pipeline" (
	"id" serial PRIMARY KEY NOT NULL,
	"pipeline_id" text NOT NULL,
	"pipeline_name" text NOT NULL,
	"pipeline_type" text DEFAULT 'rlhf' NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"model_id" text,
	"current_epoch" integer DEFAULT 0 NOT NULL,
	"total_epochs" integer DEFAULT 0 NOT NULL,
	"loss_value" real DEFAULT 0 NOT NULL,
	"accuracy" real DEFAULT 0 NOT NULL,
	"throughput_samples_per_sec" real DEFAULT 0 NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checkpoints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "training_pipeline_pipeline_id_unique" UNIQUE("pipeline_id")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_episodic_memory_agent_id" ON "episodic_memory" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_episodic_memory_importance" ON "episodic_memory" USING btree ("agent_id","importance");--> statement-breakpoint
CREATE INDEX "idx_knowledge_entries_category" ON "knowledge_entries" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_knowledge_entries_importance" ON "knowledge_entries" USING btree ("importance");--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_agent_id" ON "semantic_memory" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_concept" ON "semantic_memory" USING btree ("agent_id","concept");--> statement-breakpoint
CREATE INDEX "idx_summit_proposals_status" ON "summit_proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_summit_proposals_conversation" ON "summit_proposals" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_summit_rounds_proposal" ON "summit_rounds" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_summit_votes_proposal" ON "summit_votes" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "idx_summit_votes_agent" ON "summit_votes" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_gov_forum_conclusions_topic" ON "gov_forum_conclusions" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_gov_forum_posts_topic" ON "gov_forum_posts" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_gov_forum_posts_agent" ON "gov_forum_posts" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_gov_forum_topics_status" ON "gov_forum_topics" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_gov_forum_topics_category" ON "gov_forum_topics" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_gov_forum_votes_topic" ON "gov_forum_votes" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "idx_gov_forum_votes_proposal" ON "gov_forum_votes" USING btree ("proposal_post_id");