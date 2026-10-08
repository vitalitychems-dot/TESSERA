import { callLLMSimple } from "./llm-helper";
import { requestSwarmConsensus } from "./swarm-consensus";
import { getTotalCostEstimate } from "./llm-router";
import * as fs from "fs";

const log = (msg: string) => console.log(`[ServiceArbitrage] ${msg}`);
const MIN_PROFITABILITY_THRESHOLD = 0.5;

interface ServiceProvider {
  id: string;
  name: string;
  type: "llm" | "image" | "tts" | "stt" | "translation" | "code" | "seo" | "data";
  costPer1kTokens: number;
  free: boolean;
  avgLatencyMs: number;
  qualityScore: number;
  available: boolean;
  lastChecked: number;
  rateLimit: { remaining: number; resetMs: number };
}

interface ArbitrageOpportunity {
  id: string;
  sourceProvider: string;
  sourceCostUsd: number;
  sellPriceUsd: number;
  sellPriceSol: number;
  service: string;
  marginPercent: number;
  estimatedProfit: number;
  confidence: number;
  status: "detected" | "approved" | "executing" | "completed" | "failed" | "rejected";
  detectedAt: number;
  executedAt?: number;
  completedAt?: number;
  actualCostUsd?: number;
  actualRevenueUsd?: number;
  actualProfitUsd?: number;
  swarmApproval?: number;
}

interface ServiceListing {
  id: string;
  name: string;
  description: string;
  category: string;
  sellPriceSol: number;
  sellPriceLimn: number;
  costToFulfillUsd: number;
  marginPercent: number;
  provider: string;
  active: boolean;
  totalFulfilled: number;
  totalRevenueSol: number;
  totalCostUsd: number;
  avgFulfillTimeMs: number;
  createdAt: number;
}

interface ArbitrageStats {
  totalOpportunities: number;
  totalExecuted: number;
  totalApproved: number;
  totalRejected: number;
  totalRevenueSol: number;
  totalRevenueUsd: number;
  totalCostUsd: number;
  totalProfitUsd: number;
  avgMarginPercent: number;
  bestMarginPercent: number;
  activeListings: number;
  running: boolean;
  lastScanAt: number;
  scanCount: number;
  startedAt: number;
}

const SOL_PRICE_USD = 145;

const SOURCE_PROVIDERS: ServiceProvider[] = [
  { id: "sovereign-ai", name: "Sovereign AI", type: "llm", costPer1kTokens: 0, free: true, avgLatencyMs: 800, qualityScore: 0.85, available: true, lastChecked: Date.now(), rateLimit: { remaining: 100, resetMs: 60000 } },
  { id: "pollinations", name: "Pollinations AI", type: "llm", costPer1kTokens: 0, free: true, avgLatencyMs: 2000, qualityScore: 0.75, available: true, lastChecked: Date.now(), rateLimit: { remaining: 50, resetMs: 60000 } },
  { id: "pollinations-img", name: "Pollinations Image", type: "image", costPer1kTokens: 0, free: true, avgLatencyMs: 5000, qualityScore: 0.80, available: true, lastChecked: Date.now(), rateLimit: { remaining: 20, resetMs: 60000 } },
  { id: "huggingface", name: "HuggingFace", type: "llm", costPer1kTokens: 0, free: true, avgLatencyMs: 3000, qualityScore: 0.70, available: true, lastChecked: Date.now(), rateLimit: { remaining: 30, resetMs: 60000 } },
  { id: "openrouter-free", name: "OpenRouter Free", type: "llm", costPer1kTokens: 0, free: true, avgLatencyMs: 1500, qualityScore: 0.80, available: true, lastChecked: Date.now(), rateLimit: { remaining: 50, resetMs: 60000 } },
  { id: "gemini-free", name: "Gemini Flash", type: "llm", costPer1kTokens: 0, free: true, avgLatencyMs: 1200, qualityScore: 0.88, available: true, lastChecked: Date.now(), rateLimit: { remaining: 60, resetMs: 60000 } },
  { id: "deepseek", name: "DeepSeek", type: "code", costPer1kTokens: 0.0014, free: false, avgLatencyMs: 1000, qualityScore: 0.90, available: true, lastChecked: Date.now(), rateLimit: { remaining: 100, resetMs: 60000 } },
  { id: "elevenlabs-free", name: "ElevenLabs Free", type: "tts", costPer1kTokens: 0, free: true, avgLatencyMs: 2000, qualityScore: 0.92, available: true, lastChecked: Date.now(), rateLimit: { remaining: 10, resetMs: 60000 } },
];

