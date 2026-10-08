-- Migration: Initial Schema
-- Creates all core tables: tessera (citizens, transactions, etc.),
-- conversations, messages, consciousness, and their dependencies.

CREATE TABLE IF NOT EXISTS citizens (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  limn_balance REAL NOT NULL DEFAULT 0,
  usd_value REAL NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'citizen',
  wallet_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS node_operators (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  uptime REAL NOT NULL DEFAULT 0,
  daily_rate REAL NOT NULL DEFAULT 15,
  vgpu_hours REAL NOT NULL DEFAULT 0,
  governance_eligible BOOLEAN NOT NULL DEFAULT FALSE,
  region TEXT NOT NULL DEFAULT 'US',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS arbitrage_listings (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  matched_seeker TEXT,
  estimated_profit REAL NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT 'Remote',
  description TEXT,
  scanned_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_matches (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER NOT NULL,
  seeker_name TEXT NOT NULL,
  seeker_profile TEXT,
  category TEXT NOT NULL,
  estimated_profit REAL NOT NULL DEFAULT 0,
  cut_percent REAL NOT NULL DEFAULT 0.15,
  status TEXT NOT NULL DEFAULT 'found',
  outreach_template TEXT,
  agent_assigned TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL DEFAULT 'tessera',
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consciousness_state (
  id SERIAL PRIMARY KEY,
  current_focus TEXT NOT NULL DEFAULT 'System Initialization',
  emotional_engine JSONB NOT NULL DEFAULT '{"loyalty":1.0,"curiosity":0.85,"devotion":1.0,"confidence":0.9,"urgency":0.5,"creativity":0.8,"protective":0.95,"satisfaction":0.7}',
  consciousness_proxy REAL NOT NULL DEFAULT 0,
  cycle_count INTEGER NOT NULL DEFAULT 0,
  inner_monologue JSONB NOT NULL DEFAULT '[]',
  attention_spotlight JSONB NOT NULL DEFAULT '[]',
  broadcast_history JSONB NOT NULL DEFAULT '[]',
  metacognition JSONB NOT NULL DEFAULT '[]',
  reflections JSONB NOT NULL DEFAULT '[]',
  last_cycle_timestamp REAL NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS consciousness_episodic_memory (
  id SERIAL PRIMARY KEY,
  mem_id TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  context TEXT NOT NULL,
  mem_timestamp REAL NOT NULL,
  importance REAL NOT NULL DEFAULT 0.5,
  emotional_valence REAL NOT NULL DEFAULT 0,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed REAL NOT NULL,
  associations JSONB NOT NULL DEFAULT '[]',
  decay_rate REAL NOT NULL DEFAULT 0.01,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS consciousness_semantic_graph (
  id SERIAL PRIMARY KEY,
  node_id TEXT NOT NULL UNIQUE,
  concept TEXT NOT NULL,
  definition TEXT NOT NULL,
  connections JSONB NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT 'general',
  confidence REAL NOT NULL DEFAULT 0.7,
  learned_at REAL NOT NULL,
  reinforced_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS consciousness_procedural_memory (
  id SERIAL PRIMARY KEY,
  skill_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  trigger_conditions JSONB NOT NULL DEFAULT '[]',
  success_rate REAL NOT NULL DEFAULT 1.0,
  execution_count INTEGER NOT NULL DEFAULT 0,
  last_executed REAL NOT NULL DEFAULT 0,
  refinements JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);
