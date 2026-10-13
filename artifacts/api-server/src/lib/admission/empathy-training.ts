/**
 * Wires the empathic recognizer into the bounded self-improvement harness.
 *
 * Train split drives the search, the holdout split is the overfitting check, and guards enforce floors that
 * can never be traded away for a higher score (no emotion class collapsing, end-to-end reply quality floor).
 */
import { round6 } from "./det";
import { EMPATHY_HOLDOUT, EMPATHY_TRAIN, EMOTIONS, type Emotion, type LabeledUtterance } from "./empathy-corpus";
import {
  DEFAULT_EMPATHY_PARAMS,
  EMPATHY_PARAM_SPECS,
  evaluateRecognizer,
  learnLexicon,
  recognizeEmotion,
  referenceEmpathicReply,
  scoreEmpathicReply,
  type EmpathyParams,
  type LearnedLexicon,
} from "./empathy";
import { SelfImprovementController, type ControllerOptions, type Guard, type ImprovementSubject, type ParamVector } from "./self-improvement";

const asParams = (v: ParamVector): EmpathyParams => v as unknown as EmpathyParams;

/** Mean appraisal of the reply a recognizer-driven responder would send, judged against the true emotion. */
export function responseQuality(corpus: readonly LabeledUtterance[], params: EmpathyParams, learned: LearnedLexicon): number {
  if (corpus.length === 0) return 0;
  let sum = 0;
  for (const { text, label } of corpus) {
    const reading = recognizeEmotion(text, params, learned);
    sum += scoreEmpathicReply(label, referenceEmpathicReply(reading)).score;
  }
  return round6(sum / corpus.length);
}

/** Benchmarks any responder (an agent's reply function) on the labelled corpus. Deterministic. */
export function benchmarkResponder(
  respond: (utterance: string) => string,
  corpus: readonly LabeledUtterance[] = EMPATHY_HOLDOUT,
): { mean: number; dismissiveRate: number; byEmotion: Record<Emotion, number> } {
  const sums = Object.fromEntries(EMOTIONS.map((e) => [e, { s: 0, n: 0 }])) as Record<Emotion, { s: number; n: number }>;
  let dismissive = 0;
  let total = 0;
  for (const { text, label } of corpus) {
    const a = scoreEmpathicReply(label, respond(text));
    sums[label].s += a.score;
    sums[label].n += 1;
    total += a.score;
    if (a.dismissive) dismissive += 1;
  }
  const byEmotion = Object.fromEntries(EMOTIONS.map((e) => [e, round6(sums[e].n ? sums[e].s / sums[e].n : 0)])) as Record<Emotion, number>;
  return { mean: round6(corpus.length ? total / corpus.length : 0), dismissiveRate: round6(corpus.length ? dismissive / corpus.length : 0), byEmotion };
}

export interface EmpathySubjectOptions {
  train?: readonly LabeledUtterance[];
  holdout?: readonly LabeledUtterance[];
  minClassRecall?: number;
  minResponseQuality?: number;
}

export function buildEmpathySubject(opts: EmpathySubjectOptions = {}): ImprovementSubject {
  const train = opts.train ?? EMPATHY_TRAIN;
  const holdout = opts.holdout ?? EMPATHY_HOLDOUT;
  const minRecall = opts.minClassRecall ?? 0.2;
  const minQuality = opts.minResponseQuality ?? 0.5;
  const learned = learnLexicon(train);

  const guards: Guard[] = [
    {
      name: "no-class-collapse",
      check: (p) => {
        for (const [split, corpus] of [["train", train], ["holdout", holdout]] as const) {
          const m = evaluateRecognizer(corpus, asParams(p), learned);
          const bad = EMOTIONS.find((e) => m.recall[e] < minRecall);
          if (bad) return { ok: false, detail: `${split} recall for ${bad} is ${m.recall[bad]}` };
        }
        return { ok: true, detail: "every class above recall floor" };
      },
    },
    {
      name: "reply-quality-floor",
      check: (p) => {
        const q = responseQuality(holdout, asParams(p), learned);
        return { ok: q >= minQuality, detail: `holdout reply quality ${q}` };
      },
    },
  ];

  return {
    name: "empathy-recognizer",
    specs: { ...EMPATHY_PARAM_SPECS },
    trainScore: (p) => evaluateRecognizer(train, asParams(p), learned).macroF1,
    holdoutScore: (p) => evaluateRecognizer(holdout, asParams(p), learned).macroF1,
    guards,
  };
}

export function buildEmpathyController(
  overrides: Partial<Omit<ControllerOptions, "subject" | "genesis">> & { subjectOptions?: EmpathySubjectOptions; genesis?: EmpathyParams } = {},
): SelfImprovementController {
  const { subjectOptions, genesis, ...rest } = overrides;
  return new SelfImprovementController({
    subject: buildEmpathySubject(subjectOptions),
    genesis: { ...(genesis ?? DEFAULT_EMPATHY_PARAMS) } as unknown as ParamVector,
    ...rest,
  });
}
