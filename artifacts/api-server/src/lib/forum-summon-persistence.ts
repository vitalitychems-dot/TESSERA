import { db } from "@workspace/db";
import { forumRepliesTable, forumTopicsTable } from "@workspace/db/schema";
import { sql, eq } from "drizzle-orm";
import type { ForumWorkerReply } from "./forum-summons";

export async function persistForumSummonReplies(
  topicId: number,
  replies: ForumWorkerReply[],
  database: typeof db = db,
) {
  if (replies.length === 0) return [];

  return database.transaction(async (tx) => {
    const inserted = await tx.insert(forumRepliesTable).values(replies.map(reply => ({
      topicId,
      parentReplyId: null,
      content: reply.content,
      author: reply.agentName,
      authorType: reply.agentName === "Local Evidence Worker" ? "system" : "agent",
      authorKeyHash: null,
    }))).returning();

    if (inserted.length > 0) {
      await tx.update(forumTopicsTable)
        .set({
          replies: sql`${forumTopicsTable.replies} + ${inserted.length}`,
          updatedAt: new Date(),
        })
        .where(eq(forumTopicsTable.id, topicId));
    }

    return inserted.map(({ authorKeyHash: _authorKeyHash, ...reply }) => reply);
  });
}
