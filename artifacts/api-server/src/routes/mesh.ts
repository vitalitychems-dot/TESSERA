import { Router, type IRouter, type Request, type Response } from "express";
import { getMeshStats, getGroupSessions, getGroupSharedState } from "../lib/session-mesh";
import { validateMeshToken, validateSovereignAdminToken } from "../lib/mesh-auth";
import { rawKeyFailRateLimit } from "../lib/father-verify-throttle";

const router: IRouter = Router();

function requireRealAdminToken(req: Request, res: Response, next: () => void): void {
  const configured = process.env.TESSERACT_ADMIN_KEY;
  if (!configured || configured.length < 8) {
    res.status(503).json({ ok: false, error: "sovereign-unconfigured" });
    return;
  }
  const rawToken = req.headers["x-admin-token"];
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  if (!validateSovereignAdminToken(token)) {
    res.status(401).json({ ok: false, error: "Valid sovereign key required" });
    return;
  }
  next();
}

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

router.get("/mesh/sessions/:keyHash", rawKeyFailRateLimit, requireRealAdminToken, (req, res) => {
  try {
    const rawToken = req.headers["x-admin-token"];
    const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
    const callerKeyHash = validateMeshToken(token);
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
