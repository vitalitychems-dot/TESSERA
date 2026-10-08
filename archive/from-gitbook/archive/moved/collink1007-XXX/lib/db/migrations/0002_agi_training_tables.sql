-- Migration: AGI Training & Benchmarking
-- Task #2: Adds agi_category_scores and agi_training_history tables for persistent AGI training state

CREATE TABLE IF NOT EXISTS agi_category_scores (
  id SERIAL PRIMARY KEY,
  category_name TEXT NOT NULL UNIQUE,
  score REAL NOT NULL DEFAULT 0,
  trained BOOLEAN NOT NULL DEFAULT FALSE,
  sessions INTEGER NOT NULL DEFAULT 0,
  last_trained TIMESTAMPTZ DEFAULT NOW(),
  insights JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agi_category_name ON agi_category_scores(category_name);

CREATE TABLE IF NOT EXISTS agi_training_history (
  id SERIAL PRIMARY KEY,
  cycle_number INTEGER NOT NULL,
  categories_trained JSONB NOT NULL DEFAULT '[]',
  avg_score_before REAL NOT NULL DEFAULT 0,
  avg_score_after REAL NOT NULL DEFAULT 0,
  insights JSONB NOT NULL DEFAULT '[]',
  completed_at TIMESTAMPTZ DEFAULT NOW()
);
