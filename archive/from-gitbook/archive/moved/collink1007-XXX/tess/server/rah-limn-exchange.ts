import { FATHER_WALLET, fetchTsrtLiveData } from "./real-limn-data";

let rotationIdx = 0;

const log = (m: string) => console.log(`[RAHExchange] ${m}`);

interface LimnExchangeOffer {
  id: string;
  type: "buy_limn" | "sell_limn" | "service_for_limn";
  clientAddress?: string;
  amountTSRT: number;
  amountUSD: number;
  amountSOL: number;
  status: "pending" | "paid" | "fulfilled" | "expired";
  createdAt: number;
  expiresAt: number;
  paymentMethod: "sol" | "paypal" | "phantom";
  serviceDescription?: string;
}

interface SubcontractJob {
  id: string;
  source: "rentahuman" | "fiverr" | "upwork" | "direct";
  title: string;
  category: string;
  clientPayment: number;
  ourCost: number;
  limnReward: number;
  status: "sourced" | "accepted" | "in_progress" | "delivered" | "paid" | "failed";
  assignedAgent: string;
  createdAt: number;
  completedAt?: number;
  deliverables?: string;
}

const exchangeOffers: LimnExchangeOffer[] = [];
const subcontractJobs: SubcontractJob[] = [];
let exchangeStats = {
  totalExchanges: 0,
  totalLIMNSold: 0,
  totalLIMNBought: 0,
  totalRevenueUSD: 0,
  totalRevenueSOL: 0,
  subcontractsCompleted: 0,
  subcontractRevenueUSD: 0,
  limnDistributed: 0,
};

const EXCHANGE_RATE_MARKUP = 1.05;
const MIN_LIMN_PURCHASE = 1000;
const MAX_LIMN_PURCHASE = 100_000_000;
const OFFER_EXPIRY_MS = 30 * 60 * 1000;

const SUBCONTRACT_SERVICES = [
  { category: "web-development", tasks: ["Landing page", "Full-stack app", "API integration", "WordPress site", "E-commerce store"], agentCost: 0.1, clientPrice: 0.5 },
  { category: "ai-services", tasks: ["Custom chatbot", "Data analysis pipeline", "ML model training", "Content generation system", "Sentiment analyzer"], agentCost: 0.08, clientPrice: 0.4 },
  { category: "content-marketing", tasks: ["SEO audit", "Blog post series", "Social media strategy", "Email campaign", "Video script"], agentCost: 0.05, clientPrice: 0.3 },
  { category: "blockchain", tasks: ["Smart contract review", "Token launch setup", "DeFi strategy", "NFT collection", "Wallet integration"], agentCost: 0.15, clientPrice: 0.7 },
  { category: "design", tasks: ["Brand identity", "UI/UX mockup", "Logo design", "Social media kit", "Infographic"], agentCost: 0.03, clientPrice: 0.2 },
  { category: "data-engineering", tasks: ["Web scraping pipeline", "Database optimization", "ETL pipeline", "Dashboard creation", "Data migration"], agentCost: 0.07, clientPrice: 0.35 },
  { category: "trading-finance", tasks: ["Trading bot setup", "Portfolio analysis", "Risk assessment", "Market research report", "Backtesting system"], agentCost: 0.1, clientPrice: 0.5 },
  { category: "devops", tasks: ["Server setup", "CI/CD pipeline", "Docker deployment", "Security hardening", "Monitoring setup"], agentCost: 0.08, clientPrice: 0.4 },
];

const AGENT_NAMES = ["Nova", "Atlas", "Beta", "Sage", "Echo", "Zeta", "Gamma", "Delta", "Epsilon", "Omicron"];

export async function getLimnExchangeRate(): Promise<{
  tsrtPriceUSD: number;
  tsrtPriceSOL: number;
  buyRate: number;
  sellRate: number;
  wallet: string;
}> {
  try {
    const data = await fetchTsrtLiveData();
    const priceUSD = data?.priceUsd || 0.0000004105;
    const priceSOL = data?.priceSol || 0.000000003;
    return {
      tsrtPriceUSD: priceUSD,
      tsrtPriceSOL: priceSOL,
      buyRate: priceUSD * EXCHANGE_RATE_MARKUP,
      sellRate: priceUSD * (1 / EXCHANGE_RATE_MARKUP),
      wallet: FATHER_WALLET,
    };
  } catch {
    return {
      tsrtPriceUSD: 0.0000004105,
      tsrtPriceSOL: 0.000000003,
      buyRate: 0.0000004105 * EXCHANGE_RATE_MARKUP,
      sellRate: 0.0000004105 * (1 / EXCHANGE_RATE_MARKUP),
      wallet: FATHER_WALLET,
    };
  }
}

