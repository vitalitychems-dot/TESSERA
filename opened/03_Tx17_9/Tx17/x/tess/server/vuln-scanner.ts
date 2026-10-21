import fs from "fs";
import path from "path";

const vsLog = (msg: string) => console.log(`[VulnScanner] ${msg}`);

interface VulnAdvisory {
  packageName: string;
  vulnerableVersions: string;
  severity: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  cve: string;
  description: string;
  fixedIn?: string;
}

const KNOWN_VULNS: VulnAdvisory[] = [
  {
    packageName: "express",
    vulnerableVersions: "<4.19.2",
    severity: "MODERATE",
    cve: "CVE-2024-29041",
    description: "Open redirect vulnerability in Express.js redirect()",
    fixedIn: "4.19.2",
  },
  {
    packageName: "axios",
    vulnerableVersions: "<1.6.0",
    severity: "MODERATE",
    cve: "CVE-2023-45857",
    description: "CSRF vulnerability via cookie forwarding",
    fixedIn: "1.6.0",
  },
  {
    packageName: "semver",
    vulnerableVersions: "<5.7.2 || >=6.0.0 <6.3.1 || >=7.0.0 <7.5.2",
    severity: "MODERATE",
    cve: "CVE-2022-25883",
    description: "Regular expression denial of service (ReDoS)",
    fixedIn: "7.5.2",
  },
  {
    packageName: "got",
    vulnerableVersions: "<11.8.5",
    severity: "MODERATE",
    cve: "CVE-2022-33987",
    description: "SSRF via redirect to unix socket",
    fixedIn: "11.8.5",
  },
  {
    packageName: "ws",
    vulnerableVersions: ">=8.0.0 <8.17.1",
    severity: "HIGH",
    cve: "CVE-2024-37890",
    description: "DoS via crafted HTTP request headers",
    fixedIn: "8.17.1",
  },
  {
    packageName: "path-to-regexp",
    vulnerableVersions: "<0.1.10 || >=1.0.0 <8.0.0",
    severity: "HIGH",
    cve: "CVE-2024-45296",
    description: "ReDoS vulnerability",
    fixedIn: "8.0.0",
  },
  {
    packageName: "body-parser",
    vulnerableVersions: "<1.20.3",
    severity: "HIGH",
    cve: "CVE-2024-45590",
    description: "Denial of service via crafted payload",
    fixedIn: "1.20.3",
  },
  {
    packageName: "cookie",
    vulnerableVersions: "<0.7.0",
    severity: "LOW",
    cve: "CVE-2024-47764",
    description: "Cookie out of bounds error",
    fixedIn: "0.7.0",
  },
  {
    packageName: "serve-static",
    vulnerableVersions: "<1.16.0",
    severity: "MODERATE",
    cve: "CVE-2024-43796",
    description: "Cross-site scripting vulnerability",
    fixedIn: "1.16.0",
  },
  {
    packageName: "send",
    vulnerableVersions: "<0.19.0",
    severity: "LOW",
    cve: "CVE-2024-43799",
    description: "Template injection vulnerability",
    fixedIn: "0.19.0",
  },
];

interface ScanResult {
  scannedAt: number;
  packageCount: number;
  vulnerabilities: Array<VulnAdvisory & { installedVersion: string }>;
  summary: {
    critical: number;
    high: number;
    moderate: number;
    low: number;
    clean: number;
  };
}

let lastScanResult: ScanResult | null = null;

function parseVersionSemver(version: string): number[] {
  const clean = version.replace(/[^0-9.]/g, "");
  return clean.split(".").map(n => parseInt(n, 10) || 0);
}

