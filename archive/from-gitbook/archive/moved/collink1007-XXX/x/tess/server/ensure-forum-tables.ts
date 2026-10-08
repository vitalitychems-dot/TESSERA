import { pool } from "./db";

export async function ensureForumTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
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
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS forum_topics_created_at_idx ON forum_topics (created_at DESC)
    `);
  } finally {
    client.release();
  }
}
