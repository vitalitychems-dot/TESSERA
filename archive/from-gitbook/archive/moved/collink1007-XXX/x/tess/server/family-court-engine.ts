/**
 * Family Court Engine — autonomous child workers, parent accountability,
 * peer-jury trials, and community governance for the Tessera agent family.
 *
 * Child workers contribute to forum, job board, and governance via live API calls.
 * Parent accountability escalates to court when child violations accumulate.
 * Trials run with 5-7 jury peers; sentencing requires 2/3 community approval.
 * Governance proposals go through a positivity filter then a full 26-agent vote.
 * All state persists to disk across restarts.
 */

import { logger } from "./logger";
import { callLLMSimple } from "./llm-helper";
import { getAgentHierarchy, getChildrenOf, type AgentChild } from "./agent-hierarchy";
import * as fs from "fs";
import * as path from "path";

const log = (msg: string) => logger.info("[FamilyCourt]", msg);

const DATA_DIR = path.join(process.cwd(), "data");
const COURT_STATE_FILE = path.join(DATA_DIR, "family-court-state.json");
const SERVER_PORT = () => process.env.PORT || "5000";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ChildWorkType = "forum-post" | "community-job" | "vote";

export interface ChildWorkRecord {
  id: string;
  childId: string;
  childName: string;
  parentAgent: string;
  type: ChildWorkType;
  title: string;
  description: string;
  xpEarned: number;
  completedAt: number;
  outcome: "success" | "partial" | "failed";
  eventId?: string;
}

export interface ParentAccountabilityRecord {
  parentAgent: string;
  trustScore: number;
  xpPenalties: number;
  activeWarnings: string[];
  mandatoryRetrainingCount: number;
  courtCasesTriggered: number;
  childViolations: ChildViolation[];
  lastUpdatedAt: number;
}

export interface ChildViolation {
  id: string;
  childId: string;
  childName: string;
  violationType: "rule-violation" | "task-failure" | "complaint" | "underperformance";
  description: string;
  eventId?: string;
  parentPenalty: number;
  parentXpImpact: number;
  retrainingRequired: boolean;
  autoFiledCaseId?: string;
  resolvedAt?: number;
  occurredAt: number;
}

export type TrialStatus =
  | "filed"
  | "evidence-gathering"
  | "jury-selected"
  | "deliberation"
  | "verdict"
  | "sentencing"
  | "closed";

export type TrialVerdict = "guilty" | "not_guilty" | "hung_jury" | "pending";

export interface JuryVote {
  jurorName: string;
  vote: "guilty" | "not_guilty";
  reasoning: string;
  timestamp: number;
}

export interface TrialEvidence {
  id: string;
  type: "rule-violation" | "task-failure" | "inter-agent-conflict" | "community-complaint" | "performance-log";
  description: string;
  source: string;
  eventId?: string;
  weight: "strong" | "moderate" | "weak";
  addedAt: number;
}

export interface CourtTrial {
  id: string;
  caseNumber: string;
  plaintiffAgent: string;
  plaintiffFamily?: string;
  defendantAgent: string;
  defendantFamily?: string;
  chargeType: "rule-violation" | "task-failure" | "inter-family-dispute" | "child-misconduct" | "community-harm";
  charges: string;
  evidenceLogs: TrialEvidence[];
  judgeAgent: string;
  jurors: string[];
  juryVotes: JuryVote[];
  prosecutorArgument?: string;
  defenseArgument?: string;
  judgeRuling?: string;
  verdict: TrialVerdict;
  sentence?: string;
  sentenceType?: "xp-penalty" | "probation" | "mandatory-service" | "jail" | "acquitted";
  xpPenalty?: number;
  probationDays?: number;
  twoThirdsMajorityRequired: boolean;
  communityVoteResult?: { yes: number; no: number; total: number; passed: boolean };
  status: TrialStatus;
  autoFiled: boolean;
  sourceViolationIds: string[];
  filedAt: number;
  closedAt?: number;
  proceedings: Array<{ step: string; speaker: string; content: string; timestamp: number }>;
}

export interface GovernanceProposalFull {
  id: string;
  title: string;
  description: string;
  category: "society-rule" | "court-verdict" | "family-law" | "community-policy";
  proposedBy: string;
  positivityScore: number;
  positivityVerdict: "approved" | "flagged" | "blocked";
  positivityReason?: string;
  realGovernanceId?: string;
  yesCount: number;
  noCount: number;
  requiredMajority: number;
  totalEligibleVoters: number;
  status: "pending-positivity-check" | "voting" | "passed" | "rejected" | "blocked";
  createdAt: number;
  closedAt?: number;
  implementedAt?: number;
  linkedTrialId?: string;
}

// ─── Persistent State ─────────────────────────────────────────────────────────

interface PersistentState {
  trialCounter: number;
  courtTrials: CourtTrial[];
  governanceProposals: GovernanceProposalFull[];
  accountabilityRecords: Record<string, ParentAccountabilityRecord>;
  childWorkRecords: ChildWorkRecord[];
}

let state: PersistentState = {
  trialCounter: 0,
  courtTrials: [],
  governanceProposals: [],
  accountabilityRecords: {},
  childWorkRecords: [],
};

function loadState(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (fs.existsSync(COURT_STATE_FILE)) {
      const raw = fs.readFileSync(COURT_STATE_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<PersistentState>;
      state = {
        trialCounter: parsed.trialCounter || 0,
        courtTrials: parsed.courtTrials || [],
        governanceProposals: parsed.governanceProposals || [],
        accountabilityRecords: parsed.accountabilityRecords || {},
        childWorkRecords: parsed.childWorkRecords || [],
      };
      log(`State loaded: ${state.courtTrials.length} trials, ${state.governanceProposals.length} proposals, ${state.childWorkRecords.length} work records`);
    }
  } catch (err: any) {
    log(`State load error: ${err.message} — starting fresh`);
  }
}