function compareVersions(a: string, b: string): number {
  const va = parseVersionSemver(a);
  const vb = parseVersionSemver(b);
  for (let i = 0; i < Math.max(va.length, vb.length); i++) {
    const diff = (va[i] || 0) - (vb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function isVersionVulnerable(installed: string, range: string): boolean {
  const parts = range.split("||").map(p => p.trim());
  for (const part of parts) {
    const segments = part.split(/\s+and\s+|\s+/).filter(Boolean);
    let matchCount = 0;
    for (const seg of segments) {
      const match = seg.match(/^([<>=!^~]{1,2})(.+)$/);
      if (!match) continue;
      const [, op, ver] = match;
      const cmp = compareVersions(installed, ver);
      if (op === "<" && cmp < 0) matchCount++;
      else if (op === "<=" && cmp <= 0) matchCount++;
      else if (op === ">" && cmp > 0) matchCount++;
      else if (op === ">=" && cmp >= 0) matchCount++;
      else if (op === "=" && cmp === 0) matchCount++;
    }
    if (matchCount > 0 && matchCount === segments.filter(s => /^[<>=]/.test(s)).length) return true;
  }
  return false;
}

function readInstalledPackages(): Record<string, string> {
  const packages: Record<string, string> = {};
  try {
    const lockPath = path.join(process.cwd(), "package-lock.json");
    const pkgPath = path.join(process.cwd(), "package.json");

    if (fs.existsSync(lockPath)) {
      const lock = JSON.parse(fs.readFileSync(lockPath, "utf-8"));
      const deps = lock.dependencies || lock.packages || {};
      for (const [name, info] of Object.entries(deps)) {
        const cleanName = name.replace(/^node_modules\//, "");
        if (typeof (info as any)?.version === "string") {
          packages[cleanName] = (info as any).version;
        }
      }
    } else if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name, ver] of Object.entries(allDeps)) {
        if (typeof ver === "string") {
          packages[name] = ver.replace(/^[^0-9]*/, "");
        }
      }
    }
  } catch (e: any) {
    vsLog(`Failed to read packages: ${e.message}`);
  }
  return packages;
}

export function runVulnerabilityScanner(): ScanResult {
  vsLog("Starting dependency vulnerability scan...");
  const packages = readInstalledPackages();
  const packageCount = Object.keys(packages).length;
  const vulnerabilities: Array<VulnAdvisory & { installedVersion: string }> = [];

  for (const advisory of KNOWN_VULNS) {
    const installed = packages[advisory.packageName];
    if (!installed) continue;
    const cleanVersion = installed.replace(/[^0-9.]/g, "");
    if (!cleanVersion) continue;

    try {
      if (isVersionVulnerable(cleanVersion, advisory.vulnerableVersions)) {
        vulnerabilities.push({ ...advisory, installedVersion: installed });
      }
    } catch {}
  }

  const summary = {
    critical: vulnerabilities.filter(v => v.severity === "CRITICAL").length,
    high: vulnerabilities.filter(v => v.severity === "HIGH").length,
    moderate: vulnerabilities.filter(v => v.severity === "MODERATE").length,
    low: vulnerabilities.filter(v => v.severity === "LOW").length,
    clean: packageCount - vulnerabilities.length,
  };

  const result: ScanResult = { scannedAt: Date.now(), packageCount, vulnerabilities, summary };
  lastScanResult = result;

  if (vulnerabilities.length === 0) {
    vsLog(`Vulnerability scan CLEAN — ${packageCount} packages scanned, no known CVEs found`);
  } else {
    vsLog(`Vulnerability scan COMPLETE — ${vulnerabilities.length} issues found (${summary.critical} critical, ${summary.high} high)`);
    for (const vuln of vulnerabilities) {
      const severity = vuln.severity;
      const prefix = severity === "CRITICAL" || severity === "HIGH" ? "ALERT" : "WARN";
      vsLog(`[${prefix}] ${vuln.packageName}@${vuln.installedVersion} — ${vuln.cve}: ${vuln.description}${vuln.fixedIn ? ` (fix: upgrade to ${vuln.fixedIn})` : ""}`);
    }
  }

  return result;
}

export function getLastScanResult(): ScanResult | null {
  return lastScanResult;
}

export function runVulnScanOnStartup(): void {
  setTimeout(() => {
    try {
      runVulnerabilityScanner();
    } catch (e: any) {
      vsLog(`Startup scan error: ${e.message}`);
    }
  }, 5000);
}
