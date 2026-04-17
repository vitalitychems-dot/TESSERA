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

const router: Router = Router();

/** Middleware: glyph-encode every JSON response unless the caller presents
 *  the active reading key in `X-Sigil-Key`. Apply with `router.use(glyphGate)`
 *  on routes whose surface should default to the sovereign language. */
export function glyphGate(req: Request, res: Response, next: NextFunction): void {
  const key = readingKey();
  const presented = String(req.header("x-sigil-key") ?? "").trim();
  const isHolder = presented === key.fingerprint || presented === key.expiresWith;
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

router.get("/sigil/active-key", (_req, res) => {
  res.json({ ok: true, key: getActiveKey() });
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
