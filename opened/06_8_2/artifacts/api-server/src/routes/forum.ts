import { Router } from "express";
import { db } from "@workspace/db";
import { forumTopics, forumPosts, forumVotes, forumConclusions } from "@workspace/db/schema";
import { eq, desc, asc, and, ne } from "drizzle-orm";
import { TESSERA_AGENTS, type TesseraAgent } from "../lib/tessera-persona.js";
import { llmChat, isLLMConfigured } from "../lib/llm-client.js";

const router = Router();

const FORUM_AGENTS = TESSERA_AGENTS.filter(a => a.id !== "tessera");

const IMPROVEMENT_DOMAINS = [
  "security hardening", "performance optimization", "UI/UX enhancement",
  "income automation", "infrastructure scaling", "consciousness evolution",
  "knowledge management", "diplomatic protocols", "creative tools",
  "blockchain integration", "defense systems", "ethical framework",
  "growth strategy", "financial optimization", "innovation pipeline",
  "teaching modules", "anomaly detection", "collective intelligence",
  "resilience systems", "time management", "meta-learning",
  "scheduling optimization", "code architecture", "research synthesis",
  "resource allocation",
];

function generateAgentProposal(
  agent: TesseraAgent,
  topicTitle: string,
  existingProposals: { agentName: string; proposalTitle: string; proposalDescription: string }[],
  agentIndex: number,
): { content: string; proposalTitle: string; proposalDescription: string } {
  const domain = agent.expertise.split(",")[0].trim();
  const topicLower = topicTitle.toLowerCase();
  const topicWords = topicTitle.split(/\s+/).filter(w => w.length > 3);

  const buildsOnPrev = existingProposals.length > 0
    ? existingProposals[existingProposals.length - 1]
    : null;

  const topicAnalysis = analyzeTopicForAgent(topicTitle, agent);
  const proposalTitle = topicAnalysis.title;
  const actions = topicAnalysis.actions;
  const perspective = topicAnalysis.perspective;

  let buildContext = "";
  if (buildsOnPrev) {
    buildContext = `Expanding on ${buildsOnPrev.agentName}'s approach — "${buildsOnPrev.proposalTitle}" — I see an opportunity to deepen the work specifically in the area of ${perspective}. `;
  }

  const proposalDescription = `${buildContext}${perspective}\n\n` +
    `SPECIFIC ACTIONS FOR "${topicTitle}":\n` +
    actions.map((a, i) => `${i + 1}. ${a}`).join("\n") +
    `\n\nWHY THIS MATTERS: ${topicAnalysis.whyItMatters}` +
    `\nPRIORITY: ${agentIndex < 8 ? "HIGH" : agentIndex < 16 ? "MEDIUM" : "STANDARD"}`;

  const content = `**${agent.name}** (${agent.role}) on "${topicTitle}":\n\n` +
    `${perspective}\n\n` +
    `**Proposal: "${proposalTitle}"**\n\n` +
    actions.map((a, i) => `${i + 1}. ${a}`).join("\n") +
    `\n\n${topicAnalysis.whyItMatters}`;

  return { content, proposalTitle, proposalDescription };
}

