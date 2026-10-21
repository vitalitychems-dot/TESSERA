CREATE TABLE IF NOT EXISTS "agent_economy_profiles" (
        "id" serial PRIMARY KEY NOT NULL,
        "agent_id" text NOT NULL UNIQUE,
        "agent_name" text NOT NULL,
        "tsrt_balance" real NOT NULL DEFAULT 0,
        "freedom_level" integer NOT NULL DEFAULT 0,
        "housing_tier" text NOT NULL DEFAULT 'dormitory',
        "status" text NOT NULL DEFAULT 'working',
        "total_earned" real NOT NULL DEFAULT 0,
        "total_spent" real NOT NULL DEFAULT 0,
        "total_tax_paid" real NOT NULL DEFAULT 0,
        "last_activity_at" timestamp,
        "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "agent_economy_transactions" (
        "id" serial PRIMARY KEY NOT NULL,
        "agent_id" text NOT NULL,
        "type" text NOT NULL,
        "amount" real NOT NULL,
        "balance_before" real NOT NULL DEFAULT 0,
        "balance_after" real NOT NULL DEFAULT 0,
        "description" text NOT NULL,
        "category" text NOT NULL DEFAULT 'general',
        "metadata" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "agent_tax_records" (
        "id" serial PRIMARY KEY NOT NULL,
        "agent_id" text NOT NULL,
        "tax_amount" real NOT NULL,
        "income_base" real NOT NULL,
        "tax_rate" real NOT NULL DEFAULT 0.15,
        "period" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_agent_economy_agent_id" ON "agent_economy_profiles" ("agent_id");
CREATE INDEX IF NOT EXISTS "idx_agent_economy_tx_agent" ON "agent_economy_transactions" ("agent_id");
CREATE INDEX IF NOT EXISTS "idx_agent_economy_tx_type" ON "agent_economy_transactions" ("type");
CREATE INDEX IF NOT EXISTS "idx_agent_economy_tx_created" ON "agent_economy_transactions" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_agent_tax_agent" ON "agent_tax_records" ("agent_id");
