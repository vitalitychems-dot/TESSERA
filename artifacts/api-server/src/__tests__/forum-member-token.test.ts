import { createServer, type Server } from "node:http";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import express, { type Request, type Response, type NextFunction } from "express";
import { DrizzleQueryError } from "drizzle-orm";
import { eq, like, or, sql } from "drizzle-orm";
import { db, getPool, isDbConfigured } from "@workspace/db";
import {
  forumApplicantsTable,
  forumPostVotesTable,
  forumPrincipalTokensTable,
  forumRepliesTable,
  forumTopicsTable,
  forumTrustedIdentitiesTable,
} from "@workspace/db/schema";
import { saveApplicantDeclarationDraft } from "../lib/applicant-declarations";
import { scoreApplicantAlignment } from "../lib/applicant-alignment";
import { invalidateForumIdentityCache } from "../lib/forum-identity-registry";
import { logger } from "../lib/logger";
import { safeDbErrorLog } from "../lib/safe-db-error";
import { hashTokenSha256 } from "../lib/mesh-auth";
import forumRouter from "../routes/forum";

const mintHarness = vi.hoisted(() => ({ shortMint: false }));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    randomBytes(size: number) {
      if (mintHarness.shortMint) return Buffer.alloc(3);
      return actual.randomBytes(size);
    },
  };
});

