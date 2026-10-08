import { pgTable, serial, text, integer, timestamp, boolean, index } from "drizzle-orm/pg-core";

export const forumTopics = pgTable("gov_forum_topics", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull().default("improvements"),
  status: text("status").notNull().default("open"),
  createdBy: text("created_by").notNull().default("system"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_gov_forum_topics_status").on(table.status),
  index("idx_gov_forum_topics_category").on(table.category),
]);

export const forumPosts = pgTable("gov_forum_posts", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull(),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  agentRole: text("agent_role").notNull(),
  content: text("content").notNull(),
  proposalTitle: text("proposal_title"),
  proposalDescription: text("proposal_description"),
  buildsOn: integer("builds_on"),
  isFatherComment: boolean("is_father_comment").notNull().default(false),
  isReplyToFather: boolean("is_reply_to_father").notNull().default(false),
  replyToPostId: integer("reply_to_post_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_gov_forum_posts_topic").on(table.topicId),
  index("idx_gov_forum_posts_agent").on(table.agentId),
]);

export const forumVotes = pgTable("gov_forum_votes", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull(),
  proposalPostId: integer("proposal_post_id").notNull(),
  agentId: text("agent_id").notNull(),
  agentName: text("agent_name").notNull(),
  vote: text("vote").notNull(),
  reasoning: text("reasoning").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_gov_forum_votes_topic").on(table.topicId),
  index("idx_gov_forum_votes_proposal").on(table.proposalPostId),
]);

export const forumConclusions = pgTable("gov_forum_conclusions", {
  id: serial("id").primaryKey(),
  topicId: integer("topic_id").notNull(),
  winningProposalPostId: integer("winning_proposal_post_id"),
  winningProposalTitle: text("winning_proposal_title").notNull(),
  voteCount: integer("vote_count").notNull().default(0),
  totalVoters: integer("total_voters").notNull().default(0),
  replitPrompt: text("replit_prompt").notNull(),
  implementationSteps: text("implementation_steps").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_gov_forum_conclusions_topic").on(table.topicId),
]);

export type ForumTopic = typeof forumTopics.$inferSelect;
export type ForumPost = typeof forumPosts.$inferSelect;
export type ForumVote = typeof forumVotes.$inferSelect;
export type ForumConclusion = typeof forumConclusions.$inferSelect;