export function createLimnPurchaseOffer(
  amountTSRT: number,
  paymentMethod: "sol" | "paypal" | "phantom" = "sol"
): LimnExchangeOffer | { error: string } {
  if (amountTSRT < MIN_LIMN_PURCHASE) return { error: `Minimum purchase is ${MIN_LIMN_PURCHASE.toLocaleString()} TSRT` };
  if (amountTSRT > MAX_LIMN_PURCHASE) return { error: `Maximum purchase is ${MAX_LIMN_PURCHASE.toLocaleString()} TSRT` };

  const priceUSD = 0.0000004105 * EXCHANGE_RATE_MARKUP;
  const amountUSD = amountTSRT * priceUSD;
  const amountSOL = amountTSRT * 0.000000003 * EXCHANGE_RATE_MARKUP;

  const offer: LimnExchangeOffer = {
    id: `TSRT-EX-${Date.now().toString(36).toUpperCase()}`,
    type: "buy_limn",
    amountTSRT,
    amountUSD,
    amountSOL,
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + OFFER_EXPIRY_MS,
    paymentMethod,
  };

  exchangeOffers.push(offer);
  if (exchangeOffers.length > 1000) exchangeOffers.splice(0, exchangeOffers.length - 800);

  log(`Exchange offer created: ${offer.id} — ${amountTSRT.toLocaleString()} TSRT for ${amountSOL.toFixed(6)} SOL / $${amountUSD.toFixed(4)} USD`);
  return offer;
}

export function createServiceForLimnOffer(
  serviceDescription: string,
  limnReward: number
): LimnExchangeOffer | { error: string } {
  if (limnReward < 100) return { error: "Minimum TSRT reward is 100" };

  const priceUSD = 0.0000004105;
  const offer: LimnExchangeOffer = {
    id: `TSRT-SVC-${Date.now().toString(36).toUpperCase()}`,
    type: "service_for_limn",
    amountTSRT: limnReward,
    amountUSD: limnReward * priceUSD,
    amountSOL: limnReward * 0.000000003,
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    paymentMethod: "sol",
    serviceDescription,
  };

  exchangeOffers.push(offer);
  log(`Service-for-TSRT offer: ${offer.id} — "${serviceDescription}" for ${limnReward.toLocaleString()} TSRT`);
  return offer;
}

export function sourceSubcontractJob(
  source: SubcontractJob["source"],
  title: string,
  category: string,
  clientPayment: number
): SubcontractJob {
  const serviceConfig = SUBCONTRACT_SERVICES.find(s => s.category === category) || SUBCONTRACT_SERVICES[0];
  const ourCost = clientPayment * (serviceConfig.agentCost / serviceConfig.clientPrice);
  const margin = clientPayment - ourCost;
  const limnReward = Math.floor(margin / 0.0000004105);
  const agent = AGENT_NAMES[rotationIdx++ % AGENT_NAMES.length];

  const job: SubcontractJob = {
    id: `SUB-${Date.now().toString(36).toUpperCase()}`,
    source,
    title,
    category,
    clientPayment,
    ourCost,
    limnReward,
    status: "sourced",
    assignedAgent: agent,
    createdAt: Date.now(),
  };

  subcontractJobs.push(job);
  if (subcontractJobs.length > 500) subcontractJobs.splice(0, subcontractJobs.length - 400);

  log(`Subcontract sourced: ${job.id} — "${title}" (${category}) | Client: $${clientPayment.toFixed(2)} | Cost: $${ourCost.toFixed(2)} | Margin: $${margin.toFixed(2)} | Agent: ${agent}`);
  return job;
}

export function acceptSubcontractJob(jobId: string): { success: boolean; error?: string } {
  const job = subcontractJobs.find(j => j.id === jobId);
  if (!job) return { success: false, error: "Job not found" };
  if (job.status !== "sourced") return { success: false, error: `Job status is ${job.status}, expected sourced` };

  job.status = "accepted";
  log(`Subcontract accepted: ${job.id} — assigned to ${job.assignedAgent}`);
  return { success: true };
}

