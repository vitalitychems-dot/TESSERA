/**
 * #7: SSE stream of global-workspace broadcasts (GET /api/agi/stream).
 *
 * Security hardening (Security review of c3b6f87, 2 HIGH):
 *  - auth: owner session or x-tesseract-admin-key, via the existing
 *    resolveFatherAuthorization() gate; fail-closed 503 when unconfigured.
 *  - connection caps: global and per-IP, plus the hard cap on the workspace
 *    listener Set (trySubscribeWorkspace).
 *  - heartbeat comment every 20s and a max connection lifetime.
 *  - slow clients are dropped on backpressure (write() false or buffer over cap).
 *  - SSE id is sanitized to [A-Za-z0-9._-]{1,64}; event data carries only
 *    id/at/attention plus sanitized, length-capped topic/from (authed only).
 * Kept separate from routes/agi.ts so it has no DB import.
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import { trySubscribeWorkspace } from "../lib/agi/global-workspace.js";
import { isAdminTokenConfigured } from "../lib/sovereign-session.js";
import { resolveFatherAuthorization } from "../lib/sovereign-admin.js";
import type { AgentMessage } from "../lib/agi/agent-bus.js";
import { BlockList, isIP } from "node:net";

export interface AgiStreamOptions {
  maxGlobal: number;
  maxPerIp: number;
  heartbeatMs: number;
  maxLifetimeMs: number;
  maxBufferedBytes: number;
  /**
   * Proxies whose X-Forwarded-For is trusted for the per-IP cap: IPs or CIDRs.
   * Defaults to AGI_STREAM_TRUSTED_PROXIES (comma-separated). Empty = trust no
   * proxy, so the per-IP cap always uses the socket peer address. This is
   * independent of the app-wide `trust proxy` setting (req.ip), which an
   * untrusted client can spoof when no proxy is actually in front.
   */
  trustedProxies?: string[];
}

function normalizeIp(raw: string | undefined): string {
  const s = (raw ?? "").trim();
  const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(s);
  return m ? m[1] : s;
}

export function buildTrustedProxyList(entries: string[]): BlockList {
  const list = new BlockList();
  for (const raw of entries) {
    const e = raw.trim();
    if (!e) continue;
    const [addr, bits] = e.split("/");
    const ip = normalizeIp(addr);
    const fam = isIP(ip);
    if (!fam) continue;
    const type = fam === 6 ? "ipv6" : "ipv4";
    if (bits !== undefined) {
      const n = Number(bits);
      if (Number.isInteger(n) && n >= 0 && n <= (fam === 6 ? 128 : 32)) list.addSubnet(ip, n, type);
    } else {
      list.addAddress(ip, type);
    }
  }
  return list;
}

function isTrusted(list: BlockList, ip: string): boolean {
  const fam = isIP(ip);
  return fam ? list.check(ip, fam === 6 ? "ipv6" : "ipv4") : false;
}

/**
 * Client IP for the per-IP cap. Starts from the socket peer; only if that peer
 * is a configured trusted proxy is X-Forwarded-For consulted, walking right to
 * left past trusted hops to the first untrusted address.
 */
export function streamClientIp(
  peer: string | undefined,
  xff: string | string[] | undefined,
  trusted: BlockList,
): string {
  let ip = normalizeIp(peer) || "unknown";
  if (!isTrusted(trusted, ip) || !xff) return ip;
  const hops = (Array.isArray(xff) ? xff.join(",") : xff).split(",").map((h) => normalizeIp(h)).filter(Boolean);
  for (let i = hops.length - 1; i >= 0; i--) {
    if (!isIP(hops[i])) break;
    ip = hops[i];
    if (!isTrusted(trusted, ip)) break;
  }
  return ip;
}

export const DEFAULT_STREAM_OPTIONS: AgiStreamOptions = {
  maxGlobal: 32,
  maxPerIp: 2,
  heartbeatMs: 20_000,
  maxLifetimeMs: 15 * 60_000,
  maxBufferedBytes: 64 * 1024,
};

/** SSE ids must not contain CR/LF/NUL; keep a conservative charset and length. */
export function sanitizeSseId(raw: unknown): string {
  const s = String(raw ?? "").replace(/[^A-Za-z0-9._-]/g, "").slice(0, 64);
  return s || "0";
}

