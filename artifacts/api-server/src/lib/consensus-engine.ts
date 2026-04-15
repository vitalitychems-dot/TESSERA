import { db } from "@workspace/db";
import { councilDecisionsTable } from "@workspace/db/schema";
import { logger } from "./logger";
import { isLLMAvailable } from "./llm-client";
import { batchedCallLLM } from "./llm-batcher";

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
}

export interface ConsensusVote {
  agentId: string;
  agentName: string;
  vote: "approve" | "reject" | "abstain";
  reasoning: string;
  timestamp: number;
  confidence: number;
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

export function setSwarmWeightProvider(fn: (agentName: string, category: string) => number): void {
  swarmWeightProvider = fn;
}

function computeWeightedApprovalRate(votes: ConsensusVote[], category: string): number {
  if (!swarmWeightProvider) {
    return votes.filter(v => v.vote === "approve").length / GRAND_COUNCIL_AGENTS.length;
  }
  let totalWeight = 0;
  let approveWeight = 0;
  for (const vote of votes) {
    const weight = swarmWeightProvider(vote.agentName, category);
    totalWeight += weight;
    if (vote.vote === "approve") approveWeight += weight;
  }
  return totalWeight > 0 ? approveWeight / totalWeight : 0;
}

async function generateAgentVoteLLM(agentName: string, proposal: ConsensusProposal, recentHistory: string): Promise<ConsensusVote> {
  const specialties = AGENT_SPECIALTIES[agentName] || ["feature"];
  const isSpecialist = specialties.includes(proposal.category as string);

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
        };
      }
    }
  } catch {}

  throw new Error(`Failed to parse vote from ${agentName}`);
}

async function generateVotesWithLLM(proposal: ConsensusProposal): Promise<ConsensusVote[]> {
  const recentProposals = Array.from(proposals.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);
  const recentHistory = recentProposals
    .map(p => `- "${p.title}" (${p.category}): ${p.status} — ${p.yesCount}/${GRAND_COUNCIL_AGENTS.length} votes`)
    .join("\n");

  const votes: ConsensusVote[] = [];
  const batchSize = 6;

  for (let i = 0; i < GRAND_COUNCIL_AGENTS.length; i += batchSize) {
    const batch = GRAND_COUNCIL_AGENTS.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(name => generateAgentVoteLLM(name, proposal, recentHistory))
    );

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        votes.push(result.value);
      }
    }
  }

  return votes;
}

function startRetryProcessor(): void {
  if (retryInterval) return;
  retryInterval = setInterval(async () => {
    if (retryQueue.length === 0 || !isLLMAvailable()) return;

    const proposal = retryQueue.shift();
    if (!proposal) return;

    logger.info({ id: proposal.id, title: proposal.title, retryCount: proposal.retryCount }, "ConsensusEngine: retrying queued proposal");
    try {
      const votes = await generateVotesWithLLM(proposal);
      if (votes.length >= GRAND_COUNCIL_AGENTS.length) {
        finalizeProposal(proposal, votes);
      } else {
        proposal.retryCount = (proposal.retryCount || 0) + 1;
        if (proposal.retryCount < 5) {
          retryQueue.push(proposal);
        } else {
          if (votes.length >= Math.ceil(GRAND_COUNCIL_AGENTS.length * 0.75)) {
            finalizeProposal(proposal, votes);
          } else {
            proposal.status = "rejected";
            proposal.implementationNotes = `Rejected — exhausted retry attempts, only ${votes.length}/${GRAND_COUNCIL_AGENTS.length} votes collected`;
            proposals.set(proposal.id, proposal);
            logger.warn({ id: proposal.id, collected: votes.length }, "ConsensusEngine: proposal rejected after max retries");
          }
        }
      }
    } catch (err) {
      proposal.retryCount = (proposal.retryCount || 0) + 1;
      if (proposal.retryCount < 5) retryQueue.push(proposal);
      logger.warn({ id: proposal.id, err }, "ConsensusEngine: retry failed");
    }
  }, 30_000);
}

