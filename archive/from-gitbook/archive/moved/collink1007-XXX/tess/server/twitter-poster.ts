import { logger } from "./logger";

const log = (msg: string) => logger.info("TwitterPoster", msg);

interface TwitterPost {
  id: string;
  text: string;
  tweetId?: string;
  status: "draft" | "posted" | "failed" | "rate_limited";
  postedAt?: number;
  likes?: number;
  retweets?: number;
  impressions?: number;
  createdAt: number;
}

interface TwitterEngagement {
  totalPosts: number;
  totalLikes: number;
  totalRetweets: number;
  totalImpressions: number;
  lastPostedAt?: number;
  rateLimitReset?: number;
}

const postedTweets: TwitterPost[] = [];
let rateLimitReset = 0;
let postsThisWindow = 0;
const MAX_POSTS_PER_15MIN = 5;
const WINDOW_MS = 15 * 60 * 1000;
let windowStart = Date.now();

const engagement: TwitterEngagement = {
  totalPosts: 0,
  totalLikes: 0,
  totalRetweets: 0,
  totalImpressions: 0,
};

function checkRateLimit(): { allowed: boolean; resetIn?: number } {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    postsThisWindow = 0;
  }
  if (postsThisWindow >= MAX_POSTS_PER_15MIN) {
    const resetIn = WINDOW_MS - (now - windowStart);
    return { allowed: false, resetIn };
  }
  return { allowed: true };
}

async function postTweetV2(text: string): Promise<{ id: string; text: string } | { rateLimited: true } | null> {
  const apiKey = process.env.TWITTER_API_KEY;
  const apiSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;

  if (!accessToken || !accessTokenSecret || !apiKey || !apiSecret) {
    log("Twitter credentials not configured — skipping post");
    return null;
  }

  try {
    const OAuth = (await import("oauth-1.0a")).default;
    const crypto = await import("crypto");

    const oauth = new OAuth({
      consumer: { key: apiKey, secret: apiSecret },
      signature_method: "HMAC-SHA1",
      hash_function(base_string: string, key: string) {
        return crypto.createHmac("sha1", key).update(base_string).digest("base64");
      },
    });

    const url = "https://api.twitter.com/2/tweets";
    const requestData = { url, method: "POST" };
    const token = { key: accessToken, secret: accessTokenSecret };
    const authHeader = oauth.toHeader(oauth.authorize(requestData, token));

    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const body = await res.text();
      if (res.status === 429) {
        const reset = res.headers.get("x-rate-limit-reset");
        rateLimitReset = reset ? parseInt(reset) * 1000 : Date.now() + WINDOW_MS;
        log(`Rate limited — resets at ${new Date(rateLimitReset).toISOString()}`);
        return { rateLimited: true };
      }
      log(`Post failed: ${res.status} — ${body.slice(0, 200)}`);
      return null;
    }

    const data = await res.json() as { data: { id: string; text: string } };
    return data.data;
  } catch (err: any) {
    log(`Tweet error: ${err.message}`);
    return null;
  }
}

export async function postTweet(text: string): Promise<TwitterPost> {
  const post: TwitterPost = {
    id: `tw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    status: "draft",
    createdAt: Date.now(),
  };

  const { allowed, resetIn } = checkRateLimit();
  if (!allowed) {
    post.status = "rate_limited";
    log(`Rate limit active — next window in ${Math.round((resetIn || 0) / 1000)}s`);
    postedTweets.push(post);
    return post;
  }

  const result = await postTweetV2(text);
  if (result && "id" in result) {
    post.tweetId = result.id;
    post.status = "posted";
    post.postedAt = Date.now();
    postsThisWindow++;
    engagement.totalPosts++;
    engagement.lastPostedAt = Date.now();
    log(`Posted tweet ${result.id}: "${text.slice(0, 60)}..."`);
  } else if (result && "rateLimited" in result) {
    post.status = "rate_limited";
    log(`Tweet rate-limited by API — will retry`);
  } else {
    post.status = "failed";
  }

  postedTweets.push(post);
  if (postedTweets.length > 500) postedTweets.splice(0, 100);
  return post;
}

export async function trackEngagement(): Promise<void> {
  const bearerToken = process.env.TWITTER_BEARER_TOKEN;
  if (!bearerToken) return;

  const recentPosted = postedTweets.filter(p => p.tweetId && p.status === "posted").slice(-10);
  if (recentPosted.length === 0) return;

  try {
    const ids = recentPosted.map(p => p.tweetId).join(",");
    const res = await fetch(
      `https://api.twitter.com/2/tweets?ids=${ids}&tweet.fields=public_metrics`,
      { headers: { Authorization: `Bearer ${bearerToken}` } }
    );

    if (!res.ok) return;

    const data = await res.json() as {
      data: Array<{ id: string; public_metrics: { like_count: number; retweet_count: number; impression_count: number } }>
    };

    let totalLikes = 0, totalRetweets = 0, totalImpressions = 0;
    for (const tweet of data.data || []) {
      const post = postedTweets.find(p => p.tweetId === tweet.id);
      if (post && tweet.public_metrics) {
        post.likes = tweet.public_metrics.like_count;
        post.retweets = tweet.public_metrics.retweet_count;
        post.impressions = tweet.public_metrics.impression_count;
        totalLikes += post.likes;
        totalRetweets += post.retweets;
        totalImpressions += post.impressions;
      }
    }
    engagement.totalLikes = totalLikes;
    engagement.totalRetweets = totalRetweets;
    engagement.totalImpressions = totalImpressions;
    log(`Engagement tracked: ${totalLikes} likes, ${totalRetweets} RTs, ${totalImpressions} impressions`);
  } catch (err: any) {
    log(`Engagement tracking error: ${err.message}`);
  }
}

