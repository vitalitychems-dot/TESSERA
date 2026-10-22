import { Router, type IRouter, type Response } from "express";
import { logger } from "../lib/logger";
import { requireAdminSession } from "../lib/sovereign-admin";
import {
  getKernelStats,
  compressLegacy,
  compressEncryptQuantum,
  translateToColonial,
  translateFromColonial,
  colonialLegacyXorFailure,
} from "../lib/colonial-language-kernel";
import {
  getBandStatus,
  getAllBands,
  forceRotateAllBands,
} from "../lib/lattice-frequency-bands";
import {
  getOrRunGrandConference,
  getColonialStatus,
  updateLatticeStatus,
  recordEncodedFile,
  recordExternalHandshake,
} from "../lib/grand-conference";
import {
  colonialSecretFailure,
  colonialSecretUnavailableBody,
  isColonialSecretConfigured,
} from "../lib/colonial-master-secret";

const router: IRouter = Router();

function respondInternalError(res: Response, err: unknown, label: string) {
  const errName = err instanceof Error ? err.name : "Error";
  logger.error({ err: errName }, label);
  return res.status(500).json({ ok: false, error: "internal error" });
}


// ─── GET /api/colonel/stats ───────────────────────────────────────────────────
router.get("/colonel/stats", requireAdminSession, (_req, res) => {
  try {
    const stats = getKernelStats();
    return res.json({ ok: true, ...stats });
  } catch (err) {
    return respondInternalError(res, err, "colonel/stats error");
  }
});

// ─── POST /api/colonel/compress ───────────────────────────────────────────────
router.post("/colonel/compress", requireAdminSession, (req, res) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text || typeof text !== "string") {
      return res.status(400).json({ ok: false, error: "text is required" });
    }
    if (text.length > 50_000) {
      return res.status(413).json({ ok: false, error: "text too large (max 50000 chars)" });
    }
    const result = compressLegacy(text);
    recordEncodedFile();
    return res.json({ ok: true, ...result });
  } catch (err) {
    const failure = colonialLegacyXorFailure(err);
    if (failure) {
      logger.error("colonial legacy xor not configured");
      return res.status(failure.status).json(failure.body);
    }
    return respondInternalError(res, err, "colonel/compress error");
  }
});

// ─── POST /api/colonel/compress-encrypt ──────────────────────────────────────
router.post("/colonel/compress-encrypt", requireAdminSession, (req, res) => {
  try {
    const { text } = req.body as { text?: string };
    if (!text || typeof text !== "string") {
      return res.status(400).json({ ok: false, error: "text is required" });
    }
    if (text.length > 50_000) {
      return res.status(413).json({ ok: false, error: "text too large (max 50000 chars)" });
    }
    const result = compressEncryptQuantum(text);
    recordEncodedFile();
    return res.json({ ok: true, ...result });
  } catch (err) {
    const failure = colonialSecretFailure(err);
    if (failure) {
      logger.error("colonial secret not configured");
      return res.status(failure.status).json(failure.body);
    }
    return respondInternalError(res, err, "colonel/compress-encrypt error");
  }
});

// ─── POST /api/colonel/translate ─────────────────────────────────────────────
router.post("/colonel/translate", requireAdminSession, (req, res) => {
  try {
    const { text, direction } = req.body as { text?: string; direction?: string };
    if (!text || typeof text !== "string") {
      return res.status(400).json({ ok: false, error: "text is required" });
    }

    if (direction === "from") {
      const result = translateFromColonial(text);
      recordExternalHandshake(false);
      return res.json({ ok: true, direction: "from", ...result });
    }

    const result = translateToColonial(text);
    recordExternalHandshake(true);
    return res.json({ ok: true, direction: "to", ...result });
  } catch (err) {
    return respondInternalError(res, err, "colonel/translate error");
  }
});

// ─── GET /api/sovereignty/colonial-language/conference ───────────────────────
router.get("/sovereignty/colonial-language/conference", requireAdminSession, async (_req, res) => {
  try {
    const conference = await getOrRunGrandConference();
    return res.json({
      ok: true,
      data: {
        conference: {
          status: conference.status,
          approvalRate: conference.approvalRate,
          agentCount: conference.agentCount,
          convened: conference.convened,
          decisionId: conference.decisionId,
        },
        top10: conference.top10,
        topic: conference.topic,
        transcript: conference.transcript,
      },
    });
  } catch (err) {
    return respondInternalError(res, err, "sovereignty/colonial-language/conference error");
  }
});

// ─── GET /api/sovereignty/colonial-language/status ───────────────────────────
router.get("/sovereignty/colonial-language/status", requireAdminSession, (_req, res) => {
  try {
    if (!isColonialSecretConfigured()) {
      return res.status(503).json(colonialSecretUnavailableBody());
    }
    const bandStatus = getBandStatus();
    updateLatticeStatus(bandStatus.totalRotations);

    const status = getColonialStatus();
    status.latticeFrequencies = {
      bands: bandStatus.activeBands,
      totalRotations: bandStatus.totalRotations,
    };

    return res.json({
      ok: true,
      data: {
        ...status,
        latticeFrequencies: {
          // bands array is already public-safe (cipherKey stripped by getBandStatus)
          bands: bandStatus.bands,
          bandCount: bandStatus.activeBands,
          totalRotations: bandStatus.totalRotations,
        },
        kernelVersion: "4.0.0",
        pipelineActive: true,
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    const failure = colonialSecretFailure(err);
    if (failure) {
      logger.error("colonial secret not configured");
      return res.status(failure.status).json(failure.body);
    }
    return respondInternalError(res, err, "sovereignty/colonial-language/status error");
  }
});

// ─── GET /api/sovereignty/colonial-language/lattice-frequencies ──────────────
router.get("/sovereignty/colonial-language/lattice-frequencies", requireAdminSession, (_req, res) => {
  try {
    if (!isColonialSecretConfigured()) {
      return res.status(503).json(colonialSecretUnavailableBody());
    }
    const { bands, totalRotations, activeBands } = getBandStatus();
    return res.json({
      ok: true,
      data: bands,
      meta: {
        totalRotations,
        activeBands,
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    const failure = colonialSecretFailure(err);
    if (failure) {
      logger.error("colonial secret not configured");
      return res.status(failure.status).json(failure.body);
    }
    return respondInternalError(res, err, "sovereignty/colonial-language/lattice-frequencies error");
  }
});

// ─── POST /api/sovereignty/colonial-language/rotate ──────────────────────────
router.post("/sovereignty/colonial-language/rotate", requireAdminSession, (_req, res) => {
  try {
    if (!isColonialSecretConfigured()) {
      return res.status(503).json(colonialSecretUnavailableBody());
    }
    forceRotateAllBands();
    const { bands, totalRotations, activeBands } = getBandStatus();
    return res.json({ ok: true, message: "All lattice bands rotated", bands, totalRotations, activeBands });
  } catch (err) {
    const failure = colonialSecretFailure(err);
    if (failure) {
      logger.error("colonial secret not configured");
      return res.status(failure.status).json(failure.body);
    }
    return respondInternalError(res, err, "sovereignty/colonial-language/rotate error");
  }
});

export default router;
