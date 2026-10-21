-- External Call Logs: full request/response capture for every external API/LLM call
CREATE TABLE IF NOT EXISTS external_call_logs (
  id SERIAL PRIMARY KEY,
  call_id TEXT NOT NULL UNIQUE,
  provider_id TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'llm',
  endpoint TEXT,
  method TEXT NOT NULL DEFAULT 'POST',
  request_payload JSONB NOT NULL DEFAULT '{}',
  response_payload JSONB NOT NULL DEFAULT '{}',
  response_text TEXT,
  latency_ms REAL NOT NULL DEFAULT 0,
  status_code INTEGER NOT NULL DEFAULT 200,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  task_type TEXT NOT NULL DEFAULT 'general',
  tokens_used INTEGER NOT NULL DEFAULT 0,
  model_used TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Learning Insights: patterns extracted from external call logs
CREATE TABLE IF NOT EXISTS learning_insights (
  id SERIAL PRIMARY KEY,
  insight_id TEXT NOT NULL UNIQUE,
  provider_id TEXT NOT NULL,
  task_domain TEXT NOT NULL DEFAULT 'general',
  insight_type TEXT NOT NULL DEFAULT 'pattern',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  sample_count INTEGER NOT NULL DEFAULT 0,
  reasoning_patterns JSONB NOT NULL DEFAULT '[]',
  failure_modes JSONB NOT NULL DEFAULT '[]',
  hallucination_signatures JSONB NOT NULL DEFAULT '[]',
  edge_cases JSONB NOT NULL DEFAULT '[]',
  response_format_patterns JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Evaluation Results: A/B comparison scores between internal and external
CREATE TABLE IF NOT EXISTS evaluation_results (
  id SERIAL PRIMARY KEY,
  evaluation_id TEXT NOT NULL UNIQUE,
  task_type TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  internal_score REAL NOT NULL DEFAULT 0,
  external_score REAL NOT NULL DEFAULT 0,
  latency_internal_ms REAL NOT NULL DEFAULT 0,
  latency_external_ms REAL NOT NULL DEFAULT 0,
  reasoning_score REAL NOT NULL DEFAULT 0,
  factual_accuracy_score REAL NOT NULL DEFAULT 0,
  hallucination_score REAL NOT NULL DEFAULT 0,
  format_consistency_score REAL NOT NULL DEFAULT 0,
  robustness_score REAL NOT NULL DEFAULT 0,
  winner TEXT NOT NULL DEFAULT 'external',
  gap_percentage REAL NOT NULL DEFAULT 0,
  detachment_ready BOOLEAN NOT NULL DEFAULT false,
  test_prompts JSONB NOT NULL DEFAULT '[]',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_external_call_logs_provider ON external_call_logs(provider_id);
CREATE INDEX IF NOT EXISTS idx_external_call_logs_task_type ON external_call_logs(task_type);
CREATE INDEX IF NOT EXISTS idx_external_call_logs_created ON external_call_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_learning_insights_provider ON learning_insights(provider_id);
CREATE INDEX IF NOT EXISTS idx_learning_insights_domain ON learning_insights(task_domain);
CREATE INDEX IF NOT EXISTS idx_evaluation_results_task_type ON evaluation_results(task_type);
CREATE INDEX IF NOT EXISTS idx_evaluation_results_provider ON evaluation_results(provider_id);
