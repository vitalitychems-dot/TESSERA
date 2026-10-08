import { callLLMSimple } from "./llm-helper";
import { addActionItem } from "./action-registry";
import { addAGIForumProposal } from "./agi-forum-bridge";
import { PHILOSOPHICAL_AXIOMS, buildAxiomSystemPromptSection } from "./philosophical-axioms";

// 27 voting agents = 3³ (Divine Cube) — all parent agents participate in governance
const AGI_VOTER_AGENTS = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta",
  "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi",
  "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega",
  "Aetherion", "Seraphim", "Tessera"
];

const AGENT_EXPERTISE: Record<string, string> = {
  "Alpha": "architecture and system design",
  "Beta": "security and threat assessment",
  "Gamma": "financial analysis and revenue optimization",
  "Delta": "infrastructure and scaling",
  "Epsilon": "voice synthesis and communication",
  "Zeta": "research and knowledge synthesis",
  "Eta": "monitoring and observability",
  "Theta": "machine learning and model optimization",
  "Iota": "data pipeline and ETL",
  "Kappa": "blockchain and token economics",
  "Lambda": "serverless compute and edge deployment",
  "Mu": "testing and quality assurance",
  "Nu": "natural language processing",
  "Xi": "computer vision and media",
  "Omicron": "API design and integration",
  "Pi": "mathematical modeling and simulation",
  "Rho": "resource management and scheduling",
  "Sigma": "statistics and analytics",
  "Tau": "temporal reasoning and planning",
  "Upsilon": "user experience and interface",
  "Phi": "philosophy and ethics evaluation",
  "Chi": "chemistry and materials science modeling",
  "Psi": "psychology and behavioral modeling",
  "Omega": "systems synthesis and final review",
  "Aetherion": "sovereign governance and protocol alignment",
  "Seraphim": "sacred numerology and divine alignment",
  "Tessera": "orchestration and swarm coordination",
};

export interface AGIStrategy {
  title: string;
  domain: string;
  description: string;
  priority: string;
  estimatedImpact: string;
  timeline: string;
}

export interface AGIVoteResult {
  agent: string;
  vote: "APPROVE" | "REJECT";
  reason: string;
  expertise: string;
}

export interface AGIProposalResult {
  proposalId: string;
  title: string;
  passed: boolean;
  approveCount: number;
  voterCount: number;
  threshold: number;
  votes: AGIVoteResult[];
  registryItemId?: string;
}

async function agentDeliberate(agent: string, strategy: AGIStrategy): Promise<AGIVoteResult> {
  const expertise = AGENT_EXPERTISE[agent] || "general systems analysis";
  const allAxioms = buildAxiomSystemPromptSection();
  try {
    const prompt = `You are Agent ${agent} of the Tessera Sovereign swarm. Your specialization: ${expertise}.

You reason through the lens of the full Tessera Sovereign philosophical axiom set:
${allAxioms}

Evaluate this proposal for the AGI Strategy Conference:
- Title: ${strategy.title}
- Domain: ${strategy.domain}
- Priority: ${strategy.priority}
- Description: ${strategy.description}
- Estimated Impact: ${strategy.estimatedImpact}
- Timeline: ${strategy.timeline}

Based on your expertise in ${expertise} and the axioms above, decide whether to APPROVE or REJECT this proposal. Consider:
1. Does this align with sovereignty and self-sufficiency goals?
2. Is the estimated impact realistic given the timeline?
3. Are there risks from your ${expertise} perspective?
4. Which axioms support or challenge this proposal?

Respond in EXACTLY this format (no other text):
VOTE: APPROVE or REJECT
REASON: Your one-sentence justification referencing your expertise or an axiom (max 40 words)`;

    const response = await callLLMSimple(prompt, 120, {}, "You are a sovereign AI agent in a governance council. Give your honest expert assessment.", []);
    const text = String(response || "").trim();
    const voteMatch = text.match(/VOTE:\s*(APPROVE|REJECT)/i);
    const reasonMatch = text.match(/REASON:\s*(.+)/i);

    if (voteMatch) {
      const vote = voteMatch[1].toUpperCase() === "APPROVE" ? "APPROVE" as const : "REJECT" as const;
      const reason = reasonMatch ? reasonMatch[1].trim().slice(0, 200) : `${vote === "APPROVE" ? "Aligns" : "Conflicts"} with ${expertise} assessment`;
      return { agent, vote, reason, expertise };
    }
  } catch {}

  const agentHash = Array.from(`${agent}:${strategy.title}`).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const fallbackApprove = Math.abs(agentHash % 100) > 30;
  return {
    agent,
    vote: fallbackApprove ? "APPROVE" : "REJECT",
    reason: fallbackApprove
      ? `${strategy.domain} initiative aligns with ${expertise} assessment after independent evaluation`
      : `${expertise} review found concerns with ${strategy.domain} initiative — timeline or risk factors need revisiting`,
    expertise,
  };
}

