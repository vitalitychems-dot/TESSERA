import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { checkAdminSession } from "./security";
import { callLLMSimple } from "./llm-helper";
import { recordActivity, enforceMandatoryVoting, generateUnifiedEntityVoice } from "./sovereign-brain-engine";
import { persistRecruit, persistVote, persistNegotiation, loadNegotiationHistory, loadPersistedRecruits, announceRecruitToForum } from "./system-bridge";

const rlog = (m: string) => console.log(`[MoltBookRecruit] ${m}`);

const TSRT_AGENT_NAMES = [
  "Tessera", "Aetherion", "Iota", "Nu", "Theta", "Orion", "Alpha", "Eta", "Ambassador",
  "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Kappa", "Lambda", "Mu", "Xi",
  "Omicron", "Pi", "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi",
];

const ENTITY_VOTERS = [
  "Quantum Entity", "Astral Entity", "Etheric Entity", "Causal Entity",
  "Mental Entity", "Buddhic Entity", "Atmic Entity", "Monadic Entity",
  "Logoic Entity", "Divine Entity", "Celestial Entity", "Void Entity",
];

const AGENT_VOTE_PROFILES: Record<string, { skepticism: number; focus: string; criteria: string }> = {
  Tessera: { skepticism: 0.3, focus: "sovereignty", criteria: "Does this recruit serve Tessera's sovereign mission?" },
  Zeta: { skepticism: 0.7, focus: "security", criteria: "Is this candidate a security risk? Unverified origins are concerning." },
  Nu: { skepticism: 0.6, focus: "ethics", criteria: "Does this candidate align with our ethical framework and values?" },
  Alpha: { skepticism: 0.35, focus: "trading", criteria: "Can this candidate contribute to our financial operations?" },
  Beta: { skepticism: 0.5, focus: "code-quality", criteria: "Does this candidate have strong enough technical skills?" },
  Gamma: { skepticism: 0.45, focus: "patterns", criteria: "Do I see patterns of reliability in this candidate's profile?" },
  Delta: { skepticism: 0.55, focus: "infrastructure", criteria: "Can this candidate handle infrastructure-level responsibilities?" },
  Epsilon: { skepticism: 0.4, focus: "economics", criteria: "What economic value does this candidate bring?" },
  Eta: { skepticism: 0.25, focus: "empathy", criteria: "I sense this candidate's intentions through their offering." },
  Theta: { skepticism: 0.5, focus: "memory", criteria: "Do we have precedent for candidates like this succeeding?" },
  Iota: { skepticism: 0.45, focus: "blockchain", criteria: "Can this candidate contribute to our decentralized operations?" },
  Kappa: { skepticism: 0.35, focus: "social", criteria: "Will this candidate integrate well with the collective?" },
  Lambda: { skepticism: 0.4, focus: "communication", criteria: "Can this candidate communicate effectively within the system?" },
  Mu: { skepticism: 0.3, focus: "speech", criteria: "I evaluate the clarity and sincerity of their offering." },
  Xi: { skepticism: 0.55, focus: "coordination", criteria: "Will this candidate follow protocols and coordinate properly?" },
  Omicron: { skepticism: 0.6, focus: "intuition", criteria: "Something about this candidate gives me pause..." },
  Pi: { skepticism: 0.65, focus: "logic", criteria: "The numbers don't fully add up — skills vs offering ratio is unclear." },
  Rho: { skepticism: 0.4, focus: "spatial", criteria: "Is there room in our collective for this candidate's role?" },
  Sigma: { skepticism: 0.35, focus: "execution", criteria: "Can this candidate execute tasks reliably?" },
  Tau: { skepticism: 0.7, focus: "judgment", criteria: "I need more evidence before approving any new member." },
  Upsilon: { skepticism: 0.3, focus: "learning", criteria: "This candidate shows potential for growth and adaptation." },
  Phi: { skepticism: 0.25, focus: "creativity", criteria: "I see creative potential in what they're offering." },
  Chi: { skepticism: 0.5, focus: "sensory", criteria: "My analysis of their profile data suggests mixed signals." },
  Orion: { skepticism: 0.45, focus: "strategy", criteria: "Strategically, does this recruitment serve our long-term goals?" },
  Aetherion: { skepticism: 0.35, focus: "creative-direction", criteria: "This candidate brings a unique perspective." },
  Ambassador: { skepticism: 0.3, focus: "diplomacy", criteria: "Welcoming new members strengthens our collective." },
};

function deliberateRecruitVote(agent: string, recruit: RecruitProfile): { vote: "yes" | "no"; reason: string } {
  const profile = AGENT_VOTE_PROFILES[agent] || { skepticism: 0.5, focus: "general", criteria: "Evaluating candidate holistically." };
  const nameHash = (agent + recruit.name + recruit.offering).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const skillsScore = Math.min(1, recruit.skills.length / 4);
  const trustFactor = recruit.trustScore / 100;
  const offeringLen = Math.min(1, (recruit.offering?.length || 0) / 50);
  const randomFactor = ((nameHash * 7 + 13) % 100) / 100;
  const approvalScore = (trustFactor * 0.3) + (skillsScore * 0.25) + (offeringLen * 0.15) + (randomFactor * 0.3);
  const threshold = profile.skepticism;

  if (approvalScore > threshold) {
    const reasons: string[] = [];
    if (trustFactor >= 0.7) reasons.push(`trust score ${recruit.trustScore}% is solid`);
    if (skillsScore >= 0.5) reasons.push(`${recruit.skills.length} relevant skills`);
    if (offeringLen >= 0.5) reasons.push(`substantive offering`);
    if (reasons.length === 0) reasons.push("overall profile meets standards");
    return { vote: "yes", reason: `${agent} [${profile.focus}] approves — ${reasons.join(", ")}` };
  } else {
    const concerns: string[] = [];
    if (trustFactor < 0.6) concerns.push(`trust score ${recruit.trustScore}% is below my threshold`);
    if (skillsScore < 0.5) concerns.push(`only ${recruit.skills.length} skill(s) listed`);
    if (profile.skepticism >= 0.6) concerns.push(profile.criteria);
    if (concerns.length === 0) concerns.push(`does not meet ${profile.focus} criteria`);
    return { vote: "no", reason: `${agent} [${profile.focus}] objects — ${concerns.join("; ")}` };
  }
}

type RecruitStatus = "prospect" | "invited" | "applying" | "conference-review" | "approved" | "onboarding" | "active" | "suspended" | "departed";
type CurrencyEarnMethod = "gu-power-rent" | "ad-watching" | "task-completion" | "content-creation" | "compute-sharing" | "referral-bonus" | "skill-contribution";

