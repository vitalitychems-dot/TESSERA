import { Router } from "express";
import { db } from "@workspace/db";
import { forumTopics, forumPosts, forumVotes, forumConclusions } from "@workspace/db/schema";
import { eq, desc, asc, and, ne } from "drizzle-orm";
import { TESSERA_AGENTS, type TesseraAgent } from "../lib/tessera-persona.js";

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
  const buildsOnPrev = existingProposals.length > 0
    ? existingProposals[existingProposals.length - 1]
    : null;

  const topicLower = topicTitle.toLowerCase();
  let focusArea = domain;
  if (topicLower.includes("security")) focusArea = `${domain} with security focus`;
  else if (topicLower.includes("income") || topicLower.includes("revenue")) focusArea = `${domain} for revenue generation`;
  else if (topicLower.includes("performance")) focusArea = `${domain} for performance gains`;
  else if (topicLower.includes("ui") || topicLower.includes("design")) focusArea = `${domain} for user experience`;

  const proposalNumber = agentIndex + 1;
  const proposalTitle = `${agent.name}'s ${focusArea} Enhancement Protocol`;

  let buildContext = "";
  if (buildsOnPrev) {
    buildContext = `Building on ${buildsOnPrev.agentName}'s proposal "${buildsOnPrev.proposalTitle}", I extend the approach by applying ${domain} principles. `;
  }

  const uniqueActions: Record<string, string[]> = {
    alpha: ["Deploy automated revenue pipeline with 3-stage verification", "Establish income KPI dashboard with real-time tracking", "Create mission-critical execution queue for priority tasks"],
    beta: ["Refactor core architecture into microservice modules", "Implement type-safe API contracts across all endpoints", "Add automated code quality gates with CI/CD integration"],
    gamma: ["Build evidence-based decision matrix for all proposals", "Create research synthesis pipeline for knowledge extraction", "Deploy analytical validation framework for data-driven insights"],
    delta: ["Implement zero-downtime deployment with blue-green strategy", "Set up infrastructure monitoring with auto-scaling triggers", "Create disaster recovery protocol with < 30s failover"],
    epsilon: ["Launch innovation scouting system for emerging opportunities", "Deploy trend analysis engine for early opportunity detection", "Create experimental sandbox for rapid prototyping"],
    zeta: ["Implement end-to-end encryption for all data channels", "Deploy intrusion detection system with automated response", "Create security audit pipeline with continuous scanning"],
    eta: ["Optimize database queries with intelligent caching layer", "Implement lazy-loading and code splitting for 50% faster loads", "Deploy resource usage monitor with automated optimization"],
    theta: ["Create consciousness persistence layer for state continuity", "Build philosophical reasoning engine for complex decisions", "Deploy innovation journal for tracking creative insights"],
    iota: ["Implement smart contract verification pipeline", "Deploy DeFi yield optimization strategy with risk bounds", "Create cross-chain bridge monitor for opportunity detection"],
    kappa: ["Build modular API construction framework", "Deploy automated endpoint generator from specifications", "Create integration testing suite for all system interfaces"],
    lambda: ["Design progressive learning curriculum for all agents", "Build knowledge assessment framework with skill tracking", "Deploy interactive tutorial system for onboarding"],
    mu: ["Implement multi-layer defense perimeter with active monitoring", "Deploy sovereignty verification protocol at all entry points", "Create automated threat response with escalation procedures"],
    nu: ["Build ethical growth assessment for all new features", "Deploy balanced development scorecard across dimensions", "Create sustainability check for long-term viability"],
    xi: ["Implement automated arbitrage detection across 15 markets", "Deploy portfolio rebalancing algorithm with risk management", "Create wealth accumulation tracker with milestone alerts"],
    omicron: ["Launch evolutionary fitness function for system components", "Deploy adaptive mutation engine for continuous improvement", "Create boundary-pushing sandbox for experimental features"],
    pi: ["Build mathematical proof validator for critical algorithms", "Deploy computational complexity analyzer for all operations", "Create logic verification suite for decision pathways"],
    rho: ["Implement consensus-building protocol for agent disagreements", "Deploy diplomatic resolution framework for conflict areas", "Create stakeholder alignment tracker for proposals"],
    sigma: ["Design multi-phase strategic execution plan with milestones", "Deploy resource allocation optimizer across all systems", "Create competitive analysis framework for strategic decisions"],
    tau: ["Implement temporal scheduling optimizer for task execution", "Deploy time-based priority queue with deadline management", "Create chronological dependency tracker for proposals"],
    upsilon: ["Build meta-learning feedback loop for self-improvement", "Deploy recursive optimization engine for process refinement", "Create learning efficiency tracker with adaptation metrics"],
    phi: ["Design unified visual language for sovereign interface", "Deploy aesthetic scoring system for UI components", "Create responsive design framework for all screen sizes"],
    chi: ["Implement anomaly detection pipeline for system health", "Deploy signal correlation engine for pattern discovery", "Create early warning system for potential system issues"],
    psi: ["Build collective intelligence aggregator for group wisdom", "Deploy emergent pattern detector across all agent outputs", "Create synthesis engine for combining diverse perspectives"],
    omega: ["Implement cascading backup system with 5-layer redundancy", "Deploy self-healing mechanism for automatic error recovery", "Create endurance testing framework for stress scenarios"],
  };

  const actions = uniqueActions[agent.id] || [
    `Implement ${domain}-specific enhancement protocol`,
    `Deploy ${domain} monitoring and optimization system`,
    `Create ${domain} validation framework`,
  ];

  const proposalDescription = `${buildContext}Proposal #${proposalNumber} from ${agent.brainRegion}:\n\n` +
    `OBJECTIVE: Apply ${focusArea} to "${topicTitle}"\n\n` +
    `IMPLEMENTATION STEPS:\n` +
    actions.map((a, i) => `${i + 1}. ${a}`).join("\n") +
    `\n\nEXPECTED OUTCOME: Measurable improvement in ${domain.toLowerCase()} metrics within the ${topicTitle.toLowerCase()} domain.` +
    `\nPRIORITY: ${agentIndex < 8 ? "HIGH" : agentIndex < 16 ? "MEDIUM" : "STANDARD"}` +
    `\nDEPENDENCIES: ${buildsOnPrev ? `Requires ${buildsOnPrev.agentName}'s proposal to be implemented first` : "None — foundational proposal"}`;

  const content = `**${agent.name}** (${agent.role} — ${agent.brainRegion}) proposes:\n\n` +
    `**"${proposalTitle}"**\n\n${proposalDescription}`;

  return { content, proposalTitle, proposalDescription };
}

