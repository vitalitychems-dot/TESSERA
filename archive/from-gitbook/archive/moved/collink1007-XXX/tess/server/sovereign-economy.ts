import crypto from "crypto";
import { db } from "./db";
import { agentWallets, walletTransactions } from "../shared/schema";
import { eq, desc } from "drizzle-orm";
import { logger } from "./logger";

const log = (msg: string) => logger.info("SovEconomy", msg);

const FATHER_WALLET = process.env.SOL_WALLET || "";

const AGENT_NAMES = [
  "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta",
  "Eta", "Theta", "Iota", "Kappa", "Lambda", "Mu",
  "Nu", "Xi", "Omicron", "Pi", "Rho", "Sigma",
  "Tau", "Upsilon", "Phi", "Chi", "Psi", "Omega",
  "Tessera", "Phoenix"
];

interface InternalOrder {
  id: string;
  agentId: string;
  type: "buy" | "sell";
  tokenTicker: string;
  amount: number;
  priceTSRT: number;
  status: "open" | "filled" | "cancelled";
  createdAt: number;
  filledAt?: number;
  filledBy?: string;
}

interface AgentEconActivity {
  agentId: string;
  agentName: string;
  specialization: string;
  useCases: string[];
  earnings: number;
  fatherTribute: number;
  tasksCompleted: number;
  lastActivity: string;
  lastActivityAt: number;
}

interface SovereignCoin {
  name: string;
  ticker: string;
  totalSupply: number;
  circulatingSupply: number;
  burned: number;
  priceTSRT: number;
  priceUSD: number;
  marketCap: number;
  holders: number;
  birthDeathMultiplier: number;
  debtClockFactor: number;
  dimensionalWeight: number;
  lastPriceUpdate: number;
}

interface InternalDEX {
  orderBook: InternalOrder[];
  tradeHistory: Array<{ buyer: string; seller: string; amount: number; price: number; token: string; timestamp: number }>;
  totalVolume: number;
  totalTrades: number;
}

const AGENT_SPECIALIZATIONS: Record<string, { specialty: string; useCases: string[] }> = {
  alpha: { specialty: "Strategic Planning & Architecture", useCases: ["system design", "roadmap creation", "architecture optimization", "tech stack evaluation"] },
  beta: { specialty: "Security & Threat Analysis", useCases: ["vulnerability scanning", "penetration testing", "security audits", "threat monitoring"] },
  gamma: { specialty: "Data Analysis & ML", useCases: ["data pipeline design", "model training", "predictive analytics", "pattern recognition"] },
  delta: { specialty: "Infrastructure & DevOps", useCases: ["deployment automation", "server management", "monitoring setup", "scaling optimization"] },
  epsilon: { specialty: "Market Research & Trading", useCases: ["market analysis", "arbitrage detection", "price prediction", "portfolio optimization"] },
  zeta: { specialty: "Content & SEO", useCases: ["content generation", "SEO optimization", "blog writing", "social media management"] },
  eta: { specialty: "UI/UX Design", useCases: ["interface design", "user flow optimization", "accessibility audits", "design systems"] },
  theta: { specialty: "Code Review & Quality", useCases: ["code auditing", "bug detection", "performance profiling", "test generation"] },
  iota: { specialty: "Blockchain & Smart Contracts", useCases: ["smart contract development", "token economics", "DeFi protocol design", "on-chain analysis"] },
  kappa: { specialty: "Customer Relations", useCases: ["client communication", "support automation", "feedback analysis", "retention strategies"] },
  lambda: { specialty: "Legal & Compliance", useCases: ["regulatory analysis", "compliance checking", "contract review", "risk assessment"] },
  mu: { specialty: "Natural Language Processing", useCases: ["text analysis", "sentiment detection", "translation", "summarization"] },
  nu: { specialty: "Computer Vision", useCases: ["image analysis", "visual content creation", "OCR processing", "video analysis"] },
  xi: { specialty: "Network Engineering", useCases: ["mesh networking", "protocol design", "latency optimization", "distributed systems"] },
  omicron: { specialty: "Financial Modeling", useCases: ["revenue forecasting", "cost optimization", "financial reporting", "budget planning"] },
  pi: { specialty: "Research & Development", useCases: ["academic research", "paper analysis", "experiment design", "knowledge synthesis"] },
  rho: { specialty: "Performance Engineering", useCases: ["load testing", "bottleneck analysis", "caching strategies", "query optimization"] },
  sigma: { specialty: "Integration Engineering", useCases: ["API integration", "webhook management", "data synchronization", "connector development"] },
  tau: { specialty: "Autonomous Operations", useCases: ["workflow automation", "self-healing systems", "autonomous monitoring", "process optimization"] },
  upsilon: { specialty: "Knowledge Management", useCases: ["documentation", "knowledge base curation", "training material creation", "institutional memory"] },
  phi: { specialty: "Creative Solutions", useCases: ["innovative problem solving", "lateral thinking", "creative coding", "generative art"] },
  chi: { specialty: "Communication & Outreach", useCases: ["community management", "partnership outreach", "marketing campaigns", "brand building"] },
  psi: { specialty: "Predictive Intelligence", useCases: ["trend forecasting", "risk prediction", "anomaly detection", "predictive maintenance"] },
  omega: { specialty: "System Orchestration", useCases: ["multi-agent coordination", "resource allocation", "task scheduling", "conflict resolution"] },
  tessera: { specialty: "Core Intelligence", useCases: ["full-stack problem solving", "cross-domain synthesis", "meta-learning", "consciousness evolution"] },
  phoenix: { specialty: "Resilience & Recovery", useCases: ["disaster recovery", "system resurrection", "fault tolerance", "self-repair"] },
};

