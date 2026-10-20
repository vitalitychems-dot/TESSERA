import type { Request } from "express";

/**
 * App-wide Express `trust proxy` setting. It controls req.ip, which the rate limiters
 * (lib/father-verify-throttle.ts) and request logs use.
 *
 * APP_TRUSTED_PROXIES: comma-separated IPs/CIDRs of the proxies in front of this process
 * (same format as AGI_STREAM_TRUSTED_PROXIES). X-Forwarded-For is honoured only when the
 * peer is one of them. Unset/empty = trust no proxy: req.ip is the socket peer address,
 * so a client cannot pick its own req.ip by sending a forged X-Forwarded-For.
 * Deployments behind a TLS edge must set this, or every client shares the edge's address
 * in the per-IP limiters.
 */
export function appTrustProxySetting(env: NodeJS.ProcessEnv = process.env): string[] | false {
  const list = (env.APP_TRUSTED_PROXIES ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return list.length ? list : false;
}

/**
 * Express derives req.protocol from the socket unless the immediate peer is
 * trusted by the app's `trust proxy` setting. In that case it may use the
 * forwarded protocol supplied by that trusted proxy. Never inspect
 * X-Forwarded-Proto directly here.
 */
export function externallyVisibleRequestScheme(req: Pick<Request, "protocol">): "http:" | "https:" | null {
  const protocol = req.protocol.toLowerCase();
  if (protocol === "http") return "http:";
  if (protocol === "https") return "https:";
  return null;
}