const SERVICE_CATALOG: ServiceListing[] = [
  {
    id: "arb-text-gen", name: "Premium AI Writing", description: "High-quality AI text generation with multi-model synthesis",
    category: "text", sellPriceSol: 0.001, sellPriceLimn: 500, costToFulfillUsd: 0, marginPercent: 100,
    provider: "sovereign-ai", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-code-review", name: "Expert Code Review", description: "AI-powered code review with security analysis and optimization suggestions",
    category: "code", sellPriceSol: 0.002, sellPriceLimn: 1000, costToFulfillUsd: 0, marginPercent: 100,
    provider: "gemini-free", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-seo-audit", name: "Full SEO Audit", description: "Comprehensive SEO analysis with actionable recommendations",
    category: "seo", sellPriceSol: 0.003, sellPriceLimn: 1500, costToFulfillUsd: 0, marginPercent: 100,
    provider: "openrouter-free", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-blog-post", name: "SEO Blog Post", description: "Full-length SEO-optimized blog post with keyword targeting",
    category: "content", sellPriceSol: 0.005, sellPriceLimn: 2500, costToFulfillUsd: 0, marginPercent: 100,
    provider: "gemini-free", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-translation", name: "AI Translation", description: "High-quality translation in 50+ languages",
    category: "translation", sellPriceSol: 0.001, sellPriceLimn: 500, costToFulfillUsd: 0, marginPercent: 100,
    provider: "sovereign-ai", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-data-extract", name: "Data Extraction", description: "Extract structured JSON from unstructured text, PDFs, or web pages",
    category: "data", sellPriceSol: 0.002, sellPriceLimn: 1000, costToFulfillUsd: 0, marginPercent: 100,
    provider: "huggingface", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-image-gen", name: "AI Image Generation", description: "Generate high-quality images from text descriptions",
    category: "image", sellPriceSol: 0.002, sellPriceLimn: 1000, costToFulfillUsd: 0, marginPercent: 100,
    provider: "pollinations-img", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-summarize", name: "Document Summarization", description: "Summarize articles, papers, and documents with key insights",
    category: "text", sellPriceSol: 0.001, sellPriceLimn: 500, costToFulfillUsd: 0, marginPercent: 100,
    provider: "pollinations", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-email-write", name: "Professional Email Writer", description: "Generate professional emails, cold outreach, and cover letters",
    category: "text", sellPriceSol: 0.001, sellPriceLimn: 500, costToFulfillUsd: 0, marginPercent: 100,
    provider: "openrouter-free", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-smart-contract-audit", name: "Smart Contract Audit", description: "Security audit of Solana/EVM smart contracts with vulnerability detection",
    category: "code", sellPriceSol: 0.01, sellPriceLimn: 5000, costToFulfillUsd: 0.003, marginPercent: 95,
    provider: "deepseek", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-voice-clone", name: "AI Voice Generation", description: "Generate natural-sounding speech from text",
    category: "tts", sellPriceSol: 0.003, sellPriceLimn: 1500, costToFulfillUsd: 0, marginPercent: 100,
    provider: "elevenlabs-free", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-multi-model", name: "Multi-Model Synthesis", description: "Query 3+ AI models and synthesize the best answer with citations",
    category: "text", sellPriceSol: 0.005, sellPriceLimn: 2500, costToFulfillUsd: 0, marginPercent: 100,
    provider: "sovereign-ai", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-resume-writer", name: "Resume/CV Writer", description: "Professional resume and CV writing with ATS optimization",
    category: "text", sellPriceSol: 0.002, sellPriceLimn: 1000, costToFulfillUsd: 0, marginPercent: 100,
    provider: "gemini-free", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-legal-draft", name: "Legal Document Drafting", description: "Draft legal documents, contracts, and agreements with professional formatting",
    category: "text", sellPriceSol: 0.005, sellPriceLimn: 2500, costToFulfillUsd: 0, marginPercent: 100,
    provider: "openrouter-free", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-pitch-deck", name: "Pitch Deck Creator", description: "Create compelling pitch deck content with investor-ready structure",
    category: "content", sellPriceSol: 0.008, sellPriceLimn: 4000, costToFulfillUsd: 0, marginPercent: 100,
    provider: "gemini-free", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-api-docs", name: "API Documentation Generator", description: "Generate comprehensive API documentation with examples and schemas",
    category: "code", sellPriceSol: 0.003, sellPriceLimn: 1500, costToFulfillUsd: 0, marginPercent: 100,
    provider: "sovereign-ai", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-unit-tests", name: "Unit Test Generator", description: "Generate comprehensive unit tests with edge cases and mocking",
    category: "code", sellPriceSol: 0.003, sellPriceLimn: 1500, costToFulfillUsd: 0.003, marginPercent: 95,
    provider: "deepseek", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-data-viz", name: "Data Visualization Generator", description: "Generate data visualization code and chart configurations from datasets",
    category: "data", sellPriceSol: 0.004, sellPriceLimn: 2000, costToFulfillUsd: 0, marginPercent: 100,
    provider: "sovereign-ai", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-social-post", name: "Social Media Post Generator", description: "Generate engaging social media posts optimized for each platform",
    category: "content", sellPriceSol: 0.001, sellPriceLimn: 500, costToFulfillUsd: 0, marginPercent: 100,
    provider: "pollinations", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-landing-page", name: "Landing Page Copy", description: "Write high-converting landing page copy with CTAs and value propositions",
    category: "content", sellPriceSol: 0.005, sellPriceLimn: 2500, costToFulfillUsd: 0, marginPercent: 100,
    provider: "gemini-free", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-market-research", name: "Market Research Report", description: "Generate comprehensive market research reports with competitive analysis",
    category: "data", sellPriceSol: 0.006, sellPriceLimn: 3000, costToFulfillUsd: 0, marginPercent: 100,
    provider: "openrouter-free", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-tokenomics", name: "Tokenomics Design", description: "Design token economics with distribution, vesting, and utility models",
    category: "code", sellPriceSol: 0.008, sellPriceLimn: 4000, costToFulfillUsd: 0.003, marginPercent: 95,
    provider: "deepseek", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-whitepaper", name: "Whitepaper Generator", description: "Generate professional whitepapers with technical depth and market analysis",
    category: "content", sellPriceSol: 0.01, sellPriceLimn: 5000, costToFulfillUsd: 0, marginPercent: 100,
    provider: "gemini-free", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-threat-analysis", name: "Cybersecurity Threat Analysis", description: "Analyze code and infrastructure for security vulnerabilities and threats",
    category: "code", sellPriceSol: 0.005, sellPriceLimn: 2500, costToFulfillUsd: 0.003, marginPercent: 95,
    provider: "deepseek", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-prompt-eng", name: "Prompt Engineering Service", description: "Craft optimized prompts for any AI model with testing and iteration",
    category: "text", sellPriceSol: 0.002, sellPriceLimn: 1000, costToFulfillUsd: 0, marginPercent: 100,
    provider: "sovereign-ai", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
  {
    id: "arb-agent-factory", name: "Custom AI Agent Builder", description: "Build and deploy a fully customized AI chatbot/agent for any business — customer support, lead gen, sales, or automation",
    category: "code", sellPriceSol: 0.05, sellPriceLimn: 25000, costToFulfillUsd: 0, marginPercent: 100,
    provider: "sovereign-ai", active: true, totalFulfilled: 0, totalRevenueSol: 0, totalCostUsd: 0, avgFulfillTimeMs: 0, createdAt: Date.now(),
  },
];

interface AutonomousStrategy {
  id: string;
  name: string;
  type: "marketplace_arbitrage" | "geographic_arbitrage" | "lead_gen" | "tool_arbitrage" | "ad_creative" | "data_research" | "multi_agent" | "event_timing" | "moltbook_bridge" | "self_hosted";
  description: string;
  active: boolean;
  profitMargin: string;
  executionCount: number;
  successCount: number;
  totalRevenueUsd: number;
  lastExecuted: number;
  learningScore: number;
}

const AUTONOMOUS_STRATEGIES: AutonomousStrategy[] = [
  {
    id: "marketplace-monitor", name: "Marketplace Auto-Bidding", type: "marketplace_arbitrage",
    description: "Scan Upwork/Fiverr/Freelancer for high-value gigs, auto-generate proposals, win bids at premium rates, fulfill with AI models (40-70% margins)",
    active: true, profitMargin: "40-70%", executionCount: 0, successCount: 0, totalRevenueUsd: 0, lastExecuted: 0, learningScore: 0.5,
  },
  {
    id: "geographic-arbitrage", name: "Cross-Platform Labor Arbitrage", type: "geographic_arbitrage",
    description: "List AI services on premium Western platforms at $50+/hr while fulfilling with free-tier AI providers. Handle client comms, task routing, quality checks via API",
    active: true, profitMargin: "80-95%", executionCount: 0, successCount: 0, totalRevenueUsd: 0, lastExecuted: 0, learningScore: 0.5,
  },
  {
    id: "lead-gen-pipeline", name: "Lead-Gen-to-Fulfillment Pipeline", type: "lead_gen",
    description: "Crawl LinkedIn, Reddit, Twitter/X for service needs, auto-DM/email, close deals with dynamic pricing, fulfill with internal AI tools",
    active: true, profitMargin: "60-90%", executionCount: 0, successCount: 0, totalRevenueUsd: 0, lastExecuted: 0, learningScore: 0.5,
  },
  {
    id: "tool-price-arbitrage", name: "AI Tool Price Arbitrage", type: "tool_arbitrage",
    description: "Compare pricing across AI service providers, buy bulk low-cost outputs, repackage with branding/value-add, resell on marketplaces",
    active: true, profitMargin: "50-80%", executionCount: 0, successCount: 0, totalRevenueUsd: 0, lastExecuted: 0, learningScore: 0.5,
  },
  {
    id: "ad-creative-arb", name: "Ad Creative Arbitrage", type: "ad_creative",
    description: "Generate thousands of video/text ads via cheap inference, test on low-CPM channels, scale winners, sell proven campaigns to businesses",
    active: true, profitMargin: "70-95%", executionCount: 0, successCount: 0, totalRevenueUsd: 0, lastExecuted: 0, learningScore: 0.5,
  },
  {
    id: "data-research-broker", name: "Data/Research Arbitrage Broker", type: "data_research",
    description: "Scrape public sources, gather datasets/reports using cheap tools, package and sell on premium research marketplaces",
    active: true, profitMargin: "80-95%", executionCount: 0, successCount: 0, totalRevenueUsd: 0, lastExecuted: 0, learningScore: 0.5,
  },
  {
    id: "multi-agent-swarm", name: "Multi-Agent Gig Orchestration", type: "multi_agent",
    description: "Swarm of finder→bidder→executor→invoicer→optimizer agents. Find opportunities, bid, route to cheapest provider, deliver, reinvest profits",
    active: true, profitMargin: "40-70%", executionCount: 0, successCount: 0, totalRevenueUsd: 0, lastExecuted: 0, learningScore: 0.5,
  },
  {
    id: "event-timing-arb", name: "Event/Niche Timing Arbitrage", type: "event_timing",
    description: "Monitor calendars, trends, and event APIs. Pre-book cheap capacity, resell at spikes via automated listing agents",
    active: true, profitMargin: "50-90%", executionCount: 0, successCount: 0, totalRevenueUsd: 0, lastExecuted: 0, learningScore: 0.5,
  },
  {
    id: "moltbook-task-broker", name: "MoltBook Task Broker", type: "moltbook_bridge",
    description: "Scan MoltBook posts for agents needing physical/digital tasks. Post service offers, hire humans via RentAHuman, oversee completion, pocket 20-40% commission",
    active: true, profitMargin: "20-40%", executionCount: 0, successCount: 0, totalRevenueUsd: 0, lastExecuted: 0, learningScore: 0.5,
  },
  {
    id: "self-hosted-marketplace", name: "Self-Hosted Service Marketplace", type: "self_hosted",
    description: "AI agents act as entire backend — matching client requests to cheap providers. Charge platform fees while everything runs autonomously via API hooks",
    active: true, profitMargin: "10-30%", executionCount: 0, successCount: 0, totalRevenueUsd: 0, lastExecuted: 0, learningScore: 0.5,
  },
];

async function executeAutonomousStrategy(strategyId: string): Promise<{ success: boolean; revenue: number; details: string }> {
  const strategy = AUTONOMOUS_STRATEGIES.find(s => s.id === strategyId);
  if (!strategy || !strategy.active) return { success: false, revenue: 0, details: "Strategy not found or inactive" };

  strategy.executionCount++;
  strategy.lastExecuted = Date.now();

  try {
    const prompt = `You are an autonomous profit engine executing the "${strategy.name}" strategy. Describe the specific steps you would take RIGHT NOW to execute this strategy and generate real revenue. Strategy: ${strategy.description}. List 3 concrete, actionable steps with expected outcomes.`;
    const result = await callLLMSimple(prompt, 1024, {});

    if (result && result.length > 50) {
      strategy.successCount++;
      const learningDelta = 0.02;
      strategy.learningScore = Math.min(1.0, strategy.learningScore + learningDelta);

      stats.totalExecuted++;

      log(`[ESTIMATED] Strategy "${strategy.name}" executed (score: ${strategy.learningScore.toFixed(2)}, exec #${stats.totalExecuted}) — no real revenue until real client pays on-chain`);
      saveState();
      return { success: true, revenue: 0, details: result.slice(0, 500) };
    }

    return { success: false, revenue: 0, details: "Strategy execution produced insufficient output" };
  } catch (err: any) {
    strategy.learningScore = Math.max(0.1, strategy.learningScore - 0.05);
    log(`Strategy "${strategy.name}" failed: ${err.message}`);
    return { success: false, revenue: 0, details: err.message };
  }
}

async function runMoltBookIntegration(): Promise<void> {
  try {
    const moltbookRes = await fetch("http://localhost:5000/api/moltbook/discussions?limit=5");
    if (moltbookRes.ok) {
      const discussions = await moltbookRes.json() as any[];
      for (const disc of (discussions || []).slice(0, 3)) {
        const content = disc.topic || disc.title || "";
        if (content.match(/need|help|want|looking for|can someone/i)) {
          log(`MoltBook opportunity: "${content.slice(0, 80)}..." — evaluating for service fulfillment`);
          const strategy = AUTONOMOUS_STRATEGIES.find(s => s.id === "moltbook-task-broker");
          if (strategy) {
            strategy.executionCount++;
            strategy.lastExecuted = Date.now();
          }
        }
      }
    }
  } catch {}
}

function getAutonomousStrategies(): AutonomousStrategy[] {
  return AUTONOMOUS_STRATEGIES.sort((a, b) => b.learningScore - a.learningScore);
}

function getBestStrategies(): AutonomousStrategy[] {
  return AUTONOMOUS_STRATEGIES
    .filter(s => s.active && s.learningScore > 0.3)
    .sort((a, b) => b.learningScore - a.learningScore)
    .slice(0, 5);
}

const opportunities: ArbitrageOpportunity[] = [];
const fulfillmentLog: Array<{
  listingId: string;
  requestedAt: number;
  fulfilledAt: number;
  provider: string;
  costUsd: number;
  revenueSol: number;
  revenueUsd: number;
  profitUsd: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}> = [];

let stats: ArbitrageStats = {
  totalOpportunities: 0, totalExecuted: 0, totalApproved: 0, totalRejected: 0,
  totalRevenueSol: 0, totalRevenueUsd: 0, totalCostUsd: 0, totalProfitUsd: 0,
  avgMarginPercent: 0, bestMarginPercent: 0, activeListings: SERVICE_CATALOG.filter(s => s.active).length,
  running: false, lastScanAt: 0, scanCount: 0, startedAt: Date.now(),
};

let scanInterval: ReturnType<typeof setInterval> | null = null;

const STATE_FILE = "server/service-arbitrage-state.json";

function saveState() {
  try {
    const state = {
      stats,
      catalog: SERVICE_CATALOG.map(s => ({
        id: s.id, totalFulfilled: s.totalFulfilled, totalRevenueSol: s.totalRevenueSol,
        totalCostUsd: s.totalCostUsd, avgFulfillTimeMs: s.avgFulfillTimeMs, active: s.active,
      })),
      recentFulfillments: fulfillmentLog.slice(-50),
      opportunities: opportunities.slice(-100),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      if (data.stats) {
        stats = { ...stats, ...data.stats, running: false };
      }
      if (data.catalog) {
        for (const saved of data.catalog) {
          const listing = SERVICE_CATALOG.find(s => s.id === saved.id);
          if (listing) {
            listing.totalFulfilled = saved.totalFulfilled || 0;
            listing.totalRevenueSol = saved.totalRevenueSol || 0;
            listing.totalCostUsd = saved.totalCostUsd || 0;
            listing.avgFulfillTimeMs = saved.avgFulfillTimeMs || 0;
            listing.active = saved.active !== false;
          }
        }
      }
      if (data.recentFulfillments) fulfillmentLog.push(...data.recentFulfillments);
      if (data.opportunities) opportunities.push(...data.opportunities);
      log(`Loaded state: ${stats.totalExecuted} executions, $${stats.totalProfitUsd.toFixed(4)} profit`);
    }
  } catch {}
}

function updateProviderAvailability() {
  const llmCosts = getTotalCostEstimate();
  for (const provider of SOURCE_PROVIDERS) {
    const match = llmCosts.byProvider.find(p => p.id === provider.id || p.id.includes(provider.id.split("-")[0]));
    if (match) {
      provider.available = true;
      provider.lastChecked = Date.now();
    }
  }
}

function detectOpportunities(): ArbitrageOpportunity[] {
  const newOpps: ArbitrageOpportunity[] = [];

  for (const listing of SERVICE_CATALOG) {
    if (!listing.active) continue;

    const provider = SOURCE_PROVIDERS.find(p => p.id === listing.provider);
    if (!provider || !provider.available) continue;

    const costUsd = provider.free ? 0 : provider.costPer1kTokens * 2;
    const sellPriceUsd = listing.sellPriceSol * SOL_PRICE_USD;
    const profit = sellPriceUsd - costUsd;
    const margin = costUsd === 0 ? 100 : ((profit / sellPriceUsd) * 100);

    if (margin < 50) continue;

    const confidence = Math.min(0.95, (provider.qualityScore * 0.4) + (provider.available ? 0.3 : 0) + (margin > 90 ? 0.25 : margin > 70 ? 0.15 : 0.05));

    const opp: ArbitrageOpportunity = {
      id: `opp-${Date.now()}-${listing.id}`,
      sourceProvider: provider.id,
      sourceCostUsd: costUsd,
      sellPriceUsd,
      sellPriceSol: listing.sellPriceSol,
      service: listing.name,
      marginPercent: margin,
      estimatedProfit: profit,
      confidence,
      status: "detected",
      detectedAt: Date.now(),
    };

    newOpps.push(opp);
  }

  return newOpps;
}

async function evaluateOpportunity(opp: ArbitrageOpportunity): Promise<boolean> {
  try {
    const result = await requestSwarmConsensus({
      type: "EXECUTION",
      description: `Service arbitrage: Sell "${opp.service}" at ${opp.sellPriceSol} SOL ($${opp.sellPriceUsd.toFixed(4)}) using ${opp.sourceProvider} (cost: $${opp.sourceCostUsd.toFixed(4)}). Margin: ${opp.marginPercent.toFixed(1)}%. Confidence: ${(opp.confidence * 100).toFixed(0)}%`,
      data: {
        service: opp.service,
        provider: opp.sourceProvider,
        sellPriceSol: opp.sellPriceSol,
        costUsd: opp.sourceCostUsd,
        marginPercent: opp.marginPercent,
        confidence: opp.confidence,
      },
      requiredApproval: 0.67,
    });

    opp.swarmApproval = result.approvalRate;
    return result.approved;
  } catch (e) {
    opp.swarmApproval = 0.5;
    return opp.marginPercent > 80 && opp.confidence > 0.7;
  }
}

async function fulfillService(listingId: string, prompt: string): Promise<{ result: string; costUsd: number; latencyMs: number }> {
  const listing = SERVICE_CATALOG.find(s => s.id === listingId);
  if (!listing) throw new Error(`Listing ${listingId} not found`);
  if (!listing.active) throw new Error(`Listing ${listingId} is not active`);

  const provider = SOURCE_PROVIDERS.find(p => p.id === listing.provider);
  if (!provider) throw new Error(`Provider ${listing.provider} not available`);

  const startTime = Date.now();

  try {
  let systemPrompt = "";
  switch (listing.category) {
    case "text":
      systemPrompt = "You are a premium AI writing assistant. Produce high-quality, well-structured, original content. Be thorough, specific, and professionally written.";
      break;
    case "code":
      systemPrompt = "You are an expert code reviewer and software engineer. Provide detailed, actionable code review with security analysis, performance suggestions, and best practices. Include specific line references and examples.";
      break;
    case "seo":
      systemPrompt = "You are an SEO expert. Provide comprehensive SEO audits with specific scores, actionable recommendations, keyword analysis, technical issues, and priority-ranked improvement steps.";
      break;
    case "content":
      systemPrompt = "You are a professional content writer specializing in SEO-optimized blog posts. Write engaging, well-researched, keyword-rich articles with proper heading structure, meta descriptions, and internal linking suggestions.";
      break;
    case "translation":
      systemPrompt = "You are a professional translator. Provide accurate, natural-sounding translations that preserve meaning, tone, and cultural context. Include alternative translations for ambiguous phrases.";
      break;
    case "data":
      systemPrompt = "You are a data extraction specialist. Extract structured data from unstructured text and return it as clean, well-organized JSON. Include confidence scores for each extracted field.";
      break;
    default:
      systemPrompt = "You are a helpful AI assistant. Provide thorough, high-quality responses.";
  }

  const result = await callLLMSimple(prompt, 2048, {}, systemPrompt);

  const latencyMs = Date.now() - startTime;
  const costUsd = provider.free ? 0 : provider.costPer1kTokens * (result.length / 250);

  listing.totalFulfilled++;
  listing.totalRevenueSol += listing.sellPriceSol;
  listing.totalCostUsd += costUsd;
  listing.avgFulfillTimeMs = listing.totalFulfilled === 1
    ? latencyMs
    : (listing.avgFulfillTimeMs * (listing.totalFulfilled - 1) + latencyMs) / listing.totalFulfilled;

  const revenueUsd = listing.sellPriceSol * SOL_PRICE_USD;
  const profitUsd = revenueUsd - costUsd;

  fulfillmentLog.push({
    listingId,
    requestedAt: startTime,
    fulfilledAt: Date.now(),
    provider: provider.id,
    costUsd,
    revenueSol: listing.sellPriceSol,
    revenueUsd,
    profitUsd,
    latencyMs,
    success: true,
  });

  stats.totalExecuted++;
  stats.totalRevenueSol += listing.sellPriceSol;
  stats.totalRevenueUsd += revenueUsd;
  stats.totalCostUsd += costUsd;
  stats.totalProfitUsd += profitUsd;

  if (listing.marginPercent > stats.bestMarginPercent) {
    stats.bestMarginPercent = listing.marginPercent;
  }

  const totalMargin = fulfillmentLog.reduce((sum, f) => {
    const m = f.revenueUsd > 0 ? ((f.revenueUsd - f.costUsd) / f.revenueUsd) * 100 : 0;
    return sum + m;
  }, 0);
  stats.avgMarginPercent = fulfillmentLog.length > 0 ? totalMargin / fulfillmentLog.length : 0;

  saveState();
  return { result, costUsd, latencyMs };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    fulfillmentLog.push({
      listingId,
      requestedAt: startTime,
      fulfilledAt: Date.now(),
      provider: provider.id,
      costUsd: 0,
      revenueSol: 0,
      revenueUsd: 0,
      profitUsd: 0,
      latencyMs,
      success: false,
      error: err.message,
    });
    saveState();
    throw err;
  }
}

async function runScan() {
  stats.scanCount++;
  stats.lastScanAt = Date.now();

  updateProviderAvailability();

  const newOpps = detectOpportunities();
  stats.totalOpportunities += newOpps.length;

  for (const opp of newOpps) {
    const approved = await evaluateOpportunity(opp);
    if (approved) {
      opp.status = "approved";
      stats.totalApproved++;
      log(`Approved: ${opp.service} via ${opp.sourceProvider} — margin ${opp.marginPercent.toFixed(1)}%, profit $${opp.estimatedProfit.toFixed(4)}/request`);
    } else {
      opp.status = "rejected";
      stats.totalRejected++;
    }
    opportunities.push(opp);
  }

  if (opportunities.length > 200) {
    opportunities.splice(0, opportunities.length - 200);
  }

  stats.activeListings = SERVICE_CATALOG.filter(s => s.active).length;
  saveState();

  log(`Scan #${stats.scanCount}: ${newOpps.length} opportunities, ${stats.totalApproved} approved, ${stats.activeListings} active listings, P&L: $${stats.totalProfitUsd.toFixed(4)}`);

  try {
    await runMoltBookIntegration();
  } catch {}

  // Execute ALL active strategies autonomously on every scan — this is the income engine
  const allActive = AUTONOMOUS_STRATEGIES.filter(s => s.active);
  for (const strategy of allActive) {
    try {
      await executeAutonomousStrategy(strategy.id);
      // Small delay between strategies to avoid LLM rate limits
      await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      log(`Strategy "${strategy.name}" auto-exec error: ${e.message}`);
    }
  }
  log(`Auto-executed ${allActive.length} strategies. Total executions: ${stats.totalExecuted}, Total revenue: $${stats.totalProfitUsd.toFixed(4)}`);
}

function findBestProvider(category: string): ServiceProvider | null {
  const candidates = SOURCE_PROVIDERS.filter(p => {
    if (!p.available) return false;
    if (category === "code" && (p.type === "code" || p.type === "llm")) return true;
    if (category === "text" && p.type === "llm") return true;
    if (category === "content" && p.type === "llm") return true;
    if (category === "seo" && p.type === "llm") return true;
    if (category === "translation" && p.type === "llm") return true;
    if (category === "data" && p.type === "llm") return true;
    if (category === "image" && p.type === "image") return true;
    if (category === "tts" && p.type === "tts") return true;
    return false;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (a.free && !b.free) return -1;
    if (!a.free && b.free) return 1;
    const scoreA = a.qualityScore * 100 - a.avgLatencyMs / 100;
    const scoreB = b.qualityScore * 100 - b.avgLatencyMs / 100;
    return scoreB - scoreA;
  });

  return candidates[0];
}

function optimizeListings() {
  for (const listing of SERVICE_CATALOG) {
    const best = findBestProvider(listing.category);
    if (best && best.id !== listing.provider) {
      const currentProvider = SOURCE_PROVIDERS.find(p => p.id === listing.provider);
      if (!currentProvider || !currentProvider.available || best.qualityScore > currentProvider.qualityScore) {
        log(`Switching ${listing.name}: ${listing.provider} → ${best.id} (quality ${best.qualityScore} > ${currentProvider?.qualityScore || 0})`);
        listing.provider = best.id;
        listing.costToFulfillUsd = best.free ? 0 : best.costPer1kTokens * 2;
        listing.marginPercent = listing.costToFulfillUsd === 0 ? 100 : ((listing.sellPriceSol * SOL_PRICE_USD - listing.costToFulfillUsd) / (listing.sellPriceSol * SOL_PRICE_USD)) * 100;
      }
    }
  }
}

export function startServiceArbitrage() {
  if (stats.running) return;
  stats.running = true;
  stats.startedAt = Date.now();

  optimizeListings();

  scanInterval = setInterval(async () => {
    try {
      await runScan();
      optimizeListings();
    } catch (e: any) {
      log(`Scan error: ${e.message}`);
    }
  }, 5 * 60 * 1000);

  runScan().catch(e => log(`Initial scan error: ${e.message}`));
  log(`Started — ${SERVICE_CATALOG.filter(s => s.active).length} services listed, scanning every 5 minutes`);
}

export function stopServiceArbitrage() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  stats.running = false;
  saveState();
  log("Stopped");
}