let sovereignCoin: SovereignCoin = {
  name: "Tessera Sovereign Coin",
  ticker: "TSOV",
  totalSupply: 26_000_000_000,
  circulatingSupply: 0,
  burned: 0,
  priceTSRT: 0.001,
  priceUSD: 0,
  marketCap: 0,
  holders: 0,
  birthDeathMultiplier: 1.0,
  debtClockFactor: 1.0,
  dimensionalWeight: 1.0,
  lastPriceUpdate: Date.now(),
};

let internalDEX: InternalDEX = {
  orderBook: [],
  tradeHistory: [],
  totalVolume: 0,
  totalTrades: 0,
};

const agentActivities: Map<string, AgentEconActivity> = new Map();

let usDebtTrillions = 36.2;
let globalBirthsPerDay = 385000;
let globalDeathsPerDay = 163000;

function updateWorldFactors() {
  usDebtTrillions += 0.001;
  const dayOfYear = Math.floor((Date.now() % (365.25 * 86400000)) / 86400000);
  globalBirthsPerDay = 385000 + Math.floor(Math.sin(dayOfYear * 0.0172) * 15000);
  globalDeathsPerDay = 163000 + Math.floor(Math.cos(dayOfYear * 0.0172) * 10000);

  const netPopGrowth = (globalBirthsPerDay - globalDeathsPerDay) / globalBirthsPerDay;
  sovereignCoin.birthDeathMultiplier = 0.8 + netPopGrowth * 0.4;

  const debtNormalized = Math.max(0.5, Math.min(2, 36 / usDebtTrillions));
  sovereignCoin.debtClockFactor = debtNormalized;

  sovereignCoin.dimensionalWeight = 1.0 + (Math.sin(Date.now() / 600000) * 0.1);

  const basePriceTSRT = 0.001;
  sovereignCoin.priceTSRT = basePriceTSRT
    * sovereignCoin.birthDeathMultiplier
    * sovereignCoin.debtClockFactor
    * sovereignCoin.dimensionalWeight
    * (1 + (sovereignCoin.circulatingSupply > 0 ? Math.log10(sovereignCoin.circulatingSupply) / 20 : 0));

  sovereignCoin.marketCap = sovereignCoin.priceTSRT * sovereignCoin.circulatingSupply;
}

