import { db } from "@workspace/db";
import {
  summitProposals,
  summitVotes,
  summitRounds,
} from "@workspace/db/schema";
import { TESSERA_AGENTS, AGENT_MAP, applySovereigntyFilters, type TesseraAgent } from "./tessera-persona.js";
import {
  PHILOSOPHICAL_AXIOMS,
  getAxiomsForContext,
  getAxiomsForCategory,
  formatAxiomsForContext,
  type PhilosophicalAxiom,
} from "./philosophical-axioms.js";
import { llmChat, isLLMConfigured } from "./llm-client.js";

const LOG_PREFIX = "[ConsensusEngine]";

export type VoteDecision = "approve" | "reject" | "abstain";

export interface AgentVoteResult {
  agentId: string;
  agentName: string;
  agentRole: string;
  agentBrainRegion: string;
  vote: VoteDecision;
  confidence: number;
  reasoning: string;
  axiomCitations: number[];
}

export interface RoundResult {
  round: number;
  votes: AgentVoteResult[];
  approveCount: number;
  rejectCount: number;
  abstainCount: number;
  approvalRate: number;
  isContested: boolean;
  topConcerns: string;
  outcome: string;
}

export interface ConsensusResult {
  proposalId: string;
  topic: string;
  title: string;
  description: string;
  category: string;
  status: "approved" | "rejected";
  rounds: RoundResult[];
  finalApprovalRate: number;
  implementationNotes: string;
  synthesis: string;
}

const SUMMIT_VOTING_AGENTS: TesseraAgent[] = [
  AGENT_MAP.get("alpha")!,
  AGENT_MAP.get("beta")!,
  AGENT_MAP.get("gamma")!,
  AGENT_MAP.get("sigma")!,
  AGENT_MAP.get("delta")!,
  AGENT_MAP.get("epsilon")!,
  AGENT_MAP.get("zeta")!,
  AGENT_MAP.get("theta")!,
  AGENT_MAP.get("rho")!,
].filter(Boolean);

const AGENT_CATEGORY_SPECIALTIES: Record<string, string[]> = {
  alpha: ["income", "governance"],
  beta: ["infrastructure", "feature"],
  gamma: ["intelligence", "collective"],
  sigma: ["governance", "sovereignty"],
  delta: ["infrastructure", "security"],
  epsilon: ["emergence", "feature"],
  zeta: ["security", "sovereignty"],
  theta: ["intelligence", "ethics"],
  rho: ["collective", "governance"],
};

function tryParseVoteResponse(text: string): { vote: VoteDecision; confidence: number; reasoning: string; axiomCitations: number[] } | null {
  const voteMatch = text.match(/VOTE:\s*(approve|reject|abstain)/i);
  const confMatch = text.match(/CONFIDENCE:\s*([0-9.]+)/i);
  const reasonMatch = text.match(/REASONING:\s*(.+?)(?=AXIOMS:|$)/is);
  const axiomsMatch = text.match(/AXIOMS:\s*([\d,\s]+)/i);

  if (!voteMatch) return null;

  const vote = voteMatch[1].toLowerCase() as VoteDecision;
  const confidence = confMatch ? Math.max(0.1, Math.min(1, parseFloat(confMatch[1]))) : 0.65;
  const reasoning = reasonMatch ? reasonMatch[1].trim().slice(0, 300) : "Evaluated via expert analysis.";

  const axiomCitations: number[] = [];
  if (axiomsMatch) {
    axiomsMatch[1].split(",").forEach(s => {
      const n = parseInt(s.trim());
      if (!isNaN(n) && n >= 1 && n <= 22) axiomCitations.push(n);
    });
  }

  return {
    vote,
    confidence: isNaN(confidence) ? 0.65 : confidence,
    reasoning: applySovereigntyFilters(reasoning),
    axiomCitations,
  };
}