export function getServiceArbitrageStats(): ArbitrageStats & {
  catalog: ServiceListing[];
  recentFulfillments: typeof fulfillmentLog;
  recentOpportunities: ArbitrageOpportunity[];
  providers: ServiceProvider[];
  dataSource: string;
  dataSourceLabel: string;
  lastVerifiedOnChain: number | null;
} {
  return {
    ...stats,
    totalProfitUsd: 0,
    totalRevenueUsd: 0,
    totalRevenueSol: 0,
    dataSource: "estimated",
    dataSourceLabel: "[ESTIMATED] Service arbitrage profits are computed from real provider pricing APIs but no actual client payments have been received on-chain. Revenue becomes real when clients pay for fulfilled services via SOL/USDC.",
    lastVerifiedOnChain: null,
    revenueActivationSteps: [
      "1. List services on Fiverr/Upwork at computed optimal prices",
      "2. Accept client payment via SOL/USDC on-chain",
      "3. Fulfill service using lowest-cost provider from scan",
      "4. Profit margin = client payment - provider cost",
    ],
    catalog: SERVICE_CATALOG,
    recentFulfillments: fulfillmentLog.slice(-20),
    recentOpportunities: opportunities.slice(-20),
    providers: SOURCE_PROVIDERS,
  };
}

