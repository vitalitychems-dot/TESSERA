export const CYCLE_STAGES = [
  { id: "observation", title: "Plain-text observation" },
  { id: "lesson", title: "Lesson" },
  { id: "pulse", title: "Pulse" },
  { id: "world_tick", title: "World tick" },
  { id: "proposed_upgrade", title: "Proposed upgrade" },
] as const;

export type CycleStageId = (typeof CYCLE_STAGES)[number]["id"];
export type CycleEvent = {
  stage: CycleStageId;
  recordedAt: string;
  evidence: string;
};
export type CycleJournal = {
  version: 1;
  events: CycleEvent[];
};

export function appendCycleEvent(
  events: CycleEvent[],
  stage: CycleStageId,
  evidence: string,
  recordedAt = new Date().toISOString(),
): CycleEvent[] {
  const expected = CYCLE_STAGES[events.length];
  if (!expected) throw new Error("All cycle stages are already recorded.");
  if (expected.id !== stage) throw new Error("Cycle stages must be recorded in order.");
  const text = evidence.trim();
  if (!text) throw new Error("Evidence is required before recording a stage.");
  if (text.length > 12_000) throw new Error("Stage evidence must be 12,000 characters or fewer.");
  if (!Number.isFinite(Date.parse(recordedAt))) throw new Error("A valid timestamp is required.");
  return [...events, { stage, recordedAt, evidence: text }];
}

export function isCycleJournal(value: unknown): value is CycleJournal {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CycleJournal>;
  if (candidate.version !== 1 || !Array.isArray(candidate.events) || candidate.events.length > CYCLE_STAGES.length) return false;
  return candidate.events.every((event, index) => {
    if (!event || typeof event !== "object") return false;
    const row = event as CycleEvent;
    return row.stage === CYCLE_STAGES[index]?.id
      && typeof row.evidence === "string"
      && row.evidence.trim().length > 0
      && row.evidence.length <= 12_000
      && typeof row.recordedAt === "string"
      && Number.isFinite(Date.parse(row.recordedAt));
  });
}
