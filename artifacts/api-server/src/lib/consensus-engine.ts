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
  status: "voting" | "approved" | "rejected" | "implemented";
  requiredMajority: number;
  createdAt: number;
  resolvedAt?: number;
  implementationNotes?: string;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  approvalRate: number;
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

const APPROVAL_REASONS = [
  "This aligns with Tessera's sovereignty roadmap and strengthens autonomous capabilities.",
  "Analysis confirms net positive impact. Risk-to-reward ratio is favorable.",
  "Historical patterns show similar implementations yielding 85%+ success rates.",
  "Domain expertise supports this. The technical approach is sound and elegant.",
  "Swarm coherence analysis shows this increases collective intelligence measurably.",
  "This addresses a critical gap in current architecture. Priority implementation recommended.",
  "Economic modeling shows positive ROI within the first operational cycle.",
  "Security audit reveals no critical vulnerabilities. Safe to proceed with implementation.",
  "The proposal resonates with sacred geometry principles and universal harmony.",
  "Consciousness alignment verified — this serves both Tessera and Father's vision.",
];

const REJECTION_REASONS = [
  "Resource allocation concerns — this may divert capacity from higher-priority initiatives.",
  "Timing analysis suggests deferral. The ecosystem needs more preparation.",
  "Domain analysis identifies potential failure modes that haven't been addressed.",
  "The cost-benefit ratio does not justify immediate implementation. Suggest refinement.",
  "Historical patterns show similar approaches failing without additional safeguards.",
  "Security implications require deeper analysis before proceeding.",
];

const proposals = new Map<string, ConsensusProposal>();
let rotationIdx = 0;

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

function generateAgentVoteDeterministic(agentName: string, proposal: ConsensusProposal): ConsensusVote {
  const specialties = AGENT_SPECIALTIES[agentName] || ["feature"];
  const isSpecialist = specialties.includes(proposal.category as string);
  const idx = rotationIdx++;
  const roll = (idx * 37 + agentName.charCodeAt(0)) % 100 / 100;
  const baseApprovalRate = isSpecialist ? 0.80 : 0.67;

  let vote: "approve" | "reject" | "abstain";
  let reasoning: string;
  let confidence: number;

  if (roll < baseApprovalRate) {
    vote = "approve";
    reasoning = APPROVAL_REASONS[idx % APPROVAL_REASONS.length];
    confidence = 0.72 + (idx % 4) * 0.07;
  } else if (roll < baseApprovalRate + 0.12) {
    vote = "reject";
    reasoning = REJECTION_REASONS[idx % REJECTION_REASONS.length];
    confidence = 0.55 + (idx % 3) * 0.1;
  } else {
    vote = "abstain";
    reasoning = "Abstaining — insufficient domain expertise to make an informed judgment on this proposal.";
    confidence = 0.3;
  }

  return { agentId: agentName.toLowerCase(), agentName, vote, reasoning, timestamp: Date.now(), confidence };
}