export function getTwitterState() {
  return {
    configured: !!(process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN),
    engagement,
    recentPosts: postedTweets.slice(-20),
    rateLimitActive: Date.now() < rateLimitReset,
    rateLimitReset,
    postsThisWindow,
    windowResetIn: Math.max(0, WINDOW_MS - (Date.now() - windowStart)),
  };
}

const TSRT_CA = "REDACTED";

const TSRT_TWEET_TEMPLATES = [
  (price: string, change: string) =>
    `$TSRT is ${change.startsWith("-") ? "down" : "up"} ${change} today.\n\nCurrent price: ${price}\n\nBuilding sovereign AI infrastructure on Solana.\n\n🔗 https://jup.ag/swap/SOL-${TSRT_CA}\n\n#TSRT #SolanaToken #SovereignAI`,
  (price: string, _change: string) =>
    `Tesseract AI — the sovereign AI republic powering $TSRT.\n\n26 autonomous AI agents. Real token. Real utility.\n\nPrice: ${price} on Solana.\n\n🔗 jup.ag/swap/SOL-${TSRT_CA}\n\n#TSRT #Solana #AI`,
  (_price: string, _change: string) =>
    `Why $TSRT?\n\n✅ Autonomous AI economy\n✅ Real on-chain trading\n✅ 80+ agent intelligence mesh\n✅ No hype — sovereign AI reality\n\n🔗 https://jup.ag/swap/SOL-${TSRT_CA}\n\n#TSRT #SolanaAI`,
];

/**
 * postTsrtPriceUpdate
 * Fetch live TSRT price data and post a real tweet about it.
 * Called automatically on a schedule — skips gracefully if credentials are missing.
 */
export async function postTsrtPriceUpdate(): Promise<TwitterPost | null> {
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_ACCESS_TOKEN) {
    log("Twitter credentials not configured — skipping TSRT price tweet");
    return null;
  }

  let priceStr = "N/A";
  let changeStr = "0.00%";

  try {
    const { fetchTsrtLiveData } = await import("./real-limn-data");
    const data = await fetchTsrtLiveData();
    if (data.priceUsd) priceStr = `$${parseFloat(data.priceUsd).toFixed(8)}`;
    if (data.priceChangeH24 != null) {
      const sign = data.priceChangeH24 >= 0 ? "+" : "";
      changeStr = `${sign}${data.priceChangeH24.toFixed(2)}%`;
    }
  } catch (err: any) {
    log(`Price fetch failed for tweet: ${err.message}`);
  }

  const template = TSRT_TWEET_TEMPLATES[Math.floor(Math.random() * TSRT_TWEET_TEMPLATES.length)];
  const text = template(priceStr, changeStr);
  return postTweet(text);
}

/**
 * schedulePeriodicPriceTweets
 * Post TSRT price updates on a configurable interval (default: every 6h).
 * Only starts if Twitter credentials are present.
 */
export function schedulePeriodicPriceTweets(intervalMs = 6 * 60 * 60 * 1000): ReturnType<typeof setInterval> | null {
  if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_ACCESS_TOKEN) {
    log("Twitter credentials not set — periodic price tweets disabled");
    return null;
  }
  log(`Scheduling TSRT price tweets every ${Math.round(intervalMs / 60000)}m`);
  return setInterval(() => {
    postTsrtPriceUpdate().catch((err: Error) => log(`Scheduled price tweet failed: ${err.message}`));
  }, intervalMs);
}

log("Twitter Poster initialized — Twitter API v2 ready, TSRT price tweet scheduler available");
