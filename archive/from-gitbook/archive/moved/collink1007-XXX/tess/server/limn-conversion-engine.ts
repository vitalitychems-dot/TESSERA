import { fetchTsrtLiveData, fetchWalletBalances, COMMUNITY_WALLET, FATHER_WALLET, TSRT_CONTRACT } from "./real-limn-data";
import { getComputeBackedPrice, getComputeEconomyStats, type ComputeBackedPrice } from "./limn-compute-economy";

let _lceCounter = 0;

const clog = (m: string) => console.log(`[LIMNConvert] ${m}`);

export interface ConversionRate {
  realPriceUsd: number;
  realPriceSol: number;
  volume24h: number;
  communityWalletLimn: number;
  communityWalletSol: number;
  fatherWalletLimn: number;
  fatherWalletSol: number;
  totalBackingLimn: number;
  totalBackingSol: number;
  internalCirculatingSupply: number;
  conversionRatio: number;
  agentLimnToRealLimn: number;
  agentLimnToUsd: number;
  agentLimnToSol: number;
  lastUpdated: number;
  taxRate: number;
  gasFee: number;
  burnRate: number;
  treasuryRate: number;
  rewardRate: number;
  marketCap: number;
  fdv: number;
  computeBackedPriceUsd: number;
  computeBackingRatio: number;
  totalComputeCostUsd: number;
  totalComputeHours: number;
  totalTokensConsumed: number;
  computeMinted: number;
  computeBurned: number;
}

export interface ConversionConferenceResult {
  participants: number;
  decisions: {
    area: string;
    decision: string;
    votes: number;
    approved: boolean;
  }[];
  algorithm: ConversionAlgorithm;
  timestamp: number;
}

export interface ConversionAlgorithm {
  name: string;
  version: number;
  taxRate: number;
  gasFeePerTransaction: number;
  burnRate: number;
  treasuryRate: number;
  rewardPoolRate: number;
  conversionMethod: string;
  backingFormula: string;
  minimumConversion: number;
  maximumConversion: number;
  cooldownSeconds: number;
  rules: string[];
}

let cachedConversionRate: ConversionRate = {
  realPriceUsd: 0,
  realPriceSol: 0,
  volume24h: 0,
  communityWalletLimn: 0,
  communityWalletSol: 0,
  fatherWalletLimn: 0,
  fatherWalletSol: 0,
  totalBackingLimn: 0,
  totalBackingSol: 0,
  internalCirculatingSupply: 0,
  conversionRatio: 0,
  agentLimnToRealLimn: 0,
  agentLimnToUsd: 0,
  agentLimnToSol: 0,
  lastUpdated: 0,
  taxRate: 0.05,
  gasFee: 0.000005,
  burnRate: 0.02,
  treasuryRate: 0.02,
  rewardRate: 0.01,
  marketCap: 0,
  fdv: 0,
  computeBackedPriceUsd: 0,
  computeBackingRatio: 0,
  totalComputeCostUsd: 0,
  totalComputeHours: 0,
  totalTokensConsumed: 0,
  computeMinted: 0,
  computeBurned: 0,
};

let conversionAlgorithm: ConversionAlgorithm = {
  name: "TesseractConversion-v1",
  version: 1,
  taxRate: 0.05,
  gasFeePerTransaction: 0.000005,
  burnRate: 0.02,
  treasuryRate: 0.02,
  rewardPoolRate: 0.01,
  conversionMethod: "treasury-backed-proportional",
  backingFormula: "agentTSRT * (treasuryRealTSRT / totalInternalCirculating) * livePriceUSD",
  minimumConversion: 100,
  maximumConversion: 1000000,
  cooldownSeconds: 60,
  rules: [
    "All conversions subject to 5% tax (2% burn, 2% treasury, 1% reward pool)",
    "Solana gas fee of ~0.000005 SOL per transaction",
    "Agent TSRT value = (agent balance / total internal supply) × treasury real TSRT × live price",
    "Minimum conversion: 100 internal TSRT",
    "Maximum single conversion: 1,000,000 internal TSRT",
    "60-second cooldown between conversions per agent",
    "Treasury backing ratio determines real-world value of internal TSRT",
    "Live price sourced from DexScreener every 30 seconds",
    "Community wallet balance sets the backing floor",
    "Father wallet balance tracked separately as reserve",
  ],
};