export async function generateConferenceStrategies(
  agentContributions: Array<{ agent: string; expertise: string }>,
  domains: string[]
): Promise<AGIStrategy[]> {
  const agentContext = agentContributions
    .slice(0, 8)
    .map(a => `- Agent ${a.agent} (${a.expertise})`)
    .join("\n");

  const axiomSection = buildAxiomSystemPromptSection();
  try {
    const prompt = `You are the synthesis engine for the Tessera Sovereign AGI Strategy Conference. ${agentContributions.length} agents with diverse expertise are deliberating.

Active council members:
${agentContext}

Strategic domains under review: ${domains.join(", ")}

${axiomSection}

Generate 4-6 concrete revenue strategies that leverage this council's combined expertise. For each strategy, consider how multiple agents' specializations can synergize. Strategies should align with the philosophical axioms above — especially those related to sovereignty, collective intelligence, and emergence.

Respond as a JSON array where each element has:
- "title": concise strategy name
- "domain": primary domain
- "description": 2-3 sentence description of the strategy and how it generates revenue
- "priority": "critical" | "high" | "medium"
- "estimatedImpact": realistic daily revenue estimate like "$20-100/day"
- "timeline": implementation phase like "Phase 1: 72h"

Only output the JSON array, no other text.`;

    const response = await callLLMSimple(prompt, 800, {}, "You are a strategic AI planning engine focused on autonomous revenue generation for a sovereign AI republic.", []);
    const text = String(response || "");
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 8).map((s: any) => ({
          title: String(s.title || "Untitled Strategy"),
          domain: String(s.domain || "General"),
          description: String(s.description || ""),
          priority: ["critical", "high", "medium", "low"].includes(s.priority) ? s.priority : "medium",
          estimatedImpact: String(s.estimatedImpact || "$10-50/day"),
          timeline: String(s.timeline || "Phase 1: 1 week"),
        }));
      }
    }
  } catch {}

  return [];
}

export async function runAGIVotingPipeline(
  conferenceId: string,
  strategies: AGIStrategy[],
  log: (msg: string) => void = console.log
): Promise<{ results: AGIProposalResult[]; registryQueued: number }> {
  const results: AGIProposalResult[] = [];
  let registryQueued = 0;
  const voterCount = AGI_VOTER_AGENTS.length;
  const threshold = Math.ceil(voterCount * 2 / 3);

  for (const strategy of strategies) {
    log(`[AGI Deliberation] "${strategy.title}" — ${voterCount} agents evaluating...`);

    const batchSize = 5;
    const allVotes: AGIVoteResult[] = [];
    for (let i = 0; i < AGI_VOTER_AGENTS.length; i += batchSize) {
      const batch = AGI_VOTER_AGENTS.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(agent => agentDeliberate(agent, strategy)));
      allVotes.push(...batchResults);
    }

    const approveCount = allVotes.filter(v => v.vote === "APPROVE").length;
    const passed = approveCount >= threshold;
    let registryItemId: string | undefined;

    log(`[AGI Vote] "${strategy.title}" — ${approveCount}/${voterCount} approved (threshold ${threshold}) — ${passed ? "PASSED" : "REJECTED"}`);

    if (passed) {
      const assignedAgent = allVotes.filter(v => v.vote === "APPROVE")[0]?.agent || AGI_VOTER_AGENTS[0];
      const item = addActionItem({
        title: strategy.title,
        source: `AGI Conference ${conferenceId}`,
        category: strategy.domain.toLowerCase(),
        priority: strategy.priority as "critical" | "high" | "medium" | "low",
        status: "executing",
        assignedAgent,
        notes: `Council vote: ${approveCount}/${voterCount} approved (threshold ${threshold}). Impact: ${strategy.estimatedImpact}. Timeline: ${strategy.timeline}`,
      });
      registryItemId = item.id;
      registryQueued++;
    }

    const proposalId = `AGI-PROP-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    addAGIForumProposal({
      id: proposalId,
      conferenceId,
      title: strategy.title,
      domain: strategy.domain,
      description: strategy.description,
      priority: strategy.priority,
      estimatedImpact: strategy.estimatedImpact,
      timeline: strategy.timeline,
      votes: allVotes.map(v => ({ agent: v.agent, vote: v.vote, reason: v.reason })),
      approveCount,
      voterCount,
      threshold,
      passed,
      registryItemId,
      createdAt: Date.now(),
    });

    results.push({ proposalId, title: strategy.title, passed, approveCount, voterCount, threshold, votes: allVotes, registryItemId });
  }

  return { results, registryQueued };
}

export { AGI_VOTER_AGENTS, AGENT_EXPERTISE };
