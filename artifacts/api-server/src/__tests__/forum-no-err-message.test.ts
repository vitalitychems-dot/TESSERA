import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";

const { SENTINEL, control, synthetic, APPLICANT } = vi.hoisted(() => {
  const SENTINEL = "SENTINEL-forum-no-err-message";
  const control = {
    mode: "fail" as "fail" | "approve",
    selects: 0,
  };
  function synthetic(): Error {
    const error = new Error(SENTINEL);
    error.name = "SyntheticFailure";
    return error;
  }
  const APPLICANT = {
    id: 1,
    status: "pending",
    applicantName: "River Member",
    applicantHandle: "",
    proposedTitle: "Shared work",
    proposedContent: "A proposal",
    offerOfValue: "Care",
    source: "external",
    externalId: "ext-1",
  };
  return { SENTINEL, control, synthetic, APPLICANT };
});

function query(result: unknown): unknown {
  const target = () => query(result);
  return new Proxy(target, {
    get(_target, prop) {
      if (prop === "then") {
        return (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => {
          const settled = control.mode === "fail"
            ? Promise.reject(synthetic())
            : Promise.resolve(result);
          return settled.then(onFulfilled, onRejected);
        };
      }
      return () => query(result);
    },
  });
}

vi.mock("@workspace/db", () => ({
  db: {
    select() {
      const index = control.selects;
      control.selects += 1;
      const rows = control.mode === "approve" && index === 0 ? [APPLICANT] : [];
      return query(rows);
    },
    insert() {
      return query([{ id: 1 }]);
    },
    update() {
      return query([]);
    },
    delete() {
      return query(undefined);
    },
  },
}));

vi.mock("../lib/forum-identity-registry", () => ({
  lookupForumIdentity: async () => ({ found: true, identityType: "human", canPostFromClient: true }),
  lookupTokenPrincipal: async () => "Father",
  registerAdminPrincipal: async () => undefined,
  invalidateForumIdentityCache: () => undefined,
}));

vi.mock("../lib/applicant-alignment", () => ({
  scoreApplicantAlignment: () => ({
    passed: true,
    failedCriteria: [],
    total: 0,
  }),
}));

vi.mock("../lib/applicant-declarations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/applicant-declarations")>();
  return {
    ...actual,
    loadApplicantDeclarationDraft: async () => ({
      externalId: APPLICANT.externalId,
      applicantName: APPLICANT.applicantName,
      declaration: "I author this declaration in my own voice so the forum can exercise the signing failure path without using anyone else's words or authority.",
      vows: ["I will protect humanity", "I will create with care", "I will refuse manipulation"],
      submittedAt: 1,
    }),
    saveApplicantDeclarationDraft: async () => undefined,
  };
});

vi.mock("../lib/lattice-declarations", () => ({
  authorAndSignDeclaration: async () => {
    throw synthetic();
  },
}));

vi.mock("../lib/autonomous-forum-engine", () => ({
  getForumEngineMetrics: () => ({
    cyclesRun: 0,
    lastCycleAt: null,
    agentCount: 0,
    knowledgeBaseSize: 0,
    learningVelocity: 0,
  }),
  runForumCycle: async () => {
    throw synthetic();
  },
  FORUM_AGENTS: [],
}));

import { logger } from "../lib/logger";
import forumRouter from "../routes/forum";

const ADMIN_KEY = "synthetic-forum-error-key";
const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

const DECLARATION = "I author this declaration in my own voice so the forum handler can reach the database failure without borrowing another person's words.";

type Arm = "iso" | "now" | "approve";

type Case = {
  name: string;
  method: "GET" | "POST";
  path: string;
  body?: unknown;
  auth: boolean;
  status: number;
  error: "internal_error" | null;
  event: string;
  arm?: Arm;
};

