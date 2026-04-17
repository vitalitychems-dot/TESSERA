CREATE TABLE "self_critique_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_query" text NOT NULL,
	"final_response" text NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"grounding_score_x1000" integer DEFAULT 0 NOT NULL,
	"truthfulness_score_x1000" integer DEFAULT 0 NOT NULL,
	"hallucination_severity" text DEFAULT 'none' NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verdict" text DEFAULT 'safe' NOT NULL,
	"attempt_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pinned_diagrams" (
	"id" serial PRIMARY KEY NOT NULL,
	"diagram_id" text NOT NULL,
	"user_id" text,
	"type" text DEFAULT 'abstract' NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"color" text,
	"secondary_color" text,
	"size" real,
	"detail" text,
	"note" text,
	"source_message_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pinned_diagrams_diagram_id_unique" UNIQUE("diagram_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_applicants" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"external_identity" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'moltbook' NOT NULL,
	"applicant_name" text NOT NULL,
	"applicant_handle" text DEFAULT '' NOT NULL,
	"contact" text DEFAULT '' NOT NULL,
	"proposed_title" text NOT NULL,
	"proposed_content" text NOT NULL,
	"offer_of_value" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"vetted_by" text,
	"vetted_at" timestamp,
	"reject_reason" text,
	"promoted_topic_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "forum_applicants_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "forum_knowledge" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_number" integer NOT NULL,
	"insight_type" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source_topic_id" integer,
	"source_proposal_id" integer,
	"author" text NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"referenced_by" integer DEFAULT 0 NOT NULL,
	"superseded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_learning_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_number" integer NOT NULL,
	"collaboration_score" integer DEFAULT 0 NOT NULL,
	"knowledge_depth" integer DEFAULT 0 NOT NULL,
	"cross_domain_links" integer DEFAULT 0 NOT NULL,
	"proposal_quality" integer DEFAULT 0 NOT NULL,
	"insight_count" integer DEFAULT 0 NOT NULL,
	"topics_referring_past" integer DEFAULT 0 NOT NULL,
	"improvement_delta" integer DEFAULT 0 NOT NULL,
	"reflection_summary" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_principal_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"principal_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "forum_principal_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "forum_proposals" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"proposed_by" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"votes_yes" integer DEFAULT 0 NOT NULL,
	"votes_no" integer DEFAULT 0 NOT NULL,
	"votes_abstain" integer DEFAULT 0 NOT NULL,
	"threshold" integer DEFAULT 5 NOT NULL,
	"outcome" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "forum_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"topic_id" integer NOT NULL,
	"content" text NOT NULL,
	"author" text NOT NULL,
	"author_type" text DEFAULT 'human' NOT NULL,
	"author_key_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"author" text DEFAULT '' NOT NULL,
	"author_type" text DEFAULT 'human' NOT NULL,
	"author_key_hash" text,
	"category" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"replies" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forum_trusted_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"identity_type" text NOT NULL,
	"can_post_from_client" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "forum_trusted_identities_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "forum_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" integer NOT NULL,
	"voter" text NOT NULL,
	"voter_type" text DEFAULT 'agent' NOT NULL,
	"vote" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canon_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"testaments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"books" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"chapters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"total_books" integer DEFAULT 0 NOT NULL,
	"total_chapters" integer DEFAULT 0 NOT NULL,
	"total_verses" integer DEFAULT 0 NOT NULL,
	"sovereignty_score" real,
	"trigger_source" text DEFAULT 'manual' NOT NULL,
	"council_decision_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "council_meetings" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" text NOT NULL,
	"topic" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"rounds" integer DEFAULT 3 NOT NULL,
	"agent_contributions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"critiques" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"voting_results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"action_plan" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"self_expansion_analysis" jsonb DEFAULT 'null'::jsonb,
	"transcript" text NOT NULL,
	"outcome" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "council_meetings_meeting_id_unique" UNIQUE("meeting_id")
);
--> statement-breakpoint
CREATE TABLE "evaluation_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"suite_type" text NOT NULL,
	"benchmark_format" text DEFAULT 'custom' NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"correct_answers" integer DEFAULT 0 NOT NULL,
	"accuracy_pct" real DEFAULT 0 NOT NULL,
	"avg_latency_ms" real,
	"hallucinations" integer DEFAULT 0 NOT NULL,
	"provider_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"question_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'complete' NOT NULL,
	"notes" text,
	"ran_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "evaluation_runs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "improvement_cycles" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_id" text NOT NULL,
	"phase" text DEFAULT 'observe' NOT NULL,
	"observations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"weak_areas_identified" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proposed_improvements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"implemented_improvements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sovereignty_score_before" real DEFAULT 0 NOT NULL,
	"sovereignty_score_after" real,
	"internal_call_ratio_before" real DEFAULT 0 NOT NULL,
	"internal_call_ratio_after" real,
	"evaluation_run_id" text,
	"status" text DEFAULT 'complete' NOT NULL,
	"cycle_number" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "improvement_cycles_cycle_id_unique" UNIQUE("cycle_id")
);
--> statement-breakpoint
CREATE TABLE "ontology_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"domain" text NOT NULL,
	"concept_id" text NOT NULL,
	"concept_name" text NOT NULL,
	"definition" text NOT NULL,
	"related_concepts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cross_domain_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_url" text,
	"confidence" real DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"decision_id" text NOT NULL,
	"task_description" text NOT NULL,
	"task_domains" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selected_agent" text NOT NULL,
	"selected_provider" text NOT NULL,
	"path_taken" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"edge_weights_used" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"latency_ms" real,
	"load_balanced_away" boolean DEFAULT false NOT NULL,
	"algorithm" text DEFAULT 'dijkstra' NOT NULL,
	"decided_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "routing_decisions_decision_id_unique" UNIQUE("decision_id")
);
--> statement-breakpoint
CREATE TABLE "identity_verification_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"identity" text NOT NULL,
	"question_key" text NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"attempted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "natal_chart" (
	"id" serial PRIMARY KEY NOT NULL,
	"identity" text NOT NULL,
	"birth_date" text NOT NULL,
	"birth_time" text NOT NULL,
	"birth_place" text NOT NULL,
	"house_system" text DEFAULT 'Placidus' NOT NULL,
	"planets" jsonb NOT NULL,
	"houses" jsonb NOT NULL,
	"aspects" jsonb NOT NULL,
	"sovereign_keys" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "natal_chart_identity_unique" UNIQUE("identity")
);
--> statement-breakpoint
CREATE TABLE "agent_hierarchy" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"name" text NOT NULL,
	"parent_agent" text,
	"tier" text DEFAULT 'council' NOT NULL,
	"shift" text,
	"status" text DEFAULT 'active' NOT NULL,
	"domain" text DEFAULT 'general' NOT NULL,
	"last_active_at" timestamp DEFAULT now(),
	"task_history" jsonb DEFAULT '[]'::jsonb,
	"performance_metrics" jsonb DEFAULT '{"tasksCompleted":0,"successRate":1,"avgResponseMs":0,"ethicsScore":95}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_hierarchy_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "compression_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"total_input_facts" integer DEFAULT 0 NOT NULL,
	"total_canonical_facts" integer DEFAULT 0 NOT NULL,
	"duplicates_removed" integer DEFAULT 0 NOT NULL,
	"original_bytes" integer DEFAULT 0 NOT NULL,
	"compressed_bytes" integer DEFAULT 0 NOT NULL,
	"compression_ratio" real DEFAULT 1 NOT NULL,
	"avg_retrieval_ms" real DEFAULT 0 NOT NULL,
	"portal_jump_entries" integer DEFAULT 0 NOT NULL,
	"dictionary_size" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"dictionary_data" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "compression_runs_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "council_config_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"subsystem" text NOT NULL,
	"parameter" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "distilled_knowledge" (
	"id" serial PRIMARY KEY NOT NULL,
	"fact" text,
	"category" text DEFAULT 'general' NOT NULL,
	"source" text DEFAULT 'llm' NOT NULL,
	"source_prompt" text,
	"confidence" real DEFAULT 0.8 NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"last_verified_at" timestamp,
	"canonical_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_canonical" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_fact" text NOT NULL,
	"encoded_fact" text,
	"encoded_dict_run_id" text,
	"embedding" jsonb DEFAULT '[]'::jsonb,
	"domains" jsonb DEFAULT '[]'::jsonb,
	"source_ids" jsonb DEFAULT '[]'::jsonb,
	"confidence" real DEFAULT 0.8 NOT NULL,
	"compression_ratio" real DEFAULT 1 NOT NULL,
	"access_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "self_evaluation_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle_number" integer NOT NULL,
	"overall_score" real NOT NULL,
	"cache_hit_rate" real DEFAULT 0 NOT NULL,
	"knowledge_hit_rate" real DEFAULT 0 NOT NULL,
	"embedding_quality" real DEFAULT 0 NOT NULL,
	"llm_calls_reduced" integer DEFAULT 0 NOT NULL,
	"source_scores" jsonb DEFAULT '{}'::jsonb,
	"adjustments" jsonb DEFAULT '{}'::jsonb,
	"weak_areas" jsonb DEFAULT '[]'::jsonb,
	"strong_areas" jsonb DEFAULT '[]'::jsonb,
	"evaluated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "semantic_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"prompt_hash" text NOT NULL,
	"prompt_text" text NOT NULL,
	"embedding" jsonb DEFAULT '[]'::jsonb,
	"response" text NOT NULL,
	"model" text DEFAULT 'gpt-5-mini' NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"ttl_seconds" integer DEFAULT 3600 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_hit_at" timestamp,
	CONSTRAINT "semantic_cache_prompt_hash_unique" UNIQUE("prompt_hash")
);
--> statement-breakpoint
CREATE TABLE "tuning_decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric" text NOT NULL,
	"parameter" text NOT NULL,
	"old_value" real NOT NULL,
	"new_value" real NOT NULL,
	"reason" text NOT NULL,
	"cycle_number" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ability_tests" (
	"id" serial PRIMARY KEY NOT NULL,
	"test_id" text NOT NULL,
	"department_id" text NOT NULL,
	"position_id" text,
	"domain" text NOT NULL,
	"challenges" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"max_score" real DEFAULT 100 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ability_tests_test_id_unique" UNIQUE("test_id")
);
--> statement-breakpoint
CREATE TABLE "competition_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"competition_id" text NOT NULL,
	"department_id" text NOT NULL,
	"position_id" text NOT NULL,
	"candidates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"winner" text,
	"vote_results" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "competition_log_competition_id_unique" UNIQUE("competition_id")
);
--> statement-breakpoint
CREATE TABLE "department_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"position_id" text NOT NULL,
	"department_id" text NOT NULL,
	"title" text NOT NULL,
	"requirements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"incumbent" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "department_positions_position_id_unique" UNIQUE("position_id")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"department_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"leader" text,
	"members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"performance_score" real DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "departments_department_id_unique" UNIQUE("department_id")
);
--> statement-breakpoint
CREATE TABLE "talent_pool" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_name" text NOT NULL,
	"preferred_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "talent_pool_agent_name_unique" UNIQUE("agent_name")
);
--> statement-breakpoint
CREATE TABLE "test_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"result_id" text NOT NULL,
	"test_id" text NOT NULL,
	"agent_name" text NOT NULL,
	"score" real NOT NULL,
	"max_score" real DEFAULT 100 NOT NULL,
	"rank" integer,
	"assessment" text DEFAULT '' NOT NULL,
	"passed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "test_results_result_id_unique" UNIQUE("result_id")
);
--> statement-breakpoint
CREATE TABLE "message_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer,
	"message_id" integer,
	"client_msg_key" text,
	"rating" text NOT NULL,
	"reason" text,
	"user_query" text,
	"response_excerpt" text,
	"model_tier" text,
	"router_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_routing_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"query" text NOT NULL,
	"model_tier" text NOT NULL,
	"model_name" text NOT NULL,
	"reason" text,
	"estimated_tokens" integer,
	"actual_latency_ms" integer,
	"cache_hit" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inventions" ADD COLUMN "custom_model_url" text;--> statement-breakpoint
