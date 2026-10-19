/**
 * Runtime wiring for the agent admission gate (lib/admission).
 *
 * The admission modules are deliberately pure (no env, no I/O; a source-scan test enforces that). This file is the
 * only place that reads configuration and owns the process-wide SocietyRegistry. Every agent-creation choke point
 * calls checkAgentCreation / assertAgentCreationAllowed with the identity and manifest hash of what it is about to
 * create; the answer is `requireMember` against the registry.
 *
 * Feature flag TESSERA_ADMISSION_GATE:
 *   off      legacy behaviour, the registry is not consulted
 *   audit    DEFAULT. Creation proceeds, non-members are logged and counted (no behaviour change, produces evidence)
 *   enforce  creation of a non-member is refused
 * An unrecognised value fails closed to `enforce`. Enforcement is only useful once an operator has set
 * TESSERA_ADMISSION_ATTESTATION_KEY and admitted agents through SocietyRegistry.admit: with no key the registry
 * admits nobody (fail-closed, issue #349), so `enforce` without a key refuses every creation.
 */
import { SocietyRegistry, requireMember } from "./admission/registry";
import { hashOf } from "./admission/det";
import { logger } from "./logger";

export type AdmissionMode = "off" | "audit" | "enforce";

export const ADMISSION_GATE_ENV = "TESSERA_ADMISSION_GATE";
export const ADMISSION_KEY_ENV = "TESSERA_ADMISSION_ATTESTATION_KEY";
export const DEFAULT_ADMISSION_MODE: AdmissionMode = "audit";

const RECENT_DECISION_LIMIT = 100;

export function resolveAdmissionMode(raw: string | undefined = process.env[ADMISSION_GATE_ENV]): AdmissionMode {
  if (raw === undefined || raw.trim() === "") return DEFAULT_ADMISSION_MODE;
  const value = raw.trim().toLowerCase();
  if (value === "off" || value === "audit" || value === "enforce") return value;
  return "enforce";
}

export interface AgentCreationRequest {
  /** Stable name of the creation path, e.g. "agent-spawner:spawnAgent". */
  path: string;
  /** Identity the registry knows the agent (or agent template) by. */
  subjectId: string;
  /** Hash of the artifact being created; membership does not carry over if it changes. */
  manifestHash: string;
}

export interface AgentCreationDecision extends AgentCreationRequest {
  allowed: boolean;
  mode: AdmissionMode;
  /** null when the gate is off and the registry was not consulted. */
  member: boolean | null;
  reason: string;
}

export class AgentCreationDeniedError extends Error {
  readonly code = "ADMISSION_DENIED";
  readonly decision: AgentCreationDecision;
  constructor(decision: AgentCreationDecision) {
    super(`agent creation refused at ${decision.path}: ${decision.subjectId} is not an admitted member of the society`);
    this.name = "AgentCreationDeniedError";
    this.decision = decision;
  }
}

export function creationManifestHash(manifest: unknown): string {
  return hashOf(manifest);
}

let registry: SocietyRegistry | null = null;

export function getSocietyRegistry(): SocietyRegistry {
  if (!registry) {
    const key = process.env[ADMISSION_KEY_ENV]?.trim();
    registry = new SocietyRegistry({ attestationKey: key ? key : undefined });
  }
  return registry;
}

interface PathCounters {
  checked: number;
  nonMembers: number;
}

const counters = { checked: 0, members: 0, nonMembers: 0, denied: 0 };
const byPath: Record<string, PathCounters> = Object.create(null);
let recent: AgentCreationDecision[] = [];

function record(decision: AgentCreationDecision): void {
  counters.checked++;
  const entry = byPath[decision.path] ?? (byPath[decision.path] = { checked: 0, nonMembers: 0 });
  entry.checked++;
  if (decision.member) {
    counters.members++;
  } else {
    counters.nonMembers++;
    entry.nonMembers++;
    if (!decision.allowed) counters.denied++;
  }
  recent.push(decision);
  if (recent.length > RECENT_DECISION_LIMIT) recent = recent.slice(-RECENT_DECISION_LIMIT);
}

export function checkAgentCreation(request: AgentCreationRequest): AgentCreationDecision {
  const mode = resolveAdmissionMode();
  if (mode === "off") {
    return { ...request, allowed: true, mode, member: null, reason: "admission gate off" };
  }

  let member = false;
  try {
    requireMember(getSocietyRegistry(), request.subjectId, request.manifestHash);
    member = true;
  } catch {
    member = false;
  }

  const allowed = member || mode === "audit";
  const reason = member
    ? "admitted member"
    : mode === "audit"
      ? "not an admitted member (audit: allowed)"
      : "not an admitted member (enforce: refused)";
  const decision: AgentCreationDecision = { ...request, allowed, mode, member, reason };
  record(decision);
  if (!member) {
    logger.warn(
      { path: request.path, subjectId: request.subjectId, mode, allowed },
      "AdmissionGate: agent creation by a non-member",
    );
  }
  return decision;
}

export function assertAgentCreationAllowed(request: AgentCreationRequest): AgentCreationDecision {
  const decision = checkAgentCreation(request);
  if (!decision.allowed) throw new AgentCreationDeniedError(decision);
  return decision;
}

export interface AdmissionGateStatus {
  mode: AdmissionMode;
  keyConfigured: boolean;
  checked: number;
  members: number;
  nonMembers: number;
  denied: number;
  byPath: Record<string, PathCounters>;
  recent: AgentCreationDecision[];
}

export function getAdmissionGateStatus(): AdmissionGateStatus {
  const pathCopy: Record<string, PathCounters> = {};
  for (const [path, value] of Object.entries(byPath)) pathCopy[path] = { ...value };
  return {
    mode: resolveAdmissionMode(),
    keyConfigured: Boolean(process.env[ADMISSION_KEY_ENV]?.trim()),
    ...counters,
    byPath: pathCopy,
    recent: recent.slice(-10),
  };
}

export function _setSocietyRegistryForTests(next: SocietyRegistry | null): void {
  registry = next;
}

export function _resetAdmissionGateForTests(): void {
  registry = null;
  counters.checked = 0;
  counters.members = 0;
  counters.nonMembers = 0;
  counters.denied = 0;
  for (const key of Object.keys(byPath)) delete byPath[key];
  recent = [];
}
