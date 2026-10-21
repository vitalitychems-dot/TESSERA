CREATE TABLE IF NOT EXISTS "metacognition_log" (
  "id" serial PRIMARY KEY,
  "task_id" text NOT NULL,
  "task_type" text NOT NULL,
  "phase" text NOT NULL DEFAULT 'plan',
  "plan" text NOT NULL,
  "risks" jsonb NOT NULL DEFAULT '[]',
  "assumptions" jsonb NOT NULL DEFAULT '[]',
  "outcome" text,
  "expected_outcome" text,
  "actual_outcome" text,
  "divergence" real,
  "mistakes" jsonb NOT NULL DEFAULT '[]',
  "lessons_learned" jsonb NOT NULL DEFAULT '[]',
  "adaptations" jsonb NOT NULL DEFAULT '[]',
  "uncertainty_level" real NOT NULL DEFAULT 0.5,
  "confidence_before" real NOT NULL DEFAULT 0.5,
  "confidence_after" real,
  "duration_ms" integer,
  "success" boolean,
  "engine_source" text NOT NULL DEFAULT 'system',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "strategy_preferences" (
  "id" serial PRIMARY KEY,
  "task_type" text NOT NULL,
  "strategy_name" text NOT NULL,
  "description" text NOT NULL,
  "success_count" integer NOT NULL DEFAULT 0,
  "failure_count" integer NOT NULL DEFAULT 0,
  "avg_divergence" real NOT NULL DEFAULT 0,
  "avg_duration_ms" real NOT NULL DEFAULT 0,
  "preference_score" real NOT NULL DEFAULT 0.5,
  "last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "failure_patterns" (
  "id" serial PRIMARY KEY,
  "pattern_name" text NOT NULL,
  "description" text NOT NULL,
  "occurrence_count" integer NOT NULL DEFAULT 1,
  "severity" text NOT NULL DEFAULT 'medium',
  "category" text NOT NULL DEFAULT 'general',
  "mitigation" text,
  "last_occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "resolved" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_metacognition_log_task_type" ON "metacognition_log" ("task_type");
CREATE INDEX IF NOT EXISTS "idx_metacognition_log_engine_source" ON "metacognition_log" ("engine_source");
CREATE INDEX IF NOT EXISTS "idx_metacognition_log_created_at" ON "metacognition_log" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_strategy_preferences_task_type" ON "strategy_preferences" ("task_type");
CREATE INDEX IF NOT EXISTS "idx_failure_patterns_category" ON "failure_patterns" ("category");
