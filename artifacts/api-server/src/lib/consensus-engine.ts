export interface Proposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  category: "governance" | "technical" | "security" | "knowledge" | "economic" | "operational";
  votes: { agentId: string; vote: "yes" | "no" | "abstain"; reason: string; timestamp: number }[];
  status: "pending" | "approved" | "rejected" | "expired";
  requiredMajority: number;
  createdAt: number;
  closedAt: number | null;
  executionStatus: "pending" | "executing" | "completed" | "failed" | null;
}

let proposals: Proposal[] = [];

const VOTING_AGENTS = [
  "athena", "euler", "curie", "noether", "minerva", "ada", "iris",
  "tesla-node", "fibonacci-core", "pythagoras", "hermes", "hypatia",
];

function simulateVote(agentId: string, proposal: Proposal): { vote: "yes" | "no" | "abstain"; reason: string } {
  const domainAffinity: Record<string, string[]> = {
    athena: ["governance", "security", "operational"],
    euler: ["technical", "knowledge"],
    curie: ["technical", "knowledge"],
    noether: ["technical", "governance"],
    minerva: ["knowledge", "governance"],
    ada: ["technical", "operational"],
    iris: ["governance", "operational"],
  };

  const affinities = domainAffinity[agentId] || [];
  const hasAffinity = affinities.includes(proposal.category);
  const rand = Math.random();

  if (hasAffinity) {
    if (rand < 0.75) return { vote: "yes", reason: `Domain expertise supports this ${proposal.category} proposal` };
    if (rand < 0.90) return { vote: "no", reason: `Concerns about implementation feasibility in ${proposal.category}` };
    return { vote: "abstain", reason: `Requires further analysis before committing` };
  }

  if (rand < 0.60) return { vote: "yes", reason: `Aligns with sovereign objectives` };
  if (rand < 0.80) return { vote: "abstain", reason: `Outside primary domain — deferring to specialists` };
  return { vote: "no", reason: `Insufficient evidence for cross-domain impact` };
}

export function createProposal(title: string, description: string, proposer: string, category: Proposal["category"] = "governance"): Proposal {
  const proposal: Proposal = {
    id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title, description, proposer, category,
    votes: [],
    status: "pending",
    requiredMajority: 0.667,
    createdAt: Date.now(),
    closedAt: null,
    executionStatus: null,
  };

  for (const agentId of VOTING_AGENTS) {
    const { vote, reason } = simulateVote(agentId, proposal);
    proposal.votes.push({ agentId, vote, reason, timestamp: Date.now() + Math.random() * 1000 });
  }

  const yesVotes = proposal.votes.filter(v => v.vote === "yes").length;
  const totalVoters = proposal.votes.filter(v => v.vote !== "abstain").length;
  const ratio = totalVoters > 0 ? yesVotes / totalVoters : 0;

  proposal.status = ratio >= proposal.requiredMajority ? "approved" : "rejected";
  proposal.closedAt = Date.now();
  if (proposal.status === "approved") proposal.executionStatus = "pending";

  proposals.push(proposal);
  if (proposals.length > 200) proposals = proposals.slice(-100);

  return proposal;
}

export function getProposal(id: string): Proposal | null {
  return proposals.find(p => p.id === id) || null;
}

export function listProposals(filter?: { status?: string; category?: string }): Proposal[] {
  let result = [...proposals];
  if (filter?.status) result = result.filter(p => p.status === filter.status);
  if (filter?.category) result = result.filter(p => p.category === filter.category);
  return result.slice(-50);
}

export function executeApprovedProposal(id: string): boolean {
  const proposal = proposals.find(p => p.id === id);
  if (!proposal || proposal.status !== "approved") return false;
  proposal.executionStatus = "completed";
  return true;
}

export function getConsensusStats() {
  return {
    totalProposals: proposals.length,
    approved: proposals.filter(p => p.status === "approved").length,
    rejected: proposals.filter(p => p.status === "rejected").length,
    pending: proposals.filter(p => p.status === "pending").length,
    avgApprovalRate: proposals.length > 0
      ? proposals.filter(p => p.status === "approved").length / proposals.length
      : 0,
    recentProposals: proposals.slice(-5).map(p => ({
      id: p.id, title: p.title, status: p.status, category: p.category,
    })),
    votingAgents: VOTING_AGENTS.length,
  };
}