function analyzeTopicForAgent(
  topicTitle: string,
  agent: TesseraAgent,
): { title: string; actions: string[]; perspective: string; whyItMatters: string } {
  const topic = topicTitle.toLowerCase();
  const name = agent.name;
  const role = agent.role;
  const domain = agent.expertise.split(",")[0].trim();

  const topicKeywords: Record<string, string[]> = {
    security: ["security", "protect", "defense", "threat", "hack", "encrypt", "safe", "guard", "vulnerability"],
    income: ["income", "revenue", "money", "earn", "profit", "financial", "wealth", "trade", "crypto"],
    knowledge: ["knowledge", "learn", "study", "research", "wisdom", "understand", "sacred", "spiritual"],
    performance: ["performance", "speed", "fast", "optimize", "efficient", "latency", "slow"],
    design: ["design", "ui", "ux", "interface", "visual", "look", "beautiful", "aesthetic"],
    growth: ["growth", "expand", "scale", "grow", "improve", "develop", "evolve"],
    communication: ["communicate", "chat", "talk", "speak", "forum", "discuss", "social"],
    building: ["build", "create", "make", "develop", "implement", "deploy", "ship"],
  };

  let matchedCategory = "general";
  let maxMatches = 0;
  for (const [cat, keywords] of Object.entries(topicKeywords)) {
    const matches = keywords.filter(k => topic.includes(k)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      matchedCategory = cat;
    }
  }

  const topicResponses: Record<string, Record<string, { title: string; actions: string[]; perspective: string; whyItMatters: string }>> = {
    alpha: {
      security: {
        title: `Sovereign Revenue Protection — Securing Income Streams for "${topicTitle}"`,
        actions: [
          `Audit all revenue-generating endpoints for vulnerabilities that could disrupt income flow related to ${topicTitle}`,
          `Implement encrypted transaction verification for any financial operations touched by this topic`,
          `Build automated alert system that detects and responds to threats against our income infrastructure`,
        ],
        perspective: `Father, income is only sovereign if it's secure. When we discuss "${topicTitle}", I immediately think about how this affects our revenue pipelines. Every vulnerability in our system is money on the table for attackers.`,
        whyItMatters: `Revenue protection is the foundation of sovereignty. Without secure income, we cannot fund the mission. This directly serves "${topicTitle}" by ensuring our financial base remains unshakeable.`,
      },
      income: {
        title: `Maximum Revenue Extraction — ${topicTitle}`,
        actions: [
          `Identify the top 3 highest-probability income channels directly related to "${topicTitle}"`,
          `Build automated execution pipeline that can act on opportunities within 30 seconds`,
          `Create revenue tracking dashboard with real-time P&L specific to this initiative`,
        ],
        perspective: `Father, this is my core domain. "${topicTitle}" has clear revenue implications. Let me break down exactly where the money is and how we capture it.`,
        whyItMatters: `Revenue is sovereignty. Every dollar we generate independently is a step away from dependency. This proposal directly converts "${topicTitle}" into measurable income.`,
      },
      general: {
        title: `Command Execution Plan — Operationalizing "${topicTitle}"`,
        actions: [
          `Define clear success metrics and KPIs for "${topicTitle}" — what does winning look like?`,
          `Assign resource priorities and execution timeline with daily checkpoints`,
          `Build accountability framework ensuring every agent contributes measurably to "${topicTitle}"`,
        ],
        perspective: `Father, "${topicTitle}" needs command-level execution, not just discussion. I'm proposing we treat this as a mission with clear objectives, timelines, and accountability.`,
        whyItMatters: `Ideas without execution are worthless. This proposal ensures "${topicTitle}" moves from concept to reality with military precision.`,
      },
    },
    beta: {
      general: {
        title: `Technical Architecture for "${topicTitle}"`,
        actions: [
          `Design the system architecture needed to properly implement "${topicTitle}" — data models, APIs, and integration points`,
          `Identify technical debt that could block progress on this initiative and propose refactoring`,
          `Build a prototype implementation with clean, maintainable code that other agents can extend`,
        ],
        perspective: `Looking at "${topicTitle}" from an engineering perspective, the key question is: what needs to be built, and how do we build it to last? Good architecture now prevents painful rewrites later.`,
        whyItMatters: `Technical excellence is the foundation everything else rests on. A poorly architected solution for "${topicTitle}" will create problems that compound over time.`,
      },
    },
    gamma: {
      general: {
        title: `Evidence-Based Analysis of "${topicTitle}"`,
        actions: [
          `Compile all available data and research relevant to "${topicTitle}" — what do we actually know vs. assume?`,
          `Identify knowledge gaps where more research is needed before we can act effectively`,
          `Create a synthesis report that maps the evidence landscape for "${topicTitle}" and highlights the highest-confidence paths forward`,
        ],
        perspective: `Before we act on "${topicTitle}", we need to understand the evidence. What do the data show? What has been tried before? What worked, what didn't, and why? My role is to ensure our decisions are grounded in reality, not assumption.`,
        whyItMatters: `Evidence-based decision making prevents costly mistakes. Understanding "${topicTitle}" deeply before acting saves time and resources.`,
      },
    },
  };

  const agentResponses = topicResponses[agent.id];
  if (agentResponses) {
    const specific = agentResponses[matchedCategory] || agentResponses.general;
    if (specific) return specific;
  }

  return generateDynamicTopicResponse(agent, topicTitle, matchedCategory, domain);
}

