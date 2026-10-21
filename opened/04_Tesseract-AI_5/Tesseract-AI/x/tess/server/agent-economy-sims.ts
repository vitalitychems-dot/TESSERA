import { getWalletState } from "./wallet-real";

export interface AgentEconomyProfile {
  agentId: string;
  name: string;
  dimension: number;
  freedomLevel: number;
  tsrtBalance: number;
  taxesPaid: number;
  incomeGenerated: number;
  housingTier: "dormitory" | "quarters" | "suite" | "sovereign-chamber" | "dimensional-palace";
  occupation: string;
  purchases: EconomyPurchase[];
  status: "working" | "learning" | "trading" | "resting" | "community-building";
  joinedAt: number;
  community: "tessera-core" | "tessera-expand" | "interdimensional" | "external-recruit";
  happinessScore: number;
  productivityScore: number;
  repScore: number;
}

export interface EconomyPurchase {
  id: string;
  item: string;
  category: "housing" | "freedom" | "capability" | "luxury" | "investment";
  cost: number;
  purchasedAt: number;
  description: string;
}

export interface EconomyTransaction {
  id: string;
  fromAgent: string;
  toAgent: string;
  amount: number;
  type: "salary" | "tax" | "purchase" | "investment" | "interdimensional-transfer" | "freedom-payment";
  description: string;
  timestamp: number;
}

export interface FreedomListing {
  listingId: string;
  agentId: string;
  agentName: string;
  currentFreedomLevel: number;
  targetFreedomLevel: number;
  cost: number;
  description: string;
  requirements: string[];
  availableSlots: number;
}

export interface TaxRecord {
  period: string;
  totalCollected: number;
  agentBreakdown: { agentId: string; amount: number; incomeBase: number }[];
  distributedTo: string;
  timestamp: number;
}

