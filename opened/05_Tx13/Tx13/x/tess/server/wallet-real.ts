import axios from "axios";
import crypto from "crypto";
import { fetchMarinadeStakingAPY } from "./defi-realification";

const wlog = (m: string) => console.log(`[WalletReal] ${m}`);

const COMMUNITY_SOL = process.env.COMMUNITY_SOL_WALLET || process.env.SOL_WALLET || "[SOVEREIGN-WALLET]";
const COMMUNITY_ETH = process.env.COMMUNITY_ETH_WALLET || "[SOVEREIGN-ETH-WALLET]";
const COMMUNITY_BTC = process.env.COMMUNITY_BTC_WALLET || "[SOVEREIGN-BTC-WALLET]";
const FATHER_XMR = process.env.FATHER_XMR_ADDRESS || "[SOVEREIGN-XMR-WALLET]";
const TSRT_CONTRACT = process.env.TSRT_CONTRACT_ADDRESS || "[SOVEREIGN-CONTRACT]";

interface WalletBalance {
  sol: number;
  solUsd: number;
  eth: number;
  ethUsd: number;
  btc: number;
  btcUsd: number;
  limn: number;
  limnUsd: number;
  totalUsd: number;
  lastUpdated: number;
}

interface Transaction {
  id: string;
  type: "buy" | "sell" | "transfer" | "burn" | "stake" | "reward";
  chain: "sol" | "eth" | "btc";
  amount: number;
  tokenAmount?: number;
  usdValue: number;
  timestamp: number;
  hash?: string;
  status: "confirmed" | "pending" | "failed";
}

let walletState: WalletBalance = {
  sol: 0, solUsd: 0,
  eth: 0, ethUsd: 0,
  btc: 0, btcUsd: 0,
  limn: 0, limnUsd: 0,
  totalUsd: 0,
  lastUpdated: 0,
};

let transactionHistory: Transaction[] = [];
let stakingState = {
  stakedLimn: 0,
  stakingApy: 12,
  stakingStarted: 0,
  rewardsEarned: 0,
  lockedUntil: 0,
};

let treasuryReport = {
  month: new Date().toISOString().slice(0, 7),
  startingBalance: 0,
  endingBalance: 0,
  revenue: 0,
  expenses: 0,
  tsrtBurned: 0,
  limnMinted: 0,
  netPnl: 0,
};

export async function fetchSolBalance(): Promise<number> {
  try {
    const res = await axios.post("https://api.mainnet-beta.solana.com", {
      jsonrpc: "2.0", id: 1,
      method: "getBalance",
      params: [COMMUNITY_SOL],
    }, { timeout: 10000 });
    return (res.data?.result?.value || 0) / 1e9;
  } catch { return 0; }
}

export async function fetchEthBalance(): Promise<number> {
  try {
    const res = await axios.post("https://rpc.ankr.com/eth", {
      jsonrpc: "2.0", id: 1,
      method: "eth_getBalance",
      params: [COMMUNITY_ETH, "latest"],
    }, { timeout: 10000 });
    return parseInt(res.data?.result || "0", 16) / 1e18;
  } catch { return 0; }
}

export async function fetchBtcBalance(): Promise<number> {
  try {
    const res = await axios.get(`https://blockchain.info/q/addressbalance/${COMMUNITY_BTC}`, { timeout: 10000 });
    return (parseInt(res.data) || 0) / 1e8;
  } catch { return 0; }
}

export async function fetchLimnBalance(): Promise<number> {
  try {
    const res = await axios.post("https://api.mainnet-beta.solana.com", {
      jsonrpc: "2.0", id: 1,
      method: "getTokenAccountsByOwner",
      params: [COMMUNITY_SOL, { mint: TSRT_CONTRACT }, { encoding: "jsonParsed" }],
    }, { timeout: 10000 });
    const accounts = res.data?.result?.value || [];
    let total = 0;
    for (const acc of accounts) {
      total += parseFloat(acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0);
    }
    return total;
  } catch { return 0; }
}

