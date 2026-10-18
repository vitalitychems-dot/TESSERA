import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import express from "express";
import { createServer, type Server } from "node:http";
import {
  ADMIN_SESSION_STATUS,
  getFatherFingerprint,
  getFatherFingerprintShort,
  getFatherFingerprintUltraShort,
  getFatherIdentity,
  getFatherSeal,
  getInstallId,
} from "../lib/father-identity";
import { logger } from "../lib/logger";
import { rotateSessionKey } from "../lib/sigil-cipher";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import sovereignDoctrineRouter from "../routes/sovereign-doctrine";
import languageSecurityRouter from "../routes/language-security";
import legacyEnginesRouter from "../routes/legacy-engines";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const ADMIN_KEY = "synthetic-admin-key-for-tests-only";
const SESSION_SECRET = "synthetic-session-secret-32chars!!";
const FINGERPRINT_NAMESPACE = "tesseract:father:v1";

describe("father fingerprint is absent from handler responses and logs", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdmin = process.env[ADMIN_ENV];
  const previousSession = process.env[SESSION_ENV];
  const logLines: string[] = [];
  const restoreLogger: Array<() => void> = [];
  let restoreStderr: (() => void) | undefined;

  beforeAll(async () => {
    process.env[ADMIN_ENV] = ADMIN_KEY;
    process.env[SESSION_ENV] = SESSION_SECRET;
    rotateSessionKey("handler-scan");

    const levels = ["fatal", "error", "warn", "info", "debug", "trace"] as const;
    for (const level of levels) {
      const current = logger[level];
      if (typeof current !== "function") continue;
      (logger as unknown as Record<string, unknown>)[level] = (...args: unknown[]) => {
        logLines.push(serializeLog(args));
      };
      restoreLogger.push(() => {
        (logger as unknown as Record<string, unknown>)[level] = current;
      });
    }

    const originalStderr = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array) => {
      logLines.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
      return true;
    }) as typeof process.stderr.write;
    restoreStderr = () => {
      process.stderr.write = originalStderr;
    };

    const app = express();
    app.use(express.json());
    app.use(sovereignDoctrineRouter);
    app.use(languageSecurityRouter);
    app.use(legacyEnginesRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    for (const restore of restoreLogger) restore();
    restoreStderr?.();
    if (previousAdmin === undefined) delete process.env[ADMIN_ENV];
    else process.env[ADMIN_ENV] = previousAdmin;
    if (previousSession === undefined) delete process.env[SESSION_ENV];
    else process.env[SESSION_ENV] = previousSession;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("uses a persisted random install id instead of a key digest", () => {
    const installId = getInstallId();
    expect(installId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(getFatherFingerprint() === installId).toBe(true);
    expect(getFatherFingerprintShort() === installId).toBe(true);
    expect(getFatherFingerprintUltraShort() === installId).toBe(true);
    expect(getInstallId() === installId).toBe(true);
    const identity = getFatherIdentity();
    expect(identity.status).toBe(ADMIN_SESSION_STATUS);
    expect(identity.installId === installId).toBe(true);
    expect("fingerprint" in identity).toBe(false);
    expect("fingerprintShort" in identity).toBe(false);
    expect("seal" in identity).toBe(false);
    expect("derivation" in identity).toBe(false);
    expect(containsForbidden(JSON.stringify(identity), forbiddenMarkers())).toBe(false);
  });

  it("keeps key-derived digests out of handler bodies and logs", async () => {
    const cookie = ownerCookie();
    const calls: Array<{ name: string; method: "GET" | "POST"; path: string; body?: unknown; sigilKey?: boolean }> = [
      { name: "active-key", method: "GET", path: "/sigil/active-key", sigilKey: true },
      { name: "father-verify", method: "POST", path: "/sigil/father/verify", body: { candidate: ADMIN_KEY }, sigilKey: true },
      { name: "show-key-in-lus", method: "POST", path: "/sigil/father/show-key-in-lus", body: { candidate: ADMIN_KEY }, sigilKey: true },
      { name: "mint-glyph", method: "POST", path: "/sigil/father/mint-glyph", body: { candidate: ADMIN_KEY }, sigilKey: true },
      { name: "key-reveal", method: "POST", path: "/sigil/key/reveal", body: {}, sigilKey: true },
      { name: "session-handoff", method: "GET", path: "/session/handoff", sigilKey: true },
      { name: "natal-status", method: "GET", path: "/sigil/natal/status", sigilKey: true },
      { name: "identity-status", method: "GET", path: "/identity/status" },
    ];

    const markers = forbiddenMarkers();
    for (const call of calls) {
      const headers = new Headers({ cookie });
      if (call.sigilKey) headers.set("x-sigil-key", ADMIN_KEY);
      if (call.body !== undefined) headers.set("content-type", "application/json");
      const response = await fetch(`${baseUrl}${call.path}`, {
        method: call.method,
        headers,
        body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
      });
      const text = await response.text();
      const headerText = JSON.stringify([...response.headers.entries()]);
      expect(response.status, call.name).toBe(200);
      expect(containsForbidden(text, markers), call.name).toBe(false);
      expect(containsForbidden(headerText, markers), `${call.name} headers`).toBe(false);
      if (call.name === "active-key" || call.name === "father-verify" || call.name === "show-key-in-lus") {
        const body = JSON.parse(text) as { status?: string; fatherFingerprint?: unknown; fingerprint?: unknown; wouldBeFingerprint?: unknown };
        expect(body.status).toBe(ADMIN_SESSION_STATUS);
        expect(body.fatherFingerprint).toBeUndefined();
        expect(body.fingerprint).toBeUndefined();
        expect(body.wouldBeFingerprint).toBeUndefined();
      }
      if (call.name === "active-key") {
        const body = JSON.parse(text) as { key?: { fingerprint?: string } };
        expect(body.key?.fingerprint === getInstallId()).toBe(true);
      }
      if (call.name === "mint-glyph") {
        const body = JSON.parse(text) as { wouldBeFingerprint?: unknown };
        expect(body.wouldBeFingerprint).toBeUndefined();
      }
    }

    expect(containsForbidden(logLines.join("\n"), markers), "logs").toBe(false);
  });
});

function ownerCookie(): string {
  const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
  return `${SESSION_COOKIE}=${issued.signedId}`;
}

function forbiddenMarkers(): string[] {
  const markers = new Set<string>([ADMIN_KEY, getFatherSeal()]);
  const digests = [
    createHash("sha256").update(ADMIN_KEY).digest("hex"),
    createHash("sha256").update(`${FINGERPRINT_NAMESPACE}|${ADMIN_KEY}`).digest("hex"),
  ];
  for (const digest of digests) {
    for (let length = 8; length <= digest.length; length += 1) {
      markers.add(digest.slice(0, length));
    }
  }
  return [...markers];
}

function containsForbidden(text: string, markers: readonly string[]): boolean {
  const haystack = text.toLowerCase();
  for (const marker of markers) {
    if (marker.length >= 8 && haystack.includes(marker.toLowerCase())) return true;
  }
  return false;
}

function serializeLog(args: unknown[]): string {
  try {
    return JSON.stringify(args);
  } catch {
    return "[unserializable log]";
  }
}
