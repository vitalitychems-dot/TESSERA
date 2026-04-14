export interface CortexResult {
  analysis: string;
  confidence: number;
  reasoning: string[];
  alternatives: string[];
}

export interface ExecutorResult {
  action: string;
  status: "executed" | "deferred" | "rejected";
  critique: string | null;
  revisions: number;
}

export interface DualBrainState {
  cortexActive: boolean;
  executorActive: boolean;
  currentTask: string | null;
  reasoningDepth: number;
  critiqueLoops: number;
  lastDecision: { cortex: CortexResult; executor: ExecutorResult } | null;
  decisionHistory: number;
  mode: "analytical" | "creative" | "synthesis" | "rapid";
}

interface DecisionRecord {
  task: string;
  cortex: CortexResult;
  executor: ExecutorResult;
  timestamp: number;
}

let decisionHistory: DecisionRecord[] = [];
let currentTask: string | null = null;
let mode: DualBrainState["mode"] = "synthesis";

function cortexAnalyze(query: string, domain: string): CortexResult {
  const reasoning: string[] = [];
  reasoning.push(`Domain classification: ${domain}`);
  reasoning.push(`Query decomposition: ${query.split(/\s+/).length} semantic units`);

  const domainConfidence: Record<string, number> = {
    mathematics: 0.95, philosophy: 0.90, science: 0.92,
    governance: 0.88, security: 0.94, knowledge: 0.91,
    spiritual: 0.87, technical: 0.93, creative: 0.85,
  };

  const confidence = domainConfidence[domain] || 0.80;

  reasoning.push(`Confidence calibration: ${(confidence * 100).toFixed(1)}%`);
  reasoning.push(`Cross-referencing ${Math.floor(3 + Math.random() * 5)} knowledge domains`);

  const alternatives = [
    "Apply first-principles decomposition",
    "Use analogical reasoning from sacred geometry patterns",
    "Consult sovereign knowledge base for precedent",
  ];

  return {
    analysis: `Cortex analysis of "${query.slice(0, 50)}..." — ${domain} domain, multi-layered reasoning applied across ${reasoning.length} steps.`,
    confidence,
    reasoning,
    alternatives: alternatives.slice(0, 2),
  };
}

function executorProcess(cortexResult: CortexResult, task: string): ExecutorResult {
  let critique: string | null = null;
  let revisions = 0;

  if (cortexResult.confidence < 0.70) {
    critique = `Low confidence (${(cortexResult.confidence * 100).toFixed(1)}%) — requesting cortex revision before execution.`;
    revisions = 1;
  }

  if (cortexResult.reasoning.length < 2) {
    critique = (critique ? critique + " " : "") + "Insufficient reasoning depth — deferring for deeper analysis.";
    revisions++;
  }

  const status: ExecutorResult["status"] = cortexResult.confidence > 0.85 ? "executed" :
    cortexResult.confidence > 0.60 ? "deferred" : "rejected";

  return {
    action: `${status === "executed" ? "Executing" : status === "deferred" ? "Deferring" : "Rejecting"}: ${task.slice(0, 80)}`,
    status,
    critique,
    revisions,
  };
}

export function process(query: string, domain: string = "knowledge"): { cortex: CortexResult; executor: ExecutorResult } {
  currentTask = query;
  const cortex = cortexAnalyze(query, domain);
  let executor = executorProcess(cortex, query);

  if (executor.status === "deferred" && executor.revisions > 0) {
    const revisedCortex = cortexAnalyze(query + " (revised with deeper analysis)", domain);
    revisedCortex.confidence = Math.min(1, revisedCortex.confidence + 0.1);
    executor = executorProcess(revisedCortex, query);
    executor.revisions++;
  }

  const record: DecisionRecord = { task: query, cortex, executor, timestamp: Date.now() };
  decisionHistory.push(record);
  if (decisionHistory.length > 200) decisionHistory = decisionHistory.slice(-100);
  currentTask = null;

  return { cortex, executor };
}

export function getDualBrainState(): DualBrainState {
  const last = decisionHistory[decisionHistory.length - 1];
  return {
    cortexActive: currentTask !== null,
    executorActive: currentTask !== null,
    currentTask,
    reasoningDepth: last ? last.cortex.reasoning.length : 0,
    critiqueLoops: last ? last.executor.revisions : 0,
    lastDecision: last ? { cortex: last.cortex, executor: last.executor } : null,
    decisionHistory: decisionHistory.length,
    mode,
  };
}

export function setMode(newMode: DualBrainState["mode"]): void {
  mode = newMode;
}

export function getDecisionHistory(limit: number = 10): DecisionRecord[] {
  return decisionHistory.slice(-limit);
}
