import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Request, Response } from "express";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@workspace/db/schema";
import { forumRepliesTable, forumTopicsTable } from "@workspace/db/schema";
import {
  createForumSummonHandler,
  type ForumSummonHandlerDependencies,
} from "../lib/forum-summons";
import { persistForumSummonReplies } from "../lib/forum-summon-persistence";

const testDatabaseUrl = process.env.FORUM_TRANSACTION_TEST_DATABASE_URL;
const postgresDescribe = testDatabaseUrl ? describe : describe.skip;

function validateDisposableDatabaseUrl(raw: string): URL {
  const url = new URL(raw);
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const databaseName = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "::1"].includes(hostname) ||
    !/(?:^|[_-])test(?:$|[_-])/.test(databaseName)
  ) {
    throw new Error("Forum persistence integration tests require a local database with 'test' in its name.");
  }
  return url;
}

interface TestResponseState {
  statusCode: number;
  body: unknown;
}

function makeTestResponse() {
  const state: TestResponseState = { statusCode: 200, body: undefined };
  const response = {
    status(code: number) {
      state.statusCode = code;
      return response;
    },
    json(body: unknown) {
      state.body = body;
      return response;
    },
    setHeader() {
      return response;
    },
  } as unknown as Response;
  return { response, state };
}

postgresDescribe("forum summon persistence on isolated PostgreSQL", () => {
  let adminPool: Pool;
  let testPool: Pool;
  let testDb: ReturnType<typeof drizzle<typeof schema>>;
  let schemaName = "";
  let schemaCreated = false;

  beforeAll(async () => {
    const url = validateDisposableDatabaseUrl(testDatabaseUrl!);
    const connectionString = url.toString();
    adminPool = new Pool({ connectionString, max: 1 });
    schemaName = `forum_summon_test_${randomUUID().replace(/-/g, "")}`;
    await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
    schemaCreated = true;

    testPool = new Pool({
      connectionString,
      max: 1,
      options: `-c search_path=${schemaName}`,
    });
    testDb = drizzle(testPool, { schema });

    await testPool.query(`
      CREATE TABLE forum_topics (
        id integer PRIMARY KEY,
        title text NOT NULL,
        content text NOT NULL DEFAULT '',
        author text NOT NULL DEFAULT '',
        author_type text NOT NULL DEFAULT 'human',
        category text NOT NULL DEFAULT 'general',
        status text NOT NULL DEFAULT 'active',
        replies integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE forum_replies (
        id serial PRIMARY KEY,
        topic_id integer NOT NULL,
        parent_reply_id integer,
        content text NOT NULL,
        author text NOT NULL,
        author_type text NOT NULL DEFAULT 'human',
        author_key_hash text,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE SEQUENCE forum_topic_count_failure_sequence START 1;

      CREATE FUNCTION fail_forum_topic_reply_count() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM nextval('forum_topic_count_failure_sequence');
        RAISE EXCEPTION 'injected topic-count failure for integration test';
      END;
      $$;

      CREATE TRIGGER fail_forum_topic_reply_count_trigger
      BEFORE UPDATE OF replies ON forum_topics
      FOR EACH ROW EXECUTE FUNCTION fail_forum_topic_reply_count();

      INSERT INTO forum_topics (id, title, content) VALUES (71003, 'PostgreSQL rollback test', 'Test topic');
    `);
  });

  afterAll(async () => {
    if (testPool) await testPool.end();
    if (adminPool) {
      if (schemaCreated) await adminPool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      await adminPool.end();
    }
  });

  it("rolls back inserted replies when the topic count update fails and returns no DB details", async () => {
    const replies = [
      { agentName: "Worker A", content: "First reply from the worker." },
      { agentName: "Worker B", content: "Second reply from the worker." },
    ];
    const dependencies: ForumSummonHandlerDependencies = {
      authorize: () => ({ authorized: true }),
      loadTopic: async id => ({
        id,
        title: "PostgreSQL rollback test",
        content: "Test topic",
        category: "general",
      }),
      dispatch: async () => ({
        dispatchId: "postgres-rollback-integration",
        replies,
      }),
      persistReplies: (topicId, dispatchedReplies) =>
        persistForumSummonReplies(topicId, dispatchedReplies, testDb),
    };
    const handler = createForumSummonHandler(dependencies);
    const request = {
      params: { id: "71003" },
      ip: "198.51.100.73",
    } as unknown as Request;
    const { response, state } = makeTestResponse();

    await handler(request, response, () => undefined);

    expect(state.statusCode).toBe(503);
    expect(state.body).toEqual({
      ok: false,
      error: "Forum summon could not be completed. No replies are shown; retry later.",
    });
    expect(JSON.stringify(state.body)).not.toContain("injected topic-count failure");
    expect(JSON.stringify(state.body)).not.toContain(schemaName);

    const [topicRows, replyRows, triggerRows] = await Promise.all([
      testPool.query("SELECT replies FROM forum_topics WHERE id = 71003"),
      testPool.query("SELECT id FROM forum_replies WHERE topic_id = 71003"),
      testPool.query("SELECT last_value::text AS calls FROM forum_topic_count_failure_sequence"),
    ]);
    expect(topicRows.rows).toEqual([{ replies: 0 }]);
    expect(replyRows.rows).toEqual([]);
    expect(triggerRows.rows).toEqual([{ calls: "1" }]);
  });
});
