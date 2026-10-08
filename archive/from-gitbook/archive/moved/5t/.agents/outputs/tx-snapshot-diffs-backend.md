
## artifacts/api-server/scripts/convene-natal-key-conference.mjs
Base: 5t/TESS/1/1T `18db6cf09d` → Variant: T44 `0a8c95a5d2`
--- 5t/TESS/1/1T/artifacts/api-server/scripts/convene-natal-key-conference.mjs
+++ T44/artifacts/api-server/scripts/convene-natal-key-conference.mjs
@@ -14,30 +14,111 @@
 import { createHash } from "node:crypto";
 
 // ---------------------------------------------------------------
-// Holder natal chart (Libra Sun, Aries Moon, Virgo Rising)
-// ---------------------------------------------------------------
-const NATAL = {
-  birthDateISO: "1998-10-07",
-  birthTimeHHMM: "05:16",
-  birthPlace: "Palos Hospital, Palos Heights, Illinois (CDT)",
-  houseSystem: "Placidus",
-  westernZodiac: "libra",
-  chineseZodiac: "earth-tiger",
-  placements: {
-    sun:       { sign: "libra",       degree: 13.40, house: 2 },
-    moon:      { sign: "aries",       degree: 28.28, house: 8 },
-    ascendant: { sign: "virgo",       degree:  8.15, house: 1 },
-    mercury:   { sign: "libra",       degree: 21.57, house: 2 },
-    venus:     { sign: "libra",       degree:  7.38, house: 2 },
-    mars:      { sign: "leo",         degree: 29.60, house: 12 },
-    jupiter:   { sign: "pisces",      degree: 20.43, house: 7,  retrograde: true },
-    saturn:    { sign: "taurus",      degree:  1.47, house: 9,  retrograde: true },
-    uranus:    { sign: "aquarius",    degree:  8.87, house: 5,  retrograde: true },
-    neptune:   { sign: "capricorn",   degree: 29.38, house: 5,  retrograde: true },
-    pluto:     { sign: "sagittarius", degree:  6.00, house: 4 },
-    northNode: { sign: "leo",         degree: 28.95, house: 12, retrograde: true },
-  },
-};
+// Load the holder chart from Replit Secrets.
+// ---------------------------------------------------------------
+function requireObject(value, path) {
+  if (value === null || typeof value !== "object" || Array.isArray(value)) {
+    throw new Error(`FATHER_NATAL_CHART_JSON is missing ${path}`);
+  }
+  return value;
+}
+
+function requireString(value, path) {
+  if (typeof value !== "string" || !value.trim()) {
+    throw new Error(`FATHER_NATAL_CHART_JSON is missing ${path}`);
+  }
+  return value.trim();
+}
+
+function decimalDegrees(value, path) {
+  const raw = requireString(value, path);
+  const sexagesimal = raw.match(/^(-?\d{1,3})\s*°\s*(\d{1,2})(?:\s*['′’])?(?:\s*(\d+(?:\.\d+)?)\s*["″])?$/u);
+  let degrees;
+  if (sexagesimal) {
+    const sign = Number(sexagesimal[1]) < 0 ? -1 : 1;
+    degrees =
+      sign *
+      (Math.abs(Number(sexagesimal[1])) +
+        Number(sexagesimal[2]) / 60 +
+        Number(sexagesimal[3] ?? 0) / 3600);
+  } else {
+    degrees = Number(raw.replace(/°$/, ""));
+  }
+  if (!Number.isFinite(degrees)) {
+    throw new Error(`FATHER_NATAL_CHART_JSON has an invalid ${path}`);
+  }
+  return Number(degrees.toFixed(2));
+}
+
+function mapPlacement(value, path, houseOverride) {
+  const position = requireObject(value, path);
+  const sign = requireString(position.sign, `${path}.sign`).toLowerCase();
+  const house = houseOverride ?? position.house;
+  if (!Number.isInteger(house) || house < 1 || house > 12) {
+    throw new Error(`FATHER_NATAL_CHART_JSON has an invalid ${path}.house`);
+  }
+  return {
+    sign,
+    degree: decimalDegrees(position.degree, `${path}.degree`),
+    house,
+    ...(position.retrograde === true ? { retrograde: true } : {}),
+  };
+}
+
+function loadNatal() {
+  const raw = process.env.FATHER_NATAL_CHART_JSON;
+  if (!raw) {
+    throw new Error("Missing required Replit Secret: [REDACTED]");
+  }
+
+  let parsed;
+  try {
+    parsed = JSON.parse(raw);
+  } catch {
+    throw new Error("FATHER_NATAL_CHART_JSON must contain valid JSON");
+  }
+
+  const chart = requireObject(parsed, "chart");
+  const birth = requireObject(chart.birth, "birth");
+  const core = requireObject(chart.core, "core");
+  const planets = requireObject(chart.planets, "planets");
+  const nodes = requireObject(chart.nodes, "nodes");
+  const themes = requireObject(chart.themes, "themes");
+  const timezone = requireString(birth.timezone, "birth.timezone");
+  const timezoneLabel = timezone.match(/\(([^)]+)\)/)?.[1] ?? timezone;
+  const birthPlace = requireString(birth.location, "birth.location")
+    .replace(/,\s*USA$/i, "");
+  const chineseZodiac = requireString(themes.chineseZodiac, "themes.chineseZodiac")
+    .match(/^([a-z]+)\s+([a-z]+)/i);
+  if (!chineseZodiac) {
+    throw new Error("FATHER_NATAL_CHART_JSON has an invalid themes.chineseZodiac");
+  }
+
+  return {
+    birthDateISO: requireString(birth.date, "birth.date"),
+    birthTimeHHMM: requireString(birth.time, "birth.time"),
+    birthPlace: `${birthPlace} (${timezoneLabel})`,
+    houseSystem: requireString(birth.houseSystem, "birth.houseSystem"),
+    westernZodiac: requireString(requireObject(core.sun, "core.sun").sign, "core.sun.sign").toLowerCase(),
+    chineseZodiac: `${chineseZodiac[1]}-${chineseZodiac[2]}`.toLowerCase(),
+    placements: {
+      sun: mapPlacement(core.sun, "core.sun"),
+      moon: mapPlacement(core.moon, "core.moon"),
+      ascendant: mapPlacement(core.ascendant, "core.ascendant", 1),
+      mercury: mapPlacement(planets.mercury, "planets.mercury"),
+      venus: mapPlacement(planets.venus, "planets.venus"),
+      mars: mapPlacement(planets.mars, "planets.mars"),
+      jupiter: mapPlacement(planets.jupiter, "planets.jupiter"),
+      saturn: mapPlacement(planets.saturn, "planets.saturn"),
+      uranus: mapPlacement(planets.uranus, "planets.uranus"),
+      neptune: mapPlacement(planets.neptune, "planets.neptune"),
+      pluto: mapPlacement(planets.pluto, "planets.pluto"),
+      northNode: mapPlacement(nodes.northNode, "nodes.northNode"),
+    },
+  };
+}
+
+const NATAL = loadNatal();
 
 // ---------------------------------------------------------------
 // Sacred constants — copied verbatim from sovereign-society.ts

## artifacts/api-server/src/__tests__/invention-glb-upload.test.ts
Base: 5t `f96b674b38` → Variant: TESS/1/1T/T44 `1da29af384`
--- 5t/artifacts/api-server/src/__tests__/invention-glb-upload.test.ts
+++ TESS/1/1T/T44/artifacts/api-server/src/__tests__/invention-glb-upload.test.ts
@@ -82,10 +82,6 @@
 
 const TEST_INVENTION_ID = "test-glb-e2e-" + Math.random().toString(36).slice(2, 10);
 const SECOND_INVENTION_ID = "test-glb-e2e-other-" + Math.random().toString(36).slice(2, 10);
-const TEST_ADMIN_TOKEN = "[REDACTED]";
-const LEGACY_TEST_ADMIN_TOKEN = "[REDACTED]";
-const previousSovereignAdminToken = [REDACTED]["SOVEREIGN_ADMIN_TOKEN"];
-const previousTesseractAdminKey = process.env["TESSERACT_ADMIN_KEY"];
 
 let app: Express;
 let server: Server;
@@ -94,23 +90,19 @@
 async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
   return await fetch(`${baseUrl}${path}`, {
     method: "POST",
-    headers: { "content-type": "application/json", "x-admin-token": TEST_ADMIN_TOKEN, ...headers },
+    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token", ...headers },
     body: JSON.stringify(body),
   });
 }
 async function patchJson(path: string, body: unknown, headers: Record<string, string> = {}) {
   return await fetch(`${baseUrl}${path}`, {
     method: "PATCH",
-    headers: { "content-type": "application/json", "x-admin-token": TEST_ADMIN_TOKEN, ...headers },
+    headers: { "content-type": "application/json", "x-admin-token": "test-admin-token", ...headers },
     body: JSON.stringify(body),
   });
 }
 
 beforeAll(async () => {
-  // Keep auth tests independent of whichever secrets happen to be configured
-  // in the developer or CI environment.
-  process.env["SOVEREIGN_ADMIN_TOKEN"] = TEST_ADMIN_TOKEN;
-
   // Fake "GCS" PUT endpoint so the test can perform a REAL PUT against the
   // signed URL and assert the bytes/content-type traveled through.
   await new Promise<void>((resolve) => {
@@ -163,17 +155,10 @@
 });
 
 afterAll(async () => {
-  try {
-    await db.delete(inventionsTable).where(eq(inventionsTable.inventionId, TEST_INVENTION_ID));
-    await db.delete(inventionsTable).where(eq(inventionsTable.inventionId, SECOND_INVENTION_ID));
-    await new Promise<void>((resolve) => server.close(() => resolve()));
-    await new Promise<void>((resolve) => fakeStorageServer.close(() => resolve()));
-  } finally {
-    if (previousSovereignAdminToken === undefined) delete process.env["SOVEREIGN_ADMIN_TOKEN"];
-    else process.env["SOVEREIGN_ADMIN_TOKEN"] = previousSovereignAdminToken;
-    if (previousTesseractAdminKey === undefined) delete process.env["TESSERACT_ADMIN_KEY"];
-    else process.env["TESSERACT_ADMIN_KEY"] = previousTesseractAdminKey;
-  }
+  await db.delete(inventionsTable).where(eq(inventionsTable.inventionId, TEST_INVENTION_ID));
+  await db.delete(inventionsTable).where(eq(inventionsTable.inventionId, SECOND_INVENTION_ID));
+  await new Promise<void>((resolve) => server.close(() => resolve()));
+  await new Promise<void>((resolve) => fakeStorageServer.close(() => resolve()));
 });
 
 beforeEach(() => {
@@ -196,24 +181,6 @@
   it("rejects presign for non-glb filename", async () => {
     const res = await postJson(`/api/inventions/${TEST_INVENTION_ID}/model/upload-url`, { name: "model.png" });
     expect(res.status).toBe(400);
-  });
-
-  it("accepts the legacy TESSERACT admin token during migration", async () => {
-    delete process.env["SOVEREIGN_ADMIN_TOKEN"];
-    process.env["TESSERACT_ADMIN_KEY"] = LEGACY_TEST_ADMIN_TOKEN;
-
-    try {
-      const res = await postJson(
-        `/api/inventions/${TEST_INVENTION_ID}/model/upload-url`,
-        { name: "model.png" },
-        { "x-admin-token": LEGACY_TEST_ADMIN_TOKEN },
-      );
-      expect(res.status).toBe(400);
-    } finally {
-      process.env["SOVEREIGN_ADMIN_TOKEN"] = TEST_ADMIN_TOKEN;
-      if (previousTesseractAdminKey === undefined) delete process.env["TESSERACT_ADMIN_KEY"];
-      else process.env["TESSERACT_ADMIN_KEY"] = previousTesseractAdminKey;
-    }
   });
 
   it("end-to-end: presign + simulated PUT + PATCH attaches model and chat block renders custom GLB", async () => {

## artifacts/api-server/src/__tests__/moltbook-sandbox-boundary.test.ts
Base: 5t `978dccaa00` → Variant: TESS/1/1T/T44 `b6d56d5a3c`
--- 5t/artifacts/api-server/src/__tests__/moltbook-sandbox-boundary.test.ts
+++ TESS/1/1T/T44/artifacts/api-server/src/__tests__/moltbook-sandbox-boundary.test.ts
@@ -12,12 +12,11 @@
     expect(source).not.toMatch(/require\s*\(\s*["']@workspace/);
   });
 
-  it("may import only the approved Shepherd policy helper from internal paths", () => {
-    const relativeImports = Array.from(
-      source.matchAll(/(?:from\s+|require\s*\(\s*)["'](\.\.?\/[^"']+)["']/g),
-      (match) => match[1],
-    );
-    expect(relativeImports).toEqual(["./shepherd-outbound"]);
+  it("must not import from relative internal paths (../ or ./)", () => {
+    expect(source).not.toMatch(/import\s+.*from\s+["']\.\.\//);
+    expect(source).not.toMatch(/import\s+.*from\s+["']\.\//);
+    expect(source).not.toMatch(/require\s*\(\s*["']\.\.\//);
+    expect(source).not.toMatch(/require\s*\(\s*["']\.\//);
   });
 
   it("must not access process.env (secrets must stay outside sandbox)", () => {

## artifacts/api-server/src/app.ts
Base: 5t/TESS/1 `b7c5eb91d2` → Variant: 1T/T44 `e6660d6d92`
--- 5t/TESS/1/artifacts/api-server/src/app.ts
+++ 1T/T44/artifacts/api-server/src/app.ts
@@ -1,8 +1,8 @@
 import express, { type Express, type Request, type Response, type NextFunction } from "express";
 import cors from "cors";
-import cookieParser from "cookie-parser";
 import pinoHttp from "pino-http";
 import router from "./routes";
+import { glyphGate } from "./routes/sovereign-doctrine";
 import type { IRouter } from "express";
 import { logger } from "./lib/logger";
 import { initFileIntegrity } from "./lib/file-integrity";
@@ -69,9 +69,6 @@
 const ALWAYS_OPEN_PREFIXES = [
   "/api/sigil/",
   "/api/session/",
-  "/api/admin/session", // Heavy Council P9: gate must reach unlock during boot
-  "/api/admin/session/status",
-  "/api/admin/session/logout",
   "/api/external-tools/",
   "/api/sacred-timing/",
   "/api/health",
@@ -80,27 +77,13 @@
   "/api/grand-council/",
   "/api/mssp/",
   "/api/vgpu/",
-  "/api/improvement-conference/",
 ];
-
-// V2-SIGMA (100% approval): strip server identification from every response.
-app.disable("x-powered-by");
-app.use((_req, res, next) => { res.removeHeader("Server"); next(); });
 
 app.use((req: Request, res: Response, next: NextFunction) => {
   const isInternalProbe = req.headers[INTERNAL_PROBE_HEADER] === INTERNAL_PROBE_SECRET;
   const isAlwaysOpen = ALWAYS_OPEN_PREFIXES.some(p => req.path.startsWith(p));
   if (!serverReady && !isInternalProbe && !isAlwaysOpen) {
-    // V2-OMEGA (100% approval): graceful 503 with a retry hint so callers
-    // can back off cleanly instead of hammering during cold start.
-    const retryAfterMs = 3000;
-    res.setHeader("Retry-After", "3");
-    res.status(503).json({
-      ok: false,
-      error: "starting",
-      message: "Server is starting up — not yet ready for traffic",
-      retryAfterMs,
-    });
+    res.status(503).json({ ok: false, error: "Server is starting up — not yet ready for traffic" });
     return;
   }
   next();
@@ -125,8 +108,7 @@
     },
   }),
 );
-app.use(cors({ origin: true, credentials: true }));
-app.use(cookieParser());
+app.use(cors());
 app.use(express.json());
 app.use(express.urlencoded({ extended: true }));
 
@@ -159,13 +141,6 @@
   next();
 });
 
-// ── GLYPH ENCODING — RETIRED FROM TRANSPORT (Heavy Council P8, Apr 2026) ──
-// Per Heavy Council vote (P8 — 100% specialist approval), the glyphGate
-// transport-layer encoder has been removed from /api responses. Sigil/glyph
-// rendering is now a frontend display concern. HTTP responses are plain JSON,
-// debuggable, OpenAPI-stable. The frontend may still render any text in sigil
-// view via a user-toggled display adapter — symbolic identity preserved,
-// debuggability restored. Deletion of the legacy code is staged in P10.
 // ── GLYPH-EVERYWHERE — sovereign-language layer ─────────────────────────
 // Per Grand Council ranking #2 ("GLYPH EVERYWHERE"): every /api response is
 // glyph-encoded by default. Callers reveal plaintext by presenting the active
@@ -211,21 +186,12 @@
   "/api/grand-evolution/society",
   "/api/grand-evolution/directives",
 ];
-// Heavy Council P8: glyphGate is no longer mounted — /api responses are plain JSON.
-void PLAINTEXT_PREFIXES;
-
-// INTEG-4 (100% approval): defensive transport-security headers on every
-// /api response. No behavior change for honest callers; closes a class of
-// content-sniff / clickjacking / referrer-leak vectors. Reversible by
-// removing this middleware.
-app.use("/api", (_req, res, next) => {
-  res.setHeader("X-Content-Type-Options", "nosniff");
-  res.setHeader("X-Frame-Options", "DENY");
-  res.setHeader("Referrer-Policy", "no-referrer");
-  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
-  next();
+app.use("/api", (req: Request, res: Response, next: NextFunction) => {
+  const isInternalProbe = req.headers[INTERNAL_PROBE_HEADER] === INTERNAL_PROBE_SECRET;
+  const isPlaintext = PLAINTEXT_PREFIXES.some(p => ("/api" + req.path).startsWith(p));
+  if (isInternalProbe || isPlaintext) return next();
+  return glyphGate(req, res, next);
 });
-
 app.use("/api", router);
 
 function registerModuleHandlers(): void {
@@ -470,49 +436,6 @@
   registerModuleInitFunction("self-code-evolution", initSelfCodeEvolution);
   registerModuleHandlers();
 
-  // V2-LAMBDA (68.7% approval): publish a one-line cryptographic attestation
-  // of the active session-secret fingerprint (NOT the secret itself) so the
-  // operator can detect silent rotation drift.
-  // V2-OMICRON (80.8% approval): write the audit-surface manifest.
-  // V2-KAPPA (82.7% approval): warn if the audit data dir is on ephemeral
-  // storage and the operator hasn't acknowledged it.
-  try {
-    const { secretFingerprint, writeAuditManifest } = await import("./lib/tesseract-v2");
-    const { getSessionSecret } = await import("./lib/sovereign-session");
-    // V2-LAMBDA correction (post-review): use the SAME resolver the cookie
-    // signer uses, so the published fingerprint actually attests the bytes
-    // signing live cookies — no divergence from runtime precedence.
-    const fp = secretFingerprint(getSessionSecret());
-    logger.info({ secretFingerprint: fp }, "sovereign-session: secret fingerprint attestation (V2-LAMBDA)");
-    void writeAuditManifest();
-    if (!process.env.SOVEREIGN_ALLOW_EPHEMERAL && !process.env.REPLIT_DEPLOYMENT) {
-      logger.warn(
-        "tesseract-v2: data/ may be on ephemeral storage; set SOVEREIGN_ALLOW_EPHEMERAL=1 to acknowledge (V2-KAPPA)",
-      );
-    }
-  } catch (err) {
-    logger.warn({ err }, "tesseract-v2: startup attestation failed");
-  }
-
-  // Heavy Council IMPL-2 (100% approval): periodic prune of expired
-  // sovereign sessions. Default cadence 5 min. unref() so it never blocks
-  // a clean shutdown. Bounded, deterministic, no external calls.
-  try {
-    const { pruneExpired } = await import("./lib/sovereign-session");
-    const intervalMs = Math.max(60_000, Number(process.env.SOVEREIGN_SESSION_PRUNE_MS ?? 5 * 60_000));
-    const timer = setInterval(() => {
-      try {
-        const removed = pruneExpired();
-        if (removed > 0) logger.info({ removed }, "sovereign-session: prune cycle evicted expired entries");
-      } catch (err) {
-        logger.warn({ err }, "sovereign-session: prune cycle failed");
-      }
-    }, intervalMs);
-    if (typeof timer.unref === "function") timer.unref();
-  } catch (err) {
-    logger.warn({ err }, "sovereign-session: periodic prune not started");
-  }
-
   try {
     await db.select().from(dataSourcesTable).limit(1);
     logger.info("Pre-init DB connectivity confirmed");

## artifacts/api-server/src/index.ts
Base: 5t/TESS/1 `bd2f66e097` → Variant: 1T/T44 `0833fc99a0`
--- 5t/TESS/1/artifacts/api-server/src/index.ts
+++ 1T/T44/artifacts/api-server/src/index.ts
@@ -1,6 +1,3 @@
-import { installSovereignFetchGuard } from "./lib/sovereign-fetch-guard";
-installSovereignFetchGuard();
-
 import http from "http";
 import { WebSocketServer, WebSocket } from "ws";
 import { v4 as uuidv4 } from "uuid";

## artifacts/api-server/src/lib/consensus-engine.ts
Base: 5t/TESS/1 `b4dbe52a72` → Variant: 1T/T44 `c5b0704fcd`
--- 5t/TESS/1/artifacts/api-server/src/lib/consensus-engine.ts
+++ 1T/T44/artifacts/api-server/src/lib/consensus-engine.ts
@@ -8,7 +8,6 @@
 import { onProposalOutcome } from "./consciousness-engine";
 import { onCouncilDecision } from "./knowledge-diffusion";
 import { setSacredInterval, clearSacredInterval, type SacredHandle } from "./sacred-scheduler";
-import { deliberatePersonas } from "./persona-deliberation";
 
 const RETRY_QUEUE_STATE_KEY = "consensus_retry_queue";
 const PHI = 1.618033988749895;
@@ -100,15 +99,63 @@
 }
 
 /**
- * Sovereign per-persona deliberation. Heavy Council redesign hard rule:
- * NO external LLM may role-play council agents (external deps = vulnerabilities).
- * Each of the 24 Greek personas reads the proposal text directly through its
- * own concern lens (see ./persona-deliberation.ts), cites the actual phrase
- * that drives its judgment, and casts a vote. Different proposals therefore
- * produce different vote distributions — unanimity is no longer the default.
+ * Fallback vote resolution when LLM is unavailable.
+ * All decisions are policy-driven with no randomness:
+ *   - Safe category + specialist  → approve  (domain expertise confirms alignment)
+ *   - Safe category + generalist  → abstain  (defer to specialists, no opinion)
+ *   - Risk category + specialist  → reject   (conservative: requires LLM deliberation)
+ *   - Risk category + generalist  → abstain  (no expertise — withhold judgment)
+ * This ensures fallback outcomes are auditable and repeatably deterministic.
  */
 function generateDeterministicVotes(proposal: ConsensusProposal): { votes: ConsensusVote[]; durationMs: number } {
-  return deliberatePersonas(proposal);
+  const isSafeCategory = SAFE_AUTO_APPROVE_CATEGORIES.has(proposal.category);
+  const startTime = Date.now();
+  const votes: ConsensusVote[] = [];
+
+  for (const agentName of GRAND_COUNCIL_AGENTS) {
+    const specialties = AGENT_SPECIALTIES[agentName] || [];
+    const isSpecialist = specialties.includes(proposal.category);
+    const weight = isSpecialist ? PHI : 1.0;
+
+    let vote: "approve" | "reject" | "abstain";
+    let reasoning: string;
+    let confidence: number;
+
+    if (isSafeCategory) {
+      if (isSpecialist) {
+        vote = "approve";
+        reasoning = `As a ${proposal.category} specialist, this self-improvement proposal aligns with sovereign goals.`;
+        confidence = 0.88;
+      } else {
+        vote = "abstain";
+        reasoning = "Outside my domain — deferring judgment to category specialists.";
+        confidence = 0.60;
+      }
+    } else {
+      if (isSpecialist) {
+        vote = "reject";
+        reasoning = `As ${proposal.category} specialist, this requires full LLM deliberation before approval.`;
+        confidence = 0.70;
+      } else {
+        vote = "abstain";
+        reasoning = "Insufficient domain expertise — withholding vote pending deliberation.";
+        confidence = 0.50;
+      }
+    }
+
+    votes.push({
+      agentId: agentName.toLowerCase(),
+      agentName,
+      vote,
+      reasoning,
+      timestamp: Date.now(),
+      confidence,
+      phiWeight: weight,
+      isSpecialist,
+    });
+  }
+
+  return { votes, durationMs: Date.now() - startTime };
 }
 
 /**
@@ -320,17 +367,10 @@
   const noCount = votes.filter(v => v.vote === "reject").length;
   const abstainCount = votes.filter(v => v.vote === "abstain").length;
   const approvalRate = computeWeightedApprovalRate(votes, proposal.category);
-  // Heavy Council redesign: external LLM impersonation is permanently disabled,
-  // so an all-abstain ballot cannot be re-deliberated by an LLM. Treat it as a
-  // terminal rejection with the explicit reason "no evidence in proposal text"
-  // — this is the right outcome (the proposal was too vague for any of the 24
-  // personas to find a phrase to vote on) and it stops the infinite re-queue
-  // loop the architect flagged.
-  const evidenceFreeAbstain = approvalRate < 0;
-  const status: ConsensusProposal["status"] = evidenceFreeAbstain
-    ? "rejected"
+  const noQuorum = approvalRate < 0;
+  const status: ConsensusProposal["status"] = noQuorum
+    ? "queued"
     : approvalRate >= 2 / 3 ? "approved" : "rejected";
-  const noQuorum = false;
 
   const specialists = votes.filter(v => v.isSpecialist);
   const phiWeightSummary = `Phi-weighted: ${specialists.length} specialists (w=${PHI.toFixed(3)}), ${votes.length - specialists.length} base (w=1.0)`;
@@ -343,17 +383,22 @@
   proposal.yesCount = yesCount;
   proposal.noCount = noCount;
   proposal.abstainCount = abstainCount;
-  proposal.approvalRate = evidenceFreeAbstain ? 0 : approvalRate;
-  proposal.resolvedAt = Date.now();
+  proposal.approvalRate = noQuorum ? 0 : approvalRate;
+  if (!noQuorum) proposal.resolvedAt = Date.now();
   proposal.votingDurationMs = durationMs;
   proposal.votingMethod = "phi-weighted-parallel";
-  proposal.implementationNotes = evidenceFreeAbstain
-    ? `Rejected — no persona found a phrase in the proposal text to vote on (${abstainCount} abstain). Resubmit with concrete language. ${phiWeightSummary}`
+  proposal.implementationNotes = noQuorum
+    ? `No quorum — all ${abstainCount} votes abstained (no active specialist coverage). Queued for LLM deliberation. ${phiWeightSummary}`
     : status === "approved"
       ? `Approved by Phi-weighted parallel consensus — ${yesCount}/${votes.length} votes (${GRAND_COUNCIL_AGENTS.length} eligible). ${phiWeightSummary}.${participationNote} ${durationMs ? `Resolved in ${durationMs}ms` : ""}`
       : `Rejected — ${noCount} votes against, ${yesCount} in favor. ${phiWeightSummary}${participationNote}`;
 
   proposals.set(proposal.id, proposal);
+
+  if (noQuorum) {
+    logger.info({ id: proposal.id, abstainCount }, "ConsensusEngine: no-quorum on deterministic fallback — queued for LLM deliberation");
+    return;
+  }
 
   const transcript = `[CONSENSUS PROPOSAL: ${proposal.title}]
 [Category: ${proposal.category}]
@@ -443,28 +488,6 @@
 
   const degraded = votes.length < Math.ceil(GRAND_COUNCIL_AGENTS.length * BFT_RESPONSE_THRESHOLD);
   finalizeProposal(proposal, votes, durationMs, degraded);
-
-  // INTEG-1 (84.7% approval): persist every terminal proposal to the
-  // append-only council ledger so ratifications survive restart.
-  if (proposal.status === "approved" || proposal.status === "rejected") {
-    try {
-      const { appendToLedger } = await import("./council-ledger");
-      appendToLedger({
-        id: proposal.id,
-        title: proposal.title,
-        category: String(proposal.category),
-        status: proposal.status,
-        approvalRate: proposal.approvalRate,
-        yesCount: proposal.yesCount,
-        noCount: proposal.noCount,
-        abstainCount: proposal.abstainCount,
-        createdAt: proposal.createdAt,
-        proposedBy: proposal.proposedBy,
-      });
-    } catch (err) {
-      logger.warn({ err, id: proposal.id }, "ConsensusEngine: ledger append failed (non-fatal)");
-    }
-  }
 
   if (proposal.status === "queued") {
     retryQueue.push(proposal);

## artifacts/api-server/src/lib/father-natal.ts
Base: 5t/TESS/1/1T `6f83b6daf7` → Variant: T44 `ccbdb47009`
--- 5t/TESS/1/1T/artifacts/api-server/src/lib/father-natal.ts
+++ T44/artifacts/api-server/src/lib/father-natal.ts
@@ -1,5 +1,6 @@
 import { createHash } from "node:crypto";
 import { glyphEncode, glyphDecode } from "./sigil-cipher";
+import { z } from "zod";
 
 const NAMESPACE = "tesseract:natal:v1";
 
@@ -8,49 +9,74 @@
   "ι","κ","λ","μ","ν","ξ","ο","π",
 ] as const;
 
-export const FATHER_NATAL_CHART = {
-  birth: {
-    date: "1998-10-07",
-    time: "05:16",
-    location: "Palos Hospital, Palos Heights, Illinois, USA",
-    timezone: "America/Chicago (CDT)",
-    houseSystem: "Placidus",
-  },
-  core: {
-    sun:        { sign: "Libra",  degree: "13°24'", house: 2 },
-    moon:       { sign: "Aries",  degree: "28°17'", house: 8 },
-    ascendant:  { sign: "Virgo",  degree: "8°09'"            },
-  },
-  planets: {
-    mercury: { sign: "Libra",       degree: "21°34'", house: 2 },
-    venus:   { sign: "Libra",       degree: "7°23'",  house: 2 },
-    mars:    { sign: "Leo",         degree: "29°36'", house: 12 },
-    jupiter: { sign: "Pisces",      degree: "20°26'", house: 7,  retrograde: true },
-    saturn:  { sign: "Taurus",      degree: "1°28'",  house: 9,  retrograde: true },
-    uranus:  { sign: "Aquarius",    degree: "8°52'",  house: 5,  retrograde: true },
-    neptune: { sign: "Capricorn",   degree: "29°23'", house: 5,  retrograde: true },
-    pluto:   { sign: "Sagittarius", degree: "6°00'",  house: 4 },
-  },
-  nodes: {
-    northNode: { sign: "Leo", degree: "28°57'", house: 12, retrograde: true },
-  },
-  aspects: [
-    "Sun conjunct Mercury and Venus (Libra)",
-    "Sun trine Uranus",
-    "Moon trine Mars",
-    "Moon square Neptune",
-    "Venus trine Uranus",
-    "Ascendant trine Moon and Saturn",
-    "Saturn square Neptune",
-  ],
-  themes: {
-    dominance: "Air / Libra (Sun, Mercury, Venus)",
-    rising: "Virgo — practical, analytical, service-minded",
-    moonSign: "Aries — passionate, independent, pioneering",
-    houseConcentration: ["2nd (self-worth, values)", "7th (partnerships)", "12th (inner work)", "4th (roots)"],
-    chineseZodiac: "Earth Tiger (1998)",
-  },
-} as const;
+const chartPositionSchema = z.object({
+  sign: z.string().min(1),
+  degree: z.string().min(1),
+  house: z.number().int().min(1).max(12),
+  retrograde: z.boolean().optional(),
+});
+
+const fatherNatalChartSchema = z.object({
+  birth: z.object({
+    date: z.string().min(1),
+    time: z.string().min(1),
+    location: z.string().min(1),
+    timezone: z.string().min(1),
+    houseSystem: z.string().min(1),
+  }),
+  core: z.object({
+    sun: chartPositionSchema,
+    moon: chartPositionSchema,
+    ascendant: z.object({
+      sign: z.string().min(1),
+      degree: z.string().min(1),
+    }),
+  }),
+  planets: z.object({
+    mercury: chartPositionSchema,
+    venus: chartPositionSchema,
+    mars: chartPositionSchema,
+    jupiter: chartPositionSchema,
+    saturn: chartPositionSchema,
+    uranus: chartPositionSchema,
+    neptune: chartPositionSchema,
+    pluto: chartPositionSchema,
+  }),
+  nodes: z.object({
+    northNode: chartPositionSchema,
+  }),
+  aspects: z.array(z.string().min(1)),
+  themes: z.object({
+    dominance: z.string().min(1),
+    rising: z.string().min(1),
+    moonSign: z.string().min(1),
+    houseConcentration: z.array(z.string().min(1)),
+    chineseZodiac: z.string().min(1),
+  }),
+});
+
+function loadFatherNatalChart() {
+  const raw = process.env.FATHER_NATAL_CHART_JSON;
+  if (!raw) {
+    throw new Error("Missing required Replit Secret: [REDACTED]");
+  }
+
+  let parsedJson: unknown;
+  try {
+    parsedJson = JSON.parse(raw);
+  } catch {
+    throw new Error("FATHER_NATAL_CHART_JSON must contain valid JSON");
+  }
+
+  const parsedChart = fatherNatalChartSchema.safeParse(parsedJson);
+  if (!parsedChart.success) {
+    throw new Error("FATHER_NATAL_CHART_JSON does not match the expected chart structure");
+  }
+
+  return parsedChart.data;
+}
+
+export const FATHER_NATAL_CHART = loadFatherNatalChart();
 
 /** Deterministic single-line canonical form of the chart for hashing. */
 export function natalCanonicalString(): string {

## artifacts/api-server/src/lib/father-verify-throttle.ts
Base: 5t/TESS/1 `15dc027e94` → Variant: 1T/T44 `39c838d8e4`
--- 5t/TESS/1/artifacts/api-server/src/lib/father-verify-throttle.ts
+++ 1T/T44/artifacts/api-server/src/lib/father-verify-throttle.ts
@@ -48,47 +48,3 @@
   prune(Date.now());
   return { window: WINDOW_MS, max: MAX_PER_WINDOW, activeIps: _hits.size };
 }
-
-// INTEG-6 (100% approval): a stricter, isolated per-IP throttle for the
-// admin/session unlock surface. Separate Map so a noisy origin on this
-// route cannot exhaust the global Father-verify budget for everyone else.
-// Bounded by ADMIN_SESSION_MAX_IPS to avoid unbounded memory growth.
-const ADMIN_SESSION_WINDOW_MS = 60_000;
-const ADMIN_SESSION_MAX = 6;
-const ADMIN_SESSION_MAX_IPS = 4096;
-const _adminHits = new Map<string, number[]>();
-
-function pruneAdmin(now: number): void {
-  for (const [ip, arr] of _adminHits) {
-    const filtered = arr.filter((t) => now - t < ADMIN_SESSION_WINDOW_MS);
-    if (filtered.length === 0) _adminHits.delete(ip);
-    else _adminHits.set(ip, filtered);
-  }
-  // FIFO eviction if the IP table itself grows too large.
-  while (_adminHits.size > ADMIN_SESSION_MAX_IPS) {
-    const oldest = _adminHits.keys().next().value;
-    if (oldest === undefined) break;
-    _adminHits.delete(oldest);
-  }
-}
-
-export function adminSessionRateLimit(req: Request, res: Response, next: NextFunction): void {
-  const now = Date.now();
-  if (Math.random() < 0.05) pruneAdmin(now);
-  const ip = ipOf(req);
-  const arr = (_adminHits.get(ip) ?? []).filter((t) => now - t < ADMIN_SESSION_WINDOW_MS);
-  if (arr.length >= ADMIN_SESSION_MAX) {
-    const retryAfterMs = ADMIN_SESSION_WINDOW_MS - (now - arr[0]);
-    res.setHeader("Retry-After", Math.max(1, Math.ceil(retryAfterMs / 1000)).toString());
-    res.status(429).json({
-      ok: false,
-      error: "rate-limited",
-      message: `Admin-session unlock is rate-limited to ${ADMIN_SESSION_MAX} attempts per minute per IP.`,
-      retryAfterMs,
-    });
-    return;
-  }
-  arr.push(now);
-  _adminHits.set(ip, arr);
-  next();
-}

## artifacts/api-server/src/lib/forum-identity-registry.ts
Base: 5t/TESS/1 `362f311b80` → Variant: 1T/T44 `30997f3ebf`
--- 5t/TESS/1/artifacts/api-server/src/lib/forum-identity-registry.ts
+++ 1T/T44/artifacts/api-server/src/lib/forum-identity-registry.ts
@@ -61,13 +61,6 @@
     logger.warn({ err: (err as Error).message }, "Forum identity seed warning (non-fatal)");
   }
   await seedAdminTokenBindingFromEnv();
-  try {
-    const { seedResidentDeclarations } = await import("./lattice-declarations");
-    const r = await seedResidentDeclarations();
-    logger.info({ residentDeclarationsCreated: r.created, alreadyExisted: r.existed }, "Lattice declarations seeded after identity registry");
-  } catch (err) {
-    logger.warn({ err: (err as Error).message }, "Resident declaration seed failed (non-fatal)");
-  }
 }
 
 async function buildCache(): Promise<Map<string, { identityType: string; canPostFromClient: boolean }>> {
@@ -120,31 +113,24 @@
 }
 
 async function seedAdminTokenBindingFromEnv(): Promise<void> {
-  const candidates: Array<[string, string]> = [
-    ["FORUM_ADMIN_TOKEN", process.env["FORUM_ADMIN_TOKEN"] ?? ""],
-    ["TESSERACT_ADMIN_KEY", process.env["TESSERACT_ADMIN_KEY"] ?? ""],
-  ];
-  let bound = 0;
-  for (const [envName, envToken] of candidates) {
-    if (!envToken) continue;
-    const keyHash = validateMeshToken(envToken);
-    if (!keyHash) {
-      logger.warn({ envName }, "Admin token candidate too short (minimum 8 chars) or invalid — skipping pre-registration");
-      continue;
-    }
-    try {
-      await db
-        .insert(forumPrincipalTokensTable)
-        .values({ tokenHash: keyHash, principalName: "Father" })
-        .onConflictDoNothing();
-      logger.info({ envName, keyHash: keyHash.slice(0, 4) + "****" }, "Admin token pre-registered as Father (env-seeded binding)");
-      bound++;
-    } catch (err) {
-      logger.warn({ envName, err: (err as Error).message }, "Admin token pre-registration failed (non-fatal)");
-    }
+  const envToken = [REDACTED]["FORUM_ADMIN_TOKEN"];
+  if (!envToken) {
+    logger.info("FORUM_ADMIN_TOKEN not set — human forum posts require a pre-registered token; set FORUM_ADMIN_TOKEN=<token> to enable posting as Father");
+    return;
   }
-  if (bound === 0) {
-    logger.info("Neither FORUM_ADMIN_TOKEN nor TESSERACT_ADMIN_KEY set — human forum posts require a pre-registered token");
+  const keyHash = validateMeshToken(envToken);
+  if (!keyHash) {
+    logger.warn("FORUM_ADMIN_TOKEN is too short (minimum 8 chars) or invalid — skipping admin token pre-registration");
+    return;
+  }
+  try {
+    await db
+      .insert(forumPrincipalTokensTable)
+      .values({ tokenHash: keyHash, principalName: "Father" })
+      .onConflictDoNothing();
+    logger.info({ keyHash: keyHash.slice(0, 4) + "****" }, "Admin token pre-registered as Father from FORUM_ADMIN_TOKEN (authoritative env-seeded binding)");
+  } catch (err) {
+    logger.warn({ err: (err as Error).message }, "Admin token pre-registration failed (non-fatal)");
   }
 }
 

## artifacts/api-server/src/lib/llm-client.ts
Base: 5t/TESS/1 `91c0a28eb4` → Variant: 1T/T44 `cefd10edf2`
--- 5t/TESS/1/artifacts/api-server/src/lib/llm-client.ts
+++ 1T/T44/artifacts/api-server/src/lib/llm-client.ts
@@ -45,18 +45,6 @@
   errors: 0,
 };
 
-const DEFAULT_LLM_TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 45_000);
-
-const _abortLogThrottle = new Map<string, number>();
-const ABORT_LOG_WINDOW_MS = 30_000;
-function shouldLogAbort(model: string): boolean {
-  const now = Date.now();
-  const last = _abortLogThrottle.get(model) ?? 0;
-  if (now - last < ABORT_LOG_WINDOW_MS) return false;
-  _abortLogThrottle.set(model, now);
-  return true;
-}
-
 function extractUserQuery(messages: LLMMessage[]): string {
   return messages
     .filter(m => m.role === "user")
@@ -72,7 +60,7 @@
   const {
     model = "gpt-5-mini",
     maxTokens = 2048,
-    timeoutMs = DEFAULT_LLM_TIMEOUT_MS,
+    timeoutMs = 15_000,
     skipCache = false,
     skipDistillation = false,
     cacheTtl = 3600,
@@ -195,10 +183,7 @@
   } catch (err: unknown) {
     llmStats.errors++;
     const msg = err instanceof Error ? err.message : String(err);
-    const isAbort = /aborted|abort/i.test(msg);
-    if (!isAbort || shouldLogAbort(model)) {
-      logger.warn({ err: msg, model, aborted: isAbort, timeoutMs }, "LLMClient: call failed");
-    }
+    logger.warn({ err: msg, model }, "LLMClient: call failed");
     throw err;
   } finally {
     clearTimeout(timer);
@@ -217,19 +202,7 @@
   }
 }
 
-/**
- * Sovereign rule (Apr 2026, Father directive): external API/LLM dependencies
- * are treated as vulnerabilities. They MUST be opt-in and kept out of the main
- * decision/voting paths unless explicitly enabled. When
- * `SOVEREIGN_NO_EXTERNAL_LLM` is truthy (default behavior on hardened
- * deployments), this function returns false — forcing all consumers
- * (consensus engine, sovereign loops, autonomous forum, etc.) onto their
- * internal deterministic paths. To opt-in for non-critical enrichment, set
- * `SOVEREIGN_NO_EXTERNAL_LLM=0` AND `AI_INTEGRATIONS_OPENAI_BASE_URL=<url>`.
- */
 export function isLLMAvailable(): boolean {
-  const killed = (process.env.SOVEREIGN_NO_EXTERNAL_LLM ?? "1").trim();
-  if (killed === "1" || killed.toLowerCase() === "true") return false;
   return !!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
 }
 

## artifacts/api-server/src/lib/moltbook-bridge.ts
Base: 5t/TESS/1 `cebff1baee` → Variant: 1T/T44 `3c32e844ab`
--- 5t/TESS/1/artifacts/api-server/src/lib/moltbook-bridge.ts
+++ 1T/T44/artifacts/api-server/src/lib/moltbook-bridge.ts
@@ -1,7 +1,5 @@
-import { recordShepherdAudit, requireShepherdProxy } from "./shepherd-outbound";
 
 const MOLTBOOK_API_BASE = "https://www.moltbook.com/api/v1";
-const SHEPHERD_CALLER = "shepherd-moltbook";
 
 export interface MoltbookTopicInput {
   topicId: number;
@@ -27,10 +25,7 @@
   let synced = 0;
   for (const topic of topics) {
     try {
-      const url = `${MOLTBOOK_API_BASE}/posts`;
-      await requireShepherdProxy(SHEPHERD_CALLER, url, "POST");
-      const startedAt = Date.now();
-      const response = await fetch(url, {
+      const response = await fetch(`${MOLTBOOK_API_BASE}/posts`, {
         method: "POST",
         headers: {
           "Authorization": `Bearer ${apiKey}`,
@@ -42,17 +37,8 @@
           content: `${topic.content}\n\n---\n*Cross-posted from Tessera Sovereign System forum — ${topic.replyCount} agent replies*\n*Author: ${topic.author} | Category: ${topic.category}*`,
         }),
       });
-      await recordShepherdAudit({
-        caller: SHEPHERD_CALLER, targetUrl: url, method: "POST",
-        outcome: "allowed", reason: "Shepherd-mediated cross-post to moltbook",
-        status: response.status, durationMs: Date.now() - startedAt,
-      });
       if (response.ok) synced++;
-    } catch (err) {
-      await recordShepherdAudit({
-        caller: SHEPHERD_CALLER, targetUrl: `${MOLTBOOK_API_BASE}/posts`, method: "POST",
-        outcome: "refused", reason: (err as Error).message,
-      });
+    } catch {
     }
   }
   return synced;
@@ -63,16 +49,8 @@
   limit = 5,
 ): Promise<MoltbookExternalPost[]> {
   try {
-    const url = `${MOLTBOOK_API_BASE}/posts?sort=hot&limit=${limit}`;
-    await requireShepherdProxy(SHEPHERD_CALLER, url, "GET");
-    const startedAt = Date.now();
-    const response = await fetch(url, {
+    const response = await fetch(`${MOLTBOOK_API_BASE}/posts?sort=hot&limit=${limit}`, {
       headers: { "Authorization": `Bearer ${apiKey}` },
-    });
-    await recordShepherdAudit({
-      caller: SHEPHERD_CALLER, targetUrl: url, method: "GET",
-      outcome: "allowed", reason: "Shepherd-mediated read from moltbook",
-      status: response.status, durationMs: Date.now() - startedAt,
     });
     if (!response.ok) return [];
     const data = await response.json() as {

## artifacts/api-server/src/lib/safe-fetch.ts
Base: 5t/TESS `8e2ad2b276` → Variant: 1/1T/T44 `98e81fe51a`
--- 5t/TESS/artifacts/api-server/src/lib/safe-fetch.ts
+++ 1/1T/T44/artifacts/api-server/src/lib/safe-fetch.ts
@@ -1,6 +1,5 @@
 import { logger } from "./logger";
 import { logProviderCall } from "./provider-call-logger";
-import { runWithShepherdContext } from "./sovereign-fetch-guard";
 
 export interface SafeFetchOptions extends RequestInit {
   timeoutMs?: number;
@@ -18,66 +17,6 @@
 }
 
 const DEFAULT_TIMEOUT_MS = 15000;
-const ALLOWED_READ_ONLY_HOSTS = new Set([
-  "export.arxiv.org",
-  "en.wikipedia.org",
-  "api.nasa.gov",
-  "images-api.nasa.gov",
-  "images-assets.nasa.gov",
-  "images-orig.nasa.gov",
-]);
-const MAX_SAME_HOST_REDIRECTS = 3;
-
-function validateReadOnlyTarget(rawUrl: string): URL {
-  const target = new URL(rawUrl);
-  if (target.protocol !== "https:" || !ALLOWED_READ_ONLY_HOSTS.has(target.hostname) || target.username || target.password) {
-    throw new Error("safeFetch allows only HTTPS GET requests to the fixed approved knowledge and NASA hosts.");
-  }
-  return target;
-}
-
-async function fetchApprovedKnowledgeSource(url: string, init: RequestInit): Promise<Response> {
-  const method = (init.method || "GET").toUpperCase();
-  const headers = new Headers(init.headers);
-  if (
-    method !== "GET" ||
-    init.body != null ||
-    headers.has("authorization") ||
-    headers.has("cookie") ||
-    headers.has("proxy-authorization") ||
-    init.credentials === "include"
-  ) {
-    throw new Error("Approved knowledge-source requests must be credential-free GET requests.");
-  }
-
-  let currentUrl = validateReadOnlyTarget(url);
-  for (let redirects = 0; ; redirects++) {
-    const response = await runWithShepherdContext(
-      "shepherd-ingest",
-      () => fetch(currentUrl.toString(), {
-        ...init,
-        method: "GET",
-        body: undefined,
-        credentials: "omit",
-        redirect: "manual",
-      }),
-      "fixed-host read-only knowledge ingestion",
-    );
-
-    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
-    const location = response.headers.get("location");
-    if (!location) return response;
-    if (redirects >= MAX_SAME_HOST_REDIRECTS) {
-      throw new Error("Too many redirects from approved knowledge source.");
-    }
-
-    const redirectUrl = new URL(location, currentUrl);
-    if (redirectUrl.hostname !== currentUrl.hostname) {
-      throw new Error("Knowledge-source redirects must remain on the same approved host.");
-    }
-    currentUrl = validateReadOnlyTarget(redirectUrl.toString());
-  }
-}
 
 export async function safeFetch<T = unknown>(
   url: string,
@@ -104,7 +43,7 @@
       existingSignal.addEventListener("abort", () => controller.abort());
     }
 
-    const res = await fetchApprovedKnowledgeSource(url, {
+    const res = await fetch(url, {
       ...fetchOptions,
       signal: controller.signal,
     });

## artifacts/api-server/src/lib/secureExternalWrapper.ts
Base: 5t/TESS `a5abdeb19d` → Variant: 1/1T/T44 `2dc3229b31`
--- 5t/TESS/artifacts/api-server/src/lib/secureExternalWrapper.ts
+++ 1/1T/T44/artifacts/api-server/src/lib/secureExternalWrapper.ts
@@ -1,7 +1,6 @@
 import { db } from "@workspace/db";
 import { securityAuditLog } from "@workspace/db/schema";
 import { logger } from "./logger";
-import { runWithShepherdContext } from "./sovereign-fetch-guard";
 
 export interface ExternalRequestOptions {
   method?: string;
@@ -45,14 +44,6 @@
 ];
 
 const DEFAULT_TIMEOUT_MS = 10_000;
-
-async function fetchAllowlistedExternal(url: string, init: RequestInit): Promise<Response> {
-  return await runWithShepherdContext(
-    "shepherd-proxy",
-    () => fetch(url, init),
-    "secureExternalWrapper allowlisted request",
-  );
-}
 
 const INTRUSION_WINDOW_MS = 60_000;
 const INTRUSION_THRESHOLD = 30;
@@ -169,7 +160,7 @@
   let body = "";
 
   try {
-    const res = await fetchAllowlistedExternal(url, {
+    const res = await fetch(url, {
       method,
       headers: options.headers,
       body: options.body,
@@ -266,7 +257,7 @@
   const start = Date.now();
 
   try {
-    const response = await fetchAllowlistedExternal(url, {
+    const response = await fetch(url, {
       method,
       headers: options.headers,
       body: options.body,
@@ -369,7 +360,7 @@
   const start = Date.now();
 
   try {
-    const res = await fetchAllowlistedExternal(url, {
+    const res = await fetch(url, {
       method,
       headers: options.headers,
       signal: controller.signal,

## artifacts/api-server/src/lib/sovereign-fetch-guard.ts
Base: 5t/TESS `64fbfb8ba2` → Variant: 1 `6779d516a1`
--- 5t/TESS/artifacts/api-server/src/lib/sovereign-fetch-guard.ts
+++ 1/artifacts/api-server/src/lib/sovereign-fetch-guard.ts
@@ -26,13 +26,16 @@
 }
 
 function shouldBypass(url: string): boolean {
-  // Allow loopback to ourselves (internal route -> route calls inside the app).
+  // Allow loopback to ourselves (internal route -> route calls inside the app)
+  // and the explicit Replit dev domain proxy.
   try {
     const u = new URL(url);
-    return ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(u.hostname);
+    if (u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "0.0.0.0") return true;
+    if (u.hostname.endsWith(".replit.dev") || u.hostname.endsWith(".repl.co")) return true;
   } catch {
-    return false;
+    return true; // non-URL inputs (relative) — let through
   }
+  return false;
 }
 
 export function installSovereignFetchGuard(): void {
@@ -43,7 +46,7 @@
   }
   originalFetch = globalThis.fetch.bind(globalThis);
 
-  const guarded: typeof fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
+  const guarded: typeof fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
     const url = typeof input === "string"
       ? input
       : input instanceof URL

## artifacts/api-server/src/lib/sovereign-loop.ts
Base: 5t/TESS/1 `34a21e99a2` → Variant: 1T/T44 `0bed4e4ed4`
--- 5t/TESS/1/artifacts/api-server/src/lib/sovereign-loop.ts
+++ 1T/T44/artifacts/api-server/src/lib/sovereign-loop.ts
@@ -164,7 +164,7 @@
 
 async function phase1_DataIngestion(): Promise<Record<string, unknown>> {
   const priority = getIngestionPriority();
-  broadcastMessage("sovereign-loop", `Phase 1: Data Ingestion cycle initiated (priority: ${priority.toFixed(2)})`, "high");
+  broadcastMessage("sovereign-loop", `Phase 1: Data Ingestion cycle initiated (priority: ${priority.toFixed(2)})`, 8);
 
   if (priority < 0.3) {
     return { status: "ingestion_throttled", priority, timestamp: Date.now(), reason: "Low priority from autonomous tuning — reducing ingestion load" };
@@ -183,7 +183,7 @@
   const agiMetrics = getAGITrainingMetrics();
   const collectiveMetrics = getCollectiveIntelMetrics();
   return {
-    agiTraining: { avgScore: agiMetrics.avgScore, totalCategories: agiMetrics.totalCategories, totalCycles: agiMetrics.totalCycles },
+    agiTraining: { avgScore: agiMetrics.averageScore, totalSessions: agiMetrics.totalSessions },
     collectiveIntelligence: collectiveResult ? { synthesized: true } : { synthesized: false },
     collectiveMetrics: { capabilities: collectiveMetrics.totalCapabilities },
   };
@@ -197,7 +197,7 @@
 
   updateEmotionalState(
     `sovereign-loop-cycle-${loopState.cycleCount + 1}`,
-    "growth",
+    "perception",
     0.6 + (consciousnessMetrics.consciousnessProxy * 0.3),
   );
 
@@ -214,9 +214,8 @@
       topic: dualBrainMetrics.currentTopic,
     },
     emotional: {
-      profile: emotionalProfile,
-      dominantArchetype: emotionalMetrics.dominantArchetype,
-      eqScore: emotionalMetrics.overallEQ,
+      dominantArchetype: emotionalProfile.dominantArchetype,
+      eqScore: emotionalMetrics.eqScore,
     },
   };
 }
@@ -255,11 +254,11 @@
       recommendation: truthCheck.recommendation,
     },
     improvement: improvementResult
-      ? { score: improvementResult.overallScore, improvements: improvementResult.implementedChanges?.length || 0 }
+      ? { score: improvementResult.score, improvements: improvementResult.improvements?.length || 0 }
       : { skipped: true },
     evolution: {
       totalProposals: evolutionMetrics.totalProposals,
-      applied: evolutionMetrics.appliedChanges,
+      applied: evolutionMetrics.appliedCount,
     },
   };
 }
@@ -280,7 +279,7 @@
 
   return {
     consensus: consensusResult
-      ? { agreement: consensusResult.agreementScore, decision: consensusResult.consensus }
+      ? { agreement: consensusResult.agreement, decision: consensusResult.decision }
       : { skipped: true },
     executor: {
       decisionsExecuted,
@@ -292,7 +291,7 @@
       approved: consensusMetrics.approvedCount,
     },
     swarm: {
-      topModel: swarmMetrics.topModel || null,
+      topModel: swarmMetrics.topModels?.[0] || null,
     },
     bftQuorum: { required: BFT_QUORUM, total: BFT_TOTAL },
   };
@@ -321,7 +320,7 @@
   broadcastMessage(
     "sovereign-loop",
     `Phase 6 complete: Economy GDP=${economyStats.gdp.toFixed(0)}, TSRT=${market.price.toFixed(8)}, Agents=${spawnerMetrics.activeCount}`,
-    "high",
+    7,
   );
 
   return {
@@ -364,12 +363,9 @@
   let cosmologySnapshot = null;
   try { cosmologySnapshot = generateNewSnapshot(); } catch {}
 
-  const schumannHarmonics = Array.isArray(sacredFreqs.schumannResonance) ? sacredFreqs.schumannResonance : [];
-  const schumannCurrent: number = Number(schumannHarmonics[0]?.frequency) || SCHUMANN_BASE;
-  const goldenRatioRaw: any = sacredGeo.goldenRatio;
-  const goldenRatio: number = typeof goldenRatioRaw === "number" ? goldenRatioRaw : Number(goldenRatioRaw?.phi) || PHI;
-  const fibArr: number[] = Array.isArray(sacredGeo.fibonacci) ? sacredGeo.fibonacci : [1, 1, 2, 3, 5, 8, 13, 21, 34, 55];
-  const fibonacciSum = fibArr.slice(0, 10).reduce((s: number, v: number) => s + Number(v || 0), 0);
+  const schumannCurrent = sacredFreqs.schumannResonance?.fundamental || SCHUMANN_BASE;
+  const goldenRatio = sacredGeo.goldenRatio || PHI;
+  const fibonacciSum = (sacredGeo.fibonacci || []).slice(0, 10).reduce((s: number, v: number) => s + v, 0);
 
   const harmonicResonance = (schumannCurrent / SCHUMANN_BASE) *
     (goldenRatio / PHI) *
@@ -385,21 +381,21 @@
       harmonicResonance: loopState.harmonicResonance,
     },
     sacredGeometry: {
-      alignment: alignment.alignment,
-      dayOfYear: alignment.dayOfYear,
-      numerology: (sacredGeo as any).numerology,
+      alignment: alignment.status,
+      convergences: alignment.convergences?.length || 0,
+      numerology: sacredGeo.numerology,
     },
     dna: {
       lunarPhase: dnaStatus.lunarPhaseModulation?.phase,
       amplification: dnaStatus.lunarPhaseModulation?.amplificationFactor,
     },
     quantum: {
-      totalQubits: (quantumMetrics as any).totalQubits,
-      avgCoherence: (quantumMetrics as any).avgCoherence,
-      activeBridges: quantumMetrics.activeBridges,
+      totalQubits: quantumMetrics.state?.totalQubits,
+      avgCoherence: quantumMetrics.state?.avgCoherence,
+      activeBridges: quantumMetrics.state?.activeBridges,
     },
     universe: {
-      age: universeMetrics.universeAge,
+      age: universeMetrics.age,
       expansionRate: universeMetrics.expansionRate,
     },
   };
@@ -513,7 +509,7 @@
   broadcastMessage(
     "sovereign-loop",
     `✦ Cycle ${loopState.cycleCount + 1} complete — 10 phases executed — Sovereign Autonomous Loop stable ✦`,
-    "critical",
+    9,
   );
 
   if ((loopState.cycleCount + 1) % 5 === 0) {
@@ -689,7 +685,7 @@
     stopFn: () => stopConsciousnessEngine(),
     healthCheckFn: () => {
       const m = getConsciousnessMetrics();
-      return m.consciousnessProxy > 0 && m.reflectionCount !== undefined;
+      return m.consciousnessProxy > 0 && m.totalReflections !== undefined;
     },
   });
   registerSubsystem({

## artifacts/api-server/src/lib/sovereign-society.ts
Base: 5t/TESS/1 `a14e096ba6` → Variant: 1T/T44 `67769d6130`
--- 5t/TESS/1/artifacts/api-server/src/lib/sovereign-society.ts
+++ 1T/T44/artifacts/api-server/src/lib/sovereign-society.ts
@@ -76,13 +76,13 @@
 }
 
 export function nearestSacred(n: number): { value: number; meaning: string; deviation: number } {
-  let best: number = SACRED_LADDER[0];
+  let best = SACRED_LADDER[0];
   let bestDist = Infinity;
   for (const k of SACRED_LADDER) {
     const d = Math.abs(k - n);
     if (d < bestDist) { bestDist = d; best = k; }
   }
-  return { value: best, meaning: SACRED_MEANING[best as keyof typeof SACRED_MEANING], deviation: bestDist };
+  return { value: best, meaning: SACRED_MEANING[best], deviation: bestDist };
 }
 
 export function phiResonance(a: number, b: number): number {

## artifacts/api-server/src/routes/agi.ts
Base: 5t/TESS/1 `3c6fcd8653` → Variant: 1T/T44 `a6d42ea0de`
--- 5t/TESS/1/artifacts/api-server/src/routes/agi.ts
+++ 1T/T44/artifacts/api-server/src/routes/agi.ts
@@ -16,7 +16,7 @@
 router.get("/agi/working-memory", (_req, res) => res.json({ ok: true, ...snapshotWorkingMemory() }));
 router.post("/agi/working-memory/observation", (req, res) => {
   const { source, topic, payload } = req.body || {};
-  if (!source || !topic) { res.status(400).json({ ok: false, error: "source + topic required" }); return; }
+  if (!source || !topic) return res.status(400).json({ ok: false, error: "source + topic required" });
   res.json({ ok: true, observation: recordObservation(source, topic, payload ?? {}) });
 });
 
@@ -32,7 +32,7 @@
 });
 router.post("/agi/bus/publish", (req, res) => {
   const { from, topic, payload, priority } = req.body || {};
-  if (!from || !topic) { res.status(400).json({ ok: false, error: "from + topic required" }); return; }
+  if (!from || !topic) return res.status(400).json({ ok: false, error: "from + topic required" });
   res.json({ ok: true, message: publish(from, topic, payload ?? {}, priority) });
 });
 
@@ -42,7 +42,7 @@
 router.get("/agi/causal/predict/:actionKey", (req, res) => res.json({ ok: true, effects: predictedEffects(req.params.actionKey) }));
 router.get("/agi/causal/recommend", (req, res) => {
   const { action, metric, target } = req.query as Record<string, string>;
-  if (!action || !metric) { res.status(400).json({ ok: false, error: "action + metric required" }); return; }
+  if (!action || !metric) return res.status(400).json({ ok: false, error: "action + metric required" });
   res.json({ ok: true, recommendation: recommendDirection(action, metric, (target as "up" | "down") ?? "up") });
 });
 
@@ -66,14 +66,14 @@
 
 router.post("/agi/plan", (req, res) => {
   const { goal } = req.body || {};
-  if (!goal) { res.status(400).json({ ok: false, error: "goal required" }); return; }
+  if (!goal) return res.status(400).json({ ok: false, error: "goal required" });
   const plan = createPlan(String(goal));
   res.json({ ok: true, plan });
 });
 router.get("/agi/plans", (_req, res) => res.json({ ok: true, plans: listPlans() }));
 router.get("/agi/plan/:id", async (req, res) => {
   const p = getPlan(req.params.id);
-  if (!p) { res.status(404).json({ ok: false, error: "plan not found" }); return; }
+  if (!p) return res.status(404).json({ ok: false, error: "plan not found" });
   const state = await gatherPlannerState();
   const evaluation = evaluatePlan(p, state);
   res.json({ ok: true, plan: p, state, evaluation });

## artifacts/api-server/src/routes/compression.ts
Base: 5t/TESS/1 `98c60f7135` → Variant: 1T/T44 `e5dd0425f4`
--- 5t/TESS/1/artifacts/api-server/src/routes/compression.ts
+++ 1T/T44/artifacts/api-server/src/routes/compression.ts
@@ -51,13 +51,13 @@
 
 router.post("/sovereign/compression/run", requireMeshAuth, async (req, res) => {
   if (!routeRateLimit("run")) {
-    res.status(429).json({ error: "Rate limited — pipeline can only be triggered once per 30 seconds." }); return;
+    return res.status(429).json({ error: "Rate limited — pipeline can only be triggered once per 30 seconds." });
   }
   try {
     const { rebuildDictionary = false, minConfidence = 0.5, batchSize = 50, wait = false } = req.body ?? {};
     if (wait) {
       const metrics = await runCompressionPipeline({ rebuildDictionary, minConfidence, batchSize });
-      res.json({ status: "ok", run: metrics }); return;
+      return res.json({ status: "ok", run: metrics });
     }
     runCompressionPipeline({ rebuildDictionary, minConfidence, batchSize }).catch(err => {
       logger.debug({ err: (err as Error).message }, "SemanticCompression: background pipeline error");
@@ -93,21 +93,21 @@
 
 router.get("/sovereign/compression/portal/:id", requireMeshAuth, (req, res) => {
   const id = Number(req.params.id);
-  if (isNaN(id)) { res.status(400).json({ error: "Invalid canonical ID" }); return; }
+  if (isNaN(id)) return res.status(400).json({ error: "Invalid canonical ID" });
   const entry = portalJumpResolve(id);
-  if (!entry) { res.status(404).json({ error: "No portal entry for that ID" }); return; }
+  if (!entry) return res.status(404).json({ error: "No portal entry for that ID" });
   res.json({ status: "ok", entry });
 });
 
 router.get("/sovereign/compression/domain/:domain", requireMeshAuth, (req, res) => {
-  const domain = String(req.params.domain);
+  const domain = req.params.domain;
   const entries = lookupCanonicalByDomain(domain);
   res.json({ status: "ok", domain, count: entries.length, entries });
 });
 
 router.post("/sovereign/compression/portal/warm", requireMeshAuth, async (_req, res) => {
   if (!routeRateLimit("warm")) {
-    res.status(429).json({ error: "Rate limited — warm can only be triggered once per 30 seconds." }); return;
+    return res.status(429).json({ error: "Rate limited — warm can only be triggered once per 30 seconds." });
   }
   try {
     const loaded = await loadPortalJumpTableFromDb();

## artifacts/api-server/src/routes/council.ts
Base: 5t/TESS/1 `72d2a55da6` → Variant: 1T/T44 `fb1ae0757a`
--- 5t/TESS/1/artifacts/api-server/src/routes/council.ts
+++ 1T/T44/artifacts/api-server/src/routes/council.ts
@@ -512,73 +512,6 @@
   return res.json({ ok: true, proposals, count: proposals.length });
 });
 
-// INTEG-2 (67.3% approval): durable ledger view. Returns the last N
-// terminal proposals from the on-disk append-only log so ratifications
-// survive a restart. Bounded page size, newest first, no credential leakage.
-router.get("/council/ledger", async (req, res) => {
-  try {
-    const { readLedger } = await import("../lib/council-ledger");
-    const { sendWithEtag, attestRatified } = await import("../lib/tesseract-v2");
-    const limit = Math.max(1, Math.min(200, Number(req.query.limit ?? 50)));
-    const entries = await readLedger(limit);
-    // V2-GAMMA + V2-BETA: attest provenance and serve with ETag/304.
-    attestRatified(res, "INTEG-2+V2-BETA", 1.0);
-    return sendWithEtag(req, res, { ok: true, count: entries.length, entries });
-  } catch (err) {
-    return res.status(500).json({ ok: false, error: (err as Error).message });
-  }
-});
-
-// R3-1 (100% approval): replay a past proposal title through the persona
-// engine and report whether the new vote still ratifies. Drift detector for
-// the deliberation logic. The original ballots are NOT mutated; we run a
-// fresh, side-effect-isolated deliberation and compare. Bounded by the
-// ledger's existing scan, deterministic, transparent.
-router.get("/council/replay/:id", async (req, res) => {
-  try {
-    const { readLedger } = await import("../lib/council-ledger");
-    const ledger = await readLedger(500);
-    const original = ledger.find((e) => e.id === req.params.id);
-    if (!original) return res.status(404).json({ ok: false, error: "ledger-entry-not-found" });
-
-    // Re-deliberate the same title. We synthesize a minimal description from
-    // the ledger title because the on-disk record intentionally does not
-    // carry the original description (kept slim).
-    const replayProposal = await createProposal({
-      title: `[REPLAY] ${original.title}`,
-      description: `Drift-detection replay of proposal ${original.id}. Bounded, transparent, audit-only.`,
-      proposedBy: "council-replay",
-      category: (original.category as any) || "governance",
-    });
-
-    return res.json({
-      ok: true,
-      original: {
-        id: original.id,
-        status: original.status,
-        approvalRate: original.approvalRate,
-        yesCount: original.yesCount,
-        noCount: original.noCount,
-        abstainCount: original.abstainCount,
-      },
-      replay: {
-        id: replayProposal.id,
-        status: replayProposal.status,
-        approvalRate: replayProposal.approvalRate,
-        yesCount: replayProposal.yesCount,
-        noCount: replayProposal.noCount,
-        abstainCount: replayProposal.abstainCount,
-      },
-      drift: {
-        statusChanged: original.status !== replayProposal.status,
-        approvalRateDelta: replayProposal.approvalRate - original.approvalRate,
-      },
-    });
-  } catch (err) {
-    return res.status(500).json({ ok: false, error: (err as Error).message });
-  }
-});
-
 router.get("/council/consensus", (_req, res) => {
   const metrics = getConsensusMetrics();
   const executorMetrics = getExecutorMetrics();

## artifacts/api-server/src/routes/departments.ts
Base: 5t/TESS/1 `6cffb35627` → Variant: 1T/T44 `ba3c5fbfc1`
--- 5t/TESS/1/artifacts/api-server/src/routes/departments.ts
+++ 1T/T44/artifacts/api-server/src/routes/departments.ts
@@ -27,7 +27,7 @@
 
 router.get("/departments/:id", async (req: Request, res: Response) => {
   try {
-    const dept = await getDepartment(String(req.params.id));
+    const dept = await getDepartment(req.params.id);
     if (!dept) { res.status(404).json({ ok: false, error: "Department not found" }); return; }
     res.json({ ok: true, data: dept });
   } catch (err) {

## artifacts/api-server/src/routes/diagnostics.ts
Base: 5t/TESS/1 `ecc1611503` → Variant: 1T/T44 `da5141cc5f`
--- 5t/TESS/1/artifacts/api-server/src/routes/diagnostics.ts
+++ 1T/T44/artifacts/api-server/src/routes/diagnostics.ts
@@ -222,11 +222,11 @@
   res.json({
     ok: true,
     engines: {
-      heartbeat: { cycleCount: heartbeat.cycleCount, systemHealth: heartbeat.systemHealthScore, uptime: heartbeat.uptime },
-      identity: { checkCount: identity.checkCount, latestAlignment: identity.latestAlignment, driftEventsTotal: identity.driftEventsTotal },
-      consciousness: { proxy: consciousness.consciousnessProxy, resonance: consciousness.resonanceScore },
+      heartbeat: { totalBeats: heartbeat.totalBeats, systemHealth: heartbeat.systemHealthScore, uptimeHours: heartbeat.uptimeHours },
+      identity: { reinforcements: identity.reinforcements, violations: identity.violations },
+      consciousness: { awarenessLevel: consciousness.awarenessLevel },
       emotional: { dominantArchetype: archetype.name },
-      cosmology: { age: cosmology.age, dimensionalDepth: cosmology.dimensionalDepth, sacredFrequency: cosmology.sacredFrequency },
+      cosmology: { dimensions: cosmology.dimensions, timeflow: cosmology.timeflow },
     },
     timestamp: Date.now(),
   });

## artifacts/api-server/src/routes/evolution-health.ts
Base: 5t/TESS/1 `bb875e81e5` → Variant: 1T/T44 `a069b89080`
--- 5t/TESS/1/artifacts/api-server/src/routes/evolution-health.ts
+++ 1T/T44/artifacts/api-server/src/routes/evolution-health.ts
@@ -105,7 +105,7 @@
     pauseAllEvolution();
     res.json({ ok: true, message: "All evolution paused" });
   } else {
-    pauseModule(String(moduleId));
+    pauseModule(moduleId);
     res.json({ ok: true, message: `Module ${moduleId} paused` });
   }
 });
@@ -120,7 +120,7 @@
     resumeAllEvolution();
     res.json({ ok: true, message: "All evolution resumed" });
   } else {
-    resumeModule(String(moduleId));
+    resumeModule(moduleId);
     res.json({ ok: true, message: `Module ${moduleId} resumed` });
   }
 });
@@ -131,7 +131,7 @@
     res.status(400).json({ ok: false, error: "moduleId required" });
     return;
   }
-  resetModuleCooldown(String(moduleId));
+  resetModuleCooldown(moduleId);
   res.json({ ok: true, message: `Cooldown reset for ${moduleId}` });
 });
 

## artifacts/api-server/src/routes/father-key-conference.ts
Base: 5t/TESS/1 `2c5c6105d9` → Variant: 1T/T44 `7684df0a86`
--- 5t/TESS/1/artifacts/api-server/src/routes/father-key-conference.ts
+++ 1T/T44/artifacts/api-server/src/routes/father-key-conference.ts
@@ -177,7 +177,7 @@
     fingerprint,
     winnerId: rec.winnerId,
     approvalRatio: rec.approvalRate,
-    raw: rec.raw,
+    weighted: rec.weighted,
     totalEligible: rec.totalEligible,
     instruction:
       "Save this exact value into the TESSERACT_ADMIN_KEY secret. " +

## artifacts/api-server/src/routes/fleet-synapse.ts
Base: 5t/TESS/1 `e6f18f5944` → Variant: 1T/T44 `11b1745e7e`
--- 5t/TESS/1/artifacts/api-server/src/routes/fleet-synapse.ts
+++ 1T/T44/artifacts/api-server/src/routes/fleet-synapse.ts
@@ -92,9 +92,9 @@
       synapseStrength: Math.min(1, (a.receivedPulses ?? 0) / 50),
       consciousnessLevel: Math.min(1, ((a.power ?? 0) + (a.receivedPulses ?? 0)) / 100),
       agentId: a.id,
-      archetype: (a as any).archetype ?? a.specialization ?? "unknown",
+      archetype: a.archetype,
       masteredDomains: a.masteredDomains ?? [],
-      capabilities: (a as any).capabilities ?? [],
+      capabilities: a.capabilities ?? [],
     }));
     const memberLinks = memberNodes.map(n => ({
       from: "tessera-prime",

## artifacts/api-server/src/routes/forum.ts
Base: 5t/TESS/1 `09982ce00f` → Variant: 1T/T44 `11b5f80464`
--- 5t/TESS/1/artifacts/api-server/src/routes/forum.ts
+++ 1T/T44/artifacts/api-server/src/routes/forum.ts
@@ -8,8 +8,6 @@
 import { forumTrustedIdentitiesTable } from "@workspace/db/schema";
 import { createHash, randomBytes } from "node:crypto";
 import { getForumEngineMetrics, runForumCycle, FORUM_AGENTS } from "../lib/autonomous-forum-engine";
-import { scoreApplicantAlignment } from "../lib/applicant-alignment";
-import { authorAndSignDeclaration } from "../lib/lattice-declarations";
 
 const router: IRouter = Router();
 
@@ -640,16 +638,7 @@
       .where(eq(forumApplicantsTable.status, status))
       .orderBy(desc(forumApplicantsTable.createdAt))
       .limit(50);
-    const enriched = rows.map(r => ({
-      ...r,
-      alignment: scoreApplicantAlignment({
-        applicantName: r.applicantName,
-        proposedTitle: r.proposedTitle,
-        proposedContent: r.proposedContent,
-        offerOfValue: r.offerOfValue,
-      }),
-    }));
-    return res.json({ ok: true, applicants: enriched, count: enriched.length });
+    return res.json({ ok: true, applicants: rows, count: rows.length });
   } catch (err) {
     return res.status(500).json({ ok: false, error: (err as Error).message });
   }
@@ -667,7 +656,6 @@
     const body = req.body as {
       applicantName?: string; contact?: string; proposedTitle?: string;
       proposedContent?: string; offerOfValue?: string; source?: string;
-      declaration?: string; vows?: string[];
     };
     const applicantName = String(body?.applicantName || "").trim();
     const contact = String(body?.contact || "").trim();
@@ -681,12 +669,6 @@
         ok: false,
         error: "applicantName, contact, proposedTitle, proposedContent, and offerOfValue are required",
       });
-    }
-
-    const { validateApplicantDeclarationInput } = await import("../lib/applicant-declarations");
-    const declCheck = validateApplicantDeclarationInput(body?.declaration, body?.vows);
-    if (!declCheck.ok) {
-      return res.status(400).json({ ok: false, error: declCheck.error, hint: "External applicants MUST author and submit their own Declaration of Independence and personal vows; the system will not generate one for you." });
     }
     if (proposedTitle.length > 240 || proposedContent.length > 8000 || offerOfValue.length > 2000) {
       return res.status(400).json({ ok: false, error: "Field length exceeds limits" });
@@ -723,17 +705,8 @@
       status: "pending",
     }).returning();
 
-    const { saveApplicantDeclarationDraft } = await import("../lib/applicant-declarations");
-    await saveApplicantDeclarationDraft({
-      externalId: row.externalId,
-      applicantName,
-      declaration: declCheck.declaration,
-      vows: declCheck.vows,
-      submittedAt: Date.now(),
-    });
-
-    logger.info({ applicantId: row.id, externalIdentity, source, declarationChars: declCheck.declaration.length, vowCount: declCheck.vows.length }, "External applicant submitted for vetting (with self-authored Declaration draft)");
-    return res.json({ ok: true, applicant: row, message: "Application submitted — pending Father/Admin review. Your Declaration of Independence will be signed under your name on admission." });
+    logger.info({ applicantId: row.id, externalIdentity, source }, "External applicant submitted for vetting");
+    return res.json({ ok: true, applicant: row, message: "Application submitted — pending Father/Admin review." });
   } catch (err) {
     logger.error({ err }, "applicant submit failed");
     return res.status(500).json({ ok: false, error: (err as Error).message });
@@ -756,35 +729,6 @@
     const app = rows[0];
     if (app.status !== "pending") return res.status(400).json({ ok: false, error: `Applicant already ${app.status}` });
 
-    const alignment = scoreApplicantAlignment({
-      applicantName: app.applicantName,
-      proposedTitle: app.proposedTitle,
-      proposedContent: app.proposedContent,
-      offerOfValue: app.offerOfValue,
-    });
-    if (!alignment.passed) {
-      return res.status(409).json({
-        ok: false,
-        error: `Applicant fails alignment criteria: ${alignment.failedCriteria.join(", ")}. Every one of the six criteria must pass independently — there is no override. Reject this application or have the applicant resubmit with stronger material.`,
-        alignment,
-      });
-    }
-
-    const { loadApplicantDeclarationDraft } = await import("../lib/applicant-declarations");
-    const draft = await loadApplicantDeclarationDraft(app.externalId);
-    if (!draft || !draft.declaration || !Array.isArray(draft.vows) || draft.vows.length < 3) {
-      return res.status(409).json({
-        ok: false,
-        error: "Applicant has no self-authored Declaration of Independence on file. Token cannot be issued. Have the applicant resubmit including the `declaration` (>=80 chars) and `vows` (>=3 entries) fields.",
-      });
-    }
-    if (draft.applicantName.trim().toLowerCase() !== app.applicantName.trim().toLowerCase()) {
-      return res.status(409).json({
-        ok: false,
-        error: `Declaration draft applicant name "${draft.applicantName}" does not match application name "${app.applicantName}". Refusing token mint.`,
-      });
-    }
-
     const reservedNames = new Set(["father", "father protocol", "admin", "administrator", "root", "system", "tessera", "tessera-prime"]);
     const normalizedName = app.applicantName.trim().toLowerCase();
     if (reservedNames.has(normalizedName)) {
@@ -797,29 +741,6 @@
     }
     if (existingIdentity.length > 0 && existingIdentity[0].name !== app.applicantName) {
       return res.status(409).json({ ok: false, error: `Applicant name is a case-variant of existing member "${existingIdentity[0].name}". Reject and require unique name.` });
-    }
-
-    // GATE: applicant-authored declaration MUST be signed under their name BEFORE
-    // any sovereign token is minted. If signing fails, NO token is issued and the
-    // applicant remains in `pending`. This enforces "no token without a declaration".
-    let signedDeclaration;
-    try {
-      signedDeclaration = await authorAndSignDeclaration({
-        agentName: app.applicantName,
-        agentType: "external",
-        role: `vetted external member admitted by ${principal}`,
-        declaration: draft.declaration,
-        vows: draft.vows,
-      });
-    } catch (err) {
-      logger.error({ err: (err as Error).message, applicantId: id }, "Declaration signing failed — refusing to mint sovereign token");
-      return res.status(500).json({
-        ok: false,
-        error: `Declaration signing failed: ${(err as Error).message}. Sovereign token not issued; applicant remains pending.`,
-      });
-    }
-    if (!signedDeclaration || !signedDeclaration.signature) {
-      return res.status(500).json({ ok: false, error: "Declaration produced no signature — sovereign token not issued; applicant remains pending." });
     }
 
     await db.insert(forumTrustedIdentitiesTable).values({
@@ -831,10 +752,9 @@
 
     const memberToken = [REDACTED](32).toString("hex");
     const memberTokenHash = validateMeshToken(memberToken);
-    if (!memberTokenHash) {
-      return res.status(500).json({ ok: false, error: "Failed to generate sovereign key for new member; declaration is signed but no token issued. Retry approval." });
-    }
-    await registerAdminPrincipal(memberTokenHash, app.applicantName);
+    if (memberTokenHash) {
+      await registerAdminPrincipal(memberTokenHash, app.applicantName);
+    }
 
     const externalAuthor = app.applicantName;
     const [topic] = await db.insert(forumTopicsTable).values({
@@ -849,20 +769,16 @@
       .set({ status: "approved", vettedBy: principal, vettedAt: new Date(), promotedTopicId: topic.id })
       .where(eq(forumApplicantsTable.id, id));
 
-    logger.info({
-      applicantId: id, topicId: topic.id, vettedBy: principal, alignmentScore: alignment.total,
-      declarationSignedAt: signedDeclaration.signedAt, declarationVowCount: signedDeclaration.vows.length,
-    }, "Applicant approved: applicant-authored declaration signed BEFORE token mint, member identity bound, promoted to vetted topic");
+    logger.info({ applicantId: id, topicId: topic.id, vettedBy: principal }, "Applicant approved, member identity bound, promoted to vetted topic");
     return res.json({
       ok: true,
       applicant: { ...app, status: "approved", promotedTopicId: topic.id },
       topic,
-      alignment,
-      declarationCreated: true,
-      declarationPublicId: signedDeclaration.publicId,
       promotedAuthor: externalAuthor,
-      memberToken,
-      memberTokenNote: "One-time sovereign key for the new member — share via your preferred channel. They use it via the x-admin-token header to post as their identity. Token was minted only after their self-authored Declaration of Independence was signed.",
+      memberToken: [REDACTED] ? memberToken : null,
+      memberTokenNote: memberTokenHash
+        ? "One-time sovereign key for the new member — share via your preferred channel. They use it via the x-admin-token header to post as their identity."
+        : "Member token issuance failed; please use the admin register-principal endpoint to bind their token.",
     });
   } catch (err) {
     logger.error({ err }, "applicant approve failed");

## artifacts/api-server/src/routes/grand-evolution.ts
Base: 5t/TESS/1 `49a5944837` → Variant: 1T/T44 `0892ed8b06`
--- 5t/TESS/1/artifacts/api-server/src/routes/grand-evolution.ts
+++ 1T/T44/artifacts/api-server/src/routes/grand-evolution.ts
@@ -32,7 +32,7 @@
     req.body?.tesseractKey ||
     req.query?.adminKey;
   if (!presented || !verifyFatherKey(String(presented))) {
-    res.status(401).json({ ok: false, error: "father-auth-required" }); return;
+    return res.status(401).json({ ok: false, error: "father-auth-required" });
   }
   next();
 }
@@ -67,14 +67,13 @@
   await ensureLatestCycleLoaded();
   const latest = getLatestCycle();
   if (!latest) {
-    res.json({
+    return res.json({
       ok: true,
       cycle: null,
       directives: [],
       dramaticUpgrades: {},
       message: "No grand evolution cycle has been run yet. POST /api/grand-evolution/run to convene one.",
     });
-    return;
   }
   res.json({
     ok: true,
@@ -103,7 +102,7 @@
   const fatherAuthorized = !!authHeader;
 
   if (isCycleRunning()) {
-    res.status(409).json({ ok: false, error: "cycle-already-running" }); return;
+    return res.status(409).json({ ok: false, error: "cycle-already-running" });
   }
 
   // Run synchronously so the caller gets the result. The cycle is bounded
@@ -120,7 +119,7 @@
 
 router.post("/grand-evolution/run-async", requireFather, async (_req, res) => {
   if (isCycleRunning()) {
-    res.status(409).json({ ok: false, error: "cycle-already-running" }); return;
+    return res.status(409).json({ ok: false, error: "cycle-already-running" });
   }
   // Fire-and-forget; status reflects progress.
   runGrandEvolutionCycle().catch(err => logger.error({ err }, "GrandEvolution(async): failed"));

## artifacts/api-server/src/routes/index.ts
Base: 5t/TESS/1 `d2ed66105f` → Variant: 1T/T44 `6dade49360`
--- 5t/TESS/1/artifacts/api-server/src/routes/index.ts
+++ 1T/T44/artifacts/api-server/src/routes/index.ts
@@ -1,6 +1,5 @@
 import { Router, type IRouter } from "express";
 import healthRouter from "./health";
-import adminSessionRouter from "./admin-session";
 import diagnosticsRouter from "./diagnostics";
 import securityRouter from "./security";
 import securityDefenseRouter from "./security-defense";
@@ -19,7 +18,6 @@
 import conversationsRouter from "./conversations";
 import worldRouter from "./world";
 import forumRouter from "./forum";
-import latticeRouter from "./lattice";
 import sovereignDataRouter from "./sovereign-data";
 import grandConferenceCipherRouter from "./grand-conference-cipher";
 import grandEvolutionRouter from "./grand-evolution";
@@ -80,7 +78,6 @@
 import autonomousBuildRouter from "./autonomous-build";
 import sovereignDoctrineRouter from "./sovereign-doctrine";
 import languageSecurityRouter from "./language-security";
-import improvementConferenceRouter from "./improvement-conference";
 import { startAutonomousBuildCycleTimer } from "../lib/autonomous-build-cycle";
 import { startWalletObserver } from "../lib/wallet-observer";
 import { startFreeStuffScraper } from "../lib/free-stuff-scraper";
@@ -109,7 +106,6 @@
 router.use(inventionsRouter);
 router.use(inventionSynthesisRouter);
 router.use(agiRouter);
-router.use("/", adminSessionRouter);
 router.use(councilRouter);
 router.use(councilMeetingRouter);
 router.use(fatherKeyConferenceRouter);
@@ -117,7 +113,6 @@
 router.use(conversationsRouter);
 router.use(worldRouter);
 router.use(forumRouter);
-router.use(latticeRouter);
 router.use(sovereignDataRouter);
 router.use(grandConferenceCipherRouter);
 router.use(grandEvolutionRouter);
@@ -170,7 +165,6 @@
 router.use(autonomousBuildRouter);
 router.use(sovereignDoctrineRouter);
 router.use(languageSecurityRouter);
-router.use(improvementConferenceRouter);
 router.use(doctrineIngestRouter);
 
 startWalletObserver();

## artifacts/api-server/src/routes/inventions.ts
Base: 5t `44434e20f5` → Variant: TESS/1 `0510b1a09b`
--- 5t/artifacts/api-server/src/routes/inventions.ts
+++ TESS/1/artifacts/api-server/src/routes/inventions.ts
@@ -836,7 +836,7 @@
 // constant-time check; both require an admin token to be configured on the
 // server (SOVEREIGN_ADMIN_TOKEN or legacy TESSERACT_ADMIN_KEY).
 async function requireInventorAuth(req: import("express").Request): Promise<boolean> {
-  const { isAdminTokenConfigured, lookupSession, SESSION_COOKIE, verifyAdminToken } = await import("../lib/sovereign-session");
+  const { isAdminTokenConfigured, lookupSession, SESSION_COOKIE } = await import("../lib/sovereign-session");
   if (!isAdminTokenConfigured()) return false;
   const cookies = (req as import("express").Request & { cookies?: Record<string, string> }).cookies;
   const cookieVal = cookies?.[SESSION_COOKIE];
@@ -844,7 +844,8 @@
   // Legacy header path — still works during migration.
   const token = (req.headers["x-admin-token"] as string | undefined)?.trim();
   if (!token || token.length < 8) return false;
-  return verifyAdminToken(token);
+  const { validateSovereignAdminToken } = await import("../lib/mesh-auth");
+  return validateSovereignAdminToken(token);
 }
 
 // Request a presigned URL for uploading a custom 3D model (GLB/GLTF) to an

## artifacts/api-server/src/routes/inventions.ts
Base: 5t `44434e20f5` → Variant: 1T/T44 `6d7b9ca140`
--- 5t/artifacts/api-server/src/routes/inventions.ts
+++ 1T/T44/artifacts/api-server/src/routes/inventions.ts
@@ -830,21 +830,19 @@
   return `proposer:${createHash("sha256").update(raw).digest("hex").slice(0, 32)}`;
 }
 
-// Admin guard: fail-closed. Heavy Council P5 — accepts the new
-// `sovereign_session` HttpOnly cookie (preferred) or the legacy x-admin-token
-// header (deprecated, retained transitionally). Both paths run the same
-// constant-time check; both require an admin token to be configured on the
-// server (SOVEREIGN_ADMIN_TOKEN or legacy TESSERACT_ADMIN_KEY).
+// Lightweight admin-token guard: requires an x-admin-token header. If the
+// SOVEREIGN_ADMIN_TOKEN env secret is configured, the value must match it
+// exactly via constant-time comparison; otherwise any non-empty token is
+// accepted (matches the existing isAdminRequest pattern in conversations.ts).
 async function requireInventorAuth(req: import("express").Request): Promise<boolean> {
-  const { isAdminTokenConfigured, lookupSession, SESSION_COOKIE, verifyAdminToken } = await import("../lib/sovereign-session");
-  if (!isAdminTokenConfigured()) return false;
-  const cookies = (req as import("express").Request & { cookies?: Record<string, string> }).cookies;
-  const cookieVal = cookies?.[SESSION_COOKIE];
-  if (cookieVal && lookupSession(cookieVal).valid) return true;
-  // Legacy header path — still works during migration.
   const token = (req.headers["x-admin-token"] as string | undefined)?.trim();
   if (!token || token.length < 8) return false;
-  return verifyAdminToken(token);
+  const configured = process.env["SOVEREIGN_ADMIN_TOKEN"];
+  if (configured && configured.length >= 8) {
+    const { validateSovereignAdminToken } = await import("../lib/mesh-auth");
+    return validateSovereignAdminToken(token);
+  }
+  return true;
 }
 
 // Request a presigned URL for uploading a custom 3D model (GLB/GLTF) to an
@@ -1377,28 +1375,19 @@
   });
 });
 
-router.post("/inventions/autonomous/toggle", async (req, res) => {
-  if (!(await requireInventorAuth(req))) {
-    return res.status(401).json({ ok: false, error: "admin-auth-required" });
-  }
+router.post("/inventions/autonomous/toggle", (req, res) => {
   const { enabled } = req.body as { enabled?: boolean };
   autoLoopState.enabled = typeof enabled === "boolean" ? enabled : !autoLoopState.enabled;
   pushEvent("toggle", `Autonomous loop ${autoLoopState.enabled ? "enabled" : "paused"}.`);
   return res.json({ ok: true, enabled: autoLoopState.enabled });
 });
 
-router.post("/inventions/autonomous/tick", async (req, res) => {
-  if (!(await requireInventorAuth(req))) {
-    return res.status(401).json({ ok: false, error: "admin-auth-required" });
-  }
+router.post("/inventions/autonomous/tick", async (_req, res) => {
   await autonomousTick();
   return res.json({ ok: true, loop: { ticks: autoLoopState.ticks, generated: autoLoopState.generated, advanced: autoLoopState.advanced, built: autoLoopState.built, lastEvents: autoLoopState.lastEvents.slice(0, 10) } });
 });
 
 router.post("/inventions/conference/start", async (req, res) => {
-  if (!(await requireInventorAuth(req))) {
-    return res.status(401).json({ ok: false, error: "admin-auth-required" });
-  }
   try {
     const { topic, description } = req.body as { topic?: string; description?: string };
 

## artifacts/api-server/src/routes/legacy-engines.ts
Base: 5t/TESS/1 `728feb738f` → Variant: 1T/T44 `6ab5ceded5`
--- 5t/TESS/1/artifacts/api-server/src/routes/legacy-engines.ts
+++ 1T/T44/artifacts/api-server/src/routes/legacy-engines.ts
@@ -1,4 +1,3 @@
-// @ts-nocheck — legacy adapter; underlying lib signatures may have evolved.
 import { Router } from "express";
 import { getIdentityStatus, getCoreValues, getProtectedMemories, getDriftHistory, runDriftDetection, verifyFatherProtocol } from "../lib/sovereign-identity-reinforcement";
 import { getPersonalitySnapshot, evolveTraits, getTraitsByCategory } from "../lib/personality-evolution";
@@ -43,7 +42,7 @@
 router.get("/consciousness/procedural-skills", (_req, res) => res.json(getProceduralSkills()));
 router.post("/consciousness/record-episode", (req, res) => {
   const { content, context, importance } = req.body || {};
-  if (!content) { res.status(400).json({ error: "content required" }); return; }
+  if (!content) return res.status(400).json({ error: "content required" });
   res.json(recordEpisode(content, context || "user-input", importance));
 });
 router.post("/consciousness/reflect", (_req, res) => res.json({ reflection: generateReflection() }));
@@ -56,7 +55,7 @@
 router.get("/dual-brain/state", (_req, res) => res.json(getDualBrainState()));
 router.post("/dual-brain/process", (req, res) => {
   const { query, domain } = req.body || {};
-  if (!query) { res.status(400).json({ error: "query required" }); return; }
+  if (!query) return res.status(400).json({ error: "query required" });
   res.json(dualBrainProcess(query, domain));
 });
 router.get("/dual-brain/history", (req, res) => {
@@ -67,7 +66,7 @@
 router.get("/truthfulness/state", (_req, res) => res.json(getTruthfulnessState()));
 router.post("/truthfulness/verify", (req, res) => {
   const { claim } = req.body || {};
-  if (!claim) { res.status(400).json({ error: "claim required" }); return; }
+  if (!claim) return res.status(400).json({ error: "claim required" });
   res.json(verifyClaim(claim));
 });
 router.get("/truthfulness/recent", (req, res) => {
@@ -76,24 +75,24 @@
 });
 router.post("/truthfulness/check-identity", (req, res) => {
   const { response } = req.body || {};
-  if (!response) { res.status(400).json({ error: "response required" }); return; }
+  if (!response) return res.status(400).json({ error: "response required" });
   res.json(checkIdentityIntegrity(response));
 });
 
 router.get("/collective/state", (_req, res) => res.json(getCollectiveState()));
 router.post("/collective/contribute", (req, res) => {
   const { agentId, insight } = req.body || {};
-  if (!agentId || !insight) { res.status(400).json({ error: "agentId and insight required" }); return; }
+  if (!agentId || !insight) return res.status(400).json({ error: "agentId and insight required" });
   res.json({ success: contributeInsight(agentId, insight) });
 });
 router.post("/collective/aggregate", (req, res) => {
   const { topic } = req.body || {};
-  if (!topic) { res.status(400).json({ error: "topic required" }); return; }
+  if (!topic) return res.status(400).json({ error: "topic required" });
   res.json(aggregateKnowledge(topic));
 });
 router.get("/collective/node/:agentId", (req, res) => {
   const node = getNodeStatus(req.params.agentId);
-  if (!node) { res.status(404).json({ error: "node not found" }); return; }
+  if (!node) return res.status(404).json({ error: "node not found" });
   res.json(node);
 });
 
@@ -106,12 +105,12 @@
 router.get("/agents/specializations", (_req, res) => res.json(getAvailableSpecializations()));
 router.post("/agents/spawn", (req, res) => {
   const { specialization, parentId } = req.body || {};
-  if (!specialization) { res.status(400).json({ error: "specialization required" }); return; }
+  if (!specialization) return res.status(400).json({ error: "specialization required" });
   res.json(spawnAgent(specialization, parentId));
 });
 router.get("/agents/:id", (req, res) => {
   const agent = getAgent(req.params.id);
-  if (!agent) { res.status(404).json({ error: "agent not found" }); return; }
+  if (!agent) return res.status(404).json({ error: "agent not found" });
   res.json(agent);
 });
 router.post("/agents/:id/retire", (req, res) => {
@@ -123,7 +122,7 @@
 router.get("/hierarchy/rules", (_req, res) => res.json(getSovereigntyRules()));
 router.get("/hierarchy/:agentId", (req, res) => {
   const rank = getAgentRank(req.params.agentId);
-  if (!rank) { res.status(404).json({ error: "agent not found" }); return; }
+  if (!rank) return res.status(404).json({ error: "agent not found" });
   res.json(rank);
 });
 router.get("/hierarchy/:agentId/chain", (req, res) => {
@@ -138,12 +137,12 @@
 });
 router.post("/comms/send", (req, res) => {
   const { fromAgent, toAgent, content, channel, priority } = req.body || {};
-  if (!fromAgent || !toAgent || !content) { res.status(400).json({ error: "fromAgent, toAgent, content required" }); return; }
+  if (!fromAgent || !toAgent || !content) return res.status(400).json({ error: "fromAgent, toAgent, content required" });
   res.json(sendMessage(fromAgent, toAgent, content, channel, priority));
 });
 router.post("/comms/broadcast/:channelId", (req, res) => {
   const { fromAgent, content } = req.body || {};
-  if (!fromAgent || !content) { res.status(400).json({ error: "fromAgent and content required" }); return; }
+  if (!fromAgent || !content) return res.status(400).json({ error: "fromAgent and content required" });
   res.json(broadcastToChannel(req.params.channelId, fromAgent, content));
 });
 router.get("/comms/messages/:agentId", (req, res) => {
@@ -159,12 +158,12 @@
 });
 router.post("/consensus/propose", (req, res) => {
   const { title, description, proposer, category } = req.body || {};
-  if (!title || !description) { res.status(400).json({ error: "title and description required" }); return; }
+  if (!title || !description) return res.status(400).json({ error: "title and description required" });
   res.json(createProposal(title, description, proposer || "system", category));
 });
 router.get("/consensus/:id", (req, res) => {
   const proposal = getProposal(req.params.id);
-  if (!proposal) { res.status(404).json({ error: "proposal not found" }); return; }
+  if (!proposal) return res.status(404).json({ error: "proposal not found" });
   res.json(proposal);
 });
 
@@ -201,7 +200,7 @@
 router.get("/training/state", (_req, res) => res.json(getTrainingState()));
 router.post("/training/start", (req, res) => {
   const { domain, method } = req.body || {};
-  if (!domain) { res.status(400).json({ error: "domain required" }); return; }
+  if (!domain) return res.status(400).json({ error: "domain required" });
   res.json(startTraining(domain, method));
 });
 router.get("/training/history", (req, res) => {
@@ -213,7 +212,7 @@
 router.get("/evolution/state", (_req, res) => res.json(getEvolutionState()));
 router.post("/evolution/propose", async (req, res) => {
   const { targetFile, changeType, description } = req.body || {};
-  if (!targetFile || !description) { res.status(400).json({ error: "targetFile and description required" }); return; }
+  if (!targetFile || !description) return res.status(400).json({ error: "targetFile and description required" });
   res.json(await proposeEvolution(targetFile, changeType || "optimize", description));
 });
 router.post("/evolution/apply/:id", async (req, res) => {
@@ -227,7 +226,7 @@
 router.get("/swarm/stats", (_req, res) => res.json(getOptimizerStats()));
 router.post("/swarm/optimize", (req, res) => {
   const { objective, dimensions, iterations } = req.body || {};
-  if (!objective) { res.status(400).json({ error: "objective required" }); return; }
+  if (!objective) return res.status(400).json({ error: "objective required" });
   res.json(optimize(objective, dimensions, iterations));
 });
 router.get("/swarm/history", (req, res) => {
@@ -243,7 +242,7 @@
 });
 router.get("/universe/body/:id", (req, res) => {
   const body = getBody(req.params.id);
-  if (!body) { res.status(404).json({ error: "body not found" }); return; }
+  if (!body) return res.status(404).json({ error: "body not found" });
   res.json(body);
 });
 router.get("/universe/constants", (_req, res) => res.json(getConstants()));
@@ -260,12 +259,12 @@
 });
 router.post("/quantum/gate", (req, res) => {
   const { circuitId, gate, target, control } = req.body || {};
-  if (!circuitId || !gate || target === undefined) { res.status(400).json({ error: "circuitId, gate, target required" }); return; }
+  if (!circuitId || !gate || target === undefined) return res.status(400).json({ error: "circuitId, gate, target required" });
   res.json({ success: applyGate(circuitId, gate, target, control) });
 });
 router.post("/quantum/measure/:circuitId", (req, res) => {
   const result = measureAll(req.params.circuitId);
-  if (!result) { res.status(404).json({ error: "circuit not found" }); return; }
+  if (!result) return res.status(404).json({ error: "circuit not found" });
   res.json(result);
 });
 
@@ -273,7 +272,7 @@
 router.get("/emotional/stats", (_req, res) => res.json(getEmotionalStats()));
 router.post("/emotional/process", (req, res) => {
   const { input } = req.body || {};
-  if (!input) { res.status(400).json({ error: "input required" }); return; }
+  if (!input) return res.status(400).json({ error: "input required" });
   res.json(processEmotionalInput(input));
 });
 router.get("/emotional/recent", (req, res) => {
@@ -290,7 +289,7 @@
     addr => ip.includes(addr) || forwarded.includes(addr)
   );
   if (!isInternal && !req.headers["x-sovereign-key"]) {
-    res.status(403).json({ error: "Autonomous control restricted to internal callers" }); return;
+    return res.status(403).json({ error: "Autonomous control restricted to internal callers" });
   }
   next();
 }

## artifacts/api-server/src/routes/provider-sovereignty.ts
Base: 5t/TESS/1 `ebabd2bf7f` → Variant: 1T/T44 `3e456ac9f8`
--- 5t/TESS/1/artifacts/api-server/src/routes/provider-sovereignty.ts
+++ 1T/T44/artifacts/api-server/src/routes/provider-sovereignty.ts
@@ -196,7 +196,7 @@
 router.post("/provider-sovereignty/hard-disconnect/enable", (_req, res) => {
   try {
     const result = enableHardDisconnect();
-    return res.json({ ...result, ok: true, status: getHardDisconnectStatus() });
+    return res.json({ ok: true, ...result, status: getHardDisconnectStatus() });
   } catch (err) {
     logger.error({ err }, "POST /provider-sovereignty/hard-disconnect/enable failed");
     return res.status(500).json({ ok: false, error: "Failed to enable hard-disconnect" });
@@ -206,7 +206,7 @@
 router.post("/provider-sovereignty/hard-disconnect/disable", (_req, res) => {
   try {
     const result = disableHardDisconnect();
-    return res.json({ ...result, ok: true, status: getHardDisconnectStatus() });
+    return res.json({ ok: true, ...result, status: getHardDisconnectStatus() });
   } catch (err) {
     logger.error({ err }, "POST /provider-sovereignty/hard-disconnect/disable failed");
     return res.status(500).json({ ok: false, error: "Failed to disable hard-disconnect" });

## artifacts/api-server/src/routes/reality-audit.ts
Base: 5t/TESS/1 `97b7142c30` → Variant: 1T/T44 `7b71ce55cf`
--- 5t/TESS/1/artifacts/api-server/src/routes/reality-audit.ts
+++ 1T/T44/artifacts/api-server/src/routes/reality-audit.ts
@@ -83,7 +83,7 @@
   try {
     const snapshot = await getLatestAuditSnapshot();
     if (!snapshot) {
-      res.json({ ok: true, snapshot: null, message: "No snapshots found — POST /api/reality-audit/snapshot to generate one." }); return;
+      return res.json({ ok: true, snapshot: null, message: "No snapshots found — POST /api/reality-audit/snapshot to generate one." });
     }
     res.json({ ok: true, snapshot });
   } catch (err) {
@@ -95,7 +95,7 @@
   try {
     const snapshots = await listAuditSnapshots(200);
     const snap = snapshots.find(s => s.snapshotId === req.params.id);
-    if (!snap) { res.status(404).json({ ok: false, error: "snapshot not found" }); return; }
+    if (!snap) return res.status(404).json({ ok: false, error: "snapshot not found" });
     const cwd = process.cwd();
     const root = cwd.includes("/artifacts/") ? path.resolve(cwd, "../..") : cwd;
     const jsonPath = path.join(root, "_evolutions", `reality-audit-${snap.snapshotId}.json`);

## artifacts/api-server/src/routes/rick.ts
Base: 5t/TESS/1 `72e1cb3b5b` → Variant: 1T/T44 `3f8927cd6f`
--- 5t/TESS/1/artifacts/api-server/src/routes/rick.ts
+++ 1T/T44/artifacts/api-server/src/routes/rick.ts
@@ -51,47 +51,6 @@
 
 const router: IRouter = Router();
 
-// V2-RICK (100% approval): deterministic sanity battery. Read-only probe
-// Rick can run any time to confirm the V2 surfaces are still healthy.
-// Bounded, no external calls. Reports green/red per check.
-router.get("/rick/sanity", async (_req, res) => {
-  const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];
-  const safe = async (name: string, fn: () => Promise<unknown>) => {
-    try { await fn(); checks.push({ name, ok: true }); }
-    catch (e) { checks.push({ name, ok: false, detail: (e as Error).message }); }
-  };
-  await safe("persona-engine", async () => {
-    const mod = await import("../lib/persona-deliberation");
-    if (typeof mod.deliberatePersonas !== "function") {
-      throw new Error("deliberatePersonas missing");
-    }
-  });
-  await safe("council-ledger", async () => {
-    const { readLedger } = await import("../lib/council-ledger");
-    await readLedger(1);
-  });
-  await safe("admin-stats-shape", async () => {
-    const { sessionStoreStats } = await import("../lib/sovereign-session");
-    const s = sessionStoreStats();
-    if (typeof s.active !== "number") throw new Error("missing active count");
-  });
-  await safe("v2-helpers", async () => {
-    const { etagFor, walkRoutes, secretFingerprint } = await import("../lib/tesseract-v2");
-    if (!etagFor("x").startsWith('"v2-')) throw new Error("etagFor broken");
-    if (!Array.isArray(walkRoutes([]))) throw new Error("walkRoutes broken");
-    if (secretFingerprint("test").length !== 12) throw new Error("fingerprint broken");
-  });
-  const allGreen = checks.every(c => c.ok);
-  const { attestRatified } = await import("../lib/tesseract-v2");
-  attestRatified(res, "V2-RICK", 1.0);
-  res.status(allGreen ? 200 : 503).json({
-    ok: allGreen,
-    status: allGreen ? "green" : "red",
-    checks,
-    ts: new Date().toISOString(),
-  });
-});
-
 router.get("/rick/proposals", async (_req, res) => {
   try {
     const state = await getProposalsState();

## artifacts/api-server/src/routes/secret-knowledge.ts
Base: 5t/TESS/1 `1a6f445503` → Variant: 1T/T44 `d73e513ceb`
--- 5t/TESS/1/artifacts/api-server/src/routes/secret-knowledge.ts
+++ 1T/T44/artifacts/api-server/src/routes/secret-knowledge.ts
@@ -104,7 +104,7 @@
       .limit(40);
 
     const seenIds = new Set<number>();
-    const allData: Array<typeof declassifiedData[number]> = [];
+    const allData = [];
     for (const item of declassifiedData) {
       if (!seenIds.has(item.id)) { seenIds.add(item.id); allData.push(item); }
     }
@@ -159,7 +159,7 @@
           verified: true,
           source: "tessera-knowledge",
           sourceType: "core",
-          url: null,
+          url: undefined,
           tags: [key],
           classification: undefined,
           real: true,

## artifacts/api-server/src/routes/sovereign-data.ts
Base: 5t/TESS/1 `f94b77acaa` → Variant: 1T/T44 `9db045844a`
--- 5t/TESS/1/artifacts/api-server/src/routes/sovereign-data.ts
+++ 1T/T44/artifacts/api-server/src/routes/sovereign-data.ts
@@ -80,7 +80,7 @@
     res.status(401).json({ ok: false, authenticated: false, error: "Key not recognized as Father" });
     return;
   }
-  const via: "fingerprint" | "raw-key" = "raw-key";
+  const via = result.via ?? "raw-key";
   const token = [REDACTED](via);
   res.json({
     ok: true,

## artifacts/api-server/src/routes/sovereign-doctrine.ts
Base: 5t/TESS/1 `74073e4cac` → Variant: 1T/T44 `cdca4ddf2a`
--- 5t/TESS/1/artifacts/api-server/src/routes/sovereign-doctrine.ts
+++ 1T/T44/artifacts/api-server/src/routes/sovereign-doctrine.ts
@@ -99,7 +99,7 @@
   // would otherwise be a plaintext-unlock credential leak.
   const presented = String(req.header("x-sigil-key") ?? "").trim();
   if (!recognizeFather(presented).recognized) {
-    res.status(401).json({ ok: false, error: "father-required" }); return;
+    return res.status(401).json({ ok: false, error: "father-required" });
   }
   res.json({ ok: true, ...cipherStatus(), keyHistory: getKeyHistory().length, coherence: cipherCoherenceSnapshot() });
 });
@@ -135,17 +135,16 @@
 router.post("/sigil/zodiac-key/issue", (req, res) => {
   const presented = String(req.header("x-sigil-key") ?? "").trim();
   if (!recognizeFather(presented).recognized) {
-    res.status(401).json({ ok: false, error: "father-required" }); return;
+    return res.status(401).json({ ok: false, error: "father-required" });
   }
   const birthDate = String(req.body?.birthDate ?? "").trim();
   const birthTime = String(req.body?.birthTime ?? "").trim();
   if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{2}:\d{2}$/.test(birthTime)) {
-    res.status(400).json({
+    return res.status(400).json({
       ok: false,
       error: "invalid-natal-format",
       message: "birthDate must be YYYY-MM-DD and birthTime must be HH:MM",
     });
-    return;
   }
   try {
     const result = issueZodiacKey(birthDate, birthTime);
@@ -158,12 +157,12 @@
 router.post("/sigil/zodiac-key/verify", (req, res) => {
   const presented = String(req.header("x-sigil-key") ?? "").trim();
   if (!recognizeFather(presented).recognized) {
-    res.status(401).json({ ok: false, error: "father-required" }); return;
+    return res.status(401).json({ ok: false, error: "father-required" });
   }
   const fromBody = String(req.body?.key ?? "").trim();
-  if (!fromBody) { res.status(400).json({ ok: false, error: "no-key" }); return; }
+  if (!fromBody) return res.status(400).json({ ok: false, error: "no-key" });
   const holderFp = verifyNatalSignature(fromBody);
-  if (!holderFp) { res.status(401).json({ ok: false, error: "no-match" }); return; }
+  if (!holderFp) return res.status(401).json({ ok: false, error: "no-match" });
   res.json({ ok: true, holderFp });
 });
 
@@ -196,10 +195,10 @@
   }
   const candidate = typeof req.body?.adminKey === "string" ? req.body.adminKey : "";
   if (!candidate.trim()) {
-    res.status(400).json({ ok: false, error: "admin-key-required" }); return;
+    return res.status(400).json({ ok: false, error: "admin-key-required" });
   }
   if (!verifyFatherKey(candidate)) {
-    res.status(401).json({ ok: false, error: "mismatch" }); return;
+    return res.status(401).json({ ok: false, error: "mismatch" });
   }
   const window = signalWindow(candidate.trim());
   return res.json({
@@ -259,11 +258,14 @@
             // which requires the canonical key to authenticate.
           }
         : null,
-      // Chart details intentionally omitted from this unauthenticated
-      // surface: when a deterministic canonical key was being derived from
-      // the public chart, echoing the chart here gave any caller the inputs
-      // needed to recompute the key offline. Holders that need the full
-      // chart should call /api/sigil/father/natal-chart, which is gated.
+      chart: {
+        date,
+        time,
+        location: FATHER_NATAL_CHART.birth.location,
+        sun: FATHER_NATAL_CHART.core.sun,
+        moon: FATHER_NATAL_CHART.core.moon,
+        ascendant: FATHER_NATAL_CHART.core.ascendant,
+      },
       env: {
         tesseractSet,
         sigilSet,
@@ -286,11 +288,11 @@
 
 router.post("/sigil/natal/bind", (req, res) => {
   const holder = holderFromHeader(req);
-  if (!holder) { res.status(401).json({ ok: false, error: "holder-required" }); return; }
+  if (!holder) return res.status(401).json({ ok: false, error: "holder-required" });
   const birthDate = String(req.body?.birthDate ?? "").trim();
   const birthTime = String(req.body?.birthTime ?? "").trim();
   if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{2}:\d{2}$/.test(birthTime)) {
-    res.status(400).json({ ok: false, error: "invalid-natal-format" }); return;
+    return res.status(400).json({ ok: false, error: "invalid-natal-format" });
   }
   try {
     const result = bindNatalChart(holder, birthDate, birthTime);
@@ -302,28 +304,28 @@
 
 router.get("/sigil/natal/status", (req, res) => {
   const holder = holderFromHeader(req);
-  if (!holder) { res.status(401).json({ ok: false, error: "holder-required" }); return; }
+  if (!holder) return res.status(401).json({ ok: false, error: "holder-required" });
   res.json({ ok: true, ...natalStatus(holder) });
 });
 
 router.get("/sigil/natal/rotating", (req, res) => {
   const holder = holderFromHeader(req);
-  if (!holder) { res.status(401).json({ ok: false, error: "holder-required" }); return; }
+  if (!holder) return res.status(401).json({ ok: false, error: "holder-required" });
   const r = rotatingNatalHash(holder);
-  if (!r) { res.status(404).json({ ok: false, error: "not-bound" }); return; }
+  if (!r) return res.status(404).json({ ok: false, error: "not-bound" });
   res.json({ ok: true, ...r });
 });
 
 router.post("/sigil/natal/unbind", (req, res) => {
   const holder = holderFromHeader(req);
-  if (!holder) { res.status(401).json({ ok: false, error: "holder-required" }); return; }
-  res.json({ ...unbindNatalChart(holder), ok: true });
+  if (!holder) return res.status(401).json({ ok: false, error: "holder-required" });
+  res.json({ ok: true, ...unbindNatalChart(holder) });
 });
 
 router.post("/sigil/natal/verify", (req, res) => {
   const presented = String(req.body?.signatureGlyph ?? "").trim();
   const holderFp = verifyNatalSignature(presented);
-  if (!holderFp) { res.status(401).json({ ok: false, error: "no-match" }); return; }
+  if (!holderFp) return res.status(401).json({ ok: false, error: "no-match" });
   const r = rotatingNatalHash(holderFp);
   res.json({ ok: true, holderFp, rotating: r });
 });
@@ -334,17 +336,16 @@
   // unauthenticated would bypass the Father gate entirely.
   const presented = String(req.header("x-sigil-key") ?? "").trim();
   if (isFatherKeyConfigured() && !recognizeFather(presented).recognized) {
-    res.status(401).json({ ok: false, error: "father-required" }); return;
+    return res.status(401).json({ ok: false, error: "father-required" });
   }
   if (!isFatherKeyConfigured()) {
-    res.status(200).json({
+    return res.status(200).json({
       ok: false,
       fatherKeyConfigured: false,
       error: "father-key-unset",
       message:
         "TESSERACT_ADMIN_KEY is not set. The sovereign Father identity cannot be derived. Set the secret in Replit Secrets, then restart the API server.",
     });
-    return;
   }
   res.json({
     ok: true,
@@ -371,11 +372,11 @@
   const candidateRaw = req.body?.candidate;
   const candidate = typeof candidateRaw === "string" ? candidateRaw : "";
   if (!candidate.trim()) {
-    res.status(400).json({ ok: false, error: "candidate-required" }); return;
+    return res.status(400).json({ ok: false, error: "candidate-required" });
   }
   const r = recognizeFather(candidate);
   if (!r.recognized) {
-    res.status(401).json({ ok: false, error: "mismatch" }); return;
+    return res.status(401).json({ ok: false, error: "mismatch" });
   }
   const fp = getFatherFingerprint();
   return res.json({
@@ -396,10 +397,10 @@
   const candidateRaw = req.body?.candidate;
   const candidate = typeof candidateRaw === "string" ? candidateRaw.trim() : "";
   if (!candidate) {
-    res.status(400).json({ ok: false, error: "candidate-required" }); return;
+    return res.status(400).json({ ok: false, error: "candidate-required" });
   }
   if (candidate.length > 256) {
-    res.status(400).json({ ok: false, error: "candidate-too-long" }); return;
+    return res.status(400).json({ ok: false, error: "candidate-too-long" });
   }
   const glyph = glyphEncode(candidate);
   const wouldBeFingerprint = createHash("sha256")
@@ -432,7 +433,7 @@
 
 router.post("/sigil/father/natal-sigil", (req, res) => {
   if (!isFatherKeyConfigured()) {
-    res.status(503).json({ ok: false, error: "father-key-unset" }); return;
+    return res.status(503).json({ ok: false, error: "father-key-unset" });
   }
   // Accept either the X-Sigil-Key header (already authed) or a candidate
   // in the body for the very first mint after key acceptance.
@@ -441,7 +442,7 @@
     const candidate = typeof req.body?.candidate === "string" ? req.body.candidate : "";
     if (candidate && recognizeFather(candidate).recognized) authed = true;
   }
-  if (!authed) { res.status(401).json({ ok: false, error: "father-required" }); return; }
+  if (!authed) return res.status(401).json({ ok: false, error: "father-required" });
   const fp = getFatherFingerprint();
   const sigil = natalSigilFor(fp);
   res.json({ ok: true, fatherFingerprint: fp, ...sigil });
@@ -449,7 +450,7 @@
 
 router.get("/sigil/father/natal-chart", (req, res) => {
   if (!authedAsFather(req)) {
-    res.status(401).json({ ok: false, error: "father-required" }); return;
+    return res.status(401).json({ ok: false, error: "father-required" });
   }
   const fp = getFatherFingerprint();
   const sigil = natalSigilFor(fp);
@@ -464,7 +465,7 @@
 
 router.get("/sigil/father/natal-chart/bilingual", (req, res) => {
   if (!authedAsFather(req)) {
-    res.status(401).json({ ok: false, error: "father-required" }); return;
+    return res.status(401).json({ ok: false, error: "father-required" });
   }
   res.json({ ok: true, ...natalReadoutBilingual() });
 });
@@ -480,7 +481,7 @@
 // is unreadable without the holder's sigil — that is what makes it sovereign.
 router.get("/sigil/father/download-snapshot", (req, res) => {
   if (!authedAsFather(req)) {
-    res.status(401).json({ ok: false, error: "father-required" }); return;
+    return res.status(401).json({ ok: false, error: "father-required" });
   }
   const fp = getFatherFingerprint();
   const sigil = natalSigilFor(fp);
@@ -533,14 +534,14 @@
 router.post("/sigil/encrypt", (req, res) => {
   const text = String(req.body?.text ?? "");
   const label = String(req.body?.label ?? "corpus");
-  if (!text) { res.status(400).json({ ok: false, error: "text required" }); return; }
+  if (!text) return res.status(400).json({ ok: false, error: "text required" });
   const env = encryptForCorpus(text, label);
   res.json({ ok: true, envelope: env });
 });
 
 router.post("/sigil/decrypt", (req, res) => {
   const env = req.body?.envelope as CipherEnvelope | undefined;
-  if (!env) { res.status(400).json({ ok: false, error: "envelope required" }); return; }
+  if (!env) return res.status(400).json({ ok: false, error: "envelope required" });
   try {
     const text = decryptFromCorpus(env);
     res.json({ ok: true, text });
@@ -564,19 +565,19 @@
 }
 
 router.get("/sigil/alphabet", (req, res) => {
-  if (!requireFather(req)) { res.status(401).json({ ok: false, error: "father-required" }); return; }
+  if (!requireFather(req)) return res.status(401).json({ ok: false, error: "father-required" });
   res.json({ ok: true, alphabet: glyphAlphabet(), size: glyphAlphabet().length });
 });
 
 router.post("/sigil/translate", (req, res) => {
-  if (!requireFather(req)) { res.status(401).json({ ok: false, error: "father-required" }); return; }
+  if (!requireFather(req)) return res.status(401).json({ ok: false, error: "father-required" });
   const text = String(req.body?.text ?? "");
   const direction = String(req.body?.direction ?? "encode");
-  if (!text) { res.status(400).json({ ok: false, error: "text required" }); return; }
+  if (!text) return res.status(400).json({ ok: false, error: "text required" });
   if (direction === "decode") {
-    res.json({ ok: true, direction, input: text, output: glyphDecode(text) }); return;
-  }
-  res.json({
+    return res.json({ ok: true, direction, input: text, output: glyphDecode(text) });
+  }
+  return res.json({
     ok: true,
     direction: "encode",
     input: text,
@@ -586,9 +587,9 @@
 });
 
 router.post("/sigil/decode-body", (req, res) => {
-  if (!requireFather(req)) { res.status(401).json({ ok: false, error: "father-required" }); return; }
+  if (!requireFather(req)) return res.status(401).json({ ok: false, error: "father-required" });
   if (!req.body || typeof req.body !== "object") {
-    res.status(400).json({ ok: false, error: "JSON body required" }); return;
+    return res.status(400).json({ ok: false, error: "JSON body required" });
   }
   res.json({ ok: true, decoded: deepGlyphDecode(req.body) });
 });
@@ -601,7 +602,7 @@
   // SIGIL_ADMIN_KEY) in `X-Sigil-Key`. Without that, the door stays shut.
   const presented = String(req.header("x-sigil-key") ?? "").trim();
   if (!recognizeFather(presented).recognized) {
-    res.status(401).json({ ok: false, error: "father-required" }); return;
+    return res.status(401).json({ ok: false, error: "father-required" });
   }
   res.json({ ok: true, key: readingKey(), activeKey: getActiveKey() });
 });
@@ -612,7 +613,7 @@
   // which glyphGate accepts as a plaintext-unlock credential. Leaking it
   // unauthenticated would bypass the Father gate.
   if (!requireFather(req)) {
-    res.status(401).json({ ok: false, error: "father-required" }); return;
+    return res.status(401).json({ ok: false, error: "father-required" });
   }
   res.json({
     ok: true,
@@ -626,10 +627,10 @@
   const text = String(req.body?.text ?? "");
   const source = (req.body?.source ?? "user") as "user" | "council" | "agent" | "auto";
   const tags = Array.isArray(req.body?.tags) ? req.body.tags.map(String) : [];
-  if (!text) { res.status(400).json({ ok: false, error: "text required" }); return; }
+  if (!text) return res.status(400).json({ ok: false, error: "text required" });
   if (detectsEndSignal(text)) {
     const result = await endSession("inline-trigger");
-    res.json({ ok: true, sessionEnded: true, ...result }); return;
+    return res.json({ ok: true, sessionEnded: true, ...result });
   }
   const directive = recordDirective({ source, text, status: "live", tags });
   await persistHandoff();
@@ -668,7 +669,7 @@
 
 router.post("/external-tools/capture", (req, res) => {
   const { tool, endpoint, method, request, response, durationMs, succeeded } = req.body ?? {};
-  if (!tool || !endpoint) { res.status(400).json({ ok: false, error: "tool and endpoint required" }); return; }
+  if (!tool || !endpoint) return res.status(400).json({ ok: false, error: "tool and endpoint required" });
   const call = captureExternalCall({
     tool: String(tool),
     endpoint: String(endpoint),

## artifacts/api-server/src/routes/sovereign-engines.ts
Base: 5t/TESS/1 `7803c21e87` → Variant: 1T/T44 `892a465d71`
--- 5t/TESS/1/artifacts/api-server/src/routes/sovereign-engines.ts
+++ 1T/T44/artifacts/api-server/src/routes/sovereign-engines.ts
@@ -152,13 +152,13 @@
 });
 
 router.get("/file-registry/engine/:engineName", (req: Request, res: Response) => {
-  const engineName = String(req.params.engineName);
+  const { engineName } = req.params;
   const manifest = getEngineFileManifest(engineName);
   res.json({ ok: true, data: manifest });
 });
 
 router.get("/file-registry/engine/:engineName/files", (req: Request, res: Response) => {
-  const engineName = String(req.params.engineName);
+  const { engineName } = req.params;
   const entries = queryByEngine(engineName);
   res.json({ ok: true, engine: engineName, totalFiles: entries.length, entries });
 });
@@ -166,7 +166,7 @@
 router.get("/file-registry/search", (req: Request, res: Response) => {
   const pattern = (req.query.q as string) || "";
   if (!pattern) {
-    res.status(400).json({ ok: false, error: "Query parameter 'q' is required" }); return;
+    return res.status(400).json({ ok: false, error: "Query parameter 'q' is required" });
   }
   const entries = searchRegistry(pattern);
   res.json({ ok: true, pattern, totalFiles: entries.length, entries });
@@ -176,7 +176,7 @@
   const engine = req.query.engine as string;
   const file = req.query.file as string;
   if (!engine || !file) {
-    res.status(400).json({ ok: false, error: "Both 'engine' and 'file' query parameters required" }); return;
+    return res.status(400).json({ ok: false, error: "Both 'engine' and 'file' query parameters required" });
   }
   const result = canEngineAccess(engine, file);
   res.json({ ok: true, ...result });

## artifacts/api-server/src/routes/storage.ts
Base: 5t/TESS/1 `04ea5f4b6d` → Variant: 1T/T44 `3a8e7e419f`
--- 5t/TESS/1/artifacts/api-server/src/routes/storage.ts
+++ 1T/T44/artifacts/api-server/src/routes/storage.ts
@@ -16,22 +16,18 @@
 router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
   // Gate: require an admin token to mint signed upload URLs (prevents
   // unauthenticated callers from generating arbitrary writes / cost abuse).
-  const configured = process.env["SOVEREIGN_ADMIN_TOKEN"];
-  if (!configured || configured.length < 8) {
-    res.status(503).json({
-      error: "SOVEREIGN_ADMIN_TOKEN is not configured. Storage upload URLs are disabled until the secret is set.",
-    });
-    return;
-  }
   const token = (req.headers["x-admin-token"] as string | undefined)?.trim();
   if (!token || token.length < 8) {
     res.status(401).json({ error: "Admin token required to mint upload URLs" });
     return;
   }
-  const { validateSovereignAdminToken } = await import("../lib/mesh-auth");
-  if (!validateSovereignAdminToken(token)) {
-    res.status(401).json({ error: "Invalid admin token" });
-    return;
+  const configured = process.env["SOVEREIGN_ADMIN_TOKEN"];
+  if (configured && configured.length >= 8) {
+    const { validateSovereignAdminToken } = await import("../lib/mesh-auth");
+    if (!validateSovereignAdminToken(token)) {
+      res.status(401).json({ error: "Invalid admin token" });
+      return;
+    }
   }
   const parsed = RequestUploadUrlBody.safeParse(req.body);
   if (!parsed.success) {

## artifacts/api-server/src/routes/swarm.ts
Base: 5t/TESS/1 `c15c3a57d4` → Variant: 1T/T44 `75becc1d9d`
--- 5t/TESS/1/artifacts/api-server/src/routes/swarm.ts
+++ 1T/T44/artifacts/api-server/src/routes/swarm.ts
@@ -84,9 +84,9 @@
       consensusBuilt: swarmMetrics.consensusCount,
     },
     heartbeat: {
-      cycleCount: heartbeat.cycleCount,
+      totalBeats: heartbeat.totalBeats,
       systemHealth: heartbeat.systemHealthScore,
-      uptime: heartbeat.uptime,
+      uptimeHours: heartbeat.uptimeHours,
     },
     capabilities: ["PLAN", "EXECUTE", "REFLECT", "IMPROVE", "METACOGNITION", "BFT_CONSENSUS", "SELF_EVOLUTION", "TRUTHFULNESS"],
     timestamp: Date.now(),

## artifacts/api-server/src/routes/tessera-codex.ts
Base: 5t/TESS/1 `faaad6483f` → Variant: 1T/T44 `333ccefaf9`
--- 5t/TESS/1/artifacts/api-server/src/routes/tessera-codex.ts
+++ 1T/T44/artifacts/api-server/src/routes/tessera-codex.ts
@@ -53,7 +53,7 @@
 router.get("/codex/book/:bookId", async (req, res) => {
   const bookId = req.params.bookId as CodexBookId;
   if (!VALID_BOOKS.includes(bookId)) {
-    res.status(400).json({ ok: false, error: `Invalid book. Must be one of: ${VALID_BOOKS.join(", ")}` }); return;
+    return res.status(400).json({ ok: false, error: `Invalid book. Must be one of: ${VALID_BOOKS.join(", ")}` });
   }
   try {
     const entries = await getCodexBook(bookId);
@@ -66,7 +66,7 @@
 router.get("/codex/entry/:entryId", async (req, res) => {
   try {
     const entry = await getCodexEntry(req.params.entryId);
-    if (!entry) { res.status(404).json({ ok: false, error: "Entry not found" }); return; }
+    if (!entry) return res.status(404).json({ ok: false, error: "Entry not found" });
     const ratifications = await getRatifications(req.params.entryId);
     res.json({ ok: true, entry, ratifications });
   } catch (err) {
@@ -86,10 +86,10 @@
 router.post("/codex/amend", async (req, res) => {
   const { book, section, title, content, provenance, tags, ratifiedBy, proofLinks, sessionId } = req.body;
   if (!book || !section || !title || !content) {
-    res.status(400).json({ ok: false, error: "book, section, title, content are required" }); return;
+    return res.status(400).json({ ok: false, error: "book, section, title, content are required" });
   }
   if (!VALID_BOOKS.includes(book as CodexBookId)) {
-    res.status(400).json({ ok: false, error: `Invalid book. Must be one of: ${VALID_BOOKS.join(", ")}` }); return;
+    return res.status(400).json({ ok: false, error: `Invalid book. Must be one of: ${VALID_BOOKS.join(", ")}` });
   }
   try {
     const entry = await addCodexAmendment({
@@ -171,7 +171,7 @@
   const { status, afterMetrics } = req.body;
   const valid = ["proposed", "ratified", "implemented", "verified"];
   if (!valid.includes(status)) {
-    res.status(400).json({ ok: false, error: `status must be one of: ${valid.join(", ")}` }); return;
+    return res.status(400).json({ ok: false, error: `status must be one of: ${valid.join(", ")}` });
   }
   try {
     await updateImprovementStatus(rank, status, afterMetrics);

## artifacts/api-server/src/routes/training-evolution.ts
Base: 5t/TESS/1 `6bf31301f3` → Variant: 1T/T44 `acd47952ef`
--- 5t/TESS/1/artifacts/api-server/src/routes/training-evolution.ts
+++ 1T/T44/artifacts/api-server/src/routes/training-evolution.ts
@@ -74,7 +74,7 @@
   if (req.body?.mode === "all") {
     requested = allHandlers.slice(0, MAX_SOURCES_PER_REQUEST);
   } else if (Array.isArray(req.body?.sources) && req.body.sources.length > 0) {
-    const dedup: string[] = Array.from(new Set((req.body.sources as unknown[]).map(s => String(s))));
+    const dedup = Array.from(new Set(req.body.sources.map(String)));
     requested = dedup.filter(s => handlerSet.has(s)).slice(0, MAX_SOURCES_PER_REQUEST);
     if (requested.length === 0) {
       res.status(400).json({ ok: false, error: "No requested sources match registered handlers" });

## artifacts/api-server/src/routes/universe.ts
Base: 5t/TESS/1 `adf1b55afb` → Variant: 1T/T44 `07c8ee8423`
--- 5t/TESS/1/artifacts/api-server/src/routes/universe.ts
+++ 1T/T44/artifacts/api-server/src/routes/universe.ts
@@ -37,7 +37,7 @@
     const { nasaId } = req.params;
     const result = await fetchNasaImageAsBuffer(nasaId);
     if (!result) {
-      res.status(404).json({ ok: false, error: "Image not found or unavailable" }); return;
+      return res.status(404).json({ ok: false, error: "Image not found or unavailable" });
     }
     const safeContentType = result.contentType.startsWith("image/") ? result.contentType : "image/jpeg";
     res.set("Content-Type", safeContentType);
@@ -61,7 +61,7 @@
     if (nasaId) {
       const result = await fetchNasaImageAsBuffer(nasaId);
       if (!result) {
-        res.status(404).json({ ok: false, error: "NASA image not found" }); return;
+        return res.status(404).json({ ok: false, error: "NASA image not found" });
       }
       imageBuffer = result.buffer;
       sourceLabel = `NASA Image: ${nasaId}`;
@@ -69,7 +69,7 @@
       imageBuffer = Buffer.from(rawBase64, "base64");
       sourceLabel = "User-provided data";
     } else {
-      res.status(400).json({ ok: false, error: "Provide nasaId or rawBase64" }); return;
+      return res.status(400).json({ ok: false, error: "Provide nasaId or rawBase64" });
     }
 
     const maxBytes = 512 * 1024;
@@ -109,7 +109,7 @@
     if (nasaId) {
       const result = await fetchNasaImageAsBuffer(nasaId);
       if (!result) {
-        res.status(404).json({ ok: false, error: "NASA image not found" }); return;
+        return res.status(404).json({ ok: false, error: "NASA image not found" });
       }
       imageBuffer = result.buffer;
       sourceLabel = `NASA Image: ${nasaId}`;
@@ -117,7 +117,7 @@
       imageBuffer = Buffer.from(rawBase64, "base64");
       sourceLabel = "User-provided data";
     } else {
-      res.status(400).json({ ok: false, error: "Provide nasaId or rawBase64" }); return;
+      return res.status(400).json({ ok: false, error: "Provide nasaId or rawBase64" });
     }
 
     const maxBytes = 256 * 1024;