/** Strip control characters and cap length for short label fields. */
export function sanitizeLabel(raw: unknown, max = 64): string {
  // eslint-disable-next-line no-control-regex
  return String(raw ?? "").replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, "").slice(0, max);
}

export function formatWorkspaceEvent(m: AgentMessage): string {
  const data = {
    id: sanitizeSseId(m.id),
    at: Number(m.at) || 0,
    attention: Number(m.attention) || 0,
    topic: sanitizeLabel(m.topic),
    from: sanitizeLabel(m.from),
  };
  return `event: workspace\nid: ${sanitizeSseId(m.id)}\ndata: ${JSON.stringify(data)}\n\n`;
}

type Writable = Pick<Response, "write"> & { writableLength?: number; destroyed?: boolean };

/** Write a chunk; returns false (caller must drop the client) on backpressure. */
export function writeOrDrop(res: Writable, chunk: string, maxBufferedBytes: number): boolean {
  if (res.destroyed) return false;
  const ok = res.write(chunk);
  if (!ok) return false;
  if ((res.writableLength ?? 0) > maxBufferedBytes) return false;
  return true;
}

function requireStreamAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminTokenConfigured()) {
    res.status(503).json({ ok: false, error: "sovereign-unconfigured" });
    return;
  }
  if (resolveFatherAuthorization(req).fatherAuthorized) { next(); return; }
  res.status(401).json({ ok: false, error: "unauthenticated" });
}

export function createAgiStreamRouter(overrides: Partial<AgiStreamOptions> = {}) {
  const opts: AgiStreamOptions = { ...DEFAULT_STREAM_OPTIONS, ...overrides };
  const trusted = buildTrustedProxyList(
    opts.trustedProxies ?? (process.env.AGI_STREAM_TRUSTED_PROXIES ?? "").split(","),
  );
  const router = Router();
  let globalCount = 0;
  const perIp = new Map<string, number>();

  router.get("/agi/stream", requireStreamAuth, (req, res) => {
    // Not req.ip: with app-wide `trust proxy` and no real proxy, X-Forwarded-For is client-controlled.
    const ip = streamClientIp(req.socket.remoteAddress, req.headers["x-forwarded-for"], trusted);
    if (globalCount >= opts.maxGlobal || (perIp.get(ip) ?? 0) >= opts.maxPerIp) {
      res.status(429).json({ ok: false, error: "stream-capacity" });
      return;
    }
    let closed = false;
    let off: (() => void) | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let lifetime: ReturnType<typeof setTimeout> | null = null;
    globalCount++;
    perIp.set(ip, (perIp.get(ip) ?? 0) + 1);

    const close = () => {
      if (closed) return;
      closed = true;
      off?.();
      if (heartbeat) clearInterval(heartbeat);
      if (lifetime) clearTimeout(lifetime);
      globalCount--;
      const n = (perIp.get(ip) ?? 1) - 1;
      if (n <= 0) perIp.delete(ip); else perIp.set(ip, n);
      if (!res.writableEnded) res.end();
      res.socket?.destroy();
    };

    off = trySubscribeWorkspace((m) => {
      if (closed) return;
      if (!writeOrDrop(res, formatWorkspaceEvent(m), opts.maxBufferedBytes)) close();
    });
    if (!off) {
      closed = true;
      globalCount--;
      const n = (perIp.get(ip) ?? 1) - 1;
      if (n <= 0) perIp.delete(ip); else perIp.set(ip, n);
      res.status(503).json({ ok: false, error: "workspace-listener-cap" });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write(": connected\n\n");
    heartbeat = setInterval(() => {
      if (!writeOrDrop(res, ": hb\n\n", opts.maxBufferedBytes)) close();
    }, opts.heartbeatMs);
    lifetime = setTimeout(() => {
      writeOrDrop(res, "event: bye\ndata: {\"reason\":\"max-lifetime\"}\n\n", opts.maxBufferedBytes);
      close();
    }, opts.maxLifetimeMs);
    req.on("close", close);
    res.on("error", close);
  });

  return router;
}

export default createAgiStreamRouter();
