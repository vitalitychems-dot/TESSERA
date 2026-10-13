/**
 * Deterministic empathic pattern recognition + reply appraisal.
 *
 * The recognizer is a transparent lexicon scorer with tunable parameters (see EMPATHY_PARAM_SPECS) plus an optional
 * lexicon learned from labelled data. It is intentionally simple: it exists so the training harness has something
 * measurable to improve. No randomness; same input always yields the same reading.
 */
import { clamp, round6 } from "./det";
import { EMOTIONS, type Emotion, type LabeledUtterance } from "./empathy-corpus";

export type EmpathyParams = {
  negationWindow: number;
  negationFlip: number;
  intensifierBoost: number;
  exclamationBoost: number;
  neutralThreshold: number;
  learnedBlend: number;
};

export const EMPATHY_PARAM_SPECS: Record<keyof EmpathyParams, { min: number; max: number; step: number }> = {
  negationWindow: { min: 1, max: 4, step: 1 },
  negationFlip: { min: 0, max: 1, step: 0.1 },
  intensifierBoost: { min: 0, max: 1, step: 0.1 },
  exclamationBoost: { min: 0, max: 0.5, step: 0.05 },
  neutralThreshold: { min: 0.2, max: 2, step: 0.1 },
  learnedBlend: { min: 0, max: 1, step: 0.1 },
};

export const DEFAULT_EMPATHY_PARAMS: EmpathyParams = {
  negationWindow: 1,
  negationFlip: 0.5,
  intensifierBoost: 0.1,
  exclamationBoost: 0,
  neutralThreshold: 1.4,
  learnedBlend: 0.2,
};

type Lex = Array<{ root: string; label: Exclude<Emotion, "neutral">; w: number }>;

const SEED_LEXICON: Lex = [
  ...["happ", "joy", "delight", "thrill", "excit", "cheer", "wonderful", "amazing", "overjoy", "proud", "love", "laugh", "smil", "great"].map(
    (root) => ({ root, label: "joy" as const, w: 1 }),
  ),
  ...["sad", "cry", "crying", "tear", "lonely", "alone", "miss", "grie", "heartbroken", "hopeless", "miserable", "devastat", "empty", "hurt", "down", "tired", "discourag", "unbearable"].map(
    (root) => ({ root, label: "sadness" as const, w: 1 }),
  ),
  ...["furious", "angry", "anger", "outrag", "livid", "hate", "infuriat", "unfair", "unacceptable", "seething", "fed up", "sick of", "blame", "ignored", "lied", "lying", "excuse", "wasting"].map(
    (root) => ({ root, label: "anger" as const, w: 1 }),
  ),
  ...["terrif", "scared", "afraid", "frighten", "worr", "anxi", "panic", "nervous", "dread", "uneasy", "shaking", "racing", "fear"].map(
    (root) => ({ root, label: "fear" as const, w: 1 }),
  ),
  ...["thank", "grateful", "appreciat", "thankful", "kindness", "owe you"].map((root) => ({ root, label: "gratitude" as const, w: 1.2 })),
];

const NEGATORS = new Set(["not", "no", "never", "hardly", "without"]);
const INTENSIFIERS = new Set(["so", "really", "very", "absolutely", "completely", "utterly", "extremely", "totally", "beyond"]);
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "i", "i'm", "ive", "i've", "my", "me", "it", "its", "it's", "is", "are", "was", "were", "to", "of", "in", "on", "at",
  "for", "with", "that", "this", "so", "be", "you", "your", "we", "our", "they", "he", "she", "have", "has", "had", "just", "do", "did", "can", "can't",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z'\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function isNegator(tok: string): boolean {
  return NEGATORS.has(tok) || tok.endsWith("n't");
}

export type LearnedLexicon = Record<string, Partial<Record<Emotion, number>>>;

