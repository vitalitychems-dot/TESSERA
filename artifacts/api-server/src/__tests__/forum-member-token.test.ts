import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import { eq, like, or, sql } from "drizzle-orm";
import { db, getPool, isDbConfigured } from "@workspace/db";
import {
  forumApplicantsTable,
  forumPrincipalTokensTable,
  forumTopicsTable,
  forumTrustedIdentitiesTable,
} from "@workspace/db/schema";
import { saveApplicantDeclarationDraft } from "../lib/applicant-declarations";
import { scoreApplicantAlignment } from "../lib/applicant-alignment";
import { invalidateForumIdentityCache } from "../lib/forum-identity-registry";
import { hashTokenSha256 } from "../lib/mesh-auth";
import forumRouter from "../routes/forum";

const HAS_DB = isDbConfigured();
const ADMIN_KEY = "synthetic-forum-admin-key";
const MEMBER_TOKEN = "synthetic-member-post-token";
const UNKNOWN_TOKEN = "synthetic-unknown-member-token";
const DB_FAULT = "synthetic-db-fault-marker";
const TOPIC_FAULT = "synthetic-topic-fault";
const REGISTER_FAULT = "synthetic-register-fault";
const MEMBER_NAME = "Synthetic Posting Member";
const ROLLBACK_NAME = "Synthetic Rollback Member";
const REGISTER_NAME = "Synthetic Register Fail";
const ALIGNED = [
  "universe cosmos sacred harmony sovereign",
  "humanity protect save freedom",
  "peaceful compassion gentle",
  "create build invent design",
  "mutual partnership AI and human",
  "counter expose truth resist",
].join(" ");

const previousAdminKey = process.env.TESSERACT_ADMIN_KEY;

function sha(value: string): string {
  const hash = hashTokenSha256(value);
  if (!hash) throw new Error("token hash unavailable");
  return hash;
}

