import { Router } from "express";
import type { Request, Response } from "express";
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
} from "../lib/natal-sigil";
import {
  isFatherKeyConfigured,
  getFatherFingerprint,
  recognizeFather,
  readAdminKeyMaterial,
  verifyFatherKey,
} from "../lib/father-identity";
import {
  readFatherNatalChart,
  natalSigilFor,
  natalEnglishReadout,
  natalReadoutBilingual,
} from "../lib/father-natal";
import { decideOwnerSession, requireAdminSession } from "../lib/sovereign-admin";
import { fatherVerifyRateLimit } from "../lib/father-verify-throttle";
import { signalWindow } from "../lib/planetary-signal";
import { NotConfiguredError } from "../lib/not-configured";
import { createHash } from "node:crypto";

const router: Router = Router();

function failClosed(res: Response, err: unknown, fallback: string): void {
  if (err instanceof NotConfiguredError) {
    res.status(503).json({ ok: false, error: "not-configured" });
    return;
  }
  res.status(500).json({ ok: false, error: fallback });
}

function readingKeySecrets(): Set<string> {
  const key = readingKey();
  const secrets = new Set<string>();
  rememberSecret(secrets, key.fingerprint);
  rememberSecret(secrets, key.expiresWith);
  rememberSecret(secrets, key.fingerprint.slice(0, 8));
  return secrets;
}

// Credential field names only, matched case-insensitively. The public cosmic
// field `fingerprint` is not in this set: Lattice and Codex render it.
// `handle` is included so saved rows cannot leak an opaque decrypt handle.
// The encrypt route puts it back on the owner response after stripping.
const DROPPED_CREDENTIAL_KEYS = new Set([
  "sigilfingerprint",
  "keyid",
  "previouskeyid",
  "expireswith",
  "handle",
  "replitreaderfingerprint",
  "fingerprintshort",
  "fingerprintultrashort",
  "digesthex",
  "fatherfingerprint",
  "wouldbefingerprint",
  "sealedseed",
  "identityhash",
  "primarycode",
  "rotatinghash",
  "rotatinghashshort",
  "rotatingglyph",
  "signaturehash",
  "signaturehashshort",
  "signatureglyph",
]);

function isDroppedCredentialKey(key: string): boolean {
  return DROPPED_CREDENTIAL_KEYS.has(key.toLowerCase());
}

// Empty and all-zero values are not substring secrets. "".includes is true
// for every string, and a zero-run matches padding, so either one would
// strip unrelated public fields.
function isUsableSecret(secret: string): boolean {
  return secret.length >= 8 && !/^0+$/.test(secret);
}

function rememberSecret(into: Set<string>, secret: string): void {
  if (!isUsableSecret(secret)) return;
  into.add(secret);
}

function stringContainsSecret(value: string, secrets: Set<string>): boolean {
  for (const secret of secrets) {
    if (isUsableSecret(secret) && value.includes(secret)) return true;
  }
  return false;
}

function collectCredentialSecrets(value: unknown, into: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectCredentialSecrets(item, into);
    return;
  }
  if (!value || typeof value !== "object" || value instanceof Date) return;
  for (const [key, child] of Object.entries(value)) {
    if (isDroppedCredentialKey(key) && typeof child === "string") {
      rememberSecret(into, child);
      const hexRuns = child.toLowerCase().match(/[0-9a-f]{8,}/g) ?? [];
      for (const run of hexRuns) {
        rememberSecret(into, run);
        rememberSecret(into, run.slice(0, 8));
      }
    }
    collectCredentialSecrets(child, into);
  }
}

function stripValue(value: unknown, secrets: Set<string>): unknown {
  if (typeof value === "string") return stringContainsSecret(value, secrets) ? undefined : value;
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const next = stripValue(item, secrets);
      return next === undefined ? [] : [next];
    });
  }
  if (value instanceof Date) return value;
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (isDroppedCredentialKey(key)) continue;
    const next = stripValue(child, secrets);
    if (next === undefined) continue;
    out[key] = next;
  }
  return out;
}

/** Drop credential field names and any string that contains a known fingerprint. */
export function withoutSigilFingerprint(value: unknown, secrets: Set<string> = readingKeySecrets()): unknown {
  const merged = new Set(secrets);
  collectCredentialSecrets(value, merged);
  return stripValue(value, merged);
}