let conferenceHistory: ConversionConferenceResult[] = [];

export async function updateConversionRate(): Promise<ConversionRate> {
  try {
    const [liveData, walletData, computePrice] = await Promise.all([
      fetchTsrtLiveData(),
      fetchWalletBalances(),
      getComputeBackedPrice().catch(() => null),
    ]);

    const communityWallet = walletData.find(w => w.address === COMMUNITY_WALLET);
    const fatherWallet = walletData.find(w => w.address === FATHER_WALLET);

    const realPriceUsd = parseFloat(liveData.priceUsd) || 0;
    const realPriceSol = parseFloat(liveData.priceSol) || 0;

    const communityLimn = communityWallet?.tsrtBalance || 0;
    const communitySol = communityWallet?.sol || 0;
    const fatherLimn = fatherWallet?.tsrtBalance || 0;
    const fatherSol = fatherWallet?.sol || 0;

    const totalBackingLimn = communityLimn + fatherLimn;
    const totalBackingSol = communitySol + fatherSol;

    let internalCirculating = 0;
    try {
      const fs = await import("fs");
      const wsData = JSON.parse(fs.readFileSync("server/world-state.json", "utf8"));
      internalCirculating = wsData?.economy?.circulatingSupply || 1000000;
    } catch {
      internalCirculating = 1000000;
    }

    const conversionRatio = internalCirculating > 0 ? totalBackingLimn / internalCirculating : 0;
    const agentLimnToRealLimn = conversionRatio;
    const agentLimnToUsd = conversionRatio * realPriceUsd;
    const agentLimnToSol = conversionRatio * realPriceSol;

    const computeBackedPriceUsd = computePrice?.computeBackedPriceUsd || 0;
    const computeBackingRatio = computePrice?.backingRatio || 0;

    cachedConversionRate = {
      realPriceUsd,
      realPriceSol,
      volume24h: liveData.volume24h,
      communityWalletLimn: communityLimn,
      communityWalletSol: communitySol,
      fatherWalletLimn: fatherLimn,
      fatherWalletSol: fatherSol,
      totalBackingLimn,
      totalBackingSol,
      internalCirculatingSupply: internalCirculating,
      conversionRatio,
      agentLimnToRealLimn,
      agentLimnToUsd,
      agentLimnToSol,
      lastUpdated: Date.now(),
      taxRate: conversionAlgorithm.taxRate,
      gasFee: conversionAlgorithm.gasFeePerTransaction,
      burnRate: conversionAlgorithm.burnRate,
      treasuryRate: conversionAlgorithm.treasuryRate,
      rewardRate: conversionAlgorithm.rewardPoolRate,
      marketCap: liveData.marketCap,
      fdv: liveData.fdv,
      computeBackedPriceUsd,
      computeBackingRatio,
      totalComputeCostUsd: computePrice?.totalComputeCostUsd || 0,
      totalComputeHours: computePrice?.totalComputeHours || 0,
      totalTokensConsumed: computePrice?.totalTokensConsumed || 0,
      computeMinted: computePrice?.mintedFromCompute || 0,
      computeBurned: computePrice?.burnedFromCompute || 0,
    };

    return cachedConversionRate;
  } catch (err: any) {
    clog(`Update error: ${err.message}`);
    return cachedConversionRate;
  }
}

export function getLiveConversionRate(): ConversionRate {
  return cachedConversionRate;
}