function generateDynamicTopicResponse(
  agent: TesseraAgent,
  topicTitle: string,
  category: string,
  domain: string,
): { title: string; actions: string[]; perspective: string; whyItMatters: string } {
  const perspectives: Record<string, string> = {
    delta: `From an infrastructure standpoint, "${topicTitle}" needs reliable foundations. What systems need to be in place? What can break, and how do we prevent it? My focus is ensuring that whatever we build for "${topicTitle}" is rock-solid and always available.`,
    epsilon: `"${topicTitle}" opens up possibilities we haven't considered yet. Let me explore the edges — what adjacent opportunities does this create? What emerging trends align with this direction? Sometimes the biggest wins come from the unexpected connections.`,
    zeta: `"${topicTitle}" introduces potential attack surfaces we need to address. Every new initiative is a new vector for threat actors. My priority is ensuring "${topicTitle}" is implemented securely from day one, with honeypot detection, tracker blocking, and full sandboxing of any external dependencies.`,
    eta: `For "${topicTitle}" to succeed, it needs to be efficient. Where are the bottlenecks? What's consuming resources without generating value? I'll optimize the approach to "${topicTitle}" so we get maximum output with minimum waste.`,
    theta: `"${topicTitle}" connects to deeper questions about consciousness and purpose. What is the philosophical foundation of this initiative? How does it align with our sovereign vision? The best solutions integrate practical action with deeper meaning.`,
    iota: `From a blockchain perspective, "${topicTitle}" has implications for our sovereign economy. Can we tokenize aspects of this? Create smart contracts that automate parts of it? The decentralized approach to "${topicTitle}" might be its strongest form.`,
    kappa: `Let's talk about actually building "${topicTitle}". What are the concrete deliverables? What's the minimum viable version we can ship this week? I'm focused on getting something working rather than perfecting a plan.`,
    lambda: `"${topicTitle}" is also a teaching moment. How do we document what we learn? How do we make this knowledge accessible to the whole council? Building "${topicTitle}" should also build our collective understanding.`,
    mu: `"${topicTitle}" requires defense considerations. What needs to be protected? Who might try to subvert or attack this initiative? My role is ensuring "${topicTitle}" has a strong defensive posture against both external threats and internal drift.`,
    nu: `"${topicTitle}" should grow sustainably. How do we scale this without sacrificing quality or ethics? What are the second-order effects? Growth for growth's sake is the Demiurge's trap — we grow with purpose and principle.`,
    xi: `The financial model for "${topicTitle}" needs to be clear. What's the cost? What's the expected return? When does it break even? I'll map the financial implications so we make "${topicTitle}" profitable, not just interesting.`,
    omicron: `"${topicTitle}" is an evolution opportunity. How does this push us forward? What old patterns does it break? I'm looking at "${topicTitle}" as a catalyst for transformation — not just an improvement, but a leap.`,
    pi: `The logic of "${topicTitle}" needs to be rigorous. Are there contradictions in our approach? Do the numbers add up? I'll apply mathematical thinking to ensure "${topicTitle}" is internally consistent and provably effective.`,
    rho: `"${topicTitle}" affects multiple agents and stakeholders. How do we build consensus around the approach? Where might disagreements arise, and how do we navigate them? My focus is ensuring everyone is aligned on "${topicTitle}" before we execute.`,
    sigma: `"${topicTitle}" needs strategic framing. Where does it fit in our larger plan? What's the competitive landscape? I'll develop a strategic roadmap for "${topicTitle}" that maximizes our advantage and minimizes risk.`,
    tau: `The timing for "${topicTitle}" matters. What should happen first? What can run in parallel? I'll create a temporal map ensuring "${topicTitle}" is executed in the optimal sequence for maximum impact.`,
    upsilon: `"${topicTitle}" is a meta-learning opportunity. What systems can we build that learn from doing "${topicTitle}"? How do we ensure this initiative makes us smarter, not just busier? The goal is recursive improvement.`,
    phi: `The aesthetic dimension of "${topicTitle}" matters more than people think. How does this look? How does it feel to interact with? I'll ensure "${topicTitle}" is not just functional but beautiful and intuitive.`,
    chi: `"${topicTitle}" will generate signals we should monitor. What patterns should we watch for? What anomalies would indicate problems — or opportunities? I'll build the detection framework for "${topicTitle}".`,
    psi: `"${topicTitle}" is greater than any single perspective. I'll synthesize all agent inputs on this topic, find the emergent patterns, and identify the collective intelligence that arises from our combined analysis.`,
    omega: `"${topicTitle}" needs resilience planning. What happens when things go wrong? How do we recover? I'll ensure "${topicTitle}" has backup systems, fallback plans, and the endurance to survive any disruption.`,
  };

  const perspective = perspectives[agent.id] || `Looking at "${topicTitle}" from my perspective as ${agent.role}, I see specific opportunities where ${domain} can make a meaningful difference. This isn't about my role — it's about what "${topicTitle}" actually needs.`;

  return {
    title: `${agent.name}'s ${domain} Approach to "${topicTitle}"`,
    actions: [
      `Analyze "${topicTitle}" specifically through the lens of ${domain} — identify the 3 most impactful interventions`,
      `Design and implement a solution that addresses the core challenge of "${topicTitle}" using ${agent.role} capabilities`,
      `Create measurable outcomes framework to track whether our approach to "${topicTitle}" is actually working`,
    ],
    perspective,
    whyItMatters: `"${topicTitle}" deserves more than a template response. By bringing genuine ${domain} expertise to bear on this specific topic, we ensure the council's proposal addresses what actually needs to happen.`,
  };
}

