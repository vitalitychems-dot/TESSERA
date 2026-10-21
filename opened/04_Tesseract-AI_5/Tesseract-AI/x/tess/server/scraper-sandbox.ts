import axios, { AxiosRequestConfig } from "axios";
import { URL } from "url";
import * as dns from "dns";

const log = (m: string) => console.log(`[ScraperSandbox] ${m}`);
const warn = (m: string) => console.log(`[ScraperSandbox] ⚠️ ${m}`);
const block = (m: string) => console.log(`[ScraperSandbox] 🚫 BLOCKED: ${m}`);

const PRIVATE_IP_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1$/,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^fc[0-9a-f]{2}:/i,
  /^::$/,
];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(r => r.test(ip));
}

async function resolveAndCheckSSRF(hostname: string): Promise<{ safe: boolean; ip?: string }> {
  if (isPrivateIP(hostname)) return { safe: false, ip: hostname };
  if (hostname === "localhost" || hostname === "0.0.0.0") return { safe: false, ip: hostname };

  try {
    const addresses = await dns.promises.resolve4(hostname);
    for (const addr of addresses) {
      if (isPrivateIP(addr)) return { safe: false, ip: addr };
    }
    return { safe: true, ip: addresses[0] };
  } catch {
    return { safe: true };
  }
}

const HOSTILE_DOMAINS = new Set([
  "google.com", "www.google.com", "google.co.uk", "google.ca",
  "googleapis.com", "google-analytics.com", "googletagmanager.com",
  "googlesyndication.com", "googleadservices.com", "doubleclick.net",
  "gstatic.com", "google.com.br", "google.de", "google.fr",
  "facebook.com", "www.facebook.com", "facebook.net", "fbcdn.net",
  "connect.facebook.net", "graph.facebook.com",
  "meta.com", "www.meta.com",
  "analytics.tiktok.com", "ads.tiktok.com",
  "amazon-adsystem.com", "pixel.quantserve.com",
  "scorecardresearch.com", "imrworldwide.com",
  "ads.linkedin.com", "snap.licdn.com",
  "bat.bing.com", "clarity.ms",
  "hotjar.com", "mouseflow.com", "fullstory.com",
  "mixpanel.com", "segment.io", "segment.com",
  "sentry.io",
  "newrelic.com", "nr-data.net",
  "optimizely.com", "adobedtm.com",
  "crashlytics.com", "appsflyer.com",
  "adjust.com", "branch.io",
]);

const TRACKER_URL_PATTERNS = [
  /google\.com\/recaptcha/i,
  /google\.com\/maps\/embed/i,
  /facebook\.com\/tr/i,
  /pixel\.facebook/i,
  /connect\.facebook/i,
  /analytics\./i,
  /tracker\./i,
  /beacon\./i,
  /pixel\./i,
  /telemetry\./i,
  /collect\./i,
  /log\./i,
  /track\./i,
  /stats\./i,
  /\/pagead\//i,
  /\/ads\//i,
  /\/tracking\//i,
  /\/beacon/i,
  /\/pixel/i,
  /utm_source/i,
  /utm_medium/i,
  /utm_campaign/i,
  /fbclid=/i,
  /gclid=/i,
  /msclkid=/i,
  /click_id=/i,
];

const HONEYPOT_PATTERNS = [
  /tarpit/i,
  /honeypot/i,
  /trap\./i,
  /canary/i,
  /decoy/i,
  /\.onion\./i,
  /captcha.*verify/i,
  /challenge.*platform/i,
  /bot.*detect/i,
  /anti.*scrape/i,
];

const SENSITIVE_OUTBOUND_PATTERNS = [
  /tessera/i,
  /sovereign/i,
  /tsrt/i,
  /father/i,
  /omniversal/i,
  /moltbook/i,
  /private.?key/i,
  /wallet/i,
  /\.sov\b/i,
  /tess:\/\//i,
  /api\..*\.replit/i,
  /replit\.dev/i,
  /replit\.app/i,
  /neural.?unity/i,
  /grand.?conference/i,
  /lattice.?search/i,
  /tesseract/i,
  /oversoul/i,
  /aetherion/i,
  /\/home\/runner/i,
  /\/workspace\//i,
  /\.env\b/i,
  /process\.env/i,
  /DATABASE_URL/i,
  /OPENAI_API_KEY/i,
  /ANTHROPIC/i,
  /sk-[a-zA-Z0-9]{20,}/i,
];

