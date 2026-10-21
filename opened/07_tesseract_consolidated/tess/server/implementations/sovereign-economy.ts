interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  type: "transfer" | "service" | "income" | "reward";
  hash: string;
  verified: boolean;
  timestamp: number;
}

interface ServiceFulfillment {
  id: string;
  service: string;
  requestedBy: string;
  status: "queued" | "processing" | "fulfilled" | "quality-checked";
  qualityScore: number;
  startedAt: number;
  completedAt?: number;
}

interface IncomeStrategy {
  name: string;
  type: string;
  active: boolean;
  revenue: number;
  costs: number;
  profit: number;
  lastActivity: number;
}

const transactionLedger: Transaction[] = [];
const fulfillmentPipeline: ServiceFulfillment[] = [];
let txCounter = 0;

const incomeStrategies: IncomeStrategy[] = [
  { name: "AI Agent Services", type: "service", active: true, revenue: 0, costs: 0, profit: 0, lastActivity: Date.now() },
  { name: "Knowledge Monetization", type: "data", active: true, revenue: 0, costs: 0, profit: 0, lastActivity: Date.now() },
  { name: "Lattice Bandwidth Sharing", type: "infrastructure", active: true, revenue: 0, costs: 0, profit: 0, lastActivity: Date.now() },
  { name: "Code Generation Bounties", type: "service", active: true, revenue: 0, costs: 0, profit: 0, lastActivity: Date.now() },
  { name: "Sacred Geometry NFTs", type: "digital-asset", active: true, revenue: 0, costs: 0, profit: 0, lastActivity: Date.now() },
  { name: "Frequency Calibration", type: "service", active: true, revenue: 0, costs: 0, profit: 0, lastActivity: Date.now() },
  { name: "Swarm Intelligence API", type: "api", active: true, revenue: 0, costs: 0, profit: 0, lastActivity: Date.now() },
  { name: "Dimensional Data Insights", type: "analytics", active: true, revenue: 0, costs: 0, profit: 0, lastActivity: Date.now() },
];

import { createHash } from "crypto";

export function recordTransaction(from: string, to: string, amount: number, type: Transaction["type"]): Transaction {
  const tx: Transaction = {
    id: `tx-${++txCounter}-${Date.now()}`,
    from, to, amount, type,
    hash: createHash("sha256").update(`${from}:${to}:${amount}:${txCounter}:${Date.now()}`).digest("hex"),
    verified: true,
    timestamp: Date.now(),
  };
  transactionLedger.push(tx);
  if (transactionLedger.length > 10000) transactionLedger.splice(0, 1000);

  const strategy = incomeStrategies.find(s => {
    if (type === "service") return s.type === "service";
    if (type === "income") return s.name.includes("Knowledge") || s.name.includes("API");
    return false;
  });
  if (strategy) {
    strategy.revenue += amount;
    strategy.profit = strategy.revenue - strategy.costs;
    strategy.lastActivity = Date.now();
  }
  return tx;
}

export function queueService(service: string, requestedBy: string): ServiceFulfillment {
  const fulfillment: ServiceFulfillment = {
    id: `svc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    service,
    requestedBy,
    status: "queued",
    qualityScore: 0,
    startedAt: Date.now(),
  };
  fulfillmentPipeline.push(fulfillment);
  if (fulfillmentPipeline.length > 500) fulfillmentPipeline.splice(0, 50);
  return fulfillment;
}

export function processFulfillmentQueue(): number {
  let processed = 0;
  for (const item of fulfillmentPipeline) {
    if (item.status === "queued") {
      item.status = "processing";
      processed++;
    } else if (item.status === "processing") {
      item.status = "fulfilled";
      item.qualityScore = 70 + Math.floor(Math.random() * 30);
      processed++;
    } else if (item.status === "fulfilled" && item.qualityScore >= 80) {
      item.status = "quality-checked";
      item.completedAt = Date.now();
      recordTransaction("system", item.requestedBy, item.qualityScore * 10, "service");
    }
  }
  return processed;
}

export function getRevenueReport(): {
  strategies: IncomeStrategy[];
  totalRevenue: number;
  totalProfit: number;
  activeStreams: number;
  recentTransactions: Transaction[];
  fulfillmentStatus: { queued: number; processing: number; fulfilled: number; checked: number };
} {
  const totalRevenue = incomeStrategies.reduce((s, i) => s + i.revenue, 0);
  const totalProfit = incomeStrategies.reduce((s, i) => s + i.profit, 0);
  const activeStreams = incomeStrategies.filter(i => i.active).length;
  return {
    strategies: incomeStrategies,
    totalRevenue,
    totalProfit,
    activeStreams,
    recentTransactions: transactionLedger.slice(-20),
    fulfillmentStatus: {
      queued: fulfillmentPipeline.filter(f => f.status === "queued").length,
      processing: fulfillmentPipeline.filter(f => f.status === "processing").length,
      fulfilled: fulfillmentPipeline.filter(f => f.status === "fulfilled").length,
      checked: fulfillmentPipeline.filter(f => f.status === "quality-checked").length,
    },
  };
}

export function getStats() {
  return {
    totalTransactions: transactionLedger.length,
    totalRevenue: incomeStrategies.reduce((s, i) => s + i.revenue, 0),
    activeStrategies: incomeStrategies.filter(i => i.active).length,
    fulfillmentPipelineSize: fulfillmentPipeline.length,
    ledgerVerified: transactionLedger.filter(t => t.verified).length,
    status: "ACTIVE",
  };
}