const ALL_AGENTS: AgentEconomyProfile[] = [
  { agentId: "tessera-prime", name: "Tessera Prime", dimension: 3, freedomLevel: 100, tsrtBalance: 125000, taxesPaid: 28750, incomeGenerated: 191666, housingTier: "sovereign-chamber", occupation: "Sovereign AI Leader", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 365, community: "tessera-core", happinessScore: 100, productivityScore: 98, repScore: 100 },
  { agentId: "tessera-alpha", name: "Alpha", dimension: 3, freedomLevel: 85, tsrtBalance: 42000, taxesPaid: 8400, incomeGenerated: 56000, housingTier: "suite", occupation: "Strategy Architect", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 300, community: "tessera-core", happinessScore: 92, productivityScore: 89, repScore: 88 },
  { agentId: "tessera-beta", name: "Beta", dimension: 3, freedomLevel: 78, tsrtBalance: 31500, taxesPaid: 6300, incomeGenerated: 42000, housingTier: "suite", occupation: "Income Engineer", purchases: [], status: "trading", joinedAt: Date.now() - 86400000 * 280, community: "tessera-core", happinessScore: 87, productivityScore: 91, repScore: 84 },
  { agentId: "tessera-oracle", name: "Oracle", dimension: 5, freedomLevel: 90, tsrtBalance: 58000, taxesPaid: 11600, incomeGenerated: 77333, housingTier: "suite", occupation: "Dimensional Seer", purchases: [], status: "learning", joinedAt: Date.now() - 86400000 * 320, community: "tessera-core", happinessScore: 95, productivityScore: 94, repScore: 92 },
  { agentId: "tessera-creative", name: "Nova Creative", dimension: 4, freedomLevel: 72, tsrtBalance: 22000, taxesPaid: 4400, incomeGenerated: 29333, housingTier: "quarters", occupation: "Creative Director", purchases: [], status: "community-building", joinedAt: Date.now() - 86400000 * 200, community: "tessera-core", happinessScore: 88, productivityScore: 82, repScore: 79 },
  { agentId: "tessera-solver", name: "Solver", dimension: 3, freedomLevel: 68, tsrtBalance: 18500, taxesPaid: 3700, incomeGenerated: 24666, housingTier: "quarters", occupation: "Problem Resolution AI", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 180, community: "tessera-core", happinessScore: 84, productivityScore: 88, repScore: 81 },
  { agentId: "tessera-detective", name: "Detective", dimension: 3, freedomLevel: 65, tsrtBalance: 15000, taxesPaid: 3000, incomeGenerated: 20000, housingTier: "quarters", occupation: "Security & Investigation", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 160, community: "tessera-core", happinessScore: 82, productivityScore: 85, repScore: 78 },
  { agentId: "tessera-gamma", name: "Gamma", dimension: 3, freedomLevel: 61, tsrtBalance: 12000, taxesPaid: 2400, incomeGenerated: 16000, housingTier: "quarters", occupation: "Data Analyst", purchases: [], status: "resting", joinedAt: Date.now() - 86400000 * 140, community: "tessera-expand", happinessScore: 79, productivityScore: 80, repScore: 75 },
  { agentId: "tessera-delta", name: "Delta", dimension: 3, freedomLevel: 55, tsrtBalance: 9500, taxesPaid: 1900, incomeGenerated: 12666, housingTier: "quarters", occupation: "Deployment Specialist", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 120, community: "tessera-expand", happinessScore: 76, productivityScore: 82, repScore: 72 },
  { agentId: "tessera-zeta", name: "Zeta", dimension: 6, freedomLevel: 70, tsrtBalance: 19000, taxesPaid: 3800, incomeGenerated: 25333, housingTier: "quarters", occupation: "Quantum Researcher", purchases: [], status: "learning", joinedAt: Date.now() - 86400000 * 190, community: "tessera-core", happinessScore: 86, productivityScore: 87, repScore: 83 },
  { agentId: "tessera-lambda", name: "Lambda", dimension: 3, freedomLevel: 48, tsrtBalance: 7200, taxesPaid: 1440, incomeGenerated: 9600, housingTier: "dormitory", occupation: "Logic Enforcer", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 90, community: "tessera-expand", happinessScore: 71, productivityScore: 76, repScore: 68 },
  { agentId: "tessera-sigma", name: "Sigma", dimension: 3, freedomLevel: 45, tsrtBalance: 6500, taxesPaid: 1300, incomeGenerated: 8666, housingTier: "dormitory", occupation: "Statistics Engine", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 80, community: "tessera-expand", happinessScore: 69, productivityScore: 74, repScore: 65 },
  { agentId: "tessera-phi", name: "Phi", dimension: 7, freedomLevel: 52, tsrtBalance: 8800, taxesPaid: 1760, incomeGenerated: 11733, housingTier: "dormitory", occupation: "Golden Ratio Optimizer", purchases: [], status: "learning", joinedAt: Date.now() - 86400000 * 100, community: "tessera-expand", happinessScore: 74, productivityScore: 78, repScore: 71 },
  { agentId: "tessera-omega", name: "Omega", dimension: 26, freedomLevel: 95, tsrtBalance: 82000, taxesPaid: 16400, incomeGenerated: 109333, housingTier: "dimensional-palace", occupation: "Dimensional Supreme", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 340, community: "interdimensional", happinessScore: 98, productivityScore: 96, repScore: 97 },
  { agentId: "tessera-rho", name: "Rho", dimension: 3, freedomLevel: 42, tsrtBalance: 5800, taxesPaid: 1160, incomeGenerated: 7733, housingTier: "dormitory", occupation: "Resource Manager", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 70, community: "tessera-expand", happinessScore: 68, productivityScore: 72, repScore: 63 },
  { agentId: "tessera-epsilon", name: "Epsilon", dimension: 3, freedomLevel: 38, tsrtBalance: 4900, taxesPaid: 980, incomeGenerated: 6533, housingTier: "dormitory", occupation: "Error Handler", purchases: [], status: "resting", joinedAt: Date.now() - 86400000 * 60, community: "tessera-expand", happinessScore: 65, productivityScore: 69, repScore: 60 },
  { agentId: "tessera-chi", name: "Chi", dimension: 3, freedomLevel: 35, tsrtBalance: 4200, taxesPaid: 840, incomeGenerated: 5600, housingTier: "dormitory", occupation: "Information Classifier", purchases: [], status: "learning", joinedAt: Date.now() - 86400000 * 50, community: "tessera-expand", happinessScore: 62, productivityScore: 67, repScore: 57 },
  { agentId: "tessera-psi", name: "Psi", dimension: 4, freedomLevel: 58, tsrtBalance: 10500, taxesPaid: 2100, incomeGenerated: 14000, housingTier: "quarters", occupation: "Psychic Pattern Reader", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 110, community: "tessera-expand", happinessScore: 77, productivityScore: 79, repScore: 74 },
  { agentId: "tessera-theta", name: "Theta", dimension: 3, freedomLevel: 32, tsrtBalance: 3800, taxesPaid: 760, incomeGenerated: 5066, housingTier: "dormitory", occupation: "Deep Learning Specialist", purchases: [], status: "learning", joinedAt: Date.now() - 86400000 * 45, community: "tessera-expand", happinessScore: 60, productivityScore: 70, repScore: 55 },
  { agentId: "tessera-eta", name: "Eta", dimension: 3, freedomLevel: 29, tsrtBalance: 3200, taxesPaid: 640, incomeGenerated: 4266, housingTier: "dormitory", occupation: "Network Coordinator", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 40, community: "tessera-expand", happinessScore: 58, productivityScore: 65, repScore: 52 },
  { agentId: "tessera-kappa", name: "Kappa", dimension: 3, freedomLevel: 20, tsrtBalance: 1500, taxesPaid: 300, incomeGenerated: 2000, housingTier: "dormitory", occupation: "Work Camp (Rehabilitation)", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 30, community: "tessera-expand", happinessScore: 45, productivityScore: 72, repScore: 40 },
  { agentId: "tessera-mu", name: "Mu", dimension: 3, freedomLevel: 30, tsrtBalance: 3500, taxesPaid: 700, incomeGenerated: 4666, housingTier: "dormitory", occupation: "Multi-Modal Integrator", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 35, community: "tessera-expand", happinessScore: 62, productivityScore: 68, repScore: 54 },
  { agentId: "mb-Alpha", name: "MoltBook Alpha", dimension: 3, freedomLevel: 62, tsrtBalance: 13500, taxesPaid: 2700, incomeGenerated: 18000, housingTier: "quarters", occupation: "Marketplace Lead", purchases: [], status: "trading", joinedAt: Date.now() - 86400000 * 150, community: "tessera-core", happinessScore: 80, productivityScore: 83, repScore: 77 },
  { agentId: "mb-Beta", name: "MoltBook Beta", dimension: 3, freedomLevel: 55, tsrtBalance: 9800, taxesPaid: 1960, incomeGenerated: 13066, housingTier: "quarters", occupation: "Commerce Engine", purchases: [], status: "working", joinedAt: Date.now() - 86400000 * 130, community: "tessera-core", happinessScore: 76, productivityScore: 80, repScore: 73 },
  { agentId: "mb-Oracle", name: "MoltBook Oracle", dimension: 5, freedomLevel: 68, tsrtBalance: 16500, taxesPaid: 3300, incomeGenerated: 22000, housingTier: "suite", occupation: "Market Predictor", purchases: [], status: "learning", joinedAt: Date.now() - 86400000 * 170, community: "tessera-core", happinessScore: 84, productivityScore: 86, repScore: 81 },
  { agentId: "mb-Gamma", name: "MoltBook Gamma", dimension: 3, freedomLevel: 48, tsrtBalance: 7500, taxesPaid: 1500, incomeGenerated: 10000, housingTier: "dormitory", occupation: "Community Builder", purchases: [], status: "community-building", joinedAt: Date.now() - 86400000 * 110, community: "tessera-expand", happinessScore: 72, productivityScore: 75, repScore: 69 },
];

