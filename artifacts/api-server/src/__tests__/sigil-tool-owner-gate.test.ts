import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE, verifyAdminToken } from "../lib/sovereign-session";
import { readAdminKeyMaterial, verifyFatherKey } from "../lib/father-identity";
import { validateSovereignAdminToken } from "../lib/mesh-auth";
import { canonicalAdminCode } from "../lib/lingua-universalis";
import { NotConfiguredError } from "../lib/not-configured";
import { natalSigilFor } from "../lib/father-natal";
import * as natalSigil from "../lib/natal-sigil";
import { detectIntents, invokeTool, publicToolResult } from "../lib/tool-registry";

const chatSigilStoreMock = vi.hoisted(() => ({
  status: vi.fn(async (_session: string) => ({ enrolled: false, rotatedThisSession: false })),
  prepare: vi.fn(async (_current: string, _session: string, _initialize: boolean) => ({
    code: "LUS-chat-sigil-fixture",
    confirmationToken: "one-time-confirmation-fixture",
  })),
  confirm: vi.fn(async (_confirmationToken: string, _session: string) => undefined),
}));

vi.mock("../lib/chat-sigil-store", () => {
  class MockSigilError extends Error {
    constructor(public code: string, public status: number) {
      super(code);
    }
  }
  return {
    chatSigilStore: () => chatSigilStoreMock,
    SigilError: MockSigilError,
    requireChatSigil: async (
      _req: unknown,
      res: { status: (code: number) => { json: (body: unknown) => unknown } },
      next: () => void,
    ) => {
      const status = await chatSigilStoreMock.status("fixture-owner-session");
      if (!status.rotatedThisSession) {
        return res.status(428).json({ ok: false, error: "chat-sigil-required" });
      }
      return next();
    },
  };
});

vi.mock("../lib/ingested-recall", () => ({
  recallIngestedKnowledge: async () => [],
  recallIngestedKnowledgeWithProvenance: async () => [],
}));

vi.mock("../lib/hybrid-retrieval", () => ({
  hybridRetrieve: async () => [],
  formatCitations: () => "",
}));

vi.mock("@workspace/db", () => {
  const rows = Promise.resolve([{ id: 1 }]);
  function chain() {
    return {
      values: () => rows,
      set: () => ({ where: () => rows }),
      from: () => ({
        where: () => ({ orderBy: () => ({ limit: () => rows }) }),
        orderBy: () => ({ limit: () => rows }),
      }),
      returning: () => rows,
    };
  }
  const db = {
    insert: () => chain(),
    update: () => chain(),
    select: () => chain(),
    delete: () => chain(),
  };
  return { db };
});

import conversationsRouter from "../routes/conversations";
import sovereignDoctrineRouter from "../routes/sovereign-doctrine";
import languageSecurityRouter from "../routes/language-security";
import { SigilError } from "../lib/chat-sigil-store";

const OWNER_ENV = "SOVEREIGN_ADMIN_TOKEN";
const LEGACY_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const CHART_ENV = "FATHER_NATAL_CHART_JSON";
const SYNTHETIC_OWNER_TOKEN = "synthetic-owner-token";
const SYNTHETIC_LEGACY_TOKEN = "synthetic-admin-material";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";

function syntheticChart(date: string, time: string, location: string): string {
  const body = { sign: "Aries", degree: "0", house: 1 };
  return JSON.stringify({
    birth: { date, time, location, timezone: "UTC", houseSystem: "fixture" },
    core: { sun: body, moon: body, ascendant: { sign: "Aries", degree: "0" } },
    planets: {
      mercury: body, venus: body, mars: body, jupiter: body,
      saturn: body, uranus: body, neptune: body, pluto: body,
    },
    nodes: { northNode: body },
    aspects: ["fixture"],
    themes: {
      dominance: "fixture",
      rising: "fixture",
      moonSign: "fixture",
      houseConcentration: ["fixture"],
      chineseZodiac: "fixture",
    },
  });
}
const FIXTURE_A = syntheticChart("1111-01-01", "01:01", "Fixture-A");
const FIXTURE_B = syntheticChart("2222-12-31", "23:59", "Fixture-B");

