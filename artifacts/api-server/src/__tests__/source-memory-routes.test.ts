import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import sourceMemoryRouter from "../routes/source-memory";
import securityRouter from "../routes/security";
import { issueSession, SESSION_COOKIE } from "../lib/sovereign-session";

const ADMIN_KEY = "synthetic-owner-token";
const SESSION_SECRET = "synthetic-session-secret-32chars!!";
let server: Server;
let baseUrl = "";
let tempDir = "";
let previousAdmin: string | undefined;
let previousSession: string | undefined;
let previousDbPath: string | undefined;

function ownerCookie(): string {
  return `${SESSION_COOKIE}=${issueSession({ ip: "127.0.0.1", userAgent: "vitest" }).signedId}`;
}

beforeAll(async () => {
  previousAdmin = process.env.TESSERACT_ADMIN_KEY;
  previousSession = process.env.SOVEREIGN_SESSION_SECRET;
  previousDbPath = process.env.TESSERA_SOURCE_MEMORY_DB;
  process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
  process.env.SOVEREIGN_SESSION_SECRET = SESSION_SECRET;
  tempDir = mkdtempSync(join(tmpdir(), "tessera-source-routes-"));
  const dbPath = join(tempDir, "contexts.sqlite");
  process.env.TESSERA_SOURCE_MEMORY_DB = dbPath;
  const db = new DatabaseSync(dbPath);
  db.exec("CREATE VIRTUAL TABLE contexts USING fts5(repository,path,context,commit_id UNINDEXED,evidence UNINDEXED,url UNINDEXED,checked_at UNINDEXED)");
  db.exec(`CREATE TABLE repository_catalog (
    repository TEXT PRIMARY KEY, description TEXT NOT NULL, categories TEXT NOT NULL,
    url TEXT NOT NULL, license_label TEXT NOT NULL, license_approved INTEGER NOT NULL,
    commit_id TEXT NOT NULL, tracked_files INTEGER, text_files_inspected INTEGER NOT NULL,
    rea_status TEXT NOT NULL, rea_snapshot_files INTEGER NOT NULL, checked_at TEXT NOT NULL
  )`);
  db.prepare("INSERT INTO contexts VALUES (?,?,?,?,?,?,?)").run(
    "a/b", "src/tool.ts", "defensive repository context", "c".repeat(40), "metadata-only-untrusted", "https://github.com/a/b", "2026-10-23T00:00:00Z",
  );
  db.prepare("INSERT INTO repository_catalog VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").run(
    "a/b", "defensive repository context", JSON.stringify(["Memory"]), "https://github.com/a/b",
    "UNKNOWN", 0, "c".repeat(40), 1, 1, "rea-returned", 1, "2026-10-23T00:00:00Z",
  );
  db.close();

  const app = express();
  app.use("/api", sourceMemoryRouter);
  app.use("/api", securityRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("missing test address");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  rmSync(tempDir, { recursive: true, force: true });
  if (previousAdmin === undefined) delete process.env.TESSERACT_ADMIN_KEY;
  else process.env.TESSERACT_ADMIN_KEY = previousAdmin;
  if (previousSession === undefined) delete process.env.SOVEREIGN_SESSION_SECRET;
  else process.env.SOVEREIGN_SESSION_SECRET = previousSession;
  if (previousDbPath === undefined) delete process.env.TESSERA_SOURCE_MEMORY_DB;
  else process.env.TESSERA_SOURCE_MEMORY_DB = previousDbPath;
});

describe("owner-only source memory and secret status routes", () => {
  it("rejects anonymous source-memory reads", async () => {
    const response = await fetch(`${baseUrl}/api/source-memory/status`);
    expect(response.status).toBe(401);
  });

  it("returns bounded source-memory evidence to the owner", async () => {
    const status = await fetch(`${baseUrl}/api/source-memory/status`, { headers: { cookie: ownerCookie() } });
    expect(status.status).toBe(200);
    expect(await status.json()).toMatchObject({
      ok: true, available: true, records: 1, repositories: 1, catalogRecords: 1, reaSnapshots: 1,
      modelTrained: false, executionAllowed: false, externalStorageSynced: false,
    });

    const search = await fetch(`${baseUrl}/api/source-memory/search?q=defensive`, { headers: { cookie: ownerCookie() } });
    expect(search.status).toBe(200);
    const body = await search.json() as { results?: Array<{ repository?: string; evidence?: string }> };
    expect(body.results?.[0]).toMatchObject({ repository: "a/b", evidence: "metadata-only-untrusted" });

    const catalog = await fetch(`${baseUrl}/api/source-memory/catalog?category=Memory`, { headers: { cookie: ownerCookie() } });
    expect(catalog.status).toBe(200);
    expect(await catalog.json()).toMatchObject({
      ok: true,
      total: 1,
      records: [{ repository: "a/b", commit: "c".repeat(40), installed: false, executed: false }],
    });
    const rejectedCategory = await fetch(`${baseUrl}/api/source-memory/catalog?category=DOX%20%2F%20osint`, { headers: { cookie: ownerCookie() } });
    expect(rejectedCategory.status).toBe(400);
  });

  it("returns secret existence and purpose, never values", async () => {
    const response = await fetch(`${baseUrl}/api/owner/credentials/status`, { headers: { cookie: ownerCookie() } });
    expect(response.status).toBe(200);
    const body = await response.json() as { valuesVisible?: boolean; credentials?: Array<{ name?: string; configured?: boolean }> };
    expect(body.valuesVisible).toBe(false);
    expect(body.credentials?.some((entry) => entry.name === "TESSERACT_ADMIN_KEY" && entry.configured)).toBe(true);
    expect(JSON.stringify(body)).not.toContain(ADMIN_KEY);
    expect(JSON.stringify(body)).not.toContain(SESSION_SECRET);
  });
});
