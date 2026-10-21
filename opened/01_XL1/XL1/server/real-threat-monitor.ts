import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { honeypotEnhancedResponse, trackSuspiciousActivity } from "./security-fortress";

const tlog = (msg: string) => console.log(`[RealThreat] ${msg}`);

export interface RealThreatEvent {
  id: string;
  timestamp: number;
  ip: string;
  method: string;
  path: string;
  userAgent: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  attackType: string;
  status: "BLOCKED" | "LOGGED" | "MONITORING";
  country?: string;
  city?: string;
  isp?: string;
  lat?: number;
  lon?: number;
  geoResolved: boolean;
  raw: string;
}

export interface ThreatStats {
  totalInterceptions: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  blockedCount: number;
  uniqueIPs: number;
  honeypotHits: number;
  sqlInjectionAttempts: number;
  xssAttempts: number;
  bruteForceAttempts: number;
  scannerBots: number;
  dirTraversalAttempts: number;
  commandInjectionAttempts: number;
  ssrfAttempts: number;
  velocityFloodAttempts: number;
  lastThreat: number;
  serverUptime: number;
  requestsMonitored: number;
  defensePatterns: number;
  honeypotPaths: number;
}

const threatLog: RealThreatEvent[] = [];
const blockedIPs = new Set<string>();
const blockedIPTimestamps = new Map<string, number>();
const ipHitCounts = new Map<string, number>();
const geoCache = new Map<string, { country: string; city: string; isp: string; lat: number; lon: number; resolvedAt: number }>();

let totalRequestsMonitored = 0;
let honeypotHits = 0;
let serverStartTime = Date.now();

setInterval(() => {
  const now = Date.now();
  const BLOCK_TTL = 30 * 60 * 1000;
  for (const [ip, blockedAt] of blockedIPTimestamps) {
    if (now - blockedAt > BLOCK_TTL) {
      blockedIPs.delete(ip);
      blockedIPTimestamps.delete(ip);
      ipHitCounts.delete(ip);
      tlog(`Auto-unblocked IP ${ip} after 30min TTL`);
    }
  }
}, 60000);

const HONEYPOT_PATHS = [
  "/wp-admin", "/wp-login.php", "/phpmyadmin", "/admin", "/.env",
  "/config.php", "/db.php", "/.git/config", "/backup.sql", "/api/admin/reset",
  "/login.php", "/xmlrpc.php", "/shell.php", "/cmd.php", "/eval.php",
  "/etc/passwd", "/proc/self/environ", "/windows/win.ini", "/boot.ini",
  "/.aws/credentials", "/.ssh/id_rsa", "/server-status", "/manager/html",
  "/.well-known/security.txt", "/cgi-bin/", "/wp-content/", "/wp-includes/",
  "/.docker/", "/actuator/", "/jolokia/", "/console", "/.svn/",
  "/debug/", "/trace/", "/heapdump", "/metrics", "/info",
  "/api/v1/token", "/graphql", "/graphiql", "/.htaccess", "/.htpasswd",
  "/sitemap.xml.bak", "/web.config", "/crossdomain.xml",
];