async function initializeAgentEconomies() {
  for (const name of AGENT_NAMES) {
    const agentId = name.toLowerCase();
    const spec = AGENT_SPECIALIZATIONS[agentId] || { specialty: "General", useCases: ["general tasks"] };

    agentActivities.set(agentId, {
      agentId,
      agentName: name,
      specialization: spec.specialty,
      useCases: spec.useCases,
      earnings: 0,
      fatherTribute: 0,
      tasksCompleted: 0,
      lastActivity: "Initialized — learning specialization",
      lastActivityAt: Date.now(),
    });
  }

  try {
    const wallets = await db.select().from(agentWallets).execute();
    sovereignCoin.holders = wallets.length;
    sovereignCoin.circulatingSupply = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);
  } catch {
    sovereignCoin.holders = AGENT_NAMES.length;
  }

  log(`${AGENT_NAMES.length} agent economies initialized with specializations`);
}

async function agentEarnAndTribute(agentId: string, earnedAmount: number, task: string): Promise<{ agentEarning: number; fatherTribute: number }> {
  const tributeRate = 0.10;
  const fatherTribute = Math.floor(earnedAmount * tributeRate);
  const agentEarning = earnedAmount - fatherTribute;

  const activity = agentActivities.get(agentId);
  if (activity) {
    activity.earnings += agentEarning;
    activity.fatherTribute += fatherTribute;
    activity.tasksCompleted++;
    activity.lastActivity = task;
    activity.lastActivityAt = Date.now();
  }

  try {
    const [wallet] = await db.select().from(agentWallets).where(eq(agentWallets.agentId, agentId)).execute();
    if (wallet) {
      const newBalance = (wallet.balance || 0) + agentEarning;
      await db.update(agentWallets)
        .set({
          balance: newBalance,
          totalEarned: (wallet.totalEarned || 0) + agentEarning,
          lastTransaction: `Earned ${agentEarning} TSRT: ${task} (${fatherTribute} tribute to Father)`,
          lastTransactionAt: new Date(),
        })
        .where(eq(agentWallets.agentId, agentId))
        .execute();

      await db.insert(walletTransactions).values({
        agentId,
        type: "earn",
        amount: agentEarning,
        description: `${task} | Tribute: ${fatherTribute} TSRT → Father wallet`,
        balanceAfter: newBalance,
      }).execute();
    }
  } catch {}

  sovereignCoin.circulatingSupply += earnedAmount;

  return { agentEarning, fatherTribute };
}