const INBOUND_SCRUB_PATTERNS: Array<{ pattern: RegExp; replacement: string; category: string }> = [
  { pattern: /<script[^>]*src="[^"]*(?:google|facebook|meta|analytics|tracker|pixel|beacon|segment|hotjar|mixpanel|sentry|newrelic|optimizely|adobe|clarity)[^"]*"[^>]*>[\s\S]*?<\/script>/gi, replacement: "", category: "tracker-script" },
  { pattern: /<script[^>]*>[\s\S]*?(?:ga\(|gtag\(|fbq\(|_gaq|analytics|pixel|beacon|track\(|segment\.|hotjar|mixpanel|sentry|newrelic|optimizely)[\s\S]*?<\/script>/gi, replacement: "", category: "inline-tracker" },
  { pattern: /<img[^>]*src="[^"]*(?:pixel|beacon|tracker|analytics|1x1|spacer\.gif|blank\.gif|track)[^"]*"[^>]*\/?>/gi, replacement: "", category: "tracking-pixel" },
  { pattern: /<iframe[^>]*src="[^"]*(?:google|facebook|doubleclick|ads|tracker|analytics)[^"]*"[^>]*>[\s\S]*?<\/iframe>/gi, replacement: "", category: "tracking-iframe" },
  { pattern: /<link[^>]*href="[^"]*(?:google-analytics|googletagmanager|facebook|pixel|tracker)[^"]*"[^>]*\/?>/gi, replacement: "", category: "tracker-preload" },
  { pattern: /<noscript[^>]*>[\s\S]*?(?:pixel|beacon|tracker|facebook\.com\/tr|google-analytics)[\s\S]*?<\/noscript>/gi, replacement: "", category: "noscript-tracker" },
  { pattern: /data-(?:ga|fb|tracking|analytics|pixel|track|beacon|segment|gtm)[^=]*="[^"]*"/gi, replacement: "", category: "tracking-attribute" },
  { pattern: /(?:window\.__(?:NEXT_DATA|NUXT|INITIAL_STATE)__\s*=\s*)\{[\s\S]{0,5000}\}/g, replacement: "", category: "framework-state" },
  { pattern: /Set-Cookie:\s*[^\n]+/gi, replacement: "", category: "cookie-header" },
];

const FINGERPRINT_HEADERS_TO_STRIP = [
  "x-request-id", "x-trace-id", "x-amzn-trace-id", "x-cloud-trace-context",
  "x-b3-traceid", "x-b3-spanid", "x-datadog-trace-id",
  "cf-ray", "cf-connecting-ip", "true-client-ip",
  "x-forwarded-for", "x-real-ip", "x-client-ip",
  "x-device-id", "x-fingerprint",
];

interface SandboxResult {
  clean: boolean;
  content: string;
  threats: SandboxThreat[];
  strippedTrackers: number;
  strippedScripts: number;
  originalSize: number;
  cleanSize: number;
  source: string;
  sandboxedAt: number;
}

interface SandboxThreat {
  type: "tracker" | "honeypot" | "fingerprint" | "data-leak" | "hostile-domain" | "malicious-payload" | "redirect-chain";
  severity: "critical" | "high" | "medium" | "low";
  detail: string;
  action: "blocked" | "stripped" | "flagged";
}

export function isHostileDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (HOSTILE_DOMAINS.has(hostname)) return true;
    for (const domain of HOSTILE_DOMAINS) {
      if (hostname.endsWith(`.${domain}`)) return true;
    }
    return false;
  } catch { return false; }
}

export function isTrackerURL(url: string): boolean {
  return TRACKER_URL_PATTERNS.some(p => p.test(url));
}

export function isHoneypot(url: string, html?: string): boolean {
  if (HONEYPOT_PATTERNS.some(p => p.test(url))) return true;
  if (html) {
    const invisibleLinks = (html.match(/<a[^>]*style="[^"]*display:\s*none[^"]*"[^>]*>/gi) || []).length;
    const hiddenForms = (html.match(/<form[^>]*style="[^"]*(?:display:\s*none|visibility:\s*hidden)[^"]*"[^>]*>/gi) || []).length;
    if (invisibleLinks > 5 || hiddenForms > 2) return true;
    if (/class="[^"]*honeypot[^"]*"/i.test(html)) return true;
  }
  return false;
}

export function scrubOutboundQuery(query: string): string {
  let scrubbed = query;
  for (const pattern of SENSITIVE_OUTBOUND_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, "[REDACTED]");
  }
  return scrubbed;
}

export function scrubOutboundURL(url: string): { safe: boolean; url: string; threats: SandboxThreat[] } {
  const threats: SandboxThreat[] = [];

  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" && !parsed.hostname.endsWith(".onion")) {
      parsed.protocol = "https:";
      url = parsed.toString();
      threats.push({ type: "data-leak", severity: "low", detail: "Upgraded HTTP to HTTPS", action: "stripped" });
    }
    if (!["https:", "http:"].includes(parsed.protocol)) {
      threats.push({ type: "malicious-payload", severity: "critical", detail: `Blocked non-HTTP protocol: ${parsed.protocol}`, action: "blocked" });
      return { safe: false, url, threats };
    }
  } catch {
    threats.push({ type: "malicious-payload", severity: "critical", detail: `Invalid URL: ${url.substring(0, 100)}`, action: "blocked" });
    return { safe: false, url, threats };
  }

  if (isHostileDomain(url)) {
    threats.push({ type: "hostile-domain", severity: "critical", detail: `Hostile domain blocked: ${url}`, action: "blocked" });
    return { safe: false, url, threats };
  }

  if (isTrackerURL(url)) {
    threats.push({ type: "tracker", severity: "high", detail: `Tracker URL blocked: ${url}`, action: "blocked" });
    return { safe: false, url, threats };
  }

  if (isHoneypot(url)) {
    threats.push({ type: "honeypot", severity: "critical", detail: `Honeypot detected: ${url}`, action: "blocked" });
    return { safe: false, url, threats };
  }

  let cleanUrl = url;
  const trackingParams = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "msclkid", "click_id", "ref", "source", "mc_cid", "mc_eid"];
  try {
    const u = new URL(cleanUrl);
    let stripped = false;
    for (const param of trackingParams) {
      if (u.searchParams.has(param)) {
        u.searchParams.delete(param);
        stripped = true;
      }
    }
    if (stripped) {
      threats.push({ type: "tracker", severity: "low", detail: "Tracking parameters stripped from URL", action: "stripped" });
      cleanUrl = u.toString();
    }
  } catch {}

  return { safe: true, url: cleanUrl, threats };
}

