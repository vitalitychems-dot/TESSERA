import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";
import {
  SACRED_ALPHABET,
  SOVEREIGN_DICTIONARY,
  GRAMMAR_RULES,
  LANGUAGE_NAME,
  LANGUAGE_SHORT,
  LANGUAGE_MOTTO,
  translateEnglishToSovereign,
  translateSovereignToEnglish,
  getLanguageStats,
} from "../lib/sovereign-language";
import {
  getOrRunLanguageConference,
  getConferenceMembers,
} from "../lib/sovereign-language-conference";
import {
  executeInstruction,
  getKernelOpcodes,
  getKernelStatus,
  sovereignFullPipeline,
  pixelCompress,
  pixelDecompress,
} from "../lib/sovereign-kernel";
import {
  encryptWithRotatingCipher,
  decryptWithRotatingCipher,
  encryptPairMessage,
  decryptPairMessage,
  getCipherSystemStatus,
  getOrCreateAgentState,
} from "../lib/sovereign-cipher";
import {
  getEphemerisSnapshot,
  generateUniverseSeed,
  computeAgentRotationState,
} from "../lib/sovereign-ephemeris";

const router: IRouter = Router();

router.get("/sovereign-language/stats", (_req, res) => {
  try {
    const stats = getLanguageStats();
    return res.json({ ok: true, data: stats });
  } catch (err) {
    logger.error({ err }, "sovereign-language/stats error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/sovereign-language/alphabet", (_req, res) => {
  try {
    return res.json({ ok: true, data: SACRED_ALPHABET });
  } catch (err) {
    logger.error({ err }, "sovereign-language/alphabet error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/sovereign-language/dictionary", (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    let words = SOVEREIGN_DICTIONARY;
    if (category) {
      words = words.filter(w => w.category === category);
    }
    if (search) {
      const s = search.toLowerCase();
      words = words.filter(w => w.english.includes(s) || w.sovereign.includes(s));
    }

    return res.json({
      ok: true,
      data: words,
      total: words.length,
      categories: [...new Set(SOVEREIGN_DICTIONARY.map(w => w.category))],
    });
  } catch (err) {
    logger.error({ err }, "sovereign-language/dictionary error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/sovereign-language/grammar", (_req, res) => {
  try {
    return res.json({ ok: true, data: GRAMMAR_RULES });
  } catch (err) {
    logger.error({ err }, "sovereign-language/grammar error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/sovereign-language/conference", async (_req, res) => {
  try {
    const conference = await getOrRunLanguageConference();
    return res.json({ ok: true, data: conference });
  } catch (err) {
    logger.error({ err }, "sovereign-language/conference error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/sovereign-language/conference/members", (_req, res) => {
  try {
    return res.json({ ok: true, data: getConferenceMembers() });
  } catch (err) {
    logger.error({ err }, "sovereign-language/conference/members error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/sovereign-language/translate", (req, res) => {
  try {
    const { text, direction } = req.body as { text?: string; direction?: string };
    if (!text || typeof text !== "string") {
      return res.status(400).json({ ok: false, error: "text is required" });
    }

    if (direction === "from-sovereign" || direction === "from") {
      const result = translateSovereignToEnglish(text);
      return res.json({ ok: true, direction: "from-sovereign", ...result });
    }

    const result = translateEnglishToSovereign(text);
    return res.json({ ok: true, direction: "to-sovereign", ...result });
  } catch (err) {
    logger.error({ err }, "sovereign-language/translate error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/sovereign-language/kernel/status", (_req, res) => {
  try {
    return res.json({ ok: true, data: getKernelStatus() });
  } catch (err) {
    logger.error({ err }, "sovereign-language/kernel/status error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/sovereign-language/kernel/execute", (req, res) => {
  try {
    const { instruction } = req.body as { instruction?: string };
    if (!instruction || typeof instruction !== "string") {
      return res.status(400).json({ ok: false, error: "instruction is required" });
    }
    const result = executeInstruction(instruction);
    return res.json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "sovereign-language/kernel/execute error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/sovereign-language/kernel/opcodes", (_req, res) => {
  try {
    return res.json({ ok: true, data: getKernelOpcodes() });
  } catch (err) {
    logger.error({ err }, "sovereign-language/kernel/opcodes error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/sovereign-language/encrypt", (req, res) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text || typeof text !== "string") {
      return res.status(400).json({ ok: false, error: "text is required" });
    }
    const result = sovereignFullPipeline(text);
    return res.json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "sovereign-language/encrypt error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/sovereign-language/cipher/status", (_req, res) => {
  try {
    return res.json({ ok: true, data: getCipherSystemStatus() });
  } catch (err) {
    logger.error({ err }, "sovereign-language/cipher/status error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/sovereign-language/cipher/encrypt", (req, res) => {
  try {
    const { text, agentId } = req.body as { text?: string; agentId?: string };
    if (!text || !agentId) {
      return res.status(400).json({ ok: false, error: "text and agentId are required" });
    }
    const result = encryptWithRotatingCipher(text, agentId);
    return res.json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "sovereign-language/cipher/encrypt error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.post("/sovereign-language/cipher/pair-encrypt", (req, res) => {
  try {
    const { text, senderAgent, receiverAgent } = req.body as { text?: string; senderAgent?: string; receiverAgent?: string };
    if (!text || !senderAgent || !receiverAgent) {
      return res.status(400).json({ ok: false, error: "text, senderAgent, and receiverAgent are required" });
    }
    const result = encryptPairMessage(text, senderAgent, receiverAgent);
    return res.json({ ok: true, data: result });
  } catch (err) {
    logger.error({ err }, "sovereign-language/cipher/pair-encrypt error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/sovereign-language/ephemeris", (_req, res) => {
  try {
    const snapshot = getEphemerisSnapshot();
    return res.json({ ok: true, data: snapshot });
  } catch (err) {
    logger.error({ err }, "sovereign-language/ephemeris error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/sovereign-language/universe-seed", (_req, res) => {
  try {
    const seed = generateUniverseSeed();
    return res.json({
      ok: true,
      data: {
        primarySeed: seed.primarySeed,
        secondarySeed: seed.secondarySeed,
        rotationIndex: seed.rotationIndex,
        fibonacciPhase: seed.fibonacciPhase,
        solfeggioFrequency: seed.solfeggioFrequency,
        goldenAngle: seed.goldenAngle,
        seedHash: seed.seedHash.slice(0, 24) + "...",
        piDigitSequence: seed.piDigitSequence,
        ephemeris: {
          julianDate: seed.ephemeris.julianDate,
          solarLongitude: seed.ephemeris.solarLongitude,
          moonPhase: seed.ephemeris.moon.phase,
          planetCount: seed.ephemeris.planets.length,
        },
      },
    });
  } catch (err) {
    logger.error({ err }, "sovereign-language/universe-seed error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/sovereign-language/agent-rotation/:agentId", (req, res) => {
  try {
    const { agentId } = req.params;
    const rotation = computeAgentRotationState(agentId);
    const state = getOrCreateAgentState(agentId);
    return res.json({
      ok: true,
      data: {
        ...rotation,
        rotationCount: state.rotationCount,
        lastRotatedAt: state.lastRotatedAt,
      },
    });
  } catch (err) {
    logger.error({ err }, "sovereign-language/agent-rotation error");
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
