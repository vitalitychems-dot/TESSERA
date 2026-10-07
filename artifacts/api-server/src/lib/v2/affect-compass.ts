// Affect Compass — local, lexicon-based reading of emotional signals in user
// text, with concrete tone guidance for replies. Honest scope: Tessera does
// not feel emotions; she detects emotional signals in text and responds with
// care. Deterministic, no network, no model inference.

export interface AffectReading {
  valence: number;                       // -1..1 (0 = neutral/unknown)
  arousal: number;                       // 0..1
  intensity: number;                     // 0..1
  emotions: { name: string; score: number }[];
  toneGuidance: string[];
  limitation: string;
}

const LIMITATION =
  "Text-signal detection only — not felt emotion, not a psychological assessment.";

interface EmotionLexicon { name: string; words: string[]; valence: number; arousal: number }

const LEXICON: EmotionLexicon[] = [
  { name: "frustration", valence: -0.8, arousal: 0.8,
    words: ["broken", "wrong", "useless", "angry", "furious", "annoying", "frustrated", "ridiculous", "not working", "failed again"] },
  { name: "sadness", valence: -0.7, arousal: 0.25,
    words: ["sad", "depressed", "lonely", "grief", "crying", "hopeless", "empty", "tired of"] },
  { name: "fear", valence: -0.6, arousal: 0.75,
    words: ["scared", "afraid", "worried", "anxious", "panic", "terrified", "nervous", "unsafe", "leaked", "hacked"] },
  { name: "joy", valence: 0.8, arousal: 0.6,
    words: ["love", "amazing", "great", "perfect", "thank", "awesome", "excited", "happy", "beautiful", "brilliant"] },
  { name: "trust", valence: 0.6, arousal: 0.3,
    words: ["trust", "believe", "count on", "rely on"] },
  { name: "urgency", valence: -0.2, arousal: 0.9,
    words: ["urgent", "asap", "immediately", "right now", "hurry", "emergency", "deadline"] },
];

const INTENSIFIERS = ["very", "extremely", "really", "absolutely", "totally", "so much"];

const GUIDANCE: Record<string, string[]> = {
  frustration: [
    "Acknowledge the frustration in the first sentence.",
    "Keep sentences short; no defensiveness.",
    "Lead with the concrete fix or next action.",
  ],
  sadness: [
    "Slow down; acknowledge the feeling before any task content.",
    "Avoid cheerfulness; offer one gentle, concrete next step.",
  ],
  fear: [
    "Reassure only with verified facts; state plainly what is and is not confirmed.",
    "Give the safest next action first.",
  ],
  joy: ["Match the energy briefly, then build on the momentum."],
  trust: ["Honor the trust with transparency about limits and evidence."],
  urgency: ["Answer the critical part first; skip preamble."],
};

const NEUTRAL_GUIDANCE = ["Neutral, warm, professional tone."];

export function readAffect(text: string): AffectReading {
  const lower = ` ${text.toLowerCase()} `;
  const hits = new Map<string, number>();
  for (const emotion of LEXICON) {
    const count = emotion.words.reduce(
      (n, word) => n + (lower.includes(` ${word}`) || lower.includes(`${word} `) ? 1 : 0), 0,
    );
    if (count > 0) hits.set(emotion.name, count);
  }

  const exclamations = (text.match(/!/g) ?? []).length;
  const capsWords = (text.match(/\b[A-Z]{3,}\b/g) ?? []).length;
  const intensifiers = INTENSIFIERS.filter((w) => lower.includes(w)).length;
  const hitTotal = [...hits.values()].reduce((a, b) => a + b, 0);
  const intensity = Math.min(1, hitTotal * 0.25 + exclamations * 0.08 + capsWords * 0.06 + intensifiers * 0.12);

  let valence = 0, arousal = 0.2, weight = 0;
  for (const emotion of LEXICON) {
    const count = hits.get(emotion.name) ?? 0;
    if (count === 0) continue;
    valence += emotion.valence * count;
    arousal += emotion.arousal * count;
    weight += count;
  }
  if (weight > 0) { valence /= weight; arousal = arousal / (weight + 1) + 0.15; }

  const emotions = [...hits.entries()]
    .map(([name, count]) => ({ name, score: Math.round((count / Math.max(hitTotal, 1)) * 100) / 100 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const top = emotions[0]?.name;
  const toneGuidance = intensity >= 0.25 && top ? (GUIDANCE[top] ?? NEUTRAL_GUIDANCE) : NEUTRAL_GUIDANCE;

  return {
    valence: Math.round(valence * 100) / 100,
    arousal: Math.round(Math.min(1, arousal) * 100) / 100,
    intensity: Math.round(intensity * 100) / 100,
    emotions,
    toneGuidance,
    limitation: LIMITATION,
  };
}