const MINT_PHRASE = "give me an admin key?";
const COUNCIL_PHRASE = "convene the universal language?";
const FORBIDDEN = /readableSeed|chartAnchor|TESSERACT_ADMIN_KEY|birthDate|birthTime|natalDigest|issueZodiacKey|deriveNatalSeed|1111-01-01|2222-12-31|Fixture-A|Fixture-B/i;

const readySession = { ok: true as const, issuedAt: 1, expiresAt: 2 };

describe("sigil tool owner gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousOwner = process.env[OWNER_ENV];
  const previousLegacy = process.env[LEGACY_ENV];
  const previousSession = process.env[SESSION_ENV];
  const previousChart = process.env[CHART_ENV];

  beforeAll(async () => {
    const app = express();
    app.set("trust proxy", true);
    app.use(express.json());
    app.use(cookieParser());
    app.use(conversationsRouter);
    app.use(sovereignDoctrineRouter);
    app.use(languageSecurityRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    delete process.env[OWNER_ENV];
    process.env[LEGACY_ENV] = SYNTHETIC_OWNER_TOKEN;
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;
    delete process.env[CHART_ENV];
    chatSigilStoreMock.status.mockResolvedValue({ enrolled: false, rotatedThisSession: false });
    chatSigilStoreMock.prepare.mockResolvedValue({
      code: "LUS-chat-sigil-fixture",
      confirmationToken: "one-time-confirmation-fixture",
    });
    chatSigilStoreMock.confirm.mockResolvedValue(undefined);
  });

  afterAll(async () => {
    restore(OWNER_ENV, previousOwner);
    restore(LEGACY_ENV, previousLegacy);
    restore(SESSION_ENV, previousSession);
    restore(CHART_ENV, previousChart);
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function ownerCookie(): string {
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    return `${SESSION_COOKIE}=${issued.signedId}`;
  }

  async function post(
    path: string,
    body: unknown,
    cookie?: string,
    origin?: string,
    fetchSite?: string,
    clientIp?: string,
  ): Promise<Response> {
    const headers = new Headers({ "content-type": "application/json" });
    if (cookie !== undefined) headers.set("cookie", cookie);
    if (origin !== undefined) headers.set("origin", origin);
    if (fetchSite !== undefined) headers.set("sec-fetch-site", fetchSite);
    if (clientIp !== undefined) headers.set("x-forwarded-for", clientIp);
    return fetch(`${baseUrl}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  }

  async function get(path: string, cookie?: string): Promise<Response> {
    const headers = new Headers();
    if (cookie !== undefined) headers.set("cookie", cookie);
    return fetch(`${baseUrl}${path}`, { headers });
  }

  it("detects both privileged tools from the keyword phrases", () => {
    expect(detectIntents(MINT_PHRASE).map((call) => call.name)).toEqual(["mint_admin_sigil"]);
    expect(detectIntents(COUNCIL_PHRASE).every((call) => call.name === "convene_grand_council_universalis")).toBe(true);
    expect(detectIntents(COUNCIL_PHRASE).length).toBeGreaterThan(0);
  });

  it("rotates only the private chat sigil and leaves the stable admin key unchanged", async () => {
    const anonymous = await post("/sigil/father/issue-code", {});
    expect(anonymous.status).toBe(401);

    const currentSigil = SYNTHETIC_OWNER_TOKEN;
    const crossOrigin = await post(
      "/sigil/father/issue-code",
      { currentSigil },
      ownerCookie(),
      "https://other-app.example",
    );
    expect(crossOrigin.status).toBe(403);

    const crossSite = await post(
      "/sigil/father/issue-code",
      { currentSigil },
      ownerCookie(),
      baseUrl,
      "cross-site",
    );
    expect(crossSite.status).toBe(403);

    const missingSigil = await post("/sigil/father/issue-code", {}, ownerCookie(), baseUrl);
    expect(missingSigil.status).toBe(400);
    expect(chatSigilStoreMock.prepare).not.toHaveBeenCalled();

    chatSigilStoreMock.prepare.mockRejectedValueOnce(new SigilError("sigil-mismatch", 403));
    const wrongSigil = await post(
      "/sigil/father/issue-code",
      { currentSigil: "synthetic-wrong-sigil-candidate" },
      ownerCookie(),
      baseUrl,
    );
    expect(wrongSigil.status).toBe(403);
    expect(await wrongSigil.text()).not.toContain("synthetic-wrong-sigil-candidate");

    const response = await post(
      "/sigil/father/issue-code",
      { currentSigil, initialize: true },
      ownerCookie(),
      baseUrl,
    );
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json() as {
      ok: boolean;
      code: string;
      confirmationToken: string;
      adminKeyChanged: boolean;
    };
    expect(body.ok).toBe(true);
    expect(body.code).toBe("LUS-chat-sigil-fixture");
    expect(body.confirmationToken).toBe("one-time-confirmation-fixture");
    expect(body.adminKeyChanged).toBe(false);
    expect(chatSigilStoreMock.prepare).toHaveBeenCalledWith(currentSigil, expect.any(String), true);
    expect(verifyAdminToken(body.code)).toBe(false);
    expect(verifyFatherKey(body.code)).toBe(false);
    expect(validateSovereignAdminToken(body.code)).toBe(false);
    expect(readAdminKeyMaterial()).toBe(SYNTHETIC_OWNER_TOKEN);

    const confirm = await post(
      "/sigil/father/confirm-code",
      { confirmationToken: body.confirmationToken },
      ownerCookie(),
      baseUrl,
    );
    expect(confirm.status).toBe(200);
    expect(await confirm.json()).toEqual({ ok: true, adminKeyChanged: false });
    expect(chatSigilStoreMock.confirm).toHaveBeenCalledWith(body.confirmationToken, expect.any(String));
    expect(readAdminKeyMaterial()).toBe(SYNTHETIC_OWNER_TOKEN);
  });

  it("rate limits repeated sigil operations even with a valid owner session", async () => {
    const cookie = ownerCookie();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await post(
        "/sigil/father/issue-code",
        { currentSigil: SYNTHETIC_OWNER_TOKEN, initialize: true },
        cookie,
        baseUrl,
        "same-origin",
        "198.51.100.77",
      );
      expect(response.status).toBe(201);
    }
    const limited = await post(
      "/sigil/father/issue-code",
      { currentSigil: SYNTHETIC_OWNER_TOKEN, initialize: true },
      cookie,
      baseUrl,
      "same-origin",
      "198.51.100.77",
    );
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();
    expect(limited.headers.get("cache-control")).toBe("no-store");
    expect((await limited.json() as { error: string }).error).toBe("rate-limited");
  });

  it("requires a private save acknowledgment before the UI confirms a sigil", () => {
    const panelPath = fileURLToPath(new URL("../../../tessera/src/components/chat/FatherCodeRotationPanel.tsx", import.meta.url));
    const panel = readFileSync(panelPath, "utf8");
    expect(panel).toContain("I saved this new sigil somewhere private.");
    expect(panel).toContain("disabled={!saved || busy}");
    expect(panel).toContain("if (!saved)");
    expect(panel).not.toMatch(/localStorage\.(?:setItem|getItem)\s*\(/);
  });

  for (const phrase of [MINT_PHRASE, COUNCIL_PHRASE]) {
    describe(phrase, () => {
      it("returns 401 and does not run the tool when the session is missing", async () => {
        const response = await post("/messages", { conversationId: 1, content: phrase });
        expect(response.status).toBe(401);
        expect(response.headers.get("content-type") ?? "").toContain("application/json");
        const body = await response.text();
        expect(body).not.toMatch(FORBIDDEN);
        const parsed = JSON.parse(body) as { ok?: boolean; error?: string };
        expect(parsed).toEqual({ ok: false, error: "unauthenticated", reason: "no-cookie" });
      });

      it("returns 503 and does not run the tool when the owner token is unset", async () => {
        delete process.env[OWNER_ENV];
        delete process.env[LEGACY_ENV];
        const response = await post("/messages", { conversationId: 1, content: phrase }, `${SESSION_COOKIE}=synthetic-cookie`);
        expect(response.status).toBe(503);
        const body = await response.text();
        expect(body).not.toMatch(/readableSeed|chartAnchor|birthDate|birthTime|natalDigest|issueZodiacKey|deriveNatalSeed|1111-01-01|2222-12-31|Fixture-A|Fixture-B/i);
        expect(JSON.parse(body)).toEqual({
          ok: false,
          error: "sovereign-unconfigured",
          message: "TESSERACT_ADMIN_KEY is not configured. Privileged surfaces are fail-closed.",
        });
      });

      it("blocks chat until the sigil is confirmed, then returns a ready status without key fields", async () => {
        process.env[CHART_ENV] = FIXTURE_A;
        const blocked = await post("/messages", { conversationId: 1, content: phrase }, ownerCookie());
        expect(blocked.status).toBe(428);
        expect(await blocked.json()).toEqual({ ok: false, error: "chat-sigil-required" });

        chatSigilStoreMock.status.mockResolvedValue({ enrolled: true, rotatedThisSession: true });
        const response = await post("/messages", { conversationId: 1, content: phrase }, ownerCookie());
        expect(response.status).toBe(200);
        const body = await response.text();
        expect(body).not.toMatch(FORBIDDEN);
        const done = sseData(body).find((event) => event.done === true);
        expect(done?.finalContent).toMatch(
          /^[a-z_]+: ready\n\n---\n\*Response path: local application\/tool result; no configured model authored this reply\.\*$/,
        );
        const tools = done?.tools as Array<{ result?: Record<string, unknown> }> | undefined;
        expect(tools?.length).toBeGreaterThan(0);
        for (const tool of tools ?? []) {
          expect([...Object.keys(tool.result ?? {})].sort()).toEqual(["ok", "status"]);
          expect(tool.result).toEqual({ ok: true, status: "ready" });
        }
      });
    });
  }

  it("refuses direct invocation when the session is missing or the token is unset", async () => {
    for (const name of ["mint_admin_sigil", "convene_grand_council_universalis"] as const) {
      const missing = await invokeTool({ name, arguments: {} });
      expect(missing.ok).toBe(false);
      expect(missing.error).toBe("unauthenticated");
      expect(missing.durationMs).toBe(0);
      expect(missing.result).toEqual({ ok: false, status: "refused", error: "unauthenticated" });

      delete process.env[OWNER_ENV];
      delete process.env[LEGACY_ENV];
      const unset = await invokeTool({ name, arguments: {} }, { ownerSession: readySession });
      expect(unset.ok).toBe(false);
      expect(unset.error).toBe("sovereign-unconfigured");
      expect(unset.durationMs).toBe(0);
      expect(publicToolResult(name, unset.result)).toEqual({ ok: false, status: "refused", error: "sovereign-unconfigured" });
      process.env[LEGACY_ENV] = SYNTHETIC_OWNER_TOKEN;
    }
  });

  it("strips chart, birth, and key fields from a privileged tool result", () => {
    const view = publicToolResult("mint_admin_sigil", {
      ok: true,
      status: "ready",
      readableSeed: "synthetic-seed",
      chartAnchor: { birthDate: "1111-01-01" },
      birthTime: "01:01",
    });
    expect(view).toEqual({ ok: true, status: "ready" });
    expect(JSON.stringify(view)).not.toMatch(FORBIDDEN);
  });

  it("does not export chart-derived key helpers", () => {
    expect("issueZodiacKey" in natalSigil).toBe(false);
    expect("deriveNatalSeed" in natalSigil).toBe(false);
    expect("sunSign" in natalSigil).toBe(false);
    const sources = [
      "../lib/tool-registry.ts",
      "../lib/lingua-universalis.ts",
      "../lib/natal-sigil.ts",
      "../lib/father-natal.ts",
      "../lib/father-identity.ts",
      "../routes/conversations.ts",
    ];
    const pattern = /issueZodiacKey|deriveNatalSeed|\bnatalDigest\b|readableSeed|chartAnchor/g;
    for (const relative of sources) {
      const text = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
      expect(text.match(pattern) ?? [], relative).toEqual([]);
    }
    const identity = readFileSync(fileURLToPath(new URL("../lib/father-identity.ts", import.meta.url)), "utf8");
    expect(identity.includes("FATHER_NATAL_CHART")).toBe(false);
    expect(identity.includes("birthDate")).toBe(false);
  });

  it("keeps the admin key independent of chart and birth fixtures and refuses when unset", () => {
    process.env[LEGACY_ENV] = SYNTHETIC_LEGACY_TOKEN;
    process.env[CHART_ENV] = FIXTURE_A;
    const keyA = readAdminKeyMaterial();
    const sigilA = natalSigilFor().digestHex;
    process.env[CHART_ENV] = FIXTURE_B;
    const keyB = readAdminKeyMaterial();
    const sigilB = natalSigilFor().digestHex;
    expect(keyA).toBe(keyB);
    expect(sigilA).toBe(sigilB);
    expect(keyA.includes("1111-01-01")).toBe(false);
    expect(keyA.includes("2222-12-31")).toBe(false);
    expect(keyA.includes("Fixture-A")).toBe(false);
    expect(keyA.includes("Fixture-B")).toBe(false);
    expect(sigilA.includes("1111-01-01")).toBe(false);
    expect(sigilB.includes("2222-12-31")).toBe(false);
    delete process.env[LEGACY_ENV];
    delete process.env[OWNER_ENV];
    expect(() => readAdminKeyMaterial()).toThrow(NotConfiguredError);
    expect(() => natalSigilFor()).toThrow(NotConfiguredError);
    expect(() => natalSigil.bindNatalChart("holder", "1111-01-01", "01:01")).toThrow(NotConfiguredError);
  });

  it("returns 401 and 503 for father-key status and natal-sigil", async () => {
    const statusMissing = await get("/sigil/father-key/status");
    expect(statusMissing.status).toBe(401);
    expect(await statusMissing.json()).toMatchObject({ ok: false, error: "unauthenticated" });

    const sigilMissing = await post("/sigil/father/natal-sigil", { birthDate: "1111-01-01", birthTime: "01:01" });
    expect(sigilMissing.status).toBe(401);
    const sigilMissingBody = await sigilMissing.text();
    expect(sigilMissingBody).not.toMatch(FORBIDDEN);
    expect(JSON.parse(sigilMissingBody)).toMatchObject({ ok: false, error: "unauthenticated" });

    delete process.env[OWNER_ENV];
    delete process.env[LEGACY_ENV];
    const statusUnset = await get("/sigil/father-key/status", `${SESSION_COOKIE}=synthetic-cookie`);
    expect(statusUnset.status).toBe(503);
    expect(await statusUnset.json()).toMatchObject({ ok: false, error: "sovereign-unconfigured" });

    const sigilUnset = await post("/sigil/father/natal-sigil", {});
    expect(sigilUnset.status).toBe(503);
    expect(await sigilUnset.json()).toMatchObject({ ok: false, error: "sovereign-unconfigured" });
  });

  it("does not echo chart or birth fields from father-key status or natal-sigil", async () => {
    process.env[CHART_ENV] = FIXTURE_B;
    const status = await get("/sigil/father-key/status", ownerCookie());
    expect(status.status).toBe(200);
    const statusBody = await status.text();
    expect(statusBody).not.toMatch(FORBIDDEN);
    const statusJson = JSON.parse(statusBody) as Record<string, unknown>;
    expect(statusJson.ok).toBe(true);
    expect(statusJson).not.toHaveProperty("sunSign");
    expect(statusJson).not.toHaveProperty("tesseractMatches");

    const sigil = await post("/sigil/father/natal-sigil", { birthDate: "2222-12-31", birthTime: "23:59" }, ownerCookie());
    expect(sigil.status).toBe(200);
    const sigilBody = await sigil.text();
    expect(sigilBody).not.toMatch(FORBIDDEN);
    expect(JSON.parse(sigilBody)).toEqual({ ok: true, status: "ready" });
  });

  it("refuses zodiac key issue without deriving a key from birth input", async () => {
    const response = await post("/sigil/zodiac-key/issue", { birthDate: "1111-01-01", birthTime: "01:01" });
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).not.toMatch(FORBIDDEN);
    expect(JSON.parse(body)).toEqual({ ok: false, error: "not-configured" });
  });
});

function sseData(body: string): Array<Record<string, unknown>> {
  const events: Array<Record<string, unknown>> = [];
  for (const block of body.split("\n\n")) {
    const line = block.split("\n").find((entry) => entry.startsWith("data: "));
    if (!line) continue;
    events.push(JSON.parse(line.slice("data: ".length)) as Record<string, unknown>);
  }
  return events;
}

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
