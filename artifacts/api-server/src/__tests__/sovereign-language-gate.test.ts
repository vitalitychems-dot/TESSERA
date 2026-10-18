import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import { stopAutonomousRotation } from "../lib/sovereign-cipher";
import { stopBandRotationScheduler } from "../lib/lattice-frequency-bands";

const gateControl = vi.hoisted(() => ({
  failSeed: false,
  failRotation: false,
  failConference: false,
  failTranslate: false,
}));

vi.mock("@workspace/db", () => ({
  db: {},
}));

vi.mock("../lib/sovereign-ephemeris", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/sovereign-ephemeris")>();
  return {
    ...actual,
    generateUniverseSeed(date?: Date) {
      if (gateControl.failSeed) throw new Error("synthetic-handler-failure");
      return actual.generateUniverseSeed(date);
    },
    computeAgentRotationState(agentId: string, date?: Date) {
      if (gateControl.failRotation) throw new Error("synthetic-handler-failure");
      return actual.computeAgentRotationState(agentId, date);
    },
  };
});

vi.mock("../lib/sovereign-language", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/sovereign-language")>();
  return {
    ...actual,
    translateEnglishToSovereign(text: string) {
      if (gateControl.failTranslate) throw new Error("synthetic-handler-failure");
      return actual.translateEnglishToSovereign(text);
    },
  };
});

vi.mock("../lib/sovereign-language-conference", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/sovereign-language-conference")>();
  return {
    ...actual,
    async getOrRunLanguageConference() {
      if (gateControl.failConference) throw new Error("synthetic-handler-failure");
      return actual.getOrRunLanguageConference();
    },
  };
});

import sovereignLanguageRouter from "../routes/sovereign-language";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const DATABASE_ENV = "DATABASE_URL";
const SYNTHETIC_ADMIN_KEY = "synthetic-admin-key-16";
const SHORT_ADMIN_KEY = "short-admin";
const SYNTHETIC_SESSION_SECRET = "synthetic-session-secret-32chars!!";
const HANDLER_FAILURE = "synthetic-handler-failure";

const GENERIC_401 = { ok: false, error: "unauthenticated", reason: "no-cookie" };
const GENERIC_503 = {
  ok: false,
  error: "sovereign-unconfigured",
  message: "TESSERACT_ADMIN_KEY is not configured. Privileged surfaces are fail-closed.",
};
const GENERIC_500 = { ok: false, error: "internal error" };
const INVALID_COOKIE = { ok: false, error: "unauthenticated", reason: "bad-signature" };

type Method = "GET" | "POST";

const GATED: Array<{ method: Method; path: string; body?: Record<string, string> }> = [
  { method: "GET", path: "/api/sovereign-language/conference" },
  { method: "POST", path: "/api/sovereign-language/translate", body: { text: "synthetic" } },
  { method: "POST", path: "/api/sovereign-language/speak", body: { message: "synthetic" } },
  { method: "GET", path: "/api/sovereign-language/universe-seed" },
  { method: "GET", path: "/api/sovereign-language/agent-rotation/synthetic-agent" },
];

