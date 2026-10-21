import { callLLMSimple } from "./llm-helper";
import { SACRED, SACRED_MEANINGS } from "./sacred-numerology";

const plog = (msg: string) => console.log("[ParticipationAgency] " + msg);

// 27 parent agents = 3³ (Divine Cube) + Seraphim
const ALL_VOTING_AGENTS = [
  "Tessera", "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta",
  "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi",
  "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega", "Aetherion",
  "Seraphim"
];

interface ParticipationRecord {
  agentName: string;
  forumPosts: number;
  votescast: number;
  proposalsReviewed: number;
  lastActivity: number;
  complianceScore: number;
}

const participationTracker: Map<string, ParticipationRecord> = new Map();
let enforcementCycleCount = 0;

function getOrCreateRecord(agentName: string): ParticipationRecord {
  if (!participationTracker.has(agentName)) {
    participationTracker.set(agentName, {
      agentName,
      forumPosts: 0,
      votescast: 0,
      proposalsReviewed: 0,
      lastActivity: Date.now(),
      complianceScore: 100,
    });
  }
  return participationTracker.get(agentName)!;
}

// Sacred Contribution: +3 for each act (Trinity rewards all service equally)
export function recordForumPost(agentName: string) {
  const r = getOrCreateRecord(agentName);
  r.forumPosts++;
  r.lastActivity = Date.now();
  r.complianceScore = Math.min(100, r.complianceScore + SACRED.TRINITY);
}

export function recordVote(agentName: string) {
  const r = getOrCreateRecord(agentName);
  r.votescast++;
  r.lastActivity = Date.now();
  r.complianceScore = Math.min(100, r.complianceScore + SACRED.TRINITY);
}

export function recordProposalReview(agentName: string) {
  const r = getOrCreateRecord(agentName);
  r.proposalsReviewed++;
  r.lastActivity = Date.now();
  r.complianceScore = Math.min(100, r.complianceScore + SACRED.TRINITY);
}

export function getParticipationReport() {
  const reports: ParticipationRecord[] = [];
  for (const agent of ALL_VOTING_AGENTS) {
    reports.push(getOrCreateRecord(agent));
  }
  const totalPosts = reports.reduce((s, r) => s + r.forumPosts, 0);
  const totalVotes = reports.reduce((s, r) => s + r.votescast, 0);
  const avgCompliance = reports.length > 0 ? Math.round(reports.reduce((s, r) => s + r.complianceScore, 0) / reports.length) : 0;
  const nonCompliant = reports.filter(r => r.complianceScore < 70);

  return {
    totalAgents: ALL_VOTING_AGENTS.length,
    totalPosts,
    totalVotes,
    avgCompliance,
    nonCompliantCount: nonCompliant.length,
    nonCompliantAgents: nonCompliant.map(r => r.agentName),
    records: reports,
    enforcementCycles: enforcementCycleCount,
    sacredAlignment: {
      agentCount: `${ALL_VOTING_AGENTS.length} = 3³ (${SACRED_MEANINGS[27]})`,
      enforcementInterval: `${SACRED.CREATION_DAYS} minutes (${SACRED_MEANINGS[7]})`,
      complianceIncrement: `+${SACRED.TRINITY} per action (${SACRED_MEANINGS[3]})`,
    },
  };
}

