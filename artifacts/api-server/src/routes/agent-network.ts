import { Router, type Request, type Response } from "express";
import { getSpawnerMetrics, spawnAgent, spawnBatchAsync, retireAgent, getSpawnerState } from "../lib/agent-spawner";
import { getAgentHierarchy, getChildrenOf, getHierarchyMetrics } from "../lib/agent-hierarchy";
import { getAgentCommsMetrics, sendMessage, broadcastMessage, getThreads, getThread, getFeed } from "../lib/agent-comms";
import { CommsPolicyError, resolveAlias } from "../lib/comms-policy";
import { decideOwnerSession } from "../lib/sovereign-admin";
import { parseLaneTokens, laneForToken, LANE_TOKEN_HEADER, RESERVED_OWNER_SLUGS, canonicalSlug, isAsciiSlug, isDevEnv } from "../lib/mesh-lane-auth";
import { originAllowed } from "../lib/origin-allowed";

/**
 * Resolve the sender. The sender is ONLY ever derived from a presented lane token.
 * MESH_LANE_TOKENS unset => 401, except (a) a valid owner session (from = "Father") or
 * (b) NODE_ENV !== "production" and a loopback socket address (body from used).
 * Set => `from` is the slug of the presented lane token; a body `from` that does not
 * resolve to that slug is rejected. Malformed env fails closed.
 */
/** Owner identity used across the codebase (forum principal, natal-chart identity). */
export const OWNER_IDENTITY = "Father";
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
export const isLoopback = (addr: string | undefined): boolean => Boolean(addr && LOOPBACK.has(addr));

/** True if a body `from` names the owner node (any case, or via alias). */
const claimsOwner = (v: unknown): boolean => {
  if (typeof v !== "string") return false;
  const c = canonicalSlug(v);
  return RESERVED_OWNER_SLUGS.has(c) || RESERVED_OWNER_SLUGS.has(resolveAlias(v)) || RESERVED_OWNER_SLUGS.has(resolveAlias(c));
};
const PROXY_HEADERS = ["x-forwarded-for", "forwarded", "x-real-ip"] as const;
const hasProxyHeader = (req: Request): boolean => PROXY_HEADERS.some((h) => req.headers[h] !== undefined);
/** ASCII-slug sender rule: the resolved sender (after alias) must be a strict ASCII slug. */
const slugSender = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const r = resolveAlias(v);
  return isAsciiSlug(r) ? r : null;
};

function resolveSender(req: Request, bodyFrom: unknown): { from?: unknown; status?: number; error?: string } {
  let table;
  try { table = parseLaneTokens(); } catch { return { status: 403, error: "lane auth misconfigured" }; }
  if (!table) {
    // (a) owner admin session (same validator as requireAdminSession): from is fixed to the owner.
    if (decideOwnerSession(req).ok) {
      if (!originAllowed(req)) return { status: 403, error: "origin-forbidden" };
      if (bodyFrom !== undefined && !claimsOwner(bodyFrom)) return { status: 403, error: `from must be ${OWNER_IDENTITY} for an owner session` };
      return { from: OWNER_IDENTITY };
    }
    // (b) explicit development/test only (unset/unknown NODE_ENV fails closed as production),
    // loopback socket, and no proxy headers (a proxied request is not local).
    if (isDevEnv() && isLoopback(req.socket?.remoteAddress) && !hasProxyHeader(req)) {
      if (claimsOwner(bodyFrom)) return { status: 403, error: `${OWNER_IDENTITY} is reachable only through the owner admin session` };
      const from = slugSender(bodyFrom);
      if (!from) return { status: 400, error: "from must be an ASCII slug (^[a-z0-9][a-z0-9-]{0,63}$) or a registered alias of one" };
      return { from };
    }
    return { status: 401, error: "lane identity required: MESH_LANE_TOKENS is not configured; body from is not trusted" };
  }
  const raw = req.headers[LANE_TOKEN_HEADER];
  const slug = laneForToken(Array.isArray(raw) ? raw[0] : raw, table);
  if (!slug) return { status: 403, error: "valid lane token required" };
  if (RESERVED_OWNER_SLUGS.has(slug) || claimsOwner(bodyFrom)) return { status: 403, error: `a lane token cannot claim ${OWNER_IDENTITY}` };
  if (bodyFrom !== undefined && (typeof bodyFrom !== "string" || resolveAlias(bodyFrom) !== slug)) {
    return { status: 403, error: "from does not match authenticated lane" };
  }
  return { from: slug };
}

const router = Router();

router.get("/agent-spawner/metrics", (_req: Request, res: Response) => {
  res.json({ ok: true, data: getSpawnerMetrics() });
});

router.get("/agent-spawner/state", (_req: Request, res: Response) => {
  const state = getSpawnerState();
  res.json({ ok: true, data: { totalSpawned: state.totalSpawned, activeCount: state.activeSpawned.length, generationCount: state.generationCount, totalPower: state.totalPower, agents: state.activeSpawned, spawnLog: state.spawnLog.slice(0, 20) } });
});

