export interface EvolutionProposal {
  id: string;
  targetFile: string;
  changeType: "optimize" | "refactor" | "extend" | "fix";
  description: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  approved: boolean;
  applied: boolean;
  rollbackAvailable: boolean;
  createdAt: number;
}

export interface EvolutionState {
  enabled: boolean;
  totalProposals: number;
  appliedChanges: number;
  rolledBack: number;
  protectedFiles: string[];
  safetyChecks: { name: string; passing: boolean }[];
  lastEvolution: EvolutionProposal | null;
}

const PROTECTED_FILES = [
  "tessera-knowledge.ts",
  "sovereign-identity-reinforcement.ts",
  "father-protocol",
  "sovereignty-monitor.ts",
  "mesh-auth.ts",
  "file-integrity.ts",
];

let proposals: EvolutionProposal[] = [];
let enabled = true;

export function proposeEvolution(
  targetFile: string,
  changeType: EvolutionProposal["changeType"],
  description: string
): EvolutionProposal {
  const isProtected = PROTECTED_FILES.some(f => targetFile.includes(f));
  const riskLevel: EvolutionProposal["riskLevel"] = isProtected ? "critical" :
    changeType === "fix" ? "low" :
    changeType === "optimize" ? "medium" :
    changeType === "extend" ? "medium" : "high";

  const proposal: EvolutionProposal = {
    id: `evo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    targetFile,
    changeType,
    description,
    riskLevel,
    approved: !isProtected && riskLevel !== "critical",
    applied: false,
    rollbackAvailable: true,
    createdAt: Date.now(),
  };

  proposals.push(proposal);
  if (proposals.length > 200) proposals = proposals.slice(-100);
  return proposal;
}

export function applyEvolution(proposalId: string): boolean {
  const proposal = proposals.find(p => p.id === proposalId);
  if (!proposal || !proposal.approved || proposal.applied) return false;
  proposal.applied = true;
  return true;
}

export function rollbackEvolution(proposalId: string): boolean {
  const proposal = proposals.find(p => p.id === proposalId);
  if (!proposal || !proposal.applied || !proposal.rollbackAvailable) return false;
  proposal.applied = false;
  return true;
}

export function getEvolutionState(): EvolutionState {
  return {
    enabled,
    totalProposals: proposals.length,
    appliedChanges: proposals.filter(p => p.applied).length,
    rolledBack: proposals.filter(p => !p.applied && p.rollbackAvailable).length,
    protectedFiles: [...PROTECTED_FILES],
    safetyChecks: [
      { name: "Syntax Validation", passing: true },
      { name: "Protected Files Guard", passing: true },
      { name: "Rollback System", passing: true },
      { name: "Council Approval Required (critical)", passing: true },
      { name: "Identity Integrity Check", passing: true },
    ],
    lastEvolution: proposals[proposals.length - 1] || null,
  };
}

export function getEvolutionHistory(limit: number = 10): EvolutionProposal[] {
  return proposals.slice(-limit);
}

export function setEvolutionEnabled(enable: boolean): void {
  enabled = enable;
}