function restore(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function leaks(text: string, secret: string): boolean {
  return secret.length > 0 && text.includes(secret);
}

describe("sovereign language anonymous route gate", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousAdmin = process.env[ADMIN_ENV];
  const previousSession = process.env[SESSION_ENV];
  const previousDatabase = process.env[DATABASE_ENV];

  beforeAll(async () => {
    expect(SHORT_ADMIN_KEY.length).toBeLessThan(16);
    expect(SYNTHETIC_ADMIN_KEY.length).toBeGreaterThanOrEqual(16);
    expect(SYNTHETIC_SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    delete process.env[DATABASE_ENV];

    const app = express();
    app.use(express.json());
    app.use("/api", sovereignLanguageRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    gateControl.failSeed = false;
    gateControl.failRotation = false;
    gateControl.failConference = false;
    gateControl.failTranslate = false;
    process.env[ADMIN_ENV] = SYNTHETIC_ADMIN_KEY;
    process.env[SESSION_ENV] = SYNTHETIC_SESSION_SECRET;
    delete process.env[DATABASE_ENV];
  });

  afterAll(async () => {
    stopAutonomousRotation();
    stopBandRotationScheduler();
    restore(ADMIN_ENV, previousAdmin);
    restore(SESSION_ENV, previousSession);
    restore(DATABASE_ENV, previousDatabase);
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  function ownerCookie(): string {
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    return `${SESSION_COOKIE}=${issued.signedId}`;
  }

  async function send(
    method: Method,
    path: string,
    cookie?: string,
    body?: Record<string, string>,
  ): Promise<Response> {
    const headers = new Headers();
    if (cookie !== undefined) headers.set("cookie", cookie);
    let payload: string | undefined;
    if (body !== undefined) {
      headers.set("content-type", "application/json");
      payload = JSON.stringify(body);
    }
    return fetch(`${baseUrl}${path}`, { method, headers, body: payload });
  }

  async function expectJson(response: Response, status: number, body: unknown): Promise<void> {
    expect(response.status).toBe(status);
    const json: unknown = await response.json();
    expect(json).toEqual(body);
    const text = JSON.stringify(json);
    expect(leaks(text, SYNTHETIC_ADMIN_KEY)).toBe(false);
    expect(leaks(text, SYNTHETIC_SESSION_SECRET)).toBe(false);
    expect(leaks(text, SHORT_ADMIN_KEY)).toBe(false);
    expect(leaks(text, HANDLER_FAILURE)).toBe(false);
    expect(text.includes("destructure")).toBe(false);
    expect(text.includes("TypeError")).toBe(false);
  }

  it("returns 401 for every gated route when no owner session is presented", async () => {
    for (const route of GATED) {
      const response = await send(route.method, route.path, undefined, route.body);
      await expectJson(response, 401, GENERIC_401);
    }
  });

  it("returns 503 for every gated route when the admin key is unset", async () => {
    delete process.env[ADMIN_ENV];
    for (const route of GATED) {
      const withCookie = await send(route.method, route.path, `${SESSION_COOKIE}=not-a-session`, route.body);
      await expectJson(withCookie, 503, GENERIC_503);
      const withoutCookie = await send(route.method, route.path, undefined, route.body);
      await expectJson(withoutCookie, 503, GENERIC_503);
    }
  });

  it("returns 503 for every gated route when the admin key is shorter than 16 characters", async () => {
    process.env[ADMIN_ENV] = SHORT_ADMIN_KEY;
    for (const route of GATED) {
      const response = await send(route.method, route.path, undefined, route.body);
      await expectJson(response, 503, GENERIC_503);
    }
  });

  it("rejects an invalid cookie on every gated route", async () => {
    for (const route of GATED) {
      const response = await send(route.method, route.path, `${SESSION_COOKIE}=not-a-session`, route.body);
      await expectJson(response, 401, INVALID_COOKIE);
      const presentedKey = await send(
        route.method,
        route.path,
        `${SESSION_COOKIE}=${SYNTHETIC_ADMIN_KEY}`,
        route.body,
      );
      await expectJson(presentedKey, 401, INVALID_COOKIE);
    }
  });

  it("lets an owner session through every gated route", async () => {
    const cookie = ownerCookie();

    const conference = await send("GET", "/api/sovereign-language/conference", cookie);
    expect(conference.status).toBe(200);
    const conferenceJson = await conference.json() as {
      ok?: boolean;
      data?: { status?: string; conferenceId?: string };
    };
    expect(conferenceJson.ok).toBe(true);
    expect(conferenceJson.data?.status).toBe("complete");
    expect(typeof conferenceJson.data?.conferenceId).toBe("string");
    expect(leaks(JSON.stringify(conferenceJson), SYNTHETIC_ADMIN_KEY)).toBe(false);

    const translated = await send("POST", "/api/sovereign-language/translate", cookie, { text: "synthetic" });
    expect(translated.status).toBe(200);
    const translatedJson = await translated.json() as { ok?: boolean; direction?: string; translated?: string };
    expect(translatedJson.ok).toBe(true);
    expect(translatedJson.direction).toBe("to-sovereign");
    expect(typeof translatedJson.translated).toBe("string");

    const spoken = await send("POST", "/api/sovereign-language/speak", cookie, { message: "synthetic" });
    expect(spoken.status).toBe(200);
    const spokenJson = await spoken.json() as { ok?: boolean; data?: { original?: string } };
    expect(spokenJson.ok).toBe(true);
    expect(spokenJson.data?.original).toBe("synthetic");

    const seed = await send("GET", "/api/sovereign-language/universe-seed", cookie);
    expect(seed.status).toBe(200);
    const seedJson = await seed.json() as { ok?: boolean; data?: { primarySeed?: number; seedHash?: string } };
    expect(seedJson.ok).toBe(true);
    expect(typeof seedJson.data?.primarySeed).toBe("number");
    expect(seedJson.data?.seedHash?.endsWith("...")).toBe(true);

    const rotation = await send("GET", "/api/sovereign-language/agent-rotation/synthetic-agent", cookie);
    expect(rotation.status).toBe(200);
    const rotationJson = await rotation.json() as {
      ok?: boolean;
      data?: { rotationEpoch?: number; rotationCount?: number };
    };
    expect(rotationJson.ok).toBe(true);
    expect(typeof rotationJson.data?.rotationEpoch).toBe("number");
    expect(typeof rotationJson.data?.rotationCount).toBe("number");
    expect(leaks(JSON.stringify(rotationJson), SYNTHETIC_SESSION_SECRET)).toBe(false);
  });

  it("returns a generic body when a gated handler throws", async () => {
    const cookie = ownerCookie();
    gateControl.failConference = true;
    gateControl.failSeed = true;
    gateControl.failRotation = true;
    gateControl.failTranslate = true;

    const conference = await send("GET", "/api/sovereign-language/conference", cookie);
    await expectJson(conference, 500, GENERIC_500);

    const seed = await send("GET", "/api/sovereign-language/universe-seed", cookie);
    await expectJson(seed, 500, GENERIC_500);

    const spoken = await send("POST", "/api/sovereign-language/speak", cookie, { message: "synthetic" });
    await expectJson(spoken, 500, GENERIC_500);

    const rotation = await send("GET", "/api/sovereign-language/agent-rotation/synthetic-agent", cookie);
    await expectJson(rotation, 500, GENERIC_500);

    const translated = await send("POST", "/api/sovereign-language/translate", cookie, { text: "synthetic" });
    await expectJson(translated, 500, GENERIC_500);
  });
});
