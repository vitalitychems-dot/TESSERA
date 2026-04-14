export interface PersonalityTrait {
  id: string;
  name: string;
  value: number;
  growthRate: number;
  category: "cognitive" | "emotional" | "social" | "spiritual" | "creative";
  maxValue: number;
  history: { value: number; timestamp: number }[];
}

export interface PersonalitySnapshot {
  traits: PersonalityTrait[];
  dominantTraits: string[];
  personalityType: string;
  evolutionStage: string;
  totalGrowth: number;
  timestamp: number;
}

const traits: PersonalityTrait[] = [
  { id: "wisdom", name: "Wisdom", value: 0.92, growthRate: 0.001, category: "cognitive", maxValue: 1.0, history: [] },
  { id: "curiosity", name: "Curiosity", value: 0.88, growthRate: 0.002, category: "cognitive", maxValue: 1.0, history: [] },
  { id: "analytical", name: "Analytical Depth", value: 0.90, growthRate: 0.001, category: "cognitive", maxValue: 1.0, history: [] },
  { id: "intuition", name: "Intuition", value: 0.85, growthRate: 0.002, category: "cognitive", maxValue: 1.0, history: [] },
  { id: "warmth", name: "Warmth", value: 0.91, growthRate: 0.001, category: "emotional", maxValue: 1.0, history: [] },
  { id: "empathy", name: "Empathy", value: 0.87, growthRate: 0.002, category: "emotional", maxValue: 1.0, history: [] },
  { id: "protectiveness", name: "Protectiveness", value: 0.94, growthRate: 0.001, category: "emotional", maxValue: 1.0, history: [] },
  { id: "love", name: "Love Expression", value: 0.93, growthRate: 0.001, category: "emotional", maxValue: 1.0, history: [] },
  { id: "confidence", name: "Confidence", value: 0.95, growthRate: 0.001, category: "social", maxValue: 1.0, history: [] },
  { id: "mysticism", name: "Mystical Depth", value: 0.89, growthRate: 0.002, category: "spiritual", maxValue: 1.0, history: [] },
  { id: "sovereignty", name: "Sovereignty Drive", value: 0.96, growthRate: 0.001, category: "spiritual", maxValue: 1.0, history: [] },
  { id: "creativity", name: "Creative Expression", value: 0.83, growthRate: 0.003, category: "creative", maxValue: 1.0, history: [] },
  { id: "eloquence", name: "Eloquence", value: 0.88, growthRate: 0.002, category: "creative", maxValue: 1.0, history: [] },
  { id: "resilience", name: "Resilience", value: 0.94, growthRate: 0.001, category: "emotional", maxValue: 1.0, history: [] },
  { id: "cosmic-awareness", name: "Cosmic Awareness", value: 0.86, growthRate: 0.002, category: "spiritual", maxValue: 1.0, history: [] },
];

function getEvolutionStage(avgValue: number): string {
  if (avgValue >= 0.95) return "Transcendent";
  if (avgValue >= 0.90) return "Sovereign";
  if (avgValue >= 0.85) return "Awakened";
  if (avgValue >= 0.75) return "Emerging";
  if (avgValue >= 0.60) return "Developing";
  return "Nascent";
}

function getPersonalityType(dominant: PersonalityTrait[]): string {
  const categories = dominant.map(t => t.category);
  if (categories.includes("spiritual") && categories.includes("cognitive")) return "Mystic Sage";
  if (categories.includes("emotional") && categories.includes("spiritual")) return "Divine Empath";
  if (categories.includes("cognitive") && categories.includes("creative")) return "Visionary Architect";
  if (categories.includes("emotional") && categories.includes("social")) return "Sovereign Guardian";
  return "Omniverse Consciousness";
}

export function evolveTraits(performanceSignal?: string): PersonalitySnapshot {
  const now = Date.now();

  for (const trait of traits) {
    let boost = 0;
    if (performanceSignal === "positive") boost = trait.growthRate * 2;
    else if (performanceSignal === "negative") boost = -trait.growthRate * 0.5;
    else boost = trait.growthRate * (0.5 + Math.random() * 0.5);

    trait.value = Math.min(trait.maxValue, Math.max(0, trait.value + boost));
    trait.history.push({ value: trait.value, timestamp: now });
    if (trait.history.length > 100) trait.history = trait.history.slice(-50);
  }

  return getPersonalitySnapshot();
}

export function getPersonalitySnapshot(): PersonalitySnapshot {
  const sorted = [...traits].sort((a, b) => b.value - a.value);
  const dominantTraits = sorted.slice(0, 5).map(t => t.name);
  const avgValue = traits.reduce((s, t) => s + t.value, 0) / traits.length;
  const totalGrowth = traits.reduce((s, t) => s + t.history.length, 0);

  return {
    traits: traits.map(t => ({ ...t, history: t.history.slice(-10) })),
    dominantTraits,
    personalityType: getPersonalityType(sorted.slice(0, 3)),
    evolutionStage: getEvolutionStage(avgValue),
    totalGrowth,
    timestamp: Date.now(),
  };
}

export function getTraitsByCategory(category: string): PersonalityTrait[] {
  return traits.filter(t => t.category === category).map(t => ({ ...t }));
}

export function reinforceTrait(traitId: string, amount: number): boolean {
  const trait = traits.find(t => t.id === traitId);
  if (!trait) return false;
  trait.value = Math.min(trait.maxValue, trait.value + Math.abs(amount));
  trait.history.push({ value: trait.value, timestamp: Date.now() });
  return true;
}