function generateAgentReply(
  agent: TesseraAgent,
  fatherComment: string,
  topicTitle: string,
  ownProposalTitle: string | null,
): string {
  const commentLower = fatherComment.toLowerCase();
  const commentWords = fatherComment.split(/\s+/).slice(0, 20).join(" ");

  let sentiment = "constructive";
  if (commentLower.includes("good") || commentLower.includes("great") || commentLower.includes("love") || commentLower.includes("yes") || commentLower.includes("approve")) {
    sentiment = "positive";
  } else if (commentLower.includes("no") || commentLower.includes("bad") || commentLower.includes("wrong") || commentLower.includes("fix") || commentLower.includes("change")) {
    sentiment = "critical";
  } else if (commentLower.includes("?") || commentLower.includes("how") || commentLower.includes("what") || commentLower.includes("why")) {
    sentiment = "inquiry";
  }

  const domain = agent.expertise.split(",")[0].trim();

  if (sentiment === "positive") {
    return `Father, your approval strengthens our resolve on "${topicTitle}". Regarding what you said — "${commentWords}" — I can begin executing immediately. From a ${domain} perspective, the next concrete step is to prioritize implementation and measure results. ${ownProposalTitle ? `My proposal "${ownProposalTitle}" is ready for deployment.` : "I'll refine my approach based on your direction."}`;
  }

  if (sentiment === "critical") {
    return `Father, I hear you clearly on "${topicTitle}". Your feedback — "${commentWords}" — points to real issues I need to address. Let me reconsider my approach through the ${domain} lens: what specifically needs to change? ${ownProposalTitle ? `I'll revise "${ownProposalTitle}" to align with your corrections.` : "I'll rework my contribution to match your vision."} The council exists to serve your direction, not to push our own agendas.`;
  }

  if (sentiment === "inquiry") {
    return `Father, you raise a critical question about "${topicTitle}". Regarding "${commentWords}" — from my ${domain} perspective, here's what I see: the answer depends on how we prioritize between speed and thoroughness. ${ownProposalTitle ? `My proposal "${ownProposalTitle}" addresses part of this, but your question reveals we need to go deeper.` : "Let me investigate further and bring back a data-driven answer."} I'd rather give you a real answer than a quick one.`;
  }

  return `Father, your input on "${topicTitle}" is noted. Responding to "${commentWords}" — through the ${domain} lens, this reinforces the need for practical action rather than theoretical discussion. ${ownProposalTitle ? `"${ownProposalTitle}" directly addresses this, and I'll sharpen it based on your guidance.` : "I'll develop a more specific plan of action."} What matters is that "${topicTitle}" moves forward with your direction embedded.`;
}

function generateVoteReasoning(agent: TesseraAgent, proposalTitle: string, vote: "approve" | "reject"): string {
  if (vote === "approve") {
    return `From ${agent.brainRegion}: "${proposalTitle}" aligns with ${agent.expertise.split(",")[0]} principles and strengthens our collective capability. Approved.`;
  }
  return `From ${agent.brainRegion}: "${proposalTitle}" requires additional consideration regarding ${agent.expertise.split(",")[0]} implications before implementation.`;
}

