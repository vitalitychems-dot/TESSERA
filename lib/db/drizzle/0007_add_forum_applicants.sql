CREATE TABLE IF NOT EXISTS "forum_applicants" (
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
ALTER TABLE "forum_applicants" ADD COLUMN IF NOT EXISTS "external_identity" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "forum_applicants" ADD COLUMN IF NOT EXISTS "contact" text DEFAULT '' NOT NULL;