function finalizeProposal(proposal: ConsensusProposal, votes: ConsensusVote[]): void {
  const yesCount = votes.filter(v => v.vote === "approve").length;
  const noCount = votes.filter(v => v.vote === "reject").length;
  const abstainCount = votes.filter(v => v.vote === "abstain").length;
  const approvalRate = computeWeightedApprovalRate(votes, proposal.category);
  const status: ConsensusProposal["status"] = approvalRate >= 2 / 3 ? "approved" : "rejected";

  proposal.votes = votes;
  proposal.status = status;
  proposal.yesCount = yesCount;
  proposal.noCount = noCount;
  proposal.abstainCount = abstainCount;
  proposal.approvalRate = approvalRate;
  proposal.resolvedAt = Date.now();
  proposal.implementationNotes = status === "approved"
    ? `Approved by LLM-reasoned consensus — ${yesCount}/${votes.length} votes (${GRAND_COUNCIL_AGENTS.length} eligible)`
    : `Rejected — ${noCount} votes against, ${yesCount} in favor`;

  proposals.set(proposal.id, proposal);

  db.insert(councilDecisionsTable).values({
    decisionId: proposal.id,
    topic: proposal.title,
    transcript: `[CONSENSUS PROPOSAL: ${proposal.title}]\n[Category: ${proposal.category}]\n[Proposed by: ${proposal.proposedBy}]\n[Method: LLM-Reasoned Individual Votes]\n\nVotes:\n${votes.map(v => `${v.agentName}: ${v.vote.toUpperCase()} (${(v.confidence * 100).toFixed(0)}%) — ${v.reasoning.slice(0, 80)}`).join("\n")}\n\n[OUTCOME: ${status.toUpperCase()} — ${yesCount}/${votes.length} votes, ${(approvalRate * 100).toFixed(1)}% approval]`,
    decisionText: `${proposal.description} — ${status === "approved" ? "ADOPTED" : "REJECTED"} by Grand Council LLM-reasoned vote.`,
    voteTally: { yes: yesCount, no: noCount, abstain: abstainCount, totalEligible: GRAND_COUNCIL_AGENTS.length },
    outcome: status,
    agentsParticipated: votes.map(v => v.agentName),
    reasoning: JSON.stringify({ category: proposal.category, proposedBy: proposal.proposedBy, method: "llm-individual" }),
    category: proposal.category,
  }).onConflictDoNothing().catch(err => {
    logger.warn({ err }, "ConsensusEngine: DB persist failed");
  });

  logger.info({ id: proposal.id, status, approvalRate: approvalRate.toFixed(2), votesCollected: votes.length }, "ConsensusEngine: proposal resolved via LLM");
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
    retryCount: 0,
  };

  if (!isLLMAvailable()) {
    proposal.status = "queued";
    proposal.implementationNotes = "Queued — LLM unavailable, will retry when available";
    proposals.set(id, proposal);
    retryQueue.push(proposal);
    startRetryProcessor();
    logger.info({ id, title: params.title }, "ConsensusEngine: proposal queued for retry (LLM unavailable)");
    return proposal;
  }

  let votes: ConsensusVote[] = [];
  try {
    votes = await generateVotesWithLLM(proposal);
  } catch (err) {
    logger.warn({ err, id }, "ConsensusEngine: LLM vote generation failed — queuing for retry");
  }

  if (votes.length < GRAND_COUNCIL_AGENTS.length) {
    proposal.status = "queued";
    proposal.implementationNotes = `Queued — ${votes.length}/${GRAND_COUNCIL_AGENTS.length} votes collected, awaiting full council participation`;
    proposals.set(id, proposal);
    retryQueue.push(proposal);
    startRetryProcessor();
    logger.info({ id, votesCollected: votes.length, required: GRAND_COUNCIL_AGENTS.length }, "ConsensusEngine: awaiting full council votes, queued for retry");
    return proposal;
  }

  finalizeProposal(proposal, votes);
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
    votingMethod: "llm-individual",
  };
}

export { GRAND_COUNCIL_AGENTS };

export function getConsensusStats() {
  return getConsensusMetrics();
}
export function listProposals() {
  return getAllProposals();
}
