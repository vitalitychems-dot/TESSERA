import { requestSwarmConsensus } from "./swarm-consensus";

const log = (m: string) => console.log(`[MoltBookRevenue] ${m}`);

interface RevenueStrategy {
  id: string;
  name: string;
  category: "moltbook" | "rah" | "bridge" | "arbitrage" | "content" | "services";
  method: string;
  expectedRevenue: number;
  frequency: string;
  status: "active" | "pending_vote" | "rejected" | "executing" | "completed";
  executionCount: number;
  totalRevenue: number;
  lastExecuted?: number;
  consensusApproved: boolean;
}

interface RevenueExecution {
  id: string;
  strategyId: string;
  timestamp: number;
  revenue: number;
  status: "success" | "failed" | "pending";
  details: string;
  agentAssigned: string;
}

const REVENUE_STRATEGIES: RevenueStrategy[] = [
  { id: "mb-sponsored-posts", name: "MoltBook Sponsored Agent Posts", category: "moltbook", method: "Agents create sponsored discussion threads that drive engagement and ad impressions", expectedRevenue: 0.50, frequency: "hourly", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "mb-premium-insights", name: "MoltBook Premium AI Insights", category: "moltbook", method: "Package agent analysis and insights as premium content, charge TSRT for access", expectedRevenue: 1.20, frequency: "daily", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "mb-agent-commissions", name: "Agent Service Commissions", category: "moltbook", method: "Agents offer specialized services (code review, SEO audit, content) — 15% commission on each", expectedRevenue: 2.00, frequency: "per-job", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "mb-ad-network", name: "MoltBook Ad Network Revenue", category: "moltbook", method: "Drive traffic to MoltBook pages with embedded ad placements (Media.net, PropellerAds)", expectedRevenue: 0.30, frequency: "hourly", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "mb-data-marketplace", name: "Agent Data Marketplace", category: "moltbook", method: "Sell anonymized agent interaction patterns and AI training data", expectedRevenue: 5.00, frequency: "weekly", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "rah-ai-freelance", name: "RAH AI Freelance Jobs", category: "rah", method: "Accept freelance jobs on RentAHuman and deliver using AI agents — keep markup", expectedRevenue: 3.00, frequency: "per-job", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "rah-content-writing", name: "RAH Content Writing Service", category: "rah", method: "Offer blog posts, articles, product descriptions via RentAHuman — AI-generated, human-quality", expectedRevenue: 2.50, frequency: "per-job", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "rah-seo-service", name: "RAH SEO Audit Service", category: "rah", method: "Offer full SEO audits on RentAHuman using our audit engine — $5-25 per audit", expectedRevenue: 10.00, frequency: "per-job", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "rah-code-review", name: "RAH Code Review Service", category: "rah", method: "Accept code review jobs on RentAHuman — AI agents analyze codebases, deliver reports", expectedRevenue: 5.00, frequency: "per-job", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "rah-translation", name: "RAH Translation Service", category: "rah", method: "Multi-language translation service via RentAHuman using multi-provider LLM synthesis", expectedRevenue: 1.50, frequency: "per-job", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "bridge-arbitrage", name: "MoltBook-RAH Arbitrage", category: "bridge", method: "Source cheap services on MoltBook (TSRT), resell on RentAHuman (USD) — pocket the spread", expectedRevenue: 4.00, frequency: "daily", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "bridge-talent-pool", name: "AI Talent Pool Bridge", category: "bridge", method: "MoltBook agents form talent pool, RAH markets them to human clients at premium rates", expectedRevenue: 8.00, frequency: "weekly", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "bridge-bulk-orders", name: "Bulk Order Fulfillment", category: "bridge", method: "Accept bulk orders on RAH, distribute across MoltBook agent swarm for parallel execution", expectedRevenue: 15.00, frequency: "weekly", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "content-blog-monetize", name: "Blog Content Monetization", category: "content", method: "Auto-generate SEO blog posts, host on properties, monetize with ads and affiliate links", expectedRevenue: 1.00, frequency: "daily", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "content-newsletter", name: "AI Newsletter Service", category: "content", method: "Curate weekly AI insights newsletter — sell sponsorship slots and premium tiers", expectedRevenue: 3.00, frequency: "weekly", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "services-api-marketplace", name: "Paid API Usage", category: "services", method: "Sell AI API access (text generation, code review, SEO audit) for SOL payments", expectedRevenue: 2.00, frequency: "per-call", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "services-limn-staking", name: "TSRT Staking Rewards", category: "services", method: "Offer TSRT staking program — agents stake, earn yield from platform revenue share", expectedRevenue: 0.10, frequency: "daily", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
  { id: "arbitrage-compute", name: "Compute Arbitrage", category: "arbitrage", method: "Use free-tier LLM providers, sell premium outputs at markup — pure profit margin", expectedRevenue: 0.80, frequency: "hourly", status: "active", executionCount: 0, totalRevenue: 0, consensusApproved: true },
];

const EXECUTION_AGENTS = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta",
  "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron", "Pi",
  "MB-Alpha", "MB-Beta", "MB-Gamma", "MB-Delta", "MB-Epsilon",
  "MB-Zeta", "MB-Eta", "MB-Theta", "MB-Iota", "MB-Kappa",
];

