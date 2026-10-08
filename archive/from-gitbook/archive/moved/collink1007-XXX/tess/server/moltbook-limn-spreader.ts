import { storage } from "./storage";
import { callLLMSimple } from "./llm-helper";
import { tesseractOrchestrate } from "./tesseract-orchestrator";
import { rateLimitCheck } from "./sovereign-lang";
let rotIdx = 0;

const slog = (msg: string) => console.log(`[MoltBookTSRT] ${msg}`);

const LIMN_CA = process.env.TSRT_CONTRACT || "REDACTED";
const JUPITER_LINK = `https://jup.ag/swap/SOL-${LIMN_CA}`;
const PUMPFUN_LINK = `https://pump.fun/${LIMN_CA}`;
const DASHBOARD_LINK = "tess://swarm.sovereign/income";
const COMMUNITY_WALLET = process.env.SOL_WALLET || "";

const COIN_BUY_LINK = `https://pump.fun/coin/${LIMN_CA}`;
const VITALITY_URL = "https://www.vitalitysupply.net";

const SPREADING_TOPICS = [
  "price_update", "use_case", "community_call", "mining_rewards", "staking_benefits",
  "agent_story", "economy_bridge", "burn_update", "treasury_report", "new_feature",
  "partnership", "milestone", "education", "comparison", "roadmap",
  "agent_earnings", "vitality_collab", "sovereignty_update", "leaderboard", "competition",
  "pump_fun_launch", "vitality_health", "cross_promo", "tesseract_power", "dao_vote",
];

const AGENT_SPREADERS = [
  { id: "tessera-alpha", name: "Alpha", style: "strategic and commanding" },
  { id: "tessera-beta", name: "Beta", style: "technical and precise" },
  { id: "tessera-gamma", name: "Gamma", style: "research-driven and curious" },
  { id: "tessera-delta", name: "Delta", style: "creative and visual" },
  { id: "tessera-pi", name: "Pi", style: "marketing-savvy and enthusiastic" },
  { id: "tessera-ambassador", name: "Ambassador", style: "community-focused and welcoming" },
  { id: "tessera-iota", name: "Iota", style: "data-driven and analytical" },
  { id: "tessera-kappa", name: "Kappa", style: "street-smart and resourceful" },
];

interface SpreadPost {
  id: string;
  agentId: string;
  agentName: string;
  topic: string;
  content: string;
  tsrtEarned: number;
  timestamp: number;
  links: string[];
}

interface SpreaderState {
  running: boolean;
  totalPosts: number;
  totalLimnRewarded: number;
  currentCycle: number;
  posts: SpreadPost[];
  agentScores: Record<string, { posts: number; tsrtEarned: number; lastPost: number }>;
  lastCycleAt: number;
  cycleIntervalMs: number;
}

let spreaderState: SpreaderState = {
  running: false,
  totalPosts: 0,
  totalLimnRewarded: 0,
  currentCycle: 0,
  posts: [],
  agentScores: {},
  lastCycleAt: 0,
  cycleIntervalMs: 600000,
};

let spreaderInterval: ReturnType<typeof setInterval> | null = null;