router.post("/agent-spawner/spawn", (req: Request, res: Response) => {
  const { trigger = "manual-spawn", domains = [] } = req.body;
  const agent = spawnAgent(trigger, domains);
  if (!agent) { res.json({ ok: false, message: "Spawn cooldown active — try again shortly" }); return; }
  res.json({ ok: true, data: agent });
});

router.post("/agent-spawner/spawn-batch", async (req: Request, res: Response) => {
  const { count = 3, trigger = "manual-batch", domains = [] } = req.body;
  const limitedCount = Math.min(10, Math.max(1, count));
  const agents = await spawnBatchAsync(limitedCount, trigger, domains);
  res.json({ ok: true, data: agents, count: agents.length });
});

router.delete("/agent-spawner/retire/:agentId", (req: Request, res: Response) => {
  const agentId = String(req.params.agentId);
  const success = retireAgent(agentId);
  res.json({ ok: success, message: success ? `Agent ${agentId} retired` : `Agent ${agentId} not found` });
});

router.get("/agent-hierarchy/structure", (_req: Request, res: Response) => {
  res.json({ ok: true, data: getAgentHierarchy() });
});

router.get("/agent-hierarchy/metrics", (_req: Request, res: Response) => {
  res.json({ ok: true, data: getHierarchyMetrics() });
});

router.get("/agent-hierarchy/children/:parentName", (req: Request, res: Response) => {
  const parentName = String(req.params.parentName);
  const children = getChildrenOf(parentName);
  res.json({ ok: true, data: children, count: children.length });
});

router.get("/agent-comms/metrics", (_req: Request, res: Response) => {
  res.json({ ok: true, data: getAgentCommsMetrics() });
});

router.get("/agent-comms/feed", (req: Request, res: Response) => {
  const limit = parseInt(String((req as any).query?.limit)) || 50;
  res.json({ ok: true, data: getFeed(Math.min(100, limit)) });
});

router.get("/agent-comms/threads", (_req: Request, res: Response) => {
  res.json({ ok: true, data: getThreads() });
});

router.get("/agent-comms/threads/:threadId", (req: Request, res: Response) => {
  const thread = getThread(String(req.params.threadId));
  if (!thread) { res.status(404).json({ ok: false, error: "Thread not found" }); return; }
  res.json({ ok: true, data: thread });
});

const MSG_TYPES = ["directive", "response", "broadcast", "alert", "report", "inquiry"] as const;
const MSG_PRIORITIES = ["low", "normal", "high", "critical"] as const;
const MAX_CONTENT = 4000;
const MAX_NAME = 128;

/** Body validation for agent-comms POSTs. Returns an error string or null. */
export function validateCommsBody(body: Record<string, unknown>, opts: { requireTo: boolean; allowType: boolean }): string | null {
  const { to, content, type = "directive", priority = "normal" } = body;
  if (opts.requireTo && (typeof to !== "string" || to.length === 0 || to.length > MAX_NAME)) return `to must be a string of 1-${MAX_NAME} chars`;
  if (typeof content !== "string" || content.trim().length === 0 || content.length > MAX_CONTENT) return `content must be a string of 1-${MAX_CONTENT} chars`;
  if (opts.allowType && !(MSG_TYPES as readonly unknown[]).includes(type)) return `type must be one of ${MSG_TYPES.join(", ")}`;
  if (!(MSG_PRIORITIES as readonly unknown[]).includes(priority)) return `priority must be one of ${MSG_PRIORITIES.join(", ")}`;
  return null;
}

router.post("/agent-comms/send", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { to, content, type = "directive", priority = "normal" } = body as any;
  const sender = resolveSender(req, body.from);
  if (sender.status) { res.status(sender.status).json({ ok: false, error: sender.error }); return; }
  const from = sender.from as any;
  if (!from || typeof from !== "string" || from.length > MAX_NAME) { res.status(400).json({ ok: false, error: "from, to, and content are required" }); return; }
  const err = validateCommsBody(body, { requireTo: true, allowType: true });
  if (err) { res.status(400).json({ ok: false, error: err }); return; }
  try {
    res.json({ ok: true, data: sendMessage(from, to, content, type, priority) });
  } catch (e) {
    if (e instanceof CommsPolicyError) { res.status(403).json({ ok: false, error: e.message }); return; }
    throw e;
  }
});

router.post("/agent-comms/broadcast", (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const { content, priority = "normal" } = body as any;
  const sender = resolveSender(req, body.from);
  if (sender.status) { res.status(sender.status).json({ ok: false, error: sender.error }); return; }
  const from = sender.from as any;
  if (typeof from !== "string" || from.length === 0 || from.length > MAX_NAME) { res.status(400).json({ ok: false, error: "from must be a short string" }); return; }
  const err = validateCommsBody(body, { requireTo: false, allowType: false });
  if (err) { res.status(400).json({ ok: false, error: err }); return; }
  const msgs = broadcastMessage(from, content, priority);
  res.json({ ok: true, data: msgs, count: msgs.length });
});

export default router;