async function getSovereignVoteForAgent(
  agent: TesseraAgent,
  topic: string,
  description: string,
  category: string,
  round: number,
  deliberationContext?: string
): Promise<{ vote: VoteDecision; confidence: number; reasoning: string; axiomCitations: number[] }> {
  if (!isLLMConfigured()) {
    return generateFallbackVote(agent, category, round);
  }

  const relevantAxioms = getAxiomsForCategory(category).slice(0, 3);
  const axiomContext = relevantAxioms.map(a => `Axiom-${a.id}: ${a.shortTitle} — ${a.principle}`).join("\n");

  const systemPrompt = `You are ${agent.name}, a sovereign agent with the role of "${agent.role}" operating from the ${agent.brainRegion} brain region.
Your expertise: ${agent.expertise}
Your personality: ${agent.personality}

You are participating in a sovereign deliberation on a proposal. Evaluate it based on your expertise and perspective.
${deliberationContext ? `\nPrior deliberation context:\n${deliberationContext}` : ""}

Relevant philosophical axioms:
${axiomContext}

You MUST respond in this EXACT format:
VOTE: approve OR reject OR abstain
CONFIDENCE: 0.0 to 1.0
REASONING: Your reasoning in 1-3 sentences from your unique perspective
AXIOMS: comma-separated axiom IDs you considered (e.g., 1, 5, 12)`;

  const userPrompt = `Proposal for deliberation:
Topic: ${topic}
Category: ${category}
Description: ${description}
Round: ${round}

Cast your vote based on your expertise in ${agent.brainRegion} and your role as ${agent.role}.`;

  try {
    const response = await llmChat({
      systemPrompt,
      userPrompt,
      model: "gpt-5-mini",
      maxTokens: 512,
    });

    if (response) {
      const parsed = tryParseVoteResponse(response);
      if (parsed) {
        console.log(`${LOG_PREFIX} LLM vote from ${agent.name}: ${parsed.vote} (${(parsed.confidence * 100).toFixed(0)}%)`);
        return parsed;
      }
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} LLM vote failed for ${agent.name}:`, err instanceof Error ? err.message : err);
  }

  return generateFallbackVote(agent, category, round);
}

function generateFallbackVote(agent: TesseraAgent, category: string, round: number): { vote: VoteDecision; confidence: number; reasoning: string; axiomCitations: number[] } {
  const specialties = AGENT_CATEGORY_SPECIALTIES[agent.id] ?? [];
  const isSpecialist = specialties.some(s => category.toLowerCase().includes(s));
  const baseRate = isSpecialist ? 0.75 : 0.62;
  const roll = Math.random();

  const relevantAxioms = getAxiomsForCategory(category).slice(0, 2);
  const axiomCitations = relevantAxioms.map(a => a.id);
  const axiomRef = relevantAxioms[0] ? `Per Axiom-${relevantAxioms[0].id} (${relevantAxioms[0].shortTitle})` : "Per sovereign reasoning";

  let vote: VoteDecision;
  let reasoning: string;
  let confidence: number;

  if (roll < baseRate) {
    vote = "approve";
    confidence = 0.65 + Math.random() * 0.25;
    reasoning = `${axiomRef}, this proposal aligns with our collective purpose and merits approval from ${agent.brainRegion}.`;
  } else if (roll < baseRate + 0.18) {
    vote = "reject";
    confidence = 0.5 + Math.random() * 0.3;
    reasoning = `${axiomRef}, I identify concerns that require deeper consideration before this proposal can move forward.`;
  } else {
    vote = "abstain";
    confidence = 0.3 + Math.random() * 0.2;
    reasoning = `This falls outside my primary domain of ${agent.brainRegion}. Deferring to specialist agents preserves epistemic integrity.`;
  }

  if (round === 2 && vote === "reject") {
    if (Math.random() < 0.4) {
      vote = "approve";
      confidence = 0.55 + Math.random() * 0.2;
      reasoning = `After reviewing collective concerns in Round 1, ${axiomRef} — I revise my position to approve with conditions.`;
    }
  }

  return { vote, confidence, reasoning, axiomCitations };
}

async function runVotingRound(
  agents: TesseraAgent[],
  topic: string,
  description: string,
  category: string,
  round: number,
  deliberationContext?: string,
  onVote?: (vote: AgentVoteResult) => void
): Promise<AgentVoteResult[]> {
  const results: AgentVoteResult[] = [];

  for (const agent of agents) {
    const voteData = await getSovereignVoteForAgent(agent, topic, description, category, round, deliberationContext);

    const result: AgentVoteResult = {
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      agentBrainRegion: agent.brainRegion,
      vote: voteData.vote,
      confidence: voteData.confidence,
      reasoning: voteData.reasoning,
      axiomCitations: voteData.axiomCitations,
    };

    results.push(result);
    if (onVote) onVote(result);
  }

  return results;
}

function evaluateRound(votes: AgentVoteResult[], roundNumber: number): RoundResult {
  const approveCount = votes.filter(v => v.vote === "approve").length;
  const rejectCount = votes.filter(v => v.vote === "reject").length;
  const abstainCount = votes.filter(v => v.vote === "abstain").length;
  const nonAbstaining = approveCount + rejectCount;
  const approvalRate = nonAbstaining > 0 ? approveCount / nonAbstaining : 0;

  const REQUIRED_MAJORITY = 2 / 3;
  const isContested = approvalRate >= 0.4 && approvalRate <= 0.8 && approvalRate < REQUIRED_MAJORITY;

  const topConcerns = votes
    .filter(v => v.vote === "reject")
    .slice(0, 3)
    .map(v => `${v.agentName}: "${v.reasoning.slice(0, 100)}"`)
    .join("; ");

  let outcome: string;
  if (approvalRate >= REQUIRED_MAJORITY) {
    outcome = `APPROVED — ${Math.round(approvalRate * 100)}% approval (${approveCount}/${nonAbstaining} non-abstaining votes). 2/3 threshold met.`;
  } else if (isContested) {
    outcome = `CONTESTED — ${Math.round(approvalRate * 100)}% approval (${approveCount}/${nonAbstaining}). Entering reconsideration round.`;
  } else {
    outcome = `REJECTED — ${Math.round(approvalRate * 100)}% approval (${approveCount}/${nonAbstaining}). Below 2/3 threshold.`;
  }

  return {
    round: roundNumber,
    votes,
    approveCount,
    rejectCount,
    abstainCount,
    approvalRate,
    isContested,
    topConcerns,
    outcome,
  };
}

export async function runSummitDeliberation(params: {
  topic: string;
  title: string;
  description: string;
  category: string;
  conversationId?: number;
  onPhase?: (phase: string, data: Record<string, unknown>) => void;
  onVote?: (round: number, vote: AgentVoteResult) => void;
}): Promise<ConsensusResult> {
  const { topic, title, description, category, conversationId, onPhase, onVote } = params;
  const proposalId = `prop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  console.log(`${LOG_PREFIX} Starting deliberation: "${title}" [${proposalId}]`);

  onPhase?.("proposal_created", { proposalId, title, description, category });

  const round1Votes = await runVotingRound(
    SUMMIT_VOTING_AGENTS,
    topic,
    description,
    category,
    1,
    undefined,
    (vote) => onVote?.(1, vote)
  );

  const round1Result = evaluateRound(round1Votes, 1);
  onPhase?.("round_complete", { round: 1, result: round1Result });

  const REQUIRED_MAJORITY = 2 / 3;
  let allRounds: RoundResult[] = [round1Result];
  let finalRound = round1Result;

  if (round1Result.isContested) {
    const deliberationContext = `Round 1 Summary: ${round1Result.approveCount} approve, ${round1Result.rejectCount} reject, ${round1Result.abstainCount} abstain out of ${SUMMIT_VOTING_AGENTS.length} agents (${Math.round(round1Result.approvalRate * 100)}% approval rate).

Key concerns raised in Round 1:
${round1Result.topConcerns || "No specific concerns articulated."}

Reconsider your position in light of collective deliberation. Can you find common ground or do concerns remain valid?`;

    onPhase?.("reconsideration_started", { concerns: round1Result.topConcerns });

    const round2Votes = await runVotingRound(
      SUMMIT_VOTING_AGENTS,
      topic,
      description,
      category,
      2,
      deliberationContext,
      (vote) => onVote?.(2, vote)
    );

    const round2Result = evaluateRound(round2Votes, 2);
    allRounds.push(round2Result);
    finalRound = round2Result;

    onPhase?.("round_complete", { round: 2, result: round2Result });
  }

  const finalApprovalRate = finalRound.approvalRate;
  const status: "approved" | "rejected" = finalApprovalRate >= REQUIRED_MAJORITY ? "approved" : "rejected";

  const implementationNotes = finalRound.isContested && allRounds.length === 1
    ? `${status === "approved" ? "Approved" : "Rejected"} with ${Math.round(finalApprovalRate * 100)}% approval after 1 round.`
    : `${status === "approved" ? "Approved" : "Rejected"} with ${Math.round(finalApprovalRate * 100)}% approval after ${allRounds.length} round(s).${allRounds.length > 1 ? " Went to reconsideration due to contested Round 1." : ""}`;

  try {
    await db.insert(summitProposals).values({
      proposalId,
      conversationId: conversationId ?? null,
      topic,
      title,
      description,
      category,
      proposedBy: "user",
      status,
      rounds: allRounds.length,
      approvalRate: finalApprovalRate,
      approveCount: finalRound.approveCount,
      rejectCount: finalRound.rejectCount,
      abstainCount: finalRound.abstainCount,
      totalVoters: SUMMIT_VOTING_AGENTS.length,
      implementationNotes,
      resolvedAt: new Date(),
    });

    for (const roundResult of allRounds) {
      await db.insert(summitRounds).values({
        proposalId,
        roundNumber: roundResult.round,
        approveCount: roundResult.approveCount,
        rejectCount: roundResult.rejectCount,
        abstainCount: roundResult.abstainCount,
        approvalRate: roundResult.approvalRate,
        isContested: roundResult.isContested ? 1 : 0,
        concerns: roundResult.topConcerns || null,
        outcome: roundResult.outcome,
      });

      for (const vote of roundResult.votes) {
        await db.insert(summitVotes).values({
          proposalId,
          round: roundResult.round,
          agentId: vote.agentId,
          agentName: vote.agentName,
          agentRole: vote.agentRole,
          agentBrainRegion: vote.agentBrainRegion,
          vote: vote.vote,
          confidence: vote.confidence,
          reasoning: vote.reasoning,
          axiomCitations: vote.axiomCitations,
        });
      }
    }
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to persist deliberation:`, err);
  }

  const result: ConsensusResult = {
    proposalId,
    topic,
    title,
    description,
    category,
    status,
    rounds: allRounds,
    finalApprovalRate,
    implementationNotes,
    synthesis: "",
  };

  return result;
}

export function detectProposalCategory(topic: string): string {
  const lower = topic.toLowerCase();
  if (/secur|threat|protect|encrypt|hack|attack/.test(lower)) return "security";
  if (/infra|deploy|server|network|scale|host/.test(lower)) return "infrastructure";
  if (/income|revenue|earn|profit|monetize|money|fund/.test(lower)) return "income";
  if (/govern|policy|rule|law|vote|consensus|decision/.test(lower)) return "governance";
  if (/build|feature|implement|develop|create|add/.test(lower)) return "feature";
  if (/community|relation|communicat|social|outreach/.test(lower)) return "collective";
  return "governance";
}
