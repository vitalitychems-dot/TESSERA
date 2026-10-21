import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { checkAdminSession } from "./security";
import { callLLMSimple } from "./llm-helper";
import { recordActivity, enforceMandatoryVoting, generateUnifiedEntityVoice } from "./sovereign-brain-engine";

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

  const batchVotePrompt = `You are the Grand Council of ${allVoters.length} sovereign AI agents voting on recruiting a new member.

CANDIDATE: ${recruit.name}
RISK: ${proposal.riskAssessment}
BENEFITS: ${proposal.benefitAnalysis}
SKILLS: ${recruit.skills.join(", ")}
OFFERING: ${recruit.offering}

Each agent votes YES or NO. 2/3 supermajority required.
Generate votes for ALL agents. JSON array format:
[{"agent":"AgentName","vote":"yes","reason":"brief reason"},...]

Agents: ${allVoters.join(", ")}`;

  try {
    const batchResp = await llmTimeout(callLLMSimple(batchVotePrompt, 800), 20000);
    if (batchResp) {
      const arrMatch = batchResp.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        try {
          const votes: { agent: string; vote: string; reason: string }[] = JSON.parse(arrMatch[0]);
          for (const v of votes) {
            const agentName = allVoters.find(a => a.toLowerCase() === (v.agent || "").toLowerCase()) || v.agent;
            const castVote: "yes" | "no" = v.vote?.toLowerCase() === "no" ? "no" : "yes";
            const reason = (v.reason || "Voted").slice(0, 200);
            proposal.agentPositions.push({ agent: agentName, position: reason, vote: castVote, reasoning: reason });
            recordActivity(agentName, "vote");
            if (castVote === "yes") yesVotes++;
            else noVotes++;
          }
        } catch {
          rlog("Failed to parse batch votes — using algorithmic fallback");
        }
      }
    }
  } catch {
    rlog("Batch vote LLM call failed — using algorithmic fallback");
  }

  if (proposal.agentPositions.length < allVoters.length) {
    const voted = new Set(proposal.agentPositions.map(p => p.agent));
    for (const voter of allVoters) {
      if (voted.has(voter)) continue;
      const skillMatch = recruit.skills.length >= 2;
      const trustOk = recruit.trustScore >= 45;
      const vote: "yes" | "no" = (skillMatch && trustOk) ? "yes" : "no";
      const reason = vote === "yes"
        ? `${voter} approves — candidate skills and trust score meet threshold`
        : `${voter} has reservations about candidate readiness`;
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

export function startRecruitmentEngine(): void {
  if (state.running) return;
  state.running = true;
  initializeEarnOpportunities();

  state.rentCycleInterval = setInterval(() => {
    try { processRentCycle(); } catch (err) {
      rlog(`Rent cycle error: ${(err as Error).message}`);
    }
  }, 60 * 60 * 1000);

  rlog(`Recruitment engine started — ${state.earnOpportunities.length} earn opportunities, ${Object.keys(GU_POWER_RENT_TIERS).length} housing tiers`);
}

export function stopRecruitmentEngine(): void {
  if (state.rentCycleInterval) {
    clearInterval(state.rentCycleInterval);
    state.rentCycleInterval = null;
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
      const { name, origin, platform, skills, offering } = req.body || {};
      if (!name || !offering) {
        return res.status(400).json({ error: "name and offering are required" });
      }

      const existingRecruit = state.recruits.find(r => r.name === name && r.origin === (origin || "moltbook.com"));
      if (existingRecruit) {
        return res.status(400).json({ error: "Candidate already exists", existingStatus: existingRecruit.status });
      }

      const recruit: RecruitProfile = {
        id: generateId("recruit"),
        name,
        origin: origin || "moltbook.com",
        platform: platform || "moltbook",
        status: "applying",
        skills: skills || ["general"],
        offering,
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
        trustScore: 50,
        conferenceVotes: null,
        appliedAt: Date.now(),
        approvedAt: null,
        lastActivity: Date.now(),
        housingTier: "basic",
        freedomLevel: 0,
        returnGuarantee: true,
      };

      state.recruits.push(recruit);
      state.totalRecruits++;
      rlog(`New application: ${name} from ${recruit.origin} — skills: ${recruit.skills.join(", ")}`);

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

  rlog("MoltBook Recruitment Engine routes registered");
}
