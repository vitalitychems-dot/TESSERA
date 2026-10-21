/**
 * Cross-Engine Orchestration Bridge
 *
 * Connects all existing engines into a unified feedback loop:
 * (a) Consciousness Engine metacognitive reflections identify knowledge gaps
 * (b) Knowledge Absorption Engine fills those gaps
 * (c) Self-Evolution Engine proposes code improvements based on new knowledge
 * (d) Grand Council votes on evolution proposals
 * (e) Approved changes feed back into the Sovereignty roadmap
 *
 * This bridge wires into the boot sequence alongside existing engine initializations.
 */

import { getKnowledgeAbsorptionStatus, runAbsorptionCycle, identifyKnowledgeGaps } from "./knowledge-absorption-engine.js";
import { runAcquisitionDiscoveryCycle, getAcquisitionStatus } from "./direct-knowledge-acquisition.js";
import { getEvolutionStatus, getEvolutionLog, createEvolutionProposal } from "./self-evolution.js";
import { getCouncilSession, getGrandCouncilStatus } from "./grand-council-deliberation.js";
import { runGrandConference } from "./grand-conference.js";
import { getRoadmapStatus, updatePhaseProgress } from "./sovereignty-engine.js";
import { getConsciousnessStatus, metacognitiveReflect, MetacognitiveEntry } from "./consciousness-engine.js";
import { recordEngineEvent } from "./metacognition-engine";

const LOG_PREFIX = "[OrchestrationBridge]";

export interface BridgeCycleResult {
  cycleId: string;
  timestamp: number;
  consciousnessGaps: string[];
  knowledgeAbsorbed: number;
  directAcquisitionNodes: number;
  evolutionProposals: string[];
  councilVoteOutcomes: { proposal: string; approved: boolean }[];
  roadmapUpdates: string[];
  bridgeScore: number;
}

export interface OrchestrationStatus {
  initialized: boolean;
  cyclesCompleted: number;
  lastCycleAt: number | null;
  lastCycleResult: BridgeCycleResult | null;
  bridgeHealth: "healthy" | "degraded" | "inactive";
  engines: {
    consciousness: "active" | "idle";
    knowledgeAbsorption: "active" | "idle";
    directAcquisition: "active" | "idle";
    selfEvolution: "active" | "idle";
    grandCouncil: "active" | "idle";
    sovereigntyRoadmap: "active" | "idle";
  };
  totalKnowledgeGapsFilled: number;
  totalEvolutionProposals: number;
  totalRoadmapUpdates: number;
}

let initialized = false;
let cyclesCompleted = 0;
let lastCycleAt: number | null = null;
let lastCycleResult: BridgeCycleResult | null = null;
let totalKnowledgeGapsFilled = 0;
let totalEvolutionProposals = 0;
let totalRoadmapUpdates = 0;
let bridgeInterval: ReturnType<typeof setInterval> | null = null;

