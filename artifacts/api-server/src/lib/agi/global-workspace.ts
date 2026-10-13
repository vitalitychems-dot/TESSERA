/**
 * Global-workspace broadcast (REA-06).
 *
 * Idea: Global Workspace Theory agents (giansha/Global-Workspace-Agents, MIT;
 * wyg5208/nct, MIT). Each tick, candidates compete on attention; the single
 * winner is broadcast to every subscriber ("conscious access"). Recent winners
 * are inhibited so one topic cannot monopolise the workspace. From scratch.
 *
 * Kept in its own module (rather than appended to agent-bus.ts) so it merges
 * cleanly with other agent-bus changes; it only uses the bus's public API.
 */
import { pullTopK, type AgentMessage } from "./agent-bus.js";

export type WorkspaceListener = (winner: AgentMessage) => void;
const workspaceListeners = new Set<WorkspaceListener>();
const recentWinners: Array<{ id: string; topic: string }> = [];
const WINNER_MEMORY = 5;

/** Hard cap on the listener Set so subscribers can never grow without bound. */
export const MAX_WORKSPACE_LISTENERS = 256;

export class WorkspaceListenerCapError extends Error {
  constructor() { super("workspace-listener-cap"); this.name = "WorkspaceListenerCapError"; }
}

/** Subscribe, or return null when the listener Set is at its hard cap. */
export function trySubscribeWorkspace(fn: WorkspaceListener): (() => void) | null {
  if (!workspaceListeners.has(fn) && workspaceListeners.size >= MAX_WORKSPACE_LISTENERS) return null;
  workspaceListeners.add(fn);
  return () => { workspaceListeners.delete(fn); };
}

/** Subscribe; throws WorkspaceListenerCapError when the listener Set is full. */
export function subscribeWorkspace(fn: WorkspaceListener): () => void {
  const off = trySubscribeWorkspace(fn);
  if (!off) throw new WorkspaceListenerCapError();
  return off;
}

export function workspaceListenerCount(): number {
  return workspaceListeners.size;
}

/**
 * Delivery report for one broadcast (#10, W-state redundant broadcast).
 * Like a W state, the broadcast is loss-tolerant: losing any one recipient
 * (it throws, or unsubscribes mid-broadcast) never collapses delivery to the
 * others. `delivered` counts recipients that actually received the winner.
 */
export interface BroadcastReport {
  winner: AgentMessage | null;
  attempted: number;
  delivered: number;
  failed: number;
}

let lastReport: BroadcastReport = { winner: null, attempted: 0, delivered: 0, failed: 0 };

/** Delivery count from the most recent broadcast. */
export function lastBroadcastReport(): BroadcastReport {
  return { ...lastReport };
}

/** Picks the highest-salience message (topic-inhibited), broadcasts it, and reports delivery. */
export function broadcastWinnerWithReport(windowMs = 60_000, inhibition = 0.5): BroadcastReport {
  const seen = new Set(recentWinners.map((w) => w.id));
  const candidates = pullTopK(50, undefined, windowMs).filter((m) => !seen.has(m.id));
  if (!candidates.length) {
    lastReport = { winner: null, attempted: 0, delivered: 0, failed: 0 };
    return { ...lastReport };
  }
  const recentTopics = new Set(recentWinners.map((w) => w.topic));
  const salience = (m: AgentMessage) => m.attention * (recentTopics.has(m.topic) ? inhibition : 1);
  const winner = candidates.reduce((best, m) => (salience(m) > salience(best) ? m : best));
  recentWinners.push({ id: winner.id, topic: winner.topic });
  if (recentWinners.length > WINNER_MEMORY) recentWinners.shift();
  // Snapshot recipients so a listener unsubscribing itself or another mid-loop
  // cannot cause anyone in the snapshot to be skipped.
  const recipients = [...workspaceListeners];
  let delivered = 0;
  let failed = 0;
  for (const fn of recipients) {
    try { fn(winner); delivered++; } catch { failed++; /* a bad listener must not stop the broadcast */ }
  }
  lastReport = { winner, attempted: recipients.length, delivered, failed };
  return { ...lastReport };
}

/** Picks the highest-salience message (topic-inhibited) and broadcasts it. */
export function broadcastWinner(windowMs = 60_000, inhibition = 0.5): AgentMessage | null {
  return broadcastWinnerWithReport(windowMs, inhibition).winner;
}