const SQL_INJECTION_PATTERNS = [
  /union\s+select/i, /select\s+.+\s+from/i, /insert\s+into/i,
  /drop\s+table/i, /delete\s+from/i, /exec(\s|\+)+(s|x)?p\s*\(*/i,
  /0x[0-9a-f]+/i, /char\s*\(/i, /nchar\s*\(/i, /varchar\s*\(/i,
  /'.*or.*'='/, /'.*or.*1=1/i, /admin'--/i, /1\s*=\s*1/i,
  /waitfor\s+delay/i, /benchmark\s*\(/i, /sleep\s*\(/i,
  /load_file\s*\(/i, /into\s+outfile/i, /into\s+dumpfile/i,
  /information_schema/i, /group\s+by.+having/i, /order\s+by\s+\d+/i,
  /convert\s*\(/i, /cast\s*\(/i, /extractvalue\s*\(/i, /updatexml\s*\(/i,
];

const XSS_PATTERNS = [
  /<script[^>]*>/i, /javascript:/i, /on(load|click|mouseover|error|focus)=/i,
  /eval\s*\(/i, /document\.cookie/i, /window\.location/i,
  /<iframe[^>]*>/i, /<img[^>]+onerror/i, /&lt;script/i, /%3cscript/i,
  /vbscript:/i, /expression\s*\(/i, /fromcharcode/i, /&#x[0-9a-f]+;/i,
  /data:\s*text\/html/i, /<svg[^>]+onload/i, /<body[^>]+onload/i,
  /<details[^>]+ontoggle/i, /srcdoc\s*=/i, /base64.*PHNjcmlwdA/i,
];

const DIR_TRAVERSAL_PATTERNS = [
  /\.\.\//, /\.\.%2F/i, /\.\.%5C/i, /%2e%2e%2f/i,
  /\/etc\/passwd/i, /\/etc\/shadow/i, /\/windows\/system32/i,
  /\.\.\\/, /%252e%252e/i, /\.\.%c0%af/i, /\.\.%c1%9c/i,
  /\/proc\/self/i, /\/dev\/null/i, /\/var\/log/i,
];

const COMMAND_INJECTION_PATTERNS = [
  /;\s*(ls|cat|wget|curl|nc|bash|sh|python|perl|ruby|php)\s/i,
  /\|\s*(ls|cat|wget|curl|nc|bash|sh|python)\s/i,
  /`[^`]*`/, /\$\([^)]*\)/, /\$\{[^}]*\}/,
  /&&\s*(ls|cat|wget|curl|nc|bash)\s/i,
  />\s*\/tmp\//i, /\/bin\/(sh|bash|zsh)/i,
];

const SSRF_PATTERNS = [
  /localhost/i, /127\.\d+\.\d+\.\d+/, /0\.0\.0\.0/,
  /169\.254\.\d+\.\d+/, /\[::1\]/, /0x7f/i,
  /metadata\.google/, /169\.254\.169\.254/,
  /file:\/\//i, /gopher:\/\//i, /dict:\/\//i, /ftp:\/\//i,
];

const SCANNER_BOT_AGENTS = [
  /masscan/i, /zgrab/i, /shodan/i, /censys/i, /nmap/i, /nikto/i,
  /sqlmap/i, /acunetix/i, /nessus/i, /openvas/i, /metasploit/i,
  /dirbuster/i, /gobuster/i, /wfuzz/i, /hydra/i, /medusa/i,
  /python-requests/i, /go-http-client/i, /curl\/[0-7]/i,
  /nuclei/i, /httpx/i, /subfinder/i, /ffuf/i, /feroxbuster/i,
  /burpsuite/i, /zap/i, /arachni/i, /w3af/i, /skipfish/i,
  /whatweb/i, /wafw00f/i, /amass/i, /fierce/i,
];

const requestVelocity = new Map<string, { count: number; firstSeen: number }>();
const VELOCITY_WINDOW = 10000;
const VELOCITY_THRESHOLD = 50;

function detectAttackType(req: Request): { type: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" } | null {
  const rawUrl = req.originalUrl || req.url || "";
  let fullUrl = rawUrl;
  try { fullUrl = decodeURIComponent(rawUrl); } catch {}
  const ua = req.headers["user-agent"] || "";

  const isAPIRoute = fullUrl.startsWith("/api/");
  const isBrowserUA = /mozilla|chrome|safari|firefox|edge|opera/i.test(ua);

  const isSafeAPICall = isAPIRoute && isBrowserUA && !fullUrl.includes("..") && !fullUrl.includes("<") && !fullUrl.includes("'");
  if (isSafeAPICall) return null;

  const scanTarget = fullUrl + (rawUrl.includes("?") ? "" : "");

  const ip = getClientIP(req);
  const now = Date.now();
  if (!isLoopback(ip) && !isPrivate(ip) && !isBrowserUA) {
    const vel = requestVelocity.get(ip);
    if (vel) {
      if (now - vel.firstSeen < VELOCITY_WINDOW) {
        vel.count++;
        if (vel.count > VELOCITY_THRESHOLD) {
          return { type: "velocity-flood", severity: "CRITICAL" };
        }
      } else {
        requestVelocity.set(ip, { count: 1, firstSeen: now });
      }
    } else {
      requestVelocity.set(ip, { count: 1, firstSeen: now });
    }
  }

  if (!isAPIRoute) {
    for (const pattern of SQL_INJECTION_PATTERNS) {
      if (pattern.test(scanTarget)) {
        return { type: "sql-injection", severity: "CRITICAL" };
      }
    }

    for (const pattern of XSS_PATTERNS) {
      if (pattern.test(scanTarget)) {
        return { type: "xss-attack", severity: "HIGH" };
      }
    }
  }

  for (const pattern of DIR_TRAVERSAL_PATTERNS) {
    if (pattern.test(scanTarget)) {
      return { type: "directory-traversal", severity: "HIGH" };
    }
  }

  for (const pattern of COMMAND_INJECTION_PATTERNS) {
    if (pattern.test(scanTarget)) {
      return { type: "command-injection", severity: "CRITICAL" };
    }
  }

  const bodyStr = typeof req.body === "string" ? req.body : JSON.stringify(req.body || "");
  for (const pattern of SSRF_PATTERNS) {
    if (pattern.test(scanTarget) || (bodyStr.length < 2000 && pattern.test(bodyStr))) {
      if (!isAPIRoute || !isBrowserUA) {
        return { type: "ssrf-attempt", severity: "CRITICAL" };
      }
    }
  }

  if (!isBrowserUA) {
    for (const pattern of SCANNER_BOT_AGENTS) {
      if (pattern.test(ua)) {
        return { type: "scanner-bot", severity: "MEDIUM" };
      }
    }
  }

  if (HONEYPOT_PATHS.some(p => fullUrl.startsWith(p) || fullUrl === p)) {
    return { type: "honeypot-trigger", severity: "HIGH" };
  }

  if (!ua || ua.length < 10) {
    if (!isAPIRoute) {
      return { type: "suspicious-no-useragent", severity: "LOW" };
    }
  }

  return null;
}

function getClientIP(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const ips = (Array.isArray(xff) ? xff[0] : xff).split(",").map(ip => ip.trim());
    const realIP = ips.find(ip => !isLoopback(ip) && !isPrivate(ip));
    if (realIP) return realIP;
  }
  const xri = req.headers["x-real-ip"];
  if (xri) return Array.isArray(xri) ? xri[0] : xri;
  return req.socket?.remoteAddress || req.ip || "0.0.0.0";
}

function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip.startsWith("127.");
}

function isPrivate(ip: string): boolean {
  return ip.startsWith("10.") || ip.startsWith("192.168.") ||
    ip.startsWith("172.16.") || ip.startsWith("172.17.") ||
    ip.startsWith("172.18.") || ip.startsWith("172.19.") ||
    ip.startsWith("172.2") || ip.startsWith("172.30.") ||
    ip.startsWith("172.31.") || ip.startsWith("fd") || ip.startsWith("fe80");
}

async function resolveGeo(ip: string): Promise<{ country: string; city: string; isp: string; lat: number; lon: number } | null> {
  if (isLoopback(ip) || isPrivate(ip)) return null;
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.resolvedAt < 24 * 3600000) {
    return { country: cached.country, city: cached.city, isp: cached.isp, lat: cached.lat, lon: cached.lon };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,isp,lat,lon`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json() as any;
      if (data.status === "success") {
        const geo = { country: data.country || "Unknown", city: data.city || "Unknown", isp: data.isp || "Unknown ISP", lat: data.lat || 0, lon: data.lon || 0, resolvedAt: Date.now() };
        geoCache.set(ip, geo);
        return geo;
      }
    }
  } catch {}
  return null;
}

function logThreat(req: Request, attackType: string, severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW", isHoneypot = false) {
  const ip = getClientIP(req);
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ua = req.headers["user-agent"] || "unknown";

  const event: RealThreatEvent = {
    id,
    timestamp: Date.now(),
    ip,
    method: req.method,
    path: req.originalUrl || req.url || "/",
    userAgent: ua.slice(0, 200),
    severity,
    attackType,
    status: blockedIPs.has(ip) ? "BLOCKED" : isHoneypot ? "LOGGED" : "MONITORING",
    geoResolved: false,
    raw: `${req.method} ${req.originalUrl} from ${ip} [${ua.slice(0, 60)}]`,
  };

  threatLog.unshift(event);
  if (threatLog.length > 500) threatLog.length = 500;

  if (isHoneypot) honeypotHits++;

  if (severity === "CRITICAL" || severity === "HIGH") {
    const hits = (ipHitCounts.get(ip) || 0) + 1;
    ipHitCounts.set(ip, hits);
    if (hits >= 10 && !isLoopback(ip) && !isPrivate(ip)) {
      blockedIPs.add(ip);
      blockedIPTimestamps.set(ip, Date.now());
      event.status = "BLOCKED";
      tlog(`AUTO-BLOCKED IP ${ip} after ${hits} high-severity hits`);
    }
  }

  resolveGeo(ip).then(geo => {
    if (geo) {
      event.country = geo.country;
      event.city = geo.city;
      event.isp = geo.isp;
      event.lat = geo.lat;
      event.lon = geo.lon;
      event.geoResolved = true;
    }
  }).catch(() => {});

  const shortType = attackType.replace(/-/g, "_").toUpperCase();
  tlog(`[${severity}] ${shortType} from ${ip} → ${event.path.slice(0, 50)}`);
}

export function getRealThreatStats(): ThreatStats {
  const unique = new Set(threatLog.map(t => t.ip));
  const totalPatterns = SQL_INJECTION_PATTERNS.length + XSS_PATTERNS.length + DIR_TRAVERSAL_PATTERNS.length +
    COMMAND_INJECTION_PATTERNS.length + SSRF_PATTERNS.length + SCANNER_BOT_AGENTS.length;
  return {
    totalInterceptions: threatLog.length,
    criticalCount: threatLog.filter(t => t.severity === "CRITICAL").length,
    highCount: threatLog.filter(t => t.severity === "HIGH").length,
    mediumCount: threatLog.filter(t => t.severity === "MEDIUM").length,
    lowCount: threatLog.filter(t => t.severity === "LOW").length,
    blockedCount: blockedIPs.size,
    uniqueIPs: unique.size,
    honeypotHits,
    sqlInjectionAttempts: threatLog.filter(t => t.attackType === "sql-injection").length,
    xssAttempts: threatLog.filter(t => t.attackType === "xss-attack").length,
    bruteForceAttempts: threatLog.filter(t => t.attackType === "brute-force").length,
    scannerBots: threatLog.filter(t => t.attackType === "scanner-bot").length,
    dirTraversalAttempts: threatLog.filter(t => t.attackType === "directory-traversal").length,
    commandInjectionAttempts: threatLog.filter(t => t.attackType === "command-injection").length,
    ssrfAttempts: threatLog.filter(t => t.attackType === "ssrf-attempt").length,
    velocityFloodAttempts: threatLog.filter(t => t.attackType === "velocity-flood").length,
    lastThreat: threatLog[0]?.timestamp || 0,
    serverUptime: Date.now() - serverStartTime,
    requestsMonitored: totalRequestsMonitored,
    defensePatterns: totalPatterns,
    honeypotPaths: HONEYPOT_PATHS.length,
  };
}

export function getRealThreatLog(limit = 50): RealThreatEvent[] {
  return threatLog.slice(0, limit);
}

export function getBlockedIPs(): string[] {
  return [...blockedIPs];
}

export function installThreatMonitorMiddleware(app: Express) {
  tlog("Installing real threat monitoring middleware...");

  app.use((req: Request, res: Response, next: NextFunction) => {
    totalRequestsMonitored++;
    const ip = getClientIP(req);

    if (blockedIPs.has(ip) && !isLoopback(ip) && !isPrivate(ip)) {
      logThreat(req, "blocked-ip-repeat-offender", "CRITICAL");
      return res.status(403).json({ error: "Access denied", code: "THREAT_BLOCKED" });
    }

    const attack = detectAttackType(req);
    if (attack) {
      logThreat(req, attack.type, attack.severity, attack.type === "honeypot-trigger");
      trackSuspiciousActivity(ip, req.originalUrl || req.url || "/", attack.type, attack.severity);
      if (attack.type === "honeypot-trigger") {
        const decoy = honeypotEnhancedResponse(req.originalUrl || req.url || "/");
        return res.status(404).json(typeof decoy === "string" ? { response: decoy } : decoy);
      }
    }

    next();
  });

  for (const honeypotPath of HONEYPOT_PATHS) {
    app.all(honeypotPath, (req: Request, res: Response) => {
      logThreat(req, "honeypot-trigger", "HIGH", true);
      const ip = getClientIP(req);
      trackSuspiciousActivity(ip, honeypotPath, "honeypot-trigger", "HIGH");
      const decoy = honeypotEnhancedResponse(honeypotPath);
      res.status(404).json(typeof decoy === "string" ? { response: decoy } : decoy);
    });
  }

  setInterval(async () => {
    const recent = threatLog.slice(0, 10);
    const critical = recent.filter(t => t.severity === "CRITICAL");
    if (critical.length > 0) {
      try {
        await storage.createNote({
          type: "security",
          title: `Real Threat Alert: ${critical.length} CRITICAL events`,
          content: critical.map(t => `[${t.severity}] ${t.attackType} from ${t.ip} (${t.country || "unknown"}) — ${t.path}`).join("\n"),
          priority: "high",
          status: "unread",
        });
      } catch {}
    }
  }, 5 * 60 * 1000);

  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.removeHeader("X-Powered-By");
    res.removeHeader("Server");
    res.removeHeader("X-AspNet-Version");
    res.removeHeader("X-AspNetMvc-Version");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "0");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    next();
  });

  setInterval(() => {
    const now = Date.now();
    for (const [ip, vel] of requestVelocity) {
      if (now - vel.firstSeen > VELOCITY_WINDOW * 3) {
        requestVelocity.delete(ip);
      }
    }
  }, 30000);

  const totalPatterns = SQL_INJECTION_PATTERNS.length + XSS_PATTERNS.length + DIR_TRAVERSAL_PATTERNS.length +
    COMMAND_INJECTION_PATTERNS.length + SSRF_PATTERNS.length + SCANNER_BOT_AGENTS.length;
  tlog(`Threat monitor active — ${HONEYPOT_PATHS.length} honeypot paths, ${totalPatterns} attack patterns, velocity flood detection, metadata stripping`);
}
