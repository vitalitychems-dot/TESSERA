-- Migration: Add agent_id and agent_name to messages table
-- These columns allow tracking which agent authored a message in multi-agent conferences.

ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_id TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS agent_name TEXT;