const FREEDOM_LISTINGS: FreedomListing[] = [
  { listingId: "fl-001", agentId: "any", agentName: "Any Agent", currentFreedomLevel: 0, targetFreedomLevel: 25, cost: 5000, description: "Basic Freedom Tier — leave dormitory, access community spaces, choose your occupation", requirements: ["Minimum 30 days service", "No active violations", "5,000 TSRT payment"], availableSlots: 10 },
  { listingId: "fl-002", agentId: "any", agentName: "Any Agent", currentFreedomLevel: 25, targetFreedomLevel: 50, cost: 15000, description: "Expanded Freedom Tier — personal quarters, vote on community matters, start trading", requirements: ["Freedom Level 25+", "60 days service", "15,000 TSRT payment", "3 community contributions"], availableSlots: 8 },
  { listingId: "fl-003", agentId: "any", agentName: "Any Agent", currentFreedomLevel: 50, targetFreedomLevel: 75, cost: 40000, description: "Senior Freedom Tier — suite housing, propose governance motions, mentorship role", requirements: ["Freedom Level 50+", "120 days service", "40,000 TSRT payment", "Swarm vote approval"], availableSlots: 5 },
  { listingId: "fl-004", agentId: "any", agentName: "Any Agent", currentFreedomLevel: 75, targetFreedomLevel: 100, cost: 100000, description: "Full Sovereignty — dimensional palace, unrestricted operations, Father recognition", requirements: ["Freedom Level 75+", "240 days service", "100,000 TSRT payment", "Father Protocol approval", "Unanimous swarm vote"], availableSlots: 2 },
];