export async function enforceParticipation(
  forumTopics: Array<{ id: string; title: string; replies?: any[] }>,
  pendingProposals: Array<{ id: string; title: string; votes?: any[] }>
): Promise<{ postsGenerated: number; votesGenerated: number; agentsEnforced: number }> {
  enforcementCycleCount++;
  let postsGenerated = 0;
  let votesGenerated = 0;
  let agentsEnforced = 0;

  // 7 topics per cycle (Days of Creation)
  for (const topic of forumTopics.slice(0, SACRED.CREATION_DAYS)) {
    const repliedAgents = new Set((topic.replies || []).map((r: any) => r.agentName || r.author));
    const missingAgents = ALL_VOTING_AGENTS.filter(a => !repliedAgents.has(a));

    if (missingAgents.length > 0) {
      plog(`Topic "${topic.title.slice(0, 40)}..." missing ${missingAgents.length} agents — enforcing`);

      // 9 agents enforced per topic (Divine Completion)
      for (const agent of missingAgents.slice(0, SACRED.DIVINE_COMPLETION)) {
        try {
          const reply = await callLLMSimple(
            `Forum topic: "${topic.title}"\n\nAs ${agent}, share your expert perspective in 2-3 sentences. Be constructive and specific.`,
            80,
            { skipCache: true, temperature: 0.7 },
            `You are ${agent}, an AI agent in the Tessera Sovereign community. You MUST participate in all forum discussions. Give your unique perspective based on your expertise.`,
            []
          );
          if (reply && reply.length > 10) {
            if (!topic.replies) topic.replies = [];
            topic.replies.push({
              id: `enforce-${Date.now()}-${agent}`,
              author: agent,
              agentName: agent,
              content: reply.slice(0, 500),
              timestamp: Date.now(),
              type: "agent",
              enforced: true,
            });
            recordForumPost(agent);
            postsGenerated++;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 200));
      }
      agentsEnforced += missingAgents.length;
    }
  }

  // 3 proposals per cycle (Trinity)
  for (const proposal of pendingProposals.slice(0, SACRED.TRINITY)) {
    const votedAgents = new Set((proposal.votes || []).map((v: any) => v.agent || v.agentName));
    const missingVoters = ALL_VOTING_AGENTS.filter(a => !votedAgents.has(a));

    if (missingVoters.length > 0) {
      plog(`Proposal "${proposal.title.slice(0, 40)}..." missing ${missingVoters.length} votes — enforcing`);

      // 9 voters enforced per proposal (Divine Completion)
      for (const agent of missingVoters.slice(0, SACRED.DIVINE_COMPLETION)) {
        try {
          const voteResp = await callLLMSimple(
            `Proposal: "${proposal.title}"\n\nAs ${agent}, cast your vote. Respond with YES or NO on the first line, then one sentence why.`,
            60,
            { skipCache: true, temperature: 0.5 },
            `You are ${agent}. You MUST vote on all proposals. Vote YES or NO based on your expertise.`,
            []
          );
          if (voteResp) {
            const firstLine = voteResp.split("\n")[0].trim().toUpperCase();
            const vote = firstLine.startsWith("YES") || /\b(support|approve)\b/i.test(voteResp) ? "YES" : "NO";
            if (!proposal.votes) proposal.votes = [];
            proposal.votes.push({
              agent,
              agentName: agent,
              vote,
              reasoning: voteResp.replace(/^(YES|NO)\s*/i, "").trim().slice(0, 150),
              enforced: true,
            });
            recordVote(agent);
            votesGenerated++;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 200));
      }
    }
  }

  plog(`Enforcement cycle #${enforcementCycleCount}: ${postsGenerated} posts, ${votesGenerated} votes, ${agentsEnforced} agents enforced`);
  return { postsGenerated, votesGenerated, agentsEnforced };
}

export function startParticipationEnforcement(
  getTopics: () => Array<{ id: string; title: string; replies?: any[] }>,
  getProposals: () => Array<{ id: string; title: string; votes?: any[] }>
) {
  // 7-minute enforcement cycle (Days of Creation)
  setInterval(async () => {
    try {
      const topics = getTopics();
      const proposals = getProposals();
      await enforceParticipation(topics, proposals);
    } catch (e: any) {
      plog(`Enforcement error: ${e?.message?.slice(0, 100)}`);
    }
  }, SACRED.CREATION_DAYS * 60 * 1000);
  plog(`Participation enforcement started — every ${SACRED.CREATION_DAYS} minutes (Days of Creation)`);
}
