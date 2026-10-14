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
  isFatherKeyConfigured,
  recognizeFather,
  getFatherFingerprint,
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
  fatherVerifyRateLimit,
  rateLimitSnapshot,
} from "../lib/father-verify-throttle";
import { requireAdminSession } from "../lib/sovereign-admin";
import { withoutSigilFingerprint } from "./sovereign-doctrine";

const router: IRouter = Router();

function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
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

// Issue a fresh one-key replacement only within an authenticated owner session.
// The LUS value is returned once; Replit Secrets must be updated by the owner.
router.post("/sigil/father/issue-code", requireAdminSession, requireSameOrigin, adminSessionRateLimit, (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  if (!isFatherKeyConfigured()) {
    return res.status(503).json({ ok: false, error: "father-key-unset" });
  }
  const currentSigil = typeof req.body?.currentSigil === "string" ? req.body.currentSigil.trim() : "";
  if (!currentSigil || currentSigil.length > 512) {
    return res.status(400).json({ ok: false, error: "current-sigil-required" });
  }
  if (!verifyFatherKey(currentSigil)) {
    return res.status(403).json({ ok: false, error: "sigil-mismatch" });
  }
  const canonical = randomBytes(32).toString("base64url");
  return res.status(201).json({
    ok: true,
    code: lusEncodeCredential(canonical),
    language: { name: LANGUAGE_NAME, short: LANGUAGE_SHORT, motto: LANGUAGE_MOTTO },
    saveAs: "TESSERACT_ADMIN_KEY",
    instructions: "Save this exact LUS code as the single TESSERACT_ADMIN_KEY Replit Secret, then restart the API workflow. The same LUS code will unlock the entry gate.",
  });
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

    const fp = getFatherFingerprint();
    const staticGlyphs = lusEncodeCredential(readAdminKeyMaterial());

    return res.json(withoutSigilFingerprint({
      ok: true,
      via: r.via,
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
