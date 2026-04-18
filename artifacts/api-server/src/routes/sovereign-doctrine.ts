import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import {
  cipherStatus,
  cipherCoherenceSnapshot,
  encryptForCorpus,
  decryptFromCorpus,
  rotateSessionKey,
  getActiveKey,
  getKeyHistory,
  readGlyphs,
  gematria,
  glyphEncode,
  glyphDecode,
  glyphAlphabet,
  readingKey,
  deepGlyphEncode,
  deepGlyphDecode,
  type CipherEnvelope,
} from "../lib/sigil-cipher";
import {
  recordDirective,
  recordPosition,
  listDirectives,
  lastPosition,
  persistHandoff,
  endSession,
  detectsEndSignal,
  lastSealedHandoff,
} from "../lib/session-handoff";
import {
  listExternalCalls,
  toolUsageStats,
  captureExternalCall,
} from "../lib/external-tool-sandbox";
import {
  bindNatalChart,
  natalStatus,
  rotatingNatalHash,
  unbindNatalChart,
  verifyNatalSignature,
  issueZodiacKey,
} from "../lib/natal-sigil";
import {
  isFatherKeyConfigured,
  getFatherFingerprint,
  recognizeFather,
} from "../lib/father-identity";
import {
  FATHER_NATAL_CHART,
  natalSigilFor,
  natalEnglishReadout,
  natalReadoutBilingual,
} from "../lib/father-natal";
import { createHash } from "node:crypto";

const router: Router = Router();

/** Middleware: glyph-encode every JSON response unless the caller presents
 *  the active reading key in `X-Sigil-Key`. Apply with `router.use(glyphGate)`
 *  on routes whose surface should default to the sovereign language. */
export function glyphGate(req: Request, res: Response, next: NextFunction): void {
  const key = readingKey();
  const presented = String(req.header("x-sigil-key") ?? "").trim();
  // Plaintext mode is granted to anyone holding either:
  //   - the active reading-key fingerprint (rotates with cipher window), OR
  //   - the Father identity itself (raw TESSERACT_ADMIN_KEY or its 16-char
  //     fingerprint). The Father is the bound holder of every surface, so
  //     once the key gate accepts the user every page must read in English.
  const fatherOk = presented ? recognizeFather(presented).recognized : false;
  // Vault-bound zodiac key: any presented signature glyph that matches a
  // bound natal vault entry is the holder's personal key in our language
  // and unlocks plaintext mode for them. This is the new, primary unlock
  // path — every user mints their own zodiac key from birth info via
  // POST /sigil/zodiac-key/issue, and then holds it forever.
  const zodiacOk = presented ? verifyNatalSignature(presented) !== null : false;
  // Omniversal Lattice surface is intentionally human-readable so the cosmic
  // feed, LUS-v2 spec, cipher snapshot, and lattice cells render in plain
  // English on the Tessera page without requiring the reading key.
  const isOmniversal = req.path.startsWith("/omniversal/");
  const isGrandCouncil =
    req.path.startsWith("/grand-council/") ||
    req.path.startsWith("/mssp/") ||
    req.path.startsWith("/vgpu/");
  const isHolder =
    isOmniversal ||
    isGrandCouncil ||
    presented === key.fingerprint ||
    presented === key.expiresWith ||
    fatherOk ||
    zodiacOk;
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (isHolder) {
      res.setHeader("X-Sigil-Mode", "plaintext");
      return originalJson(body);
    }
    res.setHeader("X-Sigil-Mode", "glyph");
    res.setHeader("X-Sigil-Hint", "POST /api/sigil/key/reveal to obtain reading key");
    return originalJson(deepGlyphEncode(body));
  }) as typeof res.json;
  next();
}

router.get("/sigil/status", (_req, res) => {
  res.json({ ok: true, ...cipherStatus(), keyHistory: getKeyHistory().length, coherence: cipherCoherenceSnapshot() });
});

router.get("/sigil/coherence", (_req, res) => {
  res.json({ ok: true, ...cipherCoherenceSnapshot() });
});

