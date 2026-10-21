/**
 * MITRE ATT&CK Framework Integration
 * Grand Dimension Council Proposal #13 — 98% YES — CRITICAL
 * Proposed by Delta-Shield (Dimension 4 — Security)
 *
 * Classifies all security threats using MITRE ATT&CK taxonomy.
 * Automated response playbooks for top 20 attack patterns.
 */

import { logger } from "./logger";
import crypto from "crypto";

const log = (msg: string) => logger.info("MITRE-ATT&CK", msg);

// ── MITRE ATT&CK Tactic/Technique Library ─────────────────────────────────

export interface ATTACKTechnique {
  id: string; // e.g. "T1190"
  name: string;
  tactic: string;
  tacticId: string;
  description: string;
  platforms: string[];
  detectionKeywords: string[];
  mitigations: string[];
  playbook: string[];
  severity: "critical" | "high" | "medium" | "low";
}

export interface ThreatClassification {
  eventId: string;
  timestamp: number;
  inputIndicator: string;
  matchedTechniques: ATTACKTechnique[];
  primaryTechnique: ATTACKTechnique | null;
  confidence: number; // 0-1
  tactic: string;
  severity: "critical" | "high" | "medium" | "low";
  responsePlaybook: string[];
  mitigationSteps: string[];
  autoResponse: "blocked" | "monitored" | "logged" | "escalated";
}

// ── Top 20 ATT&CK Techniques for Web/API Security ─────────────────────────

