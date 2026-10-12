/**
 * HYB-011 route and file denylist.
 * Refuses wallet, payment, vault, and 1T paths on the v2 surface.
 * Clean-room gate. It does not delete existing files or rewrite history.
 */

const REFUSED_SEGMENT =
  /^(?:1t|vault|wallets?|payments?|checkout|stripe|mining|nft|defi|mev|hashcat|captcha|antidetect)$/i;

const EMBEDDED_REFUSED = /(?:vault|wallet|payment|1t)/i;

function decodePart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function segmentsOf(value) {
  return decodePart(String(value ?? ""))
    .replace(/\\/g, "/")
    .split(/[?#]/, 1)[0]
    .split("/")
    .filter((part) => part.length > 0 && part !== "." && part !== "..");
}

function segmentRefused(segment) {
  if (REFUSED_SEGMENT.test(segment)) return segment.toLowerCase();
  if (/(?:^|[^a-z0-9])1t(?:[^a-z0-9]|$)/i.test(segment)) return "1t";
  if (/vault/i.test(segment)) return "vault";
  if (/wallets?/i.test(segment)) return "wallet";
  if (/payments?/i.test(segment)) return "payment";
  return null;
}

export function reviewPath(value) {
  const segments = segmentsOf(value);
  for (const segment of segments) {
    const hit = segmentRefused(segment);
    if (hit) {
      return { allowed: false, status: 403, reason: "hyb-011-denied", match: hit };
    }
  }
  const query = String(value ?? "").includes("?")
    ? decodePart(String(value).slice(String(value).indexOf("?") + 1))
    : "";
  if (query) {
    for (const piece of query.split(/[&/=]/)) {
      const hit = segmentRefused(piece);
      if (hit) {
        return { allowed: false, status: 403, reason: "hyb-011-denied", match: hit };
      }
    }
  }
  return { allowed: true, status: 200, reason: "ok", match: null };
}

export function reviewRequest({ url = "/", method = "GET" } = {}) {
  const decision = reviewPath(url);
  return { ...decision, method: String(method || "GET").toUpperCase() };
}

export function reviewFile(filePath) {
  const decision = reviewPath(filePath);
  if (!decision.allowed) return decision;
  const base = segmentsOf(filePath).at(-1) ?? "";
  if (EMBEDDED_REFUSED.test(base) && segmentRefused(base)) {
    return { allowed: false, status: 403, reason: "hyb-011-denied", match: segmentRefused(base) };
  }
  return decision;
}

export function createGateServer() {
  return async function gate(request) {
    const decision = reviewRequest({ url: request.url, method: request.method });
    const body = decision.allowed
      ? { ok: true }
      : { refused: true, reason: decision.reason, match: decision.match };
    return new Response(JSON.stringify(body), {
      status: decision.status,
      headers: { "content-type": "application/json" },
    });
  };
}