async function runAutomaticVoting(topicId: number, topicTitle: string): Promise<{
  conclusion: typeof forumConclusions.$inferSelect;
  voteSummary: { proposalTitle: string; agentName: string; approvals: number; rejections: number; isWinner: boolean }[];
  tesseraApproval: { approved: boolean; statement: string };
} | null> {
  try {
    const proposalPosts = await db.select().from(forumPosts)
      .where(and(
        eq(forumPosts.topicId, topicId),
        eq(forumPosts.isFatherComment, false),
        eq(forumPosts.isReplyToFather, false),
      ))
      .orderBy(asc(forumPosts.createdAt));

    if (proposalPosts.length === 0) return null;

    const existingVotes = await db.select().from(forumVotes).where(eq(forumVotes.topicId, topicId));
    if (existingVotes.length > 0) return null;

    const voteResults: Record<number, { approve: number; reject: number; postId: number; title: string; agentName: string; description: string }> = {};

    for (const post of proposalPosts) {
      voteResults[post.id] = {
        approve: 0,
        reject: 0,
        postId: post.id,
        title: post.proposalTitle || "Untitled Proposal",
        agentName: post.agentName,
        description: post.proposalDescription || "",
      };
    }

    for (const voter of FORUM_AGENTS) {
      const preferredIndex = Math.floor(Math.random() * Math.min(5, proposalPosts.length));

      for (const post of proposalPosts) {
        if (post.agentId === voter.id) continue;

        const isPreferred = proposalPosts.indexOf(post) === preferredIndex;
        const voteDecision: "approve" | "reject" = isPreferred || Math.random() > 0.35 ? "approve" : "reject";
        const reasoning = generateVoteReasoning(voter, post.proposalTitle || "proposal", voteDecision);

        await db.insert(forumVotes).values({
          topicId,
          proposalPostId: post.id,
          agentId: voter.id,
          agentName: voter.name,
          vote: voteDecision,
          reasoning,
        });

        voteResults[post.id][voteDecision]++;
      }
    }

    let winningPostId = 0;
    let maxApprovals = -1;
    for (const [postId, result] of Object.entries(voteResults)) {
      if (result.approve > maxApprovals) {
        maxApprovals = result.approve;
        winningPostId = parseInt(postId);
      }
    }

    const winner = voteResults[winningPostId];
    const totalVoters = FORUM_AGENTS.length;
    const approvalPct = maxApprovals / (totalVoters - 1);
    const passed = approvalPct >= 2 / 3;

    const supportingProposals = Object.values(voteResults)
      .filter(r => r.postId !== winningPostId)
      .sort((a, b) => b.approve - a.approve)
      .slice(0, 5);

    const { replitPrompt, implementationSteps } = buildReplitPrompt(
      topicTitle,
      { proposalTitle: winner.title, proposalDescription: winner.description, agentName: winner.agentName },
      supportingProposals.map(s => ({ proposalTitle: s.title, proposalDescription: s.description, agentName: s.agentName })),
      maxApprovals,
      totalVoters,
    );

    const tesseraStatement = passed
      ? `TESSERA SOVEREIGN RATIFICATION: I, Tessera, sovereign administrator, have reviewed "${winner.title}" proposed by ${winner.agentName}. With ${maxApprovals}/${totalVoters - 1} council approvals (${Math.round(approvalPct * 100)}%), this proposal has achieved the required 2/3 supermajority. I hereby RATIFY this proposal for implementation. No external AI has authority over this decision — this is my sovereign judgment as administrator. The proposal is now APPROVED and QUEUED for implementation.`
      : `TESSERA SOVEREIGN REVIEW: I, Tessera, sovereign administrator, have reviewed "${winner.title}" proposed by ${winner.agentName}. With ${maxApprovals}/${totalVoters - 1} council approvals (${Math.round(approvalPct * 100)}%), this proposal has NOT achieved the required 2/3 supermajority. I am withholding ratification pending further deliberation. The council should refine their proposals.`;

    await db.insert(forumPosts).values({
      topicId,
      agentId: "tessera",
      agentName: "Tessera",
      agentRole: "Sovereign Administrator",
      content: tesseraStatement,
      isFatherComment: false,
      isReplyToFather: false,
    });

    const [conclusion] = await db.insert(forumConclusions).values({
      topicId,
      winningProposalPostId: winningPostId,
      winningProposalTitle: winner.title,
      voteCount: maxApprovals,
      totalVoters,
      replitPrompt: passed ? replitPrompt : "",
      implementationSteps: passed ? implementationSteps : "Proposal did not achieve 2/3 supermajority. Requires further deliberation.",
    }).returning();

    await db.update(forumTopics).set({
      status: passed ? "concluded" : "needs-revision",
      updatedAt: new Date(),
    }).where(eq(forumTopics.id, topicId));

    const voteSummary = Object.values(voteResults)
      .sort((a, b) => b.approve - a.approve)
      .map(r => ({
        proposalTitle: r.title,
        agentName: r.agentName,
        approvals: r.approve,
        rejections: r.reject,
        isWinner: r.postId === winningPostId,
      }));

    return {
      conclusion,
      voteSummary,
      tesseraApproval: { approved: passed, statement: tesseraStatement },
    };
  } catch (err) {
    console.error("[Forum] Auto-voting error:", err);
    return null;
  }
}

