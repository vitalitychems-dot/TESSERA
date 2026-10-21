-- Migration: Memory & Knowledge Persistence
-- Task #3: Adds episodic_memory, semantic_memory, and knowledge_entries tables
-- Run this against the database to create the required tables.

CREATE TABLE IF NOT EXISTS episodic_memory (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  conversation_id INTEGER,
  event_type TEXT NOT NULL DEFAULT 'conversation',
  content TEXT NOT NULL,
  context TEXT,
  importance INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_episodic_memory_agent_id ON episodic_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_episodic_memory_importance ON episodic_memory(agent_id, importance);

CREATE TABLE IF NOT EXISTS semantic_memory (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL,
  concept TEXT NOT NULL,
  knowledge TEXT NOT NULL,
  source TEXT,
  confidence REAL NOT NULL DEFAULT 0.8,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_semantic_memory_agent_id ON semantic_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_semantic_memory_concept ON semantic_memory(agent_id, concept);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  tags TEXT NOT NULL DEFAULT '[]',
  source TEXT,
  source_conversation_id INTEGER,
  importance INTEGER NOT NULL DEFAULT 5,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_category ON knowledge_entries(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_entries_importance ON knowledge_entries(importance);
