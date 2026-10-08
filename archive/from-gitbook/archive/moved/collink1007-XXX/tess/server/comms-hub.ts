/**
 * Communications Hub — Phase 4 Realification
 *
 * Unified entry-point that wires together all five real communication
 * channels:
 *   1. Blog persistence (PostgreSQL) + RSS feed
 *   2. Twitter/X API v2 posting
 *   3. Discord bot (/price, /status)
 *   4. Email alerts via SendGrid (+ SMTP fallback)
 *   5. Webhook dispatcher (HMAC-signed, retry-backed, DB-tracked)
 *
 * Call `initCommsHub()` once at server start.  All subsystems are then
 * independently reachable through their own exports AND through the
 * unified `getCommsHubStatus()` snapshot.
 */

import { logger } from "./logger";

const log = (msg: string) => logger.info("CommsHub", msg);

// ── subsystem status snapshots ────────────────────────────────────────────────

export interface ChannelStatus {
  name: string;
  configured: boolean;
  healthy: boolean;
  details: Record<string, unknown>;
  lastCheckedAt: number;
}

const channelMap = new Map<string, ChannelStatus>();

function setChannel(name: string, configured: boolean, healthy: boolean, details: Record<string, unknown>): void {
  channelMap.set(name, { name, configured, healthy, details, lastCheckedAt: Date.now() });
}

// ── 1. Blog Engine / RSS ──────────────────────────────────────────────────────

export async function checkBlogChannel(): Promise<ChannelStatus> {
  try {
    const { loadBlogPostsFromDb, getBlogStats } = await import("./blog-engine");
    const [posts, stats] = await Promise.all([loadBlogPostsFromDb(), getBlogStats()]);
    const configured = true;
    const healthy = Array.isArray(posts);
    const details = {
      dbPostCount: posts.length,
      totalGenerated: stats.total,
      totalWordCount: stats.totalWordCount,
      status: stats.running ? "running" : "idle",
      rssEndpoint: "/feed.xml",
      seoEndpoint: "/api/blog/posts",
    };
    setChannel("blog", configured, healthy, details);
    return channelMap.get("blog")!;
  } catch (err: any) {
    const s: ChannelStatus = { name: "blog", configured: false, healthy: false, details: { error: err.message }, lastCheckedAt: Date.now() };
    channelMap.set("blog", s);
    return s;
  }
}

// ── 2. Twitter / X ───────────────────────────────────────────────────────────

export async function checkTwitterChannel(): Promise<ChannelStatus> {
  try {
    const { getTwitterState } = await import("./twitter-poster");
    const state = getTwitterState();
    const details = {
      credentialsSet: state.configured,
      totalPosted: state.engagement.totalPosts,
      totalLikes: state.engagement.totalLikes,
      totalRetweets: state.engagement.totalRetweets,
      totalImpressions: state.engagement.totalImpressions,
      rateLimitActive: state.rateLimitActive,
      postsThisWindow: state.postsThisWindow,
      recentPostCount: state.recentPosts.length,
    };
    setChannel("twitter", state.configured, state.configured, details);
    return channelMap.get("twitter")!;
  } catch (err: any) {
    const s: ChannelStatus = { name: "twitter", configured: false, healthy: false, details: { error: err.message }, lastCheckedAt: Date.now() };
    channelMap.set("twitter", s);
    return s;
  }
}

// ── 3. Discord Bot ───────────────────────────────────────────────────────────

export async function checkDiscordChannel(): Promise<ChannelStatus> {
  try {
    const { getDiscordBotStats } = await import("./discord-bot");
    const stats = getDiscordBotStats();
    const configured = !!(process.env.DISCORD_BOT_TOKEN);
    const details = {
      credentialsSet: configured,
      botConnected: stats.connected,
      guildCount: stats.guildCount,
      commandsRegistered: stats.commandsRegistered,
      commandsHandled: stats.commandsHandled,
      uptimeMs: stats.uptime,
      webhookFallback: "/api/discord/interactions",
    };
    setChannel("discord", configured, configured ? stats.connected : true, details);
    return channelMap.get("discord")!;
  } catch (err: any) {
    const s: ChannelStatus = { name: "discord", configured: false, healthy: false, details: { error: err.message }, lastCheckedAt: Date.now() };
    channelMap.set("discord", s);
    return s;
  }
}

// ── 4. Alert Email ───────────────────────────────────────────────────────────

export async function checkEmailChannel(): Promise<ChannelStatus> {
  try {
    const { getAlertEmailStats } = await import("./alert-email");
    const stats = getAlertEmailStats();
    const configured = stats.configured.sendgrid || stats.configured.smtp;
    const details = {
      sendgridConfigured: stats.configured.sendgrid,
      smtpConfigured: stats.configured.smtp,
      alertRecipient: stats.recipient,
      totalAlerts: stats.alertsTotal,
      alertsSent: stats.alertsSent,
      alertsFailed: stats.alertsFailed,
      deduplication: "15-minute window",
    };
    setChannel("email", configured, true, details);
    return channelMap.get("email")!;
  } catch (err: any) {
    const s: ChannelStatus = { name: "email", configured: false, healthy: false, details: { error: err.message }, lastCheckedAt: Date.now() };
    channelMap.set("email", s);
    return s;
  }
}

// ── 5. Webhook Dispatcher ────────────────────────────────────────────────────

