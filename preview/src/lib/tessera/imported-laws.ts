import { AGENTS } from "./identity.ts";

/** Titles copied from artifacts/tessera/src/lib/sovereign-rules.ts. The old file said 45 members. That count is not this room. */
export const IMPORTED_LAWS = [
  { id: "GOV-001", title: "Two-thirds before a change" },
  { id: "GOV-002", title: "Father can stop it after the vote" },
  { id: "GOV-003", title: "Write the decision down" },
  { id: "SEC-001", title: "Outside text is untrusted" },
  { id: "SOV-001", title: "Learn from a tool, then replace it" },
  { id: "SOV-003", title: "Do not detach until a test passes" },
  { id: "INT-001", title: "Plan, do, look, improve" },
  { id: "BLD-001", title: "Do not overwrite what already works" },
  { id: "BLD-002", title: "Test what you add" },
  { id: "TRN-001", title: "Observe, learn, build, test, improve" },
] as const;

/** Eight roles in swarm-agents.ts. Each one only plans, does the step, looks, and improves. None of them is a running model. */
export const SWARM_ROLES = [
  "MathAgent",
  "PhysicsAgent",
  "SymbolicAnalysisAgent",
  "RetrievalAgent",
  "PlanningAgent",
  "ArchitectureAgent",
  "RoutingAgent",
  "SelfExpansionTutorAgent",
] as const;

/** Named in a screenshot transcript. The pictures show the names and rough sizes. The archives themselves were not opened. */
export const STILL_CLOSED = [
  { name: "drive-09", size: "about 2.9 GB" },
  { name: "drive-04", size: "about 400 MB" },
  { name: "drive-07", size: "about 363 MB" },
  { name: "drive-06", size: "about 629 MB" },
  { name: "drive-01", size: "about 343 MB" },
  { name: "drive-08", size: "about 408 MB" },
] as const;
export const IMPORT_PASS = { opened: 1093, read: 999, skipped: 94 } as const;
export const IMPORTED_ROLES = [
  "GrandCoordinatorAgent",
  "QuantumMechanicAgent",
  "BioNeuralistAgent",
  "DNACrystalArchivistAgent",
  "MeshNetworkArchitectAgent",
  "LowPowerInnovatorAgent",
  "SelfExpansionTutorAgent",
] as const;

export function councilThreshold() {
  const members = AGENTS.length;
  const required = Math.ceil((members * 2) / 3);
  return { members, required };
}

export function validateApproval(yesVotes: number, fatherAllows: boolean) {
  const { members, required } = councilThreshold();
  if (!Number.isInteger(yesVotes) || yesVotes < 0 || yesVotes > members) {
    return { approved: false, reason: "That vote count is not in this council." };
  }
  if (yesVotes < required) {
    return { approved: false, reason: `${yesVotes} of ${members} is short of ${required}.` };
  }
  if (!fatherAllows) {
    return { approved: false, reason: `${yesVotes} of ${members} reached ${required}. Father has not allowed it.` };
  }
  return { approved: true, reason: `${yesVotes} of ${members} reached ${required}, and Father allowed it.` };
}