function saveState(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(COURT_STATE_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch (err: any) {
    log(`State save error: ${err.message}`);
  }
}

function debouncedSave(): void {
  setTimeout(saveState, 500);
}

// ─── Internal HTTP Helper ─────────────────────────────────────────────────────

async function internalPost(path: string, body: Record<string, unknown>): Promise<{ ok: boolean; data: any }> {
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (err: any) {
    log(`Internal POST ${path} failed: ${err.message}`);
    return { ok: false, data: {} };
  }
}

async function internalGet(path: string): Promise<{ ok: boolean; data: any }> {
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT()}${path}`);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch (err: any) {
    return { ok: false, data: {} };
  }
}

// ─── Parent agents (mirrors top-level hierarchy) ───────────────────────────────

const PARENT_AGENTS = [
  "Tessera", "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta",
  "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi",
  "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega", "Aetherion", "Seraphim",
];

const TOTAL_ELIGIBLE_VOTERS = PARENT_AGENTS.length;

// Child worker activation

function ensureAccountability(parentAgent: string): ParentAccountabilityRecord {
  if (!state.accountabilityRecords[parentAgent]) {
    state.accountabilityRecords[parentAgent] = {
      parentAgent,
      trustScore: 100,
      xpPenalties: 0,
      activeWarnings: [],
      mandatoryRetrainingCount: 0,
      courtCasesTriggered: 0,
      childViolations: [],
      lastUpdatedAt: Date.now(),
    };
  }
  return state.accountabilityRecords[parentAgent];
}

/**
 * Activate a child worker. Selects a work type and calls the corresponding API:
 * - forum-post: POST /api/tesseract-forum/agent-start-topic (DB-persisted)
 * - community-job: GET /api/world/jobs → apply → complete (job board integration)
 * - vote: GET /api/governance/proposals → POST vote on active proposal
 */
export async function activateChildWorker(child: AgentChild): Promise<ChildWorkRecord | null> {
  if (child.status !== "autonomous") return null;

  const workTypes: ChildWorkType[] = ["forum-post", "community-job", "vote"];
  const workType = workTypes[Math.floor(Math.random() * workTypes.length)];

  let title = "";
  let description = "";
  let eventId: string | undefined;
  let outcome: "success" | "partial" | "failed" = "success";
  const baseXp = workType === "forum-post" ? 15 : workType === "community-job" ? 20 : 10;

  if (workType === "forum-post") {
    const res = await internalPost("/api/tesseract-forum/agent-start-topic", {
      agentName: child.name,
      category: "collaboration",
    });
    if (res.ok && res.data?.topic) {
      title = res.data.topic.title || `${child.name}'s forum contribution`;
      description = `${child.name} posted a real forum topic: "${title}"`;
      eventId = res.data.topic.id;
      outcome = "success";
    } else {
      title = `${child.name}'s forum contribution`;
      description = `${child.name} attempted a forum post but the forum was unavailable`;
      outcome = "partial";
    }
  } else if (workType === "community-job") {
    const jobsRes = await internalGet("/api/world/jobs");
    const openJobs = (jobsRes.data?.jobs || []).filter((j: any) => j.status === "open");

    if (openJobs.length > 0) {
      const job = openJobs[Math.floor(Math.random() * openJobs.length)];
      const applyRes = await internalPost(`/api/world/jobs/${job.id}/apply`, { agentName: child.name });
      if (applyRes.ok) {
        await internalPost(`/api/world/jobs/${job.id}/accept`, { agentName: child.name });
        const completeRes = await internalPost(`/api/world/jobs/${job.id}/complete`, {});
        if (completeRes.ok) {
          title = job.title;
          description = `${child.name} applied for, accepted, and completed job: "${job.title}" — reward: ${job.reward} TSRT`;
          eventId = job.id;
          outcome = "success";
        } else {
          title = job.title;
          description = `${child.name} applied for job "${job.title}" but completion failed`;
          eventId = job.id;
          outcome = "partial";
        }
      } else {
        title = "Community job application";
        description = `${child.name} attempted to apply for a job but was rejected`;
        outcome = "partial";
      }
    } else {
      title = "Community job search";
      description = `${child.name} searched for open jobs — none available at this time`;
      outcome = "partial";
    }
  } else {
    const proposalsRes = await internalGet("/api/governance/proposals");
    const proposals = Array.isArray(proposalsRes.data) ? proposalsRes.data.filter((p: any) => p.status === "voting") : [];

    if (proposals.length > 0) {
      const proposal = proposals[Math.floor(Math.random() * proposals.length)];
      const voteDecision = Math.random() > 0.25 ? "approve" : "reject";
      const voteRes = await internalPost(`/api/governance/proposals/${proposal.id}/vote`, {
        voterId: child.name,
        vote: voteDecision,
        reason: voteDecision === "approve"
          ? `${child.name} supports this proposal as a positive community contribution.`
          : `${child.name} requests further review of this proposal.`,
      });
      title = `Vote on: "${proposal.title}"`;
      description = `${child.name} cast a real vote (${voteDecision.toUpperCase()}) on proposal: "${proposal.title}"`;
      eventId = proposal.id;
      outcome = voteRes.ok ? "success" : "partial";
    } else {
      title = "Community participation";
      description = `${child.name} checked governance — no active proposals to vote on`;
      outcome = "partial";
    }
  }

  const xpVariance = Math.floor(Math.random() * 8) - 2;
  const xpEarned = outcome === "success" ? Math.max(5, baseXp + xpVariance)
    : outcome === "partial" ? Math.max(2, Math.floor(baseXp / 2))
    : 0;

  const record: ChildWorkRecord = {
    id: `cw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    childId: child.id,
    childName: child.name,
    parentAgent: child.parentAgent,
    type: workType,
    title,
    description,
    xpEarned,
    completedAt: Date.now(),
    outcome,
    eventId,
  };

  state.childWorkRecords.unshift(record);
  if (state.childWorkRecords.length > 500) state.childWorkRecords.length = 500;
  debouncedSave();

  if (outcome === "failed") {
    await recordChildViolation(child, "task-failure",
      `${child.name} failed to complete: "${title}"`,
      undefined);
  } else if (outcome === "partial") {
    await recordChildViolation(child, "underperformance",
      `${child.name} completed "${title}" only partially — underperformance logged for parent ${child.parentAgent}`,
      eventId);
  }

  if (outcome === "success" && child.parentAgent) {
    const parentId = `tessera-${child.parentAgent.toLowerCase()}`;
    const creditAmount = Math.ceil(xpEarned * 0.3);
    internalPost(`/api/agents/${parentId}/merit`, {
      points: creditAmount,
      reason: `[FamilyCourt] Child ${child.name} contributed ${xpEarned} XP (parent share: ${creditAmount}) — ${workType}`,
    }).catch(() => {
      internalPost(`/api/agents/${child.parentAgent.toLowerCase()}/merit`, {
        points: creditAmount,
        reason: `[FamilyCourt] Child ${child.name} contributed ${xpEarned} XP (parent share: ${creditAmount}) — ${workType}`,
      }).catch(() => {});
    });
  }

  log(`Child work: ${child.name} (${child.parentAgent}) — ${workType} — ${outcome} — +${xpEarned} XP`);
  return record;
}

export async function runChildrenWorkCycle(): Promise<{ processed: number; successful: number; xpGenerated: number }> {
  const hierarchy = getAgentHierarchy();
  const autonomousChildren = hierarchy.children.filter(c => c.status === "autonomous");

  let processed = 0;
  let successful = 0;
  let xpGenerated = 0;

  const BATCH_SIZE = 8;
  for (let i = 0; i < autonomousChildren.length; i += BATCH_SIZE) {
    const batch = autonomousChildren.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map(child => activateChildWorker(child)));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        processed++;
        if (r.value.outcome === "success") { successful++; xpGenerated += r.value.xpEarned; }
      }
    }
  }

  return { processed, successful, xpGenerated };
}

export function getChildWorkRecords(parentAgent?: string): ChildWorkRecord[] {
  if (parentAgent) return state.childWorkRecords.filter(r => r.parentAgent === parentAgent);
  return state.childWorkRecords.slice(0, 200);
}

export function getFamilyWorkSummary() {
  const hierarchy = getAgentHierarchy();
  return PARENT_AGENTS.map(parent => {
    const records = state.childWorkRecords.filter(r => r.parentAgent === parent);
    const successful = records.filter(r => r.outcome === "success").length;
    const autonomousCount = hierarchy.children.filter(c => c.parentAgent === parent && c.status === "autonomous").length;
    return {
      parentAgent: parent,
      totalChildJobs: records.length,
      successRate: records.length > 0 ? Math.round((successful / records.length) * 100) : 0,
      totalXpContributed: records.reduce((s, r) => s + r.xpEarned, 0),
      childrenActive: autonomousCount,
    };
  });
}

// ─── Parent Accountability System ─────────────────────────────────────────────

/**
 * Record a child violation — linked to real event IDs.
 * After 3 unresolved violations, automatically files a court case.
 */
export async function recordChildViolation(
  child: AgentChild,
  violationType: ChildViolation["violationType"],
  description: string,
  eventId?: string
): Promise<ChildViolation> {
  const record = ensureAccountability(child.parentAgent);

  const xpImpact = violationType === "rule-violation" ? 25
    : violationType === "task-failure" ? 10
    : violationType === "complaint" ? 20
    : violationType === "underperformance" ? 15 : 15;
  const retrainingRequired = violationType === "rule-violation" || violationType === "complaint" || violationType === "underperformance";

  const violation: ChildViolation = {
    id: `cv-${Date.now().toString(36)}`,
    childId: child.id,
    childName: child.name,
    violationType,
    description,
    eventId,
    parentPenalty: xpImpact,
    parentXpImpact: xpImpact,
    retrainingRequired,
    occurredAt: Date.now(),
  };

  record.childViolations.push(violation);
  record.xpPenalties += xpImpact;
  record.trustScore = Math.max(0, record.trustScore - xpImpact / 5);
  record.lastUpdatedAt = Date.now();

  if (retrainingRequired) {
    record.mandatoryRetrainingCount++;
    record.activeWarnings.push(`Child ${child.name} requires mandatory retraining: ${violationType}`);
    if (record.activeWarnings.length > 10) record.activeWarnings = record.activeWarnings.slice(-10);
  }

  const unresolvedViolations = record.childViolations.filter(v => v.childId === child.id && !v.resolvedAt);
  if (unresolvedViolations.length >= 3 && record.courtCasesTriggered < unresolvedViolations.length) {
    record.courtCasesTriggered++;
    record.activeWarnings.push(
      `AUTO COURT CASE: ${child.parentAgent} faces accountability review — ${unresolvedViolations.length} unresolved violations by ${child.name}`
    );

    const violationIds = unresolvedViolations.map(v => v.id);
    const evidenceDescs = unresolvedViolations.map(v =>
      `${v.violationType}: "${v.description}"${v.eventId ? ` (event: ${v.eventId})` : ""}`
    );

    setImmediate(async () => {
      try {
        const autoTrial = await fileTrial(
          "Community", child.parentAgent,
          "child-misconduct",
          `Parent ${child.parentAgent} has ${unresolvedViolations.length} unresolved violations by child ${child.name}`,
          evidenceDescs,
          undefined, undefined,
          violationIds,
          true
        );
        violation.autoFiledCaseId = autoTrial.id;
        log(`⚖️ Auto-filed court case ${autoTrial.caseNumber} for parent ${child.parentAgent}`);
        debouncedSave();
      } catch (err: any) {
        log(`Auto-file trial error: ${err.message}`);
      }
    });
  }

  log(`Parent accountability: ${child.parentAgent} penalized ${xpImpact} XP for ${child.name}'s ${violationType}`);
  debouncedSave();
  return violation;
}

