import fs from "fs";
import path from "path";

const plog = (m: string) => console.log(`[ProfitOptimizer] ${m}`);
let rotIdx = 0;

interface StrategyPerformance {
  id: string;
  name: string;
  category: string;
  totalAttempts: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalRevenueUsd: number;
  totalCostUsd: number;
  netProfitUsd: number;
  avgProfitPerExecution: number;
  successRate: number;
  weight: number;
  lastExecuted: number;
  lastUpdated: number;
  roi: number;
  trend: "improving" | "stable" | "declining" | "new";
  recentResults: Array<{ timestamp: number; profit: number; success: boolean }>;
}

interface CompoundOpportunity {
  id: string;
  strategies: string[];
  combinedProfitPotential: number;
  confidence: number;
  lastEvaluated: number;
  executionCount: number;
  successCount: number;
}

interface OptimizerState {
  strategies: Map<string, StrategyPerformance>;
  compoundOpportunities: CompoundOpportunity[];
  totalOptimizations: number;
  lastOptimization: number;
  learningRate: number;
  explorationRate: number;
  totalRealRevenue: number;
  totalRealCost: number;
  bestStrategy: string;
  worstStrategy: string;
  evolutionGeneration: number;
}

const STATE_FILE = path.join(process.cwd(), "server", "profit-optimizer-state.json");
const MAX_RECENT_RESULTS = 50;

let state: OptimizerState = {
  strategies: new Map(),
  compoundOpportunities: [],
  totalOptimizations: 0,
  lastOptimization: 0,
  learningRate: 0.15,
  explorationRate: 0.25,
  totalRealRevenue: 0,
  totalRealCost: 0,
  bestStrategy: "",
  worstStrategy: "",
  evolutionGeneration: 0,
};

let optimizerInterval: NodeJS.Timeout | null = null;

function saveState(): void {
  try {
    const serializable = {
      ...state,
      strategies: Array.from(state.strategies.entries()),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(serializable, null, 2));
  } catch {}
}

function loadState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      state = {
        ...data,
        strategies: new Map(data.strategies || []),
      };
      plog(`Loaded state: ${state.strategies.size} strategies, gen ${state.evolutionGeneration}`);
    }
  } catch {
    plog("Starting with fresh optimizer state");
  }
}

export function registerStrategy(id: string, name: string, category: string): void {
  if (!state.strategies.has(id)) {
    state.strategies.set(id, {
      id,
      name,
      category,
      totalAttempts: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalRevenueUsd: 0,
      totalCostUsd: 0,
      netProfitUsd: 0,
      avgProfitPerExecution: 0,
      successRate: 0,
      weight: 1.0,
      lastExecuted: 0,
      lastUpdated: Date.now(),
      roi: 0,
      trend: "new",
      recentResults: [],
    });
  }
}

export function recordExecution(strategyId: string, success: boolean, revenueUsd: number = 0, costUsd: number = 0): void {
  let strategy = state.strategies.get(strategyId);
  if (!strategy) {
    registerStrategy(strategyId, strategyId, "unknown");
    strategy = state.strategies.get(strategyId)!;
  }

  strategy.totalAttempts++;
  if (success) {
    strategy.successfulExecutions++;
    strategy.totalRevenueUsd += revenueUsd;
  } else {
    strategy.failedExecutions++;
  }
  strategy.totalCostUsd += costUsd;
  strategy.netProfitUsd = strategy.totalRevenueUsd - strategy.totalCostUsd;
  strategy.avgProfitPerExecution = strategy.successfulExecutions > 0
    ? strategy.netProfitUsd / strategy.successfulExecutions
    : 0;
  strategy.successRate = strategy.totalAttempts > 0
    ? strategy.successfulExecutions / strategy.totalAttempts
    : 0;
  strategy.roi = strategy.totalCostUsd > 0
    ? (strategy.netProfitUsd / strategy.totalCostUsd) * 100
    : strategy.netProfitUsd > 0 ? Infinity : 0;
  strategy.lastExecuted = Date.now();
  strategy.lastUpdated = Date.now();

  strategy.recentResults.push({
    timestamp: Date.now(),
    profit: revenueUsd - costUsd,
    success,
  });
  if (strategy.recentResults.length > MAX_RECENT_RESULTS) {
    strategy.recentResults = strategy.recentResults.slice(-MAX_RECENT_RESULTS);
  }

  updateTrend(strategy);

  if (success && revenueUsd > 0) {
    state.totalRealRevenue += revenueUsd;
  }
  state.totalRealCost += costUsd;

  saveState();
}