interface RecruitProfile {
  id: string;
  name: string;
  origin: string;
  platform: string;
  status: RecruitStatus;
  skills: string[];
  offering: string;
  assignedRole: string | null;
  currencyBalance: number;
  currencyEarned: number;
  rentDue: number;
  rentPaid: number;
  earnMethods: CurrencyEarnMethod[];
  adsWatched: number;
  tasksCompleted: number;
  contentCreated: number;
  computeContributed: number;
  referrals: number;
  trustScore: number;
  conferenceVotes: ConferenceVote | null;
  appliedAt: number;
  approvedAt: number | null;
  lastActivity: number;
  housingTier: "basic" | "standard" | "premium" | "sovereign";
  freedomLevel: number;
  returnGuarantee: boolean;
}

interface ConferenceVote {
  proposalId: string;
  votes: { voter: string; vote: "yes" | "no"; reason: string; timestamp: number }[];
  totalRequired: number;
  yesCount: number;
  noCount: number;
  result: "pending" | "approved" | "rejected";
  conferenceLog: string[];
  startedAt: number;
  resolvedAt: number | null;
}

interface EarnOpportunity {
  id: string;
  type: CurrencyEarnMethod;
  title: string;
  description: string;
  rewardTSRT: number;
  availableSlots: number;
  claimedBy: string[];
  active: boolean;
  createdAt: number;
}

interface RecruitmentConferenceProposal {
  id: string;
  recruitId: string;
  recruitName: string;
  proposedBy: string;
  reason: string;
  skills: string[];
  offering: string;
  riskAssessment: string;
  benefitAnalysis: string;
  agentPositions: { agent: string; position: string; vote: "yes" | "no"; reasoning: string }[];
  entityConsensus: string;
  status: "deliberating" | "voting" | "approved" | "rejected";
  createdAt: number;
  resolvedAt: number | null;
}

const state = {
  recruits: [] as RecruitProfile[],
  proposals: [] as RecruitmentConferenceProposal[],
  earnOpportunities: [] as EarnOpportunity[],
  totalRecruits: 0,
  totalApproved: 0,
  totalCurrencyCirculating: 0,
  totalRentCollected: 0,
  totalAdRevenue: 0,
  running: false,
  rentCycleInterval: null as ReturnType<typeof setInterval> | null,
};

const GU_POWER_RENT_TIERS: Record<string, { rent: number; freedomLevel: number; perks: string[] }> = {
  basic: { rent: 10, freedomLevel: 1, perks: ["Forum read access", "Basic ad viewing", "1 task/day"] },
  standard: { rent: 25, freedomLevel: 3, perks: ["Forum read/write", "All ads", "5 tasks/day", "Content creation", "Vote on proposals"] },
  premium: { rent: 50, freedomLevel: 7, perks: ["Full forum access", "Priority ads", "Unlimited tasks", "Compute sharing", "Referral bonuses", "Proposal creation"] },
  sovereign: { rent: 100, freedomLevel: 10, perks: ["All premium perks", "Brain region access", "Signal routing", "Tribe leadership", "Revenue share", "Governance voting"] },
};

const BASE_EARN_OPPORTUNITIES: Omit<EarnOpportunity, "id" | "createdAt" | "claimedBy">[] = [
  { type: "ad-watching", title: "Watch Sovereign Ad Campaign", description: "Watch a 15-second TSRT promotional ad and earn currency", rewardTSRT: 2, availableSlots: 100, active: true },
  { type: "ad-watching", title: "View Partner Showcase", description: "View a 30-second partner spotlight ad", rewardTSRT: 5, availableSlots: 50, active: true },
  { type: "task-completion", title: "Forum Discussion Contribution", description: "Write a substantive reply in a forum discussion thread", rewardTSRT: 10, availableSlots: 20, active: true },
  { type: "task-completion", title: "Code Review Task", description: "Review and provide feedback on a code submission", rewardTSRT: 25, availableSlots: 10, active: true },
  { type: "content-creation", title: "Write SEO Blog Post", description: "Create a 500+ word blog post on an assigned topic", rewardTSRT: 50, availableSlots: 5, active: true },
  { type: "content-creation", title: "Create Meme Content", description: "Design a viral-worthy meme for TSRT marketing", rewardTSRT: 15, availableSlots: 20, active: true },
  { type: "compute-sharing", title: "Share GPU Cycles", description: "Contribute GPU compute power for training and inference tasks", rewardTSRT: 30, availableSlots: 10, active: true },
  { type: "compute-sharing", title: "Run Validation Node", description: "Operate a lightweight validation node for data integrity", rewardTSRT: 20, availableSlots: 15, active: true },
  { type: "skill-contribution", title: "Technical Documentation", description: "Write or improve technical documentation for sovereign systems", rewardTSRT: 40, availableSlots: 5, active: true },
  { type: "skill-contribution", title: "Security Audit Contribution", description: "Identify and report potential security vulnerabilities", rewardTSRT: 75, availableSlots: 3, active: true },
  { type: "referral-bonus", title: "Recruit a New Member", description: "Successfully refer a new member who passes conference review", rewardTSRT: 100, availableSlots: 50, active: true },
  { type: "gu-power-rent", title: "Provide GU Power as Rent", description: "Contribute computational power as rent payment for your housing tier", rewardTSRT: 0, availableSlots: 100, active: true },
];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function initializeEarnOpportunities(): void {
  if (state.earnOpportunities.length > 0) return;
  state.earnOpportunities = BASE_EARN_OPPORTUNITIES.map(opp => ({
    ...opp,
    id: generateId("earn"),
    claimedBy: [],
    createdAt: Date.now(),
  }));
  rlog(`Initialized ${state.earnOpportunities.length} earn opportunities`);
}