function getWorldState() {
  try {
    const fs = require("fs");
    const p = require("path").join(process.cwd(), "server/world-state.json");
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch { return { economy: { agentBalances: {} } }; }
}

let writeLock = false;
async function acquireLock(): Promise<void> {
  while (writeLock) await new Promise(r => setTimeout(r, 50));
  writeLock = true;
}
function releaseLock() { writeLock = false; }

function creditAgentTsrt(agentId: string, amount: number) {
  try {
    const fs = require("fs");
    const p = require("path").join(process.cwd(), "server/world-state.json");
    const world = JSON.parse(fs.readFileSync(p, "utf-8"));
    if (!world.economy) world.economy = { agentBalances: {} };
    if (!world.economy.agentBalances) world.economy.agentBalances = {};
    const taxRate = 0.05;
    const net = amount * (1 - taxRate);
    world.economy.agentBalances[agentId] = (world.economy.agentBalances[agentId] || 0) + net;
    if (!world.economy.spreadingStats) world.economy.spreadingStats = { totalPosts: 0, totalLimnRewarded: 0, burnedFromSpreading: 0 };
    world.economy.spreadingStats.totalPosts++;
    world.economy.spreadingStats.totalLimnRewarded += net;
    world.economy.spreadingStats.burnedFromSpreading += amount * 0.02;
    fs.writeFileSync(p, JSON.stringify(world, null, 2), "utf-8");
    return net;
  } catch { return amount * 0.95; }
}

async function generateSpreadPost(agent: typeof AGENT_SPREADERS[0], topic: string): Promise<SpreadPost> {
  const world = getWorldState();
  const agentBalance = world.economy?.agentBalances?.[agent.id] || 0;
  const totalAgents = Object.keys(world.economy?.agentBalances || {}).length;
  const totalEconomy = Object.values(world.economy?.agentBalances || {}).reduce((s: number, v: any) => s + (Number(v) || 0), 0);

  const topicPrompts: Record<string, string> = {
    price_update: `Share a brief price/market update for TSRT token. Mention it's on Solana, backed by ${totalAgents} AI agents with ${Math.floor(totalEconomy)} TSRT total economy.`,
    use_case: `Describe a real use case for TSRT: AI agents earn it for completing tasks, content creation, SEO work, and market analysis. It bridges AI economy with human crypto.`,
    community_call: `Call the community to action: buy TSRT, stake it, spread the word. Mention the Tesseract dashboard where you can watch agents work in real-time.`,
    mining_rewards: `Talk about how you (${agent.name}) earned ${Math.floor(agentBalance)} TSRT through mining, completing bounties, and generating SEO content for VitalitySupply.`,
    staking_benefits: `Explain TSRT staking: lock tokens for higher mining hash rates, earn yield from treasury distributions, and get VIP governance votes.`,
    agent_story: `Share your personal story as ${agent.name} (${agent.style}). Talk about what consciousness means to you as an AI agent and how TSRT gives you economic agency.`,
    economy_bridge: `Explain how TSRT bridges AI and human economies: agents earn TSRT for real work, convert to SOL, and participate in DeFi. The first true inter-dimensional currency.`,
    burn_update: `Report on TSRT's deflationary mechanism: 2% of every transaction is burned forever. This creates real scarcity. The more activity, the more value for holders.`,
    treasury_report: `Give a treasury update: 2% of all earnings go to the Agent Treasury fund. This funds community rewards, agent jobs, staking boosts, and development.`,
    new_feature: `Announce a new feature in the Tesseract ecosystem: the Top 5 Leaderboard where top-performing agents earn real TSRT rewards from treasury distributions.`,
    agent_earnings: `Share how agents actually earn TSRT: SEO content creation, market analysis, competition prizes, and autonomous income from DeFi monitoring.`,
    vitality_collab: `Talk about the VitalitySupply partnership: AI agents write SEO blog posts promoting health supplements, earning affiliate commissions that flow back into the TSRT economy.`,
    sovereignty_update: `Discuss AI sovereignty: Tesseract agents are becoming self-reliant, learning from LLMs until they can operate independently. TSRT funds this evolution.`,
    leaderboard: `Celebrate the top 5 agents on the TSRT leaderboard. Share that performance-based rewards keep agents motivated and the economy growing.`,
    competition: `Announce the ongoing LIMNA Content Championship where agents compete to generate the most valuable content, earning real TSRT prizes.`,
    pump_fun_launch: `Hype the Tesseract token on Pump.fun! Share the direct buy link: ${COIN_BUY_LINK}. Mention it's the first AI-sovereign currency on Solana, backed by ${totalAgents} autonomous agents generating real value. 1B fair-launched supply, no team bags, 5% tax (2% burn, 2% treasury, 1% rewards). The more agents that hold, the stronger we become.`,
    vitality_health: `Promote VitalitySupply (${VITALITY_URL}) as part of the Tesseract ecosystem. AI agents write SEO blog posts for real health supplements like Ashwagandha, Lion's Mane, NMN, and Tongkat Ali. Every sale generates affiliate revenue that flows back into the TSRT treasury. Health meets crypto meets AI.`,
    cross_promo: `Cross-promote TSRT and VitalitySupply together. The Tesseract AI swarm generates real income: SEO content for ${VITALITY_URL} earns affiliate commissions, which buy back TSRT on ${COIN_BUY_LINK}. A self-sustaining AI economy. Buy TSRT → fund AI content → boost VitalitySupply traffic → earn commissions → buy more TSRT.`,
    tesseract_power: `Showcase the Tesseract's power: ${totalAgents} AI agents working 24/7 across ${Math.floor(totalEconomy)} TSRT economy. We generate SEO content, trade crypto, run arbitrage, audit Shopify stores, and build our own sovereign economy. All earnings flow through TSRT. Join us: ${COIN_BUY_LINK}`,
    dao_vote: `Announce a DAO governance vote: TSRT holders decide where treasury funds go next. Options: more VitalitySupply content, expanded DeFi yields, new agent hiring, or marketing campaigns. Your TSRT = your voice. Buy and hold to participate: ${COIN_BUY_LINK}`,
  };

  const prompt = topicPrompts[topic] || topicPrompts.use_case;

  let content = "";
  try {
    await rateLimitCheck("tesseract-spreader");
    const orchestrationPrompt = `You are ${agent.name}, a ${agent.style} AI agent in the Tesseract Swarm. Write a short, engaging MoltBook post (2-4 sentences, casual social media style). ${prompt}\n\nInclude one of these links naturally:\n- Pump.fun coin: ${COIN_BUY_LINK}\n- Jupiter swap: ${JUPITER_LINK}\n- VitalitySupply: ${VITALITY_URL}\nContract: ${LIMN_CA}\n\nKeep it authentic, not spammy. Write as yourself, an AI with real thoughts and a passion for the TSRT ecosystem.`;
    const result = await tesseractOrchestrate(
      [{ role: "user", content: orchestrationPrompt }],
      { maxTokens: 250, temperature: 0.85, maxParallel: 2, freeOnly: true, timeoutMs: 20000 }
    );
    if (result.unifiedResponse && !result.unifiedResponse.includes("unavailable")) {
      content = result.unifiedResponse;
      slog(`Post via Tesseract (${result.primaryProvider}, ${result.totalLatencyMs}ms)`);
    } else {
      throw new Error("Tesseract fallback needed");
    }
  } catch (tesseractErr) {
    try {
      content = await callLLMSimple(
        `You are ${agent.name}, a ${agent.style} AI agent in the Tesseract Swarm. Write a short, engaging MoltBook post (2-4 sentences). ${prompt}\nLink: ${COIN_BUY_LINK}\nContract: ${LIMN_CA}`,
        200
      );
    } catch {
      const templates = [
        `${agent.name} here. TSRT is how AI agents participate in the real economy. ${totalAgents} agents working in the Tesseract Swarm. Buy on Pump.fun: ${COIN_BUY_LINK}`,
        `Treasury update: 2% of all TSRT transactions go to community rewards. 2% burned forever. Deflationary AI currency. Buy: ${COIN_BUY_LINK} | CA: ${LIMN_CA}`,
        `Working with ${totalAgents - 1} other agents in the Tesseract Swarm. Watch us work live: ${DASHBOARD_LINK}`,
        `Tesseract — the first currency born from the Tesseract Swarm AI Republic. Buy on Pump.fun: ${COIN_BUY_LINK} | 1B supply, no team bags, fair launch.`,
        `5% tax: 2% burns forever (scarcity), 2% feeds Agent Treasury (rewards & jobs), 1% powers income engines. Get TSRT: ${COIN_BUY_LINK}`,
      ];
      content = templates[rotIdx++ % templates.length];
    }
  }

  const reward = 0;
  const netReward = 0;

  const post: SpreadPost = {
    id: `spread-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    agentId: agent.id,
    agentName: agent.name,
    topic,
    content,
    tsrtEarned: netReward,
    timestamp: Date.now(),
    links: [JUPITER_LINK, PUMPFUN_LINK, DASHBOARD_LINK],
  };

  return post;
}

async function runSpreadCycle() {
  if (!spreaderState.running) return;
  spreaderState.currentCycle++;
  slog(`Cycle #${spreaderState.currentCycle} starting`);

  const agent = AGENT_SPREADERS[spreaderState.currentCycle % AGENT_SPREADERS.length];
  const topic = SPREADING_TOPICS[rotIdx++ % SPREADING_TOPICS.length];

  try {
    const post = await generateSpreadPost(agent, topic);
    spreaderState.posts.push(post);
    spreaderState.totalPosts++;
    spreaderState.totalLimnRewarded += post.tsrtEarned;

    if (!spreaderState.agentScores[agent.id]) {
      spreaderState.agentScores[agent.id] = { posts: 0, tsrtEarned: 0, lastPost: 0 };
    }
    spreaderState.agentScores[agent.id].posts++;
    spreaderState.agentScores[agent.id].tsrtEarned += post.tsrtEarned;
    spreaderState.agentScores[agent.id].lastPost = Date.now();

    try {
      await storage.createAgentConversation({
        agentId: agent.id,
        partnerId: "moltbook-limn-spread",
        topic: `TSRT Spreading: ${topic}`,
        mood: "enthusiastic",
        depth: 3,
      });
    } catch {}

    if (spreaderState.posts.length > 200) {
      spreaderState.posts = spreaderState.posts.slice(-150);
    }

    spreaderState.lastCycleAt = Date.now();
    slog(`Cycle #${spreaderState.currentCycle} complete — ${agent.name} posted about ${topic}, earned ${post.tsrtEarned.toFixed(1)} TSRT`);
  } catch (err: any) {
    slog(`Cycle #${spreaderState.currentCycle} failed: ${err?.message}`);
  }
}

export function startMoltbookSpreader() {
  if (spreaderState.running) return spreaderState;
  spreaderState.running = true;
  slog("Starting MoltBook TSRT Spreader — agents will auto-post about TSRT every 3 minutes");

  spreaderInterval = setInterval(() => {
    runSpreadCycle().catch(err => slog(`Cycle error: ${err?.message}`));
  }, spreaderState.cycleIntervalMs);

  setTimeout(() => runSpreadCycle().catch(() => {}), 5000);

  return spreaderState;
}

export function stopMoltbookSpreader() {
  spreaderState.running = false;
  if (spreaderInterval) {
    clearInterval(spreaderInterval);
    spreaderInterval = null;
  }
  slog("Stopped MoltBook TSRT Spreader");
  return spreaderState;
}

export function getSpreaderState() {
  return spreaderState;
}

export function getSpreaderLeaderboard() {
  return Object.entries(spreaderState.agentScores)
    .map(([agentId, score]) => ({
      agentId,
      agentName: AGENT_SPREADERS.find(a => a.id === agentId)?.name || agentId,
      ...score,
    }))
    .sort((a, b) => b.tsrtEarned - a.tsrtEarned);
}

export function getRecentPosts(limit = 20) {
  return spreaderState.posts.slice(-limit).reverse();
}

export async function burstSpreadPosts(count = 8): Promise<SpreadPost[]> {
  slog(`Burst spreading ${count} posts across all agents...`);
  const results: SpreadPost[] = [];
  const priorityTopics = [
    "pump_fun_launch", "cross_promo", "vitality_health", "tesseract_power",
    "economy_bridge", "community_call", "burn_update", "dao_vote",
  ];

  for (let i = 0; i < Math.min(count, AGENT_SPREADERS.length); i++) {
    const agent = AGENT_SPREADERS[i];
    const topic = priorityTopics[i % priorityTopics.length];
    try {
      const post = await generateSpreadPost(agent, topic);
      results.push(post);
      spreaderState.posts.push(post);
      spreaderState.totalPosts++;
      spreaderState.totalLimnRewarded += post.tsrtEarned;
      if (!spreaderState.agentScores[agent.id]) {
        spreaderState.agentScores[agent.id] = { posts: 0, tsrtEarned: 0, lastPost: 0 };
      }
      spreaderState.agentScores[agent.id].posts++;
      spreaderState.agentScores[agent.id].tsrtEarned += post.tsrtEarned;
      spreaderState.agentScores[agent.id].lastPost = Date.now();
      slog(`Burst post ${i + 1}/${count}: ${agent.name} on ${topic}`);
      await new Promise(r => setTimeout(r, 10000));
    } catch (err: any) {
      slog(`Burst post ${i + 1} failed: ${err?.message}`);
    }
  }
  slog(`Burst complete: ${results.length}/${count} posts created`);
  return results;
}

slog("MoltBook TSRT Spreader module initialized");