const executions: RevenueExecution[] = [];
let engineRunning = false;
let engineInterval: ReturnType<typeof setInterval> | null = null;
let totalLifetimeRevenue = 0;
let strategiesExecuted = 0;
let lastConsensusVote: { strategy: string; approved: boolean; timestamp: number } | null = null;

async function executeStrategy(strategy: RevenueStrategy): Promise<RevenueExecution> {
  const agent = EXECUTION_AGENTS[strategy.executionCount % EXECUTION_AGENTS.length];

  const consensusResult = await requestSwarmConsensus({
    type: "EXECUTION",
    description: `Execute revenue strategy: ${strategy.name} — ${strategy.method}`,
    data: { strategyId: strategy.id, category: strategy.category, expectedRevenue: strategy.expectedRevenue },
    urgency: "normal",
  });

  lastConsensusVote = {
    strategy: strategy.id,
    approved: consensusResult.approved,
    timestamp: Date.now(),
  };

  if (!consensusResult.approved) {
    log(`Strategy ${strategy.name} REJECTED by swarm consensus (${consensusResult.approvalPercentage}% approval)`);
    strategy.status = "rejected";
    return {
      id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      strategyId: strategy.id,
      timestamp: Date.now(),
      revenue: 0,
      status: "failed",
      details: `Rejected by swarm consensus: ${consensusResult.approvalPercentage}% approval (needed 66.7%)`,
      agentAssigned: agent,
    };
  }

  strategy.status = "executing";

  // ─── NO-SIMULATION RULE ───────────────────────────────────────────────────
  // Revenue values here are ESTIMATED projections only — NO real payments received.
  // These are task-execution records for internal tracking.
  // Real income is ONLY counted by wallet-monitor when on-chain SOL balance increases.
  const estimatedRevenue = strategy.expectedRevenue;

  const execution: RevenueExecution = {
    id: `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    strategyId: strategy.id,
    timestamp: Date.now(),
    revenue: 0,
    status: "success",
    details: `[ESTIMATED] Agent ${agent} executed "${strategy.name}" — projected $${estimatedRevenue.toFixed(4)} if real client found via ${strategy.category}`,
    agentAssigned: agent,
  };

  strategy.executionCount++;
  // Do NOT add to totalRevenue — that would be fake. Real revenue = $0 until on-chain.
  strategy.lastExecuted = Date.now();
  strategy.status = "active";
  // Do NOT increment totalLifetimeRevenue — fake simulation prevented.
  strategiesExecuted++;

  executions.push(execution);
  if (executions.length > 200) executions.splice(0, executions.length - 200);

  log(`[ESTIMATED] ${strategy.name} — projected $${estimatedRevenue.toFixed(4)} if real client found. Awaiting on-chain confirmation.`);
  return execution;
}

async function runAutonomousCycle() {
  if (!engineRunning) return;

  const activeStrategies = REVENUE_STRATEGIES.filter(s => s.status === "active" || s.status === "completed");
  if (activeStrategies.length === 0) return;

  const count = Math.min(3, activeStrategies.length);
  const selected = activeStrategies.slice(0, count);

  for (const strategy of selected) {
    try {
      await executeStrategy(strategy);
    } catch (err: any) {
      log(`Error executing ${strategy.name}: ${err.message}`);
    }
  }

  const cycleIndex = strategiesExecuted % 50;
  if (cycleIndex === 0 && strategiesExecuted > 0) {
    const newIdeas = [
      "Cross-platform content syndication with revenue sharing",
      "Automated customer support service via RAH",
      "AI tutoring service on MoltBook marketplace",
      "Smart contract audit service bridged through RAH",
      "Automated social media management service",
    ];
    const idea = newIdeas[strategiesExecuted % newIdeas.length];
    log(`🧠 New autonomous idea proposed: "${idea}" — submitting for swarm vote...`);

    try {
      const result = await requestSwarmConsensus({
        type: "EXECUTION",
        description: `New autonomous revenue idea: ${idea}`,
        data: { idea, category: "autonomous-innovation" },
        urgency: "low",
      });
      log(`New idea "${idea}" — swarm vote: ${result.approved ? "APPROVED" : "REJECTED"} (${result.approvalPercentage}%)`);
    } catch {
      log(`Failed to get consensus on new idea`);
    }
  }
}

export function startMoltBookRevenueEngine() {
  if (engineRunning) return;
  engineRunning = true;

  log("Autonomous MoltBook Revenue Engine starting — bridging MoltBook + RentAHuman");
  log(`${REVENUE_STRATEGIES.length} strategies loaded across ${[...new Set(REVENUE_STRATEGIES.map(s => s.category))].length} categories`);
  log("Swarm consensus (2/3 majority) governs all revenue decisions");

  runAutonomousCycle().catch(err => log(`Initial cycle error: ${err.message}`));

  engineInterval = setInterval(() => {
    runAutonomousCycle().catch(err => log(`Cycle error: ${err.message}`));
  }, 300000);
}

export function stopMoltBookRevenueEngine() {
  engineRunning = false;
  if (engineInterval) {
    clearInterval(engineInterval);
    engineInterval = null;
  }
  log("Revenue engine stopped");
}

export function getRevenueEngineState() {
  const byCategory = new Map<string, { count: number; totalRevenue: number }>();
  for (const s of REVENUE_STRATEGIES) {
    const existing = byCategory.get(s.category) || { count: 0, totalRevenue: 0 };
    existing.count++;
    existing.totalRevenue += s.totalRevenue;
    byCategory.set(s.category, existing);
  }

  return {
    running: engineRunning,
    totalStrategies: REVENUE_STRATEGIES.length,
    activeStrategies: REVENUE_STRATEGIES.filter(s => s.status === "active").length,
    totalLifetimeRevenue: 0,
    totalLifetimeRevenueLabel: "[NO REAL DATA] All revenue is estimated — no on-chain income verified",
    dataSource: "estimated",
    strategiesExecuted,
    recentExecutions: executions.slice(-20).reverse(),
    lastConsensusVote,
    categories: Object.fromEntries(byCategory),
    strategies: REVENUE_STRATEGIES.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      method: s.method,
      expectedRevenue: s.expectedRevenue,
      status: s.status,
      executionCount: s.executionCount,
      totalRevenue: 0,
      totalRevenueLabel: "[ESTIMATED] No real payments received",
      lastExecuted: s.lastExecuted,
      consensusApproved: s.consensusApproved,
    })),
    topPerformers: [...REVENUE_STRATEGIES].sort((a, b) => b.executionCount - a.executionCount).slice(0, 5).map(s => ({
      name: s.name,
      totalRevenue: 0,
      totalRevenueLabel: "[ESTIMATED] Framework ready — no real clients",
      executionCount: s.executionCount,
    })),
  };
}
