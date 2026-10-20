import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import { conversationsTable, messagesTable } from "@workspace/db/schema";
import { createTesseraEvidenceAnswer, serializeTesseraCitations } from "../lib/tessera-knowledge";

describe.skipIf(!process.env.DATABASE_URL)("saved message citation records", () => {
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

  it("saves and reloads the exact supporting records on only their assistant message", async () => {
    const db = drizzle(client);
    const [conversation] = await db.insert(conversationsTable).values({ title: "Citation persistence test" }).returning();
    const answer = createTesseraEvidenceAnswer("What is the exact Planck constant?");
    const citations = serializeTesseraCitations(answer.evidence);
    expect(citations[0]?.trustStatus).toBe("verified");

    const [saved] = await db.insert(messagesTable).values({
      conversationId: conversation.id,
      role: "assistant",
      content: answer.answer,
      citations,
    }).returning();
    await db.insert(messagesTable).values({
      conversationId: conversation.id,
      role: "assistant",
      content: "Unrelated text says verified [1](https://example.com), but has no supporting record.",
    });

    const reloaded = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, conversation.id)).orderBy(messagesTable.id);
    expect(reloaded[0].id).toBe(saved.id);
    expect(reloaded[0].citations).toEqual(citations);
    expect(reloaded[0].citations[0]).toMatchObject({
      sourceUrl: "https://physics.nist.gov/cgi-bin/cuu/Value?h",
      retrievedAt: "2026-10-20T00:00:00.000Z",
      publishedAt: null,
      trustStatus: "verified",
    });
    expect(reloaded[1].citations).toEqual([]);
  });
});