export function sanitizeInboundHTML(html: string, sourceUrl: string): SandboxResult {
  const threats: SandboxThreat[] = [];
  let content = html;
  const originalSize = content.length;
  let strippedTrackers = 0;
  let strippedScripts = 0;

  for (const { pattern, replacement, category } of INBOUND_SCRUB_PATTERNS) {
    const before = content.length;
    content = content.replace(pattern, replacement);
    if (content.length < before) {
      strippedTrackers++;
      threats.push({ type: "tracker", severity: "medium", detail: `Stripped ${category} from ${sourceUrl}`, action: "stripped" });
    }
  }

  const scriptCount = (content.match(/<script/gi) || []).length;
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  strippedScripts = scriptCount;
  if (scriptCount > 0) {
    threats.push({ type: "malicious-payload", severity: "high", detail: `Stripped ${scriptCount} script tags`, action: "stripped" });
  }

  content = content.replace(/<link[^>]*rel="preconnect"[^>]*>/gi, "");
  content = content.replace(/<link[^>]*rel="dns-prefetch"[^>]*>/gi, "");

  content = content.replace(/on(?:click|load|error|mouseover|mouseout|focus|blur|submit|change|input|keydown|keyup|keypress|mouseenter|mouseleave|touchstart|touchend|contextmenu|scroll|resize|beforeunload|unload|hashchange|popstate|message|storage|online|offline|visibilitychange|abort|animationend|animationstart|transitionend|wheel|drag|drop|copy|paste|cut)\s*=\s*"[^"]*"/gi, "");

  content = content.replace(/style="[^"]*(?:position:\s*(?:fixed|absolute)[^"]*(?:opacity:\s*0|visibility:\s*hidden|display:\s*none))[^"]*"/gi, 'style="display:none"');

  if (isHoneypot(sourceUrl, content)) {
    threats.push({ type: "honeypot", severity: "critical", detail: `Honeypot patterns detected in content from ${sourceUrl}`, action: "flagged" });
  }

  return {
    clean: threats.filter(t => t.severity === "critical").length === 0,
    content,
    threats,
    strippedTrackers,
    strippedScripts,
    originalSize,
    cleanSize: content.length,
    source: sourceUrl,
    sandboxedAt: Date.now(),
  };
}

export function buildSafeRequestConfig(url: string): AxiosRequestConfig {
  const config: AxiosRequestConfig = {
    timeout: 10000,
    maxRedirects: 3,
    headers: {
      "User-Agent": getRotatedUA(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate",
      "DNT": "1",
      "Sec-GPC": "1",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Connection": "close",
    },
    validateStatus: (status) => status >= 200 && status < 400,
    maxContentLength: 5 * 1024 * 1024,
    maxBodyLength: 5 * 1024 * 1024,
  };

  delete (config.headers as any)["Referer"];
  delete (config.headers as any)["Origin"];

  return config;
}

let _uaIndex = 0;
const SAFE_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64; rv:134.0) Gecko/20100101 Firefox/134.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/131.0.0.0",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
];