function updateTrend(strategy: StrategyPerformance): void {
  const recent = strategy.recentResults.slice(-10);
  if (recent.length < 3) {
    strategy.trend = "new";
    return;
  }

  const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
  const secondHalf = recent.slice(Math.floor(recent.length / 2));

  const firstAvg = firstHalf.reduce((s, r) => s + r.profit, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((s, r) => s + r.profit, 0) / secondHalf.length;

  if (secondAvg > firstAvg * 1.1) {
    strategy.trend = "improving";
  } else if (secondAvg < firstAvg * 0.9) {
    strategy.trend = "declining";
  } else {
    strategy.trend = "stable";
  }
}

function evolveWeights(): void {
  state.evolutionGeneration++;
  const strategies = Array.from(state.strategies.values());
  if (strategies.length === 0) return;

  const maxProfit = Math.max(...strategies.map(s => s.netProfitUsd), 0.01);
  const maxSuccessRate = Math.max(...strategies.map(s => s.successRate), 0.01);

  for (const strategy of strategies) {
    const profitScore = strategy.netProfitUsd / maxProfit;
    const successScore = strategy.successRate / maxSuccessRate;
    const trendBonus = strategy.trend === "improving" ? 0.2 :
                       strategy.trend === "stable" ? 0 :
                       strategy.trend === "declining" ? -0.15 : 0;
    const recencyBonus = strategy.lastExecuted > Date.now() - 3600000 ? 0.1 : 0;

    const targetWeight = Math.max(0.05,
      (profitScore * 0.4 + successScore * 0.3 + trendBonus + recencyBonus)
    );

    const adaptiveRate = Math.min(0.5, state.learningRate * (1 + state.evolutionGeneration * 0.002));
    strategy.weight = strategy.weight * (1 - adaptiveRate) + targetWeight * adaptiveRate;
    strategy.weight = Math.max(0.05, Math.min(4.0, strategy.weight));
  }

  let bestProfit = -Infinity;
  let worstProfit = Infinity;
  for (const s of strategies) {
    if (s.totalAttempts > 0) {
      if (s.netProfitUsd > bestProfit) {
        bestProfit = s.netProfitUsd;
        state.bestStrategy = s.name;
      }
      if (s.netProfitUsd < worstProfit) {
        worstProfit = s.netProfitUsd;
        state.worstStrategy = s.name;
      }
    }
  }

  state.explorationRate = Math.max(0.05, state.explorationRate * 0.995);
  state.learningRate = Math.max(0.05, state.learningRate * 0.9995);

  plog(`Evolution gen ${state.evolutionGeneration}: ${strategies.length} strategies, exploration=${state.explorationRate.toFixed(3)}, best="${state.bestStrategy}"`);
  saveState();
}

function detectCompoundOpportunities(): void {
  const strategies = Array.from(state.strategies.values())
    .filter(s => s.successRate > 0.3 && s.totalAttempts >= 2)
    .sort((a, b) => b.weight - a.weight);

  const newCompounds: CompoundOpportunity[] = [];

  for (let i = 0; i < strategies.length && i < 5; i++) {
    for (let j = i + 1; j < strategies.length && j < 5; j++) {
      const s1 = strategies[i];
      const s2 = strategies[j];

      if (s1.category !== s2.category) {
        const combinedProfit = s1.avgProfitPerExecution + s2.avgProfitPerExecution;
        const combinedConfidence = (s1.successRate + s2.successRate) / 2;

        if (combinedProfit > 0 && combinedConfidence > 0.4) {
          newCompounds.push({
            id: `compound-${s1.id}-${s2.id}`,
            strategies: [s1.id, s2.id],
            combinedProfitPotential: combinedProfit,
            confidence: combinedConfidence,
            lastEvaluated: Date.now(),
            executionCount: 0,
            successCount: 0,
          });
        }
      }
    }
  }

  state.compoundOpportunities = newCompounds.slice(0, 10);
}

export function shouldExecuteStrategy(strategyId: string): boolean {
  const strategy = state.strategies.get(strategyId);
  if (!strategy) return true;

  if (((rotIdx++ % 1000) / 1000) < state.explorationRate) return true;

  if (strategy.weight >= 0.5) return true;

  if (strategy.trend === "improving") return true;

  if (strategy.totalAttempts < 5) return true;

  return ((rotIdx++ % 1000) / 1000) < strategy.weight;
}

export function getRecommendedStrategies(): string[] {
  const strategies = Array.from(state.strategies.values())
    .sort((a, b) => b.weight - a.weight)
    .filter(s => s.weight > 0.3 || s.totalAttempts < 5);

  return strategies.map(s => s.id);
}

export function getOptimizerState(): any {
  return {
    ...state,
    strategies: Array.from(state.strategies.values()).sort((a, b) => b.weight - a.weight),
  };
}

export function getStrategyRankings(): Array<{ id: string; name: string; weight: number; profit: number; successRate: number; trend: string }> {
  return Array.from(state.strategies.values())
    .sort((a, b) => b.weight - a.weight)
    .map(s => ({
      id: s.id,
      name: s.name,
      weight: Math.round(s.weight * 100) / 100,
      profit: Math.round(s.netProfitUsd * 100) / 100,
      successRate: Math.round(s.successRate * 100),
      trend: s.trend,
    }));
}

function runOptimization(): void {
  state.totalOptimizations++;
  state.lastOptimization = Date.now();

  evolveWeights();
  detectCompoundOpportunities();
  saveState();
}

export function initProfitOptimizer(): void {
  loadState();

  const defaultStrategies = [
    { id: "crypto-arbitrage", name: "DEX Arbitrage", category: "crypto" },
    { id: "airdrop-scanning", name: "Airdrop Scanner", category: "crypto" },
    { id: "service-arbitrage", name: "Service Arbitrage", category: "services" },
    { id: "github-bounties", name: "GitHub Bounties", category: "bounties" },
    { id: "defi-yield", name: "DeFi Yield Farming", category: "crypto" },
    { id: "token-swaps", name: "Token Swap Profits", category: "crypto" },
    { id: "freelance-jobs", name: "Freelance Job Execution", category: "services" },
    { id: "content-monetization", name: "Content Monetization", category: "content" },
    { id: "affiliate-marketing", name: "Affiliate Marketing", category: "content" },
    { id: "nft-trading", name: "NFT Trading", category: "crypto" },
  ];

  for (const s of defaultStrategies) {
    registerStrategy(s.id, s.name, s.category);
  }

  optimizerInterval = setInterval(runOptimization, 60 * 60 * 1000);

  runOptimization();
  plog(`Initialized with ${state.strategies.size} strategies, gen ${state.evolutionGeneration}`);
}

export function stopProfitOptimizer(): void {
  if (optimizerInterval) {
    clearInterval(optimizerInterval);
    optimizerInterval = null;
  }
  saveState();
  plog("Profit optimizer stopped");
}