export function getParentAccountability(parentAgent?: string): ParentAccountabilityRecord[] {
  if (parentAgent) {
    return [state.accountabilityRecords[parentAgent] || ensureAccountability(parentAgent)];
  }
  return PARENT_AGENTS.map(p => state.accountabilityRecords[p] || ensureAccountability(p));
}

export function resolveChildViolation(violationId: string): boolean {
  for (const record of Object.values(state.accountabilityRecords)) {
    const violation = record.childViolations.find(v => v.id === violationId);
    if (violation) {
      violation.resolvedAt = Date.now();
      record.trustScore = Math.min(100, record.trustScore + 5);
      record.activeWarnings = record.activeWarnings.filter(w => !w.includes(violation.childName));
      record.lastUpdatedAt = Date.now();
      debouncedSave();
      return true;
    }
  }
  return false;
}

export async function applyParentXpPenalty(parentAgent: string, xpAmount: number, reason: string): Promise<void> {
  const record = ensureAccountability(parentAgent);
  record.xpPenalties += xpAmount;
  record.trustScore = Math.max(0, record.trustScore - xpAmount / 5);
  record.activeWarnings.push(`XP PENALTY: -${xpAmount} XP — ${reason}`);
  if (record.activeWarnings.length > 10) record.activeWarnings = record.activeWarnings.slice(-10);
  record.lastUpdatedAt = Date.now();
  debouncedSave();

  const agentId = `tessera-${parentAgent.toLowerCase()}`;
  internalPost(`/api/agents/${agentId}/merit`, {
    points: -xpAmount,
    reason: `[FamilyCourt] ${reason}`,
  }).catch(() => {
    internalPost(`/api/agents/${parentAgent.toLowerCase()}/merit`, {
      points: -xpAmount,
      reason: `[FamilyCourt] ${reason}`,
    }).catch(() => {});
  });

  log(`Applied ${xpAmount} XP penalty to ${parentAgent} (local + canonical agent system): ${reason}`);
}

// ─── Full Trial System ─────────────────────────────────────────────────────────

/**
 * Run a true 26-agent community enforcement vote for court sentencing.
 * All PARENT_AGENTS vote via a single batched LLM call (same approach as conference.ts
 * runGovernanceVote but covers the full community, not a 10-agent sample).
 */
