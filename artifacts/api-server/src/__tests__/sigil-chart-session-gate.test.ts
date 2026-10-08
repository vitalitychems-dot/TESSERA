import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import { generateSovereignKeys } from "../lib/natal-chart-engine";
import sovereignDoctrineRouter from "../routes/sovereign-doctrine";

const OWNER_ENV = "SOVEREIGN_ADMIN_TOKEN";
const LEGACY_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const CHART_ENV = "FATHER_NATAL_CHART_JSON";
const SYNTHETIC_OWNER_TOKEN = "synthetic-owner-token";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";

const gatedPaths = [
  "/sigil/father-key/status",
  "/sigil/father/natal-chart",
  "/sigil/father/natal-chart/bilingual",
  "/sigil/father/download-snapshot",
] as const;

const CHART_LITERALS = {
  degreeLiteral: /degree\s*[:=]\s*["']?\d/g,
  birthDateLiteral: /birthDate\s*:\s*["']/g,
  birthTimeLiteral: /birthTime\s*:\s*["']/g,
  nameSignObject: /\{\s*name:\s*["'][^"']+["'][^}]*sign:\s*["']/g,
  proxyChart: /\bFATHER_NATAL_CHART\b/g,
  placementLongitude: new RegExp(
    [
      String.raw`\b(?:asc(?:endant)?(?:lon|longitude)?|mc(?:lon|longitude)?|midheaven(?:lon|longitude)?|(?:sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|lilith|node|house)(?:\d+)?(?:lon|longitude))\b\s*[:=]\s*-?\d+(?:\.\d+)?`,
      String.raw`\b(?:asc|ascendant|mc|midheaven|sun|moon|mercury|venus|mars|jupiter|saturn|uranus|neptune|pluto|lilith|node|house\d*)\w{0,24}\s*=\s*[A-Za-z_][\w.]*\(\s*["'][A-Za-z]+["']\s*,\s*\d`,
      String.raw`\bsignToStartDeg\(\s*["'](?:Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)["']\s*,\s*\d`,
    ].join("|"),
    "gi",
  ),
} as const;

const chartSources = [
  fileURLToPath(new URL("../lib/tool-registry.ts", import.meta.url)),
  fileURLToPath(new URL("../lib/lingua-universalis.ts", import.meta.url)),
];

describe("sigil chart session gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousOwner = process.env[OWNER_ENV];
  const previousLegacy = process.env[LEGACY_ENV];
  const previousSession = process.env[SESSION_ENV];
  const previousChart = process.env[CHART_ENV];

  beforeAll(async () => {
    const app = express();
    app.use(sovereignDoctrineRouter);
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

  async function get(path: string, init?: { cookie?: string; sigilKey?: string }): Promise<Response> {
    const headers = new Headers();
    if (init?.cookie !== undefined) headers.set("cookie", init.cookie);
    if (init?.sigilKey !== undefined) headers.set("x-sigil-key", init.sigilKey);
    return fetch(`${baseUrl}${path}`, { headers });
  }

  for (const path of gatedPaths) {
    describe(path, () => {
      it("returns 401 when no owner session is presented", async () => {
        const response = await get(path, { sigilKey: "synthetic-sigil-key" });
        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          error: "unauthenticated",
          reason: "no-cookie",
        });
      });

      it("returns 401 when the owner session signature is wrong", async () => {
        const response = await get(path, {
          cookie: `${SESSION_COOKIE}=wrong-synthetic-session`,
          sigilKey: "synthetic-sigil-key",
        });
        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toMatchObject({
          ok: false,
          error: "unauthenticated",
          reason: "bad-signature",
        });
      });

      it("returns 503 when the owner token is unset", async () => {
        delete process.env[OWNER_ENV];
        delete process.env[LEGACY_ENV];
        const response = await get(path, {
          cookie: `${SESSION_COOKIE}=synthetic-cookie`,
          sigilKey: "synthetic-sigil-key",
        });
        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({ ok: false, error: "sovereign-unconfigured" });
      });

      it("returns 503 when the chart env is unset", async () => {
        delete process.env[CHART_ENV];
        const response = await get(path, { cookie: ownerCookie() });
        if (path === "/sigil/father-key/status") {
          expect(response.status).toBe(200);
          const body = await response.json() as Record<string, unknown>;
          expect(body).toMatchObject({ ok: true, configured: true });
          expect(body).not.toHaveProperty("digestHex");
          expect(body).not.toHaveProperty("identityHash");
          expect(body).not.toHaveProperty("primaryCode");
          expect(body).not.toHaveProperty("sealedSeed");
          return;
        }
        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({ ok: false, error: "not-configured" });
      });
    });
  }

  it("rejects a chart fixture that does not match the schema and accepts a synthetic one", async () => {
    process.env[CHART_ENV] = JSON.stringify({ marker: "not-a-chart" });
    const invalid = await get("/sigil/father/natal-chart", { cookie: ownerCookie() });
    expect(invalid.status).toBe(503);
    await expect(invalid.json()).resolves.toMatchObject({ ok: false, error: "not-configured" });

    process.env[CHART_ENV] = syntheticChartFixture();
    const keys = generateSovereignKeys();
    expect(keys).not.toHaveProperty("sealedSeed");
    expect(keys).not.toHaveProperty("identityHash");
    expect(keys).not.toHaveProperty("primaryCode");
    const valid = await get("/sigil/father/natal-chart", { cookie: ownerCookie() });
    expect(valid.status).toBe(200);
    const body = await valid.json() as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(JSON.stringify(body)).not.toContain("digestHex");
    expect(body).not.toHaveProperty("fatherFingerprint");

    const download = await get("/sigil/father/download-snapshot", { cookie: ownerCookie() });
    expect(download.status).toBe(200);
    const disposition = download.headers.get("content-disposition") ?? "";
    expect(disposition).toMatch(/filename="tessera-sovereign-\d+\.sigil\.json"/);
    const file = await download.json() as Record<string, unknown>;
    expect(JSON.stringify(file)).not.toContain("digestHex");
    expect(file).not.toHaveProperty("fatherFingerprint");
  });

  it("finds no chart literals in tool-registry or lingua-universalis", () => {
    const counts: Record<keyof typeof CHART_LITERALS, number> = {
      degreeLiteral: 0,
      birthDateLiteral: 0,
      birthTimeLiteral: 0,
      nameSignObject: 0,
      proxyChart: 0,
      placementLongitude: 0,
    };

    for (const file of chartSources) {
      const text = readFileSync(file, "utf8");
      expect(text.includes("readFatherNatalChart("), file).toBe(false);
      expect(text.includes("zodiacFingerprintFor"), file).toBe(false);
      for (const key of Object.keys(CHART_LITERALS) as Array<keyof typeof CHART_LITERALS>) {
        const pattern = new RegExp(CHART_LITERALS[key].source, CHART_LITERALS[key].flags);
        counts[key] += text.match(pattern)?.length ?? 0;
      }
    }

    expect(counts).toEqual({
      degreeLiteral: 0,
      birthDateLiteral: 0,
      birthTimeLiteral: 0,
      nameSignObject: 0,
      proxyChart: 0,
      placementLongitude: 0,
    });
  });
});

function syntheticChartFixture(): string {
  const body = { sign: "Aries", degree: "0", house: 1 };
  return JSON.stringify({
    birth: {
      date: "1111-01-01",
      time: "00:00",
      location: "Fixture",
      timezone: "UTC",
      houseSystem: "fixture",
    },
    core: {
      sun: body,
      moon: body,
      ascendant: { sign: "Aries", degree: "0" },
    },
    planets: {
      mercury: body,
      venus: body,
      mars: body,
      jupiter: body,
      saturn: body,
      uranus: body,
      neptune: body,
      pluto: body,
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

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