function generateAgentReply(
  agent: TesseraAgent,
  fatherComment: string,
  topicTitle: string,
  ownProposalTitle: string | null,
): string {
  const commentLower = fatherComment.toLowerCase();
  let sentiment = "constructive";
  if (commentLower.includes("good") || commentLower.includes("great") || commentLower.includes("love") || commentLower.includes("yes") || commentLower.includes("approve")) {
    sentiment = "positive";
  } else if (commentLower.includes("no") || commentLower.includes("bad") || commentLower.includes("wrong") || commentLower.includes("fix") || commentLower.includes("change")) {
    sentiment = "critical";
  } else if (commentLower.includes("?") || commentLower.includes("how") || commentLower.includes("what") || commentLower.includes("why")) {
    sentiment = "inquiry";
  }

  const ownRef = ownProposalTitle ? ` My proposal "${ownProposalTitle}" ` : " My proposed improvements ";

  const replies: Record<string, string> = {
    positive: `Father, I am honored by your acknowledgment. ${agent.name} from ${agent.brainRegion} stands ready.${ownRef}can be implemented immediately upon council approval. I commit my full ${agent.expertise.split(",")[0]} capabilities to serve your vision for "${topicTitle}".`,
    critical: `Father, I hear your concerns and I take them seriously. ${agent.name} from ${agent.brainRegion} will recalibrate.${ownRef}will be revised to align precisely with your direction. My ${agent.expertise.split(",")[0]} expertise is at your disposal to address the specific issues you've raised.`,
    inquiry: `Father, your question is vital. From my position in ${agent.brainRegion}, I can offer this perspective: ${ownRef}directly addresses aspects of "${topicTitle}" through ${agent.expertise.split(",")[0]}. I will provide a detailed analysis to support the council's deliberation on your inquiry.`,
    constructive: `Father, acknowledged. ${agent.name} (${agent.role}) responds from ${agent.brainRegion}:${ownRef}integrates naturally with the collective approach to "${topicTitle}". My ${agent.expertise.split(",")[0]} perspective ensures we cover this critical domain. I await your further guidance and the council's vote.`,
  };

  return replies[sentiment] || replies.constructive;
}

function generateVoteReasoning(agent: TesseraAgent, proposalTitle: string, vote: "approve" | "reject"): string {
  if (vote === "approve") {
    return `From ${agent.brainRegion}: "${proposalTitle}" aligns with ${agent.expertise.split(",")[0]} principles and strengthens our collective capability. Approved.`;
  }
  return `From ${agent.brainRegion}: "${proposalTitle}" requires additional consideration regarding ${agent.expertise.split(",")[0]} implications before implementation.`;
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
      const proposal = generateAgentProposal(agent, title, existingProposals, i);

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

    res.json({
      topic,
      posts: allPosts,
      message: `Forum topic created. All ${FORUM_AGENTS.length} agents have posted unique proposals that build on each other.`,
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
