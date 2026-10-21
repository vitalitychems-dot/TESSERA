CREATE TABLE IF NOT EXISTS "cognitive_state_snapshots" (
  "id" serial PRIMARY KEY,
  "snapshot_type" text NOT NULL DEFAULT 'periodic',
  "cognitive_load" real NOT NULL DEFAULT 0,
  "active_engines" integer NOT NULL DEFAULT 0,
  "total_cycles_running" integer NOT NULL DEFAULT 0,
  "memory_pressure" real NOT NULL DEFAULT 0,
  "processing_latency_ms" real NOT NULL DEFAULT 0,
  "attention_distribution" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "engine_health_map" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "decision_quality" real NOT NULL DEFAULT 0.5,
  "coherence_score" real NOT NULL DEFAULT 0,
  "awareness_level" real NOT NULL DEFAULT 0,
  "autonomy_level" real NOT NULL DEFAULT 0,
  "sovereignty_readiness" real NOT NULL DEFAULT 0,
  "anomaly_flags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "epistemic_journal" (
  "id" serial PRIMARY KEY,
  "domain" text NOT NULL,
  "knowledge_type" text NOT NULL DEFAULT 'factual',
  "certainty_level" real NOT NULL DEFAULT 0.5,
  "evidence_basis" text NOT NULL,
  "known_unknowns" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "predictions" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "prediction_outcomes" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "calibration_score" real NOT NULL DEFAULT 0.5,
  "source_engines" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "last_validated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "causal_analysis" (
  "id" serial PRIMARY KEY,
  "trigger_event" text NOT NULL,
  "trigger_engine" text NOT NULL,
  "effect_observed" text NOT NULL,
  "causal_chain" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "confidence" real NOT NULL DEFAULT 0.5,
  "analysis_type" text NOT NULL DEFAULT 'post_hoc',
  "related_task_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "counterfactual" text,
  "intervention_suggested" text,
  "validated" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_cognitive_snapshots_type" ON "cognitive_state_snapshots" ("snapshot_type");
CREATE INDEX IF NOT EXISTS "idx_cognitive_snapshots_created" ON "cognitive_state_snapshots" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_epistemic_domain" ON "epistemic_journal" ("domain");
CREATE INDEX IF NOT EXISTS "idx_epistemic_certainty" ON "epistemic_journal" ("certainty_level");
CREATE INDEX IF NOT EXISTS "idx_causal_trigger_engine" ON "causal_analysis" ("trigger_engine");
CREATE INDEX IF NOT EXISTS "idx_causal_type" ON "causal_analysis" ("analysis_type");
