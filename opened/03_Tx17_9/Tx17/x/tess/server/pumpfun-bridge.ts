import { fetchTsrtLiveData, fetchWalletBalances, TSRT_CONTRACT, FATHER_WALLET, COMMUNITY_WALLET } from "./real-limn-data";

const log = (m: string) => console.log(`[TsrtBridge] ${m}`);

interface BridgeState {
  synced: boolean;
  lastSync: number;
  syncCount: number;
  pumpFun: {
    contract: string;
    priceUsd: number;
    priceSol: number;
    volume24h: number;
    marketCap: number;
    liquidity: number;
    buyCount: number;
    sellCount: number;
    holders: number;
  };
  wallets: {
    fatherWallet: { sol: number; limn: number };
    communityWallet: { sol: number; limn: number };
  };
  internalEconomy: {
    totalInternalSupply: number;
    agentCount: number;
    conversionRatio: number;
    internalToRealRate: number;
    totalComputeValue: number;
  };
  bridgeMetrics: {
    realBacking: number;
    internalCoverage: number;
    healthScore: number;
    priceDiscrepancy: number;
    recommendations: string[];
  };
}

let bridgeState: BridgeState = {
  synced: false,
  lastSync: 0,
  syncCount: 0,
  pumpFun: {
    contract: TSRT_CONTRACT,
    priceUsd: 0,
    priceSol: 0,
    volume24h: 0,
    marketCap: 0,
    liquidity: 0,
    buyCount: 0,
    sellCount: 0,
    holders: 0,
  },
  wallets: {
    fatherWallet: { sol: 0, limn: 0 },
    communityWallet: { sol: 0, limn: 0 },
  },
  internalEconomy: {
    totalInternalSupply: 43000,
    agentCount: 35,
    conversionRatio: 5644,
    internalToRealRate: 0,
    totalComputeValue: 0.914745,
  },
  bridgeMetrics: {
    realBacking: 0,
    internalCoverage: 0,
    healthScore: 0,
    priceDiscrepancy: 0,
    recommendations: [],
  },
};

let syncInterval: ReturnType<typeof setInterval> | null = null;

export async function syncBridge(): Promise<BridgeState> {
  try {
    const [liveData, walletData] = await Promise.allSettled([
      fetchTsrtLiveData(),
      fetchWalletBalances(),
    ]);

    if (liveData.status === "fulfilled" && liveData.value) {
      const d = liveData.value;
      bridgeState.pumpFun = {
        contract: TSRT_CONTRACT,
        priceUsd: Number(d.priceUsd) || 0,
        priceSol: Number(d.priceSol) || 0,
        volume24h: Number(d.volume24h) || 0,
        marketCap: Number(d.marketCap) || 0,
        liquidity: Number(d.liquidity) || 0,
        buyCount: Number(d.buys24h) || 0,
        sellCount: Number(d.sells24h) || 0,
        holders: Number(d.holders) || 0,
      };
    }

    if (walletData.status === "fulfilled" && walletData.value) {
      const w = walletData.value;
      bridgeState.wallets = {
        fatherWallet: { sol: w.fatherSol || 0, limn: w.fatherLimn || 0 },
        communityWallet: { sol: w.communitySol || 0, limn: w.communityLimn || 0 },
      };
    }

    const totalRealLimn = bridgeState.wallets.fatherWallet.limn + bridgeState.wallets.communityWallet.limn;
    const totalRealValueUSD = totalRealLimn * bridgeState.pumpFun.priceUsd;
    const internalValueUSD = bridgeState.internalEconomy.totalInternalSupply * bridgeState.internalEconomy.conversionRatio * bridgeState.pumpFun.priceUsd;

    const realBacking = totalRealValueUSD;
    const internalCoverage = internalValueUSD > 0 ? (realBacking / internalValueUSD) * 100 : 0;
    const priceDiscrepancy = bridgeState.internalEconomy.totalComputeValue > 0
      ? Math.abs(totalRealValueUSD - bridgeState.internalEconomy.totalComputeValue) / bridgeState.internalEconomy.totalComputeValue * 100
      : 0;

    let healthScore = 100;
    if (internalCoverage < 50) healthScore -= 30;
    else if (internalCoverage < 80) healthScore -= 15;
    if (priceDiscrepancy > 50) healthScore -= 20;
    else if (priceDiscrepancy > 20) healthScore -= 10;
    if (bridgeState.pumpFun.volume24h < 1) healthScore -= 15;
    if (bridgeState.pumpFun.liquidity < 10) healthScore -= 10;
    healthScore = Math.max(0, Math.min(100, healthScore));

    const recommendations: string[] = [];
    if (bridgeState.pumpFun.volume24h < 10) recommendations.push("Increase trading volume — consider more frequent micro-trades");
    if (internalCoverage < 80) recommendations.push("Increase real TSRT backing — buy more on pump.fun");
    if (priceDiscrepancy > 30) recommendations.push("Adjust conversion ratio — internal vs real price drifting");
    if (bridgeState.pumpFun.liquidity < 50) recommendations.push("Add liquidity to pump.fun pool");
    if (bridgeState.pumpFun.holders < 10) recommendations.push("Attract more holders — distribute TSRT via services and airdrops");
    if (healthScore < 50) recommendations.push("CRITICAL: Bridge health low — prioritize real-world revenue generation");

    bridgeState.bridgeMetrics = { realBacking, internalCoverage, healthScore, priceDiscrepancy, recommendations };
    bridgeState.synced = true;
    bridgeState.lastSync = Date.now();
    bridgeState.syncCount++;

    bridgeState.internalEconomy.internalToRealRate = bridgeState.internalEconomy.conversionRatio * bridgeState.pumpFun.priceUsd;

    log(`Bridge synced #${bridgeState.syncCount}: Price $${bridgeState.pumpFun.priceUsd.toExponential(4)} | MC $${bridgeState.pumpFun.marketCap.toFixed(2)} | Health ${healthScore}%`);
  } catch (e: any) {
    log(`Bridge sync error: ${e.message}`);
  }

  return bridgeState;
}