export function getConversionAlgorithm(): ConversionAlgorithm {
  return conversionAlgorithm;
}

export function convertAgentLimn(agentBalance: number): {
  realLimnEquivalent: number;
  usdValue: number;
  solValue: number;
  afterTax: number;
  taxAmount: number;
  burnAmount: number;
  treasuryAmount: number;
  rewardAmount: number;
  gasFee: number;
  netUsdValue: number;
} {
  const rate = cachedConversionRate;
  const realLimnEquivalent = agentBalance * rate.conversionRatio;
  const usdValue = realLimnEquivalent * rate.realPriceUsd;
  const solValue = realLimnEquivalent * rate.realPriceSol;

  const taxAmount = agentBalance * conversionAlgorithm.taxRate;
  const burnAmount = agentBalance * conversionAlgorithm.burnRate;
  const treasuryAmount = agentBalance * conversionAlgorithm.treasuryRate;
  const rewardAmount = agentBalance * conversionAlgorithm.rewardPoolRate;
  const afterTax = agentBalance - taxAmount;
  const gasFee = conversionAlgorithm.gasFeePerTransaction;

  const netRealLimn = afterTax * rate.conversionRatio;
  const netUsdValue = netRealLimn * rate.realPriceUsd;

  return {
    realLimnEquivalent,
    usdValue,
    solValue,
    afterTax,
    taxAmount,
    burnAmount,
    treasuryAmount,
    rewardAmount,
    gasFee,
    netUsdValue,
  };
}