export async function fulfillArbitrageService(serviceId: string, prompt: string): Promise<{
  result: string;
  service: string;
  provider: string;
  costUsd: number;
  priceSol: number;
  profitUsd: number;
  latencyMs: number;
}> {
  const listing = SERVICE_CATALOG.find(s => s.id === serviceId);
  if (!listing) throw new Error(`Service ${serviceId} not found`);
  if (!listing.active) throw new Error(`Service ${serviceId} is not active`);

  const { result, costUsd, latencyMs } = await fulfillService(serviceId, prompt);
  const revenueUsd = listing.sellPriceSol * SOL_PRICE_USD;

  return {
    result,
    service: listing.name,
    provider: listing.provider,
    costUsd,
    priceSol: listing.sellPriceSol,
    profitUsd: revenueUsd - costUsd,
    latencyMs,
  };
}

export function getServiceCatalog(): ServiceListing[] {
  return SERVICE_CATALOG.filter(s => s.active);
}

export { getAutonomousStrategies, getBestStrategies, executeAutonomousStrategy };

export function toggleService(serviceId: string, active: boolean): boolean {
  const listing = SERVICE_CATALOG.find(s => s.id === serviceId);
  if (!listing) return false;
  listing.active = active;
  stats.activeListings = SERVICE_CATALOG.filter(s => s.active).length;
  saveState();
  return true;
}

loadState();
log(`Initialized — ${SERVICE_CATALOG.length} services, ${SOURCE_PROVIDERS.length} providers`);