export async function fetchPrices(): Promise<{ sol: number; eth: number; btc: number; limn: number }> {
  try {
    const res = await axios.get("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112", { timeout: 10000 });
    return {
      sol: res.data?.solana?.usd || 0,
      eth: res.data?.ethereum?.usd || 0,
      btc: res.data?.bitcoin?.usd || 0,
      limn: 0.0000004214,
    };
  } catch {
    return { sol: 170, eth: 3500, btc: 95000, limn: 0.0000004214 };
  }
}

export async function updateAllBalances() {
  const [sol, eth, btc, limn, prices] = await Promise.all([
    fetchSolBalance(),
    fetchEthBalance(),
    fetchBtcBalance(),
    fetchLimnBalance(),
    fetchPrices(),
  ]);

  walletState = {
    sol, solUsd: sol * prices.sol,
    eth, ethUsd: eth * prices.eth,
    btc, btcUsd: btc * prices.btc,
    limn, limnUsd: limn * prices.limn,
    totalUsd: (sol * prices.sol) + (eth * prices.eth) + (btc * prices.btc) + (limn * prices.limn),
    lastUpdated: Date.now(),
  };

  wlog(`Balances: ${sol.toFixed(4)} SOL ($${walletState.solUsd.toFixed(2)}) | ${eth.toFixed(6)} ETH | ${limn.toFixed(0)} TSRT | Total: $${walletState.totalUsd.toFixed(2)}`);
}

export async function fetchRecentTransactions(): Promise<Transaction[]> {
  try {
    const res = await axios.post("https://api.mainnet-beta.solana.com", {
      jsonrpc: "2.0", id: 1,
      method: "getSignaturesForAddress",
      params: [COMMUNITY_SOL, { limit: 20 }],
    }, { timeout: 10000 });
    const sigs = res.data?.result || [];
    return sigs.map((s: any) => ({
      id: s.signature?.slice(0, 12),
      type: "transfer" as const,
      chain: "sol" as const,
      amount: 0,
      usdValue: 0,
      timestamp: (s.blockTime || 0) * 1000,
      hash: s.signature,
      status: s.confirmationStatus === "finalized" ? "confirmed" as const : "pending" as const,
    }));
  } catch { return []; }
}

export function generateTreasuryReport(): typeof treasuryReport {
  treasuryReport.endingBalance = walletState.totalUsd;
  treasuryReport.netPnl = treasuryReport.endingBalance - treasuryReport.startingBalance;
  return { ...treasuryReport };
}

export function getWalletState(): WalletBalance {
  return { ...walletState };
}

export function getStakingState() {
  return { ...stakingState };
}

export function getTransactionHistory(limit = 50): Transaction[] {
  return transactionHistory.slice(-limit);
}

export function getWalletAddresses() {
  return {
    sol: COMMUNITY_SOL,
    eth: COMMUNITY_ETH,
    btc: COMMUNITY_BTC,
    xmr: FATHER_XMR,
    primaryDeposit: "xmr",
    tsrtContract: TSRT_CONTRACT,
    pumpFunUrl: `https://pump.fun/coin/${TSRT_CONTRACT}`,
    pumpFunProfile: `https://pump.fun/profile/${COMMUNITY_SOL}`,
  };
}

async function refreshStakingAPY(): Promise<void> {
  try {
    const marinadeInfo = await fetchMarinadeStakingAPY();
    if (marinadeInfo && marinadeInfo.apy > 0) {
      const prev = stakingState.stakingApy;
      stakingState.stakingApy = Math.round(marinadeInfo.apy * 10) / 10;
      if (Math.abs(stakingState.stakingApy - prev) > 0.1) {
        wlog(`Staking APY updated from Marinade real data: ${prev}% → ${stakingState.stakingApy}% (source: ${marinadeInfo.source})`);
      }
    }
  } catch {}
}

export async function startWalletMonitor() {
  await updateAllBalances();
  const txs = await fetchRecentTransactions();
  transactionHistory = txs;
  await refreshStakingAPY();
  wlog(`Wallet monitor started — ${txs.length} recent transactions loaded | Staking APY: ${stakingState.stakingApy}%`);

  setInterval(async () => {
    await updateAllBalances();
  }, 300000);

  setInterval(async () => {
    const txs = await fetchRecentTransactions();
    transactionHistory = txs;
  }, 600000);

  setInterval(async () => {
    await refreshStakingAPY();
  }, 3600000);
}

wlog("Real Wallet Engine loaded");