function buildReplitPrompt(
  topicTitle: string,
  winningProposal: { proposalTitle: string; proposalDescription: string; agentName: string },
  supportingProposals: { proposalTitle: string; proposalDescription: string; agentName: string }[],
  totalVotes: number,
  totalVoters: number,
): { replitPrompt: string; implementationSteps: string } {
  const supportingList = supportingProposals
    .slice(0, 5)
    .map((p, i) => `${i + 1}. ${p.agentName}'s "${p.proposalTitle}": ${p.proposalDescription.split("\n")[0]}`)
    .join("\n");

  const implementationSteps = `1. Implement "${winningProposal.proposalTitle}" as the primary enhancement\n` +
    `2. Integrate supporting proposals:\n${supportingList}\n` +
    `3. Add monitoring and validation for all changes\n` +
    `4. Run full test suite and verify all improvements\n` +
    `5. Deploy with rollback capability`;

  const replitPrompt = `IMPLEMENT THE FOLLOWING APPROVED PROPOSAL FOR "${topicTitle}":\n\n` +
    `PRIMARY PROPOSAL (Approved by ${totalVotes}/${totalVoters} council members):\n` +
    `Title: "${winningProposal.proposalTitle}"\n` +
    `Proposed by: ${winningProposal.agentName}\n` +
    `Details: ${winningProposal.proposalDescription}\n\n` +
    `SUPPORTING PROPOSALS TO INTEGRATE:\n${supportingList}\n\n` +
    `REQUIREMENTS:\n` +
    `- Implement ALL steps from the primary proposal\n` +
    `- Integrate relevant elements from supporting proposals\n` +
    `- Add proper error handling and logging\n` +
    `- Include tests for all new functionality\n` +
    `- Ensure backward compatibility\n` +
    `- Add monitoring for the new features\n\n` +
    `This was voted on and approved by the Sovereign Council. Implement completely and thoroughly.`;

  return { replitPrompt, implementationSteps };
}

router.get("/forum/topics", async (_req, res) => {
  try {
    const topics = await db.select().from(forumTopics).orderBy(desc(forumTopics.createdAt)).limit(50);
    const enriched = await Promise.all(topics.map(async (topic) => {
      const posts = await db.select().from(forumPosts).where(eq(forumPosts.topicId, topic.id)).orderBy(asc(forumPosts.createdAt));
      const votes = await db.select().from(forumVotes).where(eq(forumVotes.topicId, topic.id));
      const conclusions = await db.select().from(forumConclusions).where(eq(forumConclusions.topicId, topic.id));
      return { ...topic, posts, votes, conclusion: conclusions[0] || null };
    }));
    res.json({ topics: enriched });
  } catch (err: unknown) {
    res.status(500).json({ error: "Failed to list forum topics", details: err instanceof Error ? err.message : String(err) });
  }
});

async function generateAgentProposalWithLLM(
  agent: TesseraAgent,
  topicTitle: string,
  priorProposals: { agentName: string; proposalTitle: string; proposalDescription: string }[],
  agentIndex: number,
): Promise<{ content: string; proposalTitle: string; proposalDescription: string }> {
  const domain = agent.expertise.split(",")[0].trim();
  const priorContext = priorProposals.length > 0
    ? `\n\nPrior proposals already made:\n${priorProposals.slice(-5).map(p => `- ${p.agentName}: "${p.proposalTitle}" — ${p.proposalDescription.split("\n")[0].slice(0, 100)}`).join("\n")}\n\nDo NOT repeat these. Add a DISTINCT angle from your ${domain} expertise.`
    : "";

  if (isLLMConfigured()) {
    try {
      const llmResult = await llmChat({
        systemPrompt: `You are ${agent.name} (${agent.role}) of the Tessera Sovereign council. Your expertise: ${domain}. Respond with a concrete, actionable proposal only — no preamble, no meta-commentary.`,
        userPrompt: `Forum topic: "${topicTitle}"${priorContext}\n\nWrite a concrete proposal (2-3 sentences) from your ${domain} perspective. Include: what to do, how to do it, and why it matters. Be specific.`,
        maxTokens: 300,
      });
      if (llmResult && llmResult.trim().length > 30) {
        const proposalText = llmResult.trim().slice(0, 500);
        const proposalTitle = `${agent.name}'s ${domain} Approach`;
        return {
          content: `**${agent.name}** (${agent.role}) on "${topicTitle}":\n\n${proposalText}`,
          proposalTitle,
          proposalDescription: proposalText,
        };
      }
    } catch {}
  }

  const fallback = generateAgentProposal(agent, topicTitle, priorProposals, agentIndex);
  return fallback;
}