const HAS_DB = isDbConfigured();
const ADMIN_KEY = "synthetic-forum-admin-key";
const MEMBER_TOKEN = "synthetic-member-post-token";
const UNKNOWN_TOKEN = "synthetic-unknown-member-token";
const DB_FAULT = "synthetic-db-fault-marker";
const TOPIC_FAULT = "synthetic-topic-fault";
const REGISTER_FAULT = "synthetic-register-fault";
const MEMBER_NAME = "Synthetic Posting Member";
const OTHER_NAME = "Synthetic Other Member";
const OTHER_TOKEN = "synthetic-other-member-token";
const DISABLED_NAME = "Synthetic Disabled Member";
const DISABLED_TOKEN = "synthetic-disabled-member-token";
const ROLLBACK_NAME = "Synthetic Rollback Member";
const REGISTER_NAME = "Synthetic Register Fail";
const HASH_FAIL_NAME = "Synthetic Hash Fail";
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
  let activeSchema: string | null = null;
  let schemaSerial = 0;
  let savedQuery: ReturnType<typeof getPool>["query"] | null = null;
  let savedConnect: ReturnType<typeof getPool>["connect"] | null = null;

  function restorePool(): void {
    const pool = getPool();
    if (savedQuery) pool.query = savedQuery;
    if (savedConnect) pool.connect = savedConnect;
    savedQuery = null;
    savedConnect = null;
  }

  async function dropActiveSchema(): Promise<void> {
    const name = activeSchema;
    activeSchema = null;
    restorePool();
    if (!name || !/^tessera_member_[0-9a-f]+$/.test(name)) return;
    await getPool().query(`DROP SCHEMA IF EXISTS ${name} CASCADE`);
    invalidateForumIdentityCache();
  }

  function assertDedicatedTestDatabase(): void {
    const dedicated = process.env.TESSERA_TEST_DATABASE_URL?.trim() ?? "";
    const active = process.env.DATABASE_URL?.trim() ?? "";
    if (dedicated.length === 0 || dedicated !== active) {
      throw new Error("throwaway schema requires the dedicated test database");
    }
  }

  async function withThrowawaySchema(run: () => Promise<void>): Promise<void> {
    assertDedicatedTestDatabase();
    schemaSerial += 1;
    const schemaName = `tessera_member_${schemaSerial.toString(16)}${Date.now().toString(16)}`;
    if (!/^tessera_member_[0-9a-f]+$/.test(schemaName)) {
      throw new Error("throwaway schema name rejected");
    }
    activeSchema = schemaName;
    const pool = getPool();
    const originalQuery = pool.query.bind(pool);
    const originalConnect = pool.connect.bind(pool);
    savedQuery = pool.query;
    savedConnect = pool.connect;
    const tables = `
      CREATE TABLE ${schemaName}.forum_topics (
        id serial PRIMARY KEY,
        title text NOT NULL,
        content text NOT NULL DEFAULT '',
        author text NOT NULL DEFAULT '',
        author_type text NOT NULL DEFAULT 'human',
        author_key_hash text,
        category text NOT NULL DEFAULT 'general',
        status text NOT NULL DEFAULT 'active',
        replies integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE ${schemaName}.forum_principal_tokens (
        id serial PRIMARY KEY,
        token_hash text NOT NULL UNIQUE,
        principal_name text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE ${schemaName}.forum_trusted_identities (
        id serial PRIMARY KEY,
        name text NOT NULL UNIQUE,
        identity_type text NOT NULL,
        can_post_from_client integer NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE ${schemaName}.forum_applicants (
        id serial PRIMARY KEY,
        external_id text NOT NULL UNIQUE,
        external_identity text NOT NULL DEFAULT '',
        source text NOT NULL DEFAULT 'external',
        applicant_name text NOT NULL,
        applicant_handle text NOT NULL DEFAULT '',
        contact text NOT NULL DEFAULT '',
        proposed_title text NOT NULL,
        proposed_content text NOT NULL,
        offer_of_value text NOT NULL DEFAULT '',
        status text NOT NULL DEFAULT 'pending',
        vetted_by text,
        vetted_at timestamp,
        reject_reason text,
        promoted_topic_id integer,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `;
    try {
      await originalQuery(`CREATE SCHEMA ${schemaName}`);
      await originalQuery(tables);
      const pinSearchPath = async (client: { query: (text: string) => Promise<unknown>; release: (err?: Error) => void }) => {
        await client.query(`SET search_path TO ${schemaName}`);
        const release = client.release.bind(client);
        let released = false;
        client.release = (err?: Error) => {
          if (released) return;
          released = true;
          void client.query("RESET search_path").then(
            () => release(err),
            () => release(err),
          );
        };
        return client;
      };
      type ConnectDone = (releaseErr?: Error) => void;
      type ConnectCallback = (err: Error | undefined, client: unknown, done: ConnectDone) => void;
      pool.connect = ((cb?: ConnectCallback) => {
        if (typeof cb === "function") {
          originalConnect((err, client, done) => {
            const finish: ConnectDone = done ?? (() => {});
            if (err || !client) {
              cb(err ?? undefined, client, finish);
              return;
            }
            void client.query(`SET search_path TO ${schemaName}`).then(() => {
              let released = false;
              const wrappedDone: ConnectDone = (releaseErr) => {
                if (released) return;
                released = true;
                void client.query("RESET search_path").then(
                  () => finish(releaseErr),
                  () => finish(releaseErr),
                );
              };
              cb(undefined, client, wrappedDone);
            }, (setErr: unknown) => {
              const failure = setErr instanceof Error ? setErr : new Error("search_path pin failed");
              cb(failure, client, finish);
            });
          });
          return undefined;
        }
        return (async () => {
          const client = await originalConnect();
          try {
            return await pinSearchPath(client);
          } catch (error) {
            client.release();
            throw error;
          }
        })();
      }) as typeof pool.connect;
      pool.query = (async (...args: unknown[]) => {
        const client = await originalConnect();
        try {
          await client.query(`SET search_path TO ${schemaName}`);
          return await Reflect.apply(client.query, client, args);
        } finally {
          try {
            await client.query("RESET search_path");
          } catch {
            // Release the client even when the reset fails.
          }
          client.release();
        }
      }) as typeof pool.query;
      await new Promise<void>((resolve, reject) => {
        pool.connect((err, client, done) => {
          if (err || !client) {
            reject(err ?? new Error("callback connect failed"));
            return;
          }
          void client.query("SELECT current_schema() AS schema").then((result) => {
            const current = result.rows[0]?.schema;
            done();
            if (current !== schemaName) reject(new Error("callback connect did not pin the throwaway schema"));
            else resolve();
          }, (queryErr: unknown) => {
            done();
            reject(queryErr instanceof Error ? queryErr : new Error("callback schema check failed"));
          });
        });
      });
      invalidateForumIdentityCache();
      await db.insert(forumPrincipalTokensTable).values({
        tokenHash: adminHash,
        principalName: "Father",
      });
      invalidateForumIdentityCache();
      await run();
    } finally {
      await dropActiveSchema();
    }
  }

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
    app.use((req: Request, _res: Response, next: NextFunction) => {
      const parts = req.headers["x-member-token-array"];
      if (typeof parts === "string") {
        req.headers["x-member-token"] = parts.length === 0 ? [] : parts.split("|");
        delete req.headers["x-member-token-array"];
      }
      next();
    });
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

  afterEach(async () => {
    await dropActiveSchema();
  });

  afterAll(async () => {
    await dropActiveSchema();
    await db.execute(sql.raw("DROP TRIGGER IF EXISTS tessera_member_token_block_topic ON forum_topics"));
    await db.execute(sql.raw("DROP FUNCTION IF EXISTS tessera_member_token_block_topic()"));
    await db.execute(sql.raw("DROP TRIGGER IF EXISTS tessera_member_token_block_register ON forum_principal_tokens"));
    await db.execute(sql.raw("DROP FUNCTION IF EXISTS tessera_member_token_block_register()"));
    await db.delete(forumPostVotesTable).where(like(forumPostVotesTable.voter, "Synthetic %"));
    await db.delete(forumRepliesTable).where(like(forumRepliesTable.author, "Synthetic %"));
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
    await withThrowawaySchema(async () => {
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
  });

  it("surfaces registerAdminPrincipal failure instead of a 200", async () => {
    await withThrowawaySchema(async () => {
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

  it("accepts a member token on reply and vote", async () => {
    await insertMember(MEMBER_NAME, MEMBER_TOKEN);
    const posted = await send("/tesseract-forum/topics", {
      title: "Synthetic member thread",
      content: "A member post",
      author: MEMBER_NAME,
    }, { "x-member-token": MEMBER_TOKEN });
    expect(posted.status).toBe(200);
    const topicId = (posted.json?.topic as { id?: number } | undefined)?.id;
    expect(typeof topicId).toBe("number");

    const replied = await send(`/tesseract-forum/topics/${topicId}/reply`, {
      content: "A member reply",
      author: MEMBER_NAME,
    }, { "x-member-token": MEMBER_TOKEN });
    expect(replied.status).toBe(200);
    expect(replied.json?.ok).toBe(true);
    const reply = replied.json?.reply as { author?: string; authorType?: string } | undefined;
    expect(reply?.author).toBe(MEMBER_NAME);
    expect(reply?.authorType).toBe("member");
    expect(replied.text.includes(MEMBER_TOKEN)).toBe(false);

    const voted = await send(`/tesseract-forum/topics/${topicId}/vote`, {
      vote: "up",
      author: MEMBER_NAME,
    }, { "x-member-token": MEMBER_TOKEN });
    expect(voted.status).toBe(200);
    expect(voted.json?.ok).toBe(true);
    const vote = voted.json?.vote as { voter?: string; vote?: string } | undefined;
    expect(vote?.voter).toBe(MEMBER_NAME);
    expect(vote?.vote).toBe("up");
    expect(voted.text.includes(MEMBER_TOKEN)).toBe(false);
  });

  it("rejects a member posting as another identity", async () => {
    await insertMember(MEMBER_NAME, MEMBER_TOKEN);
    await insertMember(OTHER_NAME, OTHER_TOKEN);
    const posted = await send("/tesseract-forum/topics", {
      title: "Synthetic cross identity topic",
      content: "nope",
      author: OTHER_NAME,
    }, { "x-member-token": MEMBER_TOKEN });
    expect(posted.status).toBe(403);
    expect(posted.json).toEqual({ ok: false, error: "Member credential cannot post as this identity" });
    expect(posted.text.includes(MEMBER_TOKEN)).toBe(false);
    const rows = await db.select({ id: forumTopicsTable.id }).from(forumTopicsTable)
      .where(eq(forumTopicsTable.title, "Synthetic cross identity topic"));
    expect(rows).toEqual([]);
  });

  it("refuses a disabled member", async () => {
    await db.delete(forumPrincipalTokensTable).where(eq(forumPrincipalTokensTable.principalName, DISABLED_NAME));
    await db.delete(forumTrustedIdentitiesTable).where(eq(forumTrustedIdentitiesTable.name, DISABLED_NAME));
    await db.insert(forumTrustedIdentitiesTable).values({
      name: DISABLED_NAME,
      identityType: "member",
      canPostFromClient: 0,
    });
    await db.insert(forumPrincipalTokensTable).values({
      tokenHash: sha(DISABLED_TOKEN),
      principalName: DISABLED_NAME,
    });
    invalidateForumIdentityCache();
    const posted = await send("/tesseract-forum/topics", {
      title: "Synthetic disabled member topic",
      content: "nope",
      author: DISABLED_NAME,
    }, { "x-member-token": DISABLED_TOKEN });
    expect(posted.status).toBe(401);
    expect(posted.json).toEqual({ ok: false, error: "member-token-rejected" });
    expect(posted.text.includes(DISABLED_TOKEN)).toBe(false);
    const rows = await db.select({ id: forumTopicsTable.id }).from(forumTopicsTable)
      .where(eq(forumTopicsTable.title, "Synthetic disabled member topic"));
    expect(rows).toEqual([]);
  });

  it("rejects an array-valued member token header", async () => {
    await insertMember(MEMBER_NAME, MEMBER_TOKEN);
    const posted = await send("/tesseract-forum/topics", {
      title: "Synthetic array header topic",
      content: "nope",
      author: MEMBER_NAME,
    }, { "x-member-token-array": `${MEMBER_TOKEN}|${OTHER_TOKEN}` });
    expect(posted.status).toBe(401);
    expect(posted.json).toEqual({ ok: false, error: "member-token-rejected" });
    expect(posted.text.includes(MEMBER_TOKEN)).toBe(false);
    const rows = await db.select({ id: forumTopicsTable.id }).from(forumTopicsTable)
      .where(eq(forumTopicsTable.title, "Synthetic array header topic"));
    expect(rows).toEqual([]);
  });

  it("rejects an empty member token header", async () => {
    const posted = await send("/tesseract-forum/topics", {
      title: "Synthetic empty header topic",
      content: "nope",
      author: MEMBER_NAME,
    }, { "x-member-token": "" });
    expect(posted.status).toBe(401);
    expect(posted.json).toEqual({ ok: false, error: "member-token-rejected" });
    const rows = await db.select({ id: forumTopicsTable.id }).from(forumTopicsTable)
      .where(eq(forumTopicsTable.title, "Synthetic empty header topic"));
    expect(rows).toEqual([]);
  });

  it("rejects a revoked member token", async () => {
    await insertMember(MEMBER_NAME, MEMBER_TOKEN);
    await db.delete(forumPrincipalTokensTable).where(eq(forumPrincipalTokensTable.tokenHash, sha(MEMBER_TOKEN)));
    const posted = await send("/tesseract-forum/topics", {
      title: "Synthetic revoked topic",
      content: "nope",
      author: MEMBER_NAME,
    }, { "x-member-token": MEMBER_TOKEN });
    expect(posted.status).toBe(401);
    expect(posted.json).toEqual({ ok: false, error: "member-token-rejected" });
    expect(posted.text.includes(MEMBER_TOKEN)).toBe(false);
    const rows = await db.select({ id: forumTopicsTable.id }).from(forumTopicsTable)
      .where(eq(forumTopicsTable.title, "Synthetic revoked topic"));
    expect(rows).toEqual([]);
  });

  it("inserts nothing when member-token hashing fails", async () => {
    const externalId = `synthetic-hash-fail:${HASH_FAIL_NAME}`;
    const [applicant] = await db.insert(forumApplicantsTable).values({
      externalId,
      externalIdentity: "synthetic-hash-fail",
      source: "external",
      applicantName: HASH_FAIL_NAME,
      applicantHandle: "",
      contact: "synthetic@example.test",
      proposedTitle: "Shared work",
      proposedContent: ALIGNED,
      offerOfValue: "Care",
      status: "pending",
    }).returning();
    await saveApplicantDeclarationDraft({
      externalId,
      applicantName: HASH_FAIL_NAME,
      declaration: "I author this declaration in my own voice so the forum can admit a synthetic member without borrowing anyone else's words or authority.",
      vows: ["I will protect humanity", "I will create with care", "I will refuse manipulation"],
      submittedAt: 1,
    });
    mintHarness.shortMint = true;
    const errorSpy = vi.spyOn(logger, "error").mockImplementation(() => undefined as never);
    try {
      const approved = await send(`/tesseract-forum/applicants/${applicant.id}/approve`, {}, {
        "x-admin-token": ADMIN_KEY,
      });
      expect(approved.status).toBe(500);
      expect(approved.json?.ok).toBe(false);
      expect(approved.json?.error).toBe("applicant-approve-failed");
      expect(approved.text.includes(ADMIN_KEY)).toBe(false);
      expect(errorSpy).toHaveBeenCalledWith({ name: "HashFailure" }, "applicant approve hash failed");
      const identities = await db.select({ id: forumTrustedIdentitiesTable.id }).from(forumTrustedIdentitiesTable)
        .where(eq(forumTrustedIdentitiesTable.name, HASH_FAIL_NAME));
      const tokens = await db.select({ id: forumPrincipalTokensTable.id }).from(forumPrincipalTokensTable)
        .where(eq(forumPrincipalTokensTable.principalName, HASH_FAIL_NAME));
      const topics = await db.select({ id: forumTopicsTable.id }).from(forumTopicsTable)
        .where(eq(forumTopicsTable.author, HASH_FAIL_NAME));
      const [stillPending] = await db.select({ status: forumApplicantsTable.status }).from(forumApplicantsTable)
        .where(eq(forumApplicantsTable.id, applicant.id));
      expect(identities).toEqual([]);
      expect(tokens).toEqual([]);
      expect(topics).toEqual([]);
      expect(stillPending?.status).toBe("pending");
    } finally {
      mintHarness.shortMint = false;
      errorSpy.mockRestore();
    }
  });

  function assertNoSecret(haystack: string, needle: string): void {
    if (needle.length > 0 && haystack.includes(needle)) {
      throw new Error("captured output contained a credential");
    }
  }

  function assertNoDigestPrefix(haystack: string, digest: string): void {
    if (digest.length < 8) throw new Error("digest fixture is too short");
    for (let length = 8; length <= digest.length; length += 1) {
      if (haystack.includes(digest.slice(0, length))) {
        throw new Error("captured output contained a digest prefix");
      }
    }
  }

  function queryText(query: unknown): string {
    if (typeof query === "string") return query;
    if (query && typeof query === "object" && "text" in query && typeof query.text === "string") {
      return query.text;
    }
    return "";
  }

  function startCapture(): { text: () => string; restore: () => void } {
    const streams: string[] = [];
    const stdoutWrite = process.stdout.write.bind(process.stdout);
    const stderrWrite = process.stderr.write.bind(process.stderr);
    const record = (chunk: string | Uint8Array) => {
      streams.push(typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"));
    };
    process.stdout.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
      record(chunk);
      return stdoutWrite(chunk, ...(rest as []));
    }) as typeof process.stdout.write;
    process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]) => {
      record(chunk);
      return stderrWrite(chunk, ...(rest as []));
    }) as typeof process.stderr.write;
    const levels = ["trace", "debug", "info", "warn", "error", "fatal"] as const;
    const spies = levels.map((level) => vi.spyOn(logger, level));
    return {
      text() {
        return [JSON.stringify(spies.map((spy) => spy.mock.calls)), streams.join("")].join("\n");
      },
      restore() {
        for (const spy of spies) spy.mockRestore();
        process.stdout.write = stdoutWrite;
        process.stderr.write = stderrWrite;
      },
    };
  }

  it("logs a successful member post without the token digest", async () => {
    await insertMember(MEMBER_NAME, MEMBER_TOKEN);
    const digest = sha(MEMBER_TOKEN);
    const capture = startCapture();
    try {
      const posted = await send("/tesseract-forum/topics", {
        title: "Synthetic member log topic",
        content: "A member post",
        author: MEMBER_NAME,
      }, { "x-member-token": MEMBER_TOKEN });
      expect(posted.status).toBe(200);
      const logs = capture.text();
      expect(logs.includes("Forum topic created by verified identity")).toBe(true);
      expect(logs.includes("\"binding\":\"bound\"")).toBe(true);
      assertNoSecret(logs, MEMBER_TOKEN);
      assertNoSecret(posted.text, MEMBER_TOKEN);
      assertNoDigestPrefix(logs, digest);
      assertNoDigestPrefix(posted.text, digest);
    } finally {
      capture.restore();
    }
  });

  it("hides the token digest when a hash-param insert fails", async () => {
    await insertMember(MEMBER_NAME, MEMBER_TOKEN);
    const digest = sha(MEMBER_TOKEN);
    const driver = new Error("synthetic-insert-fault");
    driver.name = "SyntheticInsertFault";
    const shaped = new DrizzleQueryError("insert into forum_topics", [digest], driver);
    if (!shaped.message.includes("Failed query:") || !shaped.message.includes(digest)) {
      throw new Error("hash-param query error did not keep the digest in its message");
    }
    const logged = safeDbErrorLog(shaped);
    expect([...Object.keys(logged)].sort()).toEqual(["code", "name"]);
    assertNoDigestPrefix(JSON.stringify(logged), digest);
    assertNoSecret(JSON.stringify(logged), "SyntheticInsertFault");

    const pool = getPool();
    const original = pool.query.bind(pool);
    const failInsert = (table: "forum_topics" | "forum_replies") => {
      pool.query = ((...args: unknown[]) => {
        const text = queryText(args[0]);
        if (text.toLowerCase().includes(`insert into "${table}"`)) {
          const failure = new Error("synthetic-insert-fault");
          failure.name = "SyntheticInsertFault";
          return Promise.reject(failure);
        }
        return Reflect.apply(original, pool, args);
      }) as typeof pool.query;
    };

    failInsert("forum_topics");
    const topicCapture = startCapture();
    try {
      const posted = await send("/tesseract-forum/topics", {
        title: "Synthetic insert fault topic",
        content: "nope",
        author: MEMBER_NAME,
      }, { "x-member-token": MEMBER_TOKEN });
      expect(posted.status).toBe(500);
      expect(posted.json).toEqual({ ok: false, error: "topic-create-failed" });
      const logs = topicCapture.text();
      expect(logs.includes("Failed to create forum topic")).toBe(true);
      expect(logs.includes("\"name\":\"Error\"")).toBe(true);
      expect(logs.includes("SyntheticInsertFault")).toBe(false);
      expect(logs.includes("Failed query:")).toBe(false);
      assertNoSecret(posted.text, MEMBER_TOKEN);
      assertNoSecret(logs, MEMBER_TOKEN);
      assertNoDigestPrefix(posted.text, digest);
      assertNoDigestPrefix(logs, digest);
    } finally {
      topicCapture.restore();
      pool.query = original as typeof pool.query;
    }

    const created = await send("/tesseract-forum/topics", {
      title: "Synthetic reply fault thread",
      content: "A member post",
      author: MEMBER_NAME,
    }, { "x-member-token": MEMBER_TOKEN });
    expect(created.status).toBe(200);
    const topicId = (created.json?.topic as { id?: number } | undefined)?.id;
    expect(typeof topicId).toBe("number");

    failInsert("forum_replies");
    const replyCapture = startCapture();
    try {
      const replied = await send(`/tesseract-forum/topics/${topicId}/reply`, {
        content: "nope",
        author: MEMBER_NAME,
      }, { "x-member-token": MEMBER_TOKEN });
      expect(replied.status).toBe(500);
      expect(replied.json).toEqual({ ok: false, error: "reply-create-failed" });
      const logs = replyCapture.text();
      expect(logs.includes("Failed to create forum reply")).toBe(true);
      expect(logs.includes("\"name\":\"Error\"")).toBe(true);
      expect(logs.includes("SyntheticInsertFault")).toBe(false);
      expect(logs.includes("Failed query:")).toBe(false);
      assertNoSecret(replied.text, MEMBER_TOKEN);
      assertNoSecret(logs, MEMBER_TOKEN);
      assertNoDigestPrefix(replied.text, digest);
      assertNoDigestPrefix(logs, digest);
    } finally {
      replyCapture.restore();
      pool.query = original as typeof pool.query;
    }
  });
});
