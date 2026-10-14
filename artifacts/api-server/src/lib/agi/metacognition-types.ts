/**
 * Metacognition public types — dependency-free.
 *
 * This module has NO runtime imports so UI code (e.g. artifacts/nextgen) can
 * `import type` from it without pulling in llm-batcher, the DB, the consensus
 * engine or any other server runtime. metacognition.ts re-exports these.
 */

export type MetacognitionFindingKind = "stall" | "drift" | "contradiction" | "hysteresis" | "healthy";
export type MetacognitionSeverity = "low" | "medium" | "high";

export interface MetacognitionFinding {
  id: string;
  at: number;
  kind: MetacognitionFindingKind;
  severity: MetacognitionSeverity;
  summary: string;
  evidence: Record<string, unknown>;
  recommendedAction?: string;
}

/** Shape returned by metacognitionSnapshot() / GET /api/agi/metacognition. */
export interface MetacognitionSnapshot {
  totalFindings: number;
  recentFindings: MetacognitionFinding[];
  bySeverity: Record<MetacognitionSeverity, number>;
  causalModel: unknown;
}
