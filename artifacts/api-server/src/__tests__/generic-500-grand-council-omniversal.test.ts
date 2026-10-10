import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const marker = vi.hoisted(() => "synthetic-marker-gc-omni-7k2p");

function boom(where: string): never {
  throw new Error(`${where} ${marker}`);
}

vi.mock("@workspace/db", () => ({
  db: {},
  councilSessionsTable: { id: "id" },
}));

vi.mock("../lib/grand-council-deliberation", () => ({
  convene: vi.fn(async () => ({})),
  getSession: vi.fn(async () => null),
  listSessions: vi.fn(async () => []),
  memberRoster: vi.fn(() => []),
  COUNCIL_PROPOSALS: [],
  subscribe: vi.fn(() => () => undefined),
}));

vi.mock("../lib/sacred-conference-orchestrator", () => ({
  runSacredConference: vi.fn(async () => ({})),
  getSacredConference: vi.fn(async () => null),
}));

vi.mock("../lib/multi-state-symbolic-processor", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/multi-state-symbolic-processor")>();
  return {
    ...actual,
    parallelEval: vi.fn(() => boom("parallelEval")),
  };
});

vi.mock("../lib/vgpu-glyph-bus", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/vgpu-glyph-bus")>();
  return {
    ...actual,
    runGlyphProgram: vi.fn(() => boom("runGlyphProgram")),
  };
});

vi.mock("../lib/vgpu", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/vgpu")>();
  return {
    ...actual,
    vgpuSubmit: vi.fn(() => boom("vgpuSubmit")),
  };
});

vi.mock("../lib/omniversal-cipher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/omniversal-cipher")>();
  return {
    ...actual,
    omniversalDecrypt: vi.fn(() => boom("omniversalDecrypt")),
  };
});

vi.mock("../lib/omniversal-quantum-lattice", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/omniversal-quantum-lattice")>();
  return {
    ...actual,
    superpose: vi.fn(() => boom("superpose")),
    entangle: vi.fn(() => boom("entangle")),
    harmonize: vi.fn(() => boom("harmonize")),
    collapse: vi.fn(() => boom("collapse")),
    latticeSnapshot: vi.fn(() => boom("latticeSnapshot")),
    latticeFullDump: vi.fn(() => boom("latticeFullDump")),
  };
});

import express from "express";
import { createServer, type Server } from "node:http";
import grandCouncilRouter from "../routes/grand-council";
import omniversalRouter from "../routes/omniversal";
import { logger } from "../lib/logger";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";

const ADMIN_KEY = "synthetic-admin-material";

type Case = {
  name: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  session: boolean;
  status: number;
  error: string;
};

const cases: Case[] = [
  {
    name: "POST /mssp/eval",
    method: "POST",
    path: "/mssp/eval",
    body: { expression: "A" },
    session: false,
    status: 400,
    error: "mssp-eval-failed",
  },
  {
    name: "POST /vgpu/cmd",
    method: "POST",
    path: "/vgpu/cmd",
    body: { program: "synthetic" },
    session: false,
    status: 400,
    error: "vgpu-command-failed",
  },
  {
    name: "POST /omniversal/cipher/decrypt",
    method: "POST",
    path: "/omniversal/cipher/decrypt",
    body: { envelope: { v: 2 } },
    session: true,
    status: 409,
    error: "cipher-decrypt-failed",
  },
  {
    name: "GET /omniversal/lattice/:id",
    method: "GET",
    path: "/omniversal/lattice/synthetic",
    session: false,
    status: 404,
    error: "lattice-unavailable",
  },
  {
    name: "GET /omniversal/lattice/:id/full",
    method: "GET",
    path: "/omniversal/lattice/synthetic/full",
    session: false,
    status: 404,
    error: "lattice-unavailable",
  },
  {
    name: "POST /omniversal/lattice/:id/superpose",
    method: "POST",
    path: "/omniversal/lattice/synthetic/superpose",
    body: { cell: "0,0,0" },
    session: true,
    status: 400,
    error: "lattice-superpose-failed",
  },
  {
    name: "POST /omniversal/lattice/:id/entangle",
    method: "POST",
    path: "/omniversal/lattice/synthetic/entangle",
    body: { a: "0,0,0", b: "1,1,1" },
    session: true,
    status: 400,
    error: "lattice-entangle-failed",
  },
  {
    name: "POST /omniversal/lattice/:id/harmonize",
    method: "POST",
    path: "/omniversal/lattice/synthetic/harmonize",
    body: { baseHz: 528 },
    session: true,
    status: 400,
    error: "lattice-harmonize-failed",
  },
  {
    name: "POST /omniversal/lattice/:id/collapse",
    method: "POST",
    path: "/omniversal/lattice/synthetic/collapse",
    body: { cell: "0,0,0", observer: "synthetic" },
    session: true,
    status: 400,
    error: "lattice-collapse-failed",
  },
];

describe("grand-council and omniversal generic error bodies", () => {
  let server: Server | undefined;
  let baseUrl = "";
  let ownerCookie = "";
  const previousKey = process.env.TESSERACT_ADMIN_KEY;
  const previousSession = process.env.SOVEREIGN_SESSION_SECRET;
  const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined);

  beforeAll(async () => {
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    process.env.SOVEREIGN_SESSION_SECRET = "synthetic-session-secret-32chars!!";
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    ownerCookie = `${SESSION_COOKIE}=${issued.signedId}`;

    const app = express();
    app.use(express.json());
    app.use(grandCouncilRouter);
    app.use(omniversalRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    errorSpy.mockRestore();
    if (previousKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
    else process.env.TESSERACT_ADMIN_KEY = previousKey;
    if (previousSession === undefined) delete process.env.SOVEREIGN_SESSION_SECRET;
    else process.env.SOVEREIGN_SESSION_SECRET = previousSession;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it.each(cases)("$name does not echo the exception marker", async (route) => {
    errorSpy.mockClear();
    const headers = new Headers();
    if (route.body !== undefined) headers.set("content-type", "application/json");
    if (route.session) headers.set("cookie", ownerCookie);
    const response = await fetch(`${baseUrl}${route.path}`, {
      method: route.method,
      headers,
      body: route.body !== undefined ? JSON.stringify(route.body) : undefined,
    });
    expect(response.status).toBe(route.status);
    const text = await response.text();
    expect(text).not.toContain(marker);
    expect(JSON.parse(text)).toEqual({ ok: false, error: route.error });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toEqual({ errorName: "Error" });
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(marker);
  });
});
