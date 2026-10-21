CREATE TABLE IF NOT EXISTS "swarm_training_cycles" (
  "id" serial PRIMARY KEY NOT NULL,
  "cycle_id" text NOT NULL UNIQUE,
  "cycle_number" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending',
  "phase" text NOT NULL DEFAULT 'ingestion',
  "dimensions_processed" jsonb NOT NULL DEFAULT '[]',
  "knowledge_absorbed" integer NOT NULL DEFAULT 0,
  "agents_participated" integer NOT NULL DEFAULT 0,
  "votes_received" integer NOT NULL DEFAULT 0,
  "votes_approved" integer NOT NULL DEFAULT 0,
  "convergence_score" real NOT NULL DEFAULT 0,
  "reinforcement_signals" jsonb NOT NULL DEFAULT '[]',
  "cross_dimensional_insights" jsonb NOT NULL DEFAULT '[]',
  "latency_ms" real NOT NULL DEFAULT 0,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "started_at" timestamp with time zone NOT NULL DEFAULT now(),
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "swarm_votes" (
  "id" serial PRIMARY KEY NOT NULL,
  "vote_id" text NOT NULL UNIQUE,
  "cycle_id" text NOT NULL,
  "agent_id" text NOT NULL,
  "agent_name" text NOT NULL,
  "proposal_type" text NOT NULL DEFAULT 'improvement',
  "proposal" text NOT NULL,
  "vote" text NOT NULL DEFAULT 'approve',
  "confidence" real NOT NULL DEFAULT 0.5,
  "reasoning" text,
  "dimensional_perspective" text,
  "weight" real NOT NULL DEFAULT 1.0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "geometry_computations" (
  "id" serial PRIMARY KEY NOT NULL,
  "computation_id" text NOT NULL UNIQUE,
  "computation_type" text NOT NULL DEFAULT 'voronoi',
  "input_nodes" jsonb NOT NULL DEFAULT '[]',
  "output_topology" jsonb NOT NULL DEFAULT '{}',
  "optimization_target" text NOT NULL DEFAULT 'latency',
  "latency_reduction" real NOT NULL DEFAULT 0,
  "load_balance_improvement" real NOT NULL DEFAULT 0,
  "path_efficiency" real NOT NULL DEFAULT 0,
  "spatial_layout" jsonb NOT NULL DEFAULT '{}',
  "dimensional_mappings" jsonb NOT NULL DEFAULT '[]',
  "status" text NOT NULL DEFAULT 'pending',
  "compute_time_ms" real NOT NULL DEFAULT 0,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "title" text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "proposals" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "votes" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "results" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "approved_proposals" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "summary" text NOT NULL DEFAULT '';