describe.skipIf(!HAS_DB)("forum member token", () => {
  let server: Server | undefined;
  let baseUrl = "";
  const adminHash = sha(ADMIN_KEY);

  beforeAll(async () => {
    process.env.TESSERACT_ADMIN_KEY = ADMIN_KEY;
    const alignment = scoreApplicantAlignment({
      applicantName: ROLLBACK_NAME,
      proposedTitle: "Shared work",
      proposedContent: ALIGNED,
      offerOfValue: "Care",
    });
    expect(alignment.passed).toBe(true);

    await db.insert(forumPrincipalTokensTable).values({
      tokenHash: adminHash,
      principalName: "Father",
    }).onConflictDoNothing();
    invalidateForumIdentityCache();

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
    await db.execute(sql.raw("DROP TRIGGER IF EXISTS tessera_member_token_block_topic ON forum_topics"));
    await db.execute(sql.raw("DROP FUNCTION IF EXISTS tessera_member_token_block_topic()"));
    await db.execute(sql.raw("DROP TRIGGER IF EXISTS tessera_member_token_block_register ON forum_principal_tokens"));
    await db.execute(sql.raw("DROP FUNCTION IF EXISTS tessera_member_token_block_register()"));
    await db.delete(forumTopicsTable).where(or(
      like(forumTopicsTable.author, "Synthetic %"),
      like(forumTopicsTable.title, "[Vetted Member] %"),
    ));
    await db.delete(forumApplicantsTable).where(like(forumApplicantsTable.applicantName, "Synthetic %"));
    await db.delete(forumPrincipalTokensTable).where(or(
      eq(forumPrincipalTokensTable.tokenHash, adminHash),
      like(forumPrincipalTokensTable.principalName, "Synthetic %"),
    ));
    await db.delete(forumTrustedIdentitiesTable).where(like(forumTrustedIdentitiesTable.name, "Synthetic %"));
    invalidateForumIdentityCache();
    if (previousAdminKey === undefined) delete process.env.TESSERACT_ADMIN_KEY;
    else process.env.TESSERACT_ADMIN_KEY = previousAdminKey;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
  });

  async function send(
    path: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<{ status: number; text: string; json: Record<string, unknown> | null }> {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    if (text) {
      try {
        const parsed: unknown = JSON.parse(text);
        json = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
      } catch {
        json = null;
      }
    }
    return { status: response.status, text, json };
  }

  async function insertMember(name: string, token: string): Promise<void> {
    await db.insert(forumTrustedIdentitiesTable).values({
      name,
      identityType: "member",
      canPostFromClient: 1,
    }).onConflictDoNothing();
    await db.insert(forumPrincipalTokensTable).values({
      tokenHash: sha(token),
      principalName: name,
    }).onConflictDoNothing();
    invalidateForumIdentityCache();
  }

  it("accepts a valid member token on member posting", async () => {
    await insertMember(MEMBER_NAME, MEMBER_TOKEN);
    const posted = await send("/tesseract-forum/topics", {
      title: "Synthetic member topic",
      content: "A member post",
      author: MEMBER_NAME,
    }, { "x-member-token": MEMBER_TOKEN });
    expect(posted.status).toBe(200);
    expect(posted.json?.ok).toBe(true);
    const topic = posted.json?.topic as { author?: string; authorType?: string } | undefined;
    expect(topic?.author).toBe(MEMBER_NAME);
    expect(topic?.authorType).toBe("member");
    expect(posted.text).not.toContain(MEMBER_TOKEN);
  });

  it("rejects an unknown member token", async () => {
    const posted = await send("/tesseract-forum/topics", {
      title: "Synthetic unknown topic",
      content: "nope",
      author: MEMBER_NAME,
    }, { "x-member-token": UNKNOWN_TOKEN });
    expect(posted.status).toBe(401);
    expect(posted.json).toEqual({ ok: false, error: "member-token-rejected" });
    const rows = await db.select({ id: forumTopicsTable.id }).from(forumTopicsTable)
      .where(eq(forumTopicsTable.title, "Synthetic unknown topic"));
    expect(rows).toEqual([]);
  });

  it("rejects a malformed member token", async () => {
    const posted = await send("/tesseract-forum/topics", {
      title: "Synthetic short topic",
      content: "nope",
      author: MEMBER_NAME,
    }, { "x-member-token": "short" });
    expect(posted.status).toBe(401);
    expect(posted.json).toEqual({ ok: false, error: "member-token-rejected" });
  });

  it("does not grant admin authority from a member token or the admin key on the member header", async () => {
    const asMember = await send("/tesseract-forum/admin/register-principal", {
      token: "synthetic-should-not-bind",
      principalName: MEMBER_NAME,
    }, { "x-member-token": MEMBER_TOKEN });
    expect(asMember.status).toBe(401);

    const asAdminHeader = await send("/tesseract-forum/admin/register-principal", {
      token: "synthetic-should-not-bind",
      principalName: MEMBER_NAME,
    }, { "x-admin-token": MEMBER_TOKEN });
    expect(asAdminHeader.status).toBe(401);

    const applicants = await fetch(`${baseUrl}/tesseract-forum/applicants`, {
      headers: { "x-member-token": MEMBER_TOKEN, "x-admin-token": MEMBER_TOKEN },
    });
    expect(applicants.status).toBe(401);

    const fatherPost = await send("/tesseract-forum/topics", {
      title: "Synthetic father via member header",
      content: "nope",
      author: "Father",
    }, { "x-member-token": ADMIN_KEY });
    expect(fatherPost.status).toBe(401);
    expect(fatherPost.json).toEqual({ ok: false, error: "member-token-rejected" });
    const leaked = await db.select({ id: forumTopicsTable.id }).from(forumTopicsTable)
      .where(eq(forumTopicsTable.title, "Synthetic father via member header"));
    expect(leaked).toEqual([]);
    const bound = await db.select({ id: forumPrincipalTokensTable.id }).from(forumPrincipalTokensTable)
      .where(eq(forumPrincipalTokensTable.tokenHash, sha("synthetic-should-not-bind")));
    expect(bound).toEqual([]);
  });

  it("fails closed when the member-token lookup hits a database error", async () => {
    const pool = getPool();
    const original = pool.query.bind(pool);
    pool.query = ((..._args: unknown[]) => {
      const failure = new Error(DB_FAULT);
      failure.name = "SyntheticDbFault";
      return Promise.reject(failure);
    }) as typeof pool.query;
    try {
      const posted = await send("/tesseract-forum/topics", {
        title: "Synthetic db fault topic",
        content: "nope",
        author: MEMBER_NAME,
      }, { "x-member-token": MEMBER_TOKEN });
      expect(posted.status).toBe(503);
      expect(posted.json).toEqual({ ok: false, error: "member-token-rejected" });
      expect(posted.text).not.toContain(DB_FAULT);
    } finally {
      pool.query = original as typeof pool.query;
    }
    const rows = await db.select({ id: forumTopicsTable.id }).from(forumTopicsTable)
      .where(eq(forumTopicsTable.title, "Synthetic db fault topic"));
    expect(rows).toEqual([]);
  });

  it("rolls back identity, binding, and topic when admission fails mid-transaction", async () => {
    await db.execute(sql.raw(`
      CREATE OR REPLACE FUNCTION tessera_member_token_block_topic()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $fn$
      BEGIN
        IF NEW.author = '${ROLLBACK_NAME}' THEN
          RAISE EXCEPTION '${TOPIC_FAULT}' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
      END;
      $fn$
    `));
    await db.execute(sql.raw(`
      DROP TRIGGER IF EXISTS tessera_member_token_block_topic ON forum_topics
    `));
    await db.execute(sql.raw(`
      CREATE TRIGGER tessera_member_token_block_topic
      BEFORE INSERT ON forum_topics
      FOR EACH ROW
      EXECUTE FUNCTION tessera_member_token_block_topic()
    `));

    const externalId = `synthetic-rollback:${ROLLBACK_NAME}`;
    try {
      const [applicant] = await db.insert(forumApplicantsTable).values({
        externalId,
        externalIdentity: "synthetic-rollback",
        source: "external",
        applicantName: ROLLBACK_NAME,
        applicantHandle: "",
        contact: "synthetic@example.test",
        proposedTitle: "Shared work",
        proposedContent: ALIGNED,
        offerOfValue: "Care",
        status: "pending",
      }).returning();
      await saveApplicantDeclarationDraft({
        externalId,
        applicantName: ROLLBACK_NAME,
        declaration: "I author this declaration in my own voice so the forum can admit a synthetic member without borrowing anyone else's words or authority.",
        vows: ["I will protect humanity", "I will create with care", "I will refuse manipulation"],
        submittedAt: 1,
      });

      const approved = await send(`/tesseract-forum/applicants/${applicant.id}/approve`, {}, {
        "x-admin-token": ADMIN_KEY,
      });
      expect(approved.status).toBe(500);
      expect(approved.json).toEqual({ ok: false, error: "applicant-approve-failed" });
      expect(approved.text).not.toContain(TOPIC_FAULT);
      expect(approved.text).not.toContain(ADMIN_KEY);

      const identities = await db.select({ id: forumTrustedIdentitiesTable.id }).from(forumTrustedIdentitiesTable)
        .where(eq(forumTrustedIdentitiesTable.name, ROLLBACK_NAME));
      const tokens = await db.select({ id: forumPrincipalTokensTable.id }).from(forumPrincipalTokensTable)
        .where(eq(forumPrincipalTokensTable.principalName, ROLLBACK_NAME));
      const topics = await db.select({ id: forumTopicsTable.id }).from(forumTopicsTable)
        .where(eq(forumTopicsTable.author, ROLLBACK_NAME));
      const [stillPending] = await db.select({ status: forumApplicantsTable.status }).from(forumApplicantsTable)
        .where(eq(forumApplicantsTable.id, applicant.id));
      expect(identities).toEqual([]);
      expect(tokens).toEqual([]);
      expect(topics).toEqual([]);
      expect(stillPending?.status).toBe("pending");
    } finally {
      await db.execute(sql.raw("DROP TRIGGER IF EXISTS tessera_member_token_block_topic ON forum_topics"));
      await db.execute(sql.raw("DROP FUNCTION IF EXISTS tessera_member_token_block_topic()"));
    }
  });

  it("surfaces registerAdminPrincipal failure instead of a 200", async () => {
    await db.insert(forumTrustedIdentitiesTable).values({
      name: REGISTER_NAME,
      identityType: "entity",
      canPostFromClient: 1,
    }).onConflictDoNothing();
    invalidateForumIdentityCache();
    await db.execute(sql.raw(`
      CREATE OR REPLACE FUNCTION tessera_member_token_block_register()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $fn$
      BEGIN
        IF NEW.principal_name = '${REGISTER_NAME}' THEN
          RAISE EXCEPTION '${REGISTER_FAULT}' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
      END;
      $fn$
    `));
    await db.execute(sql.raw("DROP TRIGGER IF EXISTS tessera_member_token_block_register ON forum_principal_tokens"));
    await db.execute(sql.raw(`
      CREATE TRIGGER tessera_member_token_block_register
      BEFORE INSERT ON forum_principal_tokens
      FOR EACH ROW
      EXECUTE FUNCTION tessera_member_token_block_register()
    `));
    try {
      const registered = await send("/tesseract-forum/admin/register-principal", {
        token: "synthetic-register-target",
        principalName: REGISTER_NAME,
      }, { "x-admin-token": ADMIN_KEY });
      expect(registered.status).toBe(500);
      expect(registered.json).toEqual({ ok: false, error: "principal-register-failed" });
      expect(registered.text).not.toContain(REGISTER_FAULT);
      const rows = await db.select({ id: forumPrincipalTokensTable.id }).from(forumPrincipalTokensTable)
        .where(eq(forumPrincipalTokensTable.principalName, REGISTER_NAME));
      expect(rows).toEqual([]);
    } finally {
      await db.execute(sql.raw("DROP TRIGGER IF EXISTS tessera_member_token_block_register ON forum_principal_tokens"));
      await db.execute(sql.raw("DROP FUNCTION IF EXISTS tessera_member_token_block_register()"));
    }
  });
});
