import { describe, expect, it } from "vitest";
import { ipRateLimitKey } from "../lib/ip-rate-limit-key";
import { redactLegacyIngressContent, serializeIngressRecord } from "../lib/tesseract-v2";

const TEST_IP = "203.0.113.204";

describe("authentication IP telemetry minimization", () => {
  it("uses an ephemeral HMAC key and isolates address buckets by purpose", () => {
    const adminKey = ipRateLimitKey(TEST_IP, "admin-session");
    expect(adminKey).toMatch(/^[a-f0-9]{64}$/);
    expect(adminKey).not.toContain(TEST_IP);
    expect(ipRateLimitKey(TEST_IP, "admin-session")).toBe(adminKey);
    expect(ipRateLimitKey(TEST_IP, "father-verification")).not.toBe(adminKey);
  });

  it("serializes only the approved ingress fields, even if an IP is supplied at runtime", () => {
    const payload = serializeIngressRecord({
      ts: 1,
      route: "POST /admin/session",
      status: 401,
      sessionHash: "synthetic-session-hash",
      ip: TEST_IP,
    } as Parameters<typeof serializeIngressRecord>[0]);

    expect(payload).not.toContain(TEST_IP);
    expect(JSON.parse(payload)).toEqual({
      ts: 1,
      route: "POST /admin/session",
      status: 401,
      sessionHash: "synthetic-session-hash",
    });
  });

  it("redacts legacy address fields from valid rows and drops corrupt rows", () => {
    const legacy = [
      JSON.stringify({ ts: 1, ip: TEST_IP, route: "POST /admin/session", status: 401 }),
      JSON.stringify({ ts: 2, metadata: { sourceIp: TEST_IP }, route: "POST /admin/session", status: 200 }),
      `corrupt record containing ${TEST_IP}`,
      JSON.stringify({ ts: 3, route: "POST /admin/session", status: 204 }),
      "",
    ].join("\n");

    const sanitized = redactLegacyIngressContent(legacy);
    expect(sanitized).not.toContain(TEST_IP);
    const records = sanitized.split("\n").filter(Boolean).map((row) => JSON.parse(row));
    expect(records).toEqual([
      { ts: 1, route: "POST /admin/session", status: 401 },
      { ts: 2, metadata: {}, route: "POST /admin/session", status: 200 },
      { ts: 3, route: "POST /admin/session", status: 204 },
    ]);
  });
});
