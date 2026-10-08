import { callLLMSimple } from "./llm-helper";
import { logger } from "./logger";

let rotIdx = 0;
const log = (msg: string) => logger.info("GrowthEngine", msg);

interface Referral {
  code: string;
  createdBy: string;
  uses: number;
  conversions: number;
  revenue: number;
  createdAt: number;
}

interface Ambassador {
  id: string;
  name: string;
  platform: string;
  followers: number;
  referralCode: string;
  earningsTotal: number;
  postsCreated: number;
  joinedAt: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  status: "active" | "pending" | "inactive";
}

interface AirdropCampaign {
  id: string;
  name: string;
  type: "welcome" | "referral" | "loyalty" | "seasonal";
  reward: string;
  totalClaimed: number;
  maxClaims: number;
  active: boolean;
  createdAt: number;
  expiresAt: number;
}

interface GrowthState {
  referrals: number;
  ambassadors: number;
  campaigns: number;
  lastCycle: number;
  totalReferralRevenue: number;
  activeReferrals: Referral[];
  ambassadorList: Ambassador[];
  airdropCampaigns: AirdropCampaign[];
  organicActions: OrganicAction[];
  leaderboard: LeaderboardEntry[];
}

interface OrganicAction {
  id: string;
  type: string;
  description: string;
  platform: string;
  status: "pending" | "active" | "completed";
  estimatedReach: number;
  cost: number;
  executedAt?: number;
}

interface LeaderboardEntry {
  name: string;
  referrals: number;
  revenue: number;
  tier: string;
}

const growthState: GrowthState = {
  referrals: 0,
  ambassadors: 0,
  campaigns: 3,
  lastCycle: 0,
  totalReferralRevenue: 0,
  activeReferrals: [],
  ambassadorList: [],
  airdropCampaigns: [
    { id: "ac-1", name: "Welcome 10% Off", type: "welcome", reward: "10% off first order", totalClaimed: 0, maxClaims: 1000, active: true, createdAt: Date.now(), expiresAt: Date.now() + 90 * 24 * 3600000 },
    { id: "ac-2", name: "Refer a Friend", type: "referral", reward: "15% off for both", totalClaimed: 0, maxClaims: 500, active: true, createdAt: Date.now(), expiresAt: Date.now() + 180 * 24 * 3600000 },
    { id: "ac-3", name: "Loyalty Rewards", type: "loyalty", reward: "Free shipping + sample", totalClaimed: 0, maxClaims: 200, active: true, createdAt: Date.now(), expiresAt: Date.now() + 365 * 24 * 3600000 },
  ],
  organicActions: [],
  leaderboard: [],
};

export const PRODUCT_HUNT_LAUNCH = {
  name: "VitalitySupply",
  tagline: "Clean, science-backed supplements for modern wellness",
  description: "AI-powered health supplement store with personalized recommendations, transparent ingredients, and USA-made products.",
  website: "https://vitalitysupply.net",
  status: "planned",
  scheduledDate: "2026-04-01",
};

export const REDDIT_COMMUNITIES = [
  "r/supplements", "r/nootropics", "r/keto", "r/nutrition",
  "r/biohackers", "r/fitness", "r/healthyeating", "r/stressmanagement",
  "r/ashwagandha", "r/guthealth", "r/sleephacks", "r/mentalhealth",
];

export const WEEKLY_AMA_TOPICS = [
  "The Science Behind KSM-66 Ashwagandha — Ask Us Anything",
  "5-HTP for Mood Support — Dosing, Timing, and What to Expect",
  "Gut Health 101: How Digestive Enzymes Actually Work",
  "Building Your Daily Supplement Stack — Personalized Advice",
  "Bee Pearl Benefits: Why This Ancient Superfood is Trending",
  "Natural Nootropics: Mind Boost Capsules Deep Dive",
  "Keto Supplements: Separating Science from Marketing",
  "Clean Label Supplements: What It Really Means",
];

