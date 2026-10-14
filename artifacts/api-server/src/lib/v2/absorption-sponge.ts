// Absorption Sponge — every interaction is absorbed: recorded (secret-
// redacted, append-only), distilled into retrievable lessons, and answered
// with a leading next step so each exchange moves the user forward.
// Built on the local memory store. No network, no weight updates.

import { createMemoryStore, type MemoryStore } from "../memory/store";
import type { RetrievedLesson } from "../memory/types";

export interface AbsorbInput {
  sourceAgent: string;
  input: string;
  output: string;
  tags?: string[];
}

export interface AbsorbResult {
  recordId: string;
  recalledLessons: RetrievedLesson[];
  leadingActions: string[];
  limits: string;
}

const LIMITS =
  "Append-only local JSONL; redaction is pattern-based, not a guarantee; " +
  "lessons are retrieval text, not model weight training.";

/** Deterministic next-step guidance derived from the interaction itself. */
export function deriveLeadingActions(input: string, recalled: RetrievedLesson[]): string[] {
  const actions: string[] = [];
  const text = input.toLowerCase();
  if (/\bremember\b|\balways\b|\bnever\b|\bfrom now on\b/.test(text)) {
    actions.push("Save this as a standing instruction and verify it is retrieved next session.");
  }
  if (/\bwrong\b|\bbroken\b|\bfix\b|\berror\b|\bbug\b/.test(text)) {
    actions.push("Add a regression test before treating this correction as closed.");
  }
  if (input.trim().endsWith("?")) {
    actions.push("Confirm the answer resolved the question; if not, record the gap as a lesson.");
  }
  if (recalled.length === 0) {
    actions.push("No prior lessons matched — record the distilled lesson so the next similar interaction starts ahead.");
  }
  if (actions.length === 0) actions.push("Distill and store one reusable lesson from this interaction.");
  return actions.slice(0, 3);
}

export function createAbsorptionSponge(store: MemoryStore = createMemoryStore()) {
  return {
    async absorb({ sourceAgent, input, output, tags }: AbsorbInput): Promise<AbsorbResult> {
      const record = await store.record({ sourceAgent, input, output, tags });
      const recalledLessons = await store.recall(input, 3);
      return {
        recordId: record.id,
        recalledLessons,
        leadingActions: deriveLeadingActions(input, recalledLessons),
        limits: LIMITS,
      };
    },
  };
}

export type AbsorptionSponge = ReturnType<typeof createAbsorptionSponge>;