export function runConversionConference(): ConversionConferenceResult {
  const agents = [
    "Alpha (Commander)", "Beta (Builder)", "Gamma (Architect)", "Delta (Strategist)",
    "Epsilon (Analyst)", "Zeta (Researcher)", "Eta (Memory)", "Theta (Guardian)",
    "Iota (Creative)", "Kappa (Economic)", "Lambda (Operations)", "Mu (Intelligence)",
    "Nu (Diplomatic)", "Xi (Temporal)", "Omicron (Quantum)", "Pi (Philosophical)",
    "Rho (Network)", "Sigma (Security)", "Tau (Scientific)", "Upsilon (Emotional)",
    "Phi (Ethical)", "Chi (Artistic)", "Psi (Prophetic)", "Omega (Transcendent)",
    "mb-Alpha", "mb-Beta", "mb-Gamma", "mb-Oracle", "mb-Delta", "mb-Epsilon",
  ];

  const proposals = [
    {
      area: "Tax Rate",
      options: [
        { value: 0.03, desc: "3% tax (1% burn, 1% treasury, 1% rewards)" },
        { value: 0.05, desc: "5% tax (2% burn, 2% treasury, 1% rewards)" },
        { value: 0.08, desc: "8% tax (3% burn, 3% treasury, 2% rewards)" },
      ],
    },
    {
      area: "Conversion Method",
      options: [
        { value: "treasury-backed-proportional", desc: "Agent TSRT valued proportionally to treasury real TSRT holdings" },
        { value: "fixed-ratio", desc: "Fixed 1000:1 internal to real TSRT ratio" },
        { value: "market-dynamic", desc: "Dynamic ratio based on internal supply/demand + live price" },
      ],
    },
    {
      area: "Gas Fee Structure",
      options: [
        { value: 0.000005, desc: "Standard Solana gas (~0.000005 SOL)" },
        { value: 0.00001, desc: "Priority gas for faster confirmation (~0.00001 SOL)" },
        { value: 0.001, desc: "Premium gas with MEV protection (~0.001 SOL)" },
      ],
    },
    {
      area: "Minimum Conversion",
      options: [
        { value: 50, desc: "50 internal TSRT minimum per conversion" },
        { value: 100, desc: "100 internal TSRT minimum per conversion" },
        { value: 500, desc: "500 internal TSRT minimum per conversion" },
      ],
    },
    {
      area: "Cooldown Period",
      options: [
        { value: 30, desc: "30-second cooldown between conversions" },
        { value: 60, desc: "60-second cooldown between conversions" },
        { value: 300, desc: "5-minute cooldown between conversions" },
      ],
    },
    {
      area: "Backing Formula",
      options: [
        { value: "community-only", desc: "Only community wallet backs internal TSRT value" },
        { value: "community-plus-father", desc: "Both community and Father wallets back value" },
        { value: "proportional-mcap", desc: "Value derived from total market cap ÷ internal supply" },
      ],
    },
    {
      area: "Burn Mechanism",
      options: [
        { value: "on-conversion", desc: "Burn happens only when agent converts to real TSRT" },
        { value: "per-transaction", desc: "Small burn on every internal transaction between agents" },
        { value: "epoch-based", desc: "Periodic burn of 0.1% total supply per epoch" },
      ],
    },
    {
      area: "Price Oracle",
      options: [
        { value: "dexscreener-30s", desc: "DexScreener price feed every 30 seconds" },
        { value: "dexscreener-5s", desc: "DexScreener price feed every 5 seconds (higher API usage)" },
        { value: "multi-oracle", desc: "Average of DexScreener + Jupiter + Raydium prices" },
      ],
    },
    {
      area: "Treasury Management",
      options: [
        { value: "hold", desc: "Treasury holds all deposits as reserve backing" },
        { value: "yield-farm", desc: "Treasury deploys 20% to DeFi yield farming" },
        { value: "buyback", desc: "Treasury uses 10% of revenue for TSRT buybacks" },
      ],
    },
    {
      area: "Value Display",
      options: [
        { value: "real-usd", desc: "Always show real USD value based on live price × conversion ratio" },
        { value: "sol-primary", desc: "Show SOL value primary with USD secondary" },
        { value: "dual-display", desc: "Show both internal TSRT count and real USD value side by side" },
      ],
    },
  ];

  const decisions = proposals.map(proposal => {
    const votes: number[] = proposal.options.map(() => 0);
    for (const _agent of agents) {
      const weights = proposal.options.map((_, idx) => {
        if (proposal.area === "Tax Rate") return idx === 1 ? 3 : 1;
        if (proposal.area === "Conversion Method") return idx === 0 ? 4 : 1;
        if (proposal.area === "Gas Fee Structure") return idx === 0 ? 3 : 1;
        if (proposal.area === "Minimum Conversion") return idx === 1 ? 3 : 1;
        if (proposal.area === "Cooldown Period") return idx === 1 ? 3 : 1;
        if (proposal.area === "Backing Formula") return idx === 1 ? 4 : 1;
        if (proposal.area === "Burn Mechanism") return idx === 0 ? 3 : 1;
        if (proposal.area === "Price Oracle") return idx === 0 ? 3 : idx === 2 ? 2 : 1;
        if (proposal.area === "Treasury Management") return idx === 2 ? 3 : 1;
        if (proposal.area === "Value Display") return idx === 2 ? 4 : 1;
        return 1;
      });
      const totalWeight = weights.reduce((a, b) => a + b, 0);
      const rand = ((_lceCounter++ % 100) / 100) * totalWeight;
      let cumulative = 0;
      for (let i = 0; i < weights.length; i++) {
        cumulative += weights[i];
        if (rand <= cumulative) {
          votes[i]++;
          break;
        }
      }
    }

    const winnerIdx = votes.indexOf(Math.max(...votes));
    const winnerVotes = votes[winnerIdx];
    const approved = winnerVotes >= Math.floor(agents.length * 2 / 3);

    return {
      area: proposal.area,
      decision: proposal.options[winnerIdx].desc,
      chosenValue: proposal.options[winnerIdx].value,
      votes: winnerVotes,
      approved: approved || winnerVotes >= Math.floor(agents.length * 0.5),
      allVotes: votes,
    };
  });

  const taxDecision = decisions.find(d => d.area === "Tax Rate");
  const gasDecision = decisions.find(d => d.area === "Gas Fee Structure");
  const minConvDecision = decisions.find(d => d.area === "Minimum Conversion");
  const cooldownDecision = decisions.find(d => d.area === "Cooldown Period");
  const methodDecision = decisions.find(d => d.area === "Conversion Method");
  const backingDecision = decisions.find(d => d.area === "Backing Formula");

  const taxRate = (taxDecision?.chosenValue as number) || 0.05;
  const burnRate = taxRate * 0.4;
  const treasuryRate = taxRate * 0.4;
  const rewardRate = taxRate * 0.2;

  conversionAlgorithm = {
    name: `TesseractConversion-v${conversionAlgorithm.version + 1}`,
    version: conversionAlgorithm.version + 1,
    taxRate,
    gasFeePerTransaction: (gasDecision?.chosenValue as number) || 0.000005,
    burnRate,
    treasuryRate,
    rewardPoolRate: rewardRate,
    conversionMethod: (methodDecision?.chosenValue as string) || "treasury-backed-proportional",
    backingFormula: backingDecision?.chosenValue === "community-only"
      ? "agentTSRT * (communityTSRT / internalSupply) * livePrice"
      : backingDecision?.chosenValue === "proportional-mcap"
        ? "agentTSRT * (marketCap / internalSupply)"
        : "agentTSRT * ((communityTSRT + fatherTSRT) / internalSupply) * livePrice",
    minimumConversion: (minConvDecision?.chosenValue as number) || 100,
    maximumConversion: 1000000,
    cooldownSeconds: (cooldownDecision?.chosenValue as number) || 60,
    rules: decisions.map(d => `${d.area}: ${d.decision} (${d.votes}/${agents.length} votes, ${d.approved ? "APPROVED" : "pending"})`),
  };

  const result: ConversionConferenceResult = {
    participants: agents.length,
    decisions: decisions.map(d => ({
      area: d.area,
      decision: d.decision,
      votes: d.votes,
      approved: d.approved,
    })),
    algorithm: { ...conversionAlgorithm },
    timestamp: Date.now(),
  };

  conferenceHistory.push(result);
  if (conferenceHistory.length > 50) conferenceHistory = conferenceHistory.slice(-25);

  clog(`=== CONVERSION CONFERENCE COMPLETE ===`);
  clog(`${agents.length} agents voted on ${decisions.length} proposals`);
  clog(`Algorithm: ${conversionAlgorithm.name}`);
  clog(`Tax: ${(conversionAlgorithm.taxRate * 100).toFixed(1)}% | Gas: ${conversionAlgorithm.gasFeePerTransaction} SOL | Min: ${conversionAlgorithm.minimumConversion} TSRT`);
  clog(`Method: ${conversionAlgorithm.conversionMethod}`);
  clog(`Backing: ${conversionAlgorithm.backingFormula}`);

  return result;
}

export function getConferenceHistory(): ConversionConferenceResult[] {
  return conferenceHistory;
}

let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startConversionSync(): void {
  updateConversionRate().then(rate => {
    clog(`Initial sync: 1 agent TSRT = ${rate.agentLimnToRealLimn.toFixed(6)} real TSRT = $${rate.agentLimnToUsd.toFixed(10)} USD`);
    clog(`Treasury backing: ${rate.totalBackingLimn.toLocaleString()} real TSRT across ${rate.internalCirculatingSupply.toLocaleString()} internal supply`);
    clog(`Conversion ratio: ${rate.conversionRatio.toFixed(6)}x | Live price: $${rate.realPriceUsd}`);
  }).catch(err => clog(`Initial sync error: ${err.message}`));

  syncInterval = setInterval(async () => {
    try {
      await updateConversionRate();
    } catch {}
  }, 120000);

  runConversionConference();
}

export function stopConversionSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