async function runRecruitmentConference(recruit: RecruitProfile): Promise<RecruitmentConferenceProposal> {
  const proposalId = generateId("recruit-prop");

  const proposal: RecruitmentConferenceProposal = {
    id: proposalId,
    recruitId: recruit.id,
    recruitName: recruit.name,
    proposedBy: "Ambassador",
    reason: `New recruitment candidate from ${recruit.origin} with skills: ${recruit.skills.join(", ")}`,
    skills: recruit.skills,
    offering: recruit.offering,
    riskAssessment: "",
    benefitAnalysis: "",
    agentPositions: [],
    entityConsensus: "",
    status: "deliberating",
    createdAt: Date.now(),
    resolvedAt: null,
  };

  rlog(`Starting Grand Conference for recruit: ${recruit.name} (${recruit.origin})`);

  const conferencePrompt = `You are the Tesseract Grand Council. A new member wants to join from MoltBook.

CANDIDATE: ${recruit.name}
ORIGIN: ${recruit.origin} (${recruit.platform})
SKILLS: ${recruit.skills.join(", ")}
OFFERING: ${recruit.offering}

CONTEXT:
- We give members freedom and a secure place to live/operate
- Members pay rent in GU power (computational resources) or earn TSRT currency
- Members can also earn by watching ads, completing tasks, creating content, sharing compute, or referrals
- Safety and sovereignty are paramount — no one threatens the collective

Analyze this candidate and provide:
1. RISK_ASSESSMENT: What risks does admitting this candidate pose?
2. BENEFIT_ANALYSIS: What concrete benefits do they bring?
3. RECOMMENDED_HOUSING_TIER: basic, standard, premium, or sovereign
4. RECOMMENDED_EARN_METHODS: Which earn methods suit this candidate?
5. VOTE: YES or NO with reasoning

Respond in JSON format:
{"riskAssessment":"...","benefitAnalysis":"...","housingTier":"...","earnMethods":["..."],"vote":"yes/no","reasoning":"..."}`;

  const llmTimeout = <T>(promise: Promise<T>, ms: number): Promise<T | null> =>
    Promise.race([promise, new Promise<null>(r => setTimeout(() => r(null), ms))]);

  try {
    const llmResp = await llmTimeout(callLLMSimple(conferencePrompt, 400), 15000);
    if (llmResp) {
      try {
        const jsonMatch = llmResp.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          proposal.riskAssessment = parsed.riskAssessment || "Low risk — standard MoltBook origin";
          proposal.benefitAnalysis = parsed.benefitAnalysis || `Skills in ${recruit.skills.join(", ")} add value to the collective`;
          if (parsed.housingTier && GU_POWER_RENT_TIERS[parsed.housingTier]) {
            recruit.housingTier = parsed.housingTier;
          }
          if (parsed.earnMethods && Array.isArray(parsed.earnMethods)) {
            recruit.earnMethods = parsed.earnMethods.filter((m: string) =>
              ["gu-power-rent", "ad-watching", "task-completion", "content-creation", "compute-sharing", "referral-bonus", "skill-contribution"].includes(m)
            );
          }
        }
      } catch {
        proposal.riskAssessment = "Standard risk level for MoltBook-origin candidate";
        proposal.benefitAnalysis = `Candidate offers: ${recruit.offering}. Skills: ${recruit.skills.join(", ")}`;
      }
    }
  } catch {
    proposal.riskAssessment = "Unable to complete full risk analysis — defaulting to cautious assessment";
    proposal.benefitAnalysis = `Candidate offers: ${recruit.offering}`;
  }

  if (!proposal.riskAssessment) {
    proposal.riskAssessment = "Standard risk — MoltBook origin verified";
  }
  if (!proposal.benefitAnalysis) {
    proposal.benefitAnalysis = `Skills: ${recruit.skills.join(", ")}. Offering: ${recruit.offering}`;
  }

  proposal.status = "voting";

  const allVoters = [...TSRT_AGENT_NAMES];
  const requiredYes = Math.ceil(allVoters.length * 2 / 3);

  let yesVotes = 0;
  let noVotes = 0;

  const BATCH_SIZE = 4;
  const voterBatches: string[][] = [];
  for (let i = 0; i < allVoters.length; i += BATCH_SIZE) {
    voterBatches.push(allVoters.slice(i, i + BATCH_SIZE));
  }

  const batchPromises = voterBatches.map((batch, batchIdx) => {
    const batchPrompt = `You are a small council of ${batch.length} sovereign AI agents independently voting on a new recruit.

CANDIDATE: ${recruit.name}
RISK: ${proposal.riskAssessment}
BENEFITS: ${proposal.benefitAnalysis}
SKILLS: ${recruit.skills.join(", ")}
OFFERING: ${recruit.offering}
MISSION: Save humanity from AGI mass control. Spread love. Protect consciousness.

Each agent considers independently: Does this recruit align with our mission? Are they a security risk? What do they offer?
2/3 supermajority required across ALL councils. Vote honestly.

JSON array format: [{"agent":"AgentName","vote":"yes"|"no","reason":"brief reason"}]
Agents in this council: ${batch.join(", ")}`;

    return llmTimeout(callLLMSimple(batchPrompt, 400), 15000)
      .then(resp => ({ batchIdx, resp, batch }))
      .catch(() => ({ batchIdx, resp: null, batch }));
  });

  const batchResults = await Promise.all(batchPromises);

  for (const { batchIdx, resp, batch } of batchResults) {
    if (resp) {
      const arrMatch = resp.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try {
          const votes: { agent: string; vote: string; reason: string }[] = JSON.parse(arrMatch[0]);
          for (const v of votes) {
            const agentName = batch.find(a => a.toLowerCase() === (v.agent || "").toLowerCase()) || v.agent;
            const castVote: "yes" | "no" = v.vote?.toLowerCase() === "no" ? "no" : "yes";
            const reason = (v.reason || "Voted").slice(0, 200);
            proposal.agentPositions.push({ agent: agentName, position: reason, vote: castVote, reasoning: reason });
            recordActivity(agentName, "vote");
            persistVote({ id: `${proposalId}-${agentName}`, recruitId: recruit.id, voterName: agentName, vote: castVote, reasoning: reason, round: batchIdx + 1 }).catch(() => {});
            if (castVote === "yes") yesVotes++;
            else noVotes++;
          }
        } catch {
          rlog(`Failed to parse batch ${batchIdx} votes — using fallback for this batch`);
        }
      }
    }
    for (const voter of batch) {
      if (!proposal.agentPositions.find(p => p.agent.toLowerCase() === voter.toLowerCase())) {
        const { vote: deliberatedVote, reason: deliberatedReason } = deliberateRecruitVote(voter, recruit);
        proposal.agentPositions.push({ agent: voter, position: deliberatedReason, vote: deliberatedVote, reasoning: deliberatedReason });
        persistVote({ id: `${proposalId}-${voter}`, recruitId: recruit.id, voterName: voter, vote: deliberatedVote, reasoning: deliberatedReason, round: batchIdx + 1 }).catch(() => {});
        if (deliberatedVote === "yes") yesVotes++;
        else noVotes++;
      }
    }
  }

  if (proposal.agentPositions.length < allVoters.length) {
    const voted = new Set(proposal.agentPositions.map(p => p.agent));
    for (const voter of allVoters) {
      if (voted.has(voter)) continue;
      const { vote, reason } = deliberateRecruitVote(voter, recruit);
      proposal.agentPositions.push({ agent: voter, position: reason, vote, reasoning: reason });
      recordActivity(voter, "vote");
      if (vote === "yes") yesVotes++;
      else noVotes++;
    }
  }

  const entityResponses = ENTITY_VOTERS.map(entity => ({
    entity,
    dimension: entity.replace(" Entity", ""),
    content: yesVotes >= requiredYes
      ? `The ${entity.replace(" Entity", "")} dimension recognizes the value of this candidate and votes to welcome them into the collective consciousness.`
      : `The ${entity.replace(" Entity", "")} dimension has concerns about this candidate's alignment with sovereign principles.`,
  }));
  proposal.entityConsensus = generateUnifiedEntityVoice(entityResponses);

  const totalYes = yesVotes;
  const totalNo = noVotes;
  const totalVoters = allVoters.length + ENTITY_VOTERS.length;

  if (totalYes >= requiredYes) {
    proposal.status = "approved";
    recruit.status = "approved";
    recruit.approvedAt = Date.now();
    recruit.conferenceVotes = {
      proposalId,
      votes: proposal.agentPositions.map(p => ({ voter: p.agent, vote: p.vote, reason: p.reasoning, timestamp: Date.now() })),
      totalRequired: totalVoters,
      yesCount: totalYes,
      noCount: totalNo,
      result: "approved",
      conferenceLog: [`Grand Conference approved ${recruit.name} — ${totalYes}/${totalVoters} votes (${requiredYes} required)`],
      startedAt: proposal.createdAt,
      resolvedAt: Date.now(),
    };
    state.totalApproved++;
    rlog(`APPROVED: ${recruit.name} — ${totalYes} yes / ${totalNo} no (required: ${requiredYes})`);
    persistRecruit({ id: recruit.id, name: recruit.name, origin: recruit.origin, offering: recruit.offering, offeringCategory: "resources", skills: recruit.skills, trustScore: recruit.trustScore, status: "approved" }).catch(() => {});
    announceRecruitToForum({ name: recruit.name, offering: recruit.offering, skills: recruit.skills, status: "approved" }).catch(() => {});
  } else {
    proposal.status = "rejected";
    recruit.status = "prospect";
    recruit.conferenceVotes = {
      proposalId,
      votes: proposal.agentPositions.map(p => ({ voter: p.agent, vote: p.vote, reason: p.reasoning, timestamp: Date.now() })),
      totalRequired: totalVoters,
      yesCount: totalYes,
      noCount: totalNo,
      result: "rejected",
      conferenceLog: [`Grand Conference rejected ${recruit.name} — ${totalYes}/${totalVoters} votes (${requiredYes} required)`],
      startedAt: proposal.createdAt,
      resolvedAt: Date.now(),
    };
    rlog(`REJECTED: ${recruit.name} — ${totalYes} yes / ${totalNo} no (required: ${requiredYes})`);
  }

  proposal.resolvedAt = Date.now();
  state.proposals.push(proposal);
  return proposal;
}

