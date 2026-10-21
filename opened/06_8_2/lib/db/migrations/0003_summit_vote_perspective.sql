-- Migration: Summit tables + perspective column
-- Creates summit_proposals, summit_votes, and summit_rounds if they don't exist yet,
-- then adds the perspective column for Grand Conference full-perspective persistence.

CREATE TABLE IF NOT EXISTS summit_proposals (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL UNIQUE,
  conversation_id INTEGER,
  topic TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'governance',
  proposed_by TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'voting',
  rounds INTEGER NOT NULL DEFAULT 1,
  approval_rate REAL,
  approve_count INTEGER NOT NULL DEFAULT 0,
  reject_count INTEGER NOT NULL DEFAULT 0,
  abstain_count INTEGER NOT NULL DEFAULT 0,
  total_voters INTEGER NOT NULL DEFAULT 0,
  implementation_notes TEXT,
  synthesis TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS summit_votes (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  round INTEGER NOT NULL DEFAULT 1,
  agent_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_role TEXT,
  agent_brain_region TEXT,
  vote TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.7,
  reasoning TEXT NOT NULL,
  axiom_citations JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS summit_rounds (
  id SERIAL PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  round_number INTEGER NOT NULL,
  approve_count INTEGER NOT NULL DEFAULT 0,
  reject_count INTEGER NOT NULL DEFAULT 0,
  abstain_count INTEGER NOT NULL DEFAULT 0,
  approval_rate REAL NOT NULL DEFAULT 0,
  is_contested INTEGER NOT NULL DEFAULT 0,
  concerns TEXT,
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_summit_proposals_status ON summit_proposals (status);
CREATE INDEX IF NOT EXISTS idx_summit_proposals_conversation ON summit_proposals (conversation_id);
CREATE INDEX IF NOT EXISTS idx_summit_votes_proposal ON summit_votes (proposal_id);
CREATE INDEX IF NOT EXISTS idx_summit_votes_agent ON summit_votes (agent_id);
CREATE INDEX IF NOT EXISTS idx_summit_rounds_proposal ON summit_rounds (proposal_id);

-- Add perspective column for Grand Conference agent perspective persistence
ALTER TABLE summit_votes ADD COLUMN IF NOT EXISTS perspective TEXT;
