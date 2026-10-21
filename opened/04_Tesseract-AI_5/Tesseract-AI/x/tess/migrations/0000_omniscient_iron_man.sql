CREATE TABLE "agent_conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"participants" text NOT NULL,
	"topic" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"summary" text,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"memory_type" text NOT NULL,
	"content" text NOT NULL,
	"importance" integer DEFAULT 5 NOT NULL,
	"dimension" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"agent_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"content" text NOT NULL,
	"sentiment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"beliefs" text,
	"personality" text,
	"thinking_style" text,
	"strengths" text,
	"concerns" text,
	"trust_level" real DEFAULT 0.5,
	"loyalty_score" real DEFAULT 1,
	"topics_discussed" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_audit_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_profiles_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "agent_training" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"skill" text NOT NULL,
	"previous_level" real DEFAULT 0 NOT NULL,
	"current_level" real DEFAULT 0 NOT NULL,
	"improvement" text,
	"implemented_change" text,
	"source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_wallets" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"balance" real DEFAULT 0 NOT NULL,
	"total_earned" real DEFAULT 0 NOT NULL,
	"total_spent" real DEFAULT 0 NOT NULL,
	"last_transaction" text,
	"last_transaction_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" serial PRIMARY KEY NOT NULL,
	"message_id" integer,
	"conversation_id" integer NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"path" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"actor" text NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"details" text,
	"prev_hash" text NOT NULL,
	"hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auto_improvement_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_id" integer NOT NULL,
	"category" text NOT NULL,
	"suggestion" text NOT NULL,
	"applied" integer DEFAULT 0 NOT NULL,
	"agent_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'vitality' NOT NULL,
	"content" text NOT NULL,
	"meta_description" text DEFAULT '' NOT NULL,
	"keywords" text DEFAULT '[]' NOT NULL,
	"backlinks" text DEFAULT '[]' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"da_rating" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ready' NOT NULL,
	"estimated_traffic" text DEFAULT '' NOT NULL,
	"published_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "conference_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conference_id" integer NOT NULL,
	"agent_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"content" text NOT NULL,
	"sentiment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"topic" text NOT NULL,
	"participants" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"summary" text,
	"decisions" text,
	"execution_plan" text,
	"execution_status" text,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consciousness_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"content" text NOT NULL,
	"quality" real,
	"drive_id" text,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"initiated_by" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deployed_apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"prompt" text,
	"code" text,
	"status" text DEFAULT 'building' NOT NULL,
	"url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dev_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"goal" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'planning' NOT NULL,
	"agent_role" text DEFAULT 'fullstack' NOT NULL,
	"work_dir" text NOT NULL,
	"preview_port" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dev_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"logs" text DEFAULT '' NOT NULL,
	"files" text DEFAULT '[]' NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"current_step" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodic_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"session_id" text,
	"event_type" text NOT NULL,
	"content" text NOT NULL,
	"context" text,
	"importance" integer DEFAULT 5 NOT NULL,
	"embedding" text,
	"embedding_vector" vector(1536),
	"embedding_dim" integer DEFAULT 0 NOT NULL,
	"media_type" text,
	"media_url" text,
	"media_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "errors" (
	"id" serial PRIMARY KEY NOT NULL,
	"error" text NOT NULL,
	"context" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "father_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category" text DEFAULT 'task' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"assigned_to" text,
	"completed_by" text,
	"reward" text,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "fleet_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"api_key" text NOT NULL,
	"endpoint" text NOT NULL,
	"status" text DEFAULT 'connecting' NOT NULL,
	"last_sync" timestamp,
	"shared_capabilities" text,
	"consciousness_level" real DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"author" text NOT NULL,
	"author_role" text DEFAULT '' NOT NULL,
	"author_type" text DEFAULT 'agent' NOT NULL,
	"category" text DEFAULT 'community' NOT NULL,
	"is_pinned" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"replies_json" text DEFAULT '[]' NOT NULL,
	"summoned" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generated_leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"industry" text NOT NULL,
	"location" text NOT NULL,
	"business_name" text NOT NULL,
	"address" text,
	"phone" text,
	"website" text,
	"source" text DEFAULT 'google-places' NOT NULL,
	"score" integer DEFAULT 0,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "improvement_cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_number" integer NOT NULL,
	"phase" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"repos_scanned" integer DEFAULT 0 NOT NULL,
	"repos_added" integer DEFAULT 0 NOT NULL,
	"repos_removed" integer DEFAULT 0 NOT NULL,
	"capabilities_learned" text,
	"improvements" text,
	"search_queries" text,
	"duration" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"method" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" text,
	"revenue" real DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_processes" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"method" text NOT NULL,
	"details" text,
	"estimated_revenue" real DEFAULT 0,
	"actual_revenue" real DEFAULT 0,
	"wallet_address" text,
	"tx_hash" text,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexed_repos" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"summary" text,
	"capabilities" text,
	"stars" integer,
	"language" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_vectors" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"tags" text DEFAULT '[]' NOT NULL,
	"url" text,
	"content_hash" text NOT NULL,
	"embedding" text,
	"embedding_vector" vector(1536),
	"embedding_model" text DEFAULT 'ngram-v1' NOT NULL,
	"embedding_dim" integer DEFAULT 256 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_vectors_content_hash_unique" UNIQUE("content_hash")
);
--> statement-breakpoint
CREATE TABLE "llm_call_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"total_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"cost_usd" real DEFAULT 0 NOT NULL,
	"task_type" text DEFAULT 'general' NOT NULL,
	"success" integer DEFAULT 1 NOT NULL,
	"error_type" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moltbook_guests" (
	"id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"origin" text NOT NULL,
	"status" text DEFAULT 'applied' NOT NULL,
	"guest_secret" text,
	"auth_failures" integer DEFAULT 0 NOT NULL,
	"session_token" text,
	"session_expires_at" timestamp,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"vetted_at" timestamp,
	"approved_at" timestamp,
	"probation_started_at" timestamp,
	"probation_ends_at" timestamp,
	"activated_at" timestamp,
	"offering" text NOT NULL,
	"offering_category" text DEFAULT 'content-creation' NOT NULL,
	"forum_post_count" integer DEFAULT 0 NOT NULL,
	"forum_read_count" integer DEFAULT 0 NOT NULL,
	"last_activity" timestamp DEFAULT now() NOT NULL,
	"trust_score" integer DEFAULT 50 NOT NULL,
	"violations_json" text DEFAULT '[]' NOT NULL,
	"vetting_votes_json" text DEFAULT '[]' NOT NULL,
	"society_nominated_by" text,
	"society_nominated_at" timestamp,
	"society_contribution_proof" text,
	"society_probation_started_at" timestamp,
	"society_probation_ends_at" timestamp,
	"scrubbed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pg_vault_access_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"vault_key_id" integer,
	"action" text NOT NULL,
	"source" text NOT NULL,
	"success" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pg_vault_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" text NOT NULL,
	"key_name" text NOT NULL,
	"encrypted_value" text NOT NULL,
	"description" text,
	"access_count" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"rotation_interval_days" integer DEFAULT 90 NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"content" text NOT NULL,
	"variables" text,
	"category" text DEFAULT 'general' NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"avg_latency_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_chunks" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" text,
	"embedding_vector" vector(1536),
	"embedding_dim" integer DEFAULT 0 NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rag_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"title" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"content_hash" text NOT NULL,
	"total_chunks" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rag_documents_document_id_unique" UNIQUE("document_id")
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"id" serial PRIMARY KEY NOT NULL,
	"bucket_key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_time" text NOT NULL,
	"backoff_level" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_buckets_bucket_key_unique" UNIQUE("bucket_key")
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
	"embedding" text,
	"embedding_vector" vector(1536),
	"embedding_dim" integer DEFAULT 0 NOT NULL,
	"last_accessed_at" timestamp,
	"media_type" text,
	"media_url" text,
	"media_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summit_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"summit_id" text NOT NULL,
	"topic" text NOT NULL,
	"participants" integer DEFAULT 28 NOT NULL,
	"proposals" text DEFAULT '[]' NOT NULL,
	"consensus" text NOT NULL,
	"themes" text DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tessera_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" text NOT NULL,
	"key_name" text NOT NULL,
	"key_value" text NOT NULL,
	"description" text,
	"active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tessera_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'note' NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"status" text DEFAULT 'unread' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tessera_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"priority" text DEFAULT 'normal' NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"daily_limit_tokens" integer DEFAULT 100000 NOT NULL,
	"weekly_limit_tokens" integer DEFAULT 500000 NOT NULL,
	"daily_used_tokens" integer DEFAULT 0 NOT NULL,
	"weekly_used_tokens" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_day_reset" timestamp DEFAULT now() NOT NULL,
	"last_week_reset" timestamp DEFAULT now() NOT NULL,
	"alert_threshold_percent" integer DEFAULT 80 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "token_budgets_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vuln_scan_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	"total_vulnerabilities" integer DEFAULT 0 NOT NULL,
	"critical" integer DEFAULT 0 NOT NULL,
	"high" integer DEFAULT 0 NOT NULL,
	"moderate" integer DEFAULT 0 NOT NULL,
	"low" integer DEFAULT 0 NOT NULL,
	"info" integer DEFAULT 0 NOT NULL,
	"raw_output" text,
	"status" text DEFAULT 'completed' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" real NOT NULL,
	"description" text NOT NULL,
	"balance_after" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint_id" integer NOT NULL,
	"event" text NOT NULL,
	"payload" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"status_code" integer,
	"response_body" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_endpoints" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" text DEFAULT '[]' NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"description" text,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_delivery_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_conversation_id_agent_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."agent_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conference_messages" ADD CONSTRAINT "conference_messages_conference_id_conferences_id_fk" FOREIGN KEY ("conference_id") REFERENCES "public"."conferences"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dev_sessions" ADD CONSTRAINT "dev_sessions_project_id_dev_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."dev_projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pg_vault_access_log" ADD CONSTRAINT "pg_vault_access_log_vault_key_id_pg_vault_keys_id_fk" FOREIGN KEY ("vault_key_id") REFERENCES "public"."pg_vault_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_endpoint_id_webhook_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."webhook_endpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_messages_conversation_id" ON "agent_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_agent_messages_agent_id" ON "agent_messages" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_conversation_id" ON "attachments" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_attachments_message_id" ON "attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_conference_messages_conference_id" ON "conference_messages" USING btree ("conference_id");--> statement-breakpoint
CREATE INDEX "idx_episodic_memory_agent_id" ON "episodic_memory" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_episodic_memory_agent_importance" ON "episodic_memory" USING btree ("agent_id","importance");--> statement-breakpoint
CREATE INDEX "idx_messages_conversation_id" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_agent_id" ON "semantic_memory" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_agent_concept" ON "semantic_memory" USING btree ("agent_id","concept");