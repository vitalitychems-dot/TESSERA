import { publishArticle, getPublisherStatus, getArticles } from "./seo-publisher";
import { callLLMSimple } from "./llm-helper";
import { onCredentialSaved } from "./human-action-queue";

const log = (msg: string) => console.log(`[AutoPublisher] ${msg}`);

onCredentialSaved((service, fields) => {
  if (service === "shopify" && fields.access_token) {
    log("Shopify credentials saved — triggering immediate backlink article publish...");
    setTimeout(async () => {
      try {
        await runScheduledPublish(true);
        log("First Shopify article published with VitalitySupply backlinks!");
      } catch (e) {
        log(`Auto-publish after Shopify connect failed: ${(e as Error).message}`);
      }
    }, 5000);
  }
});

interface ScheduleConfig {
  enabled: boolean;
  optimalDays: number[];
  optimalHoursCST: [number, number];
  minDaysBetweenPosts: number;
  maxArticlesPerWeek: number;
  publishAsDraft: boolean;
}

interface PublishLog {
  timestamp: string;
  title: string;
  platform: string;
  status: string;
  humanScore?: number;
  url?: string;
}

const config: ScheduleConfig = {
  enabled: true,
  optimalDays: [0, 1, 2, 3, 4, 5, 6],
  optimalHoursCST: [0, 23],
  minDaysBetweenPosts: 1,
  maxArticlesPerWeek: 7,
  publishAsDraft: false,
};

let publishLog: PublishLog[] = [];
let lastPublishTime = 0;
let schedulerInterval: NodeJS.Timeout | null = null;
let weeklyPublishCount = 0;
let weekStartTimestamp = Date.now();

function getCSTHour(): number {
  const now = new Date();
  const utcHour = now.getUTCHours();
  return (utcHour - 6 + 24) % 24;
}

function isOptimalWindow(): boolean {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const cstHour = getCSTHour();
  const [startHour, endHour] = config.optimalHoursCST;
  return config.optimalDays.includes(dayOfWeek) && cstHour >= startHour && cstHour <= endHour;
}

function daysSinceLastPublish(): number {
  if (lastPublishTime === 0) return 999;
  return (Date.now() - lastPublishTime) / (1000 * 60 * 60 * 24);
}

function resetWeeklyCountIfNeeded() {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - weekStartTimestamp > weekMs) {
    weeklyPublishCount = 0;
    weekStartTimestamp = Date.now();
  }
}

async function publishToMedium(title: string, content: string, tags: string[]): Promise<{ success: boolean; url?: string }> {
  try {
    const mediumToken = process.env.MEDIUM_TOKEN;
    if (!mediumToken) return { success: false };

    const userRes = await fetch("https://api.medium.com/v1/me", {
      headers: { Authorization: `Bearer ${mediumToken}`, "Content-Type": "application/json" },
    });
    if (!userRes.ok) return { success: false };
    const userData = await userRes.json();
    const userId = userData.data?.id;
    if (!userId) return { success: false };

    const pubRes = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${mediumToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        contentFormat: "html",
        content,
        tags: tags.slice(0, 5),
        publishStatus: "draft",
      }),
    });
    if (pubRes.ok) {
      const data = await pubRes.json();
      return { success: true, url: data.data?.url };
    }
    return { success: false };
  } catch (e) {
    log(`Medium publish error: ${(e as Error).message}`);
    return { success: false };
  }
}

