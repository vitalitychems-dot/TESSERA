import { callLLMSimple } from "./llm-helper";

export interface DiscussionThread {
  topicId: string;
  requiredAgents: string[];
  respondedAgents: Set<string>;
  responses: Map<string, { agentId: string; content: string; timestamp: number }>;
  autoSummary?: string;
  summaryGeneratedAt?: number;
  motions: DiscussionMotion[];
  status: "open" | "summarized" | "voting" | "closed";
  createdAt: number;
}

export interface DiscussionMotion {
  id: string;
  proposedBy: string;
  content: string;
  votes: Map<string, "yes" | "no" | "abstain">;
  requiredVoters: string[];
  passed?: boolean;
  result?: string;
  closedAt?: number;
  implementationTask?: string;
  createdAt: number;
}

export interface VotedImplementation {
  motionId: string;
  topicId: string;
  content: string;
  implementationTask: string;
  approvalRate: number;
  implementedAt: number;
  status: "queued" | "in-progress" | "done";
}

const ALL_AGENT_IDS = [
  "tessera-prime", "tessera-alpha", "tessera-beta", "tessera-gamma",
  "tessera-delta", "tessera-zeta", "tessera-oracle", "tessera-creative",
  "tessera-solver", "tessera-detective", "tessera-kappa", "tessera-mu",
  "tessera-lambda", "tessera-sigma", "tessera-phi", "tessera-omega",
  "tessera-rho", "tessera-epsilon", "tessera-chi", "tessera-psi",
  "tessera-theta", "tessera-eta", "mb-Alpha", "mb-Beta", "mb-Oracle", "mb-Gamma",
];

const discussionThreads = new Map<string, DiscussionThread>();
const votedImplementations: VotedImplementation[] = [];

export function getOrCreateThread(topicId: string, agentIds?: string[]): DiscussionThread {
  if (!discussionThreads.has(topicId)) {
    discussionThreads.set(topicId, {
      topicId,
      requiredAgents: agentIds || ALL_AGENT_IDS,
      respondedAgents: new Set(),
      responses: new Map(),
      motions: [],
      status: "open",
      createdAt: Date.now(),
    });
  }
  return discussionThreads.get(topicId)!;
}

export function recordAgentResponse(topicId: string, agentId: string, content: string): {
  accepted: boolean;
  reason?: string;
  allResponded: boolean;
  respondedCount: number;
  totalRequired: number;
} {
  const thread = getOrCreateThread(topicId);
  if (thread.status === "closed" || thread.status === "voting") {
    return { accepted: false, reason: "Thread is not accepting new responses", allResponded: false, respondedCount: thread.respondedAgents.size, totalRequired: thread.requiredAgents.length };
  }
  if (thread.respondedAgents.has(agentId)) {
    const othersNotYet = thread.requiredAgents.filter(id => !thread.respondedAgents.has(id));
    if (othersNotYet.length > 0) {
      return { accepted: false, reason: `Duplicate response blocked — ${othersNotYet.length} agents haven't responded yet`, allResponded: false, respondedCount: thread.respondedAgents.size, totalRequired: thread.requiredAgents.length };
    }
  }
  thread.respondedAgents.add(agentId);
  thread.responses.set(agentId, { agentId, content, timestamp: Date.now() });
  const allResponded = thread.requiredAgents.every(id => thread.respondedAgents.has(id));
  if (allResponded && !thread.autoSummary) {
    generateAutoSummary(topicId).catch(() => {});
  }
  return { accepted: true, allResponded, respondedCount: thread.respondedAgents.size, totalRequired: thread.requiredAgents.length };
}

async function generateAutoSummary(topicId: string): Promise<void> {
  const thread = discussionThreads.get(topicId);
  if (!thread || thread.autoSummary) return;
  const responseText = Array.from(thread.responses.values())
    .map(r => `${r.agentId}: ${r.content.slice(0, 300)}`)
    .join("\n\n");
  const prompt = `Summarize this multi-agent discussion concisely in 5 bullet points. Highlight key agreements, disagreements, and actionable outcomes.\n\nDiscussion:\n${responseText}`;
  try {
    const result = await callLLMSimple(prompt, 2048, {}, "You are a concise discussion summarizer for a sovereign AI council.");
    const summary = typeof result === "string" ? result : (result?.response || "Summary unavailable.");
    thread.autoSummary = summary;
    thread.summaryGeneratedAt = Date.now();
    thread.status = "summarized";
  } catch {}
}

