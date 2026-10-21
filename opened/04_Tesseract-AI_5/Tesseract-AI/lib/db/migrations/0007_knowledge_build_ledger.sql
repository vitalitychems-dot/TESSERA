CREATE TABLE IF NOT EXISTS "knowledge_build_ledger" (
	"id" serial PRIMARY KEY NOT NULL,
	"content_hash" text NOT NULL UNIQUE,
	"node_id" text NOT NULL,
	"domain" text NOT NULL,
	"label" text NOT NULL,
	"source_url" text,
	"source_type" text NOT NULL DEFAULT 'api',
	"raw_content" text,
	"built_upon" boolean NOT NULL DEFAULT false,
	"build_cycle_id" text,
	"insights_generated" jsonb NOT NULL DEFAULT '[]',
	"connections_found" integer NOT NULL DEFAULT 0,
	"cross_domain_links" jsonb NOT NULL DEFAULT '[]',
	"absorption_cycle" integer NOT NULL DEFAULT 0,
	"created_at" timestamptz NOT NULL DEFAULT now(),
	"built_at" timestamptz
);
