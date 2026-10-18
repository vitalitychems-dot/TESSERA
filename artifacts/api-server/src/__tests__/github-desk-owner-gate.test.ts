import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import {
  deskOwnerGate,
  openPullsGated,
  pinRepoFile,
  postApprovalGated,
  postBoardGated,
  readBoardGated,
  readRepoFileGated,
  type DeskGithubApi,
} from "../lib/github-desk-gate";

const ADMIN_ENV = "TESSERACT_ADMIN_KEY";
const SESSION_ENV = "SOVEREIGN_SESSION_SECRET";
const SYNTHETIC_ADMIN = "synthetic-owner-token";
const SYNTHETIC_SESSION = "synthetic-session-secret-32chars!!";
const USER_TOKEN = "user-session-value-not-for-github";
const SERVER_TOKEN = "server-desk-token";

const previousAdmin = process.env[ADMIN_ENV];
const previousSession = process.env[SESSION_ENV];

afterEach(() => {
  restore(ADMIN_ENV, previousAdmin);
  restore(SESSION_ENV, previousSession);
});

function restore(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function configured() {
  process.env[ADMIN_ENV] = SYNTHETIC_ADMIN;
  process.env[SESSION_ENV] = SYNTHETIC_SESSION;
}

function unconfigured() {
  delete process.env[ADMIN_ENV];
  delete process.env[SESSION_ENV];
}

function ownerCookie(): string {
  configured();
  const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
  return `${SESSION_COOKIE}=${encodeURIComponent(issued.signedId)}`;
}

function assertGeneric(body: unknown) {
  const text = JSON.stringify(body);
  expect(text.includes(SYNTHETIC_ADMIN)).toBe(false);
  expect(text.includes(SYNTHETIC_SESSION)).toBe(false);
  expect(text.includes(USER_TOKEN)).toBe(false);
  expect(text.includes(SERVER_TOKEN)).toBe(false);
  expect(text.includes(ADMIN_ENV)).toBe(false);
  expect(text.includes(SESSION_ENV)).toBe(false);
  expect(text.includes("ghp_")).toBe(false);
  expect(text.includes("bad-signature")).toBe(false);
  expect(text.includes("no-cookie")).toBe(false);
  expect(body && typeof body === "object" && "reason" in body).toBe(false);
  expect(body && typeof body === "object" && "message" in body).toBe(false);
}

describe("github desk owner gate", () => {
  it("returns 503 when the owner gate is not configured", () => {
    unconfigured();
    const decision = deskOwnerGate(`${SESSION_COOKIE}=present`);
    expect(decision).toEqual({ ok: false, status: 503, error: "sovereign-unconfigured" });
    assertGeneric(decision);
  });

  it("returns 503 when the admin key is blank", () => {
    process.env[ADMIN_ENV] = "   ";
    const decision = deskOwnerGate(undefined);
    expect(decision).toEqual({ ok: false, status: 503, error: "sovereign-unconfigured" });
    assertGeneric(decision);
  });

  it("returns 401 when no owner session is presented", () => {
    configured();
    const decision = deskOwnerGate(undefined);
    expect(decision).toEqual({ ok: false, status: 401, error: "unauthenticated" });
    assertGeneric(decision);
  });

  it("returns 401 when the owner session is wrong", () => {
    configured();
    const decision = deskOwnerGate(`${SESSION_COOKIE}=wrong-synthetic-session`);
    expect(decision).toEqual({ ok: false, status: 401, error: "unauthenticated" });
    assertGeneric(decision);
  });

  it("accepts a valid owner session", () => {
    expect(deskOwnerGate(ownerCookie())).toEqual({ ok: true });
  });

  it("wires the desk server functions through the owner gate", () => {
    const source = readFileSync(new URL("../../../../preview/src/lib/tessera/github-desk.ts", import.meta.url), "utf8");
    for (const name of ["readRepoFileGated", "readBoardGated", "openPullsGated", "postApprovalGated", "postBoardGated"]) {
      expect(source.includes(`${name}(`)).toBe(true);
    }
    const calls = source.split("\n").filter((line) => line.includes("requestCookie(),"));
    expect(calls).toHaveLength(5);
  });

  it("pins repo file reads to the two project repositories", () => {
    expect(pinRepoFile({ owner: "vitalitychems-dot", repo: "TESSERA", path: "README.md" })).toEqual({
      ok: true,
      owner: "vitalitychems-dot",
      repo: "TESSERA",
      path: "README.md",
    });
    expect(pinRepoFile({ owner: "vitalitychems-dot", repo: "Gitbook.git", path: "mesh/note.md" })).toEqual({
      ok: true,
      owner: "vitalitychems-dot",
      repo: "Gitbook",
      path: "mesh/note.md",
    });
    for (const input of [
      { owner: "someone-else", repo: "TESSERA", path: "README.md" },
      { owner: "vitalitychems-dot", repo: "other", path: "README.md" },
      { owner: "vitalitychems-dot", repo: "TESSERA", path: "../.env" },
      { owner: "vitalitychems-dot", repo: "TESSERA", path: "%2e%2e/secret.txt" },
      { owner: "vitalitychems-dot", repo: "TESSERA", path: "%252e%252e/README.md" },
      { owner: "vitalitychems-dot", repo: "Gitbook", path: "/etc/passwd" },
      { owner: "vitalitychems-dot", repo: "Gitbook", path: ".env" },
      { owner: "vitalitychems-dot", repo: "Gitbook", path: "config/.env.local" },
      { owner: "vitalitychems-dot", repo: "TESSERA", path: "src/id_rsa" },
    ]) {
      expect(pinRepoFile(input)).toEqual({ ok: false, error: "That repository path is not allowed." });
    }
  });
});

describe("gated desk actions", () => {
  const calls: string[] = [];
  const githubApi: DeskGithubApi = async (path, init) => {
    calls.push(`${init?.method ?? "GET"} ${path}`);
    if ((init?.method ?? "GET") === "GET" && path.includes("/pulls")) {
      return { ok: true, status: 200, text: JSON.stringify([{ number: 7, title: "Desk gate", draft: true }]) };
    }
    if ((init?.method ?? "GET") === "GET") {
      return { ok: true, status: 200, text: JSON.stringify([{ id: 3, user: { login: "owner" }, body: "Lane: Cursor\nQuestion: Ship?\nNeed: yes or no" }]) };
    }
    return { ok: true, status: 201, text: JSON.stringify({ id: 1 }) };
  };

  afterEach(() => {
    calls.length = 0;
  });

  it("returns 401 for every desk action when no owner session is presented", async () => {
    configured();
    const fetched: string[] = [];
    const read = await readRepoFileGated(
      { owner: "vitalitychems-dot", repo: "TESSERA", path: "README.md" },
      undefined,
      { token: async () => SERVER_TOKEN, fetchImpl: fetchSpy(fetched) },
    );
    const pulls = await openPullsGated(undefined, githubApi);
    const board = await readBoardGated(undefined, boardDeps(githubApi));
    const approval = await postApprovalGated({ decision: "YES", commentId: 3 }, undefined, {
      githubApi,
      refuseRepeat: async () => "should-not-run",
    });
    const posted = await postBoardGated({ text: "A note" }, undefined, boardPostDeps(githubApi));
    expect(read).toEqual({ ok: false, status: 401, error: "unauthenticated" });
    expect(pulls).toMatchObject({ ok: false, status: 401, error: "unauthenticated", rows: [] });
    expect(board).toMatchObject({ ok: false, status: 401, error: "unauthenticated", lines: [] });
    expect(approval).toEqual({ ok: false, status: 401, error: "unauthenticated" });
    expect(posted).toEqual({ ok: false, status: 401, error: "unauthenticated" });
    expect(calls).toEqual([]);
    expect(fetched).toEqual([]);
    for (const body of [read, pulls, board, approval, posted]) assertGeneric(body);
  });

  it("returns 503 for every desk action when the gate is not configured", async () => {
    unconfigured();
    const pulls = await openPullsGated(ownerCookieWithoutConfig(), githubApi);
    const approval = await postApprovalGated({ decision: "YES", commentId: 3 }, `${SESSION_COOKIE}=present`, {
      githubApi,
      refuseRepeat: async () => null,
    });
    const posted = await postBoardGated({ text: "A note" }, `${SESSION_COOKIE}=present`, boardPostDeps(githubApi));
    expect(pulls.status).toBe(503);
    expect(approval).toEqual({ ok: false, status: 503, error: "sovereign-unconfigured" });
    expect(posted).toEqual({ ok: false, status: 503, error: "sovereign-unconfigured" });
    expect(calls).toEqual([]);
    assertGeneric(approval);
    assertGeneric(posted);
  });

  it("reads the board and the pull list for an owner session", async () => {
    const cookie = ownerCookie();
    const pulls = await openPullsGated(cookie, githubApi);
    const board = await readBoardGated(cookie, boardDeps(githubApi));
    expect(pulls.ok).toBe(true);
    expect(pulls.rows).toEqual([{ repo: "TESSERA", number: 7, title: "Desk gate", state: "draft" }, { repo: "Gitbook", number: 7, title: "Desk gate", state: "draft" }]);
    expect(board.ok).toBe(true);
    if (board.ok) expect(board.lines[0]?.user).toBe("owner");
    expect(calls.some((call) => call.startsWith("GET /repos/vitalitychems-dot/"))).toBe(true);
  });

  it("posts an approval and a board note for an owner session", async () => {
    const cookie = ownerCookie();
    const approval = await postApprovalGated({ decision: "YES", commentId: 3 }, cookie, {
      githubApi,
      refuseRepeat: async () => null,
    });
    const posted = await postBoardGated({ text: "Ship the gate" }, cookie, boardPostDeps(githubApi));
    expect(approval).toEqual({ ok: true, url: "https://github.com/vitalitychems-dot/Gitbook/issues/2" });
    expect(posted).toEqual({ ok: true, url: "https://github.com/vitalitychems-dot/Gitbook/issues/2" });
    expect(calls.some((call) => call.startsWith("POST /repos/vitalitychems-dot/Gitbook/issues/2/comments"))).toBe(true);
  });

  it("does not echo upstream failures from approval or board posts", async () => {
    const cookie = ownerCookie();
    const leaking: DeskGithubApi = async () => ({ ok: false, status: 500, text: "ghp_upstream leaked TESSERACT_ADMIN_KEY" });
    const approval = await postApprovalGated({ decision: "NO", commentId: 4 }, cookie, {
      githubApi: leaking,
      refuseRepeat: async () => null,
    });
    const posted = await postBoardGated({ text: "Ship the gate" }, cookie, { ...boardPostDeps(leaking), ghComment: async () => false });
    expect(approval).toEqual({ ok: false, error: "The approval was not posted." });
    expect(posted).toEqual({ ok: false, error: "The command was not posted." });
    assertGeneric(approval);
    assertGeneric(posted);
  });

  it("rejects another owner, another repo, and a traversal path without calling GitHub", async () => {
    const cookie = ownerCookie();
    const fetched: string[] = [];
    const fetchImpl = fetchSpy(fetched);
    const other = await readRepoFileGated(
      { owner: "someone-else", repo: "private", path: "README.md" },
      cookie,
      { token: async () => SERVER_TOKEN, fetchImpl },
    );
    const climbed = await readRepoFileGated(
      { owner: "vitalitychems-dot", repo: "TESSERA", path: "docs/../../.env" },
      cookie,
      { token: async () => SERVER_TOKEN, fetchImpl },
    );
    expect(other).toEqual({ ok: false, error: "That repository path is not allowed." });
    expect(climbed).toEqual({ ok: false, error: "That repository path is not allowed." });
    expect(fetched).toEqual([]);
    assertGeneric(other);
    assertGeneric(climbed);
  });

  it("reads an allowlisted file with the server token and hides upstream errors", async () => {
    const cookie = ownerCookie();
    const seen: { url: string; headerText: string }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      seen.push({ url: String(url), headerText: JSON.stringify(init?.headers ?? null) });
      if (String(url).endsWith("/NOTES.md")) {
        throw new Error(`connect failed ghp_fromdns ${USER_TOKEN}`);
      }
      if (String(url).endsWith("/BIG.md")) {
        return jsonResponse({ type: "file", encoding: "base64", size: 90_000, content: Buffer.from("ghp_big").toString("base64") });
      }
      return jsonResponse({
        type: "file",
        encoding: "base64",
        size: 5,
        content: Buffer.from("hello").toString("base64"),
      });
    }) as typeof fetch;
    const ok = await readRepoFileGated(
      { owner: "vitalitychems-dot", repo: "TESSERA", path: "README.md" },
      cookie,
      { token: async () => SERVER_TOKEN, fetchImpl },
    );
    const blown = await readRepoFileGated(
      { owner: "vitalitychems-dot", repo: "Gitbook", path: "BIG.md" },
      cookie,
      { token: async () => SERVER_TOKEN, fetchImpl },
    );
    const failed = await readRepoFileGated(
      { owner: "vitalitychems-dot", repo: "Gitbook", path: "NOTES.md" },
      cookie,
      { token: async () => SERVER_TOKEN, fetchImpl },
    );
    expect(ok).toEqual({ ok: true, text: "hello", path: "vitalitychems-dot/TESSERA/README.md" });
    expect(blown).toEqual({ ok: false, error: "That file could not be read." });
    expect(failed).toEqual({ ok: false, error: "That file could not be read." });
    expect(seen[0]?.url).toBe("https://api.github.com/repos/vitalitychems-dot/TESSERA/contents/README.md");
    const headerText = seen.map((row) => row.headerText).join("\n");
    expect(headerText.includes(`Bearer ${SERVER_TOKEN}`)).toBe(true);
    expect(headerText.includes(USER_TOKEN)).toBe(false);
    expect(headerText.toLowerCase().includes("cookie")).toBe(false);
    assertGeneric(blown);
    assertGeneric(failed);
  });
});

function ownerCookieWithoutConfig(): string {
  return `${SESSION_COOKIE}=present`;
}

function boardDeps(githubApi: DeskGithubApi) {
  return {
    githubApi,
    readCachedBoard: async () => null,
    saveCachedBoard: async () => undefined,
    savedBoard: [],
  };
}

function boardPostDeps(githubApi: DeskGithubApi) {
  return {
    githubApi,
    noteAllowed: () => null,
    writeRefusal: () => null,
    refuseRepeat: async () => null,
    readCachedBoard: async () => [],
    saveCachedBoard: async () => undefined,
    ghComment: async () => false,
  };
}

function fetchSpy(urls: string[]): typeof fetch {
  return (async (url: string | URL | Request) => {
    urls.push(String(url));
    return jsonResponse({ type: "file", encoding: "base64", size: 1, content: Buffer.from("x").toString("base64") });
  }) as typeof fetch;
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
