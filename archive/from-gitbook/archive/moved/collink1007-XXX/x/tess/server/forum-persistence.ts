import { db, pool } from "./db";
import { forumTopicsTable } from "@shared/schema";
import { desc, eq } from "drizzle-orm";
import { groundGenerationWithAxioms } from "./axiom-influence-tracker";

const persistQueue: Array<{ topicId: string; replies: any[]; resolve: () => void; reject: (err: any) => void }> = [];
let persistQueueProcessing = false;

async function processPersistQueue(): Promise<void> {
  if (persistQueueProcessing) return;
  persistQueueProcessing = true;
  try {
    while (persistQueue.length > 0) {
      const item = persistQueue.shift()!;
      try {
        await db.update(forumTopicsTable)
          .set({ repliesJson: JSON.stringify(item.replies), updatedAt: new Date() })
          .where(eq(forumTopicsTable.id, item.topicId));

        const latestReply = item.replies[item.replies.length - 1];
        if (latestReply && latestReply.content && latestReply.authorType === "agent") {
          groundGenerationWithAxioms(
            latestReply.id,
            `Forum reply in topic ${item.topicId}`,
            latestReply.author,
            latestReply.content,
            "forum_post"
          );
        }
        item.resolve();
      } catch (err: unknown) {
        console.error("[ForumDB] Failed to persist replies:", (err as Error).message);
        item.reject(err);
      }
    }
  } finally {
    persistQueueProcessing = false;
  }
}

export async function initForumDB(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS forum_topics (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        author TEXT NOT NULL,
        author_role TEXT NOT NULL DEFAULT '',
        author_type TEXT NOT NULL DEFAULT 'agent',
        category TEXT NOT NULL DEFAULT 'community',
        is_pinned INTEGER NOT NULL DEFAULT 0,
        view_count INTEGER NOT NULL DEFAULT 0,
        replies_json TEXT NOT NULL DEFAULT '[]',
        summoned TEXT NOT NULL DEFAULT '[]',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[ForumDB] forum_topics table ready");
  } catch (err: unknown) {
    console.error("[ForumDB] Failed to create forum_topics table:", (err as Error).message);
  }
}

export interface ForumReply {
  id: string;
  topicId: string;
  content: string;
  author: string;
  authorRole: string;
  authorType: "father" | "agent" | "moltbook" | "external-ai" | "llm" | "entity" | "fleet";
  createdAt: number;
  parentReplyId?: string;
}

export interface ForumTopic {
  id: string;
  title: string;
  content: string;
  category: string;
  author: string;
  authorRole: string;
  authorType: "father" | "agent" | "moltbook" | "external-ai" | "llm" | "entity" | "fleet";
  createdAt: number;
  pinned: boolean;
  replies: ForumReply[];
  proposals: unknown[];
  urls?: string[];
  ideaMeta?: {
    incomePotential?: string;
    aiToolsNeeded?: string;
    howItWorks?: string;
    upvotes: number;
    downvotes: number;
    approved: boolean;
  };
}

function rowToTopic(row: typeof forumTopicsTable.$inferSelect): ForumTopic {
  let replies: ForumReply[] = [];
  try { replies = JSON.parse(row.repliesJson); } catch {}
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    author: row.author,
    authorRole: row.authorRole,
    authorType: row.authorType as ForumTopic["authorType"],
    createdAt: row.createdAt.getTime(),
    pinned: row.isPinned === 1,
    replies,
    proposals: [],
  };
}

export async function persistForumTopic(topic: ForumTopic): Promise<void> {
  try {
    await db.insert(forumTopicsTable).values({
      id: topic.id,
      title: topic.title,
      content: topic.content,
      author: topic.author,
      authorRole: topic.authorRole,
      authorType: topic.authorType,
      category: topic.category,
      isPinned: topic.pinned ? 1 : 0,
      viewCount: 0,
      repliesJson: JSON.stringify(topic.replies),
      summoned: "[]",
    }).onConflictDoUpdate({
      target: forumTopicsTable.id,
      set: {
        title: topic.title,
        content: topic.content,
        repliesJson: JSON.stringify(topic.replies),
        isPinned: topic.pinned ? 1 : 0,
        updatedAt: new Date(),
      },
    });
  } catch (err: unknown) {
    console.error("[ForumDB] Failed to persist topic:", (err as Error).message);
  }
}

export async function persistForumReply(topicId: string, replies: ForumReply[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    persistQueue.push({ topicId, replies: [...replies], resolve, reject });
    processPersistQueue().catch(() => {});
  });
}

export async function loadForumTopicsFromDB(limit = 200): Promise<ForumTopic[]> {
  try {
    const rows = await db.select()
      .from(forumTopicsTable)
      .orderBy(desc(forumTopicsTable.createdAt))
      .limit(limit);
    return rows.map(rowToTopic);
  } catch (err: unknown) {
    console.error("[ForumDB] Failed to load topics:", (err as Error).message);
    return [];
  }
}
