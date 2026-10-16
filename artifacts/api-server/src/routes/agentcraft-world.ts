import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { AgentCraftBridgePayloadSchema } from "@workspace/api-zod";
import { ipRateLimitKey } from "../lib/ip-rate-limit-key";
import {
  acceptAgentCraftSnapshot,
  isAgentCraftBridgeConfigured,
  readAgentCraftWorld,
  verifyAgentCraftBridgeToken,
} from "../lib/agentcraft-world";
import { requireAdminSession } from "../lib/sovereign-admin";

const router: IRouter = Router();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const buckets = new Map<string, { startedAt: number; count: number }>();

function bridgeRateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const key = ipRateLimitKey(req.ip || "unknown", "agentcraft-bridge");
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.startedAt >= WINDOW_MS) {
    bucket = { startedAt: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (buckets.size > 1024) {
    for (const [candidate, value] of buckets) {
      if (now - value.startedAt >= WINDOW_MS) buckets.delete(candidate);
    }
  }
  if (bucket.count > MAX_REQUESTS_PER_WINDOW) {
    res.setHeader("Retry-After", String(Math.max(1, Math.ceil((WINDOW_MS - (now - bucket.startedAt)) / 1000))));
    res.status(429).json({ ok: false, error: "rate-limited" });
    return;
  }
  next();
}

router.get("/world/agentcraft", (req, res, next) => {
  requireAdminSession(req, res, next);
}, (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  return res.json(readAgentCraftWorld());
});

router.post("/world/agentcraft/ingest", bridgeRateLimit, (req, res) => {
  if (!isAgentCraftBridgeConfigured()) {
    return res.status(503).json({ ok: false, error: "bridge-unconfigured" });
  }

  const authorization = req.header("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  if (!verifyAgentCraftBridgeToken(match?.[1])) {
    return res.status(401).json({ ok: false, error: "bridge-unauthorized" });
  }

  let bodySize: number;
  try {
    bodySize = Buffer.byteLength(JSON.stringify(req.body ?? {}), "utf8");
  } catch {
    return res.status(400).json({ ok: false, error: "invalid-payload" });
  }
  if (bodySize > 24 * 1024) {
    return res.status(413).json({ ok: false, error: "payload-too-large" });
  }

  const parsed = AgentCraftBridgePayloadSchema.safeParse(req.body);
  if (!parsed.success || !acceptAgentCraftSnapshot(parsed.data)) {
    return res.status(400).json({ ok: false, error: "invalid-payload" });
  }
  return res.status(202).json({ ok: true, accepted: true });
});

export default router;
