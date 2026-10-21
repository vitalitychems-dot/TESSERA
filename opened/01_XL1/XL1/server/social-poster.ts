import { callLLMSimple } from "./llm-helper";
import { logger } from "./logger";

let rotationIdx = 0;

const log = (msg: string) => logger.info("SocialPoster", msg);

interface SocialPost {
  id: string;
  platform: string;
  content: string;
  hashtags: string[];
  scheduledFor: number;
  postedAt?: number;
  status: "draft" | "scheduled" | "posted" | "failed";
  type: "product" | "educational" | "testimonial" | "behind-scenes" | "promotional" | "engagement";
  engagement: { likes: number; shares: number; comments: number; clicks: number };
}

interface SocialState {
  platforms: number;
  posts: number;
  engagement: number;
  lastCycle: number;
  activePlatforms: string[];
  contentQueue: SocialPost[];
  postedContent: SocialPost[];
  totalReach: number;
  followersGained: number;
}

const socialState: SocialState = {
  platforms: 5,
  posts: 0,
  engagement: 0,
  lastCycle: 0,
  activePlatforms: ["twitter", "instagram", "tiktok", "pinterest", "reddit"],
  contentQueue: [],
  postedContent: [],
  totalReach: 0,
  followersGained: 0,
};

const VITALITY_PRODUCTS = [
  { name: "Daily Vitality Boost", hook: "All-day energy without caffeine crashes" },
  { name: "5-HTP Serotonin Boost", hook: "Better mood and deeper sleep, naturally" },
  { name: "Calm & Thrive Ashwagandha", hook: "KSM-66 clinically proven stress relief" },
  { name: "Bee Pearl Wellness", hook: "Ancient superfood with modern science" },
  { name: "Complete Multivitamin", hook: "Everything your body needs after 40" },
  { name: "Mind Boost Capsules", hook: "Sharper memory and laser focus" },
  { name: "Digestive Boost Blend", hook: "End bloating and gut discomfort" },
  { name: "Keto Power Boost", hook: "Accelerate fat burning naturally" },
];

const POST_TEMPLATES = {
  twitter: [
    "Did you know? {fact}\n\n{hook}\n\n🔗 vitalitysupply.net\n{hashtags}",
    "Your body deserves better.\n\n{hook}\n\nShop clean supplements: vitalitysupply.net\n{hashtags}",
    "{question}\n\nThe answer might surprise you. {fact}\n\n{hashtags}",
    "Real talk about supplements: {insight}\n\nCheck us out → vitalitysupply.net\n{hashtags}",
  ],
  instagram: [
    "✨ {hook} ✨\n\nOur {product} is formulated with premium ingredients for maximum results.\n\n🌿 Clean label\n🇺🇸 Made in USA\n🔬 Science-backed\n\nLink in bio → vitalitysupply.net\n\n{hashtags}",
    "Your wellness journey starts here 🌱\n\n{fact}\n\nThat's why we created {product} — {hook}\n\n{hashtags}",
  ],
  tiktok: [
    "POV: You finally found supplements that actually work 💪\n\n{hook}\n\nTry {product} → vitalitysupply.net\n{hashtags}",
    "Things I wish I knew sooner about {topic}:\n\n1. {fact}\n2. {insight}\n3. {hook}\n\n{hashtags}",
  ],
  pinterest: [
    "{hook} | {product} | Natural Wellness 2026 | vitalitysupply.net\n\n{description}\n\n{hashtags}",
  ],
  reddit: [
    "I've been researching {topic} and found some interesting science.\n\n{fact}\n\n{insight}\n\nHas anyone else tried {topic}? What were your experiences?",
  ],
};

const HEALTH_HASHTAGS = [
  "#wellness", "#supplements", "#naturalhealth", "#healthylifestyle", "#vitality",
  "#ashwagandha", "#5htp", "#nootropics", "#guthealth", "#keto",
  "#mentalhealth", "#stressrelief", "#sleepbetter", "#brainhealth", "#immunesupport",
  "#cleanhealth", "#holistichealth", "#wellnessjourney", "#selfcare", "#healthtips",
];

async function generatePost(platform: string, type: SocialPost["type"]): Promise<SocialPost | null> {
  const product = VITALITY_PRODUCTS[rotationIdx++ % VITALITY_PRODUCTS.length];
  const hashtags = [...HEALTH_HASHTAGS].sort((a, b) => a.localeCompare(b)).slice(0, 5);

  try {
    const prompt = `Write a ${platform} post for a health supplements brand called VitalitySupply. 
Product: ${product.name} - ${product.hook}
Post type: ${type}
Style: Conversational, genuine, NOT AI-sounding. Use natural language like a real person.
NEVER use words like: tapestry, delve, revolutionize, game-changer, unlock, harness, leverage.
Keep it under 280 chars for twitter, under 2000 chars for instagram.
Include a subtle call to action to visit vitalitysupply.net
Return ONLY the post text, nothing else.`;

    const content = await callLLMSimple(prompt, "social-content-gen");
    if (!content || content.length < 20) return null;

    const post: SocialPost = {
      id: `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platform,
      content: content.trim(),
      hashtags,
      scheduledFor: Date.now() + (rotationIdx++ % 3600) * 1000,
      status: "draft",
      type,
      engagement: { likes: 0, shares: 0, comments: 0, clicks: 0 },
    };

    socialState.contentQueue.push(post);
    socialState.posts++;
    log(`Generated ${platform} ${type} post: "${content.substring(0, 50)}..."`);
    return post;
  } catch (e: any) {
    log(`Post generation failed: ${e.message}`);
    return null;
  }
}

export async function runSocialCycle() {
  socialState.lastCycle = Date.now();

  const platforms = ["twitter", "instagram", "reddit"];
  const types: SocialPost["type"][] = ["educational", "product", "engagement"];
  const platform = platforms[rotationIdx++ % platforms.length];
  const type = types[rotationIdx++ % types.length];

  const post = await generatePost(platform, type);

  for (const queued of socialState.contentQueue.filter(p => p.status === "draft" && p.scheduledFor <= Date.now())) {
    queued.status = "not_configured";
    queued.engagement.likes = 0;
    queued.engagement.clicks = 0;
    socialState.postedContent.push(queued);
  }
  socialState.contentQueue = socialState.contentQueue.filter(p => p.status === "draft");

  return { posted: post ? 1 : 0, queued: socialState.contentQueue.length, totalPosts: socialState.posts };
}

export function queueSocialSetupActions() {
  return [
    "Connect Twitter/X API for automated posting",
    "Set up Instagram Business API",
    "Configure Pinterest business account",
    "Join relevant Reddit communities for organic engagement",
    "Create TikTok business account for short-form content",
  ];
}

export function getSocialState() { return socialState; }

export function getContentCalendar() {
  return {
    queue: socialState.contentQueue.slice(0, 20),
    posted: socialState.postedContent.slice(-20),
    stats: {
      totalPosts: socialState.posts,
      totalReach: socialState.totalReach,
      avgEngagement: socialState.postedContent.length > 0
        ? Math.round(socialState.postedContent.reduce((s, p) => s + p.engagement.likes + p.engagement.clicks, 0) / socialState.postedContent.length)
        : 0,
    },
  };
}

let socialInterval: ReturnType<typeof setInterval> | null = null;

export function startSocialEngine() {
  socialInterval = setInterval(async () => {
    await runSocialCycle().catch(() => {});
  }, 180_000);
  log("Social Posting Engine ACTIVE — generating content for 5 platforms");
}
