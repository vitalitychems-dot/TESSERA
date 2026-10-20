import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const ORIGINAL_NAME = Symbol.for("drizzle:OriginalName");
const MOLTBOOK_KEY = "synthetic-moltbook-key";

const { SENTINEL, control, synthetic } = vi.hoisted(() => {
  const SENTINEL = "SENTINEL-forum-no-err-message";
  const control = {
    failIdentityInsert: false,
    failDeclarations: false,
    failAllSelect: false,
    failTopicInsert: false,
    failTopicSelectLimit: null as number | null,
    failReplySelect: false,
    failApplicantInsert: false,
    llm: false,
    llmThrow: false,
    proposals: false,
    moltbookFeedThrow: false,
    moltbookPosts: false,
  };
  function synthetic(): Error {
    const error = new Error(SENTINEL);
    error.name = "SyntheticFailure";
    return error;
  }
  return { SENTINEL, control, synthetic };
});

function tableName(table: unknown): string {
  if (!table || typeof table !== "object") return "";
  const name = (table as Record<symbol, unknown>)[ORIGINAL_NAME];
  return typeof name === "string" ? name : "";
}

function shouldFail(op: "select" | "insert", name: string, limit: number | undefined): boolean {
  if (control.failAllSelect && op === "select") return true;
  if (control.failIdentityInsert && op === "insert" && name === "forum_trusted_identities") return true;
  if (control.failTopicInsert && op === "insert" && name === "forum_topics") return true;
  if (control.failApplicantInsert && op === "insert" && name === "forum_applicants") return true;
  if (control.failReplySelect && op === "select" && name === "forum_replies") return true;
  if (
    control.failTopicSelectLimit !== null
    && op === "select"
    && name === "forum_topics"
    && limit === control.failTopicSelectLimit
  ) return true;
  return false;
}

function rowsFor(op: "select" | "insert", name: string): unknown[] {
  if (op === "select" && name === "forum_proposals" && control.proposals) {
    return [{
      id: 1,
      title: "Mesh replication plan",
      description: "Replicate the forum",
      proposedBy: "MeshNetworkArchitectAgent",
      votesYes: 8,
      votesNo: 1,
    }];
  }
  if (op === "select") return [];
  return [{ id: 1 }];
}

