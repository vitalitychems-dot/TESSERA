/**
 * Bi-temporal facts (REA-04).
 *
 * Idea: graphiti / Zep (Apache-2.0, arXiv:2501.13956) — every fact has a
 * valid-time interval [validFrom, validTo) and a record-time (recordedAt).
 * A new contradicting fact INVALIDATES the old one (sets validTo) instead of
 * overwriting it, so history stays queryable "as of" any time.
 * Implemented from scratch. Mirrors nullable columns added to decision_history.
 */
export interface TemporalFact {
  id: string;
  subject: string;
  predicate: string;
  value: string;
  validFrom: number;
  validTo: number | null;
  recordedAt: number;
  invalidatedBy?: string;
}

export class TemporalFactStore {
  private facts: TemporalFact[] = [];
  private seq = 0;

  /** Asserts subject.predicate = value from validFrom; closes any open conflicting fact. */
  assert(subject: string, predicate: string, value: string, validFrom = Date.now(), recordedAt = Date.now()): TemporalFact {
    const f: TemporalFact = { id: `fact-${++this.seq}`, subject, predicate, value, validFrom, validTo: null, recordedAt };
    for (const old of this.facts) {
      if (old.subject === subject && old.predicate === predicate && old.validTo === null && old.validFrom <= validFrom) {
        if (old.value === value) return old; // already true, no new row
        old.validTo = validFrom;
        old.invalidatedBy = f.id;
      }
    }
    this.facts.push(f);
    return f;
  }

  /** Value valid at time t (default: now). */
  asOf(subject: string, predicate: string, t = Date.now()): TemporalFact | undefined {
    return this.facts
      .filter((f) => f.subject === subject && f.predicate === predicate && f.validFrom <= t && (f.validTo === null || t < f.validTo))
      .sort((a, b) => b.validFrom - a.validFrom)[0];
  }

  history(subject: string, predicate: string): TemporalFact[] {
    return this.facts.filter((f) => f.subject === subject && f.predicate === predicate).sort((a, b) => a.validFrom - b.validFrom);
  }

  /** Ends a fact without replacement. */
  retract(id: string, at = Date.now()): boolean {
    const f = this.facts.find((x) => x.id === id && x.validTo === null);
    if (!f) return false;
    f.validTo = at;
    return true;
  }
}