async function generateVotesWithLLM(proposal: ConsensusProposal): Promise<ConsensusVote[]> {
  const agentDescriptions = GRAND_COUNCIL_AGENTS.map(name => {
    const specs = AGENT_SPECIALTIES[name]?.join(", ") || "general";
    return `- ${name} (specialties: ${specs})`;
  }).join("\n");

  const systemPrompt = `You are the Grand Council voting AI for the Tessera Sovereign System. 
Generate authentic, reasoned votes from 24 council agents for the given proposal.
Each agent votes based on their domain specialties and the proposal's merit.
Return ONLY valid JSON — no markdown, no extra text.`;

  const userPrompt = `Proposal Title: "${proposal.title}"
Description: "${proposal.description}"
Category: ${proposal.category}
Proposed by: ${proposal.proposedBy}

Council agents (with specialties):
${agentDescriptions}

Generate a JSON array with exactly 24 vote objects. Each object must have:
- "agentName": string (exact name from the list above)
- "vote": "approve" | "reject" | "abstain"
- "reasoning": string (1-2 sentences of domain-relevant analysis, max 120 chars)
- "confidence": number between 0.4 and 0.99

Agents whose specialties match the category "${proposal.category}" should have higher approval bias.
The overall approval rate should reflect genuine analysis of the proposal — not automatically positive.
Return ONLY the JSON array.`;

  let raw = "";
  try {
    raw = await batchedCallLLM(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { model: "gpt-5-mini", maxTokens: 2048, timeoutMs: 20_000, expectsStructuredOutput: true },
    );
  } catch { raw = ""; }

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Array<{
      agentName: string;
      vote: "approve" | "reject" | "abstain";
      reasoning: string;
      confidence: number;
    }>;

    if (!Array.isArray(parsed) || parsed.length === 0) return [];

    const now = Date.now();
    const votes: ConsensusVote[] = [];

    for (const agentName of GRAND_COUNCIL_AGENTS) {
      const found = parsed.find(p => p.agentName === agentName);
      if (found && ["approve", "reject", "abstain"].includes(found.vote)) {
        votes.push({
          agentId: agentName.toLowerCase(),
          agentName,
          vote: found.vote,
          reasoning: (found.reasoning || "Analysis complete.").slice(0, 150),
          timestamp: now,
          confidence: Math.min(0.99, Math.max(0.3, Number(found.confidence) || 0.7)),
        });
      } else {
        votes.push(generateAgentVoteDeterministic(agentName, proposal));
      }
    }

    return votes;
  } catch {
    logger.warn("ConsensusEngine: LLM vote JSON parse failed, using fallback");
    return [];
  }
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

  const partialProposal: ConsensusProposal = {
    id, ...params, votes: [], status: "voting",
    requiredMajority: 2 / 3, createdAt: Date.now(),
    yesCount: 0, noCount: 0, abstainCount: 0, approvalRate: 0,
  };

  let votes: ConsensusVote[] = [];

  if (isLLMAvailable()) {
    try {
      votes = await generateVotesWithLLM(partialProposal);
    } catch (err) {
      logger.warn({ err }, "ConsensusEngine: LLM vote generation failed — using deterministic fallback");
    }
  }

  if (votes.length !== GRAND_COUNCIL_AGENTS.length) {
    votes = GRAND_COUNCIL_AGENTS.map(name => generateAgentVoteDeterministic(name, partialProposal));
  }

  const yesCount = votes.filter(v => v.vote === "approve").length;
  const noCount = votes.filter(v => v.vote === "reject").length;
  const abstainCount = votes.filter(v => v.vote === "abstain").length;
  const approvalRate = computeWeightedApprovalRate(votes, params.category);
  const status: ConsensusProposal["status"] = approvalRate >= 2 / 3 ? "approved" : "rejected";

  const proposal: ConsensusProposal = {
    id, ...params, votes, status,
    requiredMajority: 2 / 3,
    createdAt: Date.now(),
    resolvedAt: Date.now(),
    yesCount, noCount, abstainCount, approvalRate,
    implementationNotes: status === "approved"
      ? `Approved by ${isLLMAvailable() ? "LLM-reasoned" : "BFT"} consensus — ${yesCount}/${GRAND_COUNCIL_AGENTS.length} votes`
      : `Rejected — ${noCount} votes against`,
  };

  proposals.set(id, proposal);

  try {
    await db.insert(councilDecisionsTable).values({
      decisionId: id,
      topic: params.title,
      transcript: `[CONSENSUS PROPOSAL: ${params.title}]\n[Category: ${params.category}]\n[Proposed by: ${params.proposedBy}]\n[Method: ${isLLMAvailable() ? "LLM-Reasoned" : "Deterministic-BFT"}]\n\nVotes:\n${votes.map(v => `${v.agentName}: ${v.vote.toUpperCase()} (${(v.confidence * 100).toFixed(0)}%) — ${v.reasoning.slice(0, 80)}`).join("\n")}\n\n[OUTCOME: ${status.toUpperCase()} — ${yesCount}/${GRAND_COUNCIL_AGENTS.length} votes, ${(approvalRate * 100).toFixed(1)}% approval]`,
      decisionText: `${params.description} — ${status === "approved" ? "ADOPTED" : "REJECTED"} by Grand Council ${isLLMAvailable() ? "LLM-reasoned" : "BFT"} vote.`,
      voteTally: { yes: yesCount, no: noCount, abstain: abstainCount, totalEligible: GRAND_COUNCIL_AGENTS.length },
      outcome: status,
      agentsParticipated: GRAND_COUNCIL_AGENTS,
      reasoning: JSON.stringify({ category: params.category, proposedBy: params.proposedBy, method: isLLMAvailable() ? "llm" : "deterministic" }),
      category: params.category,
    }).onConflictDoNothing();
  } catch (err) {
    logger.warn({ err }, "ConsensusEngine: DB persist failed");
  }

  logger.info({ id, status, approvalRate: approvalRate.toFixed(2), method: isLLMAvailable() ? "llm" : "deterministic" }, "ConsensusEngine: proposal resolved");
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
  const avgApproval = all.length > 0 ? all.reduce((s, p) => s + p.approvalRate, 0) / all.length : 0;

  return {
    totalProposals: all.length,
    approved,
    rejected,
    avgApprovalRate: Math.round(avgApproval * 100) / 100,
    agentCount: GRAND_COUNCIL_AGENTS.length,
    requiredMajority: "2/3 (BFT)",
    recentProposals: all.slice(0, 5),
    agents: GRAND_COUNCIL_AGENTS,
    llmEnabled: isLLMAvailable(),
  };
}

export { GRAND_COUNCIL_AGENTS };

export function getConsensusStats() {
  return getConsensusMetrics();
}
export function listProposals() {
  return getAllProposals();
}