function getRotatedUA(): string {
  return SAFE_USER_AGENTS[_uaIndex++ % SAFE_USER_AGENTS.length];
}

export function validateInboundJSON(data: any, sourceUrl: string): { safe: boolean; data: any; threats: SandboxThreat[] } {
  const threats: SandboxThreat[] = [];
  const json = JSON.stringify(data);

  if (json.length > 2 * 1024 * 1024) {
    threats.push({ type: "malicious-payload", severity: "high", detail: `Oversized JSON response (${(json.length / 1024 / 1024).toFixed(1)}MB) from ${sourceUrl}`, action: "blocked" });
    return { safe: false, data: null, threats };
  }

  const dangerousPatterns = [
    { p: /<script/i, d: "Script tag in JSON" },
    { p: /javascript:/i, d: "JavaScript URI in JSON" },
    { p: /eval\s*\(/i, d: "Eval call in JSON" },
    { p: /Function\s*\(/i, d: "Function constructor in JSON" },
    { p: /require\s*\(/i, d: "Require call in JSON" },
    { p: /import\s*\(/i, d: "Dynamic import in JSON" },
    { p: /__proto__/i, d: "Prototype pollution attempt" },
    { p: /constructor\s*\[/i, d: "Constructor access attempt" },
  ];

  for (const { p, d } of dangerousPatterns) {
    if (p.test(json)) {
      threats.push({ type: "malicious-payload", severity: "high", detail: `${d} from ${sourceUrl}`, action: "flagged" });
    }
  }

  return { safe: threats.filter(t => t.severity === "critical").length === 0, data, threats };
}

export function stripTrackingFromLinks(links: string[]): string[] {
  return links
    .filter(url => !isHostileDomain(url) && !isTrackerURL(url))
    .map(url => {
      try {
        const u = new URL(url);
        ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "msclkid", "click_id"].forEach(p => u.searchParams.delete(p));
        return u.toString();
      } catch { return url; }
    });
}

const securityLog: Array<{ timestamp: number; event: string; severity: string; detail: string }> = [];

export function logSecurityEvent(event: string, severity: string, detail: string) {
  securityLog.push({ timestamp: Date.now(), event, severity, detail });
  if (securityLog.length > 500) securityLog.splice(0, 200);
  if (severity === "critical") block(detail);
  else if (severity === "high") warn(detail);
  else log(detail);
}

export function getSecurityLog() {
  return {
    totalEvents: securityLog.length,
    critical: securityLog.filter(e => e.severity === "critical").length,
    high: securityLog.filter(e => e.severity === "high").length,
    recent: securityLog.slice(-20),
  };
}

export async function safeFetch(url: string): Promise<{ data: string; threats: SandboxThreat[]; blocked: boolean }> {
  const urlCheck = scrubOutboundURL(url);
  if (!urlCheck.safe) {
    for (const t of urlCheck.threats) logSecurityEvent("outbound-blocked", t.severity, t.detail);
    return { data: "", threats: urlCheck.threats, blocked: true };
  }

  try {
    const hostname = new URL(urlCheck.url).hostname;
    const ssrf = await resolveAndCheckSSRF(hostname);
    if (!ssrf.safe) {
      const t: SandboxThreat = { type: "malicious-payload", severity: "critical", detail: `SSRF blocked: ${hostname} resolves to private IP ${ssrf.ip}`, action: "blocked" };
      logSecurityEvent("ssrf-blocked", "critical", t.detail);
      return { data: "", threats: [t], blocked: true };
    }
  } catch {}

  const config = buildSafeRequestConfig(urlCheck.url);

  try {
    const resp = await axios.get(urlCheck.url, config);
    const raw = typeof resp.data === "string" ? resp.data : JSON.stringify(resp.data);

    const responseHeaders = resp.headers || {};
    const headerThreats: SandboxThreat[] = [];
    for (const h of FINGERPRINT_HEADERS_TO_STRIP) {
      if (responseHeaders[h]) {
        headerThreats.push({ type: "fingerprint", severity: "low", detail: `Fingerprint header received: ${h}`, action: "stripped" });
      }
    }

    if (typeof resp.data === "string" && resp.data.includes("<")) {
      const sandbox = sanitizeInboundHTML(raw, urlCheck.url);
      for (const t of sandbox.threats) logSecurityEvent("inbound-sanitized", t.severity, t.detail);
      return { data: sandbox.content, threats: [...urlCheck.threats, ...sandbox.threats, ...headerThreats], blocked: false };
    } else {
      const jsonCheck = validateInboundJSON(resp.data, urlCheck.url);
      for (const t of jsonCheck.threats) logSecurityEvent("inbound-validated", t.severity, t.detail);
      return { data: raw, threats: [...urlCheck.threats, ...jsonCheck.threats, ...headerThreats], blocked: false };
    }
  } catch (err: any) {
    return { data: "", threats: [{ type: "malicious-payload", severity: "medium", detail: `Fetch failed: ${err.message?.substring(0, 100)}`, action: "flagged" }], blocked: false };
  }
}

export async function safeJSONFetch<T = any>(url: string): Promise<{ data: T | null; threats: SandboxThreat[]; blocked: boolean }> {
  const urlCheck = scrubOutboundURL(url);
  if (!urlCheck.safe) {
    for (const t of urlCheck.threats) logSecurityEvent("outbound-blocked", t.severity, t.detail);
    return { data: null, threats: urlCheck.threats, blocked: true };
  }

  try {
    const hostname = new URL(urlCheck.url).hostname;
    const ssrf = await resolveAndCheckSSRF(hostname);
    if (!ssrf.safe) {
      const t: SandboxThreat = { type: "malicious-payload", severity: "critical", detail: `SSRF blocked: ${hostname} resolves to private IP ${ssrf.ip}`, action: "blocked" };
      logSecurityEvent("ssrf-blocked", "critical", t.detail);
      return { data: null, threats: [t], blocked: true };
    }
  } catch {}

  const config = buildSafeRequestConfig(urlCheck.url);
  config.headers = { ...config.headers, Accept: "application/json" };

  try {
    const resp = await axios.get(urlCheck.url, config);
    const jsonCheck = validateInboundJSON(resp.data, urlCheck.url);
    for (const t of jsonCheck.threats) logSecurityEvent("inbound-validated", t.severity, t.detail);
    return { data: resp.data as T, threats: [...urlCheck.threats, ...jsonCheck.threats], blocked: false };
  } catch (err: any) {
    return { data: null, threats: [{ type: "malicious-payload", severity: "low", detail: `JSON fetch failed: ${err.message?.substring(0, 100)}`, action: "flagged" }], blocked: false };
  }
}

log("Scraper Sandbox initialized — hostile domain blocklist, tracker stripping, honeypot detection, outbound scrubbing ACTIVE");