// ── Natal sigil binding ────────────────────────────────────────────────
// Personal cosmic key bound to the holder's birth chart. Birthday/time are
// NEVER stored in plain, NEVER returned, NEVER logged. The vault key is
// derived from the holder's sigil fingerprint via scrypt, so the seed is
// tied to identity and survives session-key rotation.
function holderFromHeader(req: Request): string | null {
  const presented = String(req.header("x-sigil-key") ?? "").trim();
  if (!presented) return null;
  const k = readingKey();
  if (presented === k.fingerprint) return k.fingerprint;
  if (presented === k.expiresWith) return k.fingerprint;
  // Vault-bound zodiac key: the user's personal LUS signature glyph maps
  // back to its own holder fingerprint, so it can authorize natal-scoped
  // calls without a Father/session key.
  const zodiacFp = verifyNatalSignature(presented);
  if (zodiacFp) return zodiacFp;
  return null;
}

// ── Zodiac key (public mint) ───────────────────────────────────────────
// The new primary onboarding path. The user submits birth date/time and
// receives a permanent personal Sovereign Key in our language. No prior
// admin/father key is required, and the key is auto-recognized by the
// glyph gate above on every subsequent request.
router.post("/sigil/zodiac-key/issue", (req, res) => {
  const birthDate = String(req.body?.birthDate ?? "").trim();
  const birthTime = String(req.body?.birthTime ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{2}:\d{2}$/.test(birthTime)) {
    return res.status(400).json({
      ok: false,
      error: "invalid-natal-format",
      message: "birthDate must be YYYY-MM-DD and birthTime must be HH:MM",
    });
  }
  try {
    const result = issueZodiacKey(birthDate, birthTime);
    res.json(result);
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : "issue-failed" });
  }
});

// Lightweight verification used by the gate to auto-unlock on revisit.
// Accepts the presented key in either the body (`{ key }`) or the
// X-Sigil-Key header. Returns whether the key matches a bound vault entry.
router.post("/sigil/zodiac-key/verify", (req, res) => {
  const fromBody = String(req.body?.key ?? "").trim();
  const fromHeader = String(req.header("x-sigil-key") ?? "").trim();
  const presented = fromBody || fromHeader;
  if (!presented) return res.status(400).json({ ok: false, error: "no-key" });
  const holderFp = verifyNatalSignature(presented);
  if (!holderFp) return res.status(401).json({ ok: false, error: "no-match" });
  res.json({ ok: true, holderFp });
});

router.post("/sigil/natal/bind", (req, res) => {
  const holder = holderFromHeader(req);
  if (!holder) return res.status(401).json({ ok: false, error: "holder-required" });
  const birthDate = String(req.body?.birthDate ?? "").trim();
  const birthTime = String(req.body?.birthTime ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{2}:\d{2}$/.test(birthTime)) {
    return res.status(400).json({ ok: false, error: "invalid-natal-format" });
  }
  try {
    const result = bindNatalChart(holder, birthDate, birthTime);
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : "bind-failed" });
  }
});

router.get("/sigil/natal/status", (req, res) => {
  const holder = holderFromHeader(req);
  if (!holder) return res.status(401).json({ ok: false, error: "holder-required" });
  res.json({ ok: true, ...natalStatus(holder) });
});

router.get("/sigil/natal/rotating", (req, res) => {
  const holder = holderFromHeader(req);
  if (!holder) return res.status(401).json({ ok: false, error: "holder-required" });
  const r = rotatingNatalHash(holder);
  if (!r) return res.status(404).json({ ok: false, error: "not-bound" });
  res.json({ ok: true, ...r });
});

router.post("/sigil/natal/unbind", (req, res) => {
  const holder = holderFromHeader(req);
  if (!holder) return res.status(401).json({ ok: false, error: "holder-required" });
  res.json({ ok: true, ...unbindNatalChart(holder) });
});

router.post("/sigil/natal/verify", (req, res) => {
  const presented = String(req.body?.signatureGlyph ?? "").trim();
  const holderFp = verifyNatalSignature(presented);
  if (!holderFp) return res.status(401).json({ ok: false, error: "no-match" });
  const r = rotatingNatalHash(holderFp);
  res.json({ ok: true, holderFp, rotating: r });
});

