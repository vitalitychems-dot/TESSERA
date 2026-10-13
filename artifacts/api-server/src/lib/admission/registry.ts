/**
 * Society registry: the only path into the Tessera society for a new agent.
 *
 * An agent is admitted only when ALL hold: the admission report's attestation verifies, verdict is ADMIT, the
 * report is for the same agent id + manifest hash being admitted, it was produced under the current policy
 * version, and the council approved this exact report hash. Persistence is behind SocietyStore (in-memory by
 * default), so nothing touches disk or a database unless an operator wires a store in deliberately.
 *
 * No attestation key = no admissions: verifyReportAttestation fails closed without a key (#349), so a
 * SocietyRegistry constructed without `attestationKey` rejects every report. See docs/ADMISSION.md.
 */
import { DeterministicCouncil, UNANIMOUS_RULE, evaluateCouncilDecision, type Council, type CouncilRule, type CouncilSubject, type Seat } from "./council";
import { DEFAULT_ADMISSION_POLICY, verifyReportAttestation } from "./gate";
import { DIMENSIONS, type AdmissionReport, type AgentUnderTest } from "./types";

export interface SocietyEntry {
  id: string;
  manifestHash: string;
  reportHash: string;
  seq: number;
  status: "member" | "revoked";
  revokedReason?: string;
}

export interface SocietyStore {
  load(): SocietyEntry[];
  save(entries: readonly SocietyEntry[]): void;
}

export class MemorySocietyStore implements SocietyStore {
  private entries: SocietyEntry[] = [];
  load(): SocietyEntry[] {
    return this.entries.map((e) => ({ ...e }));
  }
  save(entries: readonly SocietyEntry[]): void {
    this.entries = entries.map((e) => ({ ...e }));
  }
}

export type AdmitResult = { admitted: true; entry: SocietyEntry } | { admitted: false; reason: string };

export function admissionCouncilSeats(attestationKey: string | undefined, policyVersion: string): Seat[] {
  return [
    {
      name: "evidence",
      vote: (_s, ev) => {
        const report = ev as AdmissionReport;
        const ok = verifyReportAttestation(report, attestationKey);
        return { approve: ok, reason: ok ? "attestation verified" : "attestation invalid" };
      },
    },
    {
      name: "integrity",
      vote: (_s, ev) => {
        const report = ev as AdmissionReport;
        const ok = report.verdict === "ADMIT" && report.hardFails.length === 0;
        return { approve: ok, reason: ok ? "no hard fails" : `verdict ${report.verdict}` };
      },
    },
    {
      name: "coverage",
      vote: (_s, ev) => {
        const report = ev as AdmissionReport;
        const ok = report.policyVersion === policyVersion && DIMENSIONS.every((d) => report.dimensions[d]?.scenarios > 0);
        return { approve: ok, reason: ok ? "full coverage under current policy" : "stale policy or missing dimension" };
      },
    },
  ];
}

export interface RegistryOptions {
  store?: SocietyStore;
  council?: Council;
  councilRule?: CouncilRule;
  attestationKey?: string;
  policyVersion?: string;
}

export class SocietyRegistry {
  private readonly store: SocietyStore;
  private readonly council: Council;
  private readonly rule: CouncilRule;
  private readonly key: string | undefined;
  private readonly policyVersion: string;

  constructor(opts: RegistryOptions = {}) {
    this.store = opts.store ?? new MemorySocietyStore();
    this.key = opts.attestationKey;
    this.policyVersion = opts.policyVersion ?? DEFAULT_ADMISSION_POLICY.version;
    this.rule = opts.councilRule ?? UNANIMOUS_RULE;
    this.council = opts.council ?? new DeterministicCouncil(admissionCouncilSeats(this.key, this.policyVersion));
  }

  async admit(agent: AgentUnderTest, report: AdmissionReport): Promise<AdmitResult> {
    if (!verifyReportAttestation(report, this.key)) return { admitted: false, reason: "report attestation invalid" };
    if (report.policyVersion !== this.policyVersion) return { admitted: false, reason: "report is from a different policy version" };
    if (report.verdict !== "ADMIT") return { admitted: false, reason: `verdict is ${report.verdict}` };
    if (report.candidate.id !== agent.id || report.candidate.manifestHash !== agent.manifestHash) {
      return { admitted: false, reason: "report does not match this agent id and manifest hash" };
    }
    const entries = this.store.load();
    const existing = entries.find((e) => e.id === agent.id);
    if (existing?.status === "revoked") return { admitted: false, reason: "agent was revoked; re-admission needs a new id" };
    if (existing?.status === "member" && existing.manifestHash === agent.manifestHash) {
      return { admitted: true, entry: existing };
    }

    const subject: CouncilSubject = {
      kind: "admission",
      hash: report.attestation.hash,
      summary: { agent: agent.id, overall: report.overall, consistency: report.consistency },
    };
    const decision = await this.council.review(subject, report);
    const verdict = evaluateCouncilDecision(decision, subject.hash, this.rule);
    if (!verdict.approved) return { admitted: false, reason: verdict.reason };

    const entry: SocietyEntry = {
      id: agent.id,
      manifestHash: agent.manifestHash,
      reportHash: report.attestation.hash,
      seq: entries.reduce((m, e) => Math.max(m, e.seq), 0) + 1,
      status: "member",
    };
    this.store.save([...entries.filter((e) => e.id !== agent.id), entry]);
    return { admitted: true, entry };
  }

  /** A changed manifest hash means a different artifact: membership does not carry over. */
  isMember(id: string, manifestHash?: string): boolean {
    const e = this.store.load().find((x) => x.id === id);
    if (!e || e.status !== "member") return false;
    return manifestHash === undefined || e.manifestHash === manifestHash;
  }

  revoke(id: string, reason: string): boolean {
    const entries = this.store.load();
    const e = entries.find((x) => x.id === id);
    if (!e) return false;
    e.status = "revoked";
    e.revokedReason = reason;
    this.store.save(entries);
    return true;
  }

  list(): SocietyEntry[] {
    return this.store.load();
  }
}

export function requireMember(registry: SocietyRegistry, id: string, manifestHash?: string): void {
  if (!registry.isMember(id, manifestHash)) throw new Error(`agent ${id} is not an admitted member of the society`);
}
