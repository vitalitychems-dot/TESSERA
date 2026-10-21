-- Safe no-op: tda_conferences columns are now created in 0005_swarm_geometry_tables.sql
-- These ALTER statements are kept for idempotency in environments where the table pre-existed
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "proposals" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "votes" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "results" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "approved_proposals" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "summary" text NOT NULL DEFAULT '';
