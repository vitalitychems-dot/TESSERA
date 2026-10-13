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

export function subscribeWorkspace(fn: WorkspaceListener): () => void {
  workspaceListeners.add(fn);
  return () => { workspaceListeners.delete(fn); };
}

/** Picks the highest-salience message (topic-inhibited) and broadcasts it. */
export function broadcastWinner(windowMs = 60_000, inhibition = 0.5): AgentMessage | null {
  const seen = new Set(recentWinners.map((w) => w.id));
  const candidates = pullTopK(50, undefined, windowMs).filter((m) => !seen.has(m.id));
  if (!candidates.length) return null;
  const recentTopics = new Set(recentWinners.map((w) => w.topic));
  const salience = (m: AgentMessage) => m.attention * (recentTopics.has(m.topic) ? inhibition : 1);
  const winner = candidates.reduce((best, m) => (salience(m) > salience(best) ? m : best));
  recentWinners.push({ id: winner.id, topic: winner.topic });
  if (recentWinners.length > WINNER_MEMORY) recentWinners.shift();
  for (const fn of workspaceListeners) {
    try { fn(winner); } catch { /* a bad listener must not stop the broadcast */ }
  }
  return winner;
}
