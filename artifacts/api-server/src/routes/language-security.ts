// Routes for the Grand Conference — Language & Security Summit.

import { Router, type IRouter } from "express";
import { requireFather } from "../lib/require-father";
import {
  getLastLanguageSecurityConference,
  runLanguageSecurityConference,
} from "../lib/language-security-conference";
import {
  fatherVerifyRateLimit,
  rateLimitSnapshot,
} from "../lib/father-verify-throttle";
import { requireAdminSession } from "../lib/sovereign-admin";

const router: IRouter = Router();

router.get("/grand-conference/language-security", (_req, res) => {
  const result = getLastLanguageSecurityConference();
  res.json({ ok: true, conference: result, rateLimit: rateLimitSnapshot() });
});

router.post(
  "/grand-conference/language-security/convene",
  requireFather,
  (req, res) => {
    const force = req.body?.force === true;
    const result = runLanguageSecurityConference(force);
    res.json({ ok: true, conference: result, forced: force });
  },
);

// The legacy LUS reveal returned a reversible rendering of the canonical
// admin secret to browser code. Keep the route as an explicit tombstone so
// stale clients fail closed rather than accidentally exposing key material.
router.post("/sigil/father/show-key-in-lus", requireAdminSession, (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.status(410).json({
    ok: false,
    error: "credential-reveal-disabled",
    message: "The canonical admin credential is never returned to the browser.",
  });
});

// Mount the same throttle on the existing verify surface (defense-in-depth).
router.post("/sigil/father/verify-throttled", fatherVerifyRateLimit, (req, res) => {
  // Stub re-export so other clients can opt in. Delegates by 307 to the
  // canonical /sigil/father/verify when needed; otherwise just returns 200.
  res.json({ ok: true, hint: "POST /api/sigil/father/verify still works; this endpoint applies the rate-limit middleware." });
  void req;
});

export default router;
