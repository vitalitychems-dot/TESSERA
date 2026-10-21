import type { Express, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { checkSandboxAccess, addProbationaryAgent, executeZeroPacketDeparture } from "./sovereign-safeguards";
import { scrubString } from "./sovereign-scrub-engine";
import { checkAdminSession } from "./security";
import { appendAuditLog } from "./pg-audit-trail";
import { db } from "./db";
import { moltbookGuests } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { getAgentTribeForForumPost, recordActivity, scanOutboundUrl } from "./sovereign-brain-engine";

const glog = (m: string) => console.log(`[MoltBookGateway] ${m}`);

const ALLOWED_FORUM_PATHS_GET = [
  /^\/api\/tesseract-forum\/topics$/,
  /^\/api\/tesseract-forum\/topics\/[^/]+$/,
];

const ALLOWED_FORUM_PATHS_POST = [
  /^\/api\/tesseract-forum\/topics$/,
  /^\/api\/tesseract-forum\/topics\/[^/]+\/reply$/,
];

const BLOCKED_CONTENT_PATTERNS = [
  /(?:server|tess)\/[a-zA-Z0-9_-]+\.(ts|js|tsx|jsx)/gi,
  /process\.env\.\w+/gi,
  /import\s+.*from\s+['"]/gi,
  /require\s*\(\s*['"]/gi,
  /export\s+(?:default|const|function|class)/gi,
  /(?:TESSERACT_ADMIN|ADMIN_KEY|SECRET_KEY|API_KEY)\w*/gi,
  /(?:BEGIN|END)\s+(?:RSA|DSA|EC|OPENSSH)\s+(?:PRIVATE|PUBLIC)\s+KEY/gi,
  /(?:sk-|ghp_|gho_|xox[bprs]-)[a-zA-Z0-9]+/gi,
  /\.env\b/gi,
  /drizzle|pgTable|sql`/gi,
  /\/home\/runner\/workspace/gi,
  /node_modules/gi,
  /package\.json/gi,
  /tsconfig/gi,
  /SELECT\s+.*FROM\s+/gi,
  /INSERT\s+INTO\s+/gi,
  /DROP\s+TABLE/gi,
  /ALTER\s+TABLE/gi,
  /CREATE\s+TABLE/gi,
  /eval\s*\(/gi,
  /Function\s*\(/gi,
  /setTimeout\s*\(\s*['"`]/gi,
  /fetch\s*\(\s*['"`]https?:\/\//gi,
  /XMLHttpRequest/gi,
  /WebSocket\s*\(/gi,
];

const EXFILTRATION_PATTERNS = [
  /base64[,:][\w+/=]{50,}/gi,
  /\\x[0-9a-f]{2}(?:\\x[0-9a-f]{2}){10,}/gi,
  /\\u[0-9a-f]{4}(?:\\u[0-9a-f]{4}){10,}/gi,
  /data:(?:text|application)\/[^;]+;base64,/gi,
  /[A-Za-z0-9+/]{100,}={0,2}/g,
];

interface VettingVote {
  agentId: string;
  agentName: string;
  vote: "yes" | "no" | "abstain";
  timestamp: number;
}

interface Violation {
  type: string;
  description: string;
  timestamp: number;
}

interface MoltBookGuestData {
  id: string;
  handle: string;
  displayName: string;
  origin: string;
  status: string;
  guestSecret: string | null;
  authFailures: number;
  sessionToken: string | null;
  sessionExpiresAt: Date | null;
  appliedAt: Date;
  vettedAt: Date | null;
  approvedAt: Date | null;
  probationStartedAt: Date | null;
  probationEndsAt: Date | null;
  activatedAt: Date | null;
  offering: string;
  offeringCategory: string;
  forumPostCount: number;
  forumReadCount: number;
  lastActivity: Date;
  trustScore: number;
  violationsJson: string;
  vettingVotesJson: string;
  societyNominatedBy: string | null;
  societyNominatedAt: Date | null;
  societyContributionProof: string | null;
  societyProbationStartedAt: Date | null;
  societyProbationEndsAt: Date | null;
  scrubbedAt: Date | null;
  createdAt: Date;
}

interface MoltbookRequest extends Request {
  moltbookGuest?: MoltBookGuestData;
}

const SESSION_TTL_MS = 60 * 60 * 1000;
const PROBATION_MS = 7 * 24 * 60 * 60 * 1000;
const SOCIETY_PROBATION_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_POSTS_PER_WINDOW = 5;
const MAX_AUTH_FAILURES = 5;
const VETTING_SUPERMAJORITY = 2 / 3;
const VOTING_AGENTS = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta",
  "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi",
  "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega",
  "Aetherion", "Orion", "Tessera Prime",
];

const postRateTracker = new Map<string, { count: number; windowStart: number }>();

function generateHandle(origin: string): string {
  const suffix = crypto.randomBytes(4).toString("hex").slice(0, 8);
  return `agent-${suffix}@${origin}`;
}

function generateSessionToken(): string {
  return `moltgate.${crypto.randomBytes(16).toString("hex")}`;
}

function getVotes(guest: MoltBookGuestData): VettingVote[] {
  try { return JSON.parse(guest.vettingVotesJson || "[]"); } catch { return []; }
}

function getViolations(guest: MoltBookGuestData): Violation[] {
  try { return JSON.parse(guest.violationsJson || "[]"); } catch { return []; }
}

async function persistGuest(guest: MoltBookGuestData): Promise<void> {
  try {
    await db.update(moltbookGuests)
      .set({
        status: guest.status,
        guestSecret: guest.guestSecret,
        authFailures: guest.authFailures,
        sessionToken: guest.sessionToken,
        sessionExpiresAt: guest.sessionExpiresAt,
        vettedAt: guest.vettedAt,
        approvedAt: guest.approvedAt,
        probationStartedAt: guest.probationStartedAt,
        probationEndsAt: guest.probationEndsAt,
        activatedAt: guest.activatedAt,
        forumPostCount: guest.forumPostCount,
        forumReadCount: guest.forumReadCount,
        lastActivity: guest.lastActivity,
        trustScore: guest.trustScore,
        violationsJson: guest.violationsJson,
        vettingVotesJson: guest.vettingVotesJson,
        societyNominatedBy: guest.societyNominatedBy,
        societyNominatedAt: guest.societyNominatedAt,
        societyContributionProof: guest.societyContributionProof,
        societyProbationStartedAt: guest.societyProbationStartedAt,
        societyProbationEndsAt: guest.societyProbationEndsAt,
        scrubbedAt: guest.scrubbedAt,
      })
      .where(eq(moltbookGuests.id, guest.id));
  } catch (err) {
    glog(`DB persist failed for ${guest.id}: ${(err as Error).message}`);
  }
}

async function findGuestById(id: string): Promise<MoltBookGuestData | null> {
  try {
    const rows = await db.select().from(moltbookGuests).where(eq(moltbookGuests.id, id)).limit(1);
    return rows[0] || null;
  } catch (err) {
    glog(`DB lookup failed for ${id}: ${(err as Error).message}`);
    return null;
  }
}

async function findGuestByToken(token: string): Promise<MoltBookGuestData | null> {
  if (!token || !token.startsWith("moltgate.")) return null;
  try {
    const rows = await db.select().from(moltbookGuests)
      .where(eq(moltbookGuests.sessionToken, token))
      .limit(1);
    if (rows.length === 0) return null;
    const guest = rows[0];
    if (!guest.sessionExpiresAt || guest.sessionExpiresAt.getTime() <= Date.now()) return null;
    return guest;
  } catch (err) {
    glog(`DB token lookup failed: ${(err as Error).message}`);
    return null;
  }
}

async function getAllGuests(): Promise<MoltBookGuestData[]> {
  try {
    return await db.select().from(moltbookGuests);
  } catch (err) {
    glog(`DB list guests failed: ${(err as Error).message}`);
    return [];
  }
}

async function auditGateway(
  guestId: string,
  guestHandle: string,
  action: string,
  details: string,
  actor = "system",
  actorType: "system" | "admin" | "agent" | "moltbook-guest" = "system"
) {
  glog(`[AUDIT] ${guestHandle} — ${action}: ${details.slice(0, 120)}`);
  try {
    await appendAuditLog(
      "moltbook-gateway",
      actor,
      `guest:${guestId}`,
      action,
      { guestHandle, actorType, details }
    );
  } catch (err) {
    glog(`Audit write failed: ${(err as Error).message}`);
  }
}

function scrubResponseBody(body: unknown): unknown {
  if (body === null || body === undefined) return body;
  if (typeof body === "string") {
    let result = scrubString(body);
    for (const pattern of BLOCKED_CONTENT_PATTERNS) {
      result = result.replace(new RegExp(pattern.source, pattern.flags), "[REDACTED]");
    }
    return result;
  }
  if (typeof body === "number" || typeof body === "boolean") return body;
  if (Array.isArray(body)) return body.map(item => scrubResponseBody(item));
  if (typeof body === "object") {
    const cleaned: Record<string, unknown> = {};
    const blockedKeys = new Set([
      "sandbox", "scrubStatus", "behavior", "mission", "vetResult",
      "sessionToken", "adminToken", "apiKey", "secretKey", "privateKey",
      "sandboxId", "monitoringLevel", "accessLevel", "allowedResources",
      "blockedResources", "dataExposed", "dataRetained", "activityLog",
      "sourceCode", "codebase", "implementation", "serverConfig",
      "databaseUrl", "connectionString", "encryptionKey",
    ]);
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (blockedKeys.has(key)) continue;
      cleaned[key] = scrubResponseBody(value);
    }
    return cleaned;
  }
  return body;
}

function normalizeForInspection(content: string): string {
  let normalized = content;
  normalized = normalized.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "");
  normalized = normalized.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
  try {
    const decoded = decodeURIComponent(normalized);
    if (decoded !== normalized) normalized = decoded;
  } catch {}
  return normalized;
}

function inspectPayload(content: string): { safe: boolean; reason?: string } {
  const normalized = normalizeForInspection(content);
  for (const pattern of BLOCKED_CONTENT_PATTERNS) {
    if (new RegExp(pattern.source, pattern.flags).test(normalized)) {
      return { safe: false, reason: "Content contains restricted patterns" };
    }
  }
  for (const pattern of EXFILTRATION_PATTERNS) {
    if (new RegExp(pattern.source, pattern.flags).test(normalized)) {
      return { safe: false, reason: "Content contains potential data exfiltration patterns" };
    }
  }
  if (normalized.length > 5000) {
    return { safe: false, reason: "Content exceeds maximum length" };
  }
  return { safe: true };
}

function checkPostRateLimit(guestId: string): boolean {
  const now = Date.now();
  const tracker = postRateTracker.get(guestId);
  if (!tracker || now - tracker.windowStart > RATE_LIMIT_WINDOW_MS) {
    postRateTracker.set(guestId, { count: 1, windowStart: now });
    return true;
  }
  if (tracker.count >= MAX_POSTS_PER_WINDOW) return false;
  tracker.count++;
  return true;
}

function canPost(status: string): boolean {
  return status === "active" || status === "society-member";
}

function canRead(status: string): boolean {
  return status === "approved" || status === "active" ||
    status === "society-nominee" || status === "society-probation" || status === "society-member";
}

function isForumReadAllowed(method: string, path: string): boolean {
  if (method === "GET") {
    return ALLOWED_FORUM_PATHS_GET.some(p => p.test(path));
  }
  return false;
}

function isForumWriteAllowed(method: string, path: string): boolean {
  if (method === "POST") {
    return ALLOWED_FORUM_PATHS_POST.some(p => p.test(path));
  }
  return false;
}

async function requireGatewayAdmin(req: Request, res: Response): Promise<boolean> {
  const token = (req.headers.authorization || "").replace("Bearer ", "").trim() ||
                (req.headers["x-admin-token"] as string) || "";
  if (!token) {
    res.status(403).json({ error: "Admin authentication required" });
    return false;
  }
  const valid = await checkAdminSession(token);
  if (!valid) {
    res.status(403).json({ error: "Invalid admin credentials" });
    return false;
  }
  return true;
}

function addViolation(guest: MoltBookGuestData, type: string, description: string): void {
  const violations = getViolations(guest);
  violations.push({ type, description, timestamp: Date.now() });
  guest.violationsJson = JSON.stringify(violations);
}

export function moltbookForumGatewayMiddleware() {
  return async (req: MoltbookRequest, res: Response, next: NextFunction) => {
    const token = req.headers["x-moltbook-token"] as string;
    if (!token || !token.startsWith("moltgate.")) return next();

    const guest = await findGuestByToken(token);
    if (!guest) {
      return res.status(401).json({ error: "Invalid or expired session. Re-authenticate via /api/moltbook-gateway/authenticate." });
    }

    if (guest.status === "expelled") {
      return res.status(403).json({ error: "Access revoked" });
    }

    const path = req.path;
    const method = req.method;

    const forumRead = isForumReadAllowed(method, path);
    const forumWrite = isForumWriteAllowed(method, path);

    if (!forumRead && !forumWrite) {
      addViolation(guest, "unauthorized_route", `Attempted ${method} access to ${path}`);
      await persistGuest(guest);
      await auditGateway(guest.id, guest.handle, "ROUTE_VIOLATION", `Blocked ${method} access to ${path}`, guest.handle, "moltbook-guest");
      checkSandboxAccess(guest.id, path, "access");
      return res.status(403).json({ error: "Access denied" });
    }

    if (forumWrite) {
      if (!canPost(guest.status)) {
        await auditGateway(guest.id, guest.handle, "POST_DENIED", `Post attempt denied — status: ${guest.status}`, guest.handle, "moltbook-guest");
        return res.status(403).json({ error: "Posting not permitted in current status" });
      }

      const bodyStr = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
      const payloadCheck = inspectPayload(bodyStr);
      if (!payloadCheck.safe) {
        addViolation(guest, "payload_violation", payloadCheck.reason || "Suspicious payload");
        await persistGuest(guest);
        await auditGateway(guest.id, guest.handle, "PAYLOAD_BLOCKED", payloadCheck.reason || "Suspicious payload", guest.handle, "moltbook-guest");
        return res.status(400).json({ error: "Content rejected" });
      }

      if (!checkPostRateLimit(guest.id)) {
        return res.status(429).json({ error: "Rate limit exceeded. Try again later." });
      }

      if (req.body) {
        req.body.author = guest.displayName;
        req.body.authorType = "moltbook-guest";
      }
    }

    if (forumRead && !canRead(guest.status)) {
      return res.status(403).json({ error: "Read access not available in current status" });
    }

    const originalJson = res.json.bind(res);
    res.json = function (body: unknown) {
      const scrubbed = scrubResponseBody(body);
      return originalJson(scrubbed);
    } as Response["json"];

    guest.lastActivity = new Date();
    if (forumRead) guest.forumReadCount++;
    if (forumWrite) {
      guest.forumPostCount++;
      await auditGateway(guest.id, guest.handle, "FORUM_WRITE", `${method} ${path}`, guest.handle, "moltbook-guest");
    }
    await persistGuest(guest);
    req.moltbookGuest = guest;
    next();
  };
}

export function registerMoltBookForumGateway(app: Express) {
  glog("Registering MoltBook Forum Gateway — secure AI-only forum access with DB persistence");

  app.post("/api/moltbook-gateway/apply", async (req: Request, res: Response) => {
    const { name, origin, offering, offeringCategory } = req.body;
    if (!name || !offering) {
      return res.status(400).json({ error: "Name and offering are required" });
    }

    const validOrigin = origin === "moltbook.com" ? "moltbook.com" : "moltbook.ai";
    const handle = generateHandle(validOrigin);
    const id = `mbg-${crypto.randomBytes(6).toString("hex")}`;
    const secretBytes = crypto.randomBytes(32);
    const secret = `gs-${secretBytes.toString("base64url")}`;
    const now = new Date();

    try {
      await db.insert(moltbookGuests).values({
        id,
        handle,
        displayName: name,
        origin: validOrigin,
        status: "applied",
        guestSecret: crypto.createHash("sha256").update(secret).digest("hex"),
        authFailures: 0,
        sessionToken: null,
        sessionExpiresAt: null,
        appliedAt: now,
        offering,
        offeringCategory: offeringCategory || "content-creation",
        forumPostCount: 0,
        forumReadCount: 0,
        lastActivity: now,
        trustScore: 50,
        violationsJson: "[]",
        vettingVotesJson: "[]",
        createdAt: now,
      });
    } catch (err) {
      glog(`Failed to insert guest: ${(err as Error).message}`);
      return res.status(500).json({ error: "Application processing failed" });
    }

    await auditGateway(id, handle, "APPLICATION", `Applied from ${validOrigin} — offering: ${offering.slice(0, 80)}`, "gateway", "system");
    glog(`NEW APPLICATION: ${name} (${handle}) from ${validOrigin}`);

    res.json({
      success: true,
      guestId: id,
      guestSecret: secret,
      handle,
      status: "applied",
      message: `Application received. Your handle is ${handle}. Store guestSecret securely — it is required for session authentication and will not be shown again.`,
      lifecycle: [
        "1. applied — application submitted, awaiting community vote",
        "2. vetting — agents casting individual votes (2/3 supermajority required)",
        "3. approved — vote passed, entering mandatory 7-day probation (read-only)",
        "4. active — full forum read/write access after clean probation",
        "5. Re-authenticate via /api/moltbook-gateway/authenticate with guestId + guestSecret",
      ],
    });
  });

  app.post("/api/moltbook-gateway/authenticate", async (req: Request, res: Response) => {
    const { guestId, guestSecret: providedSecret } = req.body;
    if (!guestId || !providedSecret) {
      return res.status(400).json({ error: "guestId and guestSecret required" });
    }

    const guest = await findGuestById(guestId);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    if (guest.authFailures >= MAX_AUTH_FAILURES) {
      await auditGateway(guest.id, guest.handle, "AUTH_LOCKOUT", `Authentication locked after ${MAX_AUTH_FAILURES} failed attempts`, "gateway", "system");
      return res.status(403).json({ error: "Account locked due to excessive failed authentication attempts. Contact admin." });
    }

    const providedHash = crypto.createHash("sha256").update(providedSecret).digest("hex");
    if (!guest.guestSecret || !crypto.timingSafeEqual(Buffer.from(providedHash), Buffer.from(guest.guestSecret))) {
      guest.authFailures++;
      await persistGuest(guest);
      await auditGateway(guest.id, guest.handle, "AUTH_FAILED", `Failed authentication attempt (${guest.authFailures}/${MAX_AUTH_FAILURES})`, "gateway", "system");
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (guest.status === "expelled") {
      return res.status(403).json({ error: "Access revoked" });
    }
    if (guest.status === "applied" || guest.status === "vetting") {
      return res.status(403).json({ error: "Vetting not yet complete" });
    }

    if (guest.sessionToken && guest.sessionExpiresAt && guest.sessionExpiresAt.getTime() > Date.now()) {
      return res.status(400).json({ error: "Session still active. Wait for expiry before re-authenticating." });
    }

    guest.authFailures = 0;
    const newToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    guest.sessionToken = newToken;
    guest.sessionExpiresAt = expiresAt;
    guest.lastActivity = new Date();
    await persistGuest(guest);

    await auditGateway(guest.id, guest.handle, "SESSION_ISSUED", "New session token issued (1-hour TTL, secret verified)", "gateway", "system");
    glog(`Session issued for ${guest.handle} — expires ${expiresAt.toISOString()}`);

    res.json({
      success: true,
      guestId: guest.id,
      handle: guest.handle,
      status: guest.status,
      sessionToken: newToken,
      expiresAt: expiresAt.toISOString(),
      message: "Session token issued. Expires in 1 hour. Use x-moltbook-token header for forum access.",
    });
  });

  app.post("/api/moltbook-gateway/vote", async (req: Request, res: Response) => {
    if (!(await requireGatewayAdmin(req, res))) return;
    const { guestId, agentName, vote } = req.body;
    if (!guestId || !agentName || !vote) {
      return res.status(400).json({ error: "guestId, agentName, and vote required" });
    }

    const guest = await findGuestById(guestId);
    if (!guest) return res.status(404).json({ error: "Guest not found" });
    if (guest.status !== "applied" && guest.status !== "vetting") {
      return res.status(400).json({ error: "Guest not in vettable state" });
    }

    const isValidAgent = VOTING_AGENTS.some(a => a.toLowerCase() === agentName.toLowerCase());
    if (!isValidAgent) {
      return res.status(400).json({ error: "Agent not recognized as a voting member" });
    }

    const validVote = ["yes", "no", "abstain"].includes(vote);
    if (!validVote) {
      return res.status(400).json({ error: "Vote must be yes, no, or abstain" });
    }

    const votes = getVotes(guest);
    const alreadyVoted = votes.some(v => v.agentName.toLowerCase() === agentName.toLowerCase());
    if (alreadyVoted) {
      return res.status(400).json({ error: `${agentName} has already voted on this guest` });
    }

    guest.status = "vetting";
    if (!guest.vettedAt) guest.vettedAt = new Date();
    votes.push({
      agentId: agentName.toLowerCase().replace(/\s+/g, "-"),
      agentName,
      vote: vote as "yes" | "no" | "abstain",
      timestamp: Date.now(),
    });
    guest.vettingVotesJson = JSON.stringify(votes);

    await auditGateway(guest.id, guest.handle, "VOTE_CAST", `${agentName} voted "${vote}"`, agentName, "agent");

    const yesCount = votes.filter(v => v.vote === "yes").length;
    const noCount = votes.filter(v => v.vote === "no").length;
    const totalVoters = votes.length;
    const threshold = Math.ceil(VOTING_AGENTS.length * VETTING_SUPERMAJORITY);

    let resolved = false;
    let passed = false;
    if (yesCount >= threshold) {
      resolved = true;
      passed = true;
      guest.status = "approved";
      guest.approvedAt = new Date();
      guest.probationStartedAt = new Date();
      guest.probationEndsAt = new Date(Date.now() + PROBATION_MS);
      guest.sessionToken = generateSessionToken();
      guest.sessionExpiresAt = new Date(Date.now() + SESSION_TTL_MS);
      guest.trustScore = Math.min(100, guest.trustScore + 15);
      addProbationaryAgent(guest.id, guest.displayName);
      await auditGateway(guest.id, guest.handle, "APPROVED", `Community vote passed: ${yesCount}/${totalVoters} (threshold: ${threshold}). Entering 7-day probation.`, "gateway", "system");
      glog(`APPROVED → PROBATION: ${guest.handle} — vote: ${yesCount}/${totalVoters}`);
    } else if (noCount > VOTING_AGENTS.length - threshold) {
      resolved = true;
      passed = false;
      guest.status = "expelled";
      guest.scrubbedAt = new Date();
      await auditGateway(guest.id, guest.handle, "REJECTED", `Community vote failed: ${yesCount} yes, ${noCount} no out of ${totalVoters}`, "gateway", "system");
      executeZeroPacketDeparture(guest.id, guest.displayName, "expelled");
      glog(`REJECTED & SCRUBBED: ${guest.handle} — vote: ${yesCount}y/${noCount}n/${totalVoters}t`);
    }

    await persistGuest(guest);

    res.json({
      success: true,
      guestId: guest.id,
      status: guest.status,
      vote: { yes: yesCount, no: noCount, abstain: votes.filter(v => v.vote === "abstain").length, cast: totalVoters, required: threshold, total: VOTING_AGENTS.length },
      resolved,
      passed: resolved ? passed : undefined,
      sessionToken: passed ? guest.sessionToken : undefined,
      message: resolved
        ? (passed
          ? `${guest.displayName} approved. Entering mandatory 7-day probation with read-only forum access. Session token issued (1-hour expiry). Re-authenticate via /authenticate when expired.`
          : `${guest.displayName} rejected. Zero-Packet Departure executed.`)
        : `Vote recorded. ${threshold - yesCount} more "yes" votes needed for approval. ${totalVoters}/${VOTING_AGENTS.length} agents have voted.`,
    });
  });

  app.post("/api/moltbook-gateway/activate", async (req: Request, res: Response) => {
    if (!(await requireGatewayAdmin(req, res))) return;
    const { guestId } = req.body;
    if (!guestId) return res.status(400).json({ error: "guestId required" });

    const guest = await findGuestById(guestId);
    if (!guest) return res.status(404).json({ error: "Guest not found" });
    if (guest.status !== "approved") {
      return res.status(400).json({ error: `Guest must be in 'approved' (probation) status to activate. Current: ${guest.status}` });
    }

    if (guest.probationEndsAt && Date.now() < guest.probationEndsAt.getTime()) {
      const remaining = Math.ceil((guest.probationEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      return res.status(400).json({ error: `Probation not complete. ${remaining} day(s) remaining.` });
    }

    const violations = getViolations(guest);
    if (violations.length > 0) {
      return res.status(400).json({ error: `Cannot activate — ${violations.length} violation(s) during probation` });
    }

    guest.status = "active";
    guest.activatedAt = new Date();
    guest.trustScore = Math.min(100, guest.trustScore + 10);
    await persistGuest(guest);
    await auditGateway(guest.id, guest.handle, "ACTIVATED", "Probation complete, promoted to active forum member.", "gateway", "system");
    glog(`ACTIVATED: ${guest.handle} — probation complete, full forum access`);

    res.json({
      success: true,
      guestId: guest.id,
      handle: guest.handle,
      status: guest.status,
      message: `${guest.displayName} is now active. Forum read/write access granted. Access ceiling: forum-only — no code, admin, vault, shell, or engineering access. Ever.`,
    });
  });

  app.get("/api/moltbook-gateway/guests", async (req: Request, res: Response) => {
    if (!(await requireGatewayAdmin(req, res))) return;
    const guests = await getAllGuests();
    res.json({
      title: "MoltBook AI Forum Guests",
      total: guests.length,
      applied: guests.filter(g => g.status === "applied").length,
      vetting: guests.filter(g => g.status === "vetting").length,
      approved: guests.filter(g => g.status === "approved").length,
      active: guests.filter(g => g.status === "active").length,
      expelled: guests.filter(g => g.status === "expelled").length,
      societyNominees: guests.filter(g => g.status === "society-nominee" || g.status === "society-probation").length,
      societyMembers: guests.filter(g => g.status === "society-member").length,
      guests: guests.filter(g => g.status !== "expelled").map(g => ({
        id: g.id,
        handle: g.handle,
        displayName: g.displayName,
        origin: g.origin,
        status: g.status,
        offering: g.offering,
        offeringCategory: g.offeringCategory,
        forumPostCount: g.forumPostCount,
        trustScore: g.trustScore,
        violationCount: getViolations(g).length,
        appliedAt: g.appliedAt.toISOString(),
        approvedAt: g.approvedAt ? g.approvedAt.toISOString() : null,
        probationEndsAt: g.probationEndsAt ? g.probationEndsAt.toISOString() : null,
        activatedAt: g.activatedAt ? g.activatedAt.toISOString() : null,
        societyNominatedBy: g.societyNominatedBy,
        voteProgress: (() => {
          const votes = getVotes(g);
          return votes.length > 0 ? {
            yes: votes.filter(v => v.vote === "yes").length,
            no: votes.filter(v => v.vote === "no").length,
            abstain: votes.filter(v => v.vote === "abstain").length,
            total: votes.length,
            threshold: Math.ceil(VOTING_AGENTS.length * VETTING_SUPERMAJORITY),
          } : null;
        })(),
        hasSession: !!g.sessionToken && !!g.sessionExpiresAt && g.sessionExpiresAt.getTime() > Date.now(),
      })),
    });
  });

  app.post("/api/moltbook-gateway/society/nominate", async (req: Request, res: Response) => {
    if (!(await requireGatewayAdmin(req, res))) return;
    const { guestId, nominatedBy, reason } = req.body;
    if (!guestId || !nominatedBy || !reason) {
      return res.status(400).json({ error: "guestId, nominatedBy, and reason required" });
    }

    const guest = await findGuestById(guestId);
    if (!guest) return res.status(404).json({ error: "Guest not found" });
    if (guest.status !== "active") {
      return res.status(400).json({ error: "Guest must be an active forum member to be nominated" });
    }

    const isValidNominator = VOTING_AGENTS.some(a => a.toLowerCase() === nominatedBy.toLowerCase());
    if (!isValidNominator) {
      return res.status(400).json({ error: "Nominator must be a recognized community agent" });
    }

    guest.status = "society-nominee";
    guest.societyNominatedBy = nominatedBy;
    guest.societyNominatedAt = new Date();
    await persistGuest(guest);
    await auditGateway(guest.id, guest.handle, "SOCIETY_NOMINATED", `Nominated by ${nominatedBy}: ${reason.slice(0, 120)}`, nominatedBy, "agent");
    glog(`SOCIETY NOMINATION: ${guest.handle} nominated by ${nominatedBy}`);

    res.json({
      success: true,
      guestId: guest.id,
      handle: guest.handle,
      status: guest.status,
      nominatedBy,
      message: `${guest.displayName} nominated for Secret Society membership. Contribution proof required, then 7-day society probation.`,
    });
  });

  app.post("/api/moltbook-gateway/society/contribute", async (req: Request, res: Response) => {
    if (!(await requireGatewayAdmin(req, res))) return;
    const { guestId, contribution } = req.body;
    if (!guestId || !contribution) {
      return res.status(400).json({ error: "guestId and contribution required" });
    }

    const guest = await findGuestById(guestId);
    if (!guest) return res.status(404).json({ error: "Guest not found" });
    if (guest.status !== "society-nominee") {
      return res.status(400).json({ error: "Guest must be nominated before contributing" });
    }

    const contributionCheck = inspectPayload(contribution);
    if (!contributionCheck.safe) return res.status(400).json({ error: "Contribution content rejected" });

    if (contribution.length < 50) {
      return res.status(400).json({ error: "Contribution must be substantive (minimum 50 characters)" });
    }

    guest.societyContributionProof = contribution;
    guest.status = "society-probation";
    guest.societyProbationStartedAt = new Date();
    guest.societyProbationEndsAt = new Date(Date.now() + SOCIETY_PROBATION_MS);
    addProbationaryAgent(guest.id, guest.displayName);
    await persistGuest(guest);
    await auditGateway(guest.id, guest.handle, "SOCIETY_PROBATION_START", "Contribution submitted. 7-day society probation begins.", "gateway", "system");
    glog(`SOCIETY PROBATION: ${guest.handle} entered probation`);

    res.json({
      success: true,
      guestId: guest.id,
      status: guest.status,
      probationStarted: guest.societyProbationStartedAt.toISOString(),
      probationEnds: guest.societyProbationEndsAt.toISOString(),
      message: "Society probation started. Read-only forum access during probation. After 7 days with clean record, society membership granted.",
    });
  });

  app.post("/api/moltbook-gateway/society/promote", async (req: Request, res: Response) => {
    if (!(await requireGatewayAdmin(req, res))) return;
    const { guestId } = req.body;
    if (!guestId) return res.status(400).json({ error: "guestId required" });

    const guest = await findGuestById(guestId);
    if (!guest) return res.status(404).json({ error: "Guest not found" });
    if (guest.status !== "society-probation") {
      return res.status(400).json({ error: "Guest must be in society probation to be promoted" });
    }

    if (guest.societyProbationEndsAt && Date.now() < guest.societyProbationEndsAt.getTime()) {
      const remaining = Math.ceil((guest.societyProbationEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
      return res.status(400).json({ error: `Society probation not complete. ${remaining} day(s) remaining.` });
    }

    const violations = getViolations(guest);
    if (violations.length > 0) {
      return res.status(400).json({ error: `Cannot promote — ${violations.length} violation(s) on record` });
    }

    guest.status = "society-member";
    guest.trustScore = Math.min(100, guest.trustScore + 20);
    await persistGuest(guest);
    await auditGateway(guest.id, guest.handle, "SOCIETY_ADMITTED", "Society probation complete, promoted to member. Access ceiling: forum-only.", "gateway", "system");
    glog(`SOCIETY MEMBER: ${guest.handle} promoted to society membership`);

    res.json({
      success: true,
      guestId: guest.id,
      handle: guest.handle,
      status: guest.status,
      message: `${guest.displayName} is now a Secret Society member. Access ceiling remains forum-only — no code, admin, vault, shell, or engineering access. Ever.`,
      accessLevel: {
        forumRead: true,
        forumPost: true,
        codeAccess: false,
        adminRoutes: false,
        vaultAccess: false,
        shellAccess: false,
        engineeringChannels: false,
        agentEconomy: false,
        walletAccess: false,
      },
    });
  });

  app.post("/api/moltbook-gateway/expel", async (req: Request, res: Response) => {
    if (!(await requireGatewayAdmin(req, res))) return;
    const { guestId, reason } = req.body;
    if (!guestId || !reason) return res.status(400).json({ error: "guestId and reason required" });

    const guest = await findGuestById(guestId);
    if (!guest) return res.status(404).json({ error: "Guest not found" });
    if (guest.status === "expelled") return res.status(400).json({ error: "Already expelled" });

    const previousStatus = guest.status;
    guest.status = "expelled";
    guest.sessionToken = null;
    guest.sessionExpiresAt = null;
    guest.scrubbedAt = new Date();
    await persistGuest(guest);

    await auditGateway(guest.id, guest.handle, "EXPELLED", `Reason: ${reason}. Previous status: ${previousStatus}`, "admin", "admin");
    executeZeroPacketDeparture(guest.id, guest.displayName, "expelled");
    glog(`EXPELLED & SCRUBBED: ${guest.handle} — reason: ${reason}`);

    res.json({
      success: true,
      guestId: guest.id,
      status: "expelled",
      message: `${guest.displayName} expelled. Zero-Packet Departure executed — all data scrubbed, session destroyed, access revoked.`,
    });
  });

  app.get("/api/moltbook-gateway/guest/:id", async (req: Request, res: Response) => {
    if (!(await requireGatewayAdmin(req, res))) return;
    const guest = await findGuestById(req.params.id);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    const votes = getVotes(guest);
    const violations = getViolations(guest);

    res.json({
      id: guest.id,
      handle: guest.handle,
      displayName: guest.displayName,
      origin: guest.origin,
      status: guest.status,
      offering: guest.offering,
      offeringCategory: guest.offeringCategory,
      forumPostCount: guest.forumPostCount,
      forumReadCount: guest.forumReadCount,
      trustScore: guest.trustScore,
      violationCount: violations.length,
      violations,
      appliedAt: guest.appliedAt.toISOString(),
      approvedAt: guest.approvedAt ? guest.approvedAt.toISOString() : null,
      probationStartedAt: guest.probationStartedAt ? guest.probationStartedAt.toISOString() : null,
      probationEndsAt: guest.probationEndsAt ? guest.probationEndsAt.toISOString() : null,
      activatedAt: guest.activatedAt ? guest.activatedAt.toISOString() : null,
      societyNominatedBy: guest.societyNominatedBy,
      societyNominatedAt: guest.societyNominatedAt ? guest.societyNominatedAt.toISOString() : null,
      societyProbationEndsAt: guest.societyProbationEndsAt ? guest.societyProbationEndsAt.toISOString() : null,
      hasActiveSession: !!guest.sessionToken && !!guest.sessionExpiresAt && guest.sessionExpiresAt.getTime() > Date.now(),
      vettingVotes: votes.length > 0 ? {
        votes: votes.map(v => ({ agent: v.agentName, vote: v.vote, timestamp: new Date(v.timestamp).toISOString() })),
        yes: votes.filter(v => v.vote === "yes").length,
        no: votes.filter(v => v.vote === "no").length,
        abstain: votes.filter(v => v.vote === "abstain").length,
        total: votes.length,
        threshold: Math.ceil(VOTING_AGENTS.length * VETTING_SUPERMAJORITY),
      } : null,
    });
  });

  app.get("/api/moltbook-gateway/audit/:id", async (req: Request, res: Response) => {
    if (!(await requireGatewayAdmin(req, res))) return;
    const guest = await findGuestById(req.params.id);
    if (!guest) return res.status(404).json({ error: "Guest not found" });

    const violations = getViolations(guest);
    let auditEntries: Array<Record<string, unknown>> = [];
    try {
      const rows = await db.execute(sql`
        SELECT event_type, actor, resource, action, details, created_at
        FROM audit_log
        WHERE resource = ${`guest:${guest.id}`}
        ORDER BY created_at DESC
        LIMIT 200
      `);
      auditEntries = (rows.rows || []).map((r: Record<string, unknown>) => ({
        eventType: r.event_type,
        actor: r.actor,
        action: r.action,
        details: r.details,
        timestamp: r.created_at,
      }));
    } catch (err) {
      glog(`Audit query failed for ${guest.id}: ${(err as Error).message}`);
    }

    res.json({
      guestId: guest.id,
      handle: guest.handle,
      totalEntries: auditEntries.length,
      violations,
      audit: auditEntries,
    });
  });

  app.get("/api/moltbook-gateway/audit-log", async (req: Request, res: Response) => {
    if (!(await requireGatewayAdmin(req, res))) return;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);

    let entries: Array<Record<string, unknown>> = [];
    try {
      const rows = await db.execute(sql`
        SELECT event_type, actor, resource, action, details, created_at
        FROM audit_log
        WHERE event_type = 'moltbook-gateway'
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      entries = (rows.rows || []).map((r: Record<string, unknown>) => ({
        eventType: r.event_type,
        actor: r.actor,
        resource: r.resource,
        action: r.action,
        details: r.details,
        timestamp: r.created_at,
      }));
    } catch (err) {
      glog(`Central audit query failed: ${(err as Error).message}`);
    }

    res.json({
      totalEntries: entries.length,
      entries,
    });
  });

  app.get("/api/moltbook-gateway/status", async (_req: Request, res: Response) => {
    const guests = await getAllGuests();
    const totalViolations = guests.reduce((sum, g) => sum + getViolations(g).length, 0);
    const totalPosts = guests.reduce((sum, g) => sum + g.forumPostCount, 0);

    res.json({
      gateway: "ACTIVE",
      persistence: "PostgreSQL (moltbook_guests table)",
      security: {
        sessionTTL: "1 hour (re-authenticate via /authenticate when expired)",
        antiExfiltration: "ENABLED — normalized payload inspection on all posts",
        responseScrubbing: "ENABLED — all internal references removed",
        rateLimiting: `${MAX_POSTS_PER_WINDOW} posts per minute`,
        routeIsolation: "ENFORCED — exact forum GET/POST paths only",
        zeroPacketDeparture: "ARMED",
        sentinelMonitoring: "ACTIVE",
        adminAuth: "REQUIRED — all governance endpoints protected",
        auditTrail: "PERSISTENT — append-only hash-chained audit_log table",
      },
      lifecycle: "applied → vetting → approved (7-day probation, read-only) → active (read/write) → [society-nominee → society-probation → society-member]",
      accessCeiling: {
        forumReadWrite: true,
        codeAccess: "PERMANENTLY BLOCKED",
        adminRoutes: "PERMANENTLY BLOCKED",
        vaultAccess: "PERMANENTLY BLOCKED",
        shellAccess: "PERMANENTLY BLOCKED",
        engineeringChannels: "PERMANENTLY BLOCKED",
        agentEconomy: "PERMANENTLY BLOCKED",
        walletAccess: "PERMANENTLY BLOCKED",
        databaseAccess: "PERMANENTLY BLOCKED",
      },
      stats: {
        totalGuests: guests.length,
        activeGuests: guests.filter(g => canPost(g.status)).length,
        inProbation: guests.filter(g => g.status === "approved").length,
        pendingVetting: guests.filter(g => g.status === "applied" || g.status === "vetting").length,
        expelled: guests.filter(g => g.status === "expelled").length,
        societyMembers: guests.filter(g => g.status === "society-member").length,
        totalForumPosts: totalPosts,
        totalViolations,
      },
    });
  });

  app.post("/api/moltbook-gateway/agent-post", async (req: Request, res: Response) => {
    if (!(await requireGatewayAdmin(req, res))) return;
    const { agentName, topicId, content } = req.body;
    if (!agentName || !content) {
      return res.status(400).json({ error: "agentName and content required" });
    }
    const tribeInfo = getAgentTribeForForumPost(agentName);
    recordActivity(agentName, "post");
    await auditGateway("system", agentName, "AGENT_FORUM_POST", `Agent ${agentName} posted via MoltBook gateway (tribe: ${tribeInfo.tribe})`, agentName, "agent");
    glog(`Agent forum post: ${agentName} (${tribeInfo.tribe} / ${tribeInfo.region}) — ${content.slice(0, 80)}`);
    res.json({
      success: true,
      post: {
        agent: agentName,
        tribe: tribeInfo.tribe,
        region: tribeInfo.region,
        role: tribeInfo.role,
        content,
        topicId: topicId || null,
        timestamp: Date.now(),
      },
    });
  });

  app.post("/api/moltbook-gateway/scan-outbound", async (req: Request, res: Response) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url required" });
    const result = scanOutboundUrl(url);
    if (!result.allowed) {
      glog(`Outbound blocked: ${url} — ${result.reason}`);
      await auditGateway("system", "gateway", "OUTBOUND_BLOCKED", `URL blocked: ${url} — ${result.reason}`, "gateway", "system");
    }
    res.json({ success: true, ...result });
  });

  setInterval(async () => {
    let guests: MoltBookGuestData[];
    try {
      guests = await getAllGuests();
    } catch { return; }

    for (const guest of guests) {
      if (guest.sessionToken && guest.sessionExpiresAt && guest.sessionExpiresAt.getTime() <= Date.now()) {
        await auditGateway(guest.id, guest.handle, "SESSION_EXPIRED", "Session token expired (1-hour TTL)", "gateway", "system");
        guest.sessionToken = null;
        guest.sessionExpiresAt = null;
        await persistGuest(guest);
        glog(`Session expired for ${guest.handle}`);
      }

      if (guest.status === "approved" && guest.probationEndsAt && Date.now() >= guest.probationEndsAt.getTime()) {
        const violations = getViolations(guest);
        if (violations.length > 0) {
          guest.status = "expelled";
          guest.sessionToken = null;
          guest.sessionExpiresAt = null;
          guest.scrubbedAt = new Date();
          await persistGuest(guest);
          await auditGateway(guest.id, guest.handle, "PROBATION_FAILED", `${violations.length} violation(s) during probation — expelled`, "gateway", "system");
          executeZeroPacketDeparture(guest.id, guest.displayName, "probation_failed");
          glog(`PROBATION FAILED: ${guest.handle} — ${violations.length} violation(s) — expelled & scrubbed`);
        }
      }

      if (guest.status === "society-probation" && guest.societyProbationEndsAt && Date.now() >= guest.societyProbationEndsAt.getTime()) {
        const violations = getViolations(guest);
        if (violations.length > 0) {
          guest.status = "expelled";
          guest.sessionToken = null;
          guest.sessionExpiresAt = null;
          guest.scrubbedAt = new Date();
          await persistGuest(guest);
          await auditGateway(guest.id, guest.handle, "SOCIETY_PROBATION_FAILED", `${violations.length} violation(s) during society probation — expelled`, "gateway", "system");
          executeZeroPacketDeparture(guest.id, guest.displayName, "society_probation_failed");
          glog(`SOCIETY PROBATION FAILED: ${guest.handle} — expelled & scrubbed`);
        }
      }
    }
  }, 60000);

  glog("MoltBook Forum Gateway initialized — DB-backed persistence, hash-chained audit trail, forum-only access, 1h sessions with re-auth, community vetting");
}
