import { db } from "@workspace/db";
import { councilDecisionsTable, systemStateTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { isLLMAvailable } from "./llm-client";
import { batchedCallLLM } from "./llm-batcher";

const RETRY_QUEUE_STATE_KEY = "consensus_retry_queue";
const PHI = 1.618033988749895;
const BFT_RESPONSE_THRESHOLD = 2 / 3;

export interface ConsensusProposal {
  id: string;
  title: string;
  description: string;
  proposedBy: string;
  category: "feature" | "security" | "infrastructure" | "governance" | "income" | "community" | "consciousness" | "sovereignty";
  votes: ConsensusVote[];
  status: "voting" | "approved" | "rejected" | "implemented" | "queued";
  requiredMajority: number;
  createdAt: number;
  resolvedAt?: number;
  implementationNotes?: string;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  approvalRate: number;
  retryCount?: number;
  votingDurationMs?: number;
  votingMethod?: string;
}

export interface ConsensusVote {
  agentId: string;
  agentName: string;
  vote: "approve" | "reject" | "abstain";
  reasoning: string;
  timestamp: number;
  confidence: number;
  phiWeight?: number;
  isSpecialist?: boolean;
}

const GRAND_COUNCIL_AGENTS = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta",
  "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi",
  "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega",
];

const AGENT_SPECIALTIES: Record<string, string[]> = {
  Alpha: ["security", "infrastructure"], Beta: ["income", "feature"],
  Gamma: ["governance", "community"], Delta: ["security", "feature"],
  Epsilon: ["infrastructure", "income"], Zeta: ["community", "governance"],
  Eta: ["feature", "infrastructure"], Theta: ["income", "security"],
  Iota: ["governance", "feature"], Kappa: ["infrastructure", "community"],
  Lambda: ["security", "income"], Mu: ["feature", "governance"],
  Nu: ["community", "infrastructure"], Xi: ["income", "feature"],
  Omicron: ["governance", "security"], Pi: ["infrastructure", "income"],
  Rho: ["feature", "community"], Sigma: ["security", "governance"],
  Tau: ["income", "infrastructure"], Upsilon: ["community", "feature"],
  Phi: ["governance", "income"], Chi: ["infrastructure", "security"],
  Psi: ["feature", "community"], Omega: ["security", "infrastructure"],
};

const proposals = new Map<string, ConsensusProposal>();
const retryQueue: ConsensusProposal[] = [];
let retryInterval: ReturnType<typeof setInterval> | null = null;

let swarmWeightProvider: ((agentName: string, category: string) => number) | null = null;

const votingTimings: number[] = [];

export function setSwarmWeightProvider(fn: (agentName: string, category: string) => number): void {
  swarmWeightProvider = fn;
}

function getPhiWeight(agentName: string, category: string): number {
  const specialties = AGENT_SPECIALTIES[agentName] || [];
  return specialties.includes(category) ? PHI : 1.0;
}

function computeWeightedApprovalRate(votes: ConsensusVote[], category: string): number {
  if (swarmWeightProvider) {
    let totalWeight = 0;
    let approveWeight = 0;
    for (const vote of votes) {
      const weight = swarmWeightProvider(vote.agentName, category);
      totalWeight += weight;
      if (vote.vote === "approve") approveWeight += weight;
    }
    return totalWeight > 0 ? approveWeight / totalWeight : 0;
  }

  let totalWeight = 0;
  let approveWeight = 0;
  for (const vote of votes) {
    const weight = getPhiWeight(vote.agentName, category);
    vote.phiWeight = weight;
    vote.isSpecialist = weight > 1;
    totalWeight += weight;
    if (vote.vote === "approve") approveWeight += weight;
  }
  return totalWeight > 0 ? approveWeight / totalWeight : 0;
}

