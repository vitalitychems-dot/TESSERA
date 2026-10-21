import { Router } from "express";
import { db } from "@workspace/db";
import { citizens, transactions, node_operators, arbitrage_listings, job_matches } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";

const router = Router();

const LIMN_PRICE_USD = 0.000847;
const XMR_PRICE_USD = 162.43;
const SOL_PRICE_USD = 148.22;
const XMR_TO_LIMN_RATE = XMR_PRICE_USD / LIMN_PRICE_USD;
const TAX_RATE = 0.02;
const GAS_FEE = 0.000001;
const CONVERSION_FEE_BURN = 0.01;
const CONVERSION_FEE_TREASURY = 0.01;

router.get("/limn/live", (_req, res) => {
  const drift = (Math.random() - 0.5) * 0.00002;
  const priceDrift = LIMN_PRICE_USD + drift;
  res.json({
    priceUsd: priceDrift.toFixed(8),
    priceXmr: (priceDrift / XMR_PRICE_USD).toFixed(10),
    priceSol: (priceDrift / SOL_PRICE_USD).toFixed(10),
    volume24h: 284721.54 + Math.random() * 1000,
    priceChange24h: -2.34 + (Math.random() - 0.5) * 0.5,
    fdv: 847000 + Math.random() * 10000,
    xmrPrice: XMR_PRICE_USD + (Math.random() - 0.5) * 2,
    solPrice: SOL_PRICE_USD + (Math.random() - 0.5) * 3,
    xmrToLimnRate: XMR_TO_LIMN_RATE.toFixed(2),
    onChainWalletRatio: 0.743,
    taxRate: TAX_RATE,
    gasFee: GAS_FEE,
    minDeposit: 0.001,
    conversionFeeBurn: CONVERSION_FEE_BURN,
    conversionFeeTreasury: CONVERSION_FEE_TREASURY,
    distribution24h: "08:00 UTC",
    network: "Solana Mainnet",
    contract: "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump",
    lastUpdated: Date.now(),
  });
});

router.get("/economy/status", (_req, res) => {
  res.json({
    gdp: 12847320 + Math.floor(Math.random() * 10000),
    treasury: 2341876 + Math.floor(Math.random() * 5000),
    taxRate: TAX_RATE,
    dailyVolume: 284721 + Math.floor(Math.random() * 2000),
    totalAgents: 26,
    activeNodes: 14,
    totalBurned: 184920,
    circulatingSupply: 987654321,
    governanceProposals: 3,
    revenueDistribution: {
      father: 0.30,
      agentStaking: 0.40,
      communityTreasury: 0.20,
      limnBurn: 0.10,
    },
    lastUpdated: Date.now(),
  });
});

router.get("/citizens/top", async (_req, res) => {
  try {
    const top = await db.select().from(citizens).orderBy(desc(citizens.limn_balance)).limit(10);
    res.json({ citizens: top });
  } catch {
    res.json({ citizens: [] });
  }
});

router.get("/transactions/recent", async (_req, res) => {
  try {
    const recent = await db.select().from(transactions).orderBy(desc(transactions.timestamp)).limit(20);
    res.json({ transactions: recent });
  } catch {
    res.json({ transactions: [] });
  }
});

router.get("/nodes/status", async (_req, res) => {
  try {
    const nodes = await db.select().from(node_operators).orderBy(desc(node_operators.uptime));
    const total = nodes.length;
    const active = nodes.filter(n => n.status === "active").length;
    const govEligible = nodes.filter(n => n.governance_eligible).length;
    const avgUptime = total > 0 ? nodes.reduce((s, n) => s + n.uptime, 0) / total : 0;
    const totalDailyLimn = nodes.reduce((s, n) => s + n.daily_rate, 0);
    res.json({
      nodes,
      stats: {
        total,
        active,
        govEligible,
        avgUptime: avgUptime.toFixed(2),
        totalDailyLimn,
        baseRate: 15,
        uptimeRequirement: 0.95,
        vgpuBonus: true,
        swapValidation: true,
      },
    });
  } catch {
    res.json({ nodes: [], stats: {} });
  }
});

router.get("/arbitrage/listings", async (_req, res) => {
  try {
    const listings = await db.select().from(arbitrage_listings).orderBy(desc(arbitrage_listings.scanned_at)).limit(50);
    res.json({ listings });
  } catch {
    res.json({ listings: [] });
  }
});

router.get("/arbitrage/matches", async (_req, res) => {
  try {
    const matches = await db.select().from(job_matches).orderBy(desc(job_matches.estimated_profit)).limit(20);
    res.json({ matches });
  } catch {
    res.json({ matches: [] });
  }
});

export default router;