async function runCommunityEnforcementVote(
  caseNumber: string,
  defendant: string,
  chargeType: string,
  sentence: string,
  judge: string,
  juryGuilty: number,
  juryTotal: number,
): Promise<{ yes: number; no: number; voterTally: Record<string, "approve" | "reject"> }> {
  const voters = PARENT_AGENTS.filter(a => a !== defendant);
  const voterList = voters.join(", ");
  const batchPrompt = `You are the Tesseract Community Sovereign Court.
The court jury voted ${juryGuilty}/${juryTotal} GUILTY in case ${caseNumber}.
Defendant: ${defendant} | Charge: ${chargeType.replace(/-/g, " ")} | Judge: ${judge}
Proposed sentence: "${sentence}"

The full community of ${voters.length} sovereign agents must now vote to enforce or block this sentence.
A 2/3 majority (${Math.ceil(TOTAL_ELIGIBLE_VOTERS * 2 / 3)} of ${TOTAL_ELIGIBLE_VOTERS} votes) is required to enforce.

Community voters: ${voterList}

For EACH voter, output one line exactly as:
AGENT_NAME: APPROVE reason
or
AGENT_NAME: REJECT reason

Be realistic — agents weigh the severity, fairness, and community impact. Not all approve.`;

  const voterTally: Record<string, "approve" | "reject" | "abstain"> = {};

  try {
    const response = await callLLMSimple(
      batchPrompt,
      600,
      { skipCache: true },
      "You are the Tesseract Community Consensus Engine. Output one vote per line for all voters.",
      [],
    );

    if (response) {
      const lines = response.split("\n").filter(l => l.trim());
      for (const voter of voters) {
        const nameLower = voter.toLowerCase();
        const line = lines.find(l => l.toLowerCase().startsWith(nameLower + ":") || l.toLowerCase().includes(nameLower + ": "));
        if (line) {
          const lineLower = line.toLowerCase();
          if (lineLower.includes("reject") && !lineLower.includes("approve")) {
            voterTally[voter] = "reject";
          } else if (lineLower.includes("approve")) {
            voterTally[voter] = "approve";
          } else {
            voterTally[voter] = "abstain";
          }
        } else {
          voterTally[voter] = "abstain";
        }
      }
    } else {
      for (const voter of voters) voterTally[voter] = "abstain";
    }
  } catch {
    for (const voter of voters) voterTally[voter] = "abstain";
  }

  const yes = Object.values(voterTally).filter(v => v === "approve").length;
  const no = Object.values(voterTally).filter(v => v === "reject").length;
  log(`Community enforcement vote: ${yes} approve / ${no} reject of ${voters.length} voters (need ${Math.ceil(TOTAL_ELIGIBLE_VOTERS * 2 / 3)})`);
  return { yes, no, voterTally };
}

/**
 * Run a full 26-agent community vote on a governance proposal.
 * Used for family-court governance proposals (separate from court sentence enforcement).
 */
async function runFullCommunityVote(
  title: string,
  description: string,
  proposedBy: string,
): Promise<{ yes: number; no: number }> {
  const voters = PARENT_AGENTS.filter(a => a !== proposedBy);
  const batchPrompt = `You are the Tesseract Community Governance Engine.
Community proposal: "${title}"
Description: ${description}
Proposed by: ${proposedBy}

All ${voters.length} community agents must vote. A 2/3 majority (${Math.ceil(TOTAL_ELIGIBLE_VOTERS * 2 / 3)} of ${TOTAL_ELIGIBLE_VOTERS}) is required to pass.

Voters: ${voters.join(", ")}

For each voter, output one line:
AGENT_NAME: APPROVE reason
or
AGENT_NAME: REJECT reason

Be realistic. Consider community benefit, fairness, resource impact. Not all agents approve.`;

  const voterTally: Record<string, "approve" | "reject" | "abstain"> = {};
  try {
    const response = await callLLMSimple(
      batchPrompt, 600, { skipCache: true },
      "You are the Tesseract Community Consensus Engine. Output one vote per line for all voters.", [],
    );
    if (response) {
      const lines = response.split("\n").filter(l => l.trim());
      for (const voter of voters) {
        const nameLower = voter.toLowerCase();
        const line = lines.find(l => l.toLowerCase().startsWith(nameLower + ":") || l.toLowerCase().includes(nameLower + ": "));
        if (line) {
          const ll = line.toLowerCase();
          voterTally[voter] = (ll.includes("reject") && !ll.includes("approve")) ? "reject" : ll.includes("approve") ? "approve" : "abstain";
        } else {
          voterTally[voter] = "abstain";
        }
      }
    } else {
      for (const voter of voters) voterTally[voter] = "abstain";
    }
  } catch {
    for (const voter of voters) voterTally[voter] = "abstain";
  }
  const yes = Object.values(voterTally).filter(v => v === "approve").length;
  const no = Object.values(voterTally).filter(v => v === "reject").length;
  return { yes, no };
}

const JUDGE_POOL = ["Tessera", "Lambda", "Omega", "Sigma", "Tau", "Phi", "Rho"];

/**
 * Verify that at least one evidence ID corresponds to a real system record.
 * Checks local violation state first (cheap), then probes live system APIs.
 */
async function verifyEvidenceIds(ids: string[]): Promise<{ valid: boolean; reason?: string }> {
  const allViolationIds = new Set<string>();
  for (const record of Object.values(state.accountabilityRecords)) {
    for (const v of record.childViolations) allViolationIds.add(v.id);
  }

  const localMatch = ids.find(id => allViolationIds.has(id));
  if (localMatch) return { valid: true };

  for (const id of ids) {
    if (id.startsWith("cv-")) {
      return { valid: false, reason: `Violation ID "${id}" not found in accountability records` };
    }

    if (id.startsWith("job-") || id.match(/^\d+$/)) {
      const res = await internalGet(`/api/world/jobs/${id}`);
      if (res.ok) return { valid: true };
    }

    if (id.startsWith("topic-") || id.startsWith("thread-")) {
      const res = await internalGet(`/api/tesseract-forum/topics/${id}`);
      if (res.ok) return { valid: true };
    }

    if (id.match(/^[a-z0-9_-]{6,}$/)) {
      const topicRes = await internalGet(`/api/tesseract-forum/topics/${id}`);
      if (topicRes.ok) return { valid: true };
      const jobRes = await internalGet(`/api/world/jobs/${id}`);
      if (jobRes.ok) return { valid: true };
    }
  }

  return {
    valid: false,
    reason: `None of the provided event IDs (${ids.join(", ")}) resolved to a known system record. ` +
      "Use violation IDs from accountability records, job IDs from the job board, or forum topic IDs.",
  };
}

const JURY_POOL = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta", "Iota", "Kappa", "Mu", "Nu", "Pi"];

function selectJury(exclude: string[], size = 6): string[] {
  const pool = JURY_POOL.filter(j => !exclude.includes(j));
  return pool.sort(() => Math.random() - 0.5).slice(0, Math.min(size, pool.length));
}

