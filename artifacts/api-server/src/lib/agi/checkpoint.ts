/**
 * Durable checkpoints for the agent bus and working memory (REA-01).
 *
 * Idea: LangGraph checkpointers (MIT) — snapshot agent state after each step
 * so a restarted process resumes where it left off. Implemented from scratch.
 *
 * Storage goes through a tiny CheckpointStore interface. The default DB store
 * reuses the existing `system_state` key/value table, so no schema change.
 */
import { exportBusState, importBusState, type BusState } from "./agent-bus.js";
import {
  exportWorkingMemoryState,
  importWorkingMemoryState,
  type WorkingMemoryState,
} from "./working-memory.js";

export interface AgiCheckpoint {
  version: 1;
  savedAt: number;
  bus: BusState;
  workingMemory: WorkingMemoryState;
}

export interface CheckpointStore {
  save(key: string, value: AgiCheckpoint): Promise<void>;
  load(key: string): Promise<AgiCheckpoint | null>;
}

export const CHECKPOINT_KEY = "agi-checkpoint:v1";

export function createInMemoryCheckpointStore(): CheckpointStore {
  const m = new Map<string, string>();
  return {
    async save(k, v) { m.set(k, JSON.stringify(v)); },
    async load(k) { const s = m.get(k); return s ? (JSON.parse(s) as AgiCheckpoint) : null; },
  };
}

/** Postgres store on `system_state` (upsert by unique key). Lazily imports the DB. */
export function createSystemStateCheckpointStore(): CheckpointStore {
  return {
    async save(key, value) {
      const { db } = await import("@workspace/db");
      const { systemStateTable } = await import("@workspace/db/schema");
      await db
        .insert(systemStateTable)
        .values({ key, value, description: "AGI bus + working-memory checkpoint" })
        .onConflictDoUpdate({ target: systemStateTable.key, set: { value, lastSavedAt: new Date() } });
    },
    async load(key) {
      const { db } = await import("@workspace/db");
      const { systemStateTable } = await import("@workspace/db/schema");
      const { eq } = await import("drizzle-orm");
      const rows = await db.select().from(systemStateTable).where(eq(systemStateTable.key, key)).limit(1);
      return (rows[0]?.value as AgiCheckpoint | undefined) ?? null;
    },
  };
}

export function captureCheckpoint(now = Date.now()): AgiCheckpoint {
  return { version: 1, savedAt: now, bus: exportBusState(), workingMemory: exportWorkingMemoryState() };
}

export async function saveCheckpoint(store: CheckpointStore, key = CHECKPOINT_KEY): Promise<AgiCheckpoint> {
  const cp = captureCheckpoint();
  await store.save(key, cp);
  return cp;
}

export async function resumeFromCheckpoint(store: CheckpointStore, key = CHECKPOINT_KEY): Promise<boolean> {
  const cp = await store.load(key);
  if (!cp || cp.version !== 1) return false;
  importBusState(cp.bus);
  return importWorkingMemoryState(cp.workingMemory);
}

/** Periodic saver; failures are swallowed so a DB outage never crashes the loop. */
export function startCheckpointLoop(store: CheckpointStore, intervalMs = 60_000): () => void {
  const t = setInterval(() => { void saveCheckpoint(store).catch(() => undefined); }, intervalMs);
  t.unref?.();
  return () => clearInterval(t);
}