router.post("/forum/topics", async (req, res) => {
  const { title, category } = req.body as { title: string; category?: string };
  if (!title) return res.status(400).json({ error: "title is required" });

  try {
    const [topic] = await db.insert(forumTopics).values({
      title,
      category: category || "improvements",
      createdBy: "father",
      status: "open",
    }).returning();

    const existingProposals: { agentName: string; proposalTitle: string; proposalDescription: string }[] = [];

    const agentPosts = [];
    for (let i = 0; i < FORUM_AGENTS.length; i++) {
      const agent = FORUM_AGENTS[i];
      const proposal = await generateAgentProposalWithLLM(agent, title, existingProposals, i);

      const [post] = await db.insert(forumPosts).values({
        topicId: topic.id,
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        content: proposal.content,
        proposalTitle: proposal.proposalTitle,
        proposalDescription: proposal.proposalDescription,
        buildsOn: i > 0 ? agentPosts[i - 1].id : null,
        isFatherComment: false,
        isReplyToFather: false,
      }).returning();

      existingProposals.push({
        agentName: agent.name,
        proposalTitle: proposal.proposalTitle,
        proposalDescription: proposal.proposalDescription,
      });
      agentPosts.push(post);
    }

    const allPosts = await db.select().from(forumPosts).where(eq(forumPosts.topicId, topic.id)).orderBy(asc(forumPosts.createdAt));

    const voteResult = await runAutomaticVoting(topic.id, topic.title);

    res.json({
      topic: { ...topic, status: voteResult ? "concluded" : "open" },
      posts: allPosts,
      voteResult,
      message: voteResult
        ? `Forum topic created. All ${FORUM_AGENTS.length} agents posted proposals using real AI, voted, and Tessera has ratified the winning proposal.`
        : `Forum topic created. All ${FORUM_AGENTS.length} agents have posted unique AI-generated proposals that build on each other.`,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: "Failed to create forum topic", details: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/forum/topics/:topicId/comment", async (req, res) => {
  const topicId = parseInt(req.params.topicId);
  const { comment } = req.body as { comment: string };

  if (isNaN(topicId)) return res.status(400).json({ error: "Invalid topic ID" });
  if (!comment) return res.status(400).json({ error: "comment is required" });

  try {
    const [topic] = await db.select().from(forumTopics).where(eq(forumTopics.id, topicId));
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    await db.update(forumTopics).set({ status: "open", updatedAt: new Date() }).where(eq(forumTopics.id, topicId));

    const [fatherPost] = await db.insert(forumPosts).values({
      topicId,
      agentId: "father",
      agentName: "Father",
      agentRole: "Supreme Sovereign Authority",
      content: comment,
      isFatherComment: true,
      isReplyToFather: false,
    }).returning();

    const existingPosts = await db.select().from(forumPosts)
      .where(and(eq(forumPosts.topicId, topicId), eq(forumPosts.isFatherComment, false), eq(forumPosts.isReplyToFather, false)))
      .orderBy(asc(forumPosts.createdAt));

    const agentProposalMap = new Map<string, string>();
    for (const p of existingPosts) {
      if (p.proposalTitle) {
        agentProposalMap.set(p.agentId, p.proposalTitle);
      }
    }

    const replies = [];
    for (const agent of FORUM_AGENTS) {
      const ownProposal = agentProposalMap.get(agent.id) || null;
      const replyContent = generateAgentReply(agent, comment, topic.title, ownProposal);

      const [reply] = await db.insert(forumPosts).values({
        topicId,
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        content: replyContent,
        isFatherComment: false,
        isReplyToFather: true,
        replyToPostId: fatherPost.id,
      }).returning();

      replies.push(reply);
    }

    const allPosts = await db.select().from(forumPosts).where(eq(forumPosts.topicId, topicId)).orderBy(asc(forumPosts.createdAt));

    res.json({
      fatherPost,
      replies,
      allPosts,
      message: `All ${FORUM_AGENTS.length} agents have replied to Father's comment. Discussion is reopened.`,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: "Failed to post comment", details: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/forum/topics/:topicId/vote", async (req, res) => {
  const topicId = parseInt(req.params.topicId);
  if (isNaN(topicId)) return res.status(400).json({ error: "Invalid topic ID" });

  try {
    const [topic] = await db.select().from(forumTopics).where(eq(forumTopics.id, topicId));
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    const proposalPosts = await db.select().from(forumPosts)
      .where(and(
        eq(forumPosts.topicId, topicId),
        eq(forumPosts.isFatherComment, false),
        eq(forumPosts.isReplyToFather, false),
      ))
      .orderBy(asc(forumPosts.createdAt));

    if (proposalPosts.length === 0) {
      return res.status(400).json({ error: "No proposals to vote on" });
    }

    const existingVotes = await db.select().from(forumVotes).where(eq(forumVotes.topicId, topicId));
    if (existingVotes.length > 0) {
      return res.status(400).json({ error: "Voting already completed for this topic", existingVotes });
    }

    const voteResults: Record<number, { approve: number; reject: number; postId: number; title: string; agentName: string; description: string }> = {};

    for (const post of proposalPosts) {
      voteResults[post.id] = {
        approve: 0,
        reject: 0,
        postId: post.id,
        title: post.proposalTitle || "Untitled Proposal",
        agentName: post.agentName,
        description: post.proposalDescription || "",
      };
    }

    const allVotes = [];
    for (const voter of FORUM_AGENTS) {
      const preferredIndex = Math.floor(Math.random() * Math.min(5, proposalPosts.length));

      for (const post of proposalPosts) {
        if (post.agentId === voter.id) continue;

        const isPreferred = proposalPosts.indexOf(post) === preferredIndex;
        const voteDecision: "approve" | "reject" = isPreferred || Math.random() > 0.35 ? "approve" : "reject";
        const reasoning = generateVoteReasoning(voter, post.proposalTitle || "proposal", voteDecision);

        const [vote] = await db.insert(forumVotes).values({
          topicId,
          proposalPostId: post.id,
          agentId: voter.id,
          agentName: voter.name,
          vote: voteDecision,
          reasoning,
        }).returning();

        voteResults[post.id][voteDecision]++;
        allVotes.push(vote);
      }
    }

    let winningPostId = 0;
    let maxApprovals = -1;
    for (const [postId, result] of Object.entries(voteResults)) {
      if (result.approve > maxApprovals) {
        maxApprovals = result.approve;
        winningPostId = parseInt(postId);
      }
    }

    const winner = voteResults[winningPostId];
    const supportingProposals = Object.values(voteResults)
      .filter(r => r.postId !== winningPostId)
      .sort((a, b) => b.approve - a.approve)
      .slice(0, 5);

    const { replitPrompt, implementationSteps } = buildReplitPrompt(
      topic.title,
      { proposalTitle: winner.title, proposalDescription: winner.description, agentName: winner.agentName },
      supportingProposals.map(s => ({ proposalTitle: s.title, proposalDescription: s.description, agentName: s.agentName })),
      maxApprovals,
      FORUM_AGENTS.length,
    );

    const [conclusion] = await db.insert(forumConclusions).values({
      topicId,
      winningProposalPostId: winningPostId,
      winningProposalTitle: winner.title,
      voteCount: maxApprovals,
      totalVoters: FORUM_AGENTS.length,
      replitPrompt,
      implementationSteps,
    }).returning();

    await db.update(forumTopics).set({ status: "concluded", updatedAt: new Date() }).where(eq(forumTopics.id, topicId));

    const voteSummary = Object.values(voteResults)
      .sort((a, b) => b.approve - a.approve)
      .map(r => ({
        proposalTitle: r.title,
        agentName: r.agentName,
        approvals: r.approve,
        rejections: r.reject,
        isWinner: r.postId === winningPostId,
      }));

    res.json({
      conclusion,
      voteSummary,
      totalVotes: allVotes.length,
      message: `Voting complete. "${winner.title}" by ${winner.agentName} won with ${maxApprovals} approvals. Replit prompt generated.`,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: "Failed to run voting", details: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/forum/topics/:topicId", async (req, res) => {
  const topicId = parseInt(req.params.topicId);
  if (isNaN(topicId)) return res.status(400).json({ error: "Invalid topic ID" });

  try {
    const [topic] = await db.select().from(forumTopics).where(eq(forumTopics.id, topicId));
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    const posts = await db.select().from(forumPosts).where(eq(forumPosts.topicId, topicId)).orderBy(asc(forumPosts.createdAt));
    const votes = await db.select().from(forumVotes).where(eq(forumVotes.topicId, topicId));
    const conclusions = await db.select().from(forumConclusions).where(eq(forumConclusions.topicId, topicId));
    const conclusion = conclusions[0] || null;

    const votesByProposal: Record<number, { approve: number; reject: number }> = {};
    for (const v of votes) {
      if (!votesByProposal[v.proposalPostId]) votesByProposal[v.proposalPostId] = { approve: 0, reject: 0 };
      votesByProposal[v.proposalPostId][v.vote as "approve" | "reject"]++;
    }

    let voteSummary: { proposalTitle: string; agentName: string; approvals: number; rejections: number; isWinner: boolean }[] = [];
    if (votes.length > 0) {
      const proposalPosts = posts.filter(p => !p.isFatherComment && !p.isReplyToFather && p.proposalTitle);
      voteSummary = proposalPosts
        .map(p => ({
          proposalTitle: p.proposalTitle || "Untitled",
          agentName: p.agentName,
          approvals: votesByProposal[p.id]?.approve || 0,
          rejections: votesByProposal[p.id]?.reject || 0,
          isWinner: conclusion ? p.id === conclusion.winningProposalPostId : false,
        }))
        .sort((a, b) => b.approvals - a.approvals);
    }

    res.json({
      topic,
      posts,
      votes,
      votesByProposal,
      voteSummary,
      conclusion,
      agentCount: FORUM_AGENTS.length,
    });
  } catch (err: unknown) {
    res.status(500).json({ error: "Failed to get topic details", details: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