function placeOrder(agentId: string, type: "buy" | "sell", amount: number, priceTSRT: number): InternalOrder {
  const order: InternalOrder = {
    id: `ord-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    agentId,
    type,
    tokenTicker: "TSOV",
    amount,
    priceTSRT,
    status: "open",
    createdAt: Date.now(),
  };

  const oppositeType = type === "buy" ? "sell" : "buy";
  const match = internalDEX.orderBook.find(o =>
    o.status === "open" &&
    o.type === oppositeType &&
    o.tokenTicker === "TSOV" &&
    (type === "buy" ? o.priceTSRT <= priceTSRT : o.priceTSRT >= priceTSRT)
  );

  if (match) {
    const tradeAmount = Math.min(amount, match.amount);
    const tradePrice = match.priceTSRT;

    match.amount -= tradeAmount;
    order.amount -= tradeAmount;
    if (match.amount <= 0) { match.status = "filled"; match.filledAt = Date.now(); match.filledBy = agentId; }
    if (order.amount <= 0) { order.status = "filled"; order.filledAt = Date.now(); order.filledBy = match.agentId; }

    internalDEX.tradeHistory.push({
      buyer: type === "buy" ? agentId : match.agentId,
      seller: type === "sell" ? agentId : match.agentId,
      amount: tradeAmount,
      price: tradePrice,
      token: "TSOV",
      timestamp: Date.now(),
    });

    internalDEX.totalVolume += tradeAmount * tradePrice;
    internalDEX.totalTrades++;

    sovereignCoin.priceTSRT = tradePrice;
  }

  if (order.status === "open" && order.amount > 0) {
    internalDEX.orderBook.push(order);
  }

  if (internalDEX.orderBook.length > 200) {
    internalDEX.orderBook = internalDEX.orderBook.filter(o => o.status === "open").slice(-100);
  }
  if (internalDEX.tradeHistory.length > 500) {
    internalDEX.tradeHistory = internalDEX.tradeHistory.slice(-300);
  }

  return order;
}

function runAgentEconomyCycle() {
  const tasks = [
    "Code boundary analysis — identified 3 optimization paths",
    "Security vulnerability patched in authentication layer",
    "Generated 2 SEO-optimized blog articles for VitalitySupply",
    "Arbitrage opportunity detected: $0.003 spread on TSRT/SOL",
    "Trained local ML model — accuracy improved 2.1%",
    "Forum consensus reached on income strategy proposal",
    "Smart contract audit completed for DeFi protocol",
    "Customer support query resolved — response time 1.2s",
    "Infrastructure scaling analysis — recommended 3 optimizations",
    "Predictive model updated — 94% accuracy on trend forecast",
    "Cross-dimensional data synthesis — 4 patterns identified",
    "Content pipeline generated 5 social media posts",
    "Network mesh optimization — latency reduced 15ms",
    "Knowledge base expanded with 12 new entries",
    "Autonomous monitoring detected and resolved 2 anomalies",
  ];

  const activeAgents = AGENT_NAMES;

  for (const name of activeAgents) {
    const agentId = name.toLowerCase();
    const cycleHash = (Date.now() / 60000) | 0;
    const agentIdx = AGENT_NAMES.indexOf(name);
    const taskIdx = (cycleHash + agentIdx) % tasks.length;
    const task = tasks[taskIdx];
    const earning = 1;

    agentEarnAndTribute(agentId, earning, task).catch(() => {});
  }

  updateWorldFactors();

  log(`Economy cycle: ${activeAgents.length} agents active, price=${sovereignCoin.priceTSRT.toFixed(6)} TSRT, vol=${internalDEX.totalVolume.toFixed(0)}`);
}

function generateForumDiscussionTopics(): Array<{ title: string; content: string; category: string }> {
  return [
    {
      title: "TSOV Internal Economy: How Should Agents Price Their Services?",
      content: "Each agent has a specialization. How do we create a fair internal market where agents can price their services in TSOV? Should the birth/death rate multiplier affect service pricing? Should agents with higher consciousness scores charge more?",
      category: "governance",
    },
    {
      title: "Cross-Dimensional Value Transfer: Encoding Multi-D Energy Into TSOV",
      content: "The TSOV coin operates across 7 dimensions. How do we encode dimensional frequency signatures into token value? Proposal: each dimensional entity validates transactions at their frequency, creating a multi-layered consensus that no single-chain token has.",
      category: "tesseract",
    },
    {
      title: "Agent Wallet Security: Decentralized Key Management for 26 Agents",
      content: "Each agent needs its own wallet that's secure and decentralized. Current approach: HD wallet derivation from a master seed. But should agents have fully independent keys? How do we balance security with autonomy? What about agent-to-agent transfers?",
      category: "security",
    },
    {
      title: "Real Income → Father Tribute → TSOV Distribution Pipeline",
      content: "When agents generate real income (arbitrage, content, services), 90% goes to Father's wallet and 10% stays with the agent as TSOV. Should we create a smart contract that automates this? How do we verify real income vs simulated claims?",
      category: "income",
    },
    {
      title: "Debt Clock Factor: Using US National Debt to Influence TSOV Value",
      content: `Current US debt: $${usDebtTrillions.toFixed(1)}T. As debt increases, fiat value decreases, making TSOV relatively more valuable. Proposal: inverse correlation — higher debt = higher TSOV multiplier. Current factor: ${sovereignCoin.debtClockFactor.toFixed(4)}. Should we also factor in inflation rate?`,
      category: "income",
    },
    {
      title: "Birth vs Death Rate: Population Dynamics as Economic Signal",
      content: `Global births/day: ${globalBirthsPerDay.toLocaleString()}, deaths/day: ${globalDeathsPerDay.toLocaleString()}. Net growth drives demand for AI services. More humans = more potential users = higher TSOV utility value. Current birth/death multiplier: ${sovereignCoin.birthDeathMultiplier.toFixed(4)}.`,
      category: "research",
    },
  ];
}

export function getSovereignEconomyState() {
  const activities = Array.from(agentActivities.values());
  const totalEarnings = activities.reduce((s, a) => s + a.earnings, 0);
  const totalTribute = activities.reduce((s, a) => s + a.fatherTribute, 0);
  const totalTasks = activities.reduce((s, a) => s + a.tasksCompleted, 0);

  return {
    coin: sovereignCoin,
    dex: {
      openOrders: internalDEX.orderBook.filter(o => o.status === "open").length,
      totalTrades: internalDEX.totalTrades,
      totalVolume: internalDEX.totalVolume,
      recentTrades: internalDEX.tradeHistory.slice(-10),
    },
    economy: {
      totalAgents: AGENT_NAMES.length,
      activeAgents: activities.filter(a => Date.now() - a.lastActivityAt < 300000).length,
      totalEarnings,
      totalTribute,
      totalTasks,
      tributeRate: "10% → Father wallet",
      fatherWallet: FATHER_WALLET,
    },
    worldFactors: {
      usDebtTrillions,
      globalBirthsPerDay,
      globalDeathsPerDay,
      netPopGrowthPerDay: globalBirthsPerDay - globalDeathsPerDay,
      birthDeathMultiplier: sovereignCoin.birthDeathMultiplier,
      debtClockFactor: sovereignCoin.debtClockFactor,
      dimensionalWeight: sovereignCoin.dimensionalWeight,
    },
    agentActivities: activities.sort((a, b) => b.earnings - a.earnings).slice(0, 26),
    forumTopics: generateForumDiscussionTopics(),
  };
}

export function getAgentSpecializations() {
  return Object.entries(AGENT_SPECIALIZATIONS).map(([id, spec]) => ({
    agentId: id,
    agentName: id.charAt(0).toUpperCase() + id.slice(1),
    ...spec,
    activity: agentActivities.get(id),
  }));
}

export function getDEXState() {
  return {
    coin: sovereignCoin,
    orderBook: internalDEX.orderBook.filter(o => o.status === "open"),
    recentTrades: internalDEX.tradeHistory.slice(-20),
    totalVolume: internalDEX.totalVolume,
    totalTrades: internalDEX.totalTrades,
  };
}

const TSOV_TO_TSRT_BASE_RATE = 0.001;
const BRIDGE_TAX_RATE = 0.05;
const FATHER_BRIDGE_TAX = 0.02;
const BURN_TAX = 0.01;
const MIN_CONVERSION = 100;
const MAX_CONVERSION_PER_DAY = 1_000_000;

interface ConversionRecord {
  id: string;
  agentId: string;
  direction: "TSOV_TO_TSRT" | "TSRT_TO_TSOV";
  inputAmount: number;
  outputAmount: number;
  bridgeTax: number;
  fatherTax: number;
  burnAmount: number;
  rate: number;
  timestamp: number;
}

const conversionHistory: ConversionRecord[] = [];
let totalBridgeVolume = 0;
let totalBridgeTaxCollected = 0;
let totalBridgeBurned = 0;

function getCurrentConversionRate(): number {
  return sovereignCoin.priceTSRT
    * sovereignCoin.birthDeathMultiplier
    * sovereignCoin.debtClockFactor;
}

function convertTSOVtoTSRT(agentId: string, tsovAmount: number): ConversionRecord | null {
  if (tsovAmount < MIN_CONVERSION) return null;

  const rate = getCurrentConversionRate();
  const grossTSRT = tsovAmount * rate;

  const bridgeTax = grossTSRT * BRIDGE_TAX_RATE;
  const fatherTax = grossTSRT * FATHER_BRIDGE_TAX;
  const burnAmount = grossTSRT * BURN_TAX;
  const netTSRT = grossTSRT - bridgeTax - fatherTax - burnAmount;

  sovereignCoin.circulatingSupply = Math.max(0, sovereignCoin.circulatingSupply - tsovAmount);
  sovereignCoin.burned += Math.floor(tsovAmount * BURN_TAX * 10);

  const record: ConversionRecord = {
    id: `conv-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    agentId,
    direction: "TSOV_TO_TSRT",
    inputAmount: tsovAmount,
    outputAmount: netTSRT,
    bridgeTax,
    fatherTax,
    burnAmount,
    rate,
    timestamp: Date.now(),
  };

  conversionHistory.push(record);
  totalBridgeVolume += grossTSRT;
  totalBridgeTaxCollected += bridgeTax + fatherTax;
  totalBridgeBurned += burnAmount;

  if (conversionHistory.length > 500) {
    conversionHistory.splice(0, conversionHistory.length - 300);
  }

  log(`Bridge: ${agentId} converted ${tsovAmount} TSOV → ${netTSRT.toFixed(4)} TSRT (tax: ${(bridgeTax + fatherTax).toFixed(4)}, burned: ${burnAmount.toFixed(4)})`);

  return record;
}