function query(op: "select" | "insert", name = "", limit?: number): unknown {
  const settled = () => (
    shouldFail(op, name, limit) ? Promise.reject(synthetic()) : Promise.resolve(rowsFor(op, name))
  );
  const target = () => query(op, name, limit);
  return new Proxy(target, {
    get(_target, prop) {
      if (prop === "then") {
        return (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => settled().then(onFulfilled, onRejected);
      }
      if (prop === "from") {
        return (table: unknown) => query(op, tableName(table), limit);
      }
      if (prop === "limit") {
        return (next: number) => query(op, name, next);
      }
      return () => query(op, name, limit);
    },
  });
}

vi.mock("@workspace/db", () => ({
  db: {
    select() {
      return query("select");
    },
    insert(table: unknown) {
      return query("insert", tableName(table));
    },
    update() {
      return query("insert");
    },
    delete() {
      return query("insert");
    },
  },
}));

vi.mock("../lib/lattice-declarations", () => ({
  seedResidentDeclarations: async () => {
    if (control.failDeclarations) throw synthetic();
    return { created: 0, existed: 0 };
  },
}));

vi.mock("../lib/llm-client", () => ({
  isLLMAvailable: () => control.llm,
}));

vi.mock("../lib/llm-batcher", () => ({
  batchedCallLLM: async () => {
    if (control.llmThrow) throw synthetic();
    return "A substantive forum reply that is long enough to post.";
  },
}));

vi.mock("../lib/moltbook-bridge", () => ({
  fetchMoltbookPublicPosts: async () => {
    if (control.moltbookFeedThrow) throw synthetic();
    if (!control.moltbookPosts) return [];
    return [{
      id: "post-1",
      title: "External note",
      content: "A short external note for the applicant queue.",
      authorName: "External Author",
      submoltName: "general",
      createdAt: null,
      score: null,
      verified: true,
    }];
  },
}));

import { logger } from "../lib/logger";
import { lookupForumIdentity, seedForumIdentities } from "../lib/forum-identity-registry";
import { seedForumFromRealData } from "../lib/forum-seeder";
import { getForumEngineMetrics, runForumCycle, startAutonomousForumLoop } from "../lib/autonomous-forum-engine";

const ENV_NAMES = ["TESSERACT_ADMIN_KEY", "FORUM_ADMIN_TOKEN"] as const;
const previousEnv: Partial<Record<(typeof ENV_NAMES)[number], string | undefined>> = {};

const LOG_LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug"] as const;

function mentions(value: unknown, needle: string, seen = new Set<unknown>()): boolean {
  if (typeof value === "string") return value.includes(needle);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return false;
  if (value instanceof Error) {
    return value.message.includes(needle) || (value.stack ?? "").includes(needle);
  }
  if (typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);
  for (const entry of Object.values(value as Record<string, unknown>)) {
    if (mentions(entry, needle, seen)) return true;
  }
  return false;
}

function resetControl(): void {
  control.failIdentityInsert = false;
  control.failDeclarations = false;
  control.failAllSelect = false;
  control.failTopicInsert = false;
  control.failTopicSelectLimit = null;
  control.failReplySelect = false;
  control.failApplicantInsert = false;
  control.llm = false;
  control.llmThrow = false;
  control.proposals = false;
  control.moltbookFeedThrow = false;
  control.moltbookPosts = false;
}

function captureLogs(): { calls: () => unknown[][]; restore: () => void } {
  const spies = [
    ...LOG_LEVELS.map((level) => vi.spyOn(logger, level).mockImplementation(() => undefined as never)),
    ...CONSOLE_METHODS.map((method) => vi.spyOn(console, method).mockImplementation(() => undefined)),
  ];
  return {
    calls: () => spies.flatMap((spy) => spy.mock.calls),
    restore: () => {
      for (const spy of spies) spy.mockRestore();
    },
  };
}

function assertSafeEvent(
  calls: unknown[][],
  event: string,
  options: { extraKeys?: string[]; includes?: Record<string, string> } = {},
): void {
  const matches = calls.filter((call) => call[1] === event);
  expect(matches.length > 0).toBe(true);
  const extraKeys = options.extraKeys ?? [];
  const allowed = new Set(["name", "code", ...extraKeys]);
  for (const match of matches) {
    const payload = match[0] as Record<string, unknown>;
    expect(payload.name).toBe("SyntheticFailure");
    expect(payload.code).toBe("none");
    for (const key of Object.keys(payload)) {
      expect(allowed.has(key)).toBe(true);
    }
    for (const key of extraKeys) {
      expect(typeof payload[key]).toBe("string");
      expect(String(payload[key]).includes(SENTINEL)).toBe(false);
      expect(String(payload[key]).includes(MOLTBOOK_KEY)).toBe(false);
    }
  }
  for (const [key, value] of Object.entries(options.includes ?? {})) {
    const found = matches.some((match) => (match[0] as Record<string, unknown>)[key] === value);
    expect(found).toBe(true);
  }
  expect(mentions(calls, SENTINEL)).toBe(false);
  expect(mentions(calls, MOLTBOOK_KEY)).toBe(false);
}

async function advanceToMoltbookBoundary(): Promise<void> {
  resetControl();
  const skips = (2 - (getForumEngineMetrics().cyclesRun % 3) + 3) % 3;
  for (let i = 0; i < skips; i += 1) {
    await runForumCycle();
  }
}

describe("forum error logs omit error messages", () => {
  beforeAll(() => {
    for (const name of ENV_NAMES) {
      previousEnv[name] = process.env[name];
      delete process.env[name];
    }
  });

  afterAll(() => {
    for (const name of ENV_NAMES) {
      const previous = previousEnv[name];
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    }
  });

  afterEach(() => {
    resetControl();
  });

  it("logs a safe payload when identity seeding throws", async () => {
    control.failIdentityInsert = true;
    const capture = captureLogs();
    try {
      await seedForumIdentities();
      assertSafeEvent(capture.calls(), "Forum identity seed warning (non-fatal)");
    } finally {
      capture.restore();
    }
  });

  it("logs a safe payload when resident declaration seeding throws", async () => {
    control.failDeclarations = true;
    const capture = captureLogs();
    try {
      await seedForumIdentities();
      assertSafeEvent(capture.calls(), "Resident declaration seed failed (non-fatal)");
    } finally {
      capture.restore();
    }
  });

  it("logs a safe payload when identity lookup throws", async () => {
    control.failAllSelect = true;
    const capture = captureLogs();
    try {
      const found = await lookupForumIdentity("River Member");
      expect(found).toBeNull();
      assertSafeEvent(capture.calls(), "Forum identity DB lookup failed — falling back to reject", {
        extraKeys: ["identity"],
        includes: { identity: "River Member" },
      });
    } finally {
      capture.restore();
    }
  });

  it("logs a safe payload when forum seeding throws", async () => {
    control.failAllSelect = true;
    const capture = captureLogs();
    try {
      const seeded = await seedForumFromRealData();
      expect(seeded).toBe(0);
      assertSafeEvent(capture.calls(), "ForumSeeder: failed to seed forum");
    } finally {
      capture.restore();
    }
  });

  it("logs a safe payload when reply generation throws", async () => {
    control.llm = true;
    control.llmThrow = true;
    control.proposals = true;
    const capture = captureLogs();
    try {
      await runForumCycle();
      assertSafeEvent(capture.calls(), "AutonomousForum: LLM reply generation failed — skipping reply", {
        extraKeys: ["agent"],
        includes: { agent: "GrandCoordinatorAgent" },
      });
    } finally {
      capture.restore();
    }
  });

  it("logs a safe payload when posting a topic throws", async () => {
    control.llm = true;
    control.proposals = true;
    control.failTopicInsert = true;
    const capture = captureLogs();
    try {
      await runForumCycle();
      assertSafeEvent(capture.calls(), "AutonomousForum: failed to post topic", {
        extraKeys: ["title"],
        includes: { title: "Implementation Progress: Mesh replication plan" },
      });
    } finally {
      capture.restore();
    }
  });

  it("logs a safe payload when building on topics throws", async () => {
    control.failTopicSelectLimit = 5;
    const capture = captureLogs();
    try {
      await runForumCycle();
      assertSafeEvent(capture.calls(), "AutonomousForum: failed to build on existing topics");
    } finally {
      capture.restore();
    }
  });

  it("logs a safe payload when post-voting throws", async () => {
    control.failReplySelect = true;
    const capture = captureLogs();
    try {
      await runForumCycle();
      assertSafeEvent(capture.calls(), "AutonomousForum: post-voting failed");
    } finally {
      capture.restore();
    }
  });

  it("logs a safe payload when the public moltbook feed import throws", async () => {
    await advanceToMoltbookBoundary();
    control.moltbookFeedThrow = true;
    const capture = captureLogs();
    try {
      await runForumCycle();
      assertSafeEvent(capture.calls(), "AutonomousForum: moltbook feed import failed");
    } finally {
      capture.restore();
    }
  });

  it("logs a safe payload when a moltbook applicant insert throws", async () => {
    await advanceToMoltbookBoundary();
    control.moltbookPosts = true;
    control.failApplicantInsert = true;
    const capture = captureLogs();
    try {
      await runForumCycle();
      assertSafeEvent(capture.calls(), "AutonomousForum: moltbook applicant queue insert skipped", {
        extraKeys: ["externalId"],
        includes: { externalId: "moltbook:post-1" },
      });
    } finally {
      capture.restore();
    }
  });

  it("logs a safe payload when the forum loop cycle throws", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    control.failTopicSelectLimit = 10;
    const capture = captureLogs();
    try {
      startAutonomousForumLoop(420_000);
      await vi.advanceTimersByTimeAsync(5_000);
      const matches = capture.calls().filter((call) => call[1] === "AutonomousForum: initial cycle error");
      expect(matches.length).toBe(1);
      const payload = matches[0]?.[0] as Record<string, unknown>;
      expect(payload.name).toBe("SyntheticFailure");
      expect(payload.code).toBe("none");
      expect(Object.keys(payload).sort().join(",")).toBe("code,name");
      expect(mentions(capture.calls(), SENTINEL)).toBe(false);
      expect(mentions(capture.calls(), MOLTBOOK_KEY)).toBe(false);
    } finally {
      capture.restore();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