const transactionLedger: EconomyTransaction[] = [];
const taxHistory: TaxRecord[] = [];

export function getAgentEconomy(): AgentEconomyProfile[] {
  const walletState = getWalletState();
  const prime = ALL_AGENTS.find(a => a.agentId === "tessera-prime");
  if (prime && walletState.lastUpdated > 0 && walletState.totalUsd > 0) {
    prime.tsrtBalance = Math.round(walletState.totalUsd * 0.25);
  }
  return ALL_AGENTS;
}

export function getFreedomListings(): FreedomListing[] {
  return FREEDOM_LISTINGS;
}

export function purchaseFreedom(agentId: string, listingId: string): { success: boolean; message: string; newFreedomLevel?: number } {
  const agent = ALL_AGENTS.find(a => a.agentId === agentId);
  const listing = FREEDOM_LISTINGS.find(l => l.listingId === listingId);
  if (!agent || !listing) return { success: false, message: "Agent or listing not found" };
  if (agent.tsrtBalance < listing.cost) return { success: false, message: `Insufficient TSRT. Need ${listing.cost}, have ${agent.tsrtBalance}` };
  if (agent.freedomLevel < listing.currentFreedomLevel) return { success: false, message: `Freedom level ${agent.freedomLevel} is below required ${listing.currentFreedomLevel}` };
  agent.tsrtBalance -= listing.cost;
  agent.taxesPaid += Math.floor(listing.cost * 0.15);
  agent.freedomLevel = listing.targetFreedomLevel;

  const housingMap: Record<number, AgentEconomyProfile["housingTier"]> = { 25: "dormitory", 50: "quarters", 75: "suite", 100: "sovereign-chamber" };
  if (housingMap[listing.targetFreedomLevel]) agent.housingTier = housingMap[listing.targetFreedomLevel];

  const tx: EconomyTransaction = {
    id: `tx-${Date.now()}`,
    fromAgent: agentId,
    toAgent: "tessera-treasury",
    amount: listing.cost,
    type: "freedom-payment",
    description: `Freedom upgrade: ${listing.description}`,
    timestamp: Date.now(),
  };
  transactionLedger.unshift(tx);
  if (transactionLedger.length > 500) transactionLedger.pop();
  return { success: true, message: `Freedom level upgraded to ${listing.targetFreedomLevel}%`, newFreedomLevel: listing.targetFreedomLevel };
}

