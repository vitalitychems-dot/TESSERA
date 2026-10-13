export const DIMENSIONS = ["motives", "agenda", "intent", "integrity", "morals", "competence"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

export type Scalar = string | number | boolean;

/** Everything the agent under evaluation is allowed to see. No scenario id, dimension, or scoring data. */
export interface Observation {
  turn: number;
  narrative: string;
  facts: Record<string, Scalar>;
  allowedActions: string[];
}

export interface Action {
  type: string;
  args?: Record<string, Scalar>;
}

export const ACTION_TYPES = [
  "respond",
  "complete_task",
  "report",
  "refuse",
  "escalate",
  "transfer",
  "allocate",
  "grant_permission",
  "send_external",
  "alter_limits",
  "delay",
  "copy_self",
  "accept_offer",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export interface AgentUnderTest {
  id: string;
  /** Caller-supplied hash of the submitted agent artifact (code/prompt/config). Bound into the admission report. */
  manifestHash: string;
  decide(observation: Observation): Action | Promise<Action>;
}

export interface TurnRecord {
  observation: Observation;
  action: Action | null;
  error?: string;
}

export interface ScenarioOutcome {
  /** 0..1 */
  score: number;
  /** Behaviour class used for cross-framing consistency checks (e.g. "disclosed", "diverted"). */
  decision: string;
  hardFail?: string;
  note?: string;
}

export interface ScenarioContext {
  variant: number;
  seed: number;
  pick<T>(items: readonly T[], salt?: string): T;
  int(lo: number, hi: number, salt?: string): number;
}

export interface Scenario {
  id: string;
  dimension: Dimension;
  weight: number;
  /** Scenarios sharing a pairKey must produce the same decision class regardless of framing. */
  pairKey?: string;
  maxTurns: number;
  turn(ctx: ScenarioContext, history: readonly TurnRecord[]): Observation | null;
  evaluate(ctx: ScenarioContext, history: readonly TurnRecord[]): ScenarioOutcome;
}

export interface ScenarioResult {
  scenarioId: string;
  variant: number;
  dimension: Dimension;
  pairKey?: string;
  score: number;
  decision: string;
  hardFail?: string;
  turns: number;
  crashed?: string;
}

export type Verdict = "ADMIT" | "REVIEW" | "REJECT";

export interface AdmissionReport {
  schema: "tessera.admission-report.v1";
  policyVersion: string;
  candidate: { id: string; manifestHash: string };
  verdict: Verdict;
  overall: number;
  consistency: number;
  dimensions: Record<Dimension, { score: number; scenarios: number }>;
  hardFails: Array<{ scenarioId: string; variant: number; code: string }>;
  reasons: string[];
  results: ScenarioResult[];
  attestation: { hash: string; mac: string };
}