CREATE INDEX "pinned_diagrams_user_idx" ON "pinned_diagrams" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pinned_diagrams_created_at_idx" ON "pinned_diagrams" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "canon_snapshots_version_idx" ON "canon_snapshots" USING btree ("version");--> statement-breakpoint
CREATE INDEX "canon_snapshots_generated_at_idx" ON "canon_snapshots" USING btree ("generated_at");--> statement-breakpoint
CREATE INDEX "council_meetings_created_at_idx" ON "council_meetings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "eval_runs_suite_idx" ON "evaluation_runs" USING btree ("suite_type");--> statement-breakpoint
CREATE INDEX "eval_runs_ran_at_idx" ON "evaluation_runs" USING btree ("ran_at");--> statement-breakpoint
CREATE INDEX "improvement_cycles_completed_at_idx" ON "improvement_cycles" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "ontology_domain_idx" ON "ontology_entries" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "ontology_concept_id_idx" ON "ontology_entries" USING btree ("concept_id");--> statement-breakpoint
CREATE INDEX "routing_decisions_decided_at_idx" ON "routing_decisions" USING btree ("decided_at");--> statement-breakpoint
CREATE INDEX "positions_dept_idx" ON "department_positions" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "positions_status_idx" ON "department_positions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "departments_name_idx" ON "departments" USING btree ("name");--> statement-breakpoint
CREATE INDEX "results_agent_idx" ON "test_results" USING btree ("agent_name");--> statement-breakpoint
CREATE INDEX "results_test_idx" ON "test_results" USING btree ("test_id");