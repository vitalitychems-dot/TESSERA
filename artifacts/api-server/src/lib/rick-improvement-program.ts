import { db } from "@workspace/db";
import { systemStateTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import * as fs from "fs/promises";
import * as path from "path";
import {
  generateFreshProposals,
  snapshotDiagnosticsForProgram,
  type RickProposal,
  type ProposalRisk,
} from "./rick-proposals";

export type CycleStage = "propose" | "review" | "implement" | "reflect" | "done";

export interface MetricSnapshot {
  capturedAt: number;
  overallScorePct: number;
  truthGroundingRate: number;
  truthAvgScore: number;
  meeseeksSuccessRate: number;
  weakCategories: { category: string; score: number }[];
  weakAgi: { category: string; score: number }[];
}

export interface ProgramProposal {
  id: string;
  title: string;
  problem: string;
  evidence: { metric: string; value: string }[];
  proposedChange: string;
  expectedImpact: string;
  risk: ProposalRisk;
  effortHours: number;
  category: string;
  source: "llm" | "deterministic";
  truthfulnessScore?: number;
  decision: "pending" | "approved" | "rejected";
  decidedAt?: number;
  reviewerReason?: string;
  dispatch?: {
    taskRef: string;
    dispatchedAt: number;
    filePath?: string;
    status: "dispatched" | "completed" | "failed";
    statusNote?: string;
  };
  reflection?: {
    text: string;
    metricDelta?: { metric: string; before: number; after: number; delta: number }[];
    reflectedAt: number;
  };
}

export interface ProgramCycle {
  cycleNumber: number;
  stage: CycleStage;
  startedAt: number;
  startSnapshot?: MetricSnapshot;
  endSnapshot?: MetricSnapshot;
  proposals: ProgramProposal[];
  reflectionSummary?: string;
  advancedAt: Partial<Record<CycleStage, number>>;
}

export interface ImprovementProgram {
  id: string;
  status: "active" | "completed" | "abandoned";
  createdAt: number;
  completedAt?: number;
  currentCycle: number;
  cycles: ProgramCycle[];
  finalSummary?: {
    totalProposals: number;
    approvedCount: number;
    rejectedCount: number;
    approvalRate: number;
    strongestImprovement?: { cycle: number; title: string; reflection: string };
    weakestImprovement?: { cycle: number; title: string; reflection: string };
    overallScoreStart: number;
    overallScoreEnd: number;
    overallScoreDelta: number;
  };
}

interface ProgramStore {
  active: ImprovementProgram | null;
  history: ImprovementProgram[];
}

const STATE_KEY = "rick.improvement-program.v1";
const MAX_CYCLES = 5;
const STAGE_ORDER: CycleStage[] = ["propose", "review", "implement", "reflect", "done"];

let store: ProgramStore = { active: null, history: [] };
let loaded = false;

async function loadStore(): Promise<void> {
  if (loaded) return;
  try {
    const [row] = await db
      .select()
      .from(systemStateTable)
      .where(eq(systemStateTable.key, STATE_KEY))
      .limit(1);
    if (row?.value) {
      const saved = row.value as ProgramStore;
      store.active = saved.active ?? null;
      store.history = Array.isArray(saved.history) ? saved.history.slice(0, 20) : [];
    }
  } catch (err) {
    logger.warn({ err }, "RickProgram: load failed");
  }
  loaded = true;
}

async function persistStore(): Promise<void> {
  await db
    .insert(systemStateTable)
    .values({
      key: STATE_KEY,
      value: store as unknown,
      description: "Rick's 5-cycle improvement program (user-gated)",
    })
    .onConflictDoUpdate({
      target: systemStateTable.key,
      set: { value: store as unknown, lastSavedAt: new Date() },
    });
}

function captureSnapshot(): MetricSnapshot {
  const diag = snapshotDiagnosticsForProgram();
  return {
    capturedAt: Date.now(),
    overallScorePct: diag.overallScorePct,
    truthGroundingRate: diag.truthGroundingRate,
    truthAvgScore: diag.truthAvgScore,
    meeseeksSuccessRate: diag.meeseeksSuccessRate,
    weakCategories: diag.weakCategories,
    weakAgi: diag.weakAgi,
  };
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function toProgramProposal(p: RickProposal): ProgramProposal {
  return {
    id: p.id,
    title: p.title,
    problem: p.problem,
    evidence: p.evidence,
    proposedChange: p.proposedChange,
    expectedImpact: p.expectedImpact,
    risk: p.risk,
    effortHours: p.effortHours,
    category: p.category,
    source: p.source,
    truthfulnessScore: p.truthfulnessScore,
    decision: "pending",
  };
}

function newCycle(num: number): ProgramCycle {
  return {
    cycleNumber: num,
    stage: "propose",
    startedAt: Date.now(),
    proposals: [],
    advancedAt: { propose: Date.now() },
  };
}

export async function getProgram(): Promise<{ active: ImprovementProgram | null; history: ImprovementProgram[] }> {
  await loadStore();
  return { active: store.active, history: store.history.slice(0, 10) };
}

export async function startProgram(): Promise<ImprovementProgram> {
  await loadStore();
  if (store.active && store.active.status === "active") {
    return store.active;
  }
  const now = Date.now();
  const program: ImprovementProgram = {
    id: uid("prog"),
    status: "active",
    createdAt: now,
    currentCycle: 1,
    cycles: [newCycle(1)],
  };
  program.cycles[0].startSnapshot = captureSnapshot();
  store.active = program;
  await persistStore();
  return program;
}

export async function abandonProgram(): Promise<ImprovementProgram | null> {
  await loadStore();
  if (!store.active) return null;
  const p = store.active;
  p.status = "abandoned";
  p.completedAt = Date.now();
  store.history = [p, ...store.history].slice(0, 20);
  store.active = null;
  await persistStore();
  return p;
}

function currentCycle(p: ImprovementProgram): ProgramCycle {
  return p.cycles[p.cycles.length - 1];
}

async function ensureProposeProposals(cycle: ProgramCycle, priorReflection?: string): Promise<void> {
  if (cycle.proposals.length > 0) return;
  const fresh = await generateFreshProposals(5, priorReflection);
  cycle.proposals = fresh.map(toProgramProposal);
}

export async function generateCycleProposals(): Promise<ImprovementProgram> {
  await loadStore();
  if (!store.active) throw new Error("No active program");
  const p = store.active;
  const cycle = currentCycle(p);
  if (cycle.stage !== "propose") throw new Error("Proposals can only be generated during the propose stage");
  const prior = p.cycles[p.cycles.length - 2];
  await ensureProposeProposals(cycle, prior?.reflectionSummary);
  await persistStore();
  return p;
}

export async function advanceStage(): Promise<ImprovementProgram> {
  await loadStore();
  if (!store.active) throw new Error("No active program");
  const p = store.active;
  const cycle = currentCycle(p);
  const curIdx = STAGE_ORDER.indexOf(cycle.stage);
  if (curIdx < 0) throw new Error(`Unknown stage: ${cycle.stage}`);

  if (cycle.stage === "propose") {
    const prior = p.cycles[p.cycles.length - 2];
    await ensureProposeProposals(cycle, prior?.reflectionSummary);
  } else if (cycle.stage === "review") {
    const pending = cycle.proposals.filter(pr => pr.decision === "pending");
    if (pending.length > 0) {
      throw new Error(`Cannot advance: ${pending.length} proposal(s) still need approve/reject decisions`);
    }
  } else if (cycle.stage === "implement") {
    // Implementations are dispatched; no hard gate, allow advance any time user chooses.
  } else if (cycle.stage === "reflect") {
    cycle.endSnapshot = captureSnapshot();
    cycle.reflectionSummary = buildReflectionSummary(cycle);
  }

  const nextStage = STAGE_ORDER[curIdx + 1];
  cycle.stage = nextStage;
  cycle.advancedAt[nextStage] = Date.now();

  if (nextStage === "done") {
    if (cycle.cycleNumber >= MAX_CYCLES) {
      p.status = "completed";
      p.completedAt = Date.now();
      p.finalSummary = buildFinalSummary(p);
      store.history = [p, ...store.history].slice(0, 20);
      store.active = null;
    } else {
      const next = newCycle(cycle.cycleNumber + 1);
      next.startSnapshot = captureSnapshot();
      p.currentCycle = next.cycleNumber;
      p.cycles.push(next);
    }
  }

  await persistStore();
  return store.active ?? p;
}

export async function decideProposal(
  proposalId: string,
  decision: "approved" | "rejected",
  reason?: string,
): Promise<ImprovementProgram> {
  await loadStore();
  if (!store.active) throw new Error("No active program");
  const p = store.active;
  const cycle = currentCycle(p);
  if (cycle.stage !== "review") throw new Error("Proposals can only be decided during the review stage");
  const proposal = cycle.proposals.find(pr => pr.id === proposalId);
  if (!proposal) throw new Error("Proposal not found in current cycle");
  proposal.decision = decision;
  proposal.decidedAt = Date.now();
  if (reason && reason.trim().length > 0) {
    proposal.reviewerReason = reason.trim().slice(0, 400);
  }
  await persistStore();
  return p;
}

function formatDispatchBody(p: ImprovementProgram, cycle: ProgramCycle, proposal: ProgramProposal): string {
  const evidenceLines = proposal.evidence.map(e => `- ${e.metric}: ${e.value}`).join("\n");
  return `# ${proposal.title}

**Program:** ${p.id} (Cycle ${cycle.cycleNumber} of ${MAX_CYCLES})
**Proposal ID:** ${proposal.id}
**Category:** ${proposal.category}
**Risk:** ${proposal.risk}  ·  **Effort:** ~${proposal.effortHours}h
**Source:** ${proposal.source}${proposal.truthfulnessScore != null ? `  ·  **Truth score:** ${(proposal.truthfulnessScore * 100).toFixed(0)}%` : ""}

## Problem
${proposal.problem}

## Proposed change
${proposal.proposedChange}

## Expected impact
${proposal.expectedImpact}

## Evidence
${evidenceLines}

---
Dispatched from Rick's 5-cycle improvement program.
`;
}

export async function dispatchProposal(proposalId: string): Promise<ImprovementProgram> {
  await loadStore();
  if (!store.active) throw new Error("No active program");
  const p = store.active;
  const cycle = currentCycle(p);
  if (cycle.stage !== "implement") throw new Error("Dispatch is only available during the implement stage");
  const proposal = cycle.proposals.find(pr => pr.id === proposalId);
  if (!proposal) throw new Error("Proposal not found in current cycle");
  if (proposal.decision !== "approved") throw new Error("Only approved proposals can be dispatched");
  if (proposal.dispatch) return p;

  const taskRef = uid("dispatch");
  let filePath: string | undefined;
  try {
    const dir = path.resolve(process.cwd(), "..", "..", ".local", "dispatched-tasks");
    await fs.mkdir(dir, { recursive: true });
    const fileName = `${p.id}-c${cycle.cycleNumber}-${proposal.id}.md`;
    const fullPath = path.join(dir, fileName);
    await fs.writeFile(fullPath, formatDispatchBody(p, cycle, proposal), "utf-8");
    filePath = fullPath;
  } catch (err) {
    logger.warn({ err }, "RickProgram: failed to persist dispatch file (continuing with in-memory ref)");
  }

  proposal.dispatch = {
    taskRef,
    dispatchedAt: Date.now(),
    filePath,
    status: "dispatched",
    statusNote: "Task description created — hand off to a project-task executor to implement.",
  };
  await persistStore();
  return p;
}

export async function updateDispatchStatus(
  proposalId: string,
  status: "dispatched" | "completed" | "failed",
  note?: string,
): Promise<ImprovementProgram> {
  await loadStore();
  if (!store.active) throw new Error("No active program");
  const p = store.active;
  const cycle = currentCycle(p);
  const proposal = cycle.proposals.find(pr => pr.id === proposalId);
  if (!proposal || !proposal.dispatch) throw new Error("Proposal has not been dispatched");
  proposal.dispatch.status = status;
  if (note) proposal.dispatch.statusNote = note.slice(0, 400);
  await persistStore();
  return p;
}

function computeProposalDelta(cycle: ProgramCycle): { metric: string; before: number; after: number; delta: number }[] {
  if (!cycle.startSnapshot || !cycle.endSnapshot) return [];
  const s = cycle.startSnapshot;
  const e = cycle.endSnapshot;
  const out = [
    { metric: "daemon.overallSystemScorePct", before: s.overallScorePct, after: e.overallScorePct, delta: round(e.overallScorePct - s.overallScorePct) },
    { metric: "truth.groundingRate", before: round(s.truthGroundingRate), after: round(e.truthGroundingRate), delta: round(e.truthGroundingRate - s.truthGroundingRate) },
    { metric: "meeseeks.successRate", before: round(s.meeseeksSuccessRate), after: round(e.meeseeksSuccessRate), delta: round(e.meeseeksSuccessRate - s.meeseeksSuccessRate) },
  ];
  return out;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export async function recordReflection(proposalId: string, text: string): Promise<ImprovementProgram> {
  await loadStore();
  if (!store.active) throw new Error("No active program");
  const p = store.active;
  const cycle = currentCycle(p);
  if (cycle.stage !== "reflect") throw new Error("Reflections can only be recorded during the reflect stage");
  const proposal = cycle.proposals.find(pr => pr.id === proposalId);
  if (!proposal) throw new Error("Proposal not found in current cycle");
  if (proposal.decision !== "approved") throw new Error("Only approved proposals receive reflections");
  if (!cycle.endSnapshot) cycle.endSnapshot = captureSnapshot();
  proposal.reflection = {
    text: text.slice(0, 1200),
    metricDelta: computeProposalDelta(cycle),
    reflectedAt: Date.now(),
  };
  await persistStore();
  return p;
}

function buildReflectionSummary(cycle: ProgramCycle): string {
  if (!cycle.startSnapshot || !cycle.endSnapshot) return "No metric snapshots captured.";
  const d = round(cycle.endSnapshot.overallScorePct - cycle.startSnapshot.overallScorePct);
  const g = round(cycle.endSnapshot.truthGroundingRate - cycle.startSnapshot.truthGroundingRate);
  const approved = cycle.proposals.filter(p => p.decision === "approved");
  const reflections = approved
    .filter(p => p.reflection)
    .map(p => `• ${p.title}: ${p.reflection!.text.slice(0, 120)}`)
    .join("\n");
  return `Cycle ${cycle.cycleNumber}: daemon score ${cycle.startSnapshot.overallScorePct} → ${cycle.endSnapshot.overallScorePct} (Δ ${d >= 0 ? "+" : ""}${d}); grounding rate Δ ${g >= 0 ? "+" : ""}${g}. ${approved.length} approved proposal(s).${reflections ? "\n" + reflections : ""}`;
}

function buildFinalSummary(p: ImprovementProgram): ImprovementProgram["finalSummary"] {
  const all = p.cycles.flatMap(c => c.proposals);
  const approved = all.filter(x => x.decision === "approved");
  const rejected = all.filter(x => x.decision === "rejected");
  const approvalRate = all.length > 0 ? approved.length / all.length : 0;

  const reflected = p.cycles.flatMap(c =>
    c.proposals
      .filter(pr => pr.reflection && pr.reflection.metricDelta && pr.reflection.metricDelta.length > 0)
      .map(pr => ({
        cycle: c.cycleNumber,
        title: pr.title,
        reflection: pr.reflection!.text,
        primaryDelta: pr.reflection!.metricDelta![0]?.delta ?? 0,
      })),
  );
  reflected.sort((a, b) => b.primaryDelta - a.primaryDelta);
  const strongest = reflected[0];
  const weakest = reflected[reflected.length - 1];

  const firstSnap = p.cycles[0]?.startSnapshot?.overallScorePct ?? 0;
  const lastSnap = p.cycles[p.cycles.length - 1]?.endSnapshot?.overallScorePct
    ?? p.cycles[p.cycles.length - 1]?.startSnapshot?.overallScorePct
    ?? firstSnap;

  return {
    totalProposals: all.length,
    approvedCount: approved.length,
    rejectedCount: rejected.length,
    approvalRate: round(approvalRate),
    strongestImprovement: strongest ? { cycle: strongest.cycle, title: strongest.title, reflection: strongest.reflection } : undefined,
    weakestImprovement: weakest && weakest !== strongest ? { cycle: weakest.cycle, title: weakest.title, reflection: weakest.reflection } : undefined,
    overallScoreStart: firstSnap,
    overallScoreEnd: lastSnap,
    overallScoreDelta: round(lastSnap - firstSnap),
  };
}

export const PROGRAM_MAX_CYCLES = MAX_CYCLES;
export const PROGRAM_STAGES: CycleStage[] = STAGE_ORDER;
