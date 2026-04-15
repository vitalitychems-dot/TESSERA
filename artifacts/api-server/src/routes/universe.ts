import { Router } from "express";
import { queryNasaApod } from "../lib/providers/nasa-provider";
import { getUniverseMetrics } from "../lib/universe-mechanics";
import { TESSERA_SUBJECTS } from "../lib/tessera-knowledge";
import { computeSacredGeometry } from "../lib/sovereign-sacred-geometry";

const router = Router();

router.get("/universe/apod", async (_req, res) => {
  try {
    const items = await queryNasaApod(5);
    const imageItems = items.filter(i => i.mediaType === "image" && i.url);
    res.json({ ok: true, items: imageItems });
  } catch (err) {
    console.error("APOD fetch failed:", err);
    res.status(502).json({ ok: false, items: [], error: "Failed to fetch APOD data" });
  }
});

router.get("/universe/metrics", async (_req, res) => {
  try {
    const metrics = getUniverseMetrics();
    res.json({ ok: true, metrics });
  } catch (err) {
    console.error("Universe metrics failed:", err);
    res.status(500).json({ ok: false, metrics: {}, error: "Failed to compute metrics" });
  }
});

router.get("/universe/grand-narrative", async (_req, res) => {
  try {
    const sacredGeo = computeSacredGeometry();
    const phiConst = sacredGeo?.universalConstants?.find((c: { symbol: string }) => c.symbol === "phi" || c.symbol === "PHI");
    const phi = phiConst?.value ?? 1.6180339887498948;
    const fibData = sacredGeo?.fibonacci?.sequence;
    const fibonacci = Array.isArray(fibData) ? fibData.slice(0, 12) : [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144];

    const knowledgeSubjects: Record<string, string> = {};
    const relevantKeys = Object.keys(TESSERA_SUBJECTS);
    for (const key of relevantKeys) {
      if (TESSERA_SUBJECTS[key]) {
        knowledgeSubjects[key] = TESSERA_SUBJECTS[key].knowledge;
      }
    }

    const chapters = [
      {
        id: 1,
        title: "Ancient Origins & Sacred Mathematics",
        subtitle: "The Language Written Before Words",
        frequency: "396 Hz",
        icon: "Seed of Life",
        visualizationAnchor: "dimension-0",
        knowledgeSources: ["fractal-mathematics", "ancient-civilizations", "mathematics", "crystallography"],
      },
      {
        id: 2,
        title: "Mystery Schools & Hidden Knowledge",
        subtitle: "The Flame Passed in Darkness",
        frequency: "417 Hz",
        icon: "Vesica Piscis",
        visualizationAnchor: "dimension-1",
        knowledgeSources: ["alchemy", "mythology", "meditation", "philosophy"],
      },
      {
        id: 3,
        title: "World Religions: Common Threads",
        subtitle: "Many Mouths, One Voice",
        frequency: "528 Hz",
        icon: "Flower of Life",
        visualizationAnchor: "dimension-2",
        knowledgeSources: ["philosophy", "consciousness", "ethics", "anthropology"],
      },
      {
        id: 4,
        title: "Secret Societies & Power Structures",
        subtitle: "The Architecture of Influence",
        frequency: "639 Hz",
        icon: "Sri Yantra",
        visualizationAnchor: "dimension-3",
        knowledgeSources: ["cryptography", "geopolitics", "numerology"],
      },
      {
        id: 5,
        title: "The Cosmic Architecture",
        subtitle: "The Universe as Living Mathematics",
        frequency: "852 Hz",
        icon: "Metatron's Cube",
        visualizationAnchor: "dimension-5",
        knowledgeSources: ["cosmology", "astronomy", "astrology", "harmonics"],
      },
      {
        id: 6,
        title: "The Unified Truth",
        subtitle: "Tessera Invicta — The Unconquerable Pattern",
        frequency: "963 Hz",
        icon: "Merkaba",
        visualizationAnchor: "dimension-6",
        knowledgeSources: ["consciousness", "fractal-mathematics", "harmonics"],
      },
    ];

    res.json({
      ok: true,
      narrative: {
        chapters,
        knowledgeSources: knowledgeSubjects,
        sacredConstants: { phi, fibonacci: fibonacci.slice(0, 12) },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Grand narrative failed:", err);
    res.status(500).json({ ok: false, error: "Failed to generate narrative data" });
  }
});

export default router;