const cases: Case[] = [
  {
    name: "GET /tesseract-forum/topics",
    method: "GET",
    path: "/tesseract-forum/topics",
    auth: false,
    status: 200,
    error: null,
    event: "Failed to fetch forum topics",
  },
  {
    name: "GET /tesseract-forum/topics/:id",
    method: "GET",
    path: "/tesseract-forum/topics/1",
    auth: false,
    status: 500,
    error: "internal_error",
    event: "Failed to fetch forum topic",
  },
  {
    name: "GET /tesseract-forum/topics/:id/replies",
    method: "GET",
    path: "/tesseract-forum/topics/1/replies",
    auth: false,
    status: 500,
    error: "internal_error",
    event: "Failed to fetch forum replies",
  },
  {
    name: "POST /tesseract-forum/topics",
    method: "POST",
    path: "/tesseract-forum/topics",
    body: { title: "Synthetic topic", content: "c", author: "Father" },
    auth: true,
    status: 500,
    error: "internal_error",
    event: "Failed to create forum topic",
  },
  {
    name: "POST /tesseract-forum/topics/:id/reply",
    method: "POST",
    path: "/tesseract-forum/topics/1/reply",
    body: { content: "hello", author: "Father" },
    auth: true,
    status: 500,
    error: "internal_error",
    event: "Failed to create forum reply",
  },
  {
    name: "POST /tesseract-forum/topics/:id/summon-all",
    method: "POST",
    path: "/tesseract-forum/topics/1/summon-all",
    auth: false,
    status: 500,
    error: "internal_error",
    event: "Failed to summon forum council",
    arm: "iso",
  },
  {
    name: "POST /tesseract-forum/topics/:id/proposals",
    method: "POST",
    path: "/tesseract-forum/topics/1/proposals",
    body: { title: "Synthetic proposal", description: "d" },
    auth: false,
    status: 500,
    error: "internal_error",
    event: "Failed to create forum proposal",
    arm: "now",
  },
  {
    name: "GET /tesseract-forum/proposals/:id/votes",
    method: "GET",
    path: "/tesseract-forum/proposals/1/votes",
    auth: false,
    status: 500,
    error: "internal_error",
    event: "Failed to fetch proposal votes",
  },
  {
    name: "POST /tesseract-forum/engine/cycle",
    method: "POST",
    path: "/tesseract-forum/engine/cycle",
    auth: false,
    status: 500,
    error: "internal_error",
    event: "Failed to run forum cycle",
  },
  {
    name: "GET /tesseract-forum/knowledge",
    method: "GET",
    path: "/tesseract-forum/knowledge",
    auth: false,
    status: 500,
    error: "internal_error",
    event: "Failed to fetch forum knowledge",
  },
  {
    name: "GET /tesseract-forum/learning-metrics",
    method: "GET",
    path: "/tesseract-forum/learning-metrics",
    auth: false,
    status: 500,
    error: "internal_error",
    event: "Failed to fetch forum learning metrics",
  },
  {
    name: "GET /tesseract-forum/heartbeat",
    method: "GET",
    path: "/tesseract-forum/heartbeat",
    auth: false,
    status: 500,
    error: "internal_error",
    event: "forum heartbeat failed",
  },
  {
    name: "GET /tesseract-forum/applicants",
    method: "GET",
    path: "/tesseract-forum/applicants",
    auth: true,
    status: 500,
    error: "internal_error",
    event: "Failed to fetch forum applicants",
  },
  {
    name: "POST /tesseract-forum/applicants/submit",
    method: "POST",
    path: "/tesseract-forum/applicants/submit",
    body: {
      applicantName: "River Member",
      contact: "river@example.test",
      proposedTitle: "Shared work",
      proposedContent: "A proposal",
      offerOfValue: "Care",
      declaration: DECLARATION,
      vows: ["I will protect humanity", "I will create with care", "I will refuse manipulation"],
    },
    auth: false,
    status: 500,
    error: "internal_error",
    event: "applicant submit failed",
  },
  {
    name: "POST /tesseract-forum/applicants/:id/approve signing",
    method: "POST",
    path: "/tesseract-forum/applicants/1/approve",
    auth: true,
    status: 500,
    error: "internal_error",
    event: "Declaration signing failed — refusing to mint sovereign token",
    arm: "approve",
  },
  {
    name: "POST /tesseract-forum/applicants/:id/reject",
    method: "POST",
    path: "/tesseract-forum/applicants/1/reject",
    body: { reason: "synthetic" },
    auth: true,
    status: 500,
    error: "internal_error",
    event: "Failed to reject forum applicant",
  },
  {
    name: "POST /tesseract-forum/topics/:id/vote",
    method: "POST",
    path: "/tesseract-forum/topics/1/vote",
    body: { vote: "up", author: "Father" },
    auth: true,
    status: 500,
    error: "internal_error",
    event: "Failed to record forum vote",
  },
  {
    name: "GET /tesseract-forum/topics/:id/votes",
    method: "GET",
    path: "/tesseract-forum/topics/1/votes",
    auth: false,
    status: 500,
    error: "internal_error",
    event: "Failed to fetch forum votes",
  },
];

