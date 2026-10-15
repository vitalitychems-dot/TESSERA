import { Router, type IRouter } from "express";
import { getMeshStats, getGroupSessions, getGroupSharedState } from "../lib/session-mesh";
import { validateMeshToken } from "../lib/mesh-auth";
import { requireAdminSession } from "../lib/sovereign-admin";
import { rawKeyFailRateLimit } from "../lib/father-verify-throttle";

const router: IRouter = Router();

router.get("/mesh/stats", (_req, res) => {
  try {
    const stats = getMeshStats();
    return res.json({
      ok: true,
      totalSessions: stats.totalSessions,
      totalGroups: stats.totalGroups,
      connectedPeers: stats.totalSessions,
      peers: stats.totalGroups,
      messageCount: 0,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

router.get("/mesh/sessions/:keyHash", rawKeyFailRateLimit, requireAdminSession, (req, res) => {
  try {
    const callerKeyHash = validateMeshToken(process.env.TESSERACT_ADMIN_KEY);
    if (!callerKeyHash) {
      return res.status(401).json({ ok: false, error: "Valid sovereign key required" });
    }
    const keyHash = String(req.params.keyHash);
    if (keyHash !== callerKeyHash) {
      return res.status(403).json({ ok: false, error: "Forbidden: keyHash does not match your sovereign key" });
    }
    const sessions = getGroupSessions(keyHash);
    const sharedState = getGroupSharedState(keyHash);
    return res.json({ ok: true, sessions, sharedState, count: sessions.length });
  } catch (err) {
    return res.status(500).json({ ok: false, error: (err as Error).message });
  }
});

export default router;