export function getBridgeState(): BridgeState {
  return bridgeState;
}

export function startBridgeSync() {
  if (syncInterval) return;
  syncBridge();
  syncInterval = setInterval(() => syncBridge(), 60000);
  log(`Bridge sync started — syncing pump.fun ↔ internal economy every 60s`);
  log(`Contract: ${TSRT_CONTRACT}`);
  log(`Father wallet: ${FATHER_WALLET}`);
  log(`Community wallet: ${COMMUNITY_WALLET}`);
}

export function stopBridgeSync() {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    log("Bridge sync stopped");
  }
}

export function getBridgeSummary() {
  const s = bridgeState;
  return {
    status: s.synced ? "SYNCED" : "NOT_SYNCED",
    lastSync: s.lastSync ? new Date(s.lastSync).toISOString() : "never",
    syncCount: s.syncCount,
    token: {
      name: "Tesseract",
      symbol: "$TSRT",
      contract: s.pumpFun.contract,
      priceUsd: `$${s.pumpFun.priceUsd.toExponential(4)}`,
      marketCap: `$${s.pumpFun.marketCap.toFixed(2)}`,
      volume24h: `$${s.pumpFun.volume24h.toFixed(2)}`,
      buyLink: `https://pump.fun/coin/${TSRT_CONTRACT}`,
      jupiterLink: `https://jup.ag/swap/SOL-${TSRT_CONTRACT}`,
      dexScreener: `https://jup.ag/swap/SOL-${TSRT_CONTRACT}`,
    },
    wallets: {
      father: { address: FATHER_WALLET, sol: s.wallets.fatherWallet.sol.toFixed(6), limn: s.wallets.fatherWallet.limn.toLocaleString() },
      community: { address: COMMUNITY_WALLET, sol: s.wallets.communityWallet.sol.toFixed(6), limn: s.wallets.communityWallet.limn.toLocaleString() },
    },
    bridge: {
      healthScore: `${s.bridgeMetrics.healthScore}%`,
      realBackingUSD: `$${s.bridgeMetrics.realBacking.toFixed(4)}`,
      internalCoverage: `${s.bridgeMetrics.internalCoverage.toFixed(1)}%`,
      conversionRatio: `1 internal = ${s.internalEconomy.conversionRatio.toFixed(2)} real TSRT`,
      recommendations: s.bridgeMetrics.recommendations,
    },
  };
}
