ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "proposals" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "votes" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "results" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "approved_proposals" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "tda_conferences" ADD COLUMN IF NOT EXISTS "summary" text NOT NULL DEFAULT '';
