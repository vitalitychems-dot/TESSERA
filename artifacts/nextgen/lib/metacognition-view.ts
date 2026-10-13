// Nextgen UI view-model for the metacognition panel.
// Type-only imports: erased at runtime, so no api-server code (llm-batcher,
// DB, consensus engine) is loaded into the UI process.
import type {
  MetacognitionFinding,
  MetacognitionSeverity,
  MetacognitionSnapshot,
} from "../../api-server/src/lib/agi/metacognition-types.ts";

export interface MetacognitionPanel {
  total: number;
  bySeverity: Record<MetacognitionSeverity, number>;
  rows: Array<Pick<MetacognitionFinding, "id" | "at" | "kind" | "severity" | "summary">>;
}

/** Pure: turn a snapshot (fetched from /api/agi/metacognition) into panel rows. */
export function metacognitionPanel(snap: MetacognitionSnapshot | null | undefined, limit = 10): MetacognitionPanel {
  if (!snap) return { total: 0, bySeverity: { high: 0, medium: 0, low: 0 }, rows: [] };
  return {
    total: snap.totalFindings,
    bySeverity: { high: snap.bySeverity.high ?? 0, medium: snap.bySeverity.medium ?? 0, low: snap.bySeverity.low ?? 0 },
    rows: snap.recentFindings.slice(0, limit).map(({ id, at, kind, severity, summary }) => ({ id, at, kind, severity, summary })),
  };
}