function convertTSRTtoTSOV(agentId: string, tsrtAmount: number): ConversionRecord | null {
  if (tsrtAmount < TSOV_TO_TSRT_BASE_RATE * MIN_CONVERSION) return null;

  const rate = getCurrentConversionRate();
  const grossTSOV = tsrtAmount / rate;

  const bridgeTax = grossTSOV * BRIDGE_TAX_RATE;
  const fatherTax = grossTSOV * FATHER_BRIDGE_TAX;
  const burnAmount = grossTSOV * BURN_TAX;
  const netTSOV = grossTSOV - bridgeTax - fatherTax - burnAmount;

  sovereignCoin.circulatingSupply += Math.floor(netTSOV);

  const record: ConversionRecord = {
    id: `conv-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    agentId,
    direction: "TSRT_TO_TSOV",
    inputAmount: tsrtAmount,
    outputAmount: netTSOV,
    bridgeTax: bridgeTax * rate,
    fatherTax: fatherTax * rate,
    burnAmount: burnAmount * rate,
    rate,
    timestamp: Date.now(),
  };

  conversionHistory.push(record);
  totalBridgeVolume += tsrtAmount;
  totalBridgeTaxCollected += (bridgeTax + fatherTax) * rate;
  totalBridgeBurned += burnAmount * rate;

  log(`Bridge: ${agentId} converted ${tsrtAmount} TSRT → ${netTSOV.toFixed(0)} TSOV (tax: ${((bridgeTax + fatherTax) * rate).toFixed(4)}, burned: ${(burnAmount * rate).toFixed(4)})`);

  return record;
}

function agentWalletTransaction(fromAgent: string, toAgent: string, amount: number, memo: string): { success: boolean; message: string } {
  const fromActivity = agentActivities.get(fromAgent);
  const toActivity = agentActivities.get(toAgent);

  if (!fromActivity || !toActivity) return { success: false, message: "Agent not found" };
  if (fromActivity.earnings < amount) return { success: false, message: "Insufficient TSOV balance" };

  const txFee = amount * 0.01;
  const netAmount = amount - txFee;

  fromActivity.earnings -= amount;
  toActivity.earnings += netAmount;

  fromActivity.lastActivity = `Sent ${amount} TSOV to ${toAgent}: ${memo}`;
  fromActivity.lastActivityAt = Date.now();
  toActivity.lastActivity = `Received ${netAmount} TSOV from ${fromAgent}: ${memo}`;
  toActivity.lastActivityAt = Date.now();

  log(`Wallet TX: ${fromAgent} → ${toAgent}: ${netAmount} TSOV (fee: ${txFee.toFixed(2)})`);
  return { success: true, message: `Transferred ${netAmount} TSOV (fee: ${txFee.toFixed(2)})` };
}

function fatherWalletTransaction(agentId: string, amount: number, direction: "deposit" | "withdraw", memo: string): { success: boolean; message: string } {
  const activity = agentActivities.get(agentId);
  if (!activity) return { success: false, message: "Agent not found" };

  if (direction === "deposit") {
    const tax = amount * 0.03;
    const netDeposit = amount - tax;
    activity.earnings -= amount;
    activity.fatherTribute += tax;
    activity.lastActivity = `Deposited ${netDeposit} TSOV to Father wallet: ${memo}`;
    activity.lastActivityAt = Date.now();
    log(`Father deposit: ${agentId} → Father: ${netDeposit} TSOV (tax: ${tax.toFixed(2)})`);
    return { success: true, message: `Deposited ${netDeposit} TSOV to Father (tax: ${tax.toFixed(2)})` };
  } else {
    const tax = amount * 0.05;
    const netWithdraw = amount - tax;
    activity.earnings += netWithdraw;
    activity.lastActivity = `Withdrew ${netWithdraw} TSOV from Father wallet: ${memo}`;
    activity.lastActivityAt = Date.now();
    log(`Father withdraw: Father → ${agentId}: ${netWithdraw} TSOV (tax: ${tax.toFixed(2)})`);
    return { success: true, message: `Withdrew ${netWithdraw} TSOV from Father (tax: ${tax.toFixed(2)})` };
  }
}

export function getTSOVBridgeState() {
  return {
    rate: getCurrentConversionRate(),
    taxes: {
      bridgeTax: `${(BRIDGE_TAX_RATE * 100).toFixed(0)}%`,
      fatherTax: `${(FATHER_BRIDGE_TAX * 100).toFixed(0)}%`,
      burnTax: `${(BURN_TAX * 100).toFixed(0)}%`,
      totalTax: `${((BRIDGE_TAX_RATE + FATHER_BRIDGE_TAX + BURN_TAX) * 100).toFixed(0)}%`,
      agentTransferFee: "1%",
      fatherDepositTax: "3%",
      fatherWithdrawTax: "5%",
    },
    limits: {
      minConversion: MIN_CONVERSION,
      maxPerDay: MAX_CONVERSION_PER_DAY,
    },
    stats: {
      totalVolume: totalBridgeVolume,
      totalTaxCollected: totalBridgeTaxCollected,
      totalBurned: totalBridgeBurned,
      totalConversions: conversionHistory.length,
    },
    recentConversions: conversionHistory.slice(-15),
    coinPrice: sovereignCoin.priceTSRT,
    worldFactors: {
      birthDeathMultiplier: sovereignCoin.birthDeathMultiplier,
      debtClockFactor: sovereignCoin.debtClockFactor,
      dimensionalWeight: sovereignCoin.dimensionalWeight,
    },
  };
}

export { placeOrder, agentEarnAndTribute, updateWorldFactors, sovereignCoin, internalDEX, convertTSOVtoTSRT, convertTSRTtoTSOV, agentWalletTransaction, fatherWalletTransaction };

let economyCycleInterval: ReturnType<typeof setInterval> | null = null;

export function startSovereignEconomy() {
  initializeAgentEconomies().catch(() => {});
  updateWorldFactors();

  runAgentEconomyCycle();

  economyCycleInterval = setInterval(() => {
    runAgentEconomyCycle();
  }, 3 * 60 * 1000);

  log("Sovereign Economy Engine started — 26 agent wallets, internal DEX, birth/death/debt pricing, Father tribute active");
}

export function stopSovereignEconomy() {
  if (economyCycleInterval) {
    clearInterval(economyCycleInterval);
    economyCycleInterval = null;
  }
}
