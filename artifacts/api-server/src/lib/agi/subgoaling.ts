/**
 * Soar-style impasse -> subgoal -> chunking (REA-10).
 *
 * Idea: Soar cognitive architecture (SoarGroup/Soar, BSD-style). When the
 * planner cannot make progress on a goal (an "impasse"), create a subgoal to
 * resolve it; when the subgoal succeeds, cache ("chunk") the resolution as a
 * rule keyed by the impasse signature so the same impasse is resolved
 * immediately next time. Implemented from scratch on top of goal-planner.
 */
import { setGoal, updateGoal } from "./working-memory.js";
import { publish } from "./agent-bus.js";

export interface Impasse { goalId: string; signature: string; stalledTicks: number }
export interface Chunk { signature: string; resolution: string; uses: number; learnedAt: number }

export class SubgoalEngine {
  private lastProgress = new Map<string, { p: number; stalled: number }>();
  private chunks = new Map<string, Chunk>();
  private open = new Map<string, Impasse>(); // subgoalId -> impasse

  constructor(private readonly stallTicks = 3) {}

  /**
   * Feed one evaluation tick: goalId -> { progress, signature }.
   * Returns impasses resolved by an existing chunk and new subgoals created.
   */
  tick(evals: Record<string, { progress: number; done: boolean; signature: string }>): { applied: Array<{ goalId: string; resolution: string }>; subgoals: string[] } {
    const applied: Array<{ goalId: string; resolution: string }> = [];
    const subgoals: string[] = [];
    for (const [goalId, e] of Object.entries(evals)) {
      if (e.done) { this.lastProgress.delete(goalId); continue; }
      const prev = this.lastProgress.get(goalId);
      const stalled = prev && e.progress <= prev.p ? prev.stalled + 1 : 0;
      this.lastProgress.set(goalId, { p: e.progress, stalled });
      if (stalled < this.stallTicks) continue;
      this.lastProgress.set(goalId, { p: e.progress, stalled: 0 });
      const chunk = this.chunks.get(e.signature);
      if (chunk) {
        chunk.uses++;
        applied.push({ goalId, resolution: chunk.resolution });
        publish("subgoaling", "chunk-applied", { goalId, signature: e.signature, resolution: chunk.resolution }, 70);
        continue;
      }
      if ([...this.open.values()].some((i) => i.goalId === goalId)) continue;
      const subId = `${goalId}-impasse-${this.open.size + 1}`;
      this.open.set(subId, { goalId, signature: e.signature, stalledTicks: stalled });
      setGoal({ id: subId, goal: `Resolve impasse on ${goalId} (${e.signature})`, parentId: goalId, priority: 90 });
      updateGoal(goalId, { status: "blocked" });
      publish("subgoaling", "impasse", { goalId, subgoalId: subId, signature: e.signature }, 85);
      subgoals.push(subId);
    }
    return { applied, subgoals };
  }

  /** Mark a subgoal solved; learns a chunk for its impasse signature. */
  resolve(subgoalId: string, resolution: string, now = Date.now()): Chunk | null {
    const imp = this.open.get(subgoalId);
    if (!imp) return null;
    this.open.delete(subgoalId);
    updateGoal(subgoalId, { status: "complete", progress: 1 });
    updateGoal(imp.goalId, { status: "active" });
    const c: Chunk = { signature: imp.signature, resolution, uses: 0, learnedAt: now };
    this.chunks.set(imp.signature, c);
    return c;
  }

  listChunks(): Chunk[] { return [...this.chunks.values()]; }
}