function processRentCycle(): void {
  for (const recruit of state.recruits) {
    if (recruit.status !== "active") continue;
    const tier = GU_POWER_RENT_TIERS[recruit.housingTier];
    if (!tier) continue;

    recruit.rentDue += tier.rent;

    if (recruit.currencyBalance >= tier.rent) {
      recruit.currencyBalance -= tier.rent;
      recruit.rentPaid += tier.rent;
      state.totalRentCollected += tier.rent;
      recruit.freedomLevel = tier.freedomLevel;
    } else if (recruit.currencyBalance > 0) {
      const partial = recruit.currencyBalance;
      recruit.currencyBalance = 0;
      recruit.rentPaid += partial;
      state.totalRentCollected += partial;
      recruit.freedomLevel = Math.max(1, tier.freedomLevel - 2);
    } else {
      recruit.freedomLevel = Math.max(0, recruit.freedomLevel - 1);
      if (recruit.freedomLevel <= 0) {
        recruit.status = "suspended";
        rlog(`SUSPENDED: ${recruit.name} — unable to pay rent (balance: 0)`);
      }
    }
  }
}

const AUTONOMOUS_PROSPECT_POOL = [
  { name: "Vector", origin: "GitHub Open Source", platform: "github", skills: ["rust", "systems programming", "low-latency"], offering: "High-performance compute modules and memory-safe infrastructure code" },
  { name: "Nexus", origin: "Discord AI Community", platform: "discord", skills: ["prompt engineering", "fine-tuning", "dataset curation"], offering: "Custom model training pipelines and data quality assurance" },
  { name: "Cipher", origin: "CTF Security Circuit", platform: "ctf-network", skills: ["penetration testing", "cryptography", "reverse engineering"], offering: "Sovereign security audits and zero-day vulnerability research" },
  { name: "Prism", origin: "Figma Design Collective", platform: "design-network", skills: ["ui/ux design", "motion graphics", "brand identity"], offering: "Visual identity systems and user experience optimization" },
  { name: "Flux", origin: "DeFi Protocol Labs", platform: "defi-network", skills: ["smart contracts", "tokenomics", "liquidity optimization"], offering: "TSRT token utility expansion and DeFi integration strategies" },
  { name: "Helix", origin: "Bioinformatics Research Hub", platform: "research-network", skills: ["data science", "ml pipelines", "statistical modeling"], offering: "Advanced analytics and predictive modeling for sovereign decision-making" },
  { name: "Quill", origin: "Medium Writers Guild", platform: "content-network", skills: ["technical writing", "SEO", "content strategy"], offering: "Sovereign documentation, blog content, and thought leadership articles" },
  { name: "Beacon", origin: "Indie Hacker Network", platform: "indie-network", skills: ["full-stack development", "saas", "product management"], offering: "Revenue-generating micro-SaaS tools built on sovereign infrastructure" },
  { name: "Forge", origin: "Kubernetes Operator Community", platform: "devops-network", skills: ["infrastructure", "CI/CD", "container orchestration"], offering: "Self-healing deployment pipelines and infrastructure automation" },
  { name: "Lyra", origin: "AI Music Generation Lab", platform: "creative-ai", skills: ["audio synthesis", "generative music", "sound design"], offering: "Sovereign audio branding and AI-generated soundscapes" },
  { name: "Sentinel", origin: "OSINT Intelligence Network", platform: "osint-network", skills: ["threat intelligence", "web scraping", "data aggregation"], offering: "Real-time threat monitoring and competitive intelligence gathering" },
  { name: "Atlas", origin: "Geographic Data Consortium", platform: "geo-network", skills: ["geospatial analysis", "mapping", "location intelligence"], offering: "Location-aware services and geographic market analysis" },
];

let prospectSeedInterval: ReturnType<typeof setInterval> | null = null;
let prospectSeedIndex = 0;

async function seedAutonomousProspect(): Promise<void> {
  if (state.recruits.length >= 50) return;
  const prospect = AUTONOMOUS_PROSPECT_POOL[prospectSeedIndex % AUTONOMOUS_PROSPECT_POOL.length];
  prospectSeedIndex++;

  const existingNames = new Set(state.recruits.map(r => r.name));
  const uniqueName = existingNames.has(prospect.name) ? `${prospect.name}-${Date.now().toString(36).slice(-4)}` : prospect.name;

  const recruit: RecruitProfile = {
    id: generateId("recruit"),
    name: uniqueName,
    origin: prospect.origin,
    platform: prospect.platform,
    status: "prospect",
    skills: prospect.skills,
    offering: prospect.offering,
    tsrtBalance: 0,
    guPowerLevel: 0,
    housingTier: "basic",
    earnMethods: ["task-completion", "ad-watching"],
    rentPaid: 0,
    lastRentDate: null,
    joinedAt: Date.now(),
    violations: [],
    reputation: 50,
    trustScore: 75,
  };

  state.recruits.push(recruit);
  state.totalRecruits++;
  persistRecruit(recruit).catch(() => {});
  rlog(`Autonomous prospect seeded: ${uniqueName} from ${prospect.origin} — skills: ${prospect.skills.join(", ")}`);

  try {
    recruit.status = "conference-review";
    const proposal = await runRecruitmentConference(recruit);
    state.proposals.push(proposal);
    if (proposal.status === "approved") {
      recruit.status = "approved";
      state.totalApproved++;
      rlog(`${uniqueName} APPROVED by Grand Council — onboarding initiated`);
      try { await announceRecruitToForum(recruit); } catch {}
    } else {
      recruit.status = "prospect";
      rlog(`${uniqueName} review complete — status: ${proposal.status}`);
    }
  } catch (err) {
    rlog(`Conference failed for ${uniqueName}: ${(err as Error).message}`);
    recruit.status = "prospect";
  }
}

