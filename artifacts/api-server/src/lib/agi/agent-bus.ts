/**
 * Agent Message Bus with Attention.
 *
 * In-process pub/sub. Each message gets a novelty score (1 - max token
 * Jaccard similarity to recent messages on the same topic). Subscribers
 * pull by (priority * novelty), so redundant chatter never crowds out
 * genuinely new signals.
 */

import { recordObservation } from "./working-memory.js";

export interface AgentMessage {
  id: string;
  at: number;
  from: string;
  topic: string;
  priority: number; // 1..100
  novelty: number;  // 0..1
  payload: unknown;
  attention: number; // priority * novelty
}

const messages: AgentMessage[] = [];
const BUS_CAP = 500;

function tokens(s: string): Set<string> {
  return new Set(s.toLowerCase().split(/\W+/).filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size && !b.size) return 1;
  const inter = [...a].filter((t) => b.has(t)).length;
  const uni = new Set([...a, ...b]).size;
  return uni > 0 ? inter / uni : 0;
}

export function publish(from: string, topic: string, payload: unknown, priority = 50): AgentMessage {
  const payloadStr = JSON.stringify(payload).slice(0, 500);
  const pTokens = tokens(payloadStr);
  const recent = messages.filter((m) => m.topic === topic).slice(-10);
  let maxSim = 0;
  for (const r of recent) {
    const rTokens = tokens(JSON.stringify(r.payload).slice(0, 500));
    const sim = jaccard(pTokens, rTokens);
    if (sim > maxSim) maxSim = sim;
  }
  const novelty = Math.max(0.05, Math.min(1, 1 - maxSim));
  const boundedPriority = Math.max(1, Math.min(100, priority));
  const msg: AgentMessage = {
    id: `msg-${Date.now().toString(36)}-${messages.length}`,
    at: Date.now(),
    from,
    topic,
    priority: boundedPriority,
    novelty,
    payload,
    attention: Math.round(boundedPriority * novelty * 100) / 100,
  };
  messages.push(msg);
  if (messages.length > BUS_CAP) messages.splice(0, messages.length - BUS_CAP);

  // Every published message becomes a working-memory observation. This
  // unifies inter-agent chatter with the agent's own perception stream.
  recordObservation(from, topic, payload);
  return msg;
}

export function pullTopK(k = 20, topic?: string, sinceMs?: number): AgentMessage[] {
  const cutoff = sinceMs ? Date.now() - sinceMs : 0;
  return messages
    .filter((m) => (!topic || m.topic === topic) && m.at >= cutoff)
    .sort((a, b) => b.attention - a.attention)
    .slice(0, k);
}

export function pullRecent(limit = 50, topic?: string): AgentMessage[] {
  const arr = topic ? messages.filter((m) => m.topic === topic) : messages;
  return arr.slice(-limit).reverse();
}

export function busStats() {
  const byTopic: Record<string, number> = {};
  let avgNovelty = 0;
  let avgAttention = 0;
  for (const m of messages) {
    byTopic[m.topic] = (byTopic[m.topic] || 0) + 1;
    avgNovelty += m.novelty;
    avgAttention += m.attention;
  }
  const n = messages.length || 1;
  return {
    total: messages.length,
    capacity: BUS_CAP,
    byTopic,
    avgNovelty: Math.round((avgNovelty / n) * 1000) / 1000,
    avgAttention: Math.round((avgAttention / n) * 100) / 100,
    topTopics: Object.entries(byTopic).sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
}

// ---------- global-workspace broadcast (REA-06) ----------
// Idea: Global Workspace Theory agents (giansha/Global-Workspace-Agents, MIT;
// wyg5208/nct, MIT). Each tick, candidates compete on attention; the single
// winner is broadcast to every subscriber ("conscious access"). Recent winners
// are inhibited so one topic cannot monopolise the workspace. From scratch.
export type WorkspaceListener = (winner: AgentMessage) => void;
const workspaceListeners = new Set<WorkspaceListener>();
const recentWinners: string[] = [];
const WINNER_MEMORY = 5;

export function subscribeWorkspace(fn: WorkspaceListener): () => void {
  workspaceListeners.add(fn);
  return () => { workspaceListeners.delete(fn); };
}

/** Picks the highest-salience message (topic-inhibited) and broadcasts it. */
export function broadcastWinner(windowMs = 60_000, inhibition = 0.5): AgentMessage | null {
  const candidates = pullTopK(50, undefined, windowMs).filter((m) => !recentWinners.includes(m.id));
  if (!candidates.length) return null;
  const recentTopics = recentWinners
    .map((id) => messages.find((m) => m.id === id)?.topic)
    .filter((t): t is string => Boolean(t));
  const salience = (m: AgentMessage) => m.attention * (recentTopics.includes(m.topic) ? inhibition : 1);
  const winner = candidates.reduce((best, m) => (salience(m) > salience(best) ? m : best));
  recentWinners.push(winner.id);
  if (recentWinners.length > WINNER_MEMORY) recentWinners.shift();
  for (const fn of workspaceListeners) {
    try { fn(winner); } catch { /* a bad listener must not stop the broadcast */ }
  }
  return winner;
}