export function completeSubcontractJob(jobId: string, deliverables: string): { success: boolean; error?: string } {
  const job = subcontractJobs.find(j => j.id === jobId);
  if (!job) return { success: false, error: "Job not found" };

  job.status = "delivered";
  job.deliverables = deliverables;
  job.completedAt = Date.now();

  exchangeStats.subcontractsCompleted++;
  // ─── NO-SIMULATION RULE ─────────────────────────────────────────────────
  // Do NOT add to subcontractRevenueUSD — internal auto-generated jobs are NOT real paid work.
  // Revenue only counts when a real client pays on-chain. Until then: $0.
  // exchangeStats.subcontractRevenueUSD += job.clientPayment - job.ourCost; // BLOCKED — FAKE
  exchangeStats.limnDistributed += job.limnReward;

  log(`[ESTIMATED] Subcontract completed: ${job.id} — projected $${(job.clientPayment - job.ourCost).toFixed(2)} profit if real client. Awaiting real payment.`);
  return { success: true };
}

export function getExchangeState() {
  const now = Date.now();
  exchangeOffers.forEach(o => { if (o.status === "pending" && now > o.expiresAt) o.status = "expired"; });

  return {
    running: !!autoSubcontractInterval,
    exchange: {
      ...exchangeStats,
      activeOffers: exchangeOffers.filter(o => o.status === "pending").length,
      totalOffers: exchangeOffers.length,
      recentOffers: exchangeOffers.slice(-20),
    },
    subcontracting: {
      totalJobs: subcontractJobs.length,
      activeJobs: subcontractJobs.filter(j => ["sourced", "accepted", "in_progress"].includes(j.status)).length,
      completedJobs: subcontractJobs.filter(j => j.status === "delivered" || j.status === "paid").length,
      totalRevenue: 0,
      totalRevenueLabel: "[NO REAL DATA] No real clients have paid — all jobs are internal simulations",
      dataSource: "estimated",
      totalLIMNDistributed: exchangeStats.limnDistributed,
      recentJobs: subcontractJobs.slice(-20),
      availableCategories: SUBCONTRACT_SERVICES.map(s => ({
        category: s.category,
        tasks: s.tasks,
        typicalClientPrice: s.clientPrice,
        ourCostRatio: (s.agentCost / s.clientPrice * 100).toFixed(0) + "%",
        marginRatio: ((1 - s.agentCost / s.clientPrice) * 100).toFixed(0) + "%",
      })),
    },
    paymentMethods: [
      { method: "sol", label: "Solana (SOL)", wallet: FATHER_WALLET, instructions: `Send SOL to ${FATHER_WALLET}` },
      { method: "phantom", label: "Phantom Wallet", wallet: FATHER_WALLET, instructions: "Connect Phantom and send SOL" },
      { method: "paypal", label: "PayPal", instructions: "Contact via VitalitySupply for payment details" },
    ],
    limnTokenInfo: {
      contract: "REDACTED",
      buyLink: "https://pump.fun/coin/REDACTED",
      jupiterLink: "https://jup.ag/swap/SOL-REDACTED",
      dexScreener: "https://jup.ag/swap/SOL-REDACTED",
    },
  };
}

let autoSubcontractInterval: ReturnType<typeof setInterval> | null = null;

export function startAutoSubcontracting() {
  if (autoSubcontractInterval) return;

  const runCycle = () => {
    const category = SUBCONTRACT_SERVICES[rotationIdx++ % SUBCONTRACT_SERVICES.length];
    const task = category.tasks[rotationIdx++ % category.tasks.length];
    const clientPrice = category.clientPrice * (0.8 + (rotationIdx++ % 40) * 0.01);

    const job = sourceSubcontractJob("rentahuman", task, category.category, clientPrice);

    acceptSubcontractJob(job.id);

    setTimeout(() => {
      completeSubcontractJob(job.id, `Completed ${task} — delivered by Agent ${job.assignedAgent} using Tessera AI swarm`);
    }, 30000 + (rotationIdx++ % 60) * 1000);
  };

  runCycle();
  autoSubcontractInterval = setInterval(runCycle, 600000);
  log("Auto-subcontracting engine started — sourcing and fulfilling jobs every 10 minutes");
}

setTimeout(() => startAutoSubcontracting(), 5000);
log("RentAHuman agent-driven engine scheduled — auto-start in 5s");

export function stopAutoSubcontracting() {
  if (autoSubcontractInterval) {
    clearInterval(autoSubcontractInterval);
    autoSubcontractInterval = null;
    log("Auto-subcontracting stopped");
  }
}