const MITRE_TECHNIQUES: ATTACKTechnique[] = [
  {
    id: "T1190",
    name: "Exploit Public-Facing Application",
    tactic: "Initial Access",
    tacticId: "TA0001",
    description: "Exploit weakness in internet-facing application (SQL injection, XSS, RCE)",
    platforms: ["Linux", "Windows", "macOS", "Network"],
    detectionKeywords: ["union select", "exec(", "system(", "shell_exec", "<script>", "javascript:", "base64_decode", "../../../", "etc/passwd"],
    mitigations: ["Input validation", "WAF", "Parameterized queries", "CSP headers"],
    playbook: ["1. Immediately block source IP", "2. Log request with threat ID", "3. Alert admin", "4. Analyze payload for zero-days", "5. Update WAF rules"],
    severity: "critical",
  },
  {
    id: "T1059",
    name: "Command and Scripting Interpreter",
    tactic: "Execution",
    tacticId: "TA0002",
    description: "Attempt to execute commands via injection into application interpreter",
    platforms: ["Linux", "Windows"],
    detectionKeywords: ["exec(", "eval(", "system(", "popen(", "subprocess", "child_process", "cmd.exe", "/bin/sh", "powershell"],
    mitigations: ["Disable dangerous functions", "Sandbox execution", "Principle of least privilege"],
    playbook: ["1. Block request with 403", "2. Isolate any spawned processes", "3. Log command payload", "4. Alert security team"],
    severity: "critical",
  },
  {
    id: "T1078",
    name: "Valid Accounts — Credential Stuffing",
    tactic: "Initial Access",
    tacticId: "TA0001",
    description: "Using stolen credentials from breaches to gain unauthorized access",
    platforms: ["All"],
    detectionKeywords: ["admin:admin", "root:root", "test:test", "password:password", "admin:password", "user:user", "login attempt"],
    mitigations: ["MFA", "Rate limiting", "Account lockout", "Credential leak monitoring"],
    playbook: ["1. Rate limit source IP", "2. Require CAPTCHA", "3. Alert on unusual login patterns", "4. Check against HaveIBeenPwned"],
    severity: "high",
  },
  {
    id: "T1110",
    name: "Brute Force",
    tactic: "Credential Access",
    tacticId: "TA0006",
    description: "Systematic trial of passwords/tokens to gain access",
    platforms: ["All"],
    detectionKeywords: ["rapid login", "multiple failed", "brute force", "dictionary attack", "password spray"],
    mitigations: ["Account lockout", "CAPTCHA", "Rate limiting", "IP reputation", "MFA"],
    playbook: ["1. Progressive delay (exponential backoff)", "2. Temporary account lock after 5 failures", "3. Log all attempts", "4. Block IP after 20 failures"],
    severity: "high",
  },
  {
    id: "T1552",
    name: "Unsecured Credentials",
    tactic: "Credential Access",
    tacticId: "TA0006",
    description: "Scanning for exposed secrets, API keys, credentials in files or paths",
    platforms: ["All"],
    detectionKeywords: [".env", ".git/config", "id_rsa", ".aws/credentials", "secrets.json", "credentials.xml", "passwd", "shadow", "auth.json"],
    mitigations: ["Secrets management", "File permission auditing", "Scanner detection and blocking"],
    playbook: ["1. Return 403 with threat ID (no data)", "2. Log scanner signature", "3. Add to IP blocklist", "4. Audit if real files were exposed"],
    severity: "high",
  },
  {
    id: "T1595",
    name: "Active Scanning",
    tactic: "Reconnaissance",
    tacticId: "TA0043",
    description: "Scanning the system with automated vulnerability scanners",
    platforms: ["All"],
    detectionKeywords: ["nikto", "nmap", "masscan", "shodan", "censys", "zap", "burp", "dirsearch", "gobuster", "wfuzz", "sqlmap", "nuclei"],
    mitigations: ["Rate limiting", "Scanner fingerprint detection", "Real 403 responses (no honeypots)"],
    playbook: ["1. Block scanner user-agents", "2. Rate limit aggressively", "3. Return real 403s (not honeypot data)", "4. Log scanner IP and UA signature"],
    severity: "medium",
  },
  {
    id: "T1046",
    name: "Network Service Discovery",
    tactic: "Discovery",
    tacticId: "TA0007",
    description: "Probing for open ports, services, and API endpoints",
    platforms: ["All"],
    detectionKeywords: ["/wp-admin", "/phpmyadmin", "/admin", "/login.php", "/xmlrpc.php", "/actuator", "/console", "/.git", "/backup", "/swagger", "/graphql"],
    mitigations: ["Remove exposed admin endpoints", "Restrict API access", "Use non-standard paths"],
    playbook: ["1. Return 403 with threat ID", "2. Log probe path and source", "3. Track probe patterns across sessions", "4. Auto-ban IPs with >10 probe attempts"],
    severity: "medium",
  },
  {
    id: "T1071",
    name: "Application Layer Protocol Abuse",
    tactic: "Command and Control",
    tacticId: "TA0011",
    description: "Using HTTP/S API to exfiltrate data or communicate with C2 infrastructure",
    platforms: ["All"],
    detectionKeywords: ["excessive api calls", "bulk data export", "high volume", "data dump", "exfiltration"],
    mitigations: ["Rate limiting", "Data loss prevention", "API response size limits"],
    playbook: ["1. Throttle response rate", "2. Require authentication for bulk operations", "3. Alert on unusual data volumes", "4. Log data egress patterns"],
    severity: "high",
  },
  {
    id: "T1055",
    name: "Process Injection",
    tactic: "Defense Evasion",
    tacticId: "TA0005",
    description: "Attempt to inject code into running processes via server-side execution",
    platforms: ["Linux", "Windows"],
    detectionKeywords: ["process.env", "global.__", "__proto__", "constructor.constructor", "prototype pollution"],
    mitigations: ["Disable prototype access", "Object.freeze globals", "Content Security Policy"],
    playbook: ["1. Block request", "2. Log prototype chain access attempt", "3. Alert immediately — critical severity"],
    severity: "critical",
  },
  {
    id: "T1562",
    name: "Impair Defenses",
    tactic: "Defense Evasion",
    tacticId: "TA0005",
    description: "Attempting to disable or bypass security controls",
    platforms: ["All"],
    detectionKeywords: ["disable security", "bypass auth", "ignore ssl", "skip verification", "turn off", "disable firewall", "rm -rf"],
    mitigations: ["Immutable security config", "Alert on security config change attempts", "Read-only security modules"],
    playbook: ["1. Block request", "2. Log bypass attempt with full context", "3. Alert admin immediately"],
    severity: "critical",
  },
  {
    id: "T1499",
    name: "Endpoint Denial of Service",
    tactic: "Impact",
    tacticId: "TA0040",
    description: "Flooding endpoints to cause denial of service",
    platforms: ["All"],
    detectionKeywords: ["flood", "dos attack", "rate exceeded", "too many requests"],
    mitigations: ["Rate limiting", "Circuit breakers", "CDN with DDoS protection"],
    playbook: ["1. Activate circuit breaker", "2. Apply progressive delay", "3. Return 429 with retry-after header", "4. Log flood signature"],
    severity: "high",
  },
  {
    id: "T1134",
    name: "Access Token Manipulation",
    tactic: "Privilege Escalation",
    tacticId: "TA0004",
    description: "Attempting to forge or manipulate JWT/session tokens",
    platforms: ["All"],
    detectionKeywords: ["jwt", "Bearer", "token manipulation", "alg:none", "HS256 to none", "modify token"],
    mitigations: ["Verify token signature", "Use RS256 for JWTs", "Token expiry enforcement"],
    playbook: ["1. Reject token, return 401", "2. Log token structure", "3. Invalidate session", "4. Alert on algorithm switching attempts"],
    severity: "high",
  },
  {
    id: "T1036",
    name: "Masquerading",
    tactic: "Defense Evasion",
    tacticId: "TA0005",
    description: "Disguising malicious activity as legitimate (user agent spoofing, IP rotation)",
    platforms: ["All"],
    detectionKeywords: ["curl/", "python-requests", "go-http-client", "bot", "scanner", "spider", "crawler", "headless"],
    mitigations: ["User agent fingerprinting", "Behavioral analysis", "JavaScript challenge"],
    playbook: ["1. Flag request for enhanced scrutiny", "2. Apply additional rate limiting", "3. Log UA pattern"],
    severity: "medium",
  },
  {
    id: "T1114",
    name: "Email Collection / Data Exfiltration",
    tactic: "Collection",
    tacticId: "TA0009",
    description: "Attempting to extract PII, emails, or sensitive data via API",
    platforms: ["All"],
    detectionKeywords: ["bulk export", "dump all", "select *", "export csv", "all users", "all emails", "user list"],
    mitigations: ["PII redaction", "Field-level access control", "Audit log for bulk queries"],
    playbook: ["1. Require elevated authentication for bulk queries", "2. Redact PII in responses", "3. Log bulk request", "4. Rate limit data export"],
    severity: "high",
  },
  {
    id: "T1189",
    name: "Drive-by Compromise",
    tactic: "Initial Access",
    tacticId: "TA0001",
    description: "Exploiting web browser vulnerabilities through malicious content injection",
    platforms: ["Windows", "macOS", "Linux"],
    detectionKeywords: ["xss", "<script>", "onerror=", "onload=", "javascript:", "vbscript:", "data:text/html"],
    mitigations: ["CSP headers", "Input sanitization", "XSS filter middleware", "HttpOnly cookies"],
    playbook: ["1. Sanitize all output", "2. Block payload", "3. Log XSS attempt", "4. Add to WAF rules"],
    severity: "high",
  },
  {
    id: "T1203",
    name: "Exploitation for Client Execution",
    tactic: "Execution",
    tacticId: "TA0002",
    description: "Exploiting client-side vulnerabilities via server responses",
    platforms: ["All"],
    detectionKeywords: ["prototype pollution", "__proto__", "constructor[constructor]", "Object.assign exploit"],
    mitigations: ["Input validation", "Safe property access", "Object.freeze prototypes"],
    playbook: ["1. Block request", "2. Log full payload", "3. Alert — critical severity"],
    severity: "critical",
  },
  {
    id: "T1041",
    name: "Exfiltration Over C2 Channel",
    tactic: "Exfiltration",
    tacticId: "TA0010",
    description: "Using the established connection to exfiltrate data",
    platforms: ["All"],
    detectionKeywords: ["large response", "bulk download", "base64 data", "compressed export"],
    mitigations: ["Response size limits", "Egress monitoring", "Data loss prevention"],
    playbook: ["1. Limit response size", "2. Require pagination for large results", "3. Log large data transfers"],
    severity: "medium",
  },
  {
    id: "T1592",
    name: "Gather Victim Host Information",
    tactic: "Reconnaissance",
    tacticId: "TA0043",
    description: "Collecting information about the target infrastructure",
    platforms: ["All"],
    detectionKeywords: ["server info", "version info", "whatweb", "technology stack", "powered by", "x-powered-by"],
    mitigations: ["Remove version headers", "Generic error messages", "No stack trace in responses"],
    playbook: ["1. Strip server version headers", "2. Return generic error messages", "3. Log reconnaissance attempt"],
    severity: "low",
  },
  {
    id: "T1530",
    name: "Data from Cloud Storage",
    tactic: "Collection",
    tacticId: "TA0009",
    description: "Accessing cloud storage without authorization",
    platforms: ["IaaS", "SaaS"],
    detectionKeywords: ["s3://", "gs://", "azure://", "storage bucket", "blob storage", "cloud storage"],
    mitigations: ["Storage access control", "Audit logging", "SSRF prevention"],
    playbook: ["1. Block SSRF attempts", "2. Validate all URL inputs", "3. Restrict internal network access"],
    severity: "high",
  },
  {
    id: "T1119",
    name: "Automated Collection",
    tactic: "Collection",
    tacticId: "TA0009",
    description: "Using automated scripts to systematically collect data",
    platforms: ["All"],
    detectionKeywords: ["systematic scan", "automated", "no human delay", "rapid sequential", "bot pattern"],
    mitigations: ["Rate limiting", "CAPTCHA", "Bot detection", "Behavioral analysis"],
    playbook: ["1. Detect bot-like timing patterns", "2. Apply progressive challenges", "3. Implement honeytrap pages"],
    severity: "medium",
  },
];