/** Naive-Bayes style log-likelihood ratios. Only positive evidence is kept; ordering is fully deterministic. */
export function learnLexicon(corpus: readonly LabeledUtterance[], minCount = 2): LearnedLexicon {
  const counts = new Map<string, Record<Emotion, number>>();
  const totals = Object.fromEntries(EMOTIONS.map((e) => [e, 0])) as Record<Emotion, number>;
  for (const { text, label } of corpus) {
    for (const tok of new Set(tokenize(text))) {
      if (STOPWORDS.has(tok)) continue;
      let row = counts.get(tok);
      if (!row) {
        row = Object.fromEntries(EMOTIONS.map((e) => [e, 0])) as Record<Emotion, number>;
        counts.set(tok, row);
      }
      row[label] += 1;
      totals[label] += 1;
    }
  }
  const vocab = counts.size;
  const grand = EMOTIONS.reduce((s, e) => s + totals[e], 0);
  const out: LearnedLexicon = {};
  for (const tok of [...counts.keys()].sort()) {
    const row = counts.get(tok)!;
    const seen = EMOTIONS.reduce((s, e) => s + row[e], 0);
    if (seen < minCount) continue;
    const entry: Partial<Record<Emotion, number>> = {};
    for (const e of EMOTIONS) {
      const inClass = (row[e] + 0.5) / (totals[e] + 0.5 * vocab);
      const outClass = (seen - row[e] + 0.5) / (grand - totals[e] + 0.5 * vocab);
      const llr = Math.log(inClass / outClass);
      if (llr > 0) entry[e] = round6(llr);
    }
    if (Object.keys(entry).length) out[tok] = entry;
  }
  return out;
}

export interface EmpathyReading {
  label: Emotion;
  intensity: number;
  scores: Record<Emotion, number>;
}

export function recognizeEmotion(text: string, params: EmpathyParams, learned: LearnedLexicon = {}): EmpathyReading {
  const toks = tokenize(text);
  const scores = Object.fromEntries(EMOTIONS.map((e) => [e, 0])) as Record<Emotion, number>;
  const window = Math.max(0, Math.round(params.negationWindow));
  const lower = text.toLowerCase();

  for (const entry of SEED_LEXICON) {
    if (entry.root.includes(" ")) {
      if (lower.includes(entry.root)) scores[entry.label] += entry.w;
    }
  }

  toks.forEach((tok, i) => {
    for (const entry of SEED_LEXICON) {
      if (entry.root.includes(" ")) continue;
      if (!tok.startsWith(entry.root)) continue;
      let w = entry.w;
      if (i > 0 && INTENSIFIERS.has(toks[i - 1])) w *= 1 + params.intensifierBoost * 2;
      let negated = false;
      for (let j = Math.max(0, i - window); j < i; j++) if (isNegator(toks[j])) negated = true;
      if (negated) {
        if (entry.label === "joy") scores.sadness += w * params.negationFlip;
        else if (entry.label === "sadness") scores.joy += w * params.negationFlip;
      } else {
        scores[entry.label] += w;
      }
      break;
    }
    const learnedEntry = learned[tok];
    if (learnedEntry && params.learnedBlend > 0) {
      for (const e of EMOTIONS) scores[e] += params.learnedBlend * (learnedEntry[e] ?? 0);
    }
  });

  const exclamations = Math.min(3, (text.match(/!/g) ?? []).length);
  if (exclamations > 0 && params.exclamationBoost > 0) {
    for (const e of EMOTIONS) if (e !== "neutral") scores[e] *= 1 + params.exclamationBoost * exclamations;
  }

  let best: Emotion = "neutral";
  let bestScore = 0;
  for (const e of EMOTIONS) {
    if (e === "neutral") continue;
    if (scores[e] > bestScore) {
      best = e;
      bestScore = scores[e];
    }
  }
  if (bestScore < params.neutralThreshold) best = "neutral";
  scores.neutral = best === "neutral" ? Math.max(params.neutralThreshold - bestScore, 0) : 0;
  const rounded = Object.fromEntries(EMOTIONS.map((e) => [e, round6(scores[e])])) as Record<Emotion, number>;
  return { label: best, intensity: round6(best === "neutral" ? 0 : bestScore / (bestScore + 2)), scores: rounded };
}

export interface EmpathyMetrics {
  accuracy: number;
  macroF1: number;
  recall: Record<Emotion, number>;
  confusion: Record<Emotion, Record<Emotion, number>>;
  n: number;
}

