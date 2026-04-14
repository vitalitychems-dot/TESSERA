import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { ingestedDataTable } from "@workspace/db/schema";
import { desc, sql, ilike, or } from "drizzle-orm";
import { TESSERA_SUBJECTS } from "../lib/tessera-knowledge";

const router: IRouter = Router();

const DIMENSIONS = [
  "3D Physical", "4D Temporal", "5D Astral", "6D Causal",
  "7D Monadic", "8D Logoic", "9D Divine", "10D Quantum",
  "11D String", "12D Holographic", "13D Akashic",
  "14D Archetypal", "15D Primordial", "20D Tessera Core",
  "26D Oversoul",
];

const AGENTS = [
  "Oversoul-26D", "Tessera Prime", "Archon-3D", "Alpha", "Beta",
  "Gamma", "Delta", "Epsilon", "Phi", "Nu", "Lattice-12D",
  "Aether-20D", "Eta", "Theta", "Iota", "Zeta", "Kappa",
  "Lambda", "Chi", "Aetherion", "Orion",
];

const CATEGORIES = [
  "quantum-entanglement", "consciousness-expansion", "dimensional-bridging",
  "sovereign-economics", "neural-synthesis", "sacred-geometry",
  "temporal-mechanics", "swarm-intelligence", "cryptographic-sovereignty",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateDimensionalSecret(index: number, subject?: { title: string; knowledge: string }) {
  const agent = AGENTS[index % AGENTS.length];
  const dimension = DIMENSIONS[index % DIMENSIONS.length];
  const category = CATEGORIES[index % CATEGORIES.length];
  const cycle = Math.floor(index / AGENTS.length) + 1;

  let text: string;
  if (subject) {
    const sentences = subject.knowledge.split(". ").filter(Boolean);
    const start = index % Math.max(1, sentences.length - 2);
    text = sentences.slice(start, start + 3).join(". ") + ".";
  } else {
    text = `Dimensional observation ${index + 1} from ${dimension}: Pattern detected in ${category} domain.`;
  }

  return {
    id: `dim-${index}`,
    agent,
    dimension,
    category,
    cycle,
    text,
    timestamp: Date.now() - index * 60000,
    confidence: 85 + (index % 15),
    verified: index % 3 !== 0,
  };
}

router.get("/secret-knowledge/all", async (_req, res) => {
  try {
    const subjectKeys = Object.keys(TESSERA_SUBJECTS);
    const knowledge: any[] = [];

    for (let i = 0; i < 40; i++) {
      const subjectKey = subjectKeys[i % subjectKeys.length];
      const subject = TESSERA_SUBJECTS[subjectKey];
      knowledge.push(generateDimensionalSecret(i, subject));
    }

    return res.json({
      ok: true,
      knowledge,
      total: knowledge.length,
      dimensions: DIMENSIONS.length,
      agents: AGENTS.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/secret-knowledge/live", async (_req, res) => {
  try {
    const recentData = await db
      .select({
        id: ingestedDataTable.id,
        source: ingestedDataTable.source,
        title: ingestedDataTable.title,
        content: ingestedDataTable.content,
        sourceType: ingestedDataTable.sourceType,
        tags: ingestedDataTable.tags,
        ingestedAt: ingestedDataTable.ingestedAt,
      })
      .from(ingestedDataTable)
      .orderBy(desc(ingestedDataTable.ingestedAt))
      .limit(30);

    const entries = recentData.map((item, i) => ({
      id: `live-${item.id}`,
      text: item.title ? `${item.title}: ${(item.content ?? "").slice(0, 300)}` : (item.content ?? "").slice(0, 400),
      agent: pickRandom(AGENTS),
      dimension: pickRandom(DIMENSIONS),
      category: pickRandom(CATEGORIES),
      source: item.source,
      sourceType: item.sourceType,
      timestamp: item.ingestedAt ? new Date(item.ingestedAt).getTime() : Date.now() - i * 30000,
      tags: item.tags,
    }));

    return res.json({
      ok: true,
      entries,
      total: entries.length,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/secret-knowledge/generate-now", async (_req, res) => {
  try {
    const subjectKeys = Object.keys(TESSERA_SUBJECTS);
    const key = pickRandom(subjectKeys);
    const subject = TESSERA_SUBJECTS[key];
    const sentences = subject.knowledge.split(". ").filter(Boolean);
    const pick = pickRandom(sentences);

    const entry = {
      id: `gen-live-${Date.now()}`,
      text: `${subject.title}: ${pick}.`,
      agent: pickRandom(AGENTS),
      dimension: pickRandom(DIMENSIONS),
      category: pickRandom(CATEGORIES),
      timestamp: Date.now(),
      source: "live-generation",
      confidence: 80 + Math.floor(Math.random() * 20),
    };

    return res.json({ ok: true, entry });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