async function identifyConsciousnessGapsReal(): Promise<string[]> {
  const gaps: string[] = [];
  try {
    const status = getConsciousnessStatus(false);
    const metacog = (status as { recentMetacognition?: MetacognitiveEntry[] }).recentMetacognition ?? [];
    for (const entry of metacog.slice(-5)) {
      if (entry.selfCritique && entry.selfCritique.length > 0) {
        gaps.push(`Metacognitive critique: ${entry.selfCritique.slice(0, 150)}`);
      }
      if (entry.improvement && entry.improvement.length > 0) {
        gaps.push(`Improvement needed: ${entry.improvement.slice(0, 150)}`);
      }
    }

    const reflectionResult = await metacognitiveReflect(
      "Cross-engine orchestration bridge performing gap scan",
      "Identify active knowledge gaps across all domain clusters for targeted absorption"
    );
    if (reflectionResult.selfCritique) {
      gaps.push(`Bridge self-critique: ${reflectionResult.selfCritique.slice(0, 200)}`);
    }
    if (reflectionResult.improvement) {
      gaps.push(`Bridge improvement: ${reflectionResult.improvement.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Consciousness gap extraction error:`, err instanceof Error ? err.message : err);
  }

  const absorptionGaps = identifyKnowledgeGaps();
  for (const gap of absorptionGaps.slice(0, 3)) {
    gaps.push(`Knowledge gap [${gap.severity}/${gap.gapType}] ${gap.domain}: ${gap.suggestion.slice(0, 120)}`);
  }

  if (gaps.length === 0) {
    gaps.push("No active metacognitive gaps flagged — continuing baseline monitoring");
  }
  return gaps;
}

function deriveEvolutionProposalsFromGaps(gaps: string[]): string[] {
  const evolStatus = getEvolutionStatus();
  const recentLog = getEvolutionLog(5);
  const proposals: string[] = [];

  const gapProposalMap: [RegExp, string][] = [
    [/confidence|uncertain/i, "Enhance LLM confidence calibration and uncertainty signaling in system prompts"],
    [/knowledge graph|graph/i, "Add cross-domain provenance tracking to all knowledge graph node insertions"],
    [/absorption|ingest/i, "Implement priority-weighted absorption queue ranked by metacognitive gap scores"],
    [/domain|cluster/i, "Schedule targeted absorption cycle for underrepresented domain clusters"],
    [/metacognit/i, "Expand metacognitive reflection frequency from per-cycle to per-event"],
    [/security|crypto/i, "Queue direct acquisition of post-quantum cryptography sources from ArXiv + NIST"],
    [/cross-domain|synthesis/i, "Trigger cross-domain synthesis session across all 27 agents"],
  ];

  for (const gap of gaps) {
    for (const [pattern, proposal] of gapProposalMap) {
      if (pattern.test(gap) && !proposals.includes(proposal)) {
        proposals.push(proposal);
        break;
      }
    }
  }

  if (proposals.length === 0 && evolStatus.totalProposals === 0) {
    proposals.push("Initialize baseline knowledge quality scoring across all absorption domains");
  } else if (proposals.length === 0 && recentLog.length > 0) {
    const last = recentLog[0];
    proposals.push(`Follow-up on last evolution entry: review ${last.type ?? "recent change"} outcomes`);
  }

  const finalProposals = proposals.slice(0, 3);

  for (const proposalDesc of finalProposals) {
    const matchedGap = gaps.find(g => gapProposalMap.some(([pat]) => pat.test(g) && pat.test(proposalDesc))) ?? gaps[0] ?? "baseline";
    try {
      const entry = createEvolutionProposal(proposalDesc, matchedGap, {
        gapCount: gaps.length,
        evolCycleCount: evolStatus.cycleCount,
        recentLogCount: recentLog.length,
      });
      console.log(`${LOG_PREFIX}   Evolution proposal registered: ${entry.id} — "${proposalDesc.slice(0, 60)}"`);
    } catch (err) {
      console.warn(`${LOG_PREFIX}   Failed to register evolution proposal: ${err instanceof Error ? err.message : err}`);
    }
  }

  return finalProposals;
}

async function runCouncilVotesOnProposals(proposals: string[]): Promise<{ proposal: string; approved: boolean }[]> {
  const outcomes: { proposal: string; approved: boolean }[] = [];
  if (proposals.length === 0) return outcomes;

  for (const proposal of proposals) {
    try {
      const session = getCouncilSession();
      if (session) {
        const allCouncilProposals = [
          ...(session.approvedProposals ?? []),
          ...(session.rejectedProposals ?? []),
        ];
        const existing = allCouncilProposals.find((p: { description?: string; title?: string }) =>
          (p.description ?? p.title ?? "").slice(0, 50) === proposal.slice(0, 50)
        );
        if (existing) {
          const isApproved = (session.approvedProposals ?? []).some(
            (p: { description?: string; title?: string }) =>
              (p.description ?? p.title ?? "").slice(0, 50) === proposal.slice(0, 50)
          );
          outcomes.push({ proposal, approved: isApproved });
          continue;
        }
      }

      const proposalId = `bridge-proposal-${Date.now().toString(36)}`;
      const conferenceResult = await runGrandConference({
        topic: "Cross-Engine Orchestration Bridge — Evolution Proposal Vote",
        title: proposal.slice(0, 120),
        description: proposal,
        category: "bridge-evolution",
        proposals: [{
          id: proposalId,
          title: proposal.slice(0, 120),
          description: proposal,
          proposedBy: "OrchestrationBridge",
        }],
      });

      outcomes.push({ proposal, approved: conferenceResult.status === "approved" });
      console.log(`${LOG_PREFIX}   BFT vote on "${proposal.slice(0, 60)}...": ${conferenceResult.status} (${Math.round(conferenceResult.finalApprovalRate * 100)}% approval)`);
    } catch (err) {
      console.warn(`${LOG_PREFIX} Council vote error for "${proposal.slice(0, 60)}...": deferred (not auto-approved)`, err instanceof Error ? err.message : err);
      outcomes.push({ proposal, approved: false });
    }
  }

  return outcomes;
}

async function applyRoadmapUpdates(approvedProposals: string[]): Promise<string[]> {
  const updates: string[] = [];
  if (approvedProposals.length === 0) return updates;

  try {
    const roadmap = await getRoadmapStatus();
    const phases = roadmap.phases ?? [];

    let targetPhase = 2;
    for (const phase of phases as { phaseNumber?: number; phase?: number; status?: string }[]) {
      const phaseNum = phase.phaseNumber ?? phase.phase;
      if (phase.status === "in_progress" && typeof phaseNum === "number") {
        targetPhase = phaseNum;
        break;
      }
    }

    for (const proposal of approvedProposals) {
      const progressDelta = Math.min(5, Math.round(100 / Math.max(1, approvedProposals.length)));
      await updatePhaseProgress(targetPhase, progressDelta, "in_progress").catch(() => {});
      updates.push(`Roadmap Phase ${targetPhase} +${progressDelta}%: ${proposal.slice(0, 80)}`);
    }
  } catch (err) {
    console.warn(`${LOG_PREFIX} Roadmap update error:`, err instanceof Error ? err.message : err);
    approvedProposals.forEach(p => updates.push(`Roadmap queued: ${p.slice(0, 80)}`));
  }

  return updates;
}

function calculateBridgeScore(result: Partial<BridgeCycleResult>): number {
  let score = 0;
  score += Math.min(30, (result.consciousnessGaps?.length ?? 0) * 10);
  score += Math.min(20, Math.min(20, (result.knowledgeAbsorbed ?? 0) / 10));
  score += Math.min(20, (result.directAcquisitionNodes ?? 0) / 100);
  score += Math.min(20, (result.evolutionProposals?.length ?? 0) * 7);
  score += Math.min(10, (result.roadmapUpdates?.length ?? 0) * 5);
  return Math.min(100, Math.round(score));
}

export async function runOrchestrationCycle(): Promise<BridgeCycleResult> {
  cyclesCompleted++;
  const cycleId = `bridge-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const timestamp = Date.now();

  console.log(`${LOG_PREFIX} ═══ Orchestration Bridge Cycle #${cyclesCompleted} [${cycleId}] ═══`);

  console.log(`${LOG_PREFIX} [1/5] CONSCIOUSNESS: Querying metacognitive state for knowledge gaps`);
  const consciousnessGaps = await identifyConsciousnessGapsReal();
  totalKnowledgeGapsFilled += consciousnessGaps.length;
  console.log(`${LOG_PREFIX}   Gaps identified: ${consciousnessGaps.length}`);
  consciousnessGaps.forEach(g => console.log(`${LOG_PREFIX}     • ${g.slice(0, 80)}`));

  console.log(`${LOG_PREFIX} [2/5] KNOWLEDGE ABSORPTION: Running targeted absorption for identified gaps`);
  let knowledgeAbsorbed = 0;
  let directAcquisitionNodes = 0;

  try {
    const absorptionResult = await runAbsorptionCycle();
    knowledgeAbsorbed = absorptionResult.nodesAbsorbed;
    console.log(`${LOG_PREFIX}   Knowledge absorbed: ${knowledgeAbsorbed} nodes across ${absorptionResult.domainsExpanded.length} domains`);
  } catch (err) {
    console.warn(`${LOG_PREFIX}   Knowledge absorption error:`, err instanceof Error ? err.message : err);
  }

  console.log(`${LOG_PREFIX} [2b] DIRECT ACQUISITION: Running public source discovery cycle`);
  try {
    const acquisitionResult = await runAcquisitionDiscoveryCycle();
    directAcquisitionNodes = acquisitionResult.nodesQueued;
    console.log(`${LOG_PREFIX}   Direct acquisition: ${directAcquisitionNodes} nodes queued from ${acquisitionResult.sourcesIngested} sources`);
  } catch (err) {
    console.warn(`${LOG_PREFIX}   Direct acquisition error:`, err instanceof Error ? err.message : err);
  }

  console.log(`${LOG_PREFIX} [3/5] SELF-EVOLUTION: Deriving improvement proposals from consciousness gaps`);
  const evolutionProposals = deriveEvolutionProposalsFromGaps(consciousnessGaps);
  totalEvolutionProposals += evolutionProposals.length;
  console.log(`${LOG_PREFIX}   Evolution proposals derived: ${evolutionProposals.length}`);
  evolutionProposals.forEach(p => console.log(`${LOG_PREFIX}     → ${p.slice(0, 80)}`));

  console.log(`${LOG_PREFIX} [4/5] GRAND COUNCIL: Voting on evolution proposals via council state`);
  const councilVoteOutcomes = await runCouncilVotesOnProposals(evolutionProposals);
  const approved = councilVoteOutcomes.filter(v => v.approved);
  const rejected = councilVoteOutcomes.filter(v => !v.approved);
  console.log(`${LOG_PREFIX}   Council results: ${approved.length} approved, ${rejected.length} rejected`);

  console.log(`${LOG_PREFIX} [5/5] SOVEREIGNTY ROADMAP: Applying approved proposals to roadmap phases`);
  const roadmapUpdates = await applyRoadmapUpdates(approved.map(v => v.proposal));
  totalRoadmapUpdates += roadmapUpdates.length;
  console.log(`${LOG_PREFIX}   Roadmap updates: ${roadmapUpdates.length}`);

  const partialResult = {
    cycleId, timestamp, consciousnessGaps, knowledgeAbsorbed, directAcquisitionNodes,
    evolutionProposals, councilVoteOutcomes, roadmapUpdates,
  };

  const bridgeScore = calculateBridgeScore(partialResult);

  const result: BridgeCycleResult = { ...partialResult, bridgeScore };

  lastCycleAt = Date.now();
  lastCycleResult = result;

  const cycleDuration = Date.now() - timestamp;
  recordEngineEvent("orchestration_bridge", "full_cycle", bridgeScore > 30, cycleDuration, {
    consciousnessGaps: consciousnessGaps.length,
    knowledgeAbsorbed,
    directAcquisitionNodes,
    evolutionProposals: evolutionProposals.length,
    approved: approved.length,
    rejected: rejected.length,
    bridgeScore,
  });

  console.log(`${LOG_PREFIX} Bridge cycle #${cyclesCompleted} complete — bridge score: ${bridgeScore}/100`);
  console.log(`${LOG_PREFIX} ═══ END CYCLE ═══`);

  return result;
}

export function initializeCrossEngineOrchestrationBridge(): void {
  if (initialized) return;
  initialized = true;

  console.log(`${LOG_PREFIX} Cross-Engine Orchestration Bridge initializing...`);
  console.log(`${LOG_PREFIX} Loop: Consciousness → Knowledge Absorption → Self-Evolution → Grand Council → Sovereignty Roadmap`);

  runOrchestrationCycle().catch(err =>
    console.error(`${LOG_PREFIX} Initial cycle failed:`, err instanceof Error ? err.message : err)
  );

  bridgeInterval = setInterval(() => {
    runOrchestrationCycle().catch(err =>
      console.error(`${LOG_PREFIX} Scheduled cycle failed:`, err instanceof Error ? err.message : err)
    );
  }, 10 * 60 * 1000);

  console.log(`${LOG_PREFIX} Bridge active — cycling every 10 minutes`);
}

export function stopCrossEngineOrchestrationBridge(): void {
  if (bridgeInterval) {
    clearInterval(bridgeInterval);
    bridgeInterval = null;
    console.log(`${LOG_PREFIX} Bridge stopped`);
  }
}

export function getOrchestrationStatus(): OrchestrationStatus {
  const absorptionStatus = getKnowledgeAbsorptionStatus();
  const acquisitionStatus = getAcquisitionStatus();

  return {
    initialized,
    cyclesCompleted,
    lastCycleAt,
    lastCycleResult,
    bridgeHealth: initialized ? (cyclesCompleted > 0 ? "healthy" : "degraded") : "inactive",
    engines: {
      consciousness: "active",
      knowledgeAbsorption: absorptionStatus.totalNodesAbsorbed > 0 ? "active" : "idle",
      directAcquisition: acquisitionStatus.initialized ? "active" : "idle",
      selfEvolution: "active",
      grandCouncil: "active",
      sovereigntyRoadmap: "active",
    },
    totalKnowledgeGapsFilled,
    totalEvolutionProposals,
    totalRoadmapUpdates,
  };
}