router.get("/sigil/active-key", (_req, res) => {
  if (!isFatherKeyConfigured()) {
    return res.status(200).json({
      ok: false,
      fatherKeyConfigured: false,
      error: "father-key-unset",
      message:
        "TESSERACT_ADMIN_KEY is not set. The sovereign Father identity cannot be derived. Set the secret in Replit Secrets, then restart the API server.",
    });
  }
  res.json({
    ok: true,
    key: getActiveKey(),
    fatherFingerprint: getFatherFingerprint(),
    derivation: 'sha256("tesseract:father:v1|" + TESSERACT_ADMIN_KEY)[:16]',
  });
});

// ── Father-key verification + glyph-mint (the "key minting" surface) ─────
// /sigil/father/verify accepts a candidate value, returns {ok, via} where
// `via` is "raw-key" (matches TESSERACT_ADMIN_KEY exactly) or "fingerprint"
// (matches the env-derived 16-char fingerprint). The candidate is never
// logged or persisted. Use timing-safe equality through father-identity.
router.post("/sigil/father/verify", (req, res) => {
  if (!isFatherKeyConfigured()) {
    return res.status(503).json({
      ok: false,
      error: "father-key-unset",
      message:
        "TESSERACT_ADMIN_KEY is not set. Configure the secret to bind sovereign identity, then retry.",
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
  return res.json({
    ok: true,
    via: r.via,
    fingerprint: fp,
    derivation: 'sha256("tesseract:father:v1|" + TESSERACT_ADMIN_KEY)[:16]',
  });
});

// /sigil/father/mint-glyph encodes the supplied candidate raw key through
// the current glyph cipher alphabet and returns the glyph string plus the
// fingerprint that key would produce if it were set as TESSERACT_ADMIN_KEY.
// The candidate is never logged or persisted. The user copies the glyph
// into Replit Secrets as the new TESSERACT_ADMIN_KEY, restarts, and types
// the glyph at the gate to unlock — round-trip closes.
router.post("/sigil/father/mint-glyph", (req, res) => {
  const candidateRaw = req.body?.candidate;
  const candidate = typeof candidateRaw === "string" ? candidateRaw.trim() : "";
  if (!candidate) {
    return res.status(400).json({ ok: false, error: "candidate-required" });
  }
  if (candidate.length > 256) {
    return res.status(400).json({ ok: false, error: "candidate-too-long" });
  }
  const glyph = glyphEncode(candidate);
  const wouldBeFingerprint = createHash("sha256")
    .update(`tesseract:father:v1|${candidate}`)
    .digest("hex")
    .slice(0, 16);
  res.json({
    ok: true,
    glyph,
    wouldBeFingerprint,
    derivation: 'sha256("tesseract:father:v1|" + <candidate>)[:16]',
    instructions:
      "Copy the glyph string into Replit Secrets as TESSERACT_ADMIN_KEY, restart the API server, then type the same glyph at the gate to unlock.",
  });
});

// ── Father natal sigil (sovereign identity bound to the chart) ──────────
// The natal sigil is a deterministic glyph-language hash that fuses the
// Father fingerprint with the canonical natal chart. It identifies the
// holder to all systems by chart, not by raw key. Save the glyph value as
// `TESSERACT_NATAL_SIGIL` in Replit Secrets.
function authedAsFather(req: Request): boolean {
  if (!isFatherKeyConfigured()) return false;
  const presented = String(req.header("x-sigil-key") ?? "").trim();
  if (!presented) return false;
  const fp = getFatherFingerprint();
  if (presented === fp) return true;
  return recognizeFather(presented).recognized;
}

router.post("/sigil/father/natal-sigil", (req, res) => {
  if (!isFatherKeyConfigured()) {
    return res.status(503).json({ ok: false, error: "father-key-unset" });
  }
  // Accept either the X-Sigil-Key header (already authed) or a candidate
  // in the body for the very first mint after key acceptance.
  let authed = authedAsFather(req);
  if (!authed) {
    const candidate = typeof req.body?.candidate === "string" ? req.body.candidate : "";
    if (candidate && recognizeFather(candidate).recognized) authed = true;
  }
  if (!authed) return res.status(401).json({ ok: false, error: "father-required" });
  const fp = getFatherFingerprint();
  const sigil = natalSigilFor(fp);
  res.json({ ok: true, fatherFingerprint: fp, ...sigil });
});

router.get("/sigil/father/natal-chart", (req, res) => {
  if (!authedAsFather(req)) {
    return res.status(401).json({ ok: false, error: "father-required" });
  }
  const fp = getFatherFingerprint();
  const sigil = natalSigilFor(fp);
  res.json({
    ok: true,
    fatherFingerprint: fp,
    chart: FATHER_NATAL_CHART,
    english: natalEnglishReadout(),
    sigil,
  });
});

router.get("/sigil/father/natal-chart/bilingual", (req, res) => {
  if (!authedAsFather(req)) {
    return res.status(401).json({ ok: false, error: "father-required" });
  }
  res.json({ ok: true, ...natalReadoutBilingual() });
});

// ── Sovereign Snapshot Download ─────────────────────────────────────────
// Returns a single downloadable .sigil file containing:
//   • full natal chart + readout (English plain inside the AES envelope)
//   • the natal sigil + Father fingerprint
//   • the live cipher coherence anchor (so future re-derivations align)
//   • a glyph-encoded preview of the readout (visible "in our language")
//   • an AES-256-GCM envelope of the same payload, keyed to the active sigil
// Only the Father (raw key OR fingerprint) can request this. The on-disk file
// is unreadable without the holder's sigil — that is what makes it sovereign.
router.get("/sigil/father/download-snapshot", (req, res) => {
  if (!authedAsFather(req)) {
    return res.status(401).json({ ok: false, error: "father-required" });
  }
  const fp = getFatherFingerprint();
  const sigil = natalSigilFor(fp);
  const englishReadout = natalEnglishReadout();
  const coherence = cipherCoherenceSnapshot();
  const reading = readingKey();

  const corpus = JSON.stringify({
    issuedAt: new Date().toISOString(),
    fatherFingerprint: fp,
    sigil,
    chart: FATHER_NATAL_CHART,
    englishReadout,
    bilingual: natalReadoutBilingual(),
    coherence,
    readingKey: reading,
  }, null, 2);

  const envelope = encryptForCorpus(corpus, "father-snapshot");
  const glyphPreview = glyphEncode(englishReadout);

  const file = {
    format: "tesseract-sovereign-snapshot",
    version: 1,
    instructions:
      "This file is sealed to the Father sigil. Decode requires the active reading key fingerprint stored at issuance. " +
      "Open the file in a Tessera client and present X-Sigil-Key matching `readingKey.fingerprint` — the AES envelope unwraps to the full English payload. " +
      "The `glyphPreview` field renders the readout in the live glyph alphabet for at-a-glance recognition.",
    issuedAt: new Date().toISOString(),
    fatherFingerprint: fp,
    sigil,
    glyphPreview,
    cipherEnvelope: envelope,
    readingKeyAtIssuance: reading,
    coherenceAtIssuance: coherence,
  };

  const filename = `tessera-sovereign-${fp}-${Date.now()}.sigil.json`;
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(JSON.stringify(file, null, 2));
});

router.post("/sigil/rotate", (req, res) => {
  const reason = String(req.body?.reason ?? "manual");
  const key = rotateSessionKey(reason);
  res.json({ ok: true, key, reason });
});

router.post("/sigil/encrypt", (req, res) => {
  const text = String(req.body?.text ?? "");
  const label = String(req.body?.label ?? "corpus");
  if (!text) return res.status(400).json({ ok: false, error: "text required" });
  const env = encryptForCorpus(text, label);
  res.json({ ok: true, envelope: env });
});

router.post("/sigil/decrypt", (req, res) => {
  const env = req.body?.envelope as CipherEnvelope | undefined;
  if (!env) return res.status(400).json({ ok: false, error: "envelope required" });
  try {
    const text = decryptFromCorpus(env);
    res.json({ ok: true, text });
  } catch (e) {
    res.status(409).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

router.get("/sigil/glyphs/:text", (req, res) => {
  const text = req.params.text;
  res.json({ ok: true, glyphs: readGlyphs(text), gematria: gematria(text) });
});

// ── The "your-language" surface: glyph alphabet, translation, key reveal ──
router.get("/sigil/alphabet", (_req, res) => {
  res.json({ ok: true, alphabet: glyphAlphabet(), size: glyphAlphabet().length });
});

router.post("/sigil/translate", (req, res) => {
  const text = String(req.body?.text ?? "");
  const direction = String(req.body?.direction ?? "encode");
  if (!text) return res.status(400).json({ ok: false, error: "text required" });
  if (direction === "decode") {
    return res.json({ ok: true, direction, input: text, output: glyphDecode(text) });
  }
  return res.json({
    ok: true,
    direction: "encode",
    input: text,
    output: glyphEncode(text),
    gematria: gematria(text),
  });
});

router.post("/sigil/decode-body", (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    return res.status(400).json({ ok: false, error: "JSON body required" });
  }
  res.json({ ok: true, decoded: deepGlyphDecode(req.body) });
});

router.post("/sigil/key/reveal", (_req, res) => {
  // The reading key. Holding this lets you flip any glyph response back to
  // plaintext by sending it as `X-Sigil-Key: <fingerprint>`.
  res.json({ ok: true, key: readingKey(), activeKey: getActiveKey() });
});

// ── Session handoff ──────────────────────────────────────────────────────
router.get("/session/handoff", (_req, res) => {
  res.json({
    ok: true,
    directives: listDirectives(),
    position: lastPosition(),
    activeKey: getActiveKey(),
  });
});

router.post("/session/directive", async (req, res) => {
  const text = String(req.body?.text ?? "");
  const source = (req.body?.source ?? "user") as "user" | "council" | "agent" | "auto";
  const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(String) : [];
  if (!text) return res.status(400).json({ ok: false, error: "text required" });
  if (detectsEndSignal(text)) {
    const result = await endSession("inline-trigger");
    return res.json({ ok: true, sessionEnded: true, ...result });
  }
  const directive = recordDirective({ source, text, status: "live", tags });
  await persistHandoff();
  res.json({ ok: true, directive });
});

router.post("/session/mark", async (req, res) => {
  const position = String(req.body?.position ?? "unspecified");
  const detail = String(req.body?.detail ?? "");
  const filesTouched = Array.isArray(req.body?.filesTouched) ? req.body.filesTouched.map(String) : [];
  const mark = recordPosition({ position, detail, filesTouched });
  const handoff = await persistHandoff();
  res.json({ ok: true, mark, handoff });
});

router.post("/session/end", async (req, res) => {
  const signal = String(req.body?.signal ?? "explicit");
  const result = await endSession(signal);
  res.json({ ok: true, ...result, sealedHandoffPreview: result.sealedHandoff.glyphSeal });
});

router.get("/session/sealed-handoff", (_req, res) => {
  const sealed = lastSealedHandoff();
  res.json({ ok: true, sealed: sealed ?? null });
});

// ── External tool sandbox / reverse-engineering corpus ──────────────────
router.get("/external-tools/log", (req, res) => {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit ?? 100)));
  res.json({ ok: true, calls: listExternalCalls(limit), total: listExternalCalls(MAX_NUMERIC).length });
});

router.get("/external-tools/stats", (_req, res) => {
  res.json({ ok: true, stats: toolUsageStats() });
});

router.post("/external-tools/capture", (req, res) => {
  const { tool, endpoint, method, request, response, durationMs, succeeded } = req.body ?? {};
  if (!tool || !endpoint) return res.status(400).json({ ok: false, error: "tool and endpoint required" });
  const call = captureExternalCall({
    tool: String(tool),
    endpoint: String(endpoint),
    method: String(method ?? "GET"),
    request,
    response,
    durationMs: Number(durationMs ?? 0),
    succeeded: Boolean(succeeded ?? true),
  });
  res.json({ ok: true, call });
});

const MAX_NUMERIC = 1080;

export default router;