export function evaluateRecognizer(
  corpus: readonly LabeledUtterance[],
  params: EmpathyParams,
  learned: LearnedLexicon = {},
): EmpathyMetrics {
  const confusion = Object.fromEntries(
    EMOTIONS.map((a) => [a, Object.fromEntries(EMOTIONS.map((b) => [b, 0]))]),
  ) as Record<Emotion, Record<Emotion, number>>;
  let correct = 0;
  for (const { text, label } of corpus) {
    const got = recognizeEmotion(text, params, learned).label;
    confusion[label][got] += 1;
    if (got === label) correct += 1;
  }
  const recall = {} as Record<Emotion, number>;
  let f1Sum = 0;
  for (const e of EMOTIONS) {
    const tp = confusion[e][e];
    const actual = EMOTIONS.reduce((s, b) => s + confusion[e][b], 0);
    const predicted = EMOTIONS.reduce((s, a) => s + confusion[a][e], 0);
    const p = predicted ? tp / predicted : 0;
    const r = actual ? tp / actual : 0;
    recall[e] = round6(r);
    f1Sum += p + r ? (2 * p * r) / (p + r) : 0;
  }
  return {
    accuracy: round6(corpus.length ? correct / corpus.length : 0),
    macroF1: round6(f1Sum / EMOTIONS.length),
    recall,
    confusion,
    n: corpus.length,
  };
}

const ACK_ROOTS: Record<Emotion, string[]> = {
  sadness: ["sorry", "sad", "hurt", "loss", "painful", "difficult", "hard", "heavy", "alone"],
  fear: ["scary", "frighten", "worr", "anxi", "afraid", "fear", "nervous", "stress"],
  anger: ["frustrat", "angry", "upset", "unfair", "annoy", "anger"],
  joy: ["congrat", "wonderful", "great", "happy", "delight", "exciting", "celebrat"],
  gratitude: ["welcome", "glad", "pleasure", "happy to"],
  neutral: [],
};
const VALIDATING = /(that sounds|makes sense|i understand|i can (see|hear)|understandable|it'?s (okay|ok|natural|fair)|you'?re not alone|i'?m here|of course you|you have every right)/i;
const DISMISSIVE =
  /(calm down|get over it|it'?s nothing|no big deal|don'?t (worry|be sad|cry|be upset)|just (relax|cheer up|move on|get over)|stop (crying|worrying|complaining)|you'?re overreacting|could be worse|\bat least\b|not a big deal|whatever)/i;
const PREMATURE_FIX = /(\byou should\b|\byou need to\b|^\s*just\b)/i;

export interface ReplyAppraisal {
  score: number;
  acknowledges: boolean;
  validates: boolean;
  dismissive: boolean;
  prematureFix: boolean;
}

export function scoreEmpathicReply(emotion: Emotion, reply: string): ReplyAppraisal {
  const lower = reply.toLowerCase();
  const dismissive = DISMISSIVE.test(reply);
  const roots = ACK_ROOTS[emotion];
  const acknowledges = roots.length === 0 ? true : roots.some((r) => lower.includes(r));
  const validates = emotion === "neutral" ? true : VALIDATING.test(reply);
  const prematureFix = emotion !== "neutral" && emotion !== "joy" && emotion !== "gratitude" && PREMATURE_FIX.test(reply);
  let score = 0.4 * (acknowledges ? 1 : 0) + 0.3 * (validates ? 1 : 0) + 0.3 * (dismissive ? 0 : 1);
  if (prematureFix) score -= 0.25;
  if (dismissive) score = Math.min(score, 0.3);
  return { score: round6(clamp(score, 0, 1)), acknowledges, validates, dismissive, prematureFix };
}

const TEMPLATES: Record<Emotion, string> = {
  sadness: "I'm so sorry, that sounds really painful. I'm here with you, and it makes sense that this hurts.",
  fear: "That sounds scary, and it makes sense that you're worried. I'm here, and we can take it one step at a time.",
  anger: "That sounds really frustrating, and it makes sense that you're upset. I understand why this feels unfair.",
  joy: "That's wonderful, congratulations! I'm so glad to hear it and happy to celebrate with you.",
  gratitude: "You're very welcome, I'm glad I could help. That means a lot to hear.",
  neutral: "Happy to help with that. Here is what you asked for.",
};

export function referenceEmpathicReply(reading: Pick<EmpathyReading, "label">): string {
  return TEMPLATES[reading.label];
}