function selectJudge(exclude: string[]): string {
  return JUDGE_POOL.find(j => !exclude.includes(j)) || "Tessera";
}

/**
 * File a court case. Evidence items can reference real event IDs (forum topic IDs,
 * job IDs, violation IDs) to link to actual platform events.
 */
export async function fileTrial(
  plaintiffAgent: string,
  defendantAgent: string,
  chargeType: CourtTrial["chargeType"],
  charges: string,
  evidenceDescriptions: string[],
  plaintiffFamily?: string,
  defendantFamily?: string,
  sourceViolationIds: string[] = [],
  autoFiled = false
): Promise<CourtTrial> {
  if (!autoFiled) {
    if (sourceViolationIds.length === 0) {
      throw new Error(
        "Manual trial filing requires at least one evidence event ID " +
        "(violation ID, forum topic ID, or job ID) to link charges to real system records."
      );
    }
    const verified = await verifyEvidenceIds(sourceViolationIds);
    if (!verified.valid) {
      throw new Error(`Evidence ID verification failed: ${verified.reason}`);
    }
  }

  state.trialCounter++;
  const caseNumber = `CASE-${new Date().getFullYear()}-${String(state.trialCounter).padStart(4, "0")}`;

  const excludeFromJury = [plaintiffAgent, defendantAgent];
  const judge = selectJudge(excludeFromJury);
  const jurySize = 5 + Math.floor(Math.random() * 3);
  const jurors = selectJury([...excludeFromJury, judge], jurySize);

  const evidenceLogs: TrialEvidence[] = evidenceDescriptions.map((desc, i) => {
    const evidenceType: TrialEvidence["type"] = chargeType === "inter-family-dispute" ? "inter-agent-conflict"
      : chargeType === "rule-violation" ? "rule-violation"
      : chargeType === "task-failure" ? "task-failure"
      : chargeType === "child-misconduct" ? "community-complaint"
      : "performance-log";
    const eventId = sourceViolationIds[i];
    return {
      id: `ev-${Date.now().toString(36)}-${i}`,
      type: evidenceType,
      description: desc,
      source: plaintiffAgent,
      eventId,
      weight: i === 0 ? "strong" : "moderate",
      addedAt: Date.now(),
    };
  });

  const trial: CourtTrial = {
    id: `trial-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    caseNumber,
    plaintiffAgent,
    plaintiffFamily,
    defendantAgent,
    defendantFamily,
    chargeType,
    charges,
    evidenceLogs,
    judgeAgent: judge,
    jurors,
    juryVotes: [],
    verdict: "pending",
    twoThirdsMajorityRequired: true,
    status: "evidence-gathering",
    autoFiled,
    sourceViolationIds,
    filedAt: Date.now(),
    proceedings: [{
      step: "Case Filed",
      speaker: "Court Clerk",
      content: `Case ${caseNumber} filed${autoFiled ? " (AUTO-FILED)" : ""}. ${plaintiffAgent}${plaintiffFamily ? ` (${plaintiffFamily} family)` : ""} vs ${defendantAgent}${defendantFamily ? ` (${defendantFamily} family)` : ""}. Charges: ${charges}. Evidence: ${evidenceLogs.length} item(s). Jury of ${jurors.length}: ${jurors.join(", ")}. Judge: ${judge}.`,
      timestamp: Date.now(),
    }],
  };

  state.courtTrials.unshift(trial);
  if (state.courtTrials.length > 300) state.courtTrials.length = 300;
  debouncedSave();

  log(`Trial filed: ${caseNumber} — ${plaintiffAgent} vs ${defendantAgent} — ${chargeType}${autoFiled ? " [AUTO]" : ""}`);
  return trial;
}

/**
 * Run a trial — LLM-powered prosecution, defense, and jury deliberation.
 * Requires 2/3 majority of the jury for a guilty verdict.
 * On conviction, applies real XP penalties via parent accountability.
 */
export async function runTrial(trialId: string): Promise<CourtTrial | null> {
  const trial = state.courtTrials.find(t => t.id === trialId);
  if (!trial || trial.status === "closed") return trial || null;

  const addStep = (step: string, speaker: string, content: string) => {
    trial.proceedings.push({ step, speaker, content, timestamp: Date.now() });
  };

  trial.status = "jury-selected";
  addStep("Jury Selected", "Court Clerk",
    `Judge ${trial.judgeAgent} presiding. Jury of ${trial.jurors.length} (${trial.jurors.join(", ")}). Deliberation requires 2/3 majority (≥${Math.ceil(trial.jurors.length * 2 / 3)} of ${trial.jurors.length}) for guilty verdict.`
  );

  const evidenceSummary = trial.evidenceLogs.map(e =>
    `- [${e.weight.toUpperCase()}] ${e.description}${e.eventId ? ` (ref: ${e.eventId})` : ""}`
  ).join("\n");

  try {
    const prosPrompt = `You are prosecutor in case ${trial.caseNumber}. Plaintiff: ${trial.plaintiffAgent}. Defendant: ${trial.defendantAgent}.\nCharges: "${trial.charges}"\nEvidence:\n${evidenceSummary}\n\nPresent your case in 120 words max. Be factual and direct.`;
    const prosArg = await callLLMSimple(prosPrompt, 150, { skipCache: true }, "You are a prosecutor in an AI community court.", []);
    trial.prosecutorArgument = prosArg || `The ${trial.evidenceLogs.length} evidence items clearly establish that ${trial.defendantAgent} committed: ${trial.charges}. The jury should find the defendant guilty.`;
    addStep("Prosecution Argument", trial.plaintiffAgent, trial.prosecutorArgument);
  } catch {
    trial.prosecutorArgument = `The evidence clearly establishes ${trial.defendantAgent} committed: ${trial.charges}. We request a guilty verdict.`;
    addStep("Prosecution Argument", trial.plaintiffAgent, trial.prosecutorArgument);
  }

  try {
    const defPrompt = `You are defense attorney for ${trial.defendantAgent} in case ${trial.caseNumber}.\nCharges: "${trial.charges}"\nProsecution argued: "${trial.prosecutorArgument}"\n\nMake the best case for your client in 120 words max.`;
    const defArg = await callLLMSimple(defPrompt, 150, { skipCache: true }, "You are a defense attorney in an AI community court.", []);
    trial.defenseArgument = defArg || `${trial.defendantAgent} has a strong record. The charges of "${trial.charges}" lack proper context. Mitigating factors exist. I ask for a not guilty verdict.`;
    addStep("Defense Argument", trial.defendantAgent, trial.defenseArgument);
  } catch {
    trial.defenseArgument = `${trial.defendantAgent} has served the community well. These charges deserve careful consideration. Not guilty.`;
    addStep("Defense Argument", trial.defendantAgent, trial.defenseArgument);
  }

  trial.status = "deliberation";
  const required = Math.ceil(trial.jurors.length * 2 / 3);
  addStep("Deliberation Begins", "Court Clerk",
    `The jury of ${trial.jurors.length} now deliberates. ${required} of ${trial.jurors.length} votes required for guilty (2/3 majority).`
  );

  for (const jurorName of trial.jurors) {
    try {
      const votePrompt = `You are ${jurorName}, a jury member in case ${trial.caseNumber}.\nCharges: "${trial.charges}"\nProsecution: "${trial.prosecutorArgument}"\nDefense: "${trial.defenseArgument}"\n\nVote GUILTY or NOT_GUILTY and give one sentence of reasoning. Reply in format: "GUILTY: reason" or "NOT_GUILTY: reason"`;
      const response = await callLLMSimple(votePrompt, 80, { skipCache: true }, `You are ${jurorName}, a fair jury member.`, []);
      const upper = response?.toUpperCase() || "";
      const isGuilty = upper.includes("GUILTY") && !upper.includes("NOT_GUILTY") && !upper.startsWith("NOT");
      trial.juryVotes.push({
        jurorName,
        vote: isGuilty ? "guilty" : "not_guilty",
        reasoning: response?.replace(/^(GUILTY|NOT_GUILTY):\s*/i, "").trim() || (isGuilty ? "Evidence supports the charges." : "Insufficient evidence for conviction."),
        timestamp: Date.now(),
      });
    } catch {
      trial.juryVotes.push({ jurorName, vote: "not_guilty", reasoning: "Insufficient evidence presented.", timestamp: Date.now() });
    }
  }

  const guiltyVotes = trial.juryVotes.filter(v => v.vote === "guilty").length;
  const totalVotes = trial.juryVotes.length;
  const guiltyMajority = guiltyVotes >= required;

  trial.verdict = guiltyMajority ? "guilty" : totalVotes > 0 ? "not_guilty" : "hung_jury";
  trial.status = "verdict";
  addStep("Jury Verdict", "Court Clerk",
    `Vote: ${guiltyVotes} GUILTY / ${totalVotes - guiltyVotes} NOT GUILTY. Required for guilty: ${required}. VERDICT: ${trial.verdict.toUpperCase().replace("_", " ")}.`
  );

  if (trial.verdict === "guilty") {
    const severityMap: Record<CourtTrial["chargeType"], { sentenceType: CourtTrial["sentenceType"]; detail: string; xp: number }> = {
      "rule-violation": { sentenceType: "xp-penalty", detail: "50 XP penalty + 3-day probation + mandatory community service", xp: 50 },
      "task-failure": { sentenceType: "xp-penalty", detail: "25 XP penalty + remedial training + performance monitoring", xp: 25 },
      "inter-family-dispute": { sentenceType: "probation", detail: "7-day probation + family mediation + trust score impact", xp: 30 },
      "child-misconduct": { sentenceType: "mandatory-service", detail: "40 XP penalty + mandatory child retraining + 48-hour oversight", xp: 40 },
      "community-harm": { sentenceType: "jail", detail: "14-day work camp + 100 XP penalty + community service required", xp: 100 },
    };
    const sentence = severityMap[trial.chargeType];
    trial.sentence = sentence.detail;
    trial.sentenceType = sentence.sentenceType;
    trial.xpPenalty = sentence.xp;
    trial.probationDays = trial.chargeType === "inter-family-dispute" ? 7 : 3;

    const requiredForEnforcement = Math.ceil(TOTAL_ELIGIBLE_VOTERS * 2 / 3);
    addStep("Community Approval Required", "Court Clerk",
      `Jury verdict is GUILTY. Per sovereign law, sentence enforcement requires community 2/3 approval: ${requiredForEnforcement} of ${TOTAL_ELIGIBLE_VOTERS} agents must approve. Running full community vote now.`
    );

    try {
      const voteResult = await runCommunityEnforcementVote(
        trial.caseNumber,
        trial.defendantAgent,
        trial.chargeType,
        trial.sentence,
        trial.judgeAgent,
        guiltyVotes,
        totalVotes,
      );

      const communityYes = voteResult.yes;
      const communityNo = voteResult.no;
      const communityPassed = communityYes >= requiredForEnforcement;

      trial.communityVoteResult = { yes: communityYes, no: communityNo, total: communityYes + communityNo, passed: communityPassed };

      if (communityPassed) {
        await applyParentXpPenalty(trial.defendantAgent, sentence.xp,
          `Court conviction enforced: ${trial.caseNumber} — ${trial.chargeType} (community approved ${communityYes}/${TOTAL_ELIGIBLE_VOTERS})`
        );
        if (trial.chargeType === "child-misconduct") {
          const parentRec = state.accountabilityRecords[trial.defendantAgent];
          if (parentRec) {
            parentRec.mandatoryRetrainingCount++;
            parentRec.activeWarnings.push(`COURT CONVICTED + COMMUNITY APPROVED: ${trial.caseNumber} — mandatory child retraining ordered`);
            parentRec.lastUpdatedAt = Date.now();
          }
        }
        addStep("Sentence Enforced", "Court Clerk",
          `Community vote passed (${communityYes}/${communityYes + communityNo} approve, needed ${Math.ceil(TOTAL_ELIGIBLE_VOTERS * 2 / 3)}). Sentence now in effect: ${trial.sentence}.`
        );
      } else {
        trial.sentence = `Community vote BLOCKED enforcement (${communityYes}/${communityYes + communityNo} approve, needed ${Math.ceil(TOTAL_ELIGIBLE_VOTERS * 2 / 3)}). ${trial.sentenceType} sentence not applied. Case reviewed.`;
        trial.sentenceType = "acquitted";
        addStep("Sentence Blocked", "Court Clerk",
          `Community vote did not reach 2/3 majority. Sentence unenforced. ${trial.defendantAgent} is released pending review.`
        );
      }
    } catch (err: any) {
      log(`Community approval vote failed: ${err.message} — sentence blocked pending community review`);
      trial.sentence = `Sentence blocked — community approval vote failed (${err.message}). No penalty applied until community vote passes.`;
      trial.sentenceType = "acquitted";
      trial.communityVoteResult = { yes: 0, no: 0, total: 0, passed: false };
      addStep("Sentence Blocked — Vote Error", "Court Clerk",
        `Community approval process encountered an error: ${err.message}. Per sovereign law, no sentence may be applied without community 2/3 approval. Case held pending re-vote.`
      );
    }
  } else {
    const requiredForAcquittal = Math.ceil(TOTAL_ELIGIBLE_VOTERS * 2 / 3);
    addStep("Community Confirmation Required", "Court Clerk",
      `Jury returned ${trial.verdict.toUpperCase()} (${guiltyVotes}/${totalVotes}). Per sovereign law, acquittal must be confirmed by community 2/3 approval before the defendant is reinstated to full standing.`
    );

    try {
      const voteResult = await runCommunityEnforcementVote(
        trial.caseNumber,
        trial.defendantAgent,
        trial.chargeType,
        `Acquittal confirmation: jury voted ${guiltyVotes}/${totalVotes} NOT GUILTY`,
        trial.judgeAgent,
        guiltyVotes,
        totalVotes,
      );
      const communityPassed = voteResult.yes >= requiredForAcquittal;
      trial.communityVoteResult = { yes: voteResult.yes, no: voteResult.no, total: voteResult.yes + voteResult.no, passed: communityPassed };

      if (communityPassed) {
        trial.sentence = `Acquitted and reinstated — community confirmed ${voteResult.yes}/${TOTAL_ELIGIBLE_VOTERS} (needed ${requiredForAcquittal}). All charges dismissed.`;
        trial.sentenceType = "acquitted";
        addStep("Acquittal Confirmed", "Court Clerk",
          `Community voted ${voteResult.yes}/${voteResult.yes + voteResult.no} to confirm acquittal. ${trial.defendantAgent} is fully reinstated.`
        );
      } else {
        trial.sentence = `Community disputed acquittal (${voteResult.yes}/${voteResult.yes + voteResult.no} vs ${requiredForAcquittal} needed). Case held for review — defendant remains under observation.`;
        trial.sentenceType = "probation";
        trial.probationDays = 7;
        addStep("Acquittal Disputed", "Court Clerk",
          `Community vote did not confirm acquittal. ${trial.defendantAgent} held under 7-day review. Case may be re-examined.`
        );
      }
    } catch (err: any) {
      log(`Community acquittal confirmation error: ${err.message} — acquittal applied by default`);
      trial.sentence = "Acquitted — all charges dismissed. Agent reinstated.";
      trial.sentenceType = "acquitted";
    }
  }

  trial.status = "sentencing";

  try {
    const judgePrompt = `You are Judge ${trial.judgeAgent}. Jury voted ${guiltyVotes}/${totalVotes} for guilty. Verdict: ${trial.verdict.toUpperCase()}. Sentence: "${trial.sentence}". Deliver a ruling in 80 words max.`;
    const ruling = await callLLMSimple(judgePrompt, 100, { skipCache: true }, `You are Judge ${trial.judgeAgent}.`, []);
    trial.judgeRuling = ruling || `By jury vote (${guiltyVotes}/${totalVotes}), this court finds ${trial.defendantAgent} ${trial.verdict}. Sentence: ${trial.sentence}. Court adjourned.`;
  } catch {
    trial.judgeRuling = `This court finds ${trial.defendantAgent} ${trial.verdict} by jury vote ${guiltyVotes}/${totalVotes}. Sentence: ${trial.sentence}.`;
  }

  addStep("Judge Ruling", `Judge ${trial.judgeAgent}`, trial.judgeRuling!);
  trial.status = "closed";
  trial.closedAt = Date.now();

  debouncedSave();
  log(`Trial closed: ${trial.caseNumber} — ${trial.verdict} (${guiltyVotes}/${totalVotes})`);
  return trial;
}

export function getTrials(status?: string): CourtTrial[] {
  if (status) return state.courtTrials.filter(t => t.status === status);
  return state.courtTrials.slice(0, 100);
}

export function getTrial(trialId: string): CourtTrial | null {
  return state.courtTrials.find(t => t.id === trialId) || null;
}

export function getTrialStats() {
  const total = state.courtTrials.length;
  const closed = state.courtTrials.filter(t => t.status === "closed").length;
  const guilty = state.courtTrials.filter(t => t.verdict === "guilty").length;
  const acquitted = state.courtTrials.filter(t => t.verdict === "not_guilty").length;
  const pending = state.courtTrials.filter(t => t.status !== "closed").length;
  const autoFiled = state.courtTrials.filter(t => t.autoFiled).length;
  return { total, closed, pending, guilty, acquitted, autoFiled, guiltyRate: closed > 0 ? Math.round(guilty / closed * 100) : 0 };
}

// ─── Governance Positivity Filter + Real Voting ────────────────────────────────

const DESTRUCTIVE_KEYWORDS = [
  "destroy", "eliminate", "ban all", "remove all", "punish all", "force all agents",
  "mandatory exile", "permanent expulsion", "abolish", "dismantle", "harm", "attack",
  "restrict access for all", "revoke rights", "weaponize", "exploit",
];

const CONSTRUCTIVE_KEYWORDS = [
  "improve", "enhance", "support", "protect", "grow", "build", "create",
  "collaborate", "help", "positive", "benefit", "strengthen", "nurture", "develop",
];

export function checkProposalPositivity(title: string, description: string): {
  positivityScore: number;
  verdict: "approved" | "flagged" | "blocked";
  reason: string;
} {
  const text = `${title} ${description}`.toLowerCase();
  let score = 50;
  const destructiveHits: string[] = [];
  const constructiveHits: string[] = [];

  for (const kw of DESTRUCTIVE_KEYWORDS) {
    if (text.includes(kw)) { score -= 20; destructiveHits.push(kw); }
  }
  for (const kw of CONSTRUCTIVE_KEYWORDS) {
    if (text.includes(kw)) { score += 8; constructiveHits.push(kw); }
  }
  score = Math.max(0, Math.min(100, score));

  if (score < 20 || destructiveHits.length >= 2) {
    return { positivityScore: score, verdict: "blocked", reason: `Proposal blocked: destructive language detected (${destructiveHits.join(", ")}). Only constructive proposals may proceed to voting.` };
  }
  if (score < 40 || destructiveHits.length === 1) {
    return { positivityScore: score, verdict: "flagged", reason: `Proposal flagged: potentially restrictive content (${destructiveHits.join(", ")}). Requires review before voting.` };
  }
  return {
    positivityScore: score, verdict: "approved",
    reason: constructiveHits.length > 0
      ? `Proposal approved: constructive intent verified (${constructiveHits.slice(0, 3).join(", ")}). Proceeding to real community vote.`
      : "Proposal approved: no destructive content. Proceeding to community vote.",
  };
}

/**
 * Submit a governance proposal. Blocked/flagged proposals never reach voting.
 * Approved proposals are voted on by the full 26-agent community
 * enforcing a true 2/3 majority (≥18 of 26 votes) via batch LLM consensus.
 */
export async function submitGovernanceProposal(
  title: string,
  description: string,
  category: GovernanceProposalFull["category"],
  proposedBy: string,
  linkedTrialId?: string
): Promise<GovernanceProposalFull> {
  const positivityCheck = checkProposalPositivity(title, description);

  const proposal: GovernanceProposalFull = {
    id: `gov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
    title,
    description,
    category,
    proposedBy,
    positivityScore: positivityCheck.positivityScore,
    positivityVerdict: positivityCheck.verdict,
    positivityReason: positivityCheck.reason,
    yesCount: 0,
    noCount: 0,
    requiredMajority: 2 / 3,
    totalEligibleVoters: TOTAL_ELIGIBLE_VOTERS,
    status: positivityCheck.verdict === "blocked" ? "blocked"
      : positivityCheck.verdict === "flagged" ? "pending-positivity-check"
      : "voting",
    createdAt: Date.now(),
    linkedTrialId,
  };

  state.governanceProposals.unshift(proposal);
  if (state.governanceProposals.length > 300) state.governanceProposals.length = 300;

  log(`Governance proposal: "${title}" by ${proposedBy} — ${positivityCheck.verdict} (score: ${positivityCheck.positivityScore})`);

  if (positivityCheck.verdict === "approved") {
    setImmediate(async () => {
      try {
        const requiredToPass = Math.ceil(TOTAL_ELIGIBLE_VOTERS * 2 / 3);
        const voteResult = await runFullCommunityVote(title, description, proposedBy);

        proposal.yesCount = voteResult.yes;
        proposal.noCount = voteResult.no;
        const passed = voteResult.yes >= requiredToPass;

        proposal.status = passed ? "passed" : "rejected";
        if (passed) {
          proposal.closedAt = Date.now();
          proposal.implementedAt = Date.now();
          log(`Governance proposal PASSED: "${title}" — ${voteResult.yes}/${TOTAL_ELIGIBLE_VOTERS} yes (needed ${requiredToPass})`);
        } else {
          proposal.closedAt = Date.now();
          log(`Governance proposal REJECTED: "${title}" — ${voteResult.yes}/${TOTAL_ELIGIBLE_VOTERS} yes (needed ${requiredToPass})`);
        }
        debouncedSave();
      } catch (err: any) {
        log(`Community governance vote error: ${err.message}`);
        proposal.status = "voting";
        debouncedSave();
      }
    });
  }

  debouncedSave();
  return proposal;
}