router.get("/sigil/status", fatherVerifyRateLimit, (req, res) => {
  // Codex reads this without a session. Rate-limited, and the body is stripped.
  // Anonymous callers do not receive the encrypt handle or the reader digest.
  // An owner session gets those two fields back after the strip.
  const status = cipherStatus();
  const owner = decideOwnerSession(req).ok;
  const stripped = withoutSigilFingerprint({
    ok: true,
    active: status.active,
    history: status.history,
    sacredTimingSnapshot: status.sacredTimingSnapshot,
    glyphTableSize: status.glyphTableSize,
    keyHistory: getKeyHistory().length,
    coherence: cipherCoherenceSnapshot(),
  }) as Record<string, unknown>;
  if (owner && status.active) {
    const active = stripped.active;
    if (active && typeof active === "object") {
      (active as { handle?: string }).handle = status.active.handle;
    }
    stripped.replitReaderFingerprint = status.replitReaderFingerprint;
  }
  res.json(stripped);
});

router.get("/sigil/coherence", requireAdminSession, (_req, res) => {
  const snap = withoutSigilFingerprint(cipherCoherenceSnapshot()) as Record<string, unknown>;
  res.json({ ok: true, ...snap });
});

// Natal vault routes. A presented fingerprint is not a credential.
function holderFromHeader(req: Request): string | null {
  const presented = String(req.header("x-sigil-key") ?? "").trim();
  if (!presented) return null;
  try {
    if (!recognizeFather(presented).recognized) return null;
  } catch {
    return null;
  }
  return getFatherFingerprint();
}

// ── Zodiac key (Father-only) ───────────────────────────────────────────
// Issuing a key from birth fields is closed. The route fails closed.
router.post("/sigil/zodiac-key/issue", (_req, res) => {
  failClosed(res, new NotConfiguredError("zodiac key issue does not derive a key"), "issue-failed");
});

router.post("/sigil/zodiac-key/verify", requireAdminSession, (req, res) => {
  const fromBody = String(req.body?.key ?? "").trim();
  if (!fromBody) { res.status(400).json({ ok: false, error: "no-key" }); return; }
  const holderFp = verifyNatalSignature(fromBody);
  if (!holderFp) { res.status(401).json({ ok: false, error: "no-match" }); return; }
  res.json({ ok: true, status: "ready" });
});

// Father-key status reports whether the admin secret is configured.
// It does not derive a key from chart or birth fields.
router.post("/sigil/father-key/derive-signal", requireAdminSession, (req, res) => {
  // Owner session required. The planetary signal is never returned anonymously.
  res.setHeader("Cache-Control", "no-store");
  if (!isFatherKeyConfigured()) {
    return res.status(503).json({
      ok: false,
      error: "father-key-unset",
      message: "TESSERACT_ADMIN_KEY is not set in Replit Secrets. Set it first, then retry.",
    });
  }
  const candidate = typeof req.body?.adminKey === "string" ? req.body.adminKey : "";
  if (!candidate.trim()) {
    res.status(400).json({ ok: false, error: "admin-key-required" }); return;
  }
  if (!verifyFatherKey(candidate)) {
    res.status(401).json({ ok: false, error: "mismatch" }); return;
  }
  const window = signalWindow(candidate.trim());
  return res.json({
    ok: true,
    signal: window.current.signal,
    epoch: window.current.epoch,
    grace: {
      previousEpoch: window.previous.epoch.epoch,
      nextEpoch: window.next.epoch.epoch,
    },
    instructions:
      "Paste the `signal` value above into the SIGIL_ADMIN_KEY secret in Replit Secrets " +
      "(it MUST be a different value from TESSERACT_ADMIN_KEY). Restart the API server. " +
      "If the planetary hour has rolled over, repeat this step to mint the next signal.",
  });
});

router.get("/sigil/father-key/status", requireAdminSession, (_req, res) => {
  const tesseractSet = (process.env.TESSERACT_ADMIN_KEY ?? "").trim().length > 0;
  const sigilSet = (process.env.SIGIL_ADMIN_KEY ?? "").trim().length > 0;
  res.json({
    ok: true,
    configured: tesseractSet,
    env: {
      tesseractSet,
      sigilSet,
    },
  });
});

