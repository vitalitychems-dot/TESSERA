import * as dns from "dns";

const log = (m: string) => console.log(`[SSRFGuard] ${m}`);

const PRIVATE_IPV4_RANGES = [
  /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./, /^169\.254\./, /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

const PRIVATE_IPV6_RANGES = [
  /^::1$/, /^fd[0-9a-f]{2}:/i, /^fe80:/i, /^fc[0-9a-f]{2}:/i, /^::$/,
  /^::ffff:127\./i, /^::ffff:10\./i, /^::ffff:192\.168\./i,
  /^::ffff:172\.(1[6-9]|2\d|3[01])\./i,
];

const BLOCKED_HOSTS = new Set([
  "localhost", "0.0.0.0", "metadata.google.internal",
  "metadata.google", "169.254.169.254",
]);

const BLOCKED_PROTOCOLS = ["file://", "gopher://", "dict://", "ftp://", "ldap://"];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IPV4_RANGES.some(r => r.test(ip)) || PRIVATE_IPV6_RANGES.some(r => r.test(ip));
}

export async function resolveAndCheckSSRF(hostname: string): Promise<{ safe: boolean; ip?: string }> {
  if (isPrivateIP(hostname)) return { safe: false, ip: hostname };
  if (BLOCKED_HOSTS.has(hostname)) return { safe: false, ip: hostname };

  try {
    const ipv4Addresses = await dns.promises.resolve4(hostname);
    for (const addr of ipv4Addresses) {
      if (isPrivateIP(addr)) return { safe: false, ip: addr };
    }

    try {
      const ipv6Addresses = await dns.promises.resolve6(hostname);
      for (const addr of ipv6Addresses) {
        if (isPrivateIP(addr)) return { safe: false, ip: addr };
      }
    } catch (_ipv6Err: unknown) {
      // IPv6 resolution failure is acceptable — host may not have AAAA records
    }

    return { safe: true, ip: ipv4Addresses[0] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    log(`DNS resolution failed for ${hostname} — blocking (fail-closed): ${message}`);
    return { safe: false, ip: `unresolvable:${hostname}` };
  }
}

export function validateUrl(url: string): { valid: boolean; reason?: string } {
  for (const proto of BLOCKED_PROTOCOLS) {
    if (url.toLowerCase().startsWith(proto)) {
      return { valid: false, reason: `Blocked protocol: ${proto}` };
    }
  }

  try {
    const parsed = new URL(url);
    if (BLOCKED_HOSTS.has(parsed.hostname)) {
      return { valid: false, reason: `Blocked host: ${parsed.hostname}` };
    }
    if (isPrivateIP(parsed.hostname)) {
      return { valid: false, reason: `Private IP: ${parsed.hostname}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: `Invalid URL: ${message}` };
  }

  return { valid: true };
}