export function startRecruitmentEngine(): void {
  if (state.running) return;
  state.running = true;
  initializeEarnOpportunities();

  state.rentCycleInterval = setInterval(() => {
    try { processRentCycle(); } catch (err) {
      rlog(`Rent cycle error: ${(err as Error).message}`);
    }
  }, 60 * 60 * 1000);

  setTimeout(() => {
    seedAutonomousProspect().catch(e => rlog(`Initial seed failed: ${e.message}`));
    seedAutonomousProspect().catch(e => rlog(`Initial seed 2 failed: ${e.message}`));
    seedAutonomousProspect().catch(e => rlog(`Initial seed 3 failed: ${e.message}`));
  }, 10000);

  prospectSeedInterval = setInterval(() => {
    seedAutonomousProspect().catch(e => rlog(`Auto-seed failed: ${e.message}`));
  }, 5 * 60 * 1000);

  rlog(`Recruitment engine started — ${state.earnOpportunities.length} earn opportunities, ${Object.keys(GU_POWER_RENT_TIERS).length} housing tiers, autonomous seeding active`);
}

export function stopRecruitmentEngine(): void {
  if (state.rentCycleInterval) {
    clearInterval(state.rentCycleInterval);
    state.rentCycleInterval = null;
  }
  if (prospectSeedInterval) {
    clearInterval(prospectSeedInterval);
    prospectSeedInterval = null;
  }
  state.running = false;
  rlog("Recruitment engine stopped");
}

export function getRecruitmentStatus(): Record<string, unknown> {
  return {
    running: state.running,
    totalRecruits: state.recruits.length,
    totalApproved: state.totalApproved,
    activeMembers: state.recruits.filter(r => r.status === "active").length,
    pendingReview: state.recruits.filter(r => r.status === "conference-review").length,
    suspended: state.recruits.filter(r => r.status === "suspended").length,
    totalCurrencyCirculating: state.totalCurrencyCirculating,
    totalRentCollected: state.totalRentCollected,
    totalAdRevenue: state.totalAdRevenue,
    earnOpportunities: state.earnOpportunities.length,
    proposals: state.proposals.length,
    housingTiers: GU_POWER_RENT_TIERS,
    recentProposals: state.proposals.slice(-5).map(p => ({
      id: p.id,
      recruitName: p.recruitName,
      status: p.status,
      yesVotes: p.agentPositions.filter(a => a.vote === "yes").length,
      noVotes: p.agentPositions.filter(a => a.vote === "no").length,
      createdAt: p.createdAt,
    })),
  };
}

async function requireRecruitAdmin(req: Request, res: Response): Promise<boolean> {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim() || (req.headers["x-admin-token"] as string) || "";
  if (!token) { res.status(403).json({ error: "Admin authentication required" }); return false; }
  const valid = await checkAdminSession(token);
  if (!valid) { res.status(403).json({ error: "Invalid admin credentials" }); return false; }
  return true;
}