export async function checkWebhookChannel(): Promise<ChannelStatus> {
  try {
    const { getWebhookStats } = await import("./webhook-dispatcher");
    const stats = getWebhookStats();
    const details = {
      endpointsActive: stats.endpoints.filter(e => e.active).length,
      endpointsTotal: stats.endpoints.length,
      deliveriesTotal: stats.deliveries.total,
      deliveriesSuccess: stats.deliveries.delivered,
      deliveriesFailed: stats.deliveries.failed,
      deliveriesPending: stats.deliveries.pending + stats.deliveries.retrying,
      signing: "HMAC-SHA256 (X-Tessera-Signature)",
      retryPolicy: "5 attempts, exponential backoff with jitter",
      persistence: "PostgreSQL webhook_deliveries",
    };
    setChannel("webhook", true, true, details);
    return channelMap.get("webhook")!;
  } catch (err: any) {
    const s: ChannelStatus = { name: "webhook", configured: true, healthy: false, details: { error: err.message }, lastCheckedAt: Date.now() };
    channelMap.set("webhook", s);
    return s;
  }
}

// ── Unified snapshot ─────────────────────────────────────────────────────────

export async function getCommsHubStatus(): Promise<{
  healthy: boolean;
  configuredCount: number;
  totalChannels: number;
  channels: ChannelStatus[];
  summary: string;
}> {
  const [blog, twitter, discord, email, webhook] = await Promise.all([
    checkBlogChannel(),
    checkTwitterChannel(),
    checkDiscordChannel(),
    checkEmailChannel(),
    checkWebhookChannel(),
  ]);

  const channels = [blog, twitter, discord, email, webhook];
  const configuredCount = channels.filter(c => c.configured).length;
  const healthy = channels.every(c => c.healthy);

  const summary = channels.map(c => `${c.name}:${c.configured ? "✓" : "✗"}`).join(" | ");

  return { healthy, configuredCount, totalChannels: channels.length, channels, summary };
}

// ── Event hooks ──────────────────────────────────────────────────────────────
//
// Subsystems call these when significant events occur so that webhooks and
// (optionally) Discord alerts fire automatically.

export async function onBlogPostPublished(post: { slug: string; title: string; category: string; wordCount: number }): Promise<void> {
  try {
    const { dispatch } = await import("./webhook-dispatcher");
    await dispatch("blog.post.published", {
      slug: post.slug,
      title: post.title,
      category: post.category,
      wordCount: post.wordCount,
      url: `${process.env.SITE_URL || "https://sovereign.ai"}/blog/${post.slug}`,
    });
  } catch (err: any) {
    log(`blog.post.published webhook failed: ${err.message}`);
  }
}

export async function onTweetPosted(tweet: { id: string; text: string; tweetId?: string }): Promise<void> {
  try {
    const { dispatch } = await import("./webhook-dispatcher");
    await dispatch("twitter.tweet.posted", {
      localId: tweet.id,
      tweetId: tweet.tweetId,
      text: tweet.text.slice(0, 280),
      tweetUrl: tweet.tweetId ? `https://x.com/i/web/status/${tweet.tweetId}` : null,
    });
  } catch (err: any) {
    log(`twitter.tweet.posted webhook failed: ${err.message}`);
  }
}

export async function onCriticalAlertSent(alert: { type: string; severity: string; subject: string; recipient: string }): Promise<void> {
  try {
    const { dispatch } = await import("./webhook-dispatcher");
    await dispatch("alert.email.sent", {
      alertType: alert.type,
      severity: alert.severity,
      subject: alert.subject,
      recipient: alert.recipient,
    });
  } catch (err: any) {
    log(`alert.email.sent webhook failed: ${err.message}`);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

export async function initCommsHub(): Promise<void> {
  log("Initialising Phase 4 communications hub…");
  const status = await getCommsHubStatus();
  log(`Channels ready — ${status.configuredCount}/${status.totalChannels} configured`);
  log(`Status: ${status.summary}`);

  const blogCh = status.channels.find(c => c.name === "blog");
  if (blogCh?.healthy) {
    log(`Blog: ${(blogCh.details.dbPostCount as number)} posts in PostgreSQL, RSS at /feed.xml`);
  } else {
    log("Blog: engine up, DB write may need BLOG_* env or first run");
  }

  const twitterCh = status.channels.find(c => c.name === "twitter");
  if (twitterCh?.configured) {
    log("Twitter: OAuth 1.0a v2 credentials present — ready to post");
  } else {
    log("Twitter: set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_TOKEN_SECRET to enable");
  }

  const discordCh = status.channels.find(c => c.name === "discord");
  if (discordCh?.configured) {
    log("Discord: bot token present — /price and /status commands active");
  } else {
    log("Discord: set DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID to enable");
  }

  const emailCh = status.channels.find(c => c.name === "email");
  if (emailCh?.configured) {
    log("Email: provider configured — alerts will be delivered");
  } else {
    log("Email: set SENDGRID_API_KEY (or SMTP_HOST) and ALERT_EMAIL to enable");
  }

  const webhookCh = status.channels.find(c => c.name === "webhook");
  log(`Webhooks: dispatcher running — ${webhookCh?.details.endpointsActive ?? 0} active endpoints, HMAC-SHA256 signing, 5-attempt retry`);
}
