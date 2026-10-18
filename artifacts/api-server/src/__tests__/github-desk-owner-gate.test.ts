import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import express, { type Request as ExpressRequest, type Response as ExpressResponse } from "express";
import { rejectWhenDatabaseNotConfigured } from "../lib/db-availability";
import { resetSessionCheckRateLimitForTests } from "../lib/father-verify-throttle";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";
import internalSessionCheckRouter, { handleInternalSessionCheck, rejectSessionCheckPeer } from "../routes/internal-session-check";
import {
  deskOwnerGate,
  mainNowGated,
  openPullsGated,
  openRepoContentsGated,
  pinRepoFile,
  postApprovalGated,
  postBoardGated,
  readBoardGated,
  readGitbookGated,
  readRepoFileGated,
  rickReachGated,
  treeDeltaGated,
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
const previousPort = process.env.PORT;
const previousApiPort = process.env.API_SERVER_PORT;
const previousDatabase = process.env.DATABASE_URL;

let checkServer: Server;
let checkPort = 0;

beforeAll(async () => {
  const app = express();
  app.use(express.json({ limit: "2kb" }));
  app.use(rejectWhenDatabaseNotConfigured);
  app.use("/api", internalSessionCheckRouter);
  checkServer = createServer(app);
  await new Promise<void>((resolve) => checkServer.listen(0, "127.0.0.1", () => resolve()));
  const address = checkServer.address();
  if (!address || typeof address === "string") throw new Error("session-check test server has no port");
  checkPort = address.port;
  process.env.API_SERVER_PORT = String(checkPort);
});

afterAll(async () => {
  restore("PORT", previousPort);
  restore("API_SERVER_PORT", previousApiPort);
  await new Promise<void>((resolve, reject) => {
    checkServer.close((error) => (error ? reject(error) : resolve()));
  });
});

afterEach(() => {
  restore(ADMIN_ENV, previousAdmin);
  restore(SESSION_ENV, previousSession);
  restore("DATABASE_URL", previousDatabase);
  restore("PORT", previousPort);
  process.env.API_SERVER_PORT = String(checkPort);
  resetSessionCheckRateLimitForTests();
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
  it("returns 503 when the owner gate is not configured", async () => {
    unconfigured();
    const decision = await deskOwnerGate(`${SESSION_COOKIE}=present`);
    expect(decision).toEqual({ ok: false, status: 503, error: "sovereign-unconfigured" });
    assertGeneric(decision);
  });

  it("returns 503 when the admin key is blank", async () => {
    process.env[ADMIN_ENV] = "   ";
    const decision = await deskOwnerGate(undefined);
    expect(decision).toEqual({ ok: false, status: 503, error: "sovereign-unconfigured" });
    assertGeneric(decision);
  });

  it("returns 401 when no owner session is presented", async () => {
    configured();
    const decision = await deskOwnerGate(undefined);
    expect(decision).toEqual({ ok: false, status: 401, error: "unauthenticated" });
    assertGeneric(decision);
  });

  it("returns 401 when the owner session is wrong", async () => {
    configured();
    const decision = await deskOwnerGate(`${SESSION_COOKIE}=wrong-synthetic-session`);
    expect(decision).toEqual({ ok: false, status: 401, error: "unauthenticated" });
    assertGeneric(decision);
  });

  it("accepts a valid owner session", async () => {
    expect(await deskOwnerGate(ownerCookie())).toEqual({ ok: true });
  });

  it("wires the desk server functions through the owner gate", () => {
    const source = readFileSync(new URL("../../../../preview/src/lib/tessera/github-desk.ts", import.meta.url), "utf8");
    for (const name of [
      "readRepoFileGated",
      "readBoardGated",
      "openPullsGated",
      "postApprovalGated",
      "postBoardGated",
      "rickReachGated",
      "openRepoContentsGated",
      "mainNowGated",
      "treeDeltaGated",
      "readGitbookGated",
    ]) {
      expect(source.includes(`${name}(`)).toBe(true);
    }
    const calls = source.split("\n").filter((line) => line.includes("requestCookie(),"));
    expect(calls).toHaveLength(10);
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
      { owner: "vitalitychems-dot", repo: "TESSERA", path: "certs/server.pem" },
      { owner: "vitalitychems-dot", repo: "TESSERA", path: "artifacts/api-server/.local-data/natal-vault.json" },
      { owner: "vitalitychems-dot", repo: "Gitbook", path: "natal-vault" },
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
    const reach = await rickReachGated(undefined, githubApi);
    const opened = await openRepoContentsGated({ repo: "TESSERA", path: "README.md" }, undefined, {
      token: async () => SERVER_TOKEN,
      fetchImpl: fetchSpy(fetched),
    });
    const now = await mainNowGated(undefined, { githubApi, mainGap: () => ({ line: "should-not-run" }) });
    const delta = await treeDeltaGated(undefined, treeDeps(githubApi));
    const book = await readGitbookGated(undefined, { githubApi, gitbookNote: (body) => body });
    expect(read).toEqual({ ok: false, status: 401, error: "unauthenticated" });
    expect(pulls).toMatchObject({ ok: false, status: 401, error: "unauthenticated", rows: [] });
    expect(board).toMatchObject({ ok: false, status: 401, error: "unauthenticated", lines: [] });
    expect(approval).toEqual({ ok: false, status: 401, error: "unauthenticated" });
    expect(posted).toEqual({ ok: false, status: 401, error: "unauthenticated" });
    expect(reach).toMatchObject({ ok: false, status: 401, error: "unauthenticated", login: "", repos: [] });
    expect(opened).toMatchObject({ ok: false, status: 401, error: "unauthenticated", kind: "no", text: "" });
    expect(now).toMatchObject({ ok: false, status: 401, error: "unauthenticated", line: "I could not reach main." });
    expect(delta).toMatchObject({ ok: false, status: 401, error: "unauthenticated", line: "I could not reach the trees." });
    expect(book).toEqual({ ok: false, status: 401, error: "unauthenticated", notes: [], files: [] });
    expect(calls).toEqual([]);
    expect(fetched).toEqual([]);
    for (const body of [read, pulls, board, approval, posted, reach, opened, now, delta, book]) assertGeneric(body);
  });

  it("returns 503 for every desk action when the gate is not configured", async () => {
    unconfigured();
    const pulls = await openPullsGated(ownerCookieWithoutConfig(), githubApi);
    const approval = await postApprovalGated({ decision: "YES", commentId: 3 }, `${SESSION_COOKIE}=present`, {
      githubApi,
      refuseRepeat: async () => null,
    });
    const posted = await postBoardGated({ text: "A note" }, `${SESSION_COOKIE}=present`, boardPostDeps(githubApi));
    const fetched: string[] = [];
    const reach = await rickReachGated(`${SESSION_COOKIE}=present`, githubApi);
    const opened = await openRepoContentsGated({ repo: "TESSERA", path: "README.md" }, `${SESSION_COOKIE}=present`, {
      token: async () => SERVER_TOKEN,
      fetchImpl: fetchSpy(fetched),
    });
    const now = await mainNowGated(`${SESSION_COOKIE}=present`, { githubApi, mainGap: () => ({ line: "should-not-run" }) });
    const delta = await treeDeltaGated(`${SESSION_COOKIE}=present`, treeDeps(githubApi));
    const book = await readGitbookGated(`${SESSION_COOKIE}=present`, { githubApi, gitbookNote: (body) => body });
    expect(pulls.status).toBe(503);
    expect(approval).toEqual({ ok: false, status: 503, error: "sovereign-unconfigured" });
    expect(posted).toEqual({ ok: false, status: 503, error: "sovereign-unconfigured" });
    expect(reach).toMatchObject({ ok: false, status: 503, error: "sovereign-unconfigured" });
    expect(opened).toMatchObject({ ok: false, status: 503, error: "sovereign-unconfigured" });
    expect(now).toMatchObject({ ok: false, status: 503, error: "sovereign-unconfigured" });
    expect(delta).toMatchObject({ ok: false, status: 503, error: "sovereign-unconfigured" });
    expect(book).toMatchObject({ ok: false, status: 503, error: "sovereign-unconfigured", notes: [], files: [] });
    expect(calls).toEqual([]);
    expect(fetched).toEqual([]);
    for (const body of [approval, posted, reach, opened, now, delta, book]) assertGeneric(body);
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

  it("denies .env, .pem, and natal-vault paths before GitHub is called", async () => {
    const cookie = ownerCookie();
    const fetched: string[] = [];
    for (const path of [
      ".env",
      ".envrc",
      ".ENV-backup",
      "config/.Envrc",
      ".npmrc",
      ".NPMRC",
      "archives/source-repositories/olive-giant-ever-glade/.grok/app-env.json",
      ".grok/APP-ENV.JSON",
      "\uFF0Eenv",
      "docs/\uFF0Enpmrc",
      "docs/app-env\uFF0Ejson",
      "certs/server.pem",
      "artifacts/api-server/.local-data/natal-vault.json",
      "natal-vault",
    ]) {
      const opened = await openRepoContentsGated({ repo: "TESSERA", path }, cookie, {
        token: async () => SERVER_TOKEN,
        fetchImpl: fetchSpy(fetched),
      });
      expect(opened).toEqual({
        ok: false,
        kind: "no",
        line: "That repository path is not allowed.",
        entries: [],
        text: "",
        error: "That repository path is not allowed.",
      });
      assertGeneric(opened);
    }
    expect(fetched).toEqual([]);
  });

  it("denies held paths in readRepoFile and rickOpen before GitHub is called", async () => {
    const cookie = ownerCookie();
    const fetched: string[] = [];
    const io = { token: async () => SERVER_TOKEN, fetchImpl: fetchSpy(fetched) };
    const heldPaths = [
      "data/school/brief.txt",
      "archives/source-repositories/Zz/artifacts/api-server/package.json",
      "src/lib/tessera/ingest.ts",
      "archives/source-variants/1T/README.md",
      "archives/source-variants/T44/README.md",
      "preview/src/lib/tessera/constitution-seal.ts",
      "preview/src/lib/tessera/study-log.ts",
      "preview/src/lib/tessera/desk.ts",
      "T44-agent-coordination.md",
      "ZZ_NOW.txt",
      "zz-olive/readme.md",
      "preview/src/lib/tessera/desk.tsx",
      "preview/src/lib/tessera/desk.ts.bak",
      "notes/zz notes.txt",
      "1t.ledger.md",
    ];
    for (const path of heldPaths) {
      const read = await readRepoFileGated({ owner: "vitalitychems-dot", repo: "TESSERA", path }, cookie, io);
      expect(read, path).toEqual({ ok: false, error: "That repository path is not allowed." });
      const opened = await openRepoContentsGated({ repo: "TESSERA", path }, cookie, io);
      expect(opened, path).toEqual({
        ok: false,
        kind: "no",
        line: "That repository path is not allowed.",
        entries: [],
        text: "",
        error: "That repository path is not allowed.",
      });
    }
    expect(fetched).toEqual([]);
  });

  it("denies case variants of held paths before GitHub is called", async () => {
    const cookie = ownerCookie();
    const fetched: string[] = [];
    const io = { token: async () => SERVER_TOKEN, fetchImpl: fetchSpy(fetched) };
    const heldPaths = [
      "Data/school/brief.txt",
      "archives/ZZ/package.json",
      "preview/src/lib/tessera/CONSTITUTION-SEAL.ts",
      "preview/src/lib/tessera/STUDY-LOG.ts",
      "preview/src/lib/tessera/Desk.ts",
      "archives/source-variants/1t/README.md",
      "archives/source-variants/t44/README.md",
      "src/lib/tessera/INGEST.ts",
    ];
    for (const path of heldPaths) {
      const read = await readRepoFileGated({ owner: "vitalitychems-dot", repo: "TESSERA", path }, cookie, io);
      expect(read, path).toEqual({ ok: false, error: "That repository path is not allowed." });
      const opened = await openRepoContentsGated({ repo: "TESSERA", path }, cookie, io);
      expect(opened, path).toEqual({
        ok: false,
        kind: "no",
        line: "That repository path is not allowed.",
        entries: [],
        text: "",
        error: "That repository path is not allowed.",
      });
    }
    expect(fetched).toEqual([]);
  });

  it("denies percent-encoded held names, including a second decode", async () => {
    const cookie = ownerCookie();
    const fetched: string[] = [];
    const io = { token: async () => SERVER_TOKEN, fetchImpl: fetchSpy(fetched) };
    for (const path of [
      "%64ata/notes.md",
      "%2564ata/notes.md",
      "%252564ata/notes.md",
      "%64ata%2fnotes.md",
      "data\\notes.md",
      "data/\0notes.md",
      "Data/",
      "study-log.ts/",
    ]) {
      const read = await readRepoFileGated({ owner: "vitalitychems-dot", repo: "TESSERA", path }, cookie, io);
      expect(read, path).toEqual({ ok: false, error: "That repository path is not allowed." });
      const opened = await openRepoContentsGated({ repo: "TESSERA", path }, cookie, io);
      expect(opened, path).toEqual({
        ok: false,
        kind: "no",
        line: "That repository path is not allowed.",
        entries: [],
        text: "",
        error: "That repository path is not allowed.",
      });
    }
    expect(fetched).toEqual([]);
  });

  it("omits held names from directory listings", async () => {
    const cookie = ownerCookie();
    const listings = [
      {
        path: "src",
        rows: [
          { name: "NOTES.md", type: "file" },
          { name: "Data", type: "dir" },
          { name: "ZZ", type: "dir" },
          { name: "CONSTITUTION-SEAL.ts", type: "file" },
          { name: "study-log.ts", type: "file" },
          { name: "desk.ts", type: "file" },
          { name: "ingest.ts", type: "file" },
          { name: ".npmrc", type: "file" },
          { name: "app-env.json", type: "file" },
          { name: ".envrc", type: "file" },
          { name: ".ENV-backup", type: "file" },
          { name: "T44-agent-coordination.md", type: "file" },
          { name: "ZZ_NOW.txt", type: "file" },
          { name: "zz-olive", type: "dir" },
          { name: "desk.tsx", type: "file" },
          { name: "desk.ts.bak", type: "file" },
        ],
      },
      {
        path: "preview/src/lib/tessera",
        rows: [
          { name: "NOTES.md", type: "file" },
          { name: "STUDY-LOG.ts", type: "file" },
          { name: "Desk.ts", type: "file" },
          { name: "INGEST.ts", type: "file" },
          { name: "1t", type: "dir" },
          { name: "t44", type: "dir" },
          { name: "secure-recruitment.ts", type: "file" },
          { name: "moltbook-recruitment.md", type: "file" },
          { name: "summit-45", type: "dir" },
        ],
      },
      {
        path: "docs",
        rows: [
          { name: "NOTES.md", type: "file" },
          { name: "SECRET-SOCIETY.md", type: "file" },
          { name: "society-recruits-a.md", type: "file" },
          { name: "society-intel.json", type: "file" },
          { name: "secure-outreach.csv", type: "file" },
          { name: "email-outreach.md", type: "file" },
          { name: "recruit-dossiers", type: "dir" },
          { name: "political-dossiers.pdf", type: "file" },
          { name: "natal-chart.json", type: "file" },
          { name: "father-natal.json", type: "file" },
          { name: "SecretSocietyLedger.md", type: "file" },
          { name: "personal-notes.txt", type: "file" },
        ],
      },
    ];
    for (const listing of listings) {
      const opened = await openRepoContentsGated({ repo: "TESSERA", path: listing.path }, cookie, {
        token: async () => SERVER_TOKEN,
        fetchImpl: (async () => jsonResponse(listing.rows)) as typeof fetch,
      });
      expect(opened, listing.path).toEqual({
        ok: true,
        kind: "dir",
        line: listing.path,
        entries: [{ name: "NOTES.md", kind: "file" }],
        text: "NOTES.md",
      });
    }
  });

  it("denies held name families on decoded segments and basenames before GitHub is called", async () => {
    const cookie = ownerCookie();
    const fetched: string[] = [];
    const io = { token: async () => SERVER_TOKEN, fetchImpl: fetchSpy(fetched) };
    const families = [
      ["SECURE-RECRUITMENT/brief.md", "%73ecure-recruitment/brief.md", "archive/nested/secure-recruitment/brief.md", "archive/nested/notes-secure-recruitment.md"],
      ["MOLTBOOK-RECRUITMENT/brief.md", "%6doltbook-recruitment/brief.md", "archive/nested/moltbook-recruitment/brief.md", "archive/nested/notes-moltbook-recruitment.md"],
      ["SUMMIT-45/brief.md", "%73ummit-45/brief.md", "archive/nested/summit-45/brief.md", "archive/nested/notes-summit-45.md"],
      ["SECRET-SOCIETY/brief.md", "%73ecret-society/brief.md", "archive/nested/secret-society/brief.md", "archive/nested/notes-secret-society.md"],
      ["SOCIETY-RECRUITS/brief.md", "%73ociety-recruits-extra/brief.md", "archive/nested/society-recruits/brief.md", "archive/nested/notes-society-recruits.md"],
      ["SOCIETY-INTEL/brief.md", "%73ociety-intel-extra/brief.md", "archive/nested/society-intel/brief.md", "archive/nested/notes-society-intel.md"],
      ["SECURE-OUTREACH/brief.md", "%73ecure-outreach-extra/brief.md", "archive/nested/secure-outreach/brief.md", "archive/nested/notes-secure-outreach.md"],
      ["EMAIL-OUTREACH/brief.md", "%65mail-outreach-extra/brief.md", "archive/nested/email-outreach/brief.md", "archive/nested/notes-email-outreach.md"],
      ["RECRUIT-DOSSIERS/brief.md", "%72ecruit-dossiers-extra/brief.md", "archive/nested/recruit-dossiers/brief.md", "archive/nested/notes-recruit-dossiers.md"],
      ["POLITICAL-DOSSIERS/brief.md", "%70olitical-dossiers-extra/brief.md", "archive/nested/political-dossiers/brief.md", "archive/nested/notes-political-dossiers.md"],
      ["NATAL-CHART/brief.md", "%6eatal-chart/brief.md", "archive/nested/natal-chart/brief.md", "archive/nested/notes-natal-chart.md"],
      ["FATHER-NATAL/brief.md", "%66ather-natal-chart/brief.md", "archive/nested/father-natal/brief.md", "archive/nested/notes-father-natal.md"],
      ["SecretSociety/brief.md", "%53ecretSocietyLedger.md", "archive/nested/SecretSociety/brief.md", "archive/nested/SecretSocietyLedger.md"],
      ["PERSONAL-NOTES/brief.md", "%70ersonal-notes/brief.md", "archive/nested/personal-notes/brief.md", "archive/nested/notes-personal-extra.md"],
    ];
    for (const paths of families) {
      for (const path of paths) {
        const read = await readRepoFileGated({ owner: "vitalitychems-dot", repo: "TESSERA", path }, cookie, io);
        expect(read, path).toEqual({ ok: false, error: "That repository path is not allowed." });
        const opened = await openRepoContentsGated({ repo: "TESSERA", path }, cookie, io);
        expect(opened, path).toEqual({
          ok: false,
          kind: "no",
          line: "That repository path is not allowed.",
          entries: [],
          text: "",
          error: "That repository path is not allowed.",
        });
      }
    }
    expect(fetched).toEqual([]);
  });

  it("fails closed when a percent sign is still decodable after three passes", async () => {
    const cookie = ownerCookie();
    const fetched: string[] = [];
    const io = { token: async () => SERVER_TOKEN, fetchImpl: fetchSpy(fetched) };
    const read = await readRepoFileGated(
      { owner: "vitalitychems-dot", repo: "TESSERA", path: "README%2525252emd" },
      cookie,
      io,
    );
    expect(read).toEqual({ ok: false, error: "That repository path is not allowed." });
    const opened = await openRepoContentsGated({ repo: "TESSERA", path: "notes/%25252564ata/brief.md" }, cookie, io);
    expect(opened.ok).toBe(false);
    expect(fetched).toEqual([]);
    const allowed = await readRepoFileGated(
      { owner: "vitalitychems-dot", repo: "TESSERA", path: "README%25252emd" },
      cookie,
      io,
    );
    expect(allowed).toEqual({ ok: true, text: "x", path: "vitalitychems-dot/TESSERA/README.md" });
    expect(fetched).toEqual(["https://api.github.com/repos/vitalitychems-dot/TESSERA/contents/README.md"]);
  });

  it("allows a segment that merely begins with a held prefix and has no separator", async () => {
    const cookie = ownerCookie();
    const fetched: string[] = [];
    const read = await readRepoFileGated(
      { owner: "vitalitychems-dot", repo: "TESSERA", path: "notes/t44foo.md" },
      cookie,
      { token: async () => SERVER_TOKEN, fetchImpl: fetchSpy(fetched) },
    );
    expect(read).toEqual({ ok: true, text: "x", path: "vitalitychems-dot/TESSERA/notes/t44foo.md" });
    expect(fetched).toEqual(["https://api.github.com/repos/vitalitychems-dot/TESSERA/contents/notes/t44foo.md"]);
  });

  it("denies an extra held marker from the environment and ignores it when unset", async () => {
    const previous = process.env.SOVEREIGN_HELD_NAME_PATTERN;
    const cookie = ownerCookie();
    const fetched: string[] = [];
    const io = { token: async () => SERVER_TOKEN, fetchImpl: fetchSpy(fetched) };
    try {
      process.env.SOVEREIGN_HELD_NAME_PATTERN = "fixture-held";
      const denied = await readRepoFileGated(
        { owner: "vitalitychems-dot", repo: "TESSERA", path: "notes/fixture-held-a.md" },
        cookie,
        io,
      );
      expect(denied).toEqual({ ok: false, error: "That repository path is not allowed." });
      expect(fetched).toEqual([]);
      delete process.env.SOVEREIGN_HELD_NAME_PATTERN;
      const allowed = await readRepoFileGated(
        { owner: "vitalitychems-dot", repo: "TESSERA", path: "notes/fixture-held-a.md" },
        cookie,
        io,
      );
      expect(allowed).toEqual({ ok: true, text: "x", path: "vitalitychems-dot/TESSERA/notes/fixture-held-a.md" });
    } finally {
      if (previous === undefined) delete process.env.SOVEREIGN_HELD_NAME_PATTERN;
      else process.env.SOVEREIGN_HELD_NAME_PATTERN = previous;
    }
  });

  it("does not print a held name in the tree delta", async () => {
    const cookie = ownerCookie();
    const hidden = [
      "secret-society-plan.md",
      "T44-agent-coordination.md",
      "ZZ_NOW.txt",
      "zz-olive/readme.md",
      "desk.tsx",
      ".npmrc",
      ".grok/app-env.json",
      ".envrc",
      "personal-notes.md",
    ];
    const api: DeskGithubApi = async (path) => {
      if (path.endsWith("/commits/main")) {
        return {
          ok: true,
          status: 200,
          text: JSON.stringify({ sha: "a".repeat(40), commit: { tree: { sha: "c".repeat(40) } } }),
        };
      }
      if (path.includes("/git/trees/")) {
        return {
          ok: true,
          status: 200,
          text: JSON.stringify({
            tree: [{ path: "README.md", type: "blob" }, { path: "docs/guide.md", type: "blob" }, ...hidden.map((entry) => ({ path: entry, type: "blob" }))],
            truncated: false,
          }),
        };
      }
      return { ok: false, status: 500, text: "unused" };
    };
    const delta = await treeDeltaGated(cookie, {
      githubApi: api,
      tesseraHeld: ["README.md", ...hidden],
      gitbookHeld: ["old-secret-society.md", "removed-only.md"],
      pathDelta: deskPathDelta,
      deltaLine: deskDeltaLine,
    });
    expect(delta.ok).toBe(true);
    if (!delta.ok) return;
    for (const name of [...hidden, "old-secret-society.md", "secret-society", "personal-"]) {
      expect(delta.line.includes(name), name).toBe(false);
    }
    expect(delta.line.includes("docs/guide.md")).toBe(true);
    expect(delta.line.includes("removed-only.md")).toBe(true);
    expect(delta.line.includes("README.md")).toBe(true);
  });

  it("serves reach, open, main, trees, and gitbook notes for an owner session", async () => {
    const cookie = ownerCookie();
    const seen: string[] = [];
    const api: DeskGithubApi = async (path) => {
      seen.push(path);
      if (path === "/user") return { ok: true, status: 200, text: JSON.stringify({ login: "owner" }) };
      if (path.startsWith("/user/repos")) {
        return {
          ok: true,
          status: 200,
          text: JSON.stringify([
            { name: "TESSERA", private: true },
            { name: "GitbookAI", private: true },
            { name: "Gitbook", private: false },
          ]),
        };
      }
      if (path.endsWith("/commits/main")) {
        return {
          ok: true,
          status: 200,
          text: JSON.stringify({ sha: "a".repeat(40), commit: { tree: { sha: "b".repeat(40) } } }),
        };
      }
      if (path.includes("/git/trees/")) {
        return { ok: true, status: 200, text: JSON.stringify({ tree: [{ path: "README.md", type: "blob" }], truncated: false }) };
      }
      if (path.includes("/contents/mesh")) {
        return {
          ok: true,
          status: 200,
          text: JSON.stringify([{ name: "NOTE.md", type: "file", html_url: "https://evil.example/NOTE.md" }, { name: ".env", type: "file" }]),
        };
      }
      if (path.includes("/comments")) {
        return { ok: true, status: 200, text: JSON.stringify([{ user: { login: "owner" }, created_at: "2026-01-01T00:00:00Z", body: "hello" }]) };
      }
      return { ok: false, status: 500, text: "ghp_upstream leaked" };
    };
    const reach = await rickReachGated(cookie, api);
    const now = await mainNowGated(cookie, { githubApi: api, mainGap: () => ({ line: "main-ok" }) });
    const delta = await treeDeltaGated(cookie, treeDeps(api));
    const book = await readGitbookGated(cookie, { githubApi: api, gitbookNote: (body) => body });
    const fetched: string[] = [];
    const opened = await openRepoContentsGated({ repo: "Gitbook", path: "README.md" }, cookie, {
      token: async () => SERVER_TOKEN,
      fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
        fetched.push(String(url));
        expect(JSON.stringify(init?.headers ?? {}).includes(USER_TOKEN)).toBe(false);
        expect(JSON.stringify(init?.headers ?? {}).toLowerCase().includes("cookie")).toBe(false);
        return jsonResponse({ type: "file", encoding: "base64", size: 5, content: Buffer.from("hello").toString("base64") });
      }) as typeof fetch,
    });
    expect(reach).toMatchObject({ ok: true, login: "owner", repos: [{ name: "TESSERA", private: true }, { name: "Gitbook", private: false }] });
    expect(now).toEqual({ ok: true, line: "main-ok" });
    expect(delta.ok).toBe(true);
    if (delta.ok) expect(delta.line.startsWith("TESSERA:1")).toBe(true);
    expect(book.ok).toBe(true);
    if (book.ok) {
      expect(book.notes.map((note) => note.body)).toEqual(["hello"]);
      expect(book.files).toEqual([{ name: "NOTE.md", href: "https://github.com/vitalitychems-dot/Gitbook/blob/main/mesh/NOTE.md" }]);
    }
    expect(opened).toEqual({ ok: true, kind: "file", line: "README.md", entries: [], text: "hello" });
    expect(fetched[0]).toBe("https://api.github.com/repos/vitalitychems-dot/Gitbook/contents/README.md");
    expect(seen.some((path) => path.startsWith("/user"))).toBe(true);
    assertGeneric(book);
  });

  it("does not echo upstream failures from reach, main, trees, or gitbook", async () => {
    const cookie = ownerCookie();
    const leaking: DeskGithubApi = async () => ({ ok: false, status: 500, text: "ghp_upstream leaked TESSERACT_ADMIN_KEY" });
    const reach = await rickReachGated(cookie, leaking);
    const now = await mainNowGated(cookie, { githubApi: leaking, mainGap: () => ({ line: "should-not-run" }) });
    const delta = await treeDeltaGated(cookie, treeDeps(leaking));
    const book = await readGitbookGated(cookie, { githubApi: leaking, gitbookNote: (body) => body });
    expect(reach).toEqual({ ok: false, login: "", repos: [], line: "The app could not use the GitHub login." });
    expect(now).toEqual({ ok: false, line: "I could not reach main." });
    expect(delta).toEqual({ ok: false, line: "I could not reach the trees." });
    expect(book).toEqual({ ok: false, error: "The notes could not be read.", notes: [], files: [] });
    for (const body of [reach, now, delta, book]) assertGeneric(body);
  });
});

describe("loopback session check", () => {
  it("returns 503 when the api-server is unreachable", async () => {
    configured();
    const closed = createServer((_req, res) => {
      res.end();
    });
    const port = await listen(closed);
    await closeServer(closed);
    process.env.API_SERVER_PORT = String(port);
    const decision = await deskOwnerGate(ownerCookie());
    expect(decision).toEqual({ ok: false, status: 503, error: "sovereign-unconfigured" });
    assertGeneric(decision);
  });

  it("returns 503 when the api-server times out", async () => {
    configured();
    const hanging = createServer(() => undefined);
    const port = await listen(hanging);
    process.env.API_SERVER_PORT = String(port);
    try {
      const decision = await deskOwnerGate(ownerCookie());
      expect(decision).toEqual({ ok: false, status: 503, error: "sovereign-unconfigured" });
      assertGeneric(decision);
    } finally {
      hanging.closeAllConnections();
      await closeServer(hanging);
    }
  }, 10_000);

  it("fails closed when the session check responds with a redirect", async () => {
    configured();
    const redirecting = createServer((_req, res) => {
      res.writeHead(302, { location: "http://127.0.0.1:9/elsewhere" });
      res.end();
    });
    const port = await listen(redirecting);
    process.env.API_SERVER_PORT = String(port);
    try {
      const decision = await deskOwnerGate(ownerCookie());
      expect(decision).toEqual({ ok: false, status: 401, error: "unauthenticated" });
      assertGeneric(decision);
    } finally {
      await closeServer(redirecting);
    }
  });

  it("allows the owner when PORT is the preview port and API_SERVER_PORT is the check server", async () => {
    expect(checkPort).not.toBe(4174);
    process.env.PORT = "4174";
    process.env.API_SERVER_PORT = String(checkPort);
    expect(await deskOwnerGate(ownerCookie())).toEqual({ ok: true });
  });

  it("fails closed when API_SERVER_PORT is unset or invalid and does not fetch", async () => {
    const calls = vi.spyOn(globalThis, "fetch");
    const invalid = [undefined, "", "   ", "0", "65536", "nope", "8080.5", "1.5", "8080abc", "08080"] as const;
    try {
      for (const value of invalid) {
        calls.mockClear();
        process.env.PORT = String(checkPort);
        if (value === undefined) delete process.env.API_SERVER_PORT;
        else process.env.API_SERVER_PORT = value;
        const decision = await deskOwnerGate(ownerCookie());
        expect(decision, String(value)).toEqual({ ok: false, status: 503, error: "sovereign-unconfigured" });
        assertGeneric(decision);
        expect(calls, String(value)).not.toHaveBeenCalled();
      }
    } finally {
      calls.mockRestore();
    }
  });

  it("denies a session check that returns HTTP 500 without echoing the body", async () => {
    const leak = "upstream-detail-must-not-leak";
    const broken = createServer((_req, res) => {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ message: leak }));
    });
    const port = await listen(broken);
    process.env.API_SERVER_PORT = String(port);
    try {
      const decision = await deskOwnerGate(ownerCookie());
      expect(decision).toEqual({ ok: false, status: 401, error: "unauthenticated" });
      const text = JSON.stringify(decision);
      expect(text.includes(leak)).toBe(false);
      expect(text.includes("message")).toBe(false);
      assertGeneric(decision);
    } finally {
      await closeServer(broken);
    }
  });

  it("denies a session check that returns malformed JSON without echoing the body", async () => {
    const leak = "malformed-body-must-not-leak";
    const broken = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end(`{${leak}`);
    });
    const port = await listen(broken);
    process.env.API_SERVER_PORT = String(port);
    try {
      const decision = await deskOwnerGate(ownerCookie());
      expect(decision).toEqual({ ok: false, status: 401, error: "unauthenticated" });
      expect(JSON.stringify(decision).includes(leak)).toBe(false);
      assertGeneric(decision);
    } finally {
      await closeServer(broken);
    }
  });

  it("returns only the valid flag, with no session contents or token echo", async () => {
    configured();
    const issued = issueSession({ ip: "127.0.0.1", userAgent: "vitest" });
    const valid = await postCheck({ session: issued.signedId });
    expect(valid.status).toBe(200);
    expect(valid.text).toBe('{"valid":true}');
    expect(valid.text.includes(issued.signedId)).toBe(false);
    expect(valid.text.includes("expiresAt")).toBe(false);
    expect(valid.text.includes("record")).toBe(false);
    const invalid = await postCheck({ session: "wrong-synthetic-session" });
    expect(invalid.status).toBe(401);
    expect(invalid.text).toBe('{"valid":false}');
    expect(invalid.text.includes("wrong-synthetic-session")).toBe(false);
    const cookie = await postCheck({}, `${SESSION_COOKIE}=${encodeURIComponent(issued.signedId)}`);
    expect(cookie.status).toBe(200);
    expect(cookie.text).toBe('{"valid":true}');
    expect(cookie.text.includes(issued.signedId)).toBe(false);
    const gate = await deskOwnerGate(`${SESSION_COOKIE}=${encodeURIComponent(issued.signedId)}`);
    expect(gate).toEqual({ ok: true });
  });

  it("rejects a token in the query string", async () => {
    configured();
    const token = "query-token-must-not-echo";
    const response = await fetch(`http://127.0.0.1:${checkPort}/api/internal/session-check?session=${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const text = await response.text();
    expect(response.status).toBe(401);
    expect(text).toBe('{"valid":false}');
    expect(text.includes(token)).toBe(false);
  });

  it("rejects a forwarded header from a loopback socket", async () => {
    configured();
    const token = "forwarded-token-must-not-echo";
    const response = await fetch(`http://127.0.0.1:${checkPort}/api/internal/session-check`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "203.0.113.9",
      },
      body: JSON.stringify({ session: token }),
    });
    const text = await response.text();
    expect(response.status).toBe(403);
    expect(text).toBe('{"valid":false}');
    expect(text.includes(token)).toBe(false);
    expect(text.includes("203.0.113.9")).toBe(false);
  });

  it("rejects a non-loopback peer in rejectSessionCheckPeer before the handler", () => {
    let status = 0;
    let payload: unknown;
    let continued = false;
    const req = {
      originalUrl: "/api/internal/session-check",
      url: "/api/internal/session-check",
      headers: {},
      socket: { remoteAddress: "198.51.100.20" },
    } as unknown as ExpressRequest;
    const res = {
      status(code: number) {
        status = code;
        return this;
      },
      json(body: unknown) {
        payload = body;
        return this;
      },
    } as unknown as ExpressResponse;
    rejectSessionCheckPeer(req, res, () => {
      continued = true;
    });
    expect(status).toBe(403);
    expect(payload).toEqual({ valid: false });
    expect(continued).toBe(false);
  });

  it("rejects extra forwarding headers from a loopback peer", () => {
    for (const name of ["cf-connecting-ip", "true-client-ip", "x-client-ip", "x-forwarded-ssl", "x-envoy-external-address"]) {
      let status = 0;
      let continued = false;
      const req = {
        originalUrl: "/api/internal/session-check",
        url: "/api/internal/session-check",
        headers: { [name]: "203.0.113.9" },
        socket: { remoteAddress: "127.0.0.1" },
      } as unknown as ExpressRequest;
      const res = {
        status(code: number) {
          status = code;
          return this;
        },
        json() {
          return this;
        },
      } as unknown as ExpressResponse;
      rejectSessionCheckPeer(req, res, () => {
        continued = true;
      });
      expect(status, name).toBe(403);
      expect(continued, name).toBe(false);
    }
  });

  it("rejects a non-loopback socket and an empty forwarding header", () => {
    configured();
    const peer = invokeCheck({
      remoteAddress: "203.0.113.5",
      headers: {},
      body: { session: "peer-token-must-not-echo" },
    });
    expect(peer.status).toBe(403);
    expect(peer.body).toEqual({ valid: false });
    expect(JSON.stringify(peer.body).includes("peer-token-must-not-echo")).toBe(false);
    const forwarded = invokeCheck({
      remoteAddress: "127.0.0.1",
      headers: { "x-forwarded-for": "" },
      body: { session: "empty-forward-token" },
    });
    expect(forwarded.status).toBe(403);
    expect(forwarded.body).toEqual({ valid: false });
    const mapped = invokeCheck({
      remoteAddress: "::ffff:127.0.0.1",
      headers: {},
      body: { session: "not-a-session" },
    });
    expect(mapped.status).toBe(401);
    expect(mapped.body).toEqual({ valid: false });
    const v6 = invokeCheck({
      remoteAddress: "::1",
      headers: {},
      body: { session: "not-a-session" },
    });
    expect(v6.status).toBe(401);
    expect(v6.body).toEqual({ valid: false });
  });

  it("rate-limits failed session checks", async () => {
    configured();
    resetSessionCheckRateLimitForTests();
    const token = "rate-limit-token-must-not-echo";
    const results = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      results.push(await postCheck({ session: token }));
    }
    for (const result of results.slice(0, 6)) {
      expect(result.status).toBe(401);
      expect(result.text).toBe('{"valid":false}');
      expect(result.text.includes(token)).toBe(false);
    }
    expect(results[6]?.status).toBe(429);
    expect(results[6]?.text.includes(token)).toBe(false);
    expect(results[6]?.text.includes("signedId")).toBe(false);
    expect(results[6]?.text.includes("rate-limited")).toBe(true);
    const digest = createHash("sha256").update(token).digest("hex");
    expect(results[6]?.text.includes(digest)).toBe(false);
  });

  it("does not let distinct junk cookies block a valid owner", async () => {
    configured();
    resetSessionCheckRateLimitForTests();
    for (let attempt = 0; attempt < 31; attempt += 1) {
      const result = await postCheck({}, `${SESSION_COOKIE}=junk-cookie-${attempt}`);
      expect(result.text.includes(`junk-cookie-${attempt}`)).toBe(false);
      if (attempt < 30) {
        expect(result.status).toBe(401);
        expect(result.text).toBe('{"valid":false}');
      } else {
        expect(result.status).toBe(429);
      }
    }
    expect(await deskOwnerGate(ownerCookie())).toEqual({ ok: true });
  });

  it("does not count forwarded rejects toward the session-check cap", async () => {
    configured();
    resetSessionCheckRateLimitForTests();
    for (let attempt = 0; attempt < 31; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${checkPort}/api/internal/session-check`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.9",
        },
        body: JSON.stringify({ session: `forwarded-junk-${attempt}` }),
      });
      const text = await response.text();
      expect(response.status).toBe(403);
      expect(text).toBe('{"valid":false}');
      expect(text.includes(`forwarded-junk-${attempt}`)).toBe(false);
    }
    const after = await postCheck({ session: "after-forward-must-not-be-limited" });
    expect(after.status).toBe(401);
    expect(after.text).toBe('{"valid":false}');
    expect(after.text.includes("after-forward-must-not-be-limited")).toBe(false);
  });

  it("does not let cookie-less session checks block a later owner", async () => {
    configured();
    for (let attempt = 0; attempt < 31; attempt += 1) {
      const decision = await deskOwnerGate(undefined);
      expect(decision).toEqual({ ok: false, status: 401, error: "unauthenticated" });
      assertGeneric(decision);
    }
    expect(await deskOwnerGate(ownerCookie())).toEqual({ ok: true });
  });

  it("does not require a database", async () => {
    configured();
    delete process.env.DATABASE_URL;
    const result = await postCheck({ session: "not-a-session" });
    expect(result.status).toBe(401);
    expect(result.text).toBe('{"valid":false}');
    expect(result.text.includes("database not configured")).toBe(false);
  });

  it("keeps the check off the preview proxy and the public internal-path list", () => {
    const gateSource = readFileSync(new URL("../lib/github-desk-gate.ts", import.meta.url), "utf8");
    expect(gateSource.includes("lookupSession")).toBe(false);
    expect(gateSource.includes("process.env.PORT")).toBe(false);
    expect(gateSource.includes("API_SERVER_PORT")).toBe(true);
    expect(gateSource.includes("DEFAULT_API_SERVER_PORT")).toBe(false);
    expect(gateSource.includes("http://127.0.0.1:")).toBe(true);
    expect(gateSource.includes('redirect: "error"')).toBe(true);
    const appSource = readFileSync(new URL("../app.ts", import.meta.url), "utf8");
    expect(appSource.includes('"/api/internal/session-check"')).toBe(true);
    const dbSource = readFileSync(new URL("../lib/db-availability.ts", import.meta.url), "utf8");
    expect(dbSource.includes('"/api/internal/session-check"')).toBe(true);
    const viteSource = readFileSync(new URL("../../../../preview/vite.config.ts", import.meta.url), "utf8");
    expect(viteSource.includes("proxy")).toBe(false);
    const registry = readFileSync(new URL("../lib/provider-registry.ts", import.meta.url), "utf8");
    const internalOnly = registry.slice(registry.indexOf("INTERNAL_ONLY_PATHS"), registry.indexOf("SOVEREIGN_TOKEN"));
    expect(internalOnly.includes("/api/internal")).toBe(false);
    const routeSource = readFileSync(new URL("../routes/internal-session-check.ts", import.meta.url), "utf8");
    expect(routeSource.includes("logger")).toBe(false);
    expect(routeSource.includes("console.")).toBe(false);
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

function deskPathDelta(held: readonly string[], live: readonly string[]) {
  const have = new Set(held);
  const now = new Set(live);
  const added = [...new Set(live.filter((path) => path && !have.has(path)))];
  const removed = [...new Set(held.filter((path) => path && !now.has(path)))];
  return { added, removed, held: have.size, live: now.size };
}

function deskDeltaLine(
  repo: string,
  delta: { added: readonly string[]; removed: readonly string[]; held: number; live: number },
) {
  const added = delta.added.slice(0, 4).join(", ") || "none";
  const removed = delta.removed.slice(0, 4).join(", ") || "none";
  return `${repo}: ${delta.live} live names, ${delta.held} copied. ${delta.added.length} added. ${delta.removed.length} removed. Added: ${added}. Removed: ${removed}. I did not open the bodies.`;
}

function treeDeps(githubApi: DeskGithubApi) {
  return {
    githubApi,
    tesseraHeld: ["README.md"],
    gitbookHeld: ["README.md"],
    pathDelta: (held: readonly string[], live: readonly string[]) => ({
      added: live.filter((path) => !held.includes(path)),
      removed: held.filter((path) => !live.includes(path)),
      held: held.length,
      live: live.length,
    }),
    deltaLine: (_repo: string, delta: { live: number }) => `TESSERA:${delta.live}`,
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

function listen(server: Server): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("no port"));
        return;
      }
      resolve(address.port);
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function postCheck(body: unknown, cookie?: string): Promise<{ status: number; text: string }> {
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (cookie) headers.cookie = cookie;
  const response = await fetch(`http://127.0.0.1:${checkPort}/api/internal/session-check`, {
    method: "POST",
    redirect: "error",
    headers,
    body: JSON.stringify(body),
  });
  return { status: response.status, text: await response.text() };
}

function invokeCheck(input: {
  remoteAddress: string;
  headers: Record<string, string>;
  body: unknown;
}): { status: number; body: unknown } {
  let status = 0;
  let payload: unknown;
  const req = {
    originalUrl: "/api/internal/session-check",
    url: "/api/internal/session-check",
    headers: input.headers,
    body: input.body,
    socket: { remoteAddress: input.remoteAddress },
  } as unknown as ExpressRequest;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  } as unknown as ExpressResponse;
  handleInternalSessionCheck(req, res);
  return { status, body: payload };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}
