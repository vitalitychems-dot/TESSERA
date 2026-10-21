import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import express from "express";
import { createServer, type Server } from "node:http";
import { fileURLToPath } from "node:url";
import {
  ADMIN_SESSION_STATUS,
  getFatherIdentity,
  getFatherSeal,
  getInstallId,
} from "../lib/father-identity";
import * as fatherIdentity from "../lib/father-identity";
import { logger } from "../lib/logger";
import { cipherCoherenceSnapshot, rotateSessionKey } from "../lib/sigil-cipher";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import sovereignDoctrineRouter from "../routes/sovereign-doctrine";
import languageSecurityRouter from "../routes/language-security";
import legacyEnginesRouter from "../routes/legacy-engines";
import omniversalRouter from "../routes/omniversal";
import grandConferenceRouter from "../routes/grand-conference-cipher";

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
  const previousChart = process.env.FATHER_NATAL_CHART_JSON;
  const logLines: string[] = [];
  const restoreLogger: Array<() => void> = [];
  let restoreStderr: (() => void) | undefined;

  beforeAll(async () => {
    process.env[ADMIN_ENV] = ADMIN_KEY;
    process.env[SESSION_ENV] = SESSION_SECRET;
    delete process.env.FATHER_NATAL_CHART_JSON;
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
    app.use(omniversalRouter);
    app.use(grandConferenceRouter);
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
    if (previousChart === undefined) delete process.env.FATHER_NATAL_CHART_JSON;
    else process.env.FATHER_NATAL_CHART_JSON = previousChart;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("uses a persisted random install id instead of a key digest", () => {
    const installId = getInstallId();
    expect(installId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect("getFatherFingerprint" in fatherIdentity).toBe(false);
    expect("getFatherFingerprintShort" in fatherIdentity).toBe(false);
    expect("getFatherFingerprintUltraShort" in fatherIdentity).toBe(false);
    expect(getInstallId() === installId).toBe(true);
    const installPath = fileURLToPath(new URL("../../.local-data/install-id", import.meta.url));
    expect(existsSync(installPath)).toBe(true);
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
    const calls: Array<{ name: string; method: "GET" | "POST"; path: string; body?: unknown; expectStatus?: number }> = [
      { name: "active-key", method: "GET", path: "/sigil/active-key" },
      { name: "father-verify", method: "POST", path: "/sigil/father/verify", body: { candidate: ADMIN_KEY } },
      { name: "show-key-in-lus-retired", method: "POST", path: "/sigil/father/show-key-in-lus", body: { candidate: ADMIN_KEY }, expectStatus: 410 },
      { name: "mint-glyph", method: "POST", path: "/sigil/father/mint-glyph", body: { candidate: ADMIN_KEY } },
      { name: "key-reveal", method: "POST", path: "/sigil/key/reveal", body: {} },
      { name: "session-handoff", method: "GET", path: "/session/handoff" },
      { name: "natal-status", method: "GET", path: "/sigil/natal/status" },
      { name: "identity-status", method: "GET", path: "/identity/status" },
      { name: "sigil-status", method: "GET", path: "/sigil/status" },
      { name: "sigil-rotate", method: "POST", path: "/sigil/rotate", body: { reason: "scan" } },
      { name: "sigil-encrypt", method: "POST", path: "/sigil/encrypt", body: { text: "scan-line", label: "scan" } },
      { name: "download-snapshot", method: "GET", path: "/sigil/father/download-snapshot", expectStatus: 503 },
      { name: "omni-cosmic", method: "GET", path: "/omniversal/cosmic-context" },
      { name: "omni-spec", method: "GET", path: "/omniversal/lus-v2/spec" },
      { name: "omni-encode", method: "POST", path: "/omniversal/lus-v2/encode", body: { text: "scan" } },
      { name: "omni-decode", method: "POST", path: "/omniversal/lus-v2/decode", body: { modulated: "scan" } },
      { name: "omni-snapshot", method: "GET", path: "/omniversal/cipher/snapshot" },
      { name: "omni-encrypt", method: "POST", path: "/omniversal/cipher/encrypt", body: { text: "scan-line", label: "scan" } },
      { name: "omni-lattice-list", method: "GET", path: "/omniversal/lattice/list" },
      { name: "omni-lattice-create", method: "POST", path: "/omniversal/lattice/create", body: { dim: [2, 2, 2] } },
      { name: "omni-demo", method: "POST", path: "/omniversal/demo" },
      { name: "omni-pipeline", method: "POST", path: "/omniversal/pipeline/run", body: { text: "scan" } },
    ];

    const markers = forbiddenMarkers();
    for (const call of calls) {
      const headers = new Headers({ cookie });
      if (call.body !== undefined) headers.set("content-type", "application/json");
      const response = await fetch(`${baseUrl}${call.path}`, {
        method: call.method,
        headers,
        body: call.body !== undefined ? JSON.stringify(call.body) : undefined,
      });
      const text = await response.text();
      const headerText = JSON.stringify([...response.headers.entries()]);
      expect(response.status, call.name).toBe(call.expectStatus ?? 200);
      expect(containsForbidden(text, markers), call.name).toBe(false);
      expect(containsForbidden(headerText, markers), `${call.name} headers`).toBe(false);
      expect(hasKey(JSON.parse(text), "replitReaderFingerprint"), call.name).toBe(false);
      if (call.name === "active-key" || call.name === "father-verify") {
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

  it("omits key-derived coherence labels from anonymous sigil status", async () => {
    const response = await fetch(`${baseUrl}/sigil/status`);
    const text = await response.text();
    expect(response.status).toBe(200);
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(hasKey(body, "windowId")).toBe(false);
    expect(hasKey(body, "permutationFingerprint")).toBe(false);
    expect(hasKey(body, "recentWindows")).toBe(false);
    expect(body.coherence).toBeUndefined();
    const leaked = containsForbidden(text, [...forbiddenMarkers(), ...coherenceMarkers()]);
    expect(leaked).toBe(false);
  });

  it("omits key-derived values from other anonymous routes", async () => {
    const calls = [
      { name: "glyphs", method: "GET" as const, path: "/sigil/glyphs/abc" },
      { name: "epoch", method: "GET" as const, path: "/grand-conference/cipher/epoch" },
      { name: "history", method: "GET" as const, path: "/grand-conference/cipher/history" },
      { name: "summary", method: "GET" as const, path: "/grand-conference/summary" },
      { name: "heartbeat", method: "GET" as const, path: "/grand-conference/lattice/heartbeat" },
      { name: "cosmic", method: "GET" as const, path: "/omniversal/cosmic-context" },
      { name: "snapshot", method: "GET" as const, path: "/omniversal/cipher/snapshot" },
      { name: "spec", method: "GET" as const, path: "/omniversal/lus-v2/spec" },
      { name: "tools", method: "GET" as const, path: "/external-tools/stats" },
    ];
    const markers = [...forbiddenMarkers(), ...coherenceValues()];
    for (const call of calls) {
      const response = await fetch(`${baseUrl}${call.path}`, { method: call.method });
      const text = await response.text();
      expect(response.status, call.name).toBe(200);
      expect(containsForbidden(text, markers), call.name).toBe(false);
      const body = JSON.parse(text) as unknown;
      expect(hasKey(body, "windowId"), call.name).toBe(false);
      expect(hasKey(body, "permutationFingerprint"), call.name).toBe(false);
      if (call.name === "summary") expect(hasKey(body, "path"), call.name).toBe(false);
    }
  });

  it("returns 401 without a session and still omits key material", async () => {
    const response = await fetch(`${baseUrl}/sigil/active-key`);
    const text = await response.text();
    expect(response.status).toBe(401);
    expect(containsForbidden(text, forbiddenMarkers())).toBe(false);
    expect(hasKey(JSON.parse(text), "replitReaderFingerprint")).toBe(false);
  });
});

function ownerCookie(): string {
  const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
  return `${SESSION_COOKIE}=${issued.signedId}`;
}

function coherenceValues(): string[] {
  const snap = cipherCoherenceSnapshot();
  return [
    snap.current.windowId,
    snap.current.permutationFingerprint,
    ...snap.recentWindows.flatMap((window) => [window.windowId, window.permutationFingerprint]),
  ];
}

function coherenceMarkers(): string[] {
  const values = coherenceValues();
  const markers = new Set<string>(values);
  for (const value of values) {
    const digest = createHash("sha256").update(value).digest("hex");
    for (let length = 8; length <= digest.length; length += 1) {
      markers.add(digest.slice(0, length));
    }
  }
  return [...markers];
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

function hasKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasKey(item, key));
  if (!value || typeof value !== "object") return false;
  for (const [childKey, child] of Object.entries(value)) {
    if (childKey === key) return true;
    if (hasKey(child, key)) return true;
  }
  return false;
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