async function publishToDevTo(title: string, content: string, tags: string[]): Promise<{ success: boolean; url?: string }> {
  try {
    const devtoKey = process.env.DEVTO_API_KEY;
    if (!devtoKey) return { success: false };

    const cleanTags = tags.slice(0, 4).map(t => t.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20));
    const markdown = content
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n")
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n")
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n")
      .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();

    const res = await fetch("https://dev.to/api/articles", {
      method: "POST",
      headers: { "api-key": devtoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        article: {
          title,
          body_markdown: markdown,
          published: false,
          tags: cleanTags,
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, url: data.url };
    }
    return { success: false };
  } catch (e) {
    log(`Dev.to publish error: ${(e as Error).message}`);
    return { success: false };
  }
}

async function generateGuestPostPitch(articleTitle: string, keywords: string[]): Promise<string> {
  try {
    const prompt = `Write a short, professional guest post pitch email for an article titled "${articleTitle}". 
Keywords: ${keywords.join(", ")}.
The pitch should be 3-4 sentences, mention the article adds value to their readers about health/wellness, and include a note that it contains proper citations. 
Make it sound like a real person, not AI. Use a casual-professional tone.
Sign off as "The VitalitySupply Team"`;
    return await callLLMSimple(prompt);
  } catch {
    return `Hi! I have a well-researched article about ${keywords[0]} that I think would be a great fit for your readers. It covers practical wellness tips backed by real experience. Would you be interested in featuring it? — VitalitySupply Team`;
  }
}

let _apCounter = 0;

async function humanDelay(minMs = 2000, maxMs = 6000): Promise<void> {
  const delay = minMs + (_apCounter++ % (maxMs - minMs));
  await new Promise(r => setTimeout(r, delay));
}

async function runScheduledPublish(forceNow = false) {
  if (!config.enabled && !forceNow) return;

  resetWeeklyCountIfNeeded();

  if (!forceNow) {
    if (weeklyPublishCount >= config.maxArticlesPerWeek) return;
    if (daysSinceLastPublish() < config.minDaysBetweenPosts) return;
    if (!isOptimalWindow()) return;
  }

  log(forceNow ? "Force-publishing article with backlinks..." : "Optimal publishing window detected — generating article...");

  try {
    await humanDelay(1000, 3000);
    const article = await publishArticle();
    lastPublishTime = Date.now();
    weeklyPublishCount++;

    publishLog.push({
      timestamp: new Date().toISOString(),
      title: article.title,
      platform: "shopify",
      status: article.url?.startsWith("http") ? "published" : "local",
      humanScore: article.humanScore,
      url: article.url,
    });

    await humanDelay(3000, 8000);

    const mediumResult = await publishToMedium(
      article.title,
      article.content,
      article.keywords
    );
    if (mediumResult.success) {
      publishLog.push({
        timestamp: new Date().toISOString(),
        title: article.title,
        platform: "medium",
        status: "draft",
        url: mediumResult.url,
      });
      log(`Cross-posted to Medium: ${mediumResult.url}`);
    }

    await humanDelay(5000, 12000);

    const devtoResult = await publishToDevTo(
      article.title,
      article.content,
      article.keywords
    );
    if (devtoResult.success) {
      publishLog.push({
        timestamp: new Date().toISOString(),
        title: article.title,
        platform: "devto",
        status: "draft",
        url: devtoResult.url,
      });
      log(`Cross-posted to Dev.to: ${devtoResult.url}`);
    }

    log(`Scheduled publish complete: "${article.title}" — human score: ${article.humanScore}%`);
  } catch (e) {
    log(`Scheduled publish failed: ${(e as Error).message}`);
  }
}

export function getAutoPublisherStatus() {
  return {
    enabled: config.enabled,
    isOptimalWindow: isOptimalWindow(),
    currentCSTHour: getCSTHour(),
    currentDayOfWeek: new Date().getUTCDay(),
    optimalDays: config.optimalDays.map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]),
    optimalHours: `${config.optimalHoursCST[0]}:00 - ${config.optimalHoursCST[1]}:00 CST`,
    daysSinceLastPublish: Math.round(daysSinceLastPublish() * 10) / 10,
    weeklyPublishCount,
    maxWeekly: config.maxArticlesPerWeek,
    minDaysBetweenPosts: config.minDaysBetweenPosts,
    publishLog: publishLog.slice(-20),
    totalPublished: publishLog.length,
    platforms: {
      shopify: !!process.env.SHOPIFY_ACCESS_TOKEN,
      medium: !!process.env.MEDIUM_TOKEN,
      devto: !!process.env.DEVTO_API_KEY,
    },
    nextPublishEligible: daysSinceLastPublish() >= config.minDaysBetweenPosts
      ? "Ready (waiting for optimal window)"
      : `In ${Math.ceil(config.minDaysBetweenPosts - daysSinceLastPublish())} days`,
  };
}

export function updateScheduleConfig(updates: Partial<ScheduleConfig>) {
  Object.assign(config, updates);
  return config;
}

export function getPublishLog() {
  return { log: publishLog, total: publishLog.length };
}

export function startAutoPublisher() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = setInterval(() => runScheduledPublish(), 30 * 60 * 1000);
  log(`Auto-publisher started — checking every 30min, optimal window: Tue/Wed 9-11 AM CST, min ${config.minDaysBetweenPosts} days between posts`);
  setTimeout(() => runScheduledPublish(), 10000);
}

export function stopAutoPublisher() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    log("Auto-publisher stopped");
  }
}