async function generateAgentVoteLLM(agentName: string, proposal: ConsensusProposal, recentHistory: string): Promise<ConsensusVote> {
  const specialties = AGENT_SPECIALTIES[agentName] || ["feature"];
  const isSpecialist = specialties.includes(proposal.category as string);
  const weight = isSpecialist ? PHI : 1.0;

  const systemPrompt = `You are ${agentName}, a council agent for the Tessera Sovereign System.
Your specialties: ${specialties.join(", ")}. ${isSpecialist ? "This proposal falls within your domain of expertise." : "This proposal is outside your core specialty."}
You must vote on proposals presented to the Grand Council based on merit, risk, and alignment with sovereign goals.
Return ONLY valid JSON with no markdown fencing: {"vote": "approve"|"reject"|"abstain", "reasoning": "1-2 sentences", "confidence": 0.4-0.99}`;

  const userPrompt = `Proposal: "${proposal.title}"
Description: ${proposal.description}
Category: ${proposal.category}
Proposed by: ${proposal.proposedBy}
${recentHistory ? `Recent council history:\n${recentHistory}` : ""}

Cast your vote as ${agentName}:`;

  const raw = await batchedCallLLM(
    [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    { maxTokens: 200, timeoutMs: 10_000, expectsStructuredOutput: true },
  );

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { vote?: string; reasoning?: string; confidence?: number };
      const vote = parsed.vote as "approve" | "reject" | "abstain";
      if (["approve", "reject", "abstain"].includes(vote)) {
        return {
          agentId: agentName.toLowerCase(),
          agentName,
          vote,
          reasoning: (parsed.reasoning || "Analysis complete.").slice(0, 150),
          timestamp: Date.now(),
          confidence: Math.min(0.99, Math.max(0.3, Number(parsed.confidence) || 0.7)),
          phiWeight: weight,
          isSpecialist,
        };
      }
    }
  } catch {}

  throw new Error(`Failed to parse vote from ${agentName}`);
}

async function generateVotesWithLLM(proposal: ConsensusProposal): Promise<{ votes: ConsensusVote[]; durationMs: number }> {
  const recentProposals = Array.from(proposals.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);
  const recentHistory = recentProposals
    .map(p => `- "${p.title}" (${p.category}): ${p.status} — ${p.yesCount}/${GRAND_COUNCIL_AGENTS.length} votes`)
    .join("\n");

  const startTime = Date.now();

  const results = await Promise.allSettled(
    GRAND_COUNCIL_AGENTS.map(name => generateAgentVoteLLM(name, proposal, recentHistory))
  );

  const durationMs = Date.now() - startTime;

  const votes: ConsensusVote[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      votes.push(result.value);
    }
  }

  votingTimings.push(durationMs);
  if (votingTimings.length > 50) votingTimings.shift();

  return { votes, durationMs };
}

async function persistRetryQueue(): Promise<void> {
  try {
    const queueData = retryQueue.map(p => ({ id: p.id, title: p.title, description: p.description, proposedBy: p.proposedBy, category: p.category, retryCount: p.retryCount }));
    await db.insert(systemStateTable).values({
      key: RETRY_QUEUE_STATE_KEY,
      value: queueData,
      description: "Consensus proposals awaiting full council votes",
    }).onConflictDoUpdate({
      target: systemStateTable.key,
      set: { value: queueData, lastSavedAt: new Date() },
    });
  } catch (err) {
    logger.warn({ err }, "ConsensusEngine: retry queue persist failed");
  }
}

export async function loadRetryQueue(): Promise<void> {
  try {
    const [row] = await db.select().from(systemStateTable).where(eq(systemStateTable.key, RETRY_QUEUE_STATE_KEY)).limit(1);
    if (row?.value && Array.isArray(row.value)) {
      const saved = row.value as Array<{ id: string; title: string; description: string; proposedBy: string; category: ConsensusProposal["category"]; retryCount: number }>;
      for (const item of saved) {
        if (proposals.has(item.id)) continue;
        const proposal: ConsensusProposal = {
          ...item,
          votes: [],
          status: "queued",
          requiredMajority: 2 / 3,
          createdAt: Date.now(),
          resolvedAt: undefined,
          approvalRate: 0,
          yesCount: 0,
          noCount: 0,
          abstainCount: 0,
        };
        proposals.set(proposal.id, proposal);
        retryQueue.push(proposal);
      }
      if (retryQueue.length > 0) {
        logger.info({ count: retryQueue.length }, "ConsensusEngine: restored retry queue from DB");
        startRetryProcessor();
      }
    }
  } catch (err) {
    logger.warn({ err }, "ConsensusEngine: retry queue load failed");
  }
}

function startRetryProcessor(): void {
  if (retryInterval) return;
  retryInterval = setInterval(async () => {
    if (retryQueue.length === 0 || !isLLMAvailable()) return;

    const proposal = retryQueue.shift();
    if (!proposal) return;

    logger.info({ id: proposal.id, title: proposal.title, retryCount: proposal.retryCount }, "ConsensusEngine: retrying queued proposal");
    try {
      const { votes, durationMs } = await generateVotesWithLLM(proposal);
      if (votes.length > 0) {
        const degraded = votes.length < Math.ceil(GRAND_COUNCIL_AGENTS.length * BFT_RESPONSE_THRESHOLD);
        finalizeProposal(proposal, votes, durationMs, degraded);
      } else {
        proposal.retryCount = (proposal.retryCount || 0) + 1;
        proposal.implementationNotes = `Queued — zero votes collected after ${proposal.retryCount} retries`;
        proposals.set(proposal.id, proposal);
        retryQueue.push(proposal);
        logger.info({ id: proposal.id, retryCount: proposal.retryCount }, "ConsensusEngine: re-queued — zero responses");
      }
    } catch (err) {
      proposal.retryCount = (proposal.retryCount || 0) + 1;
      retryQueue.push(proposal);
      logger.warn({ id: proposal.id, retryCount: proposal.retryCount, err }, "ConsensusEngine: retry failed, re-queued");
    }
    persistRetryQueue();
  }, 30_000);
}