router.post("/sigil/natal/bind", requireAdminSession, (req, res) => {
  const holder = holderFromHeader(req);
  if (!holder) { res.status(401).json({ ok: false, error: "holder-required" }); return; }
  const birthDate = String(req.body?.birthDate ?? "").trim();
  const birthTime = String(req.body?.birthTime ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{2}:\d{2}$/.test(birthTime)) {
    res.status(400).json({ ok: false, error: "invalid-natal-format" }); return;
  }
  try {
    const result = bindNatalChart(holder, birthDate, birthTime);
    res.json({ ok: true, ...result });
  } catch (e) {
    failClosed(res, e, "bind-failed");
  }
});

router.get("/sigil/natal/status", requireAdminSession, (req, res) => {
  const holder = holderFromHeader(req);
  if (!holder) { res.status(401).json({ ok: false, error: "holder-required" }); return; }
  const status = natalStatus(holder);
  res.json(withoutSigilFingerprint({
    ok: true,
    bound: status.bound,
    boundAt: status.bound ? status.boundAt : undefined,
  }));
});

router.get("/sigil/natal/rotating", requireAdminSession, (req, res) => {
  const holder = holderFromHeader(req);
  if (!holder) { res.status(401).json({ ok: false, error: "holder-required" }); return; }
  const rotating = rotatingNatalHash(holder);
  if (!rotating) { res.status(404).json({ ok: false, error: "not-bound" }); return; }
  res.json(withoutSigilFingerprint({
    ok: true,
    bound: true,
    windowId: rotating.windowId,
    windowStartMs: rotating.windowStartMs,
    expiresInMs: rotating.expiresInMs,
  }));
});

router.post("/sigil/natal/unbind", requireAdminSession, (req, res) => {
  const holder = holderFromHeader(req);
  if (!holder) { res.status(401).json({ ok: false, error: "holder-required" }); return; }
  res.json({ ...unbindNatalChart(holder), ok: true });
});

