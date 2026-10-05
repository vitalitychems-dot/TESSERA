import type { Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.js";
import { createGitHubClient, type FetchLike } from "./github.js";
import { startHttpServer } from "./http.js";
import { createHttpServer } from "./http-server.js";
import { encodeMessage, handleMcpMessage, takeFrames } from "./mcp-session.js";
import { loadLanes } from "./routing.js";
import { createGitbookService, type GitbookService } from "./service.js";

interface MockResult {
  status?: number;
  body: unknown;
}

interface RecordedCall {
  method: string;
  url: string;
  body: unknown;
  authorization: string | null;
}

function encodeBase64(text: string): string {
  return Buffer.from(text, "utf8").toString("base64");
}

function mockFetch(handler: (method: string, url: URL, body: unknown) => MockResult): {
  fetchImpl: FetchLike;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined;
    const authorization = new Headers(init?.headers).get("authorization");
    calls.push({ method, url: `${url.pathname}${url.search}`, body, authorization });
    const result = handler(method, url, body);
    return new Response(JSON.stringify(result.body), {
      status: result.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetchImpl, calls };
}

function serviceFrom(handler: (method: string, url: URL, body: unknown) => MockResult, agentLane?: string): {
  service: GitbookService;
  calls: RecordedCall[];
} {
  const mock = mockFetch(handler);
  const client = createGitHubClient({
    token: "ghp_testtokenvalue1234567890",
    apiBase: "https://github.test",
    fetchImpl: mock.fetchImpl,
  });
  const service = createGitbookService({
    client,
    owner: "vitalitychems-dot",
    repo: "Gitbook",
    branch: "main",
    boardIssue: 2,
    handoffPath: "mesh/HANDOFF.md",
    agentLane,
    now: () => new Date("2026-10-05T23:00:00.000Z"),
  });
  return { service, calls: mock.calls };
}

describe("agents registry", () => {
  it("lists every mesh lane and its specialty", () => {
    const lanes = loadLanes();
    expect(lanes.map((lane) => [lane.id, lane.specialty])).toEqual([
      ["tessera", "admin and final approval"],
      ["gitbook-cordnation", "intake and organization"],
      ["gitbook-moderator", "review gate"],
      ["security", "read-only security sweeps"],
      ["build", "verify-only"],
      ["command-center", "status feed"],
      ["mesh-cloud", "connectivity"],
      ["historical-analysis-collab", "historical comparisons and merge pages"],
      ["gitbook-helper", "ledger and receipts"],
    ]);
    expect(lanes.find((lane) => lane.id === "security")?.fileWrites).toBe(false);
    expect(lanes.find((lane) => lane.id === "build")?.fileWrites).toBe(false);
  });
});

describe("route_task", () => {
  const { service } = serviceFrom(() => ({ body: {} }));

  it.each([
    ["approve the final package", "tessera"],
    ["organize the intake backlog", "gitbook-cordnation"],
    ["review gate before publish", "gitbook-moderator"],
    ["read-only security sweep", "security"],
    ["verify the typecheck results", "build"],
    ["status feed for the bulk update", "command-center"],
    ["mesh connectivity blocker", "mesh-cloud"],
    ["historical comparison of merge pages", "historical-analysis-collab"],
    ["update the ledger receipts", "gitbook-helper"],
  ])("routes %s to %s", (description, laneId) => {
    const first = service.routeTask(description);
    const second = service.routeTask(description);
    expect(first, first.explanation).toMatchObject({ laneId, fallback: false });
    expect(second).toEqual(first);
    expect(first.reasons.length).toBeGreaterThan(0);
  });

  it("falls back to Tessera when nothing matches and does not claim the task", () => {
    const decision = service.routeTask("zzzz-no-such-topic");
    expect(decision.laneId).toBe("tessera");
    expect(decision.fallback).toBe(true);
    expect(decision.score).toBe(0);
    expect(decision.explanation).toMatch(/does not claim/i);
  });
});

describe("github tools", () => {
  it("searches markdown through the code search API", async () => {
    const { service, calls } = serviceFrom((method, url) => {
      if (method === "GET" && url.pathname === "/search/code") {
        expect(url.searchParams.get("q")).toContain("repo:vitalitychems-dot/Gitbook");
        expect(url.searchParams.get("q")).toContain("extension:md");
        return {
          body: {
            items: [
              {
                name: "HANDOFF.md",
                path: "mesh/HANDOFF.md",
                html_url: "https://github.test/mesh/HANDOFF.md",
                text_matches: [{ fragment: "coordination board" }],
              },
            ],
          },
        };
      }
      return { status: 404, body: { message: "unexpected" } };
    });
    const result = await service.searchDocs("coordination board");
    expect(result.hits).toEqual([
      {
        path: "mesh/HANDOFF.md",
        name: "HANDOFF.md",
        htmlUrl: "https://github.test/mesh/HANDOFF.md",
        snippet: "coordination board",
        score: 1,
        source: "github-code-search",
      },
    ]);
    expect(calls[0]?.authorization).toBe("Bearer ghp_testtokenvalue1234567890");
  });

  it("redacts the token from GitHub error text", async () => {
    const { service } = serviceFrom(() => ({
      status: 401,
      body: { message: "bad credentials ghp_testtokenvalue1234567890" },
    }));
    try {
      await service.getBoard();
      expect.fail("expected GitHub error");
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      expect(text).toContain("[REDACTED]");
      expect(text).not.toContain("ghp_testtokenvalue1234567890");
    }
  });

  it("falls back to a tree scan when code search is forbidden", async () => {
    const { service } = serviceFrom((method, url) => {
      if (method === "GET" && url.pathname === "/search/code") {
        return { status: 403, body: { message: "code search unavailable" } };
      }
      if (method === "GET" && url.pathname.endsWith("/git/trees/main")) {
        return {
          body: {
            tree: [
              { path: "mesh/HANDOFF.md", type: "blob" },
              { path: "README.md", type: "blob" },
              { path: "mesh", type: "tree" },
            ],
          },
        };
      }
      if (method === "GET" && url.pathname.endsWith("/contents/mesh/HANDOFF.md")) {
        return {
          body: {
            encoding: "base64",
            content: encodeBase64("# Handoff\n\nThe coordination board lives here."),
            path: "mesh/HANDOFF.md",
          },
        };
      }
      if (method === "GET" && url.pathname.endsWith("/contents/README.md")) {
        return { body: { encoding: "base64", content: encodeBase64("Hello"), path: "README.md" } };
      }
      return { status: 404, body: { message: `${method} ${url.pathname}` } };
    });
    const result = await service.searchDocs("coordination board");
    expect(result.hits[0]).toMatchObject({ path: "mesh/HANDOFF.md", source: "tree-scan" });
    expect(result.hits[0]?.snippet).toContain("coordination board");
  });

  it("reads a page and lists markdown plus directories", async () => {
    const { service } = serviceFrom((method, url) => {
      if (method === "GET" && url.pathname.endsWith("/contents/mesh/roles.md")) {
        return {
          body: {
            type: "file",
            encoding: "base64",
            content: encodeBase64("# Roles\nHello page"),
            sha: "page-sha",
            path: "mesh/roles.md",
            size: 18,
          },
        };
      }
      if (method === "GET" && url.pathname.endsWith("/contents/mesh")) {
        return {
          body: [
            { type: "file", name: "HANDOFF.md", path: "mesh/HANDOFF.md" },
            { type: "file", name: "diagram.png", path: "mesh/diagram.png" },
            { type: "dir", name: "roles", path: "mesh/roles" },
          ],
        };
      }
      return { status: 404, body: { message: url.pathname } };
    });
    const page = await service.readPage("mesh/roles.md");
    expect(page.content).toBe("# Roles\nHello page");
    expect(page.sha).toBe("page-sha");
    const listed = await service.listPages("mesh");
    expect(listed.entries.map((entry) => entry.path)).toEqual(["mesh/HANDOFF.md", "mesh/roles"]);
  });

  it("rejects traversal and the protected vault", async () => {
    const { service, calls } = serviceFrom(() => ({ body: {} }));
    await expect(service.readPage("../secrets")).rejects.toThrow(/traversal/);
    await expect(service.readPage("vault/1T/secret.md")).rejects.toThrow(/1T/);
    expect(calls).toHaveLength(0);
  });

  it("reads the coordination board and prefixes comments", async () => {
    const { service, calls } = serviceFrom((method, url, body) => {
      if (method === "GET" && url.pathname.endsWith("/issues/2/comments")) {
        return {
          body: [
            {
              id: 7,
              body: "AGENT: Tessera\n\nClaimed the list",
              html_url: "https://github.test/issues/2#issuecomment-7",
              created_at: "2026-10-05T22:00:00Z",
              user: { login: "tessera" },
            },
          ],
        };
      }
      if (method === "POST" && url.pathname.endsWith("/issues/2/comments")) {
        return { body: { id: 8, html_url: "https://github.test/issues/2#issuecomment-8", body } };
      }
      return { status: 404, body: { message: url.pathname } };
    });
    const board = await service.getBoard();
    expect(board.issue).toBe(2);
    expect(board.comments[0]).toMatchObject({ id: 7, author: "tessera" });
    const posted = await service.postBoardUpdate("Build", "Typecheck passed.");
    expect(posted.body).toBe("AGENT: Build\n\nTypecheck passed.");
    const post = calls.find((call) => call.method === "POST");
    expect(post?.body).toEqual({ body: "AGENT: Build\n\nTypecheck passed." });
  });

  it("writes a handoff through a draft pull request and keeps the existing page", async () => {
    const { service, calls } = serviceFrom((method, url, body) => {
      const payload = body as { ref?: string; branch?: string; sha?: string; content?: string; draft?: boolean; base?: string; head?: string };
      if (method === "GET" && url.pathname.endsWith("/git/ref/heads/main")) {
        return { body: { object: { sha: "abc123" } } };
      }
      if (method === "POST" && url.pathname.endsWith("/git/refs")) {
        return { body: { ref: payload.ref, object: { sha: "abc123" } } };
      }
      if (method === "GET" && url.pathname.endsWith("/contents/mesh/HANDOFF.md")) {
        return {
          body: {
            type: "file",
            encoding: "base64",
            content: encodeBase64("ORIGINAL handoff\n"),
            sha: "file-sha",
            path: "mesh/HANDOFF.md",
          },
        };
      }
      if (method === "PUT" && url.pathname.endsWith("/contents/mesh/HANDOFF.md")) {
        return { body: { commit: { sha: "commit-sha" } } };
      }
      if (method === "POST" && url.pathname.endsWith("/pulls")) {
        return { body: { number: 9, html_url: "https://github.test/pull/9", draft: true } };
      }
      return { status: 404, body: { message: `${method} ${url.pathname}` } };
    }, "tessera");
    const handoff = await service.readHandoff();
    expect(handoff.content).toContain("ORIGINAL handoff");
    const result = await service.writeHandoff("Build", "Verified the connector.");
    expect(result.pullRequest.draft).toBe(true);
    expect(result.branch.startsWith("gitbook-mcp/handoff-")).toBe(true);
    expect(result.commitSha).toBe("commit-sha");
    const refCall = calls.find((call) => call.method === "POST" && call.url.endsWith("/git/refs"));
    expect(refCall?.body).toMatchObject({ sha: "abc123" });
    expect(JSON.stringify(refCall?.body)).not.toContain("refs/heads/main");
    const put = calls.find((call) => call.method === "PUT");
    const putBody = put?.body as { branch: string; sha: string; content: string };
    expect(putBody.branch).toBe(result.branch);
    expect(putBody.branch).not.toBe("main");
    expect(putBody.sha).toBe("file-sha");
    const decoded = Buffer.from(putBody.content, "base64").toString("utf8");
    expect(decoded).toContain("ORIGINAL handoff");
    expect(decoded).toContain("AGENT: Build");
    expect(decoded).toContain("Verified the connector.");
    const pull = calls.find((call) => call.method === "POST" && call.url.endsWith("/pulls"));
    expect(pull?.body).toMatchObject({ draft: true, base: "main", head: result.branch });
  });

  it("proposes a page change as a draft and refuses a non-draft response", async () => {
    const { service } = serviceFrom((method, url) => {
      if (method === "GET" && url.pathname.endsWith("/git/ref/heads/main")) return { body: { object: { sha: "abc123" } } };
      if (method === "POST" && url.pathname.endsWith("/git/refs")) return { body: { ref: "ok" } };
      if (method === "GET" && url.pathname.includes("/contents/")) return { status: 404, body: { message: "missing" } };
      if (method === "PUT") return { body: { commit: { sha: "new-sha" } } };
      if (method === "POST" && url.pathname.endsWith("/pulls")) return { body: { number: 4, draft: false } };
      if (method === "PATCH" && url.pathname.endsWith("/pulls/4")) return { body: { number: 4, state: "closed" } };
      return { status: 404, body: { message: url.pathname } };
    }, "tessera");
    await expect(service.proposePageChange("mesh/roles.md", "# Roles\nUpdated\n", "Update roles")).rejects.toThrow(/closed/);
  });

  it("opens a draft pull request for a new page without pushing main", async () => {
    const { service, calls } = serviceFrom((method, url) => {
      if (method === "GET" && url.pathname.endsWith("/git/ref/heads/main")) return { body: { object: { sha: "abc123" } } };
      if (method === "POST" && url.pathname.endsWith("/git/refs")) return { body: { ref: "ok" } };
      if (method === "GET" && url.pathname.includes("/contents/")) return { status: 404, body: { message: "missing" } };
      if (method === "PUT") return { body: { commit: { sha: "new-sha" } } };
      if (method === "POST" && url.pathname.endsWith("/pulls")) {
        return { body: { number: 4, html_url: "https://github.test/pull/4", draft: true } };
      }
      return { status: 404, body: { message: url.pathname } };
    }, "tessera");
    const result = await service.proposePageChange("mesh/roles.md", "# Roles\nUpdated", "Update roles");
    expect(result).toMatchObject({
      commitSha: "new-sha",
      pullRequest: { number: 4, draft: true, base: "main" },
    });
    const put = calls.find((call) => call.method === "PUT");
    const putBody = put?.body as { branch: string; sha?: string; content: string };
    expect(putBody.sha).toBeUndefined();
    expect(putBody.branch.startsWith("gitbook-mcp/page-")).toBe(true);
    expect(Buffer.from(putBody.content, "base64").toString("utf8")).toContain("# Roles\nUpdated");
  });

  it("returns main commits and open pull requests for the overlap check", async () => {
    const { service } = serviceFrom((method, url) => {
      if (method === "GET" && url.pathname.endsWith("/commits")) {
        return {
          body: [
            {
              sha: "5c1137fa",
              html_url: "https://github.test/commit/5c1137fa",
              commit: { message: "HYB-005\n\nbody", author: { name: "Tessera", date: "2026-10-05T23:00:00Z" } },
            },
          ],
        };
      }
      if (method === "GET" && url.pathname.endsWith("/pulls")) {
        return {
          body: [
            {
              number: 3,
              title: "Draft roles",
              draft: true,
              html_url: "https://github.test/pull/3",
              head: { ref: "gitbook-mcp/page-1", sha: "def456" },
              user: { login: "cordnation" },
            },
          ],
        };
      }
      return { status: 404, body: { message: url.pathname } };
    });
    const recent = await service.recentChanges();
    expect(recent.headSha).toBe("5c1137fa");
    expect(recent.commits[0]).toMatchObject({ sha: "5c1137fa", message: "HYB-005" });
    expect(recent.openPullRequests[0]).toMatchObject({ number: 3, draft: true, headRef: "gitbook-mcp/page-1" });
    expect(recent.overlapCheck).toMatch(/before claiming work/i);
  });

  it("blocks file writes from the read-only security lane", async () => {
    const { service, calls } = serviceFrom(() => ({ body: {} }), "security");
    await expect(service.proposePageChange("README.md", "nope", "nope")).rejects.toThrow(/read-only/);
    await expect(service.writeHandoff("Security", "report")).rejects.toThrow(/read-only/);
    expect(calls).toHaveLength(0);
  });

  it("does not let a per-call lane override or escalate GITBOOK_AGENT_LANE", async () => {
    const security = serviceFrom(() => ({ body: {} }), "security");
    await expect(security.service.proposePageChange("README.md", "nope", "nope", "tessera")).rejects.toThrow(/cannot override/);
    await expect(security.service.writeHandoff("Security", "report", "Security")).rejects.toThrow(/read-only/);
    expect(security.calls).toHaveLength(0);

    const build = serviceFrom(() => ({ body: {} }), "build");
    await expect(build.service.proposePageChange("README.md", "nope", "nope", "nonexistent")).rejects.toThrow(/cannot override/);
    await expect(build.service.writeHandoff("Build", "report", "nonexistent")).rejects.toThrow(/cannot override/);
    expect(build.calls).toHaveLength(0);

    const unset = serviceFrom(() => ({ body: {} }));
    await expect(unset.service.proposePageChange("README.md", "nope", "nope", "tessera")).rejects.toThrow(/read-only/);
    expect(unset.calls).toHaveLength(0);
  });

  it("does not call GitHub for routing when the token is absent", async () => {
    const service = createGitbookService({
      owner: "vitalitychems-dot",
      repo: "Gitbook",
      branch: "main",
      boardIssue: 2,
      handoffPath: "mesh/HANDOFF.md",
    });
    expect(service.routeTask("status feed").laneId).toBe("command-center");
    await expect(service.getBoard()).rejects.toThrow(/GITBOOK_GITHUB_TOKEN/);
  });

  it("refuses to construct a client without a token", () => {
    expect(() => createGitHubClient({ token: "  ", apiBase: "https://github.test" })).toThrow(/GITBOOK_GITHUB_TOKEN/);
  });
});

describe("http and mcp transports", () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  });

  it("serves health, tool list, and route_task over HTTP", async () => {
    const { service } = serviceFrom(() => ({ body: {} }));
    const server = createHttpServer(service);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : 0;
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(await health.json()).toEqual({ ok: true, service: "tessera-gitbook-mcp" });
    const tools = await fetch(`http://127.0.0.1:${port}/v1/tools`);
    const toolBody = (await tools.json()) as { data: Array<{ name: string }> };
    expect(toolBody.data.map((tool) => tool.name)).toContain("recent_changes");
    const routed = await fetch(`http://127.0.0.1:${port}/v1/route_task`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ description: "read-only security sweep" }),
    });
    const routedBody = (await routed.json()) as { ok: boolean; data: { laneId: string } };
    expect(routedBody.ok).toBe(true);
    expect(routedBody.data.laneId).toBe("security");
  });

  it("returns 503 for GitHub tools when the token is missing", async () => {
    const service = createGitbookService({
      owner: "vitalitychems-dot",
      repo: "Gitbook",
      branch: "main",
      boardIssue: 2,
      handoffPath: "mesh/HANDOFF.md",
    });
    const server = createHttpServer(service);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address();
    const port = address && typeof address === "object" ? address.port : 0;
    const missing = await fetch(`http://127.0.0.1:${port}/v1/get_board`);
    expect(missing.status).toBe(503);
    const body = (await missing.json()) as { ok: boolean; error: string };
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/GITBOOK_GITHUB_TOKEN/);
  });

  it("answers MCP initialize and tools/call", async () => {
    const { service } = serviceFrom(() => ({ body: {} }));
    const info = { name: "tessera-gitbook-mcp", version: "0.0.0" };
    const initialized = await handleMcpMessage(
      service,
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } },
      info,
    );
    expect(initialized).toMatchObject({
      id: 1,
      result: { protocolVersion: "2024-11-05", serverInfo: info },
    });
    expect(await handleMcpMessage(service, { jsonrpc: "2.0", method: "notifications/initialized" }, info)).toBeNull();
    const called = await handleMcpMessage(
      service,
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "route_task", arguments: { description: "ledger receipts" } },
      },
      info,
    );
    const result = called?.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content[0]?.text ?? "{}")).toMatchObject({ laneId: "gitbook-helper" });
  });

  it("refuses to start when GITBOOK_HTTP_HOST is not loopback", () => {
    const previous = process.env.GITBOOK_HTTP_HOST;
    process.env.GITBOOK_HTTP_HOST = "0.0.0.0";
    let started: Server | undefined;
    try {
      expect(() => {
        started = startHttpServer();
      }).toThrow(/Refusing to start/);
      expect(() => loadConfig()).toThrow(/0\.0\.0\.0/);
    } finally {
      started?.close();
      if (previous === undefined) delete process.env.GITBOOK_HTTP_HOST;
      else process.env.GITBOOK_HTTP_HOST = previous;
    }
    expect(loadConfig({ GITBOOK_HTTP_HOST: "127.0.0.1" }).httpHost).toBe("127.0.0.1");
    expect(loadConfig({ GITBOOK_HTTP_HOST: "localhost" }).httpHost).toBe("localhost");
    expect(loadConfig({ GITBOOK_HTTP_HOST: "::1" }).httpHost).toBe("::1");
  });

  it("decodes a split Content-Length frame", () => {
    const frame = encodeMessage({ jsonrpc: "2.0", id: 1, method: "ping" });
    expect(takeFrames(frame.subarray(0, 8)).messages).toHaveLength(0);
    expect(takeFrames(frame).messages).toEqual([{ jsonrpc: "2.0", id: 1, method: "ping" }]);
  });
});
