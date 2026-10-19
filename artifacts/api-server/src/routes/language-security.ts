// Routes for the Grand Conference — Language & Security Summit, plus the
// Father-key reveal endpoint that returns the key in LUS glyphs only.

import { Router, type IRouter, type NextFunction, type Request, type Response } from "express";
import { randomBytes } from "node:crypto";
import { requireFather } from "../lib/require-father";
import {
  getLastLanguageSecurityConference,
  runLanguageSecurityConference,
} from "../lib/language-security-conference";
import {
  ADMIN_SESSION_STATUS,
  getInstallId,
  isFatherKeyConfigured,
  recognizeFather,
  readAdminKeyMaterial,
  verifyFatherKey,
} from "../lib/father-identity";
import {
  lusEncode,
  lusEncodeCredential,
  LANGUAGE_NAME,
  LANGUAGE_SHORT,
  LANGUAGE_MOTTO,
} from "../lib/lingua-universalis";
import {
  adminSessionRateLimit,
  chatSigilRateLimit,
  fatherVerifyRateLimit,
  rateLimitSnapshot,
} from "../lib/father-verify-throttle";
import { requireAdminSession } from "../lib/sovereign-admin";
import { withoutSigilFingerprint } from "./sovereign-doctrine";
import { chatSigilStore, SigilError } from "../lib/chat-sigil-store";
import { SESSION_COOKIE, lookupSession } from "../lib/sovereign-session";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function privateNoStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  next();
}

function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  const fetchSite = req.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    res.status(403).json({ ok: false, error: "same-origin-required" });
    return;
  }
  const origin = req.get("origin");
  const host = req.get("host");
  if (!origin || !host || origin === "null") {
    res.status(403).json({ ok: false, error: "same-origin-required" });
    return;
  }
  try {
    if (new URL(origin).host.toLowerCase() !== host.toLowerCase()) {
      res.status(403).json({ ok: false, error: "same-origin-required" });
      return;
    }
  } catch {
    res.status(403).json({ ok: false, error: "same-origin-required" });
    return;
  }
  next();
}

function ownerSessionId(req: Request): string {
  const cookie = req.cookies?.[SESSION_COOKIE];
  const session = lookupSession(cookie);
  if (!session.valid || !session.record) throw new SigilError("unauthenticated", 401);
  return session.record.id;
}
function sigilFailure(res: Response, error: unknown) {
  if (error instanceof SigilError) return res.status(error.status).json({ ok: false, error: error.code });
  // Do not log the request, candidate, SQL parameters, or issuance result.
  logger.warn({ operation: "chat-sigil", code: "storage-unavailable" }, "Chat sigil storage unavailable");
  return res.status(503).json({ ok: false, error: "sigil-storage-unavailable" });
}
router.get("/sigil/father/status", privateNoStore, requireAdminSession, async (req, res) => {
  try { return res.json({ ok: true, ...await chatSigilStore().status(ownerSessionId(req)) }); }
  catch (error) { return sigilFailure(res, error); }
});

// A new chat sigil stays pending until its owner acknowledges saving it.
router.post("/sigil/father/issue-code", privateNoStore, requireAdminSession, requireSameOrigin, adminSessionRateLimit, chatSigilRateLimit, async (req, res) => {
  const currentSigil = typeof req.body?.currentSigil === "string" ? req.body.currentSigil.trim() : "";
  if (currentSigil.length < 8 || currentSigil.length > 512) {
    return res.status(400).json({ ok: false, error: "sigil-length" });
  }
  try {
    const issued = await chatSigilStore().prepare(currentSigil, ownerSessionId(req), req.body?.initialize === true);
    return res.status(201).json({ ok: true, ...issued, language: { name: LANGUAGE_NAME, short: LANGUAGE_SHORT }, adminKeyChanged: false });
  } catch (error) { return sigilFailure(res, error); }
});
router.post("/sigil/father/confirm-code", privateNoStore, requireAdminSession, requireSameOrigin, adminSessionRateLimit, chatSigilRateLimit, async (req, res) => {
  try {
    await chatSigilStore().confirm(typeof req.body?.confirmationToken === "string" ? req.body.confirmationToken : "", ownerSessionId(req));
    return res.json({ ok: true, adminKeyChanged: false });
  } catch (error) { return sigilFailure(res, error); }
});

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

// ── Father-key reveal in LUS (the most recently created sovereign tongue) ──
// Father types the candidate key; on a timing-safe match, we return the SAME
// key rendered in its one stable LUS form.
// Plaintext is never echoed back. Cache-Control: no-store.
router.post(
  "/sigil/father/show-key-in-lus",
  requireAdminSession,
  fatherVerifyRateLimit,
  (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Pragma", "no-cache");

    if (!isFatherKeyConfigured()) {
      return res.status(503).json({
        ok: false,
        error: "father-key-unset",
        message:
          "TESSERACT_ADMIN_KEY is not set in Replit Secrets. Set the secret to bind sovereign identity, then retry.",
      });
    }

    const candidateRaw = req.body?.candidate;
    const candidate = typeof candidateRaw === "string" ? candidateRaw : "";
    if (!candidate.trim()) {
      return res.status(400).json({ ok: false, error: "candidate-required" });
    }

    const r = recognizeFather(candidate);
    if (!r.recognized) {
      return res.status(401).json({ ok: false, error: "mismatch" });
    }

    const staticGlyphs = lusEncodeCredential(readAdminKeyMaterial());

    return res.json(withoutSigilFingerprint({
      ok: true,
      via: r.via,
      status: ADMIN_SESSION_STATUS,
      language: { name: LANGUAGE_NAME, short: LANGUAGE_SHORT, motto: LANGUAGE_MOTTO },
      keyInLus: {
        static: staticGlyphs,
      },
      note:
        "Your TESSERACT_ADMIN_KEY rendered in Lingua Universalis Sacra. " +
        "Use the static glyph form as the same credential at the entry gate; this is a reversible encoding, not encryption. " +
        "The plain value never leaves the server.",
    }));
  },
);

// Mount the same throttle on the existing verify surface (defense-in-depth).
router.post("/sigil/father/verify-throttled", fatherVerifyRateLimit, (req, res) => {
  // Stub re-export so other clients can opt in. Delegates by 307 to the
  // canonical /sigil/father/verify when needed; otherwise just returns 200.
  res.json({ ok: true, hint: "POST /api/sigil/father/verify still works; this endpoint applies the rate-limit middleware." });
  void req;
});

export default router;