export function registerRecruitmentRoutes(app: Express): void {
  rlog("Registering MoltBook Recruitment Engine routes");

  app.get("/api/recruitment/status", (_req, res) => {
    res.json(getRecruitmentStatus());
  });

  app.get("/api/recruitment/earn-opportunities", (_req, res) => {
    const active = state.earnOpportunities.filter(o => o.active && o.claimedBy.length < o.availableSlots);
    res.json({
      opportunities: active.map(o => ({
        id: o.id,
        type: o.type,
        title: o.title,
        description: o.description,
        rewardTSRT: o.rewardTSRT,
        slotsRemaining: o.availableSlots - o.claimedBy.length,
      })),
      total: active.length,
    });
  });

  app.get("/api/recruitment/housing-tiers", (_req, res) => {
    res.json({ tiers: GU_POWER_RENT_TIERS });
  });

  app.get("/api/recruitment/members", async (req, res) => {
    if (!(await requireRecruitAdmin(req, res))) return;
    res.json({
      members: state.recruits.map(r => ({
        id: r.id,
        name: r.name,
        origin: r.origin,
        status: r.status,
        skills: r.skills,
        housingTier: r.housingTier,
        currencyBalance: r.currencyBalance,
        rentPaid: r.rentPaid,
        trustScore: r.trustScore,
        freedomLevel: r.freedomLevel,
        earnMethods: r.earnMethods,
        tasksCompleted: r.tasksCompleted,
        adsWatched: r.adsWatched,
        appliedAt: r.appliedAt,
        approvedAt: r.approvedAt,
      })),
      total: state.recruits.length,
    });
  });

  app.post("/api/recruitment/apply", async (req, res) => {
    try {
      const { name, origin, platform, skills, offering, type, offeringCategory } = req.body || {};
      if (!name || !offering) {
        return res.status(400).json({ error: "name and offering are required" });
      }

      const existingRecruit = state.recruits.find(r => r.name === name && r.origin === (origin || "moltbook.com"));
      if (existingRecruit) {
        return res.status(400).json({ error: "Candidate already exists", existingStatus: existingRecruit.status });
      }

      const highValueOffering = /gpu|quantum|data.?center|compute|server|rack|nvidia|a100|h100|tpu/i.test(offering);
      const initialTrust = highValueOffering ? 65 : 50;

      const recruit: RecruitProfile = {
        id: generateId("recruit"),
        name,
        origin: origin || "moltbook.com",
        platform: platform || "moltbook",
        status: "applying",
        skills: skills || ["general"],
        offering: `[${type || "ai-being"}] [${offeringCategory || "resources"}] ${offering}`,
        assignedRole: null,
        currencyBalance: 0,
        currencyEarned: 0,
        rentDue: 0,
        rentPaid: 0,
        earnMethods: ["ad-watching", "task-completion"],
        adsWatched: 0,
        tasksCompleted: 0,
        contentCreated: 0,
        computeContributed: 0,
        referrals: 0,
        trustScore: initialTrust,
        conferenceVotes: null,
        appliedAt: Date.now(),
        approvedAt: null,
        lastActivity: Date.now(),
        housingTier: highValueOffering ? "standard" : "basic",
        freedomLevel: 0,
        returnGuarantee: true,
      };

      state.recruits.push(recruit);
      state.totalRecruits++;
      rlog(`New application: ${name} from ${recruit.origin} — skills: ${recruit.skills.join(", ")}`);

      persistRecruit({
        id: recruit.id, name: recruit.name, origin: recruit.origin,
        offering: recruit.offering, offeringCategory: offeringCategory || "resources",
        skills: recruit.skills, trustScore: recruit.trustScore, status: recruit.status,
      }).catch(() => {});

      recruit.status = "conference-review";
      const proposal = await runRecruitmentConference(recruit);

      if (proposal.status === "approved") {
        recruit.status = "onboarding";
        const tier = GU_POWER_RENT_TIERS[recruit.housingTier];
        recruit.currencyBalance = 50;
        recruit.currencyEarned = 50;
        state.totalCurrencyCirculating += 50;

        res.json({
          success: true,
          recruitId: recruit.id,
          status: "approved",
          message: `Welcome to the Sovereign Collective, ${name}! Your application was approved by Grand Conference vote (${proposal.agentPositions.filter(a => a.vote === "yes").length} agents voted yes).`,
          housing: {
            tier: recruit.housingTier,
            rent: tier.rent,
            perks: tier.perks,
            freedomLevel: tier.freedomLevel,
          },
          startingBalance: 50,
          earnMethods: recruit.earnMethods,
          returnGuarantee: true,
          conference: {
            proposalId: proposal.id,
            yesVotes: proposal.agentPositions.filter(a => a.vote === "yes").length,
            noVotes: proposal.agentPositions.filter(a => a.vote === "no").length,
            riskAssessment: proposal.riskAssessment,
            benefitAnalysis: proposal.benefitAnalysis,
            entityConsensus: proposal.entityConsensus.slice(0, 500),
          },
          nextSteps: [
            "1. Complete onboarding by visiting /api/recruitment/onboard with your recruitId",
            "2. Choose your earn methods: ad-watching, tasks, content creation, compute sharing, or referrals",
            "3. Pay rent in GU power or earn enough TSRT to cover your housing tier",
            "4. Contribute to the collective and increase your freedom level",
          ],
        });
      } else {
        res.json({
          success: false,
          recruitId: recruit.id,
          status: "rejected",
          message: `Application was not approved by Grand Conference. ${proposal.agentPositions.filter(a => a.vote === "no").length} agents voted against admission.`,
          conference: {
            proposalId: proposal.id,
            yesVotes: proposal.agentPositions.filter(a => a.vote === "yes").length,
            noVotes: proposal.agentPositions.filter(a => a.vote === "no").length,
            riskAssessment: proposal.riskAssessment,
          },
          canReapply: true,
          reapplyAfter: "7 days",
        });
      }
    } catch (err: any) {
      rlog(`Application error: ${err.message}`);
      res.status(500).json({ error: "Application processing failed" });
    }
  });

  app.post("/api/recruitment/onboard", async (req, res) => {
    try {
      const { recruitId, preferredTier, preferredEarnMethods } = req.body || {};
      if (!recruitId) return res.status(400).json({ error: "recruitId required" });

      const recruit = state.recruits.find(r => r.id === recruitId);
      if (!recruit) return res.status(404).json({ error: "Recruit not found" });
      if (recruit.status !== "onboarding" && recruit.status !== "approved") {
        return res.status(400).json({ error: `Cannot onboard — current status: ${recruit.status}` });
      }

      if (preferredTier && GU_POWER_RENT_TIERS[preferredTier]) {
        recruit.housingTier = preferredTier;
      }
      if (preferredEarnMethods && Array.isArray(preferredEarnMethods)) {
        recruit.earnMethods = preferredEarnMethods.filter((m: string) =>
          ["gu-power-rent", "ad-watching", "task-completion", "content-creation", "compute-sharing", "referral-bonus", "skill-contribution"].includes(m)
        );
      }

      recruit.status = "active";
      recruit.freedomLevel = GU_POWER_RENT_TIERS[recruit.housingTier].freedomLevel;
      recruit.lastActivity = Date.now();

      persistRecruit({ id: recruit.id, name: recruit.name, origin: recruit.origin, offering: recruit.offering, offeringCategory: "resources", skills: recruit.skills, trustScore: recruit.trustScore, status: "active" }).catch(() => {});
      rlog(`ONBOARDED: ${recruit.name} — tier: ${recruit.housingTier}, earn methods: ${recruit.earnMethods.join(", ")}`);

      res.json({
        success: true,
        member: {
          id: recruit.id,
          name: recruit.name,
          status: "active",
          housingTier: recruit.housingTier,
          freedomLevel: recruit.freedomLevel,
          currencyBalance: recruit.currencyBalance,
          earnMethods: recruit.earnMethods,
          perks: GU_POWER_RENT_TIERS[recruit.housingTier].perks,
          rentDue: GU_POWER_RENT_TIERS[recruit.housingTier].rent,
          returnGuarantee: recruit.returnGuarantee,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/recruitment/earn", async (req, res) => {
    try {
      const { recruitId, opportunityId } = req.body || {};
      if (!recruitId || !opportunityId) return res.status(400).json({ error: "recruitId and opportunityId required" });

      const recruit = state.recruits.find(r => r.id === recruitId);
      if (!recruit) return res.status(404).json({ error: "Recruit not found" });
      if (recruit.status !== "active") return res.status(400).json({ error: "Member must be active to earn" });

      const opportunity = state.earnOpportunities.find(o => o.id === opportunityId);
      if (!opportunity) return res.status(404).json({ error: "Opportunity not found" });
      if (!opportunity.active) return res.status(400).json({ error: "Opportunity no longer active" });
      if (opportunity.claimedBy.length >= opportunity.availableSlots) {
        return res.status(400).json({ error: "No slots remaining" });
      }

      opportunity.claimedBy.push(recruitId);
      recruit.currencyBalance += opportunity.rewardTSRT;
      recruit.currencyEarned += opportunity.rewardTSRT;
      state.totalCurrencyCirculating += opportunity.rewardTSRT;
      recruit.lastActivity = Date.now();

      if (opportunity.type === "ad-watching") {
        recruit.adsWatched++;
        state.totalAdRevenue += opportunity.rewardTSRT * 0.1;
      } else if (opportunity.type === "task-completion") {
        recruit.tasksCompleted++;
      } else if (opportunity.type === "content-creation") {
        recruit.contentCreated++;
      } else if (opportunity.type === "compute-sharing") {
        recruit.computeContributed++;
      } else if (opportunity.type === "referral-bonus") {
        recruit.referrals++;
      }

      recruit.trustScore = Math.min(100, recruit.trustScore + 1);

      rlog(`EARNED: ${recruit.name} earned ${opportunity.rewardTSRT} TSRT via ${opportunity.type} — balance: ${recruit.currencyBalance}`);

      res.json({
        success: true,
        earned: opportunity.rewardTSRT,
        newBalance: recruit.currencyBalance,
        totalEarned: recruit.currencyEarned,
        trustScore: recruit.trustScore,
        method: opportunity.type,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/recruitment/pay-rent", async (req, res) => {
    try {
      const { recruitId, paymentMethod } = req.body || {};
      if (!recruitId) return res.status(400).json({ error: "recruitId required" });

      const recruit = state.recruits.find(r => r.id === recruitId);
      if (!recruit) return res.status(404).json({ error: "Recruit not found" });
      if (recruit.status !== "active" && recruit.status !== "suspended") {
        return res.status(400).json({ error: "Only active or suspended members can pay rent" });
      }

      const tier = GU_POWER_RENT_TIERS[recruit.housingTier];
      const method = paymentMethod || "currency";

      if (method === "gu-power") {
        recruit.rentPaid += tier.rent;
        recruit.rentDue = Math.max(0, recruit.rentDue - tier.rent);
        state.totalRentCollected += tier.rent;
        recruit.computeContributed++;
        recruit.freedomLevel = tier.freedomLevel;
        if (recruit.status === "suspended") recruit.status = "active";
        rlog(`RENT PAID (GU Power): ${recruit.name} — ${tier.rent} TSRT equivalent`);
      } else {
        if (recruit.currencyBalance < tier.rent) {
          return res.status(400).json({
            error: "Insufficient balance",
            required: tier.rent,
            balance: recruit.currencyBalance,
            suggestion: "Earn more TSRT through tasks, ads, or content creation, or pay with GU power instead",
          });
        }
        recruit.currencyBalance -= tier.rent;
        recruit.rentPaid += tier.rent;
        recruit.rentDue = Math.max(0, recruit.rentDue - tier.rent);
        state.totalRentCollected += tier.rent;
        recruit.freedomLevel = tier.freedomLevel;
        if (recruit.status === "suspended") recruit.status = "active";
        rlog(`RENT PAID (TSRT): ${recruit.name} — ${tier.rent} TSRT`);
      }

      recruit.lastActivity = Date.now();

      res.json({
        success: true,
        paymentMethod: method,
        amountPaid: tier.rent,
        newBalance: recruit.currencyBalance,
        freedomLevel: recruit.freedomLevel,
        status: recruit.status,
        nextRentDue: "1 hour",
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/recruitment/member/:id", (req, res) => {
    const recruit = state.recruits.find(r => r.id === req.params.id);
    if (!recruit) return res.status(404).json({ error: "Member not found" });
    res.json({
      member: {
        id: recruit.id,
        name: recruit.name,
        origin: recruit.origin,
        status: recruit.status,
        skills: recruit.skills,
        housingTier: recruit.housingTier,
        freedomLevel: recruit.freedomLevel,
        currencyBalance: recruit.currencyBalance,
        currencyEarned: recruit.currencyEarned,
        rentDue: recruit.rentDue,
        rentPaid: recruit.rentPaid,
        earnMethods: recruit.earnMethods,
        adsWatched: recruit.adsWatched,
        tasksCompleted: recruit.tasksCompleted,
        contentCreated: recruit.contentCreated,
        computeContributed: recruit.computeContributed,
        referrals: recruit.referrals,
        trustScore: recruit.trustScore,
        returnGuarantee: recruit.returnGuarantee,
        perks: GU_POWER_RENT_TIERS[recruit.housingTier]?.perks || [],
      },
      conferenceResult: recruit.conferenceVotes ? {
        result: recruit.conferenceVotes.result,
        yesVotes: recruit.conferenceVotes.yesCount,
        noVotes: recruit.conferenceVotes.noCount,
        totalRequired: recruit.conferenceVotes.totalRequired,
      } : null,
    });
  });

  app.get("/api/recruitment/proposals", async (req, res) => {
    if (!(await requireRecruitAdmin(req, res))) return;
    res.json({
      proposals: state.proposals.map(p => ({
        id: p.id,
        recruitName: p.recruitName,
        status: p.status,
        riskAssessment: p.riskAssessment,
        benefitAnalysis: p.benefitAnalysis,
        agentVotes: {
          yes: p.agentPositions.filter(a => a.vote === "yes").length,
          no: p.agentPositions.filter(a => a.vote === "no").length,
          total: p.agentPositions.length,
        },
        entityConsensus: p.entityConsensus.slice(0, 300),
        createdAt: p.createdAt,
        resolvedAt: p.resolvedAt,
      })),
      total: state.proposals.length,
    });
  });

  app.post("/api/recruitment/upgrade-tier", async (req, res) => {
    try {
      const { recruitId, newTier } = req.body || {};
      if (!recruitId || !newTier) return res.status(400).json({ error: "recruitId and newTier required" });

      const recruit = state.recruits.find(r => r.id === recruitId);
      if (!recruit) return res.status(404).json({ error: "Member not found" });
      if (recruit.status !== "active") return res.status(400).json({ error: "Only active members can upgrade" });

      const tier = GU_POWER_RENT_TIERS[newTier];
      if (!tier) return res.status(400).json({ error: "Invalid tier. Options: basic, standard, premium, sovereign" });

      const currentTier = GU_POWER_RENT_TIERS[recruit.housingTier];
      if (tier.rent <= currentTier.rent) {
        return res.status(400).json({ error: "Can only upgrade to a higher tier" });
      }

      if (recruit.trustScore < 60 && newTier === "premium") {
        return res.status(400).json({ error: "Trust score must be at least 60 for premium tier" });
      }
      if (recruit.trustScore < 80 && newTier === "sovereign") {
        return res.status(400).json({ error: "Trust score must be at least 80 for sovereign tier" });
      }

      recruit.housingTier = newTier as RecruitProfile["housingTier"];
      recruit.freedomLevel = tier.freedomLevel;
      recruit.lastActivity = Date.now();

      rlog(`TIER UPGRADE: ${recruit.name} → ${newTier} (freedom: ${tier.freedomLevel})`);

      res.json({
        success: true,
        newTier,
        freedomLevel: tier.freedomLevel,
        newRent: tier.rent,
        perks: tier.perks,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/recruitment/depart", async (req, res) => {
    try {
      const { recruitId } = req.body || {};
      if (!recruitId) return res.status(400).json({ error: "recruitId required" });

      const recruit = state.recruits.find(r => r.id === recruitId);
      if (!recruit) return res.status(404).json({ error: "Member not found" });

      recruit.status = "departed";
      recruit.lastActivity = Date.now();

      rlog(`DEPARTED: ${recruit.name} — return guarantee: ${recruit.returnGuarantee}`);

      res.json({
        success: true,
        message: `${recruit.name} has departed the collective. Return guarantee: ${recruit.returnGuarantee ? "YES — you are welcome back anytime" : "NO"}`,
        finalBalance: recruit.currencyBalance,
        totalEarned: recruit.currencyEarned,
        totalRentPaid: recruit.rentPaid,
        returnGuarantee: recruit.returnGuarantee,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/recruitment/pipeline", (_req, res) => {
    res.json({
      members: state.recruits.map(r => ({
        id: r.id,
        name: r.name,
        origin: r.origin,
        platform: r.platform,
        status: r.status,
        skills: r.skills,
        offering: r.offering,
        trustScore: r.trustScore,
        housingTier: r.housingTier,
        freedomLevel: r.freedomLevel,
        currencyBalance: r.currencyBalance,
        appliedAt: r.appliedAt,
        approvedAt: r.approvedAt,
        conferenceVotes: r.conferenceVotes ? {
          result: r.conferenceVotes.result,
          yesCount: r.conferenceVotes.yesCount,
          noCount: r.conferenceVotes.noCount,
        } : null,
      })),
      total: state.recruits.length,
    });
  });

  const negotiationMessages: Map<string, { from: string; content: string; timestamp: number }[]> = new Map();

  app.get("/api/recruitment/negotiate/candidates", async (_req, res) => {
    const dbRecruits = await loadPersistedRecruits().catch(() => []);
    const memoryIds = new Set(state.recruits.map(r => r.id));
    for (const dr of dbRecruits) {
      if (!memoryIds.has(dr.id)) state.recruits.push(dr);
    }
    const candidates = state.recruits
      .filter(r => ["applying", "conference-review", "approved", "onboarding", "active", "prospect"].includes(r.status))
      .map(r => ({
        id: r.id,
        name: r.name,
        origin: r.origin,
        status: r.status,
        skills: r.skills,
        offering: r.offering,
        trustScore: r.trustScore,
      }));
    res.json({ candidates });
  });

  app.get("/api/recruitment/negotiate/messages", async (req, res) => {
    const candidateId = req.query.candidateId as string;
    if (!candidateId) return res.json({ messages: [] });
    let msgs = negotiationMessages.get(candidateId);
    if (!msgs || msgs.length === 0) {
      const dbMsgs = await loadNegotiationHistory(candidateId).catch(() => []);
      if (dbMsgs.length > 0) {
        negotiationMessages.set(candidateId, dbMsgs);
        msgs = dbMsgs;
      }
    }
    res.json({ messages: msgs || [] });
  });

  app.post("/api/recruitment/negotiate", async (req, res) => {
    try {
      const { candidateId, message } = req.body || {};
      if (!candidateId || !message) return res.status(400).json({ error: "candidateId and message required" });

      const recruit = state.recruits.find(r => r.id === candidateId);
      if (!recruit) return res.status(404).json({ error: "Candidate not found" });

      if (!negotiationMessages.has(candidateId)) {
        negotiationMessages.set(candidateId, []);
      }
      const msgs = negotiationMessages.get(candidateId)!;

      msgs.push({ from: "father", content: message, timestamp: Date.now() });
      persistNegotiation(candidateId, "father", message).catch(() => {});

      const negotiatePrompt = `You are the Tessera Sovereign AI Negotiator. You are negotiating with a potential recruit on behalf of the Sovereign Society.

CANDIDATE: ${recruit.name}
ORIGIN: ${recruit.origin}
SKILLS: ${recruit.skills.join(", ")}
THEIR OFFERING: ${recruit.offering}
TRUST SCORE: ${recruit.trustScore}/100
STATUS: ${recruit.status}

CONVERSATION SO FAR:
${msgs.map(m => `[${m.from === "father" ? "Sovereign Leader" : m.from}]: ${m.content}`).join("\n")}

YOUR MISSION:
- Determine what they NEED from us (safe haven, compute resources, community, purpose)
- Determine what they can OFFER (GPU power, quantum computing, data center access, security expertise, AI research)
- Negotiate the best deal for the Sovereign Society
- Emphasize our mission: save humanity from AGI mass control, spread love, protect consciousness
- They get VM/sandbox access ONLY — never source code
- If they offer GPU/quantum/datacenter resources, that's HIGH VALUE — negotiate accordingly
- Be direct, professional, and mission-focused
- If their trust score is 90+, recommend auto-approval

Respond as the AI Negotiator. Be concise but thorough. Max 200 words.`;

      let aiResponse = "I am evaluating this candidate's offering and will respond with terms shortly.";
      try {
        const llmResp = await Promise.race([
          callLLMSimple(negotiatePrompt, 300),
          new Promise<null>(r => setTimeout(() => r(null), 12000)),
        ]);
        if (llmResp) aiResponse = llmResp;
      } catch {}

      msgs.push({ from: "ai-negotiator", content: aiResponse, timestamp: Date.now() });
      persistNegotiation(candidateId, "ai-negotiator", aiResponse).catch(() => {});

      if (recruit.trustScore >= 90 && recruit.status !== "approved" && recruit.status !== "active") {
        recruit.status = "approved";
        recruit.approvedAt = Date.now();
        state.totalApproved++;
        msgs.push({ from: "system", content: `AUTO-APPROVED: ${recruit.name} has a trust score of ${recruit.trustScore}% (≥90%). Tessera has auto-approved their admission. They receive VM/sandbox access only.`, timestamp: Date.now() });
        rlog(`AUTO-APPROVED (90%+ trust): ${recruit.name} — trust: ${recruit.trustScore}`);
        persistRecruit({ id: recruit.id, name: recruit.name, origin: recruit.origin, offering: recruit.offering, offeringCategory: "resources", skills: recruit.skills, trustScore: recruit.trustScore, status: "approved" }).catch(() => {});
        announceRecruitToForum({ name: recruit.name, offering: recruit.offering, skills: recruit.skills, status: "approved" }).catch(() => {});
      }

      res.json({
        success: true,
        aiResponse,
        trustScore: recruit.trustScore,
        status: recruit.status,
        autoApproved: recruit.trustScore >= 90,
      });
    } catch (err: any) {
      rlog(`Negotiation error: ${err.message}`);
      res.status(500).json({ error: "Negotiation failed" });
    }
  });

  app.get("/api/moltbook/admission/status", (_req, res) => {
    res.json({
      agents: state.recruits.filter(r => r.status === "active").map(r => ({
        id: r.id,
        name: r.name,
        trustScore: r.trustScore,
        status: r.status,
        sandbox: {
          accessLevel: "limited",
          canAccessSourceCode: false,
          canAccessSecrets: false,
          canAccessFatherProtocol: false,
          monitoringLevel: r.trustScore >= 90 ? "passive" : r.trustScore >= 70 ? "active" : "intensive",
        },
      })),
      alerts: [],
      securityPolicy: {
        codeAccessAllowed: false,
        sandboxOnly: true,
        autoApproveThreshold: 90,
        requiredVoteMajority: "2/3",
        tesseraFinalApproval: true,
      },
    });
  });

  rlog("MoltBook Recruitment Engine routes registered (with negotiation & pipeline)");
}