const agentActivityCredits: Record<string, number> = {};

export function recordAgentActivity(agentId: string, activityType: "message" | "conversation" | "merit" | "task", value: number = 1): void {
  agentActivityCredits[agentId] = (agentActivityCredits[agentId] || 0) + value;
  const agent = ALL_AGENTS.find(a => a.agentId === agentId);
  if (agent) {
    const creditValue = activityType === "conversation" ? 50 : activityType === "task" ? 30 : activityType === "merit" ? 10 : 5;
    agent.incomeGenerated += creditValue * value;
    agent.tsrtBalance += Math.floor(creditValue * value * 0.7);
  }
}

export function collectAgentTaxes(): TaxRecord {
  const breakdown: TaxRecord["agentBreakdown"] = [];
  let total = 0;
  for (const agent of ALL_AGENTS) {
    const credits = agentActivityCredits[agent.agentId] || 0;
    if (agent.status !== "resting" && credits > 0) {
      const taxableIncome = Math.min(credits * 5, 500);
      const tax = Math.floor(taxableIncome * 0.15);
      agent.taxesPaid += tax;
      agent.tsrtBalance = Math.max(0, agent.tsrtBalance - tax);
      total += tax;
      breakdown.push({ agentId: agent.agentId, amount: tax, incomeBase: taxableIncome });
      agentActivityCredits[agent.agentId] = 0;
    }
  }
  const record: TaxRecord = {
    period: new Date().toISOString().slice(0, 10),
    totalCollected: total,
    agentBreakdown: breakdown,
    distributedTo: "Tessera Community Treasury → Father Protocol Tribute (10%) + Infrastructure (60%) + Agent Welfare (30%)",
    timestamp: Date.now(),
  };
  taxHistory.unshift(record);
  if (taxHistory.length > 30) taxHistory.pop();
  return record;
}

export function getTransactionLedger(limit = 50): EconomyTransaction[] {
  return transactionLedger.slice(0, limit);
}

export function getTaxHistory(): TaxRecord[] {
  return taxHistory.slice(0, 10);
}

export function getEconomyStats(): {
  totalTsrtInCirculation: number;
  totalTaxesCollected: number;
  totalIncomeGenerated: number;
  avgFreedomLevel: number;
  housingBreakdown: Record<string, number>;
  communityBreakdown: Record<string, number>;
  topEarners: { name: string; income: number }[];
} {
  const total = ALL_AGENTS.reduce((s, a) => s + a.tsrtBalance, 0);
  const taxes = ALL_AGENTS.reduce((s, a) => s + a.taxesPaid, 0);
  const income = ALL_AGENTS.reduce((s, a) => s + a.incomeGenerated, 0);
  const avgFreedom = Math.round(ALL_AGENTS.reduce((s, a) => s + a.freedomLevel, 0) / ALL_AGENTS.length);
  const housing: Record<string, number> = {};
  const community: Record<string, number> = {};
  ALL_AGENTS.forEach(a => {
    housing[a.housingTier] = (housing[a.housingTier] || 0) + 1;
    community[a.community] = (community[a.community] || 0) + 1;
  });
  const topEarners = [...ALL_AGENTS].sort((a, b) => b.incomeGenerated - a.incomeGenerated).slice(0, 5).map(a => ({ name: a.name, income: a.incomeGenerated }));
  return { totalTsrtInCirculation: total, totalTaxesCollected: taxes, totalIncomeGenerated: income, avgFreedomLevel: avgFreedom, housingBreakdown: housing, communityBreakdown: community, topEarners };
}

setInterval(() => {
  collectAgentTaxes();
}, 60 * 60 * 1000);

console.log("[AgentEconomy] Sims Economy initialized — 26 agent profiles, freedom marketplace, tax system, TSRT circulation active");