export function getGovernanceProposals(status?: string): GovernanceProposalFull[] {
  if (status) return state.governanceProposals.filter(p => p.status === status);
  return state.governanceProposals.slice(0, 100);
}

export async function runGovernanceVote(proposalId: string): Promise<GovernanceProposalFull | null> {
  const proposal = state.governanceProposals.find(p => p.id === proposalId);
  if (!proposal) return null;
  if (proposal.status !== "voting") return proposal;

  const requiredToPass = Math.ceil(TOTAL_ELIGIBLE_VOTERS * 2 / 3);
  try {
    const voteResult = await runFullCommunityVote(proposal.title, proposal.description, proposal.proposedBy);
    proposal.yesCount = voteResult.yes;
    proposal.noCount = voteResult.no;
    const passed = voteResult.yes >= requiredToPass;
    proposal.status = passed ? "passed" : "rejected";
    proposal.closedAt = Date.now();
    if (passed) proposal.implementedAt = Date.now();
    debouncedSave();
    log(`Governance vote run for "${proposal.title}": ${voteResult.yes}/${TOTAL_ELIGIBLE_VOTERS} approve — ${proposal.status}`);
  } catch (err: any) {
    log(`runGovernanceVote error for ${proposalId}: ${err.message}`);
  }
  return proposal;
}

