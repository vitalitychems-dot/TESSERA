CREATE TABLE IF NOT EXISTS "evaluation_runs" (
        "id" serial PRIMARY KEY NOT NULL,
        "run_id" text NOT NULL UNIQUE,
        "run_type" text NOT NULL DEFAULT 'agi_benchmark',
        "total_score" real NOT NULL DEFAULT 0,
        "max_possible" real NOT NULL DEFAULT 0,
        "percentile" real NOT NULL DEFAULT 0,
        "grade" text NOT NULL DEFAULT 'F',
        "dimension_scores" jsonb NOT NULL DEFAULT '{}',
        "regressions" jsonb NOT NULL DEFAULT '[]',
        "improvements" jsonb NOT NULL DEFAULT '[]',
        "improvement_plan" jsonb NOT NULL DEFAULT '[]',
        "summary" text,
        "metadata" jsonb NOT NULL DEFAULT '{}',
        "ran_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "provider_benchmarks" (
        "id" serial PRIMARY KEY NOT NULL,
        "benchmark_id" text NOT NULL UNIQUE,
        "provider" text NOT NULL,
        "model" text NOT NULL,
        "latency_ms" real NOT NULL DEFAULT 0,
        "p50_latency_ms" real NOT NULL DEFAULT 0,
        "p95_latency_ms" real NOT NULL DEFAULT 0,
        "accuracy_score" real NOT NULL DEFAULT 0,
        "tokens_per_second" real NOT NULL DEFAULT 0,
        "cost_per_thousand_tokens" real NOT NULL DEFAULT 0,
        "tests_passed" integer NOT NULL DEFAULT 0,
        "tests_total" integer NOT NULL DEFAULT 0,
        "test_results" jsonb NOT NULL DEFAULT '[]',
        "available" boolean NOT NULL DEFAULT false,
        "error_message" text,
        "ran_at" timestamptz NOT NULL DEFAULT now(),
        "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "evaluation_runs_ran_at_idx" ON "evaluation_runs" ("ran_at" DESC);
CREATE INDEX IF NOT EXISTS "provider_benchmarks_provider_idx" ON "provider_benchmarks" ("provider", "ran_at" DESC);