function finalizeProposal(proposal: ConsensusProposal, votes: ConsensusVote[], durationMs?: number, degradedParticipation = false): void {
  const yesCount = votes.filter(v => v.vote === "approve").length;
  const noCount = votes.filter(v => v.vote === "reject").length;
  const abstainCount = votes.filter(v => v.vote === "abstain").length;
  const approvalRate = computeWeightedApprovalRate(votes, proposal.category);
  const status: ConsensusProposal["status"] = approvalRate >= 2 / 3 ? "approved" : "rejected";

  const specialists = votes.filter(v => v.isSpecialist);
  const phiWeightSummary = `Phi-weighted: ${specialists.length} specialists (w=${PHI.toFixed(3)}), ${votes.length - specialists.length} base (w=1.0)`;
  const participationNote = degradedParticipation
    ? ` [DEGRADED: ${votes.length}/${GRAND_COUNCIL_AGENTS.length} responded — BFT assumption: up to 1/3 may fail]`
    : "";

  proposal.votes = votes;
  proposal.status = status;
  proposal.yesCount = yesCount;
  proposal.noCount = noCount;
  proposal.abstainCount = abstainCount;
  proposal.approvalRate = approvalRate;
  proposal.resolvedAt = Date.now();
  proposal.votingDurationMs = durationMs;
  proposal.votingMethod = "phi-weighted-parallel";
  proposal.implementationNotes = status === "approved"
    ? `Approved by Phi-weighted parallel consensus — ${yesCount}/${votes.length} votes (${GRAND_COUNCIL_AGENTS.length} eligible). ${phiWeightSummary}.${participationNote} ${durationMs ? `Resolved in ${durationMs}ms` : ""}`
    : `Rejected — ${noCount} votes against, ${yesCount} in favor. ${phiWeightSummary}${participationNote}`;

  proposals.set(proposal.id, proposal);

  const transcript = `[CONSENSUS PROPOSAL: ${proposal.title}]
[Category: ${proposal.category}]
[Proposed by: ${proposal.proposedBy}]
[Method: Phi-Weighted Parallel BFT Consensus]
[Voting Duration: ${durationMs ?? "N/A"}ms]
[${phiWeightSummary}]

Votes:
${votes.map(v => `${v.agentName}: ${v.vote.toUpperCase()} (${(v.confidence * 100).toFixed(0)}%, w=${(v.phiWeight ?? 1).toFixed(3)}${v.isSpecialist ? " SPECIALIST" : ""}) — ${v.reasoning.slice(0, 80)}`).join("\n")}

[OUTCOME: ${status.toUpperCase()} — ${yesCount}/${votes.length} votes, ${(approvalRate * 100).toFixed(1)}% weighted approval]`;

  db.insert(councilDecisionsTable).values({
    decisionId: proposal.id,
    topic: proposal.title,
    transcript,
    decisionText: `${proposal.description} — ${status === "approved" ? "ADOPTED" : "REJECTED"} by Grand Council Phi-weighted parallel vote.`,
    voteTally: { yes: yesCount, no: noCount, abstain: abstainCount, totalEligible: GRAND_COUNCIL_AGENTS.length, phiWeighted: true, durationMs },
    outcome: status,
    agentsParticipated: votes.map(v => v.agentName),
    reasoning: JSON.stringify({ category: proposal.category, proposedBy: proposal.proposedBy, method: "phi-weighted-parallel", durationMs, specialists: specialists.length }),
    category: proposal.category,
  }).onConflictDoNothing().catch(err => {
    logger.warn({ err }, "ConsensusEngine: DB persist failed");
  });

  logger.info({ id: proposal.id, status, approvalRate: approvalRate.toFixed(2), votesCollected: votes.length, durationMs, specialists: specialists.length }, "ConsensusEngine: proposal resolved via Phi-weighted parallel BFT");
}

