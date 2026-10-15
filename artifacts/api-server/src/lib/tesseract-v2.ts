// ─────────────────────────────────────────────────────────────────────────────
// Tesseract V2 — ratified Apr 2026, twelve cross-category council proposals.
// Helpers shared across the V2 implementation: ETag (V2-BETA),
// ingress audit (V2-ALPHA), audit manifest writer (V2-OMICRON),
// secret fingerprint attestation (V2-LAMBDA), surface walker (V2-DELTA).
// All pure node, no external deps, all bounded.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from "node:crypto";
import {
  promises as fs,
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";

const DATA_DIR = path.resolve(process.cwd(), "data");
const INGRESS_PATH = path.join(DATA_DIR, "ingress-audit.jsonl");
const MANIFEST_PATH = path.join(DATA_DIR, "audit-manifest.json");
const LEGACY_IP_FIELDS = new Set(
  [
    "ip", "clientIp", "sourceIp", "ipAddress", "remoteAddress", "remoteIp",
    "clientAddress", "sourceAddress", "ip_address", "client_ip", "source_ip", "remote_address",
  ].map((field) => field.toLowerCase()),
);

// V2-BETA: stable ETag from response body. 304 short-circuit on match.
export function etagFor(body: string): string {
  return `"v2-${createHash("sha1").update(body).digest("base64url").slice(0, 16)}"`;
}

export function sendWithEtag(req: Request, res: Response, payload: unknown): void {
  const body = JSON.stringify(payload);
  const tag = etagFor(body);
  res.setHeader("ETag", tag);
  res.setHeader("Cache-Control", "private, max-age=15");
  if (req.headers["if-none-match"] === tag) {
    res.status(304).end();
    return;
  }
  res.setHeader("Content-Type", "application/json");
  res.status(200).send(body);
}

// V2-GAMMA: process-integrity attestation header. Carries the ratifying
// proposal id and approval rate so callers can verify governance provenance.
export function attestRatified(res: Response, proposalId: string, approvalRate: number): void {
  res.setHeader("X-Council-Ratified", `${proposalId}; rate=${approvalRate.toFixed(3)}`);
}

// V2-ALPHA: bounded synchronous append for ingress audit. Synchronous so
// the line is on disk before the response is written; one tiny line per call.
// Post-review hardening: file size cap + single rolling backup so growth is
// strictly bounded. Default 1 MB; override with INGRESS_AUDIT_MAX_BYTES.
let _ingressDirEnsured = false;
let _ingressBytesSinceCheck = 0;
const configuredIngressMax = Number(process.env.INGRESS_AUDIT_MAX_BYTES ?? 1024 * 1024);
const INGRESS_MAX_BYTES = Number.isFinite(configuredIngressMax)
  ? Math.max(64 * 1024, configuredIngressMax)
  : 1024 * 1024;
const INGRESS_CHECK_EVERY = 64; // statSync at most every N writes
let _ingressWriteCount = 0;

export interface IngressAuditEntry {
  ts: number;
  route: string;
  status: number;
  sessionHash?: string;
}

export function serializeIngressRecord(entry: IngressAuditEntry): string {
  // Construct an allowlisted shape instead of serializing arbitrary caller fields.
  const safe: IngressAuditEntry = { ts: entry.ts, route: entry.route, status: entry.status };
  if (typeof entry.sessionHash === "string") safe.sessionHash = entry.sessionHash;
  return JSON.stringify(safe);
}

export function redactLegacyIngressContent(content: string): string {
  let changed = false;
  const redactFields = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    let localChange = false;
    for (const key of Object.keys(value)) {
      if (LEGACY_IP_FIELDS.has(key.toLowerCase())) {
        delete (value as Record<string, unknown>)[key];
        localChange = true;
      } else if (redactFields((value as Record<string, unknown>)[key])) {
        localChange = true;
      }
    }
    return localChange;
  };
  const redacted = content.split("\n").map((line) => {
    if (!line) return line;
    try {
      const record: unknown = JSON.parse(line);
      if (!record || typeof record !== "object" || Array.isArray(record)) {
        changed = true;
        return "";
      }
      const lineChanged = redactFields(record);
      if (!lineChanged) return line;
      changed = true;
      return JSON.stringify(record);
    } catch {
      // A corrupt audit row is not useful telemetry and may contain unparseable PII.
      changed = true;
      return "";
    }
  }).join("\n");
  return changed ? redacted : content;
}