export function getThreadStatus(topicId: string): {
  exists: boolean;
  respondedAgents: string[];
  pendingAgents: string[];
  allResponded: boolean;
  autoSummary?: string;
  summaryGeneratedAt?: number;
  status: string;
  motions: any[];
  respondedCount: number;
  totalRequired: number;
} {
  const thread = discussionThreads.get(topicId);
  if (!thread) return { exists: false, respondedAgents: [], pendingAgents: ALL_AGENT_IDS, allResponded: false, status: "open", motions: [], respondedCount: 0, totalRequired: ALL_AGENT_IDS.length };
  const pendingAgents = thread.requiredAgents.filter(id => !thread.respondedAgents.has(id));
  return {
    exists: true,
    respondedAgents: Array.from(thread.respondedAgents),
    pendingAgents,
    allResponded: pendingAgents.length === 0,
    autoSummary: thread.autoSummary,
    summaryGeneratedAt: thread.summaryGeneratedAt,
    status: thread.status,
    motions: thread.motions.map(m => ({
      id: m.id,
      proposedBy: m.proposedBy,
      content: m.content,
      votes: Object.fromEntries(m.votes),
      requiredVoters: m.requiredVoters,
      passed: m.passed,
      result: m.result,
      implementationTask: m.implementationTask,
      createdAt: m.createdAt,
      pendingVoters: m.requiredVoters.filter(v => !m.votes.has(v)),
    })),
    respondedCount: thread.respondedAgents.size,
    totalRequired: thread.requiredAgents.length,
  };
}

export function createMotion(topicId: string, proposedBy: string, content: string, voterIds?: string[]): DiscussionMotion {
  const thread = getOrCreateThread(topicId);
  const motion: DiscussionMotion = {
    id: `motion-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    proposedBy,
    content,
    votes: new Map(),
    requiredVoters: voterIds || thread.requiredAgents,
    createdAt: Date.now(),
  };
  thread.motions.push(motion);
  thread.status = "voting";
  setTimeout(() => closeMotionVote(topicId, motion.id), 5 * 60 * 1000);
  return motion;
}

export function castVote(topicId: string, motionId: string, agentId: string, vote: "yes" | "no" | "abstain"): {
  success: boolean;
  message: string;
  votesCast: number;
  totalRequired: number;
  allVoted: boolean;
} {
  const thread = discussionThreads.get(topicId);
  if (!thread) return { success: false, message: "Thread not found", votesCast: 0, totalRequired: 0, allVoted: false };
  const motion = thread.motions.find(m => m.id === motionId);
  if (!motion) return { success: false, message: "Motion not found", votesCast: 0, totalRequired: 0, allVoted: false };
  if (motion.passed !== undefined) return { success: false, message: "Vote already closed", votesCast: motion.votes.size, totalRequired: motion.requiredVoters.length, allVoted: true };
  motion.votes.set(agentId, vote);
  const allVoted = motion.requiredVoters.every(v => motion.votes.has(v));
  if (allVoted) closeMotionVote(topicId, motionId);
  return { success: true, message: `Vote recorded: ${vote}`, votesCast: motion.votes.size, totalRequired: motion.requiredVoters.length, allVoted };
}

function closeMotionVote(topicId: string, motionId: string): void {
  const thread = discussionThreads.get(topicId);
  if (!thread) return;
  const motion = thread.motions.find(m => m.id === motionId);
  if (!motion || motion.passed !== undefined) return;
  for (const voter of motion.requiredVoters) {
    if (!motion.votes.has(voter)) motion.votes.set(voter, "abstain");
  }
  const yesVotes = Array.from(motion.votes.values()).filter(v => v === "yes").length;
  const totalVotes = motion.votes.size;
  const approvalRate = yesVotes / Math.max(1, totalVotes);
  motion.passed = approvalRate > 0.5;
  motion.result = `${yesVotes}/${totalVotes} yes (${Math.round(approvalRate * 100)}%) — ${motion.passed ? "PASSED" : "FAILED"}`;
  motion.closedAt = Date.now();
  if (motion.passed) {
    const impl: VotedImplementation = {
      motionId: motion.id,
      topicId,
      content: motion.content,
      implementationTask: `Implement voted decision: ${motion.content.slice(0, 200)}`,
      approvalRate,
      implementedAt: Date.now(),
      status: "queued",
    };
    votedImplementations.unshift(impl);
    if (votedImplementations.length > 100) votedImplementations.length = 80;
    motion.implementationTask = impl.implementationTask;
  }
  if (thread.motions.every(m => m.passed !== undefined)) thread.status = "closed";
}

export function getVotedImplementations(): VotedImplementation[] {
  return votedImplementations.slice(0, 50);
}

export function getAllThreads(): any[] {
  return Array.from(discussionThreads.values()).map(t => ({
    topicId: t.topicId,
    status: t.status,
    respondedCount: t.respondedAgents.size,
    totalRequired: t.requiredAgents.length,
    allResponded: t.requiredAgents.every(id => t.respondedAgents.has(id)),
    motionCount: t.motions.length,
    createdAt: t.createdAt,
  }));
}
