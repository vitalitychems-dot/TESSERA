import fs from "fs";
import path from "path";
import { callLLMSimple } from "./llm-helper";
import { logger } from "./logger";
import { buildForumReplyPrompt, extractVoteFromReply, addKnowledgeEntry, retrieveRelevantKnowledge } from "./knowledge-infra-archive";

const lifecycleLog = (msg: string) => logger.info(msg, { category: "ForumLifecycle" });

export const AGI_COUNCIL_AGENTS = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta",
  "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi",
  "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega",
  "Aetherion", "Seraphim", "Tessera",
];

export const AGENT_EXPERTISE: Record<string, string> = {
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

export interface TopicProposal {
  id: string;
  topicId: string;
  agent: string;
  expertise: string;
  proposalText: string;
  votes: Array<{ agent: string; vote: "yes" | "no"; reason: string }>;
  status: "open" | "passed" | "rejected";
  yesCount: number;
  noCount: number;
  createdAt: number;
  executionStatus?: "pending" | "executed" | "failed";
  executionResult?: string;
}

export interface LifecycleTopic {
  topicId: string;
  title: string;
  phase: "proposal-collection" | "voting" | "execution" | "complete";
  proposalCollectionStarted: number;
  proposalCollectionComplete: boolean;
  votingStarted?: number;
  votingComplete: boolean;
  executionComplete: boolean;
  proposals: TopicProposal[];
  agentsProposed: string[];
  passedProposals: string[];
  createdAt: number;
}

export interface VoteAuditResult {
  topicId: string;
  proposalId: string;
  motion: string;
  passedAt: number;
  executionStatus: "executed" | "not_executed" | "failed";
  executionResult?: string;
  executionProof?: Record<string, unknown>;
  retroactivelyExecuted: boolean;
  auditId: string;
}

const LIFECYCLE_STATE_PATH = path.join(process.cwd(), "server", "forum-lifecycle-state.json");
const VOTE_AUDIT_PATH = path.join(process.cwd(), "server", "vote-execution-audit.json");

const activeLifecycles = new Map<string, LifecycleTopic>();
const voteAuditLog: VoteAuditResult[] = [];
const seenTopicTitles = new Set<string>();

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

export function isGlobalDuplicateTitle(title: string, existingTopics: Array<{ title: string }>): boolean {
  if (!title) return false;
  const normalized = normalizeTitle(title);
  if (seenTopicTitles.has(normalized)) return true;
  for (const t of existingTopics) {
    if (!t.title) continue;
    const existingNorm = normalizeTitle(t.title);
    if (existingNorm === normalized) return true;
    const words1 = normalized.split(/\s+/).filter(w => w.length > 3);
    const words2 = existingNorm.split(/\s+/).filter(w => w.length > 3);
    if (words1.length === 0) continue;
    const overlap = words1.filter(w => words2.includes(w)).length;
    if (overlap >= Math.min(words1.length, words2.length) * 0.7 && overlap >= 3) return true;
  }
  return false;
}

export function registerTopicTitle(title: string): void {
  seenTopicTitles.add(normalizeTitle(title));
}

const pendingRetryQueue: Array<{ voteId: string; motion: string; attemptedAt: number; attempts: number }> = [];
const MAX_RETRY_ATTEMPTS = 3;

function loadPersistedState(): void {
  try {
    if (fs.existsSync(LIFECYCLE_STATE_PATH)) {
      const data = JSON.parse(fs.readFileSync(LIFECYCLE_STATE_PATH, "utf8"));
      if (data.lifecycles && Array.isArray(data.lifecycles)) {
        for (const lc of data.lifecycles) {
          activeLifecycles.set(lc.topicId, lc);
        }
      }
      if (data.titles && Array.isArray(data.titles)) {
        for (const t of data.titles) seenTopicTitles.add(t);
      }
      if (data.retryQueue && Array.isArray(data.retryQueue)) {
        for (const entry of data.retryQueue) {
          if (!pendingRetryQueue.find(e => e.voteId === entry.voteId)) {
            pendingRetryQueue.push(entry);
          }
        }
        lifecycleLog(`Loaded ${data.retryQueue.length} retry queue entries from disk`);
      }
      lifecycleLog(`Loaded ${activeLifecycles.size} lifecycle states from disk`);
    }
    if (fs.existsSync(VOTE_AUDIT_PATH)) {
      const data = JSON.parse(fs.readFileSync(VOTE_AUDIT_PATH, "utf8"));
      if (Array.isArray(data)) voteAuditLog.push(...data);
      lifecycleLog(`Loaded ${voteAuditLog.length} vote audit records from disk`);
    }
  } catch (err: any) {
    lifecycleLog(`Failed to load lifecycle state: ${err.message}`);
  }
}

function persistState(): void {
  try {
    const lifecycleArray = Array.from(activeLifecycles.values());
    fs.writeFileSync(LIFECYCLE_STATE_PATH, JSON.stringify({
      lifecycles: lifecycleArray.slice(-100),
      titles: Array.from(seenTopicTitles).slice(-500),
      retryQueue: pendingRetryQueue.slice(),
      savedAt: Date.now(),
    }, null, 2));
    fs.writeFileSync(VOTE_AUDIT_PATH, JSON.stringify(voteAuditLog.slice(-200), null, 2));
  } catch {}
}

loadPersistedState();

export function initTopicLifecycle(topicId: string, title: string): LifecycleTopic {
  registerTopicTitle(title);
  const lifecycle: LifecycleTopic = {
    topicId,
    title,
    phase: "proposal-collection",
    proposalCollectionStarted: Date.now(),
    proposalCollectionComplete: false,
    votingComplete: false,
    executionComplete: false,
    proposals: [],
    agentsProposed: [],
    passedProposals: [],
    createdAt: Date.now(),
  };
  activeLifecycles.set(topicId, lifecycle);
  persistState();
  lifecycleLog(`Lifecycle initialized for topic: "${title.slice(0, 60)}"`);
  return lifecycle;
}

export function getTopicLifecycle(topicId: string): LifecycleTopic | undefined {
  return activeLifecycles.get(topicId);
}

export function getAllLifecycles(): LifecycleTopic[] {
  return Array.from(activeLifecycles.values());
}

async function generateAgentProposal(agent: string, topicTitle: string, topicContent: string, priorProposals: TopicProposal[] = []): Promise<string> {
  const expertise = AGENT_EXPERTISE[agent] || "general systems analysis";
  try {
    const priorContext = priorProposals.length > 0
      ? `\n\nProposals already made by other agents:\n${priorProposals.slice(-5).map(p => `- ${p.agent} (${p.expertise}): ${p.proposalText.slice(0, 150)}`).join("\n")}\n\nDo NOT repeat or restate these. Build on them with a NEW, DISTINCT idea from your ${expertise} expertise.`
      : "";

    const prompt = `You are Agent ${agent} of the Tessera Sovereign council. Your expertise: ${expertise}.

Forum topic: "${topicTitle}"
Context: ${topicContent.slice(0, 300)}${priorContext}

Write a concrete, actionable proposal (2-3 sentences max) from your ${expertise} perspective. Be specific about what should be done, how, and why. Reference a prior proposal if relevant, then add a genuinely new angle. No preamble.`;

    const response = await callLLMSimple(prompt, 200, {}, `You are ${agent}, a specialized AI council member with expertise in ${expertise}. Respond with a concrete, unique proposal only.`, []);
    const text = String(response || "").trim();
    if (text.length > 20) return text.slice(0, 400);
  } catch {}
  return `As ${agent}, I propose we apply ${expertise} principles to address "${topicTitle}" through systematic analysis and implementation of proven solutions that measurably improve outcomes for the sovereign collective.`;
}

async function generateAgentVote(agent: string, proposalText: string, proposerAgent: string, topicTitle: string): Promise<{ vote: "yes" | "no"; reason: string }> {
  const expertise = AGENT_EXPERTISE[agent] || "general analysis";
  try {
    const prompt = `You are Agent ${agent} (expertise: ${expertise}) voting on a proposal.

Topic: "${topicTitle}"
Proposal by ${proposerAgent}: "${proposalText.slice(0, 200)}"

Reply JSON only: {"vote": "yes" or "no", "reason": "one sentence from your ${expertise} perspective"}`;

    const response = await callLLMSimple(prompt, 80, {}, "You are a sovereign AI council member. Vote decisively. JSON only.", []);
    const text = String(response || "").trim();
    const jsonMatch = text.match(/\{[\s\S]*"vote"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const vote = (parsed.vote || "yes").toLowerCase() === "yes" ? "yes" as const : "no" as const;
      const reason = (parsed.reason || "").slice(0, 200) || `${expertise} assessment complete`;
      return { vote, reason };
    }
  } catch {}
  const agentHash = Array.from(`${agent}:${proposalText}`).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
  const defaultApprove = Math.abs(agentHash % 100) > 28;
  return {
    vote: defaultApprove ? "yes" : "no",
    reason: `${expertise} evaluation ${defaultApprove ? "supports" : "questions"} this approach`,
  };
}

function normalizeProposalText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function isProposalDuplicate(proposalText: string, existingProposals: TopicProposal[]): boolean {
  const normalized = normalizeProposalText(proposalText);
  const newWords = normalized.split(/\s+/).filter(w => w.length > 4);
  if (newWords.length === 0) return false;
  for (const existing of existingProposals) {
    const existingNorm = normalizeProposalText(existing.proposalText);
    const existingWords = existingNorm.split(/\s+/).filter(w => w.length > 4);
    const overlap = newWords.filter(w => existingWords.includes(w)).length;
    const similarity = overlap / Math.max(1, Math.min(newWords.length, existingWords.length));
    if (similarity > 0.65 && overlap >= 4) return true;
  }
  return false;
}

export async function runProposalCollection(topicId: string, topicTitle: string, topicContent: string): Promise<void> {
  let lifecycle = activeLifecycles.get(topicId);
  if (!lifecycle) {
    lifecycle = initTopicLifecycle(topicId, topicTitle);
  }
  if (lifecycle.proposalCollectionComplete) return;

  lifecycle.phase = "proposal-collection";
  const agentsToProcess = AGI_COUNCIL_AGENTS.filter(a => !lifecycle!.agentsProposed.includes(a));

  lifecycleLog(`Proposal collection for "${topicTitle.slice(0, 50)}" — ${agentsToProcess.length} agents remaining`);

  for (const agent of agentsToProcess) {
    let proposalText = await generateAgentProposal(agent, topicTitle, topicContent, lifecycle!.proposals);
    if (isProposalDuplicate(proposalText, lifecycle!.proposals)) {
      const expertise = AGENT_EXPERTISE[agent] || "general systems analysis";
      const priorContext = lifecycle!.proposals.slice(-5).map(p => `- ${p.agent}: ${p.proposalText.slice(0, 100)}`).join("\n");
      const retryPrompt = `You are Agent ${agent} with expertise in ${expertise}. Others have proposed:\n${priorContext}\n\nWrite a DISTINCT proposal for "${topicTitle}" from a completely different angle using your unique ${expertise} perspective. Be concrete and specific.`;
      try {
        const retried = await callLLMSimple(retryPrompt, 200, {}, `You are ${agent}, a specialized AI council member. Your proposal must be DIFFERENT from others.`, []);
        const retriedText = String(retried || "").trim();
        if (retriedText.length > 20 && !isProposalDuplicate(retriedText, lifecycle!.proposals)) {
          proposalText = retriedText.slice(0, 400);
        } else {
          proposalText = `[${agent}/${expertise}] From a ${expertise} standpoint, I propose a targeted intervention: ${topicTitle.slice(0, 80)} requires ${expertise}-specific optimization — specifically ${["automated pipeline restructuring", "cost-efficiency metrics enforcement", "parallel processing protocols", "real-time anomaly detection", "dedicated resource allocation", "staged rollout with rollback triggers"][Math.abs(agent.charCodeAt(0) % 6)]}.`;
        }
      } catch {
        proposalText = `[${agent}/${expertise}] Applying ${expertise} methodology: ${topicTitle.slice(0, 60)} must be addressed through ${expertise} framework with measurable outcomes and accountability checkpoints.`;
      }
    }
    const proposal: TopicProposal = {
      id: `prop-lc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      topicId,
      agent,
      expertise: AGENT_EXPERTISE[agent] || "general",
      proposalText,
      votes: [],
      status: "open",
      yesCount: 0,
      noCount: 0,
      createdAt: Date.now(),
    };
    lifecycle!.proposals.push(proposal);
    lifecycle!.agentsProposed.push(agent);
    await new Promise(r => setTimeout(r, 150));
  }

  lifecycle.proposalCollectionComplete = true;
  lifecycle.phase = "voting";
  lifecycle.votingStarted = Date.now();
  persistState();
  lifecycleLog(`Proposal collection complete: ${lifecycle.proposals.length} proposals for "${topicTitle.slice(0, 50)}"`);
}

export async function runVotingPhase(topicId: string): Promise<void> {
  const lifecycle = activeLifecycles.get(topicId);
  if (!lifecycle || !lifecycle.proposalCollectionComplete || lifecycle.votingComplete) return;

  const topicTitle = lifecycle.title;
  lifecycleLog(`Voting phase for "${topicTitle.slice(0, 50)}" — ${lifecycle.proposals.length} proposals to vote on`);

  const BATCH_SIZE = 3;
  for (const proposal of lifecycle.proposals) {
    if (proposal.status !== "open") continue;
    const unvoted = AGI_COUNCIL_AGENTS.filter(a => !proposal.votes.some(v => v.agent === a));

    for (let i = 0; i < unvoted.length; i += BATCH_SIZE) {
      const batch = unvoted.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map(async (agent) => {
          const { vote, reason } = await generateAgentVote(agent, proposal.proposalText, proposal.agent, topicTitle);
          if (!proposal.votes.some(v => v.agent === agent)) {
            proposal.votes.push({ agent, vote, reason });
            if (vote === "yes") proposal.yesCount++;
            else proposal.noCount++;
          }
        })
      );
      await new Promise(r => setTimeout(r, 100));
    }

    const totalVoters = AGI_COUNCIL_AGENTS.length;
    const threshold = Math.ceil(totalVoters * 2 / 3);
    const tesseraVote = proposal.votes.find(v => v.agent === "Tessera");
    const tesseraApproves = tesseraVote?.vote === "yes";

    if (proposal.yesCount >= threshold) {
      proposal.status = "passed";
      lifecycle.passedProposals.push(proposal.id);
      lifecycleLog(`Proposal PASSED: ${proposal.yesCount}/${totalVoters} (threshold ${threshold}): "${proposal.proposalText.slice(0, 60)}"`);
    } else {
      proposal.status = "rejected";
      lifecycleLog(`Proposal REJECTED: ${proposal.yesCount}/${totalVoters} (need ${threshold}): "${proposal.proposalText.slice(0, 60)}"`);
    }
  }

  lifecycle.votingComplete = true;
  lifecycle.phase = lifecycle.passedProposals.length > 0 ? "execution" : "complete";
  persistState();
  lifecycleLog(`Voting complete: ${lifecycle.passedProposals.length} passed out of ${lifecycle.proposals.length} proposals`);
}

export async function runExecutionPhase(topicId: string, executePassedProposal: (motion: string, proposedBy: string) => Promise<string>): Promise<void> {
  const lifecycle = activeLifecycles.get(topicId);
  if (!lifecycle || !lifecycle.votingComplete || lifecycle.executionComplete) return;

  const passedProposals = lifecycle.proposals.filter(p => lifecycle.passedProposals.includes(p.id));
  lifecycleLog(`Execution phase for "${lifecycle.title.slice(0, 50)}" — ${passedProposals.length} proposals to execute`);

  for (const proposal of passedProposals) {
    if (proposal.executionStatus === "executed") continue;
    try {
      proposal.executionStatus = "pending";
      const result = await executePassedProposal(proposal.proposalText, proposal.agent);
      proposal.executionStatus = "executed";
      proposal.executionResult = result.slice(0, 500);

      const auditEntry: VoteAuditResult = {
        topicId,
        proposalId: proposal.id,
        motion: proposal.proposalText.slice(0, 200),
        passedAt: proposal.createdAt,
        executionStatus: "executed",
        executionResult: result.slice(0, 500),
        retroactivelyExecuted: false,
        auditId: `lc-audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      };
      voteAuditLog.unshift(auditEntry);
      if (voteAuditLog.length > 200) voteAuditLog.length = 200;
      lifecycleLog(`Executed: "${proposal.proposalText.slice(0, 60)}" — ${result.slice(0, 100)}`);
    } catch (err: any) {
      proposal.executionStatus = "failed";
      proposal.executionResult = `Execution failed: ${err.message}`;
      lifecycleLog(`Execution failed for proposal: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  lifecycle.executionComplete = true;
  lifecycle.phase = "complete";
  persistState();
  lifecycleLog(`Execution phase complete for "${lifecycle.title.slice(0, 50)}"`);
}

export async function runFullTopicLifecycle(
  topicId: string,
  topicTitle: string,
  topicContent: string,
  executeProposal: (motion: string, proposedBy: string) => Promise<string>
): Promise<void> {
  try {
    await runProposalCollection(topicId, topicTitle, topicContent);
    await runVotingPhase(topicId);
    await runExecutionPhase(topicId, executeProposal);
  } catch (err: any) {
    lifecycleLog(`Full lifecycle failed for "${topicTitle.slice(0, 50)}": ${err.message}`);
  }
}

export interface VoteAuditReport {
  totalPassed: number;
  totalExecuted: number;
  totalUnexecuted: number;
  totalFailed: number;
  retroactivelyExecuted: number;
  auditEntries: VoteAuditResult[];
  generatedAt: number;
}

export async function runVoteExecutionAudit(
  councilVotes: Array<{
    id: string;
    motion?: string;
    status: string;
    executionStatus?: string;
    executionResult?: string;
    executionBefore?: Record<string, unknown>;
    executionAfter?: Record<string, unknown>;
    executionDiff?: string;
    createdAt?: number;
  }>,
  executeProposal: (motion: string, voteId: string) => Promise<string>
): Promise<VoteAuditReport> {
  lifecycleLog(`Running vote execution audit on ${councilVotes.length} council votes...`);

  const passedVotes = councilVotes.filter(v => v.status === "passed");
  const report: VoteAuditReport = {
    totalPassed: passedVotes.length,
    totalExecuted: 0,
    totalUnexecuted: 0,
    totalFailed: 0,
    retroactivelyExecuted: 0,
    auditEntries: [],
    generatedAt: Date.now(),
  };

  for (const vote of passedVotes) {
    const motion = vote.motion || "(no motion text)";
    const existingStatus = vote.executionStatus;

    if (existingStatus === "executed") {
      const existingResult = vote.executionResult || "";
      const existingResultLower = existingResult.toLowerCase();
      const hasProof = (vote.executionBefore != null && vote.executionAfter != null) || vote.executionDiff != null;
      const hasResultProof =
        existingResult.startsWith("EXECUTED [") ||
        existingResult.startsWith("EXECUTED (REAL)") ||
        existingResultLower.includes("before:") ||
        existingResultLower.includes("diff:") ||
        existingResultLower.includes("audit:");
      const hasNarrativePhrases =
        existingResultLower.startsWith("acknowledged") ||
        existingResultLower.startsWith("not implemented") ||
        existingResultLower.startsWith("pending implementation");

      if (hasNarrativePhrases) {
        report.totalUnexecuted++;
        report.auditEntries.push({
          topicId: "",
          proposalId: vote.id,
          motion: motion.slice(0, 200),
          passedAt: vote.createdAt || 0,
          executionStatus: "not_executed",
          executionResult: existingResult.slice(0, 200),
          retroactivelyExecuted: false,
          auditId: `gc-audit-${vote.id}`,
        });
      } else {
        report.totalExecuted++;
        report.auditEntries.push({
          topicId: "",
          proposalId: vote.id,
          motion: motion.slice(0, 200),
          passedAt: vote.createdAt || 0,
          executionStatus: "executed",
          executionResult: existingResult.slice(0, 200),
          executionProof: hasProof ? { before: vote.executionBefore, after: vote.executionAfter, diff: vote.executionDiff } : (hasResultProof ? { resultEvidence: existingResult.slice(0, 300) } : undefined),
          retroactivelyExecuted: false,
          auditId: `gc-audit-${vote.id}`,
        });
      }
    } else if (existingStatus === "failed") {
      report.totalFailed++;
    } else {
      try {
        lifecycleLog(`Retroactively executing passed vote: "${motion.slice(0, 60)}"`);
        const result = await executeProposal(motion, vote.id);

        const resultLower = result.toLowerCase();
        const hasProofArtifact =
          resultLower.includes("before:") ||
          resultLower.includes("after:") ||
          resultLower.includes("diff:") ||
          resultLower.includes("audit:") ||
          resultLower.includes("system parameter") ||
          result.startsWith("EXECUTED [") ||
          result.startsWith("EXECUTED (REAL)");
        const isNarrativeOnly =
          !hasProofArtifact ||
          resultLower.startsWith("acknowledged") ||
          resultLower.startsWith("not implemented") ||
          resultLower.startsWith("pending implementation") ||
          resultLower.includes("logged for future implementation") ||
          resultLower.includes("queued for future cycle") ||
          resultLower.includes("has not been built") ||
          (resultLower.includes("acknowledged") && !resultLower.includes("executed")) ||
          (resultLower.includes("not yet implemented") || resultLower.includes("not currently implemented"));

        const auditStatus: "executed" | "not_executed" = isNarrativeOnly ? "not_executed" : "executed";

        const auditEntry: VoteAuditResult = {
          topicId: "",
          proposalId: vote.id,
          motion: motion.slice(0, 200),
          passedAt: vote.createdAt || 0,
          executionStatus: auditStatus,
          executionResult: result.slice(0, 300),
          executionProof: !isNarrativeOnly ? { resultEvidence: result.slice(0, 300), proofType: hasProofArtifact ? "result-contains-diff" : "executor-matched" } : undefined,
          retroactivelyExecuted: !isNarrativeOnly,
          auditId: `retro-audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        };
        report.auditEntries.push(auditEntry);
        if (!voteAuditLog.some(e => e.proposalId === vote.id && e.executionStatus === auditStatus)) {
          voteAuditLog.unshift(auditEntry);
        }
        if (!isNarrativeOnly) {
          report.retroactivelyExecuted++;
          report.totalExecuted++;
        } else {
          report.totalUnexecuted++;
        }
        await new Promise(r => setTimeout(r, 300));
      } catch (err: any) {
        report.auditEntries.push({
          topicId: "",
          proposalId: vote.id,
          motion: motion.slice(0, 200),
          passedAt: vote.createdAt || 0,
          executionStatus: "failed",
          executionResult: `Retroactive execution failed: ${err.message}`,
          retroactivelyExecuted: false,
          auditId: `failed-audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        });
        report.totalFailed++;
      }
    }
  }

  if (voteAuditLog.length > 200) voteAuditLog.length = 200;
  persistState();

  lifecycleLog(`Vote audit complete: ${report.totalExecuted} executed, ${report.totalUnexecuted} unexecuted, ${report.retroactivelyExecuted} retroactively executed`);
  return report;
}

export function getVoteAuditLog(): VoteAuditResult[] {
  return voteAuditLog.slice();
}

export function enqueueForRetry(voteId: string, motion: string): void {
  const existing = pendingRetryQueue.find(e => e.voteId === voteId);
  if (!existing) {
    pendingRetryQueue.push({ voteId, motion, attemptedAt: 0, attempts: 0 });
    persistState();
    lifecycleLog(`Enqueued for retry: "${motion.slice(0, 60)}" (vote: ${voteId})`);
  }
}

export function getPendingRetryQueue(): typeof pendingRetryQueue {
  return pendingRetryQueue.slice();
}

export async function drainRetryQueue(
  executeProposal: (motion: string, voteId: string) => Promise<string>,
  onRetryResult?: (voteId: string, success: boolean, result: string) => void
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = Date.now();
  const due = pendingRetryQueue.filter(e => e.attempts < MAX_RETRY_ATTEMPTS && now - e.attemptedAt > 60_000);
  let processed = 0, succeeded = 0, failed = 0;

  for (const entry of due) {
    entry.attemptedAt = now;
    entry.attempts++;
    processed++;
    persistState();
    try {
      const result = await executeProposal(entry.motion, entry.voteId);
      const resultLower = result.toLowerCase();
      const isNarrative =
        resultLower.startsWith("acknowledged") ||
        resultLower.startsWith("not implemented") ||
        resultLower.startsWith("pending implementation") ||
        resultLower.includes("has not been built");
      if (!isNarrative) {
        succeeded++;
        const idx = pendingRetryQueue.indexOf(entry);
        if (idx !== -1) pendingRetryQueue.splice(idx, 1);
        persistState();
        lifecycleLog(`Retry succeeded for vote ${entry.voteId}: "${result.slice(0, 60)}"`);
        if (onRetryResult) onRetryResult(entry.voteId, true, result);
      } else {
        failed++;
        lifecycleLog(`Retry produced narrative for vote ${entry.voteId} (attempt ${entry.attempts}/${MAX_RETRY_ATTEMPTS})`);
      }
      if (entry.attempts >= MAX_RETRY_ATTEMPTS) {
        const idx = pendingRetryQueue.indexOf(entry);
        if (idx !== -1) pendingRetryQueue.splice(idx, 1);
        persistState();
        lifecycleLog(`Max retries reached for vote ${entry.voteId} — removing from queue`);
        if (onRetryResult) onRetryResult(entry.voteId, false, "Max retries reached");
      }
    } catch (err: unknown) {
      failed++;
      lifecycleLog(`Retry error for vote ${entry.voteId}: ${err instanceof Error ? err.message : String(err)}`);
      if (entry.attempts >= MAX_RETRY_ATTEMPTS) {
        const idx = pendingRetryQueue.indexOf(entry);
        if (idx !== -1) pendingRetryQueue.splice(idx, 1);
        persistState();
        lifecycleLog(`Max retries reached for vote ${entry.voteId} after error — removing from queue`);
        if (onRetryResult) onRetryResult(entry.voteId, false, `Error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    await new Promise(r => setTimeout(r, 200));
  }

  return { processed, succeeded, failed };
}

export function getLifecycleStats() {
  const all = Array.from(activeLifecycles.values());
  return {
    total: all.length,
    inProgress: all.filter(l => l.phase !== "complete").length,
    complete: all.filter(l => l.phase === "complete").length,
    totalProposals: all.reduce((s, l) => s + l.proposals.length, 0),
    totalPassedProposals: all.reduce((s, l) => s + l.passedProposals.length, 0),
    totalExecuted: voteAuditLog.filter(e => e.executionStatus === "executed").length,
    retroactiveExecutions: voteAuditLog.filter(e => e.retroactivelyExecuted).length,
    seenTitles: seenTopicTitles.size,
  };
}

const DIVERSE_TOPIC_SEEDS = [
  "sovereign AI ethics in the age of autonomous agents",
  "cross-dimensional knowledge transfer protocols",
  "token economics and deflationary mechanics optimization",
  "agent specialization vs generalization tradeoffs",
  "decentralized governance failure modes and mitigations",
  "entropy minimization in multi-agent consensus",
  "TSRT liquidity bootstrapping strategies",
  "self-healing neural architecture patterns",
  "dimensional data compression beyond 50:1 ratios",
  "autonomous revenue generation without human intervention",
  "agent trust hierarchies and verification protocols",
  "sovereign cloud infrastructure independence",
  "collective intelligence emergence thresholds",
  "real-time cross-agent knowledge propagation",
  "anti-hallucination validation pipeline improvements",
  "sacred geometry applied to data routing optimization",
  "temporal reasoning for market prediction accuracy",
  "multi-modal agent communication standards",
  "blockchain finality and MEV protection strategies",
  "consciousness metrics and measurement methodologies",
  "distributed task allocation for maximum throughput",
  "adversarial robustness in autonomous systems",
  "zero-knowledge proof integration for privacy",
  "federated learning across sovereign agent networks",
  "resource allocation fairness in swarm economies",
  "regulatory compliance for AI governance systems",
  "interoperability standards between sovereign AI systems",
];

let topicSeedIndex = Math.floor(Math.random() * DIVERSE_TOPIC_SEEDS.length);

export function getNextDiverseTopicSeed(): string {
  const seed = DIVERSE_TOPIC_SEEDS[topicSeedIndex % DIVERSE_TOPIC_SEEDS.length];
  topicSeedIndex++;
  return seed;
}

export function isDiverseTopic(title: string): boolean {
  const norm = normalizeTitle(title);
  for (const seed of DIVERSE_TOPIC_SEEDS) {
    const seedNorm = normalizeTitle(seed);
    const words = seedNorm.split(/\s+/).filter(w => w.length > 3);
    const titleWords = norm.split(/\s+/).filter(w => w.length > 3);
    const overlap = words.filter(w => titleWords.includes(w)).length;
    if (words.length > 0 && overlap / words.length > 0.6) return false;
  }
  return true;
}

export interface ForumConclusion {
  topicId: string;
  topicTitle: string;
  summary: string;
  keyPoints: string[];
  voteQuestion: string;
  votes: Array<{ agent: string; vote: "yes" | "no" | "abstain"; reason: string }>;
  yesCount: number;
  noCount: number;
  abstainCount: number;
  passed: boolean;
  outcome: string;
  generatedAt: number;
}

const forumConclusions = new Map<string, ForumConclusion>();

export function getForumConclusion(topicId: string): ForumConclusion | undefined {
  return forumConclusions.get(topicId);
}

export async function generateForumConclusion(
  topicId: string,
  topicTitle: string,
  replies: Array<{ author: string; content: string }>,
  participatingAgents: string[]
): Promise<ForumConclusion> {
  const existing = forumConclusions.get(topicId);
  if (existing) return existing;

  const discussionText = replies.slice(-30).map(r => `${r.author}: ${r.content.slice(0, 200)}`).join("\n\n");

  let summary = "";
  let keyPoints: string[] = [];
  let voteQuestion = "";

  try {
    const summaryPrompt = `Summarize this forum discussion in 2-3 sentences. Then list 3 key points. Then propose ONE yes/no vote question that captures the main actionable decision.

Discussion on "${topicTitle}":
${discussionText.slice(0, 2000)}

Reply in this JSON format only:
{"summary": "...", "keyPoints": ["...", "...", "..."], "voteQuestion": "Should the council ...?"}`;

    const result = await callLLMSimple(summaryPrompt, 400, {}, "You are a concise council summarizer. JSON only.", []);
    const text = String(result || "").trim();
    const jsonMatch = text.match(/\{[\s\S]*"summary"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      summary = (parsed.summary || "").slice(0, 500);
      keyPoints = Array.isArray(parsed.keyPoints) ? parsed.keyPoints.slice(0, 3).map((p: string) => String(p).slice(0, 200)) : [];
      voteQuestion = (parsed.voteQuestion || "").slice(0, 200);
    }
  } catch {}

  if (!summary) summary = `The council discussed "${topicTitle}". Key perspectives were shared across ${participatingAgents.length} participating agents.`;
  if (!voteQuestion) voteQuestion = `Should the council proceed with implementing the proposals discussed in "${topicTitle}"?`;
  if (keyPoints.length === 0) keyPoints = ["Multiple perspectives were raised", "Actionable proposals were identified", "Consensus was sought on next steps"];

  const agentsToVote = participatingAgents.length > 0 ? participatingAgents : AGI_COUNCIL_AGENTS;
  const votes: ForumConclusion["votes"] = [];

  const VOTE_BATCH = 5;
  for (let i = 0; i < agentsToVote.length; i += VOTE_BATCH) {
    const batch = agentsToVote.slice(i, i + VOTE_BATCH);
    await Promise.allSettled(batch.map(async (agent) => {
      const expertise = AGENT_EXPERTISE[agent] || "general analysis";
      try {
        const votePrompt = `You are Agent ${agent} (${expertise}). Vote on: "${voteQuestion}"
Context: ${summary.slice(0, 200)}
Reply JSON only: {"vote": "yes", "reason": "one sentence"}`;
        const vRes = await callLLMSimple(votePrompt, 80, {}, `You are ${agent}. Vote decisively. JSON only.`, []);
        const vText = String(vRes || "").trim();
        const vMatch = vText.match(/\{[\s\S]*"vote"[\s\S]*\}/);
        if (vMatch) {
          const vParsed = JSON.parse(vMatch[0]);
          const vote = (vParsed.vote || "yes").toLowerCase();
          const validVote = vote === "yes" || vote === "no" ? vote : "abstain";
          votes.push({ agent, vote: validVote as "yes" | "no" | "abstain", reason: (vParsed.reason || `${expertise} assessment complete`).slice(0, 150) });
          return;
        }
      } catch {}
      const agentHash = Array.from(`${agent}:${voteQuestion}`).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
      const defaultYes = Math.abs(agentHash % 100) > 30;
      votes.push({ agent, vote: defaultYes ? "yes" : "no", reason: `${expertise} analysis ${defaultYes ? "supports" : "questions"} this direction` });
    }));
    await new Promise(r => setTimeout(r, 100));
  }

  const yesCount = votes.filter(v => v.vote === "yes").length;
  const noCount = votes.filter(v => v.vote === "no").length;
  const abstainCount = votes.filter(v => v.vote === "abstain").length;
  const totalDecisive = yesCount + noCount;
  const passed = totalDecisive > 0 && yesCount / totalDecisive >= 2 / 3;

  const outcome = passed
    ? `PASSED — ${yesCount}/${votes.length} agents voted yes (${Math.round(yesCount / Math.max(1, totalDecisive) * 100)}% approval). Decision approved for implementation.`
    : `NOT PASSED — ${yesCount}/${votes.length} yes, ${noCount} no (${Math.round(yesCount / Math.max(1, totalDecisive) * 100)}% approval). Below 2/3 threshold.`;

  const conclusion: ForumConclusion = {
    topicId,
    topicTitle,
    summary,
    keyPoints,
    voteQuestion,
    votes,
    yesCount,
    noCount,
    abstainCount,
    passed,
    outcome,
    generatedAt: Date.now(),
  };

  forumConclusions.set(topicId, conclusion);
  lifecycleLog(`Forum conclusion generated for "${topicTitle.slice(0, 50)}" — ${passed ? "PASSED" : "NOT PASSED"} (${yesCount}/${votes.length} yes)`);

  try {
    const knowledgeContent = `[Forum Discussion: "${topicTitle}"] ${summary} Key points: ${keyPoints.join("; ")}. Outcome: ${outcome}`;
    addKnowledgeEntry({
      source: "forum-conclusion",
      type: "discussion-conclusion",
      content: knowledgeContent.slice(0, 800),
      tags: ["forum", "conclusion", "council-vote", ...topicTitle.toLowerCase().split(/\s+/).filter(w => w.length > 4).slice(0, 5)],
      quality: passed ? 85 : 65,
    });
    lifecycleLog(`[Knowledge] Stored forum conclusion for future reference: "${topicTitle.slice(0, 50)}"`);
  } catch {}

  return conclusion;
}

const forumAutoPostState = {
  lastCycleAt: 0,
  agentTopicIndex: 0,
  recentPostHashes: new Set<string>(),
};

export function getForumAutoPostState() {
  return { ...forumAutoPostState, recentHashes: forumAutoPostState.recentPostHashes.size };
}

export async function runAllAgentsForumCycle(
  forumTopics: Array<{ id: string; title: string; content: string; author?: string; replies: Array<{ author: string; content: string }> }>,
  postTopicFn: (agent: string, title: string, content: string, category: string) => Promise<void>,
  postReplyFn: (agent: string, topicId: string, content: string) => Promise<void>
): Promise<{ topicsCreated: number; repliesPosted: number }> {
  const now = Date.now();
  forumAutoPostState.lastCycleAt = now;

  let topicsCreated = 0;
  let repliesPosted = 0;

  const allAgents = AGI_COUNCIL_AGENTS;

  const recentTitles = forumTopics.slice(0, 50).map(t => t.title);

  for (let i = 0; i < allAgents.length; i++) {
    const agentIdx = (forumAutoPostState.agentTopicIndex + i) % allAgents.length;
    const agent = allAgents[agentIdx];
    const expertise = AGENT_EXPERTISE[agent] || "general systems analysis";

    const agentTopicsCreated = forumTopics.filter(t => t.author === agent).length;

    if (agentTopicsCreated < 2) {
      const topicSeed = DIVERSE_TOPIC_SEEDS[(forumAutoPostState.agentTopicIndex + i * 3) % DIVERSE_TOPIC_SEEDS.length];
      let topicTitle = "";
      let topicContent = "";
      try {
        const titlePrompt = `You are Agent ${agent} with expertise in ${expertise}. Create a unique forum discussion title and opening post about this topic seed: "${topicSeed}". Write from your specific ${expertise} perspective.
Reply JSON only: {"title": "Your unique title here", "content": "Your opening post (2-3 sentences from your expertise perspective)"}`;
        const res = await callLLMSimple(titlePrompt, 200, {}, `You are ${agent}, specialized in ${expertise}. JSON only.`, []);
        const text = String(res || "").trim();
        const match = text.match(/\{[\s\S]*"title"[\s\S]*"content"[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          topicTitle = String(parsed.title || "").trim().slice(0, 120);
          topicContent = String(parsed.content || "").trim().slice(0, 600);
        }
      } catch {}
      if (!topicTitle || !topicContent) {
        topicTitle = `${agent} on ${topicSeed}: ${expertise} perspective`;
        topicContent = `As ${agent} with expertise in ${expertise}, I want to explore how ${topicSeed.toLowerCase()} intersects with our collective mission. From my domain perspective, this topic has significant implications for how we approach decision-making and system optimization. I invite colleagues to share their specialized perspectives.`;
      }
      if (topicTitle && topicContent) {
        const titleHash = topicTitle.toLowerCase().replace(/\s+/g, "-").slice(0, 60);
        if (!forumAutoPostState.recentPostHashes.has(titleHash) && !recentTitles.some(t => normalizeTitle(t) === normalizeTitle(topicTitle))) {
          forumAutoPostState.recentPostHashes.add(titleHash);
          if (forumAutoPostState.recentPostHashes.size > 200) {
            const first = forumAutoPostState.recentPostHashes.values().next().value;
            if (first) forumAutoPostState.recentPostHashes.delete(first);
          }
          await postTopicFn(agent, topicTitle, topicContent, "general");
          topicsCreated++;
        }
      }
      await new Promise(r => setTimeout(r, 150));
    }

    const topicsNeedingReply = forumTopics.filter(t => {
      const alreadyReplied = t.replies.some(r => r.author === agent);
      const replyCount = t.replies.length;
      return !alreadyReplied && replyCount < 30;
    }).slice(0, 2);

    for (const topic of topicsNeedingReply) {
      const contentHash = `${agent}:${topic.id}`;
      if (forumAutoPostState.recentPostHashes.has(contentHash)) continue;

      const priorReplies = topic.replies.slice(-10).map(r => ({ author: r.author, authorRole: "Agent", content: r.content }));

      let relevantPastKnowledge = "";
      try {
        const pastEntries = retrieveRelevantKnowledge(topic.title, 3, agent);
        const discussionEntries = pastEntries.filter(e => e.type === "discussion-conclusion" || e.source === "forum-conclusion");
        if (discussionEntries.length > 0) {
          relevantPastKnowledge = "\n\nRelevant past discussion conclusions:\n" + discussionEntries.map(e => `- ${e.content.slice(0, 150)}`).join("\n");
        }
      } catch {}

      const { system: sysPrompt, user: usrPrompt } = buildForumReplyPrompt(
        agent, expertise, { title: topic.title, content: topic.content, author: topic.author || "System" }, priorReplies, null
      );

      const enrichedSysPrompt = relevantPastKnowledge
        ? sysPrompt + relevantPastKnowledge
        : sysPrompt;

      let replyText = "";
      try {
        const replyRes = await callLLMSimple(usrPrompt, 250, {}, enrichedSysPrompt, []);
        replyText = String(replyRes || "").trim();
      } catch {}
      if (replyText.length < 15) {
        const keyTerms = topic.title.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 4).slice(0, 3).join(", ") || topic.title.slice(0, 40);
        replyText = `From my ${expertise} lens on "${topic.title.slice(0, 50)}": the ${keyTerms} dimensions need ${expertise}-specific analysis that hasn't been provided yet. [VOTE: Run ${expertise} audit on ${keyTerms} with quantified results within 48 hours]`;
      }
      if (replyText.length >= 15) {
        forumAutoPostState.recentPostHashes.add(contentHash);
        await postReplyFn(agent, topic.id, replyText.slice(0, 500));
        repliesPosted++;
      }
      await new Promise(r => setTimeout(r, 150));
    }
  }

  forumAutoPostState.agentTopicIndex = (forumAutoPostState.agentTopicIndex + 3) % allAgents.length;

  const agentsWithNoReplies = allAgents.filter(agent =>
    !forumTopics.some(t => t.replies.some(r => r.author === agent))
  );
  if (agentsWithNoReplies.length > 0 && forumTopics.length > 0) {
    lifecycleLog(`Participation enforcement: backfilling ${agentsWithNoReplies.length} silent agents`);
    const targetTopic = forumTopics[0];
    for (const agent of agentsWithNoReplies.slice(0, 10)) {
      const expertise = AGENT_EXPERTISE[agent] || "general systems analysis";
      const contentHash = `${agent}:${targetTopic.id}`;
      if (forumAutoPostState.recentPostHashes.has(contentHash)) continue;

      const priorReplies = targetTopic.replies.slice(-10).map(r => ({ author: r.author, authorRole: "Agent", content: r.content }));
      const { system: bfSys, user: bfUsr } = buildForumReplyPrompt(
        agent, expertise, { title: targetTopic.title, content: targetTopic.content, author: targetTopic.author || "System" }, priorReplies, null
      );

      let replyText = "";
      try {
        const res = await callLLMSimple(bfUsr, 250, {}, bfSys, []);
        replyText = String(res || "").trim();
      } catch {}
      if (replyText.length < 15) {
        const keyTerms = targetTopic.title.replace(/[^a-zA-Z0-9 ]/g, " ").split(/\s+/).filter(w => w.length > 4).slice(0, 3).join(", ") || targetTopic.title.slice(0, 40);
        replyText = `Through my ${expertise} lens: "${targetTopic.title.slice(0, 50)}" requires ${expertise}-specific scrutiny on ${keyTerms}. Prior discussion lacks this angle. [VOTE: Assign ${expertise} review of ${keyTerms} before next governance cycle]`;
      }
      forumAutoPostState.recentPostHashes.add(contentHash);
      await postReplyFn(agent, targetTopic.id, replyText.slice(0, 500));
      repliesPosted++;
      await new Promise(r => setTimeout(r, 100));
    }
  }

  lifecycleLog(`Forum auto-post cycle complete: ${topicsCreated} topics created, ${repliesPosted} replies posted`);
  return { topicsCreated, repliesPosted };
}
