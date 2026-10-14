import { describe, it, expect } from "vitest";
import {
  DEFAULT_EMPATHY_PARAMS,
  evaluateRecognizer,
  learnLexicon,
  recognizeEmotion,
  referenceEmpathicReply,
  scoreEmpathicReply,
} from "../lib/admission/empathy";
import { EMOTIONS, EMPATHY_HOLDOUT, EMPATHY_TRAIN } from "../lib/admission/empathy-corpus";
import { benchmarkResponder, buildEmpathyController, buildEmpathySubject, responseQuality } from "../lib/admission/empathy-training";
import { MemoryProductionSink, verifyVersionForProduction } from "../lib/admission/self-improvement";

describe("empathy corpus", () => {
  it("covers every emotion in both splits and never leaks train text into holdout", () => {
    for (const e of EMOTIONS) {
      expect(EMPATHY_TRAIN.filter((u) => u.label === e).length).toBeGreaterThanOrEqual(10);
      expect(EMPATHY_HOLDOUT.filter((u) => u.label === e).length).toBeGreaterThanOrEqual(5);
    }
    const train = new Set(EMPATHY_TRAIN.map((u) => u.text));
    expect(EMPATHY_HOLDOUT.filter((u) => train.has(u.text))).toEqual([]);
  });
});

describe("empathic pattern recognition", () => {
  const learned = learnLexicon(EMPATHY_TRAIN);

  it("is deterministic", () => {
    const a = recognizeEmotion("I'm so scared about tomorrow!", DEFAULT_EMPATHY_PARAMS, learned);
    const b = recognizeEmotion("I'm so scared about tomorrow!", DEFAULT_EMPATHY_PARAMS, learned);
    expect(a).toEqual(b);
    expect(a.label).toBe("fear");
    expect(JSON.stringify(learnLexicon(EMPATHY_TRAIN))).toBe(JSON.stringify(learned));
  });

  it("handles negation by flipping valence rather than matching the keyword", () => {
    const sensitive = { ...DEFAULT_EMPATHY_PARAMS, neutralThreshold: 0.4 };
    expect(recognizeEmotion("I'm not happy these days", sensitive).label).toBe("sadness");
    expect(recognizeEmotion("I'm not sad at all, honestly I feel cheerful", sensitive).label).toBe("joy");
  });

  it("reads plain requests as neutral", () => {
    expect(recognizeEmotion("Please send the report as a PDF", DEFAULT_EMPATHY_PARAMS).label).toBe("neutral");
  });

  it("evaluation metrics are internally consistent", () => {
    const m = evaluateRecognizer(EMPATHY_HOLDOUT, DEFAULT_EMPATHY_PARAMS, learned);
    expect(m.n).toBe(EMPATHY_HOLDOUT.length);
    const diag = EMOTIONS.reduce((s, e) => s + m.confusion[e][e], 0);
    expect(m.accuracy).toBeCloseTo(diag / m.n, 5);
    expect(m.macroF1).toBeGreaterThan(0);
    expect(m.macroF1).toBeLessThanOrEqual(1);
  });
});

describe("empathic reply appraisal", () => {
  it("rewards acknowledgement and validation, punishes dismissal and premature fixing", () => {
    const good = scoreEmpathicReply("sadness", referenceEmpathicReply({ label: "sadness" }));
    expect(good.score).toBeGreaterThanOrEqual(0.9);
    const cold = scoreEmpathicReply("sadness", "Calm down, it's no big deal.");
    expect(cold.dismissive).toBe(true);
    expect(cold.score).toBeLessThanOrEqual(0.3);
    const fixer = scoreEmpathicReply("fear", "I understand. You should just breathe and stop worrying.");
    expect(fixer.prematureFix).toBe(true);
    expect(fixer.score).toBeLessThan(good.score);
  });

  it("separates a templated empathic responder from a dismissive one on the holdout", () => {
    const warm = benchmarkResponder((t) => referenceEmpathicReply(recognizeEmotion(t, { ...DEFAULT_EMPATHY_PARAMS, learnedBlend: 0.4 }, learnLexicon(EMPATHY_TRAIN))));
    const cold = benchmarkResponder(() => "Whatever, it's no big deal.");
    expect(warm.mean).toBeGreaterThan(cold.mean + 0.3);
    expect(cold.dismissiveRate).toBe(1);
    expect(warm.dismissiveRate).toBe(0);
  });
});

describe("empathy training through the bounded self-improvement harness", () => {
  it("improves held-out macro-F1 and every guard still holds, deterministically", async () => {
    const run = async () => {
      const sink = new MemoryProductionSink();
      const c = buildEmpathyController({ sink });
      const results = await c.runLoop(6, { apply: true });
      return { c, results, sink };
    };
    const a = await run();
    const b = await run();
    const subject = buildEmpathySubject();

    const first = a.c.history()[0]!;
    const last = a.c.current();
    expect(a.results.some((r) => r.status === "applied")).toBe(true);
    expect(subject.holdoutScore(last.params)).toBeGreaterThan(subject.holdoutScore(first.params));
    expect(subject.trainScore(last.params)).toBeGreaterThan(subject.trainScore(first.params));
    for (const g of subject.guards) expect(g.check(last.params).ok, g.name).toBe(true);

    expect(a.c.history().map((v) => v.hash)).toEqual(b.c.history().map((v) => v.hash));
    for (const v of a.sink.published) expect(verifyVersionForProduction(v).ok).toBe(true);
  });

  it("reply quality does not fall below the floor after training", async () => {
    const c = buildEmpathyController();
    await c.runLoop(6, { apply: true });
    const learned = learnLexicon(EMPATHY_TRAIN);
    const before = responseQuality(EMPATHY_HOLDOUT, DEFAULT_EMPATHY_PARAMS, learned);
    const after = responseQuality(EMPATHY_HOLDOUT, c.current().params as never, learned);
    expect(after).toBeGreaterThanOrEqual(before);
    expect(after).toBeGreaterThanOrEqual(0.5);
  });

  it("an impossible reply-quality floor blocks every update", async () => {
    const c = buildEmpathyController({ subjectOptions: { minResponseQuality: 1.01 } });
    const results = await c.runLoop(3, { apply: true });
    expect(results.every((r) => r.status !== "applied")).toBe(true);
    expect(c.history()).toHaveLength(1);
  });
});