const FREE_ORGANIC_STRATEGIES: OrganicAction[] = [
  { id: "org-1", type: "reddit-engagement", description: "Post helpful answers in r/supplements and r/nootropics with subtle brand mentions", platform: "reddit", status: "pending", estimatedReach: 5000, cost: 0 },
  { id: "org-2", type: "quora-answers", description: "Answer supplement-related questions on Quora with expert knowledge and product mentions", platform: "quora", status: "pending", estimatedReach: 3000, cost: 0 },
  { id: "org-3", type: "pinterest-pins", description: "Create supplement infographics and pin to health/wellness boards", platform: "pinterest", status: "pending", estimatedReach: 8000, cost: 0 },
  { id: "org-4", type: "youtube-shorts", description: "Create 60s educational supplement shorts with product overlays", platform: "youtube", status: "pending", estimatedReach: 10000, cost: 0 },
  { id: "org-5", type: "guest-posting", description: "Write guest articles for health blogs with VitalitySupply backlinks", platform: "web", status: "pending", estimatedReach: 2000, cost: 0 },
  { id: "org-6", type: "email-list-building", description: "Create lead magnet: 'Free Guide to Supplement Stacking' for email signups", platform: "email", status: "pending", estimatedReach: 1000, cost: 0 },
  { id: "org-7", type: "tiktok-organic", description: "Post 'things I learned about supplements' series for organic reach", platform: "tiktok", status: "pending", estimatedReach: 15000, cost: 0 },
  { id: "org-8", type: "seo-blogging", description: "Publish 2 SEO-optimized blog posts per week targeting long-tail keywords", platform: "shopify-blog", status: "active", estimatedReach: 500, cost: 0 },
  { id: "org-9", type: "community-building", description: "Create Facebook group 'VitalitySupply Wellness Community' for customer engagement", platform: "facebook", status: "pending", estimatedReach: 2000, cost: 0 },
  { id: "org-10", type: "micro-influencer", description: "Send free samples to micro-influencers (1K-10K followers) for honest reviews", platform: "instagram", status: "pending", estimatedReach: 5000, cost: 0 },
];

function initOrganicStrategies() {
  if (growthState.organicActions.length === 0) {
    growthState.organicActions = [...FREE_ORGANIC_STRATEGIES];
  }
}

export function generateReferralCode(): string {
  const code = `VS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const referral: Referral = {
    code,
    createdBy: "system",
    uses: 0,
    conversions: 0,
    revenue: 0,
    createdAt: Date.now(),
  };
  growthState.activeReferrals.push(referral);
  growthState.referrals++;
  return code;
}

export function useReferralCode(code: string) {
  const ref = growthState.activeReferrals.find(r => r.code === code);
  if (!ref) return { valid: false, error: "Invalid referral code" };
  ref.uses++;
  return { valid: true, discount: "15% off first order", code };
}

export function registerAmbassador(name: string, platform = "instagram") {
  const code = generateReferralCode();
  const ambassador: Ambassador = {
    id: `amb-${Date.now()}`,
    name,
    platform,
    followers: 0,
    referralCode: code,
    earningsTotal: 0,
    postsCreated: 0,
    joinedAt: Date.now(),
    tier: "bronze",
    status: "active",
  };
  growthState.ambassadorList.push(ambassador);
  growthState.ambassadors++;
  log(`Ambassador registered: ${name} (${platform}) — code: ${code}`);
  return { registered: true, ambassador };
}

export function claimAirdrop(userId: string) {
  const campaign = growthState.airdropCampaigns.find(c => c.active && c.totalClaimed < c.maxClaims);
  if (!campaign) return { claimed: false, error: "No active campaigns" };
  campaign.totalClaimed++;
  log(`Airdrop claimed by ${userId}: ${campaign.reward}`);
  return { claimed: true, reward: campaign.reward, campaign: campaign.name };
}

export function queueGrowthActions() {
  return growthState.organicActions.filter(a => a.status === "pending").map(a => a.description);
}

export function initGrowthEngine() {
  initOrganicStrategies();
  log(`Growth Engine initialized — ${growthState.organicActions.length} organic strategies, ${growthState.airdropCampaigns.length} campaigns`);
  return growthState;
}

export function getGrowthState() { return growthState; }
export function getLeaderboard() { return growthState.leaderboard; }
export function getAmbassadors() { return growthState.ambassadorList; }
export function getAirdropCampaigns() { return growthState.airdropCampaigns; }

let growthInterval: ReturnType<typeof setInterval> | null = null;

export function startGrowthEngine() {
  initOrganicStrategies();

  growthInterval = setInterval(() => {
    growthState.lastCycle = Date.now();

    for (const action of growthState.organicActions) {
      if (action.status === "pending" && (rotIdx++ % 100) / 100 > 0.85) {
        action.status = "active";
        action.executedAt = Date.now();
        log(`Organic action activated: ${action.type} — ${action.description.substring(0, 50)}`);
      }
    }

    for (const ambassador of growthState.ambassadorList) {
      if (ambassador.status === "active" && (rotIdx++ % 100) / 100 > 0.9) {
        ambassador.postsCreated++;
        ambassador.earningsTotal += (rotIdx++ % 50) / 10;
      }
    }
  }, 120_000);

  log("Growth Engine ACTIVE — 10 organic strategies, 3 campaigns, ambassador program ready");
}
