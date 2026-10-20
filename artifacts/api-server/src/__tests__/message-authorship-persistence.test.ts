import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { conversationsTable, messagesTable, type StoredMessageAuthorship } from "@workspace/db/schema";

describe.skipIf(!process.env.DATABASE_URL)("saved reply authorship", () => {
  let pool: pg.Pool;
  let client: pg.PoolClient;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
    client = await pool.connect();
    await client.query("BEGIN");
  });

  afterAll(async () => {
    if (client) {
      await client.query("ROLLBACK");
      client.release();
    }
    if (pool) await pool.end();
  });

  it("keeps distinct model/local/application authors and leaves old rows unknown", async () => {
    const db = drizzle(client);
    const [conversation] = await db.insert(conversationsTable)
      .values({ title: "Authorship persistence test" }).returning();
    const authors: StoredMessageAuthorship[] = [
      { authorRole: "model-authored", author: "Tessera Pen", model: "provider/model-2026", provenance: "retrieved-evidence" },
      { authorRole: "local", author: "Tessera", model: null, reason: "local-logic" },
      { authorRole: "local-fallback", author: "Tessera", model: null, reason: "provider-unavailable" },
      { authorRole: "application-result", author: "Application", model: null, reason: "tool-result" },
      { authorRole: "unattributed", author: "Provider", model: null },
    ];
    for (const authorship of authors) {
      await db.insert(messagesTable).values({
        conversationId: conversation.id, role: "assistant", content: "Test reply", authorship,
      });
    }
    await db.insert(messagesTable).values({
      conversationId: conversation.id, role: "assistant",
      content: "Legacy text mentions a model but has no structured record.",
    });
    const reopened = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, conversation.id)).orderBy(messagesTable.id);
    expect(reopened.slice(0, authors.length).map(message => message.authorship)).toEqual(authors);
    expect(reopened[authors.length].authorship).toBeNull();
    expect(reopened[0].authorship?.model).toBe("provider/model-2026");
    expect(reopened.slice(1).every(message => !message.authorship?.model)).toBe(true);
  });
});