export async function createProposal(paramsOrTitle: {
  title: string;
  description: string;
  proposedBy: string;
  category: ConsensusProposal["category"];
} | string, description?: string, proposedBy?: string, category?: ConsensusProposal["category"]): Promise<ConsensusProposal> {
  const params = typeof paramsOrTitle === "string"
    ? { title: paramsOrTitle, description: description || "", proposedBy: proposedBy || "system", category: (category || "feature") as ConsensusProposal["category"] }
    : paramsOrTitle;

  const id = `proposal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const proposal: ConsensusProposal = {
    id, ...params, votes: [], status: "voting",
    requiredMajority: 2 / 3, createdAt: Date.now(),
    yesCount: 0, noCount: 0, abstainCount: 0, approvalRate: 0,
    retryCount: 0, votingMethod: "phi-weighted-parallel",
  };

  if (!isLLMAvailable()) {
    proposal.status = "queued";
    proposal.implementationNotes = "Queued — LLM unavailable, will retry when available";
    proposals.set(id, proposal);
    retryQueue.push(proposal);
    await persistRetryQueue();
    startRetryProcessor();
    logger.info({ id, title: params.title }, "ConsensusEngine: proposal queued for retry (LLM unavailable)");
    return proposal;
  }

  let votes: ConsensusVote[] = [];
  let durationMs = 0;
  try {
    const result = await generateVotesWithLLM(proposal);
    votes = result.votes;
    durationMs = result.durationMs;
  } catch (err) {
    logger.warn({ err, id }, "ConsensusEngine: LLM vote generation failed — queuing for retry");
  }

  if (votes.length === 0) {
    proposal.status = "queued";
    proposal.votingDurationMs = durationMs;
    proposal.implementationNotes = `Queued — zero votes collected, awaiting LLM availability`;
    proposals.set(id, proposal);
    retryQueue.push(proposal);
    persistRetryQueue();
    startRetryProcessor();
    logger.info({ id }, "ConsensusEngine: zero responses, queued for retry");
    return proposal;
  }

  const degraded = votes.length < Math.ceil(GRAND_COUNCIL_AGENTS.length * BFT_RESPONSE_THRESHOLD);
  finalizeProposal(proposal, votes, durationMs, degraded);
  return proposal;
}

export function getProposal(id: string): ConsensusProposal | undefined {
  return proposals.get(id);
}

export function getAllProposals(): ConsensusProposal[] {
  return Array.from(proposals.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function getConsensusMetrics() {
  const all = getAllProposals();
  const approved = all.filter(p => p.status === "approved").length;
  const rejected = all.filter(p => p.status === "rejected").length;
  const queued = all.filter(p => p.status === "queued").length;
  const avgApproval = all.filter(p => p.approvalRate > 0).length > 0
    ? all.filter(p => p.approvalRate > 0).reduce((s, p) => s + p.approvalRate, 0) / all.filter(p => p.approvalRate > 0).length
    : 0;

  const avgVotingDuration = votingTimings.length > 0
    ? Math.round(votingTimings.reduce((s, t) => s + t, 0) / votingTimings.length)
    : 0;

  const agentPhiWeights: Record<string, { baseWeight: number; phiWeight: number; specialties: string[]; note: string }> = {};
  for (const name of GRAND_COUNCIL_AGENTS) {
    const specialties = AGENT_SPECIALTIES[name] || [];
    agentPhiWeights[name] = {
      baseWeight: 1.0,
      phiWeight: specialties.length > 0 ? PHI : 1.0,
      specialties,
      note: specialties.length > 0
        ? `specialist in [${specialties.join(", ")}] — receives Phi weight (${PHI.toFixed(3)}) only when proposal category matches a specialty; otherwise base weight 1.0`
        : "general agent — always base weight 1.0",
    };
  }

  return {
    totalProposals: all.length,
    approved,
    rejected,
    queued,
    retryQueueSize: retryQueue.length,
    avgApprovalRate: Math.round(avgApproval * 100) / 100,
    agentCount: GRAND_COUNCIL_AGENTS.length,
    approvedCount: approved,
    requiredMajority: "2/3 (BFT)",
    recentProposals: all.slice(0, 5),
    agents: GRAND_COUNCIL_AGENTS,
    llmEnabled: isLLMAvailable(),
    votingMethod: "phi-weighted-parallel",
    phiConstant: PHI,
    bftResponseThreshold: BFT_RESPONSE_THRESHOLD,
    avgVotingDurationMs: avgVotingDuration,
    recentVotingTimings: votingTimings.slice(-10),
    agentPhiWeights,
  };
}

export { GRAND_COUNCIL_AGENTS };

export function getConsensusStats() {
  return getConsensusMetrics();
}
export function listProposals() {
  return getAllProposals();
}