// ── Event Log ──────────────────────────────────────────────────────────────

const classificationLog: ThreatClassification[] = [];

// ── Classifier ─────────────────────────────────────────────────────────────

export function classifyThreat(indicator: string, context?: { ip?: string; ua?: string; path?: string; method?: string }): ThreatClassification {
  const indicatorLower = indicator.toLowerCase();
  const contextStr = [
    context?.path || "",
    context?.ua || "",
    context?.method || "",
  ].join(" ").toLowerCase();
  const combined = indicatorLower + " " + contextStr;

  const matches: Array<{ technique: ATTACKTechnique; score: number }> = [];

  for (const technique of MITRE_TECHNIQUES) {
    let score = 0;
    for (const keyword of technique.detectionKeywords) {
      if (combined.includes(keyword.toLowerCase())) {
        score += keyword.length; // Longer keywords = more specific = higher score
      }
    }
    if (score > 0) matches.push({ technique, score });
  }

  matches.sort((a, b) => b.score - a.score);

  const primaryMatch = matches[0];
  const matchedTechniques = matches.slice(0, 3).map(m => m.technique);

  const severity = primaryMatch?.technique.severity || "low";
  const confidence = primaryMatch ? Math.min(0.99, primaryMatch.score / 20) : 0;

  const autoResponse: ThreatClassification["autoResponse"] =
    severity === "critical" ? "blocked" :
    severity === "high" ? "escalated" :
    severity === "medium" ? "monitored" : "logged";

  const classification: ThreatClassification = {
    eventId: `MITRE-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
    timestamp: Date.now(),
    inputIndicator: indicator.slice(0, 500),
    matchedTechniques,
    primaryTechnique: primaryMatch?.technique || null,
    confidence,
    tactic: primaryMatch?.technique.tactic || "Unknown",
    severity,
    responsePlaybook: primaryMatch?.technique.playbook || ["Log event and monitor"],
    mitigationSteps: primaryMatch?.technique.mitigations || ["Apply security best practices"],
    autoResponse,
  };

  classificationLog.push(classification);
  if (classificationLog.length > 1000) classificationLog.splice(0, classificationLog.length - 1000);

  if (severity === "critical" || severity === "high") {
    log(`${severity.toUpperCase()} threat: ${primaryMatch?.technique.id} — ${primaryMatch?.technique.name} (${confidence.toFixed(2)} confidence) — Action: ${autoResponse}`);
  }

  return classification;
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getThreatClassificationLog(filter?: { severity?: string; tactic?: string; limit?: number }) {
  let log = [...classificationLog].reverse(); // Most recent first
  if (filter?.severity) log = log.filter(c => c.severity === filter.severity);
  if (filter?.tactic) log = log.filter(c => c.tactic === filter.tactic);
  return log.slice(0, filter?.limit || 50);
}

export function getMITREStats() {
  const recent = classificationLog.filter(c => Date.now() - c.timestamp < 86400000);
  const tactics = [...new Set(classificationLog.map(c => c.tactic))];
  const blocked = classificationLog.filter(c => c.autoResponse === "blocked").length;
  const critical = classificationLog.filter(c => c.severity === "critical").length;

  return {
    totalClassified: classificationLog.length,
    last24h: recent.length,
    blocked,
    critical,
    tacticsDetected: tactics,
    techniquesAvailable: MITRE_TECHNIQUES.length,
    mostCommonTactic: tactics.sort((a, b) =>
      classificationLog.filter(c => c.tactic === b).length -
      classificationLog.filter(c => c.tactic === a).length
    )[0] || "none",
    avgConfidence: classificationLog.length > 0
      ? Math.round(classificationLog.reduce((s, c) => s + c.confidence, 0) / classificationLog.length * 100)
      : 0,
  };
}

export function getMITRETechniquesCatalog() {
  return MITRE_TECHNIQUES.map(t => ({
    id: t.id,
    name: t.name,
    tactic: t.tactic,
    tacticId: t.tacticId,
    severity: t.severity,
    description: t.description,
    mitigationCount: t.mitigations.length,
  }));
}

log(`MITRE ATT&CK Integration loaded — ${MITRE_TECHNIQUES.length} techniques across ${[...new Set(MITRE_TECHNIQUES.map(t => t.tactic))].length} tactics`);
