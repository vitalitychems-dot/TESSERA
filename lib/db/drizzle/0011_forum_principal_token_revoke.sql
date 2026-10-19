ALTER TABLE "forum_principal_tokens" ADD COLUMN IF NOT EXISTS "revoked_at" timestamp;
--> statement-breakpoint
ALTER TABLE "forum_principal_tokens" ADD COLUMN IF NOT EXISTS "expires_at" timestamp;