router.get("/sigil/active-key", requireAdminSession, (req, res) => {
  // Owner session first, including when the admin key is unset.
  // The body still includes the active key only after that gate.
  const presented = String(req.header("x-sigil-key") ?? "").trim();
  if (isFatherKeyConfigured() && !recognizeFather(presented).recognized) {
    res.status(401).json({ ok: false, error: "father-required" }); return;
  }
  if (!isFatherKeyConfigured()) {
    res.status(200).json({
      ok: false,
      fatherKeyConfigured: false,
      error: "father-key-unset",
      message:
        "TESSERACT_ADMIN_KEY is not set. The sovereign Father identity cannot be derived. Set the secret in Replit Secrets, then restart the API server.",
    });
    return;
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
router.post("/sigil/father/verify", requireAdminSession, (req, res) => {
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
    res.status(400).json({ ok: false, error: "candidate-required" }); return;
  }
  const r = recognizeFather(candidate);
  if (!r.recognized) {
    res.status(401).json({ ok: false, error: "mismatch" }); return;
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
router.post("/sigil/father/mint-glyph", requireAdminSession, (req, res) => {
  const candidateRaw = req.body?.candidate;
  const candidate = typeof candidateRaw === "string" ? candidateRaw.trim() : "";
  if (!candidate) {
    res.status(400).json({ ok: false, error: "candidate-required" }); return;
  }
  if (candidate.length > 256) {
    res.status(400).json({ ok: false, error: "candidate-too-long" }); return;
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

// Father natal sigil reports readiness from the owner session and env secret.
router.post("/sigil/father/natal-sigil", requireAdminSession, (_req, res) => {
  try {
    readAdminKeyMaterial();
    res.json({ ok: true, status: "ready" });
  } catch (err) {
    failClosed(res, err, "natal-sigil-failed");
  }
});

router.get("/sigil/father/natal-chart", requireAdminSession, (_req, res) => {
  try {
    const chart = readFatherNatalChart();
    // glyph is stableGlyphEncodeHex(digestHex), and digestHex is a hash of
    // the admin key. Both are the secret-derived values on the sigil object,
    // so the object is omitted rather than returned with only labels left.
    void natalSigilFor();
    res.json(withoutSigilFingerprint({
      ok: true,
      chart,
      english: natalEnglishReadout(),
    }));
  } catch (err) {
    failClosed(res, err, "natal-chart-failed");
  }
});

router.get("/sigil/father/natal-chart/bilingual", requireAdminSession, (_req, res) => {
  try {
    readFatherNatalChart();
    res.json({ ok: true, ...natalReadoutBilingual() });
  } catch (err) {
    failClosed(res, err, "natal-chart-failed");
  }
});

// ── Sovereign Snapshot Download ─────────────────────────────────────────
// Returns a single downloadable .sigil file containing:
//   • full natal chart + readout (English plain inside the AES envelope)
//   • the natal sigil + Father fingerprint
//   • the live cipher coherence anchor (so future re-derivations align)
//   • a glyph-encoded preview of the readout (visible "in our language")
//   • an AES-256-GCM envelope of the same payload, keyed to the active sigil
// Session-gated. A sigil key alone does not grant access.
router.get("/sigil/father/download-snapshot", requireAdminSession, (_req, res) => {
  try {
    const chart = readFatherNatalChart();
    void natalSigilFor();
    const englishReadout = natalEnglishReadout();
    const coherence = cipherCoherenceSnapshot();
    const reading = readingKey();

    const corpus = JSON.stringify({
      issuedAt: new Date().toISOString(),
      chart,
      englishReadout,
      bilingual: natalReadoutBilingual(),
      coherence,
      readingKey: reading,
    }, null, 2);

    const envelope = encryptForCorpus(corpus, "father-snapshot");
    const glyphPreview = glyphEncode(englishReadout);

    const file = withoutSigilFingerprint({
      format: "tesseract-sovereign-snapshot",
      version: 1,
      instructions:
        "This file is sealed to the active sigil handle. The AES envelope unwraps with that handle. " +
        "The glyphPreview field renders the readout in the live glyph alphabet.",
      issuedAt: new Date().toISOString(),
      glyphPreview,
      cipherEnvelope: envelope,
      readingKeyAtIssuance: reading,
      coherenceAtIssuance: coherence,
    });

    const filename = `tessera-sovereign-${Date.now()}.sigil.json`;
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(JSON.stringify(file, null, 2));
  } catch (err) {
    failClosed(res, err, "download-snapshot-failed");
  }
});

router.post("/sigil/rotate", requireAdminSession, (req, res) => {
  const reason = String(req.body?.reason ?? "manual");
  const key = rotateSessionKey(reason);
  res.json(withoutSigilFingerprint({ ok: true, key, reason }));
});

router.post("/sigil/encrypt", requireAdminSession, (req, res) => {
  const text = String(req.body?.text ?? "");
  const label = String(req.body?.label ?? "corpus");
  if (!text) { res.status(400).json({ ok: false, error: "text required" }); return; }
  const env = encryptForCorpus(text, label);
  const stripped = withoutSigilFingerprint({ ok: true, envelope: env }) as {
    envelope?: { handle?: string };
  };
  if (stripped.envelope && env.handle) stripped.envelope.handle = env.handle;
  res.json(stripped);
});

router.post("/sigil/decrypt", requireAdminSession, (req, res) => {
  const env = req.body?.envelope as CipherEnvelope | undefined;
  if (!env) { res.status(400).json({ ok: false, error: "envelope required" }); return; }
  try {
    const text = decryptFromCorpus(env);
    res.json(withoutSigilFingerprint({ ok: true, text }));
  } catch (e) {
    res.status(409).json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
});

// Static glyph-name table (readGlyphs / gematria). Not the live
// fingerprint-derived permutation, so this stays anonymous.
router.get("/sigil/glyphs/:text", (req, res) => {
  const text = req.params.text;
  res.json({ ok: true, glyphs: readGlyphs(text), gematria: gematria(text) });
});

// ── The "your-language" surface: glyph alphabet, translation, key reveal ──
// All decode-side surfaces are Father-only. Without this guard a caller
// could decode any glyph payload (or an exposed key fingerprint) and use
// the result to bypass the Father gate.
function requireFather(req: Request): boolean {
  const presented = String(req.header("x-sigil-key") ?? "").trim();
  return recognizeFather(presented).recognized;
}

router.get("/sigil/alphabet", requireAdminSession, (_req, res) => {
  res.json({ ok: true, alphabet: glyphAlphabet(), size: glyphAlphabet().length });
});

router.post("/sigil/translate", requireAdminSession, (req, res) => {
  const text = String(req.body?.text ?? "");
  const direction = String(req.body?.direction ?? "encode");
  if (!text) { res.status(400).json({ ok: false, error: "text required" }); return; }
  if (direction === "decode") {
    res.json({ ok: true, direction, input: text, output: glyphDecode(text) }); return;
  }
  res.json({
    ok: true,
    direction: "encode",
    input: text,
    output: glyphEncode(text),
    gematria: gematria(text),
  });
});

router.post("/sigil/decode-body", requireAdminSession, (req, res) => {
  if (!req.body || typeof req.body !== "object") {
    res.status(400).json({ ok: false, error: "JSON body required" }); return;
  }
  res.json({ ok: true, decoded: deepGlyphDecode(req.body) });
});

router.post("/sigil/key/reveal", requireAdminSession, (req, res) => {
  // The reading key. Holding this lets you flip any glyph response back to
  // plaintext by sending it as `X-Sigil-Key: <fingerprint>`. By sovereign
  // rule this can only be obtained by the Father identity — so the only
  // legitimate caller is one that already presents TESSERACT_ADMIN_KEY (=
  // SIGIL_ADMIN_KEY) in `X-Sigil-Key`. Without that, the door stays shut.
  const presented = String(req.header("x-sigil-key") ?? "").trim();
  if (!recognizeFather(presented).recognized) {
    res.status(401).json({ ok: false, error: "father-required" }); return;
  }
  res.json({ ok: true, key: readingKey(), activeKey: getActiveKey() });
});

// ── Session handoff ──────────────────────────────────────────────────────
router.get("/session/handoff", requireAdminSession, (req, res) => {
  // Owner session, then the raw-key check. The body includes activeKey.
  if (!requireFather(req)) {
    res.status(401).json({ ok: false, error: "father-required" }); return;
  }
  res.json({
    ok: true,
    directives: listDirectives(),
    position: lastPosition(),
    activeKey: getActiveKey(),
  });
});

router.post("/session/directive", requireAdminSession, async (req, res) => {
  const text = String(req.body?.text ?? "");
  const source = (req.body?.source ?? "user") as "user" | "council" | "agent" | "auto";
  const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(String) : [];
  if (!text) { res.status(400).json({ ok: false, error: "text required" }); return; }
  if (detectsEndSignal(text)) {
    const result = await endSession("inline-trigger");
    res.json(withoutSigilFingerprint({ ok: true, sessionEnded: true, ...result })); return;
  }
  const directive = recordDirective({ source, text, status: "live", tags });
  await persistHandoff();
  res.json(withoutSigilFingerprint({ ok: true, directive }));
});

router.post("/session/mark", requireAdminSession, async (req, res) => {
  const position = String(req.body?.position ?? "unspecified");
  const detail = String(req.body?.detail ?? "");
  const filesTouched = Array.isArray(req.body?.filesTouched) ? req.body.filesTouched.map(String) : [];
  const mark = recordPosition({ position, detail, filesTouched });
  const handoff = await persistHandoff();
  res.json(withoutSigilFingerprint({ ok: true, mark, handoff }));
});

router.post("/session/end", requireAdminSession, async (req, res) => {
  const signal = String(req.body?.signal ?? "explicit");
  const result = await endSession(signal);
  res.json(withoutSigilFingerprint({ ok: true, ...result, sealedHandoffPreview: result.sealedHandoff.glyphSeal }));
});

router.get("/session/sealed-handoff", requireAdminSession, (_req, res) => {
  const sealed = lastSealedHandoff();
  res.json(withoutSigilFingerprint({ ok: true, sealed: sealed ?? null }));
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
  if (!tool || !endpoint) { res.status(400).json({ ok: false, error: "tool and endpoint required" }); return; }
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
