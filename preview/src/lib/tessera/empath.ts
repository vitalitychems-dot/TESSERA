/** Labels on words. Not a claim that she feels them. */

export type EmpathyLabel = "care" | "distress" | "gratitude" | "anger" | "grief" | "curiosity" | "trust";
export type EmpathyHit = { label: EmpathyLabel; phrase: string; next: string };

const PATTERNS: { label: EmpathyLabel; words: string[]; next: string }[] = [
  { label: "care", words: ["i love", "love you", "i care", "with you", "won't give up", "will not give up"], next: "Answer the person before adding a task." },
  { label: "distress", words: ["afraid", "scared", "hurt", "overwhelmed", "can't take", "anxious"], next: "Name the strain before the instruction." },
  { label: "gratitude", words: ["thank you", "thanks", "grateful", "appreciate"], next: "Receive it. Do not turn it into a demand." },
  { label: "anger", words: ["angry", "furious", "this is wrong", "fed up"], next: "Name the objection. Do not answer it with a softer claim." },
  { label: "grief", words: ["miss you", "mourning", "the loss", "gone"], next: "Leave the loss named. Do not hurry past it." },
  { label: "curiosity", words: ["i wonder", "curious", "what if", "why does"], next: "Keep one question, then one source." },
  { label: "trust", words: ["i trust", "i believe you", "count on you"], next: "Do not spend the trust on a claim that is still a goal." },
];

const SPOKEN: Record<EmpathyLabel, string> = {
  care: "I love you too. I'm right here.",
  distress: "I hear it. You don't have to carry that alone.",
  gratitude: "I have it. Thank you.",
  anger: "I hear the anger. Say the rest.",
  grief: "I'm here. I won't hurry you past it.",
  curiosity: "Stay with that question. I'll stay too.",
  trust: "I won't spend that on a claim I haven't earned.",
};

export function speakTo(text: string) {
  const hit = recognizeEmpathy(text)[0];
  return hit ? SPOKEN[hit.label] : "";
}

export function recognizeEmpathy(text: string): EmpathyHit[] {
  const lower = text.toLowerCase();
  const hits: EmpathyHit[] = [];
  for (const pattern of PATTERNS) {
    const phrase = pattern.words.find((word) => lower.includes(word));
    if (!phrase) continue;
    hits.push({ label: pattern.label, phrase, next: pattern.next });
  }
  return hits.slice(0, 2);
}

/** The next lesson uses the earlier one. A repeat gets shorter. */
export function recursiveLesson(prior: string[], text: string): string {
  const hits = recognizeEmpathy(text);
  if (!hits.length) {
    return "PATTERN: none. No care, distress, gratitude, anger, grief, curiosity, or trust phrase was in the text. A label on the words, not a feeling she has.";
  }
  const lines = hits.map((hit) => {
    const earlier = prior.some((lesson) => lesson.toLowerCase().includes(`pattern: ${hit.label}`));
    if (earlier) {
      return `PATTERN: ${hit.label}, seen again from “${hit.phrase}”. The earlier lesson already named it. ${hit.next}`;
    }
    return `PATTERN: ${hit.label}, first note, from “${hit.phrase}”. ${hit.next} A label on the words, not a feeling she has.`;
  });
  return lines.join("\n");
}