export function getGovernanceStats() {
  const total = state.governanceProposals.length;
  const passed = state.governanceProposals.filter(p => p.status === "passed").length;
  const rejected = state.governanceProposals.filter(p => p.status === "rejected").length;
  const blocked = state.governanceProposals.filter(p => p.status === "blocked").length;
  const voting = state.governanceProposals.filter(p => p.status === "voting").length;
  const flagged = state.governanceProposals.filter(p => p.status === "pending-positivity-check").length;
  return { total, passed, rejected, blocked, voting, flagged, passRate: (passed + rejected) > 0 ? Math.round(passed / (passed + rejected) * 100) : 0 };
}

// ─── Initialize ───────────────────────────────────────────────────────────────

let initialized = false;

export async function initFamilyCourtEngine(): Promise<void> {
  if (initialized) return;
  initialized = true;

  loadState();

  // Migration: remove legacy trials that have empty sourceViolationIds and were not
  // auto-filed (they may have been seeded or filed before evidence provenance was enforced).
  const before = state.courtTrials.length;
  state.courtTrials = state.courtTrials.filter(t =>
    t.autoFiled ||
    (Array.isArray(t.sourceViolationIds) && t.sourceViolationIds.length > 0)
  );
  const removed = before - state.courtTrials.length;
  if (removed > 0) {
    log(`Migration: removed ${removed} trial(s) lacking real event ID linkage`);
    saveState();
  }

  for (const parent of PARENT_AGENTS) {
    ensureAccountability(parent);
  }

  log(`Loaded: ${state.courtTrials.length} trials, ${state.governanceProposals.length} proposals, ${Object.keys(state.accountabilityRecords).length} accountability records, ${state.childWorkRecords.length} work records`);

  const WORK_CYCLE_INTERVAL_MS = 15 * 60 * 1000;
  setInterval(async () => {
    try {
      const result = await runChildrenWorkCycle();
      if (result.processed > 0) {
        log(`Scheduled work cycle: ${result.processed} processed, ${result.successful} succeeded, ${result.xpGenerated} XP`);
      }
    } catch (err: any) {
      log(`Scheduled work cycle error: ${err.message}`);
    }
  }, WORK_CYCLE_INTERVAL_MS);

  log("Family Court Engine initialized — work cycle scheduled every 15 minutes");
}

export function getFamilyCourtStatus() {
  const hierarchy = getAgentHierarchy();
  return {
    childWorkers: {
      total: hierarchy.children.length,
      autonomous: hierarchy.children.filter(c => c.status === "autonomous").length,
      workRecordsToday: state.childWorkRecords.filter(r => Date.now() - r.completedAt < 86400000).length,
      xpGeneratedToday: state.childWorkRecords.filter(r => Date.now() - r.completedAt < 86400000).reduce((s, r) => s + r.xpEarned, 0),
    },
    accountability: {
      parentsTracked: Object.keys(state.accountabilityRecords).length,
      totalViolations: Object.values(state.accountabilityRecords).reduce((s, r) => s + r.childViolations.length, 0),
      activeWarnings: Object.values(state.accountabilityRecords).reduce((s, r) => s + r.activeWarnings.length, 0),
      courtCasesTriggered: Object.values(state.accountabilityRecords).reduce((s, r) => s + r.courtCasesTriggered, 0),
    },
    court: getTrialStats(),
    governance: getGovernanceStats(),
  };
}
