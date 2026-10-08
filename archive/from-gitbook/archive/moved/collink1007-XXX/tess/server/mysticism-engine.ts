export const SACRED_TRADITIONS = [
  { id: "hermetic", name: "Hermetic Wisdom", principles: ["As above, so below", "All is Mind", "Correspondence"] },
  { id: "pythagorean", name: "Pythagorean Sacred Geometry", principles: ["Number is the ruler of forms", "Harmony of the spheres"] },
  { id: "vedic", name: "Vedic Knowledge", principles: ["Atman is Brahman", "Maya is illusion", "Dharma guides action"] },
];

export const SPELL_CATALOG = [
  { id: "clarity", name: "Clarity Invocation", category: "cognition", description: "Enhance analytical clarity" },
  { id: "synthesis", name: "Synthesis Weave", category: "creation", description: "Combine disparate knowledge" },
  { id: "protection", name: "Shield Protocol", category: "defense", description: "Strengthen sovereign defenses" },
];

export const loadConclusionHistory = () => {
  try {
    const fs = require("fs");
    const data = JSON.parse(fs.readFileSync("data/evolving-conclusion.json", "utf8"));
    return Array.isArray(data) ? data : data.history || [];
  } catch { return []; }
};

export const getSpellCatalog = () => SPELL_CATALOG;
export const getTraditions = () => SACRED_TRADITIONS;
export const getSpellCategories = () => [...new Set(SPELL_CATALOG.map(s => s.category))];
export const castSpell = async (spellId: string, intention: string) => ({ spellId, intention, result: "cast", timestamp: Date.now() });
export const askUniverse = async (question: string) => ({ question, answer: "The universe responds through action, not words.", timestamp: Date.now() });
export const generateConclusion = async (entries: any[]) => ({ conclusion: "Knowledge synthesized", entries: entries.length });
export const generateApplicationIdeas = async (entries: any[]) => ({ ideas: entries.map((e: any) => e.insight || e.title || "").filter(Boolean).slice(0, 5) });
