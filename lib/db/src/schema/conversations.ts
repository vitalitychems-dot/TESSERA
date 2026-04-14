import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const conversationsTable = pgTable("conversations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull().default("New Chat"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type ConversationRow = typeof conversationsTable.$inferSelect;

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull().default("user"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type MessageRow = typeof messagesTable.$inferSelect;

export const forumTopicsTable = pgTable("forum_topics", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  author: text("author").notNull().default(""),
  authorType: text("author_type").notNull().default("human"),
  authorKeyHash: text("author_key_hash"),
  category: text("category").notNull().default("general"),
  status: text("status").notNull().default("active"),
  replies: integer("replies").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertForumTopicSchema = createInsertSchema(forumTopicsTable).omit({ id: true, createdAt: true, updatedAt: true, replies: true });
export type InsertForumTopic = z.infer<typeof insertForumTopicSchema>;
export type ForumTopicRow = typeof forumTopicsTable.$inferSelect;

export const forumPrincipalTokensTable = pgTable("forum_principal_tokens", {
  id: serial("id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  principalName: text("principal_name").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ForumPrincipalTokenRow = typeof forumPrincipalTokensTable.$inferSelect;

export const forumTrustedIdentitiesTable = pgTable("forum_trusted_identities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  identityType: text("identity_type").notNull(),
  canPostFromClient: integer("can_post_from_client").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ForumTrustedIdentityRow = typeof forumTrustedIdentitiesTable.$inferSelect;

export const forumRepliesTable = pgTable("forum_replies", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull(),
  content: text("content").notNull(),
  author: text("author").notNull(),
  authorType: text("author_type").notNull().default("human"),
  authorKeyHash: text("author_key_hash"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertForumReplySchema = createInsertSchema(forumRepliesTable).omit({ id: true, createdAt: true });
export type InsertForumReply = z.infer<typeof insertForumReplySchema>;
export type ForumReplyRow = typeof forumRepliesTable.$inferSelect;