function redactLegacyIngressFile(filePath: string): boolean {
  if (!existsSync(filePath)) return true;
  try {
    const original = readFileSync(filePath, "utf8");
    const redacted = redactLegacyIngressContent(original);
    if (redacted !== original) {
      const temporaryPath = `${filePath}.redacting`;
      writeFileSync(temporaryPath, redacted, { encoding: "utf8", mode: 0o600 });
      renameSync(temporaryPath, filePath);
    }
    return true;
  } catch {
    process.stderr.write("[ingress-audit] WARN legacy address redaction failed; ingress writes disabled\n");
    return false;
  }
}

// Redact existing clear-text addresses in both the active file and its one
// rolling backup before accepting or writing any new audit records.
let _ingressPrivacyReady = [
  redactLegacyIngressFile(INGRESS_PATH),
  redactLegacyIngressFile(`${INGRESS_PATH}.1`),
].every(Boolean);

export function recordIngress(entry: IngressAuditEntry): void {
  try {
    if (!_ingressPrivacyReady) return;
    if (!_ingressDirEnsured) {
      try { mkdirSync(DATA_DIR, { recursive: true }); } catch { /* ignore */ }
      _ingressDirEnsured = true;
    }
    const line = serializeIngressRecord(entry) + "\n";
    appendFileSync(INGRESS_PATH, line, "utf8");
    _ingressBytesSinceCheck += line.length;
    _ingressWriteCount++;
    if (_ingressWriteCount % INGRESS_CHECK_EVERY === 0 || _ingressBytesSinceCheck > INGRESS_MAX_BYTES / 8) {
      _ingressBytesSinceCheck = 0;
      try {
        const st = statSync(INGRESS_PATH);
        if (st.size > INGRESS_MAX_BYTES) {
          // One rolling size-based backup; the next rollover replaces this copy.
          try { renameSync(INGRESS_PATH, INGRESS_PATH + ".1"); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }
  } catch (err) {
    process.stderr.write("[ingress-audit] WARN audit record could not be written\n");
  }
}

// V2-LAMBDA: cryptographic key drift attestation. Hash the secret,
// publish the fingerprint (NOT the secret) so the operator can detect
// unintended rotation.
export function secretFingerprint(secret: string): string {
  if (!secret) return "unset";
  return createHash("sha256").update(secret).digest("hex").slice(0, 12);
}

// V2-OMICRON: unified audit manifest. Best-effort write at startup so the
// operator has one place to learn what audit files exist and why.
export async function writeAuditManifest(): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const manifest = {
      writtenAt: new Date().toISOString(),
      surfaces: [
        {
          file: "council-ledger.jsonl",
          purpose: "INTEG-1: append-only record of every terminal council proposal (approved or rejected)",
          rotation: "rotates at 2048 lines / 1MB into council-ledger.jsonl.1",
          contains: "proposal id, title, category, status, approval rate, vote counts, proposer",
        },
        {
          file: "ingress-audit.jsonl",
          purpose: "V2-ALPHA: bounded record of privileged perimeter calls",
          rotation: "size-based: default 1 MiB cap (minimum 64 KiB) plus one rolling .1 backup; no time-based expiry",
          contains: "timestamp, route, response status, hashed session id; no IP address, cookie, or credential",
          legacyRedaction: "startup removes legacy IP fields and invalid rows from the active file and rolling backup",
        },
      ],
    };
    await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  } catch (err) {
    process.stderr.write(`[audit-manifest] WARN ${(err as Error).message}\n`);
  }
}

// V2-DELTA: walk the express router for an attack-surface scan.
// Returns the mounted paths reachable on the app.
export function walkRoutes(stack: any[]): Array<{ method: string; path: string }> {
  const out: Array<{ method: string; path: string }> = [];
  function mountPrefix(layer: any): string {
    // Try to recover the mount prefix from the regexp source.
    const src: string | undefined = layer?.regexp?.source;
    if (!src) return "";
    // Express 5 uses path-to-regexp v6 — typical source: "^\\/api\\/?(?=\\/|$)"
    const m = src.match(/^\^\\?(\/[^\\?(]*)/);
    if (!m) return "";
    return m[1].replace(/\\\//g, "/");
  }
  function visit(layer: any, prefix: string): void {
    if (!layer) return;
    if (layer.route) {
      const p = prefix + (layer.route.path || "");
      const methodMap = layer.route.methods || layer.route.method || {};
      const methods = Object.keys(methodMap).filter(k => methodMap[k]);
      for (const m of methods) out.push({ method: m.toUpperCase(), path: p });
      return;
    }
    // Recurse into anything that exposes a sub-stack (mounted Router, Router 5 layer, etc.).
    const subStack = layer?.handle?.stack ?? layer?.handle?.handle?.stack;
    if (Array.isArray(subStack)) {
      const childPrefix = prefix + mountPrefix(layer);
      for (const inner of subStack) visit(inner, childPrefix);
    }
  }
  for (const l of stack) visit(l, "");
  return out;
}