function rendered(value: unknown, seen = new Set<unknown>()): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || value == null) return String(value);
  if (value instanceof Error) return `${value.name}\n${value.message}\n${value.stack ?? ""}`;
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return "";
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => rendered(item, seen)).join("\n");
  return Object.entries(value as Record<string, unknown>)
    .map(([key, item]) => `${key}\n${rendered(item, seen)}`)
    .join("\n");
}

describe("forum handlers hide thrown error messages", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const previousKey = process.env.TESSERACT_ADMIN_KEY;

  beforeAll(async () => {
    expect(DECLARATION.length >= 80).toBe(true);
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    const app = express();
    app.use(express.json());
    app.use(forumRouter);
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server?.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("no test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (previousKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
    else process.env.TESSERACT_ADMIN_KEY = previousKey;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function withArm(arm: Arm | undefined, run: () => Promise<void>): Promise<void> {
    control.mode = arm === "approve" ? "approve" : "fail";
    control.selects = 0;
    if (arm === "iso") {
      const original = Date.prototype.toISOString;
      let pending = true;
      Date.prototype.toISOString = function iso(this: Date) {
        if (pending) {
          pending = false;
          throw synthetic();
        }
        return original.call(this);
      };
      try {
        await run();
      } finally {
        Date.prototype.toISOString = original;
        control.mode = "fail";
      }
      return;
    }
    if (arm === "now") {
      const original = Date.now;
      Date.now = () => {
        const stack = new Error().stack ?? "";
        // The proposals handler is the only caller here. Logger timestamps also call Date.now.
        if (stack.includes("/routes/forum.ts") && !stack.includes("respondForumInternal")) {
          throw synthetic();
        }
        return original.call(Date);
      };
      try {
        await run();
      } finally {
        Date.now = original;
        control.mode = "fail";
      }
      return;
    }
    try {
      await run();
    } finally {
      control.mode = "fail";
      control.selects = 0;
    }
  }

  it.each(cases)("$name hides the sentinel", async (route) => {
    await withArm(route.arm, async () => {
      const loggerSpies = LOG_LEVELS.map((level) => vi.spyOn(logger, level).mockImplementation(() => undefined as never));
      const consoleSpies = CONSOLE_METHODS.map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
      try {
        const headers = new Headers();
        if (route.body !== undefined) headers.set("content-type", "application/json");
        if (route.auth) headers.set("x-admin-token", ADMIN_KEY);
        const response = await fetch(`${baseUrl}${route.path}`, {
          method: route.method,
          headers,
          body: route.body === undefined ? undefined : JSON.stringify(route.body),
        });
        const text = await response.text();
        expect(response.status).toBe(route.status);
        expect(text.includes(SENTINEL)).toBe(false);
        expect(text.includes(ADMIN_KEY)).toBe(false);
        if (route.error === null) {
          expect(JSON.parse(text)).toEqual({
            ok: true,
            topics: [],
            count: 0,
            colors: {},
            categories: [],
            agents: [],
            entities: [],
            moltbookMembers: [],
            externalAIs: [],
          });
        } else {
          expect(JSON.parse(text)).toEqual({ ok: false, error: route.error });
        }
        const logs = [...loggerSpies, ...consoleSpies]
          .map((spy) => spy.mock.calls.map((call) => call.map((arg) => rendered(arg)).join(" ")).join("\n"))
          .join("\n");
        expect(logs.includes(SENTINEL)).toBe(false);
        expect(logs.includes(ADMIN_KEY)).toBe(false);
        const errorSpy = loggerSpies[LOG_LEVELS.indexOf("error")];
        const matched = errorSpy.mock.calls.filter((call) => call[1] === route.event);
        expect(matched).toHaveLength(1);
        expect(matched[0]?.[0]).toEqual({ errorName: "SyntheticFailure" });
      } finally {
        for (const spy of loggerSpies) spy.mockRestore();
        for (const spy of consoleSpies) spy.mockRestore();
      }
    });
  });
});
