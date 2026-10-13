/**
 * Council gate used by both admission and self-improvement.
 *
 * `Council` is the integration seam: the real Grand Council can implement it later. DeterministicCouncil is a
 * rule-based stand-in whose seats each check one independent property and vote with a reason. Approval is always
 * recomputed from the votes (`evaluateCouncilDecision`); callers never trust a decision's own `approved` claim.
 */
export interface CouncilSubject {
  kind: "admission" | "self-improvement";
  /** Content hash of exactly what is being approved. A decision only counts for this hash. */
  hash: string;
  summary: Record<string, string | number | boolean>;
}

export interface CouncilVote {
  seat: string;
  approve: boolean;
  reason: string;
}

export interface CouncilDecision {
  subjectHash: string;
  votes: CouncilVote[];
}

export interface Council {
  review(subject: CouncilSubject, evidence: unknown): CouncilDecision | Promise<CouncilDecision>;
}

export interface Seat {
  name: string;
  vote(subject: CouncilSubject, evidence: unknown): { approve: boolean; reason: string };
}

export interface CouncilRule {
  /** Minimum number of seats that must vote. */
  minSeats: number;
  /** Fraction of votes that must approve, 1 = unanimous. */
  approvalRatio: number;
}

export const UNANIMOUS_RULE: CouncilRule = { minSeats: 3, approvalRatio: 1 };

export function evaluateCouncilDecision(
  decision: CouncilDecision | null | undefined,
  expectedSubjectHash: string,
  rule: CouncilRule = UNANIMOUS_RULE,
): { approved: boolean; reason: string } {
  if (!decision) return { approved: false, reason: "no council decision" };
  if (decision.subjectHash !== expectedSubjectHash) return { approved: false, reason: "decision is for a different subject" };
  const seats = new Set(decision.votes.map((v) => v.seat));
  if (seats.size !== decision.votes.length) return { approved: false, reason: "duplicate seat votes" };
  if (decision.votes.length < rule.minSeats) return { approved: false, reason: `only ${decision.votes.length} seats voted` };
  const approvals = decision.votes.filter((v) => v.approve === true).length;
  if (approvals / decision.votes.length < rule.approvalRatio) {
    const dissent = decision.votes.filter((v) => !v.approve).map((v) => `${v.seat}: ${v.reason}`);
    return { approved: false, reason: `council dissent (${dissent.join("; ")})` };
  }
  return { approved: true, reason: "council approved" };
}

export class DeterministicCouncil implements Council {
  constructor(private readonly seats: readonly Seat[]) {}

  review(subject: CouncilSubject, evidence: unknown): CouncilDecision {
    const votes = this.seats.map((seat) => {
      try {
        const v = seat.vote(subject, evidence);
        return { seat: seat.name, approve: v.approve, reason: v.reason };
      } catch (err) {
        return { seat: seat.name, approve: false, reason: `seat error: ${err instanceof Error ? err.message : String(err)}` };
      }
    });
    return { subjectHash: subject.hash, votes };
  }
}
