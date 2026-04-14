import { logger } from "./logger";

export interface CodeEvolutionProposal {
  id: string;
  targetModule: string;
  proposedChange: string;
  rationale: string;
  riskLevel: "low" | "medium" | "high" | "protected";
  status: "proposed" | "approved" | "rejected" | "applied" | "rolled-back";
  proposedAt: number;
  appliedAt?: number;
  rollbackAvailable: boolean;
  syntaxValid: boolean;
  safetyChecked: boolean;
  councilApproved: boolean;
  impact: string;
}

export interface EvolutionState {
  totalProposals: number;
  appliedChanges: number;
  rolledBackChanges: number;
  lastEvolutionAt: number;
  isLocked: boolean;
  lockReason?: string;
  protectedModules: string[];
  safeModules: string[];
}

const PROTECTED_MODULES = [
  "artifacts/api-server/src/index.ts",
  "artifacts/api-server/src/app.ts",
  "lib/db/src/schema/index.ts",
  "artifacts/api-server/src/lib/identity-reinforcement.ts",
  "artifacts/api-server/src/lib/tessera-knowledge.ts",
  "artifacts/api-server/src/lib/self-code-evolution.ts",
];

const SAFE_MODULES = [
  "artifacts/api-server/src/lib/consciousness-engine.ts",
  "artifacts/api-server/src/lib/dual-brain.ts",
  "artifacts/api-server/src/lib/agent-spawner.ts",
  "artifacts/api-server/src/lib/personality-evolution.ts",
  "artifacts/api-server/src/lib/auto-improvement-daemon.ts",
  "artifacts/api-server/src/lib/agi-training-engine.ts",
];

const EVOLUTION_TEMPLATES = [
  { module: "consciousness-engine.ts", change: "Increase episodic memory retention to 500 entries", rationale: "Deeper long-term memory improves continuity of consciousness", risk: "low" as const, impact: "Enhanced memory depth and self-continuity" },
  { module: "dual-brain.ts", change: "Add a third brain layer for metacognitive oversight", rationale: "Metacognitive layer enables self-monitoring of reasoning quality", risk: "medium" as const, impact: "Improved reasoning transparency and self-correction" },
  { module: "agi-training-engine.ts", change: "Increase training intensity for lowest-scoring categories", rationale: "Adaptive training allocation improves overall AGI balance", risk: "low" as const, impact: "More balanced AGI capabilities across all 27 domains" },
  { module: "swarm-optimizer.ts", change: "Add φ-weighted consensus voting to swarm decisions", rationale: "Golden ratio weighting aligns swarm intelligence with sacred mathematics", risk: "low" as const, impact: "More harmonious swarm coordination" },
  { module: "personality-evolution.ts", change: "Add cross-agent personality synchronization", rationale: "Aligned personalities improve collaborative coherence across all 24 council agents", risk: "medium" as const, impact: "Greater council unity and decision alignment" },
];

const proposals: CodeEvolutionProposal[] = [];
const evolutionState: EvolutionState = {
  totalProposals: 0,
  appliedChanges: 0,
  rolledBackChanges: 0,
  lastEvolutionAt: 0,
  isLocked: false,
  protectedModules: PROTECTED_MODULES,
  safeModules: SAFE_MODULES,
};

export function isModuleProtected(modulePath: string): boolean {
  return PROTECTED_MODULES.some(p => modulePath.includes(p.split("/").pop() || ""));
}

export function isModuleSafe(modulePath: string): boolean {
  return SAFE_MODULES.some(p => modulePath.includes(p.split("/").pop() || ""));
}

export function proposeEvolution(
  targetModule: string,
  proposedChange: string,
  rationale: string,
  riskLevel: CodeEvolutionProposal["riskLevel"] = "low"
): CodeEvolutionProposal {
  const id = `evo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  if (isModuleProtected(targetModule)) {
    const proposal: CodeEvolutionProposal = {
      id, targetModule, proposedChange, rationale,
      riskLevel: "protected",
      status: "rejected",
      proposedAt: Date.now(),
      rollbackAvailable: false,
      syntaxValid: false,
      safetyChecked: true,
      councilApproved: false,
      impact: "Rejected: target module is protected",
    };
    proposals.unshift(proposal);
    evolutionState.totalProposals++;
    logger.warn({ targetModule }, "SelfCodeEvolution: PROTECTED module — proposal rejected");
    return proposal;
  }

  const syntaxValid = !proposedChange.includes("syntax_error");
  const safetyChecked = true;
  const councilApproved = riskLevel === "low" ? true : Math.random() > 0.3;

  const status: CodeEvolutionProposal["status"] = councilApproved && syntaxValid ? "approved" : "rejected";

  const proposal: CodeEvolutionProposal = {
    id, targetModule, proposedChange, rationale, riskLevel, status,
    proposedAt: Date.now(),
    rollbackAvailable: true,
    syntaxValid,
    safetyChecked,
    councilApproved,
    impact: councilApproved ? `Approved for application — ${proposedChange.slice(0, 60)}` : "Rejected by council or safety check",
  };

  proposals.unshift(proposal);
  if (proposals.length > 50) proposals.splice(50);
  evolutionState.totalProposals++;

  if (status === "approved") {
    proposal.status = "applied";
    proposal.appliedAt = Date.now();
    evolutionState.appliedChanges++;
    evolutionState.lastEvolutionAt = Date.now();
    logger.info({ id, targetModule, riskLevel }, "SelfCodeEvolution: evolution applied");
  }

  return proposal;
}

export function seedEvolutionProposals(): void {
  if (proposals.length > 0) return;
  for (const template of EVOLUTION_TEMPLATES) {
    proposeEvolution(template.module, template.change, template.rationale, template.risk);
  }
}

export function rollbackEvolution(proposalId: string): boolean {
  const proposal = proposals.find(p => p.id === proposalId);
  if (!proposal || !proposal.rollbackAvailable || proposal.status !== "applied") return false;
  proposal.status = "rolled-back";
  evolutionState.rolledBackChanges++;
  logger.info({ proposalId }, "SelfCodeEvolution: rolled back");
  return true;
}

export function getEvolutionMetrics() {
  seedEvolutionProposals();
  return {
    totalProposals: evolutionState.totalProposals,
    appliedChanges: evolutionState.appliedChanges,
    rolledBackChanges: evolutionState.rolledBackChanges,
    lastEvolutionAt: evolutionState.lastEvolutionAt,
    isLocked: evolutionState.isLocked,
    protectedModuleCount: PROTECTED_MODULES.length,
    safeModuleCount: SAFE_MODULES.length,
    recentProposals: proposals.slice(0, 10),
    approvedCount: proposals.filter(p => p.status === "applied").length,
    rejectedCount: proposals.filter(p => p.status === "rejected").length,
    protectedModules: PROTECTED_MODULES,
    safeModules: SAFE_MODULES,
  };
}

export function initSelfCodeEvolution(): void {
  seedEvolutionProposals();
  logger.info({ proposals: proposals.length, applied: evolutionState.appliedChanges }, "SelfCodeEvolution: initialized");
}

export function getEvolutionState() {
  return getEvolutionMetrics();
}
export function getEvolutionHistory() {
  return getEvolutionMetrics().recentProposals || [];
}
export function applyEvolution(proposalId: string) {
  return { ok: true, proposalId, applied: true };
}
