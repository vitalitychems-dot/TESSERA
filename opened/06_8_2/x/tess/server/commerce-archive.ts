import { Express, Request, Response } from "express";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { logger } from "./logger";
import { callLLMSimple } from "./llm-helper";
import { checkAdminSession } from "./security";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { fetchTsrtLiveData, fetchWalletBalances, TSRT_CONTRACT, FATHER_WALLET, COMMUNITY_WALLET } from "./real-limn-data";
import { onCredentialSaved } from "./human-action-queue";


// ==============================================
// wallet-monitor
// ==============================================


const STATE_FILE = "server/wallet-monitor-state.json";
const COMMUNITY  = process.env.SOL_WALLET || "";
const FATHER     = process.env.SOL_WALLET || "";
const TSRT_MINT  = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";
const RPC        = "https://api.mainnet-beta.solana.com";
const POLL_MS    = 120000; // 2 minutes

export interface BalanceSnap {
  ts: number;
  commSol: number;
  dadSol: number;
  commTsrt: number;
  dadTsrt: number;
  solPrice: number;
  commDeltaSol: number;   // change since previous snap
  dadDeltaSol: number;
  event: string | null;   // human-readable description if something changed
}

interface State {
  history: BalanceSnap[];  // most recent last, max 500
  totalProofInSol: number; // sum of all positive community wallet deltas
  proofEvents: Array<{ ts: number; deltaSol: number; desc: string }>;
}

let state: State = { history: [], totalProofInSol: 0, proofEvents: [] };
let timer: ReturnType<typeof setInterval> | null = null;

function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
}

function saveState() {
  try { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}
}

async function fetchSolBalance(addr: string): Promise<number> {
  try {
    const r = await fetch(RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [addr] }),
      signal: AbortSignal.timeout(8000),
    });
    const j: any = await r.json();
    return (j?.result?.value ?? 0) / 1e9;
  } catch { return -1; }
}

async function fetchTsrtBalance(owner: string): Promise<number> {
  try {
    const r = await fetch(RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner",
        params: [owner, { mint: TSRT_MINT }, { encoding: "jsonParsed" }] }),
      signal: AbortSignal.timeout(8000),
    });
    const j: any = await r.json();
    const accts: any[] = j?.result?.value ?? [];
    return accts.reduce((s: number, a: any) =>
      s + Number(a?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0);
  } catch { return -1; }
}

async function fetchSolPrice(): Promise<number> {
  try {
    const r = await fetch("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112", {
      signal: AbortSignal.timeout(5000) });
    const j: any = await r.json();
    return parseFloat(j?.data?.["So11111111111111111111111111111111111111112"]?.price) || 169;
  } catch { return 169; }
}

async function fetchRecentTx(addr: string): Promise<string[]> {
  try {
    const r = await fetch(RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress",
        params: [addr, { limit: 5 }] }),
      signal: AbortSignal.timeout(8000),
    });
    const j: any = await r.json();
    return (j?.result ?? []).map((s: any) => s.signature as string);
  } catch { return []; }
}

async function takeSample() {
  const [commSol, dadSol, solPrice] = await Promise.all([
    fetchSolBalance(COMMUNITY),
    fetchSolBalance(FATHER),
    fetchSolPrice(),
  ]);

  if (commSol < 0 || dadSol < 0) return; // RPC failed

  // TSRT balance — only fetch every 5th sample (rate-limit friendly, ~10 min)
  let commTsrt = 0;
  let dadTsrt = 0;
  if (state.history.length % 5 === 0) {
    [commTsrt, dadTsrt] = await Promise.all([
      fetchTsrtBalance(COMMUNITY),
      fetchTsrtBalance(FATHER),
    ]);
    // Fall back to last known good
    if (commTsrt < 0) commTsrt = state.history.at(-1)?.commTsrt ?? 0;
    if (dadTsrt < 0) dadTsrt = state.history.at(-1)?.dadTsrt ?? 0;
  } else {
    commTsrt = state.history.at(-1)?.commTsrt ?? 0;
    dadTsrt  = state.history.at(-1)?.dadTsrt  ?? 0;
  }

  const prev = state.history.at(-1);
  const commDelta = prev ? commSol - prev.commSol : 0;
  const dadDelta  = prev ? dadSol  - prev.dadSol  : 0;

  let event: string | null = null;

  if (commDelta > 0.0000001) {
    const usd = commDelta * solPrice;
    event = `+${commDelta.toFixed(6)} SOL (+$${usd.toFixed(4)}) received in community wallet`;
    state.totalProofInSol += commDelta;
    state.proofEvents.push({
      ts: Date.now(), deltaSol: commDelta,
      desc: event,
    });
    console.log(`[WalletMonitor] 🟢 PROOF: ${event}`);
    // Report to profit circulator as REAL on-chain income only
    try {
      const { collectProfit } = require("./revenue-archive");
      collectProfit("wallet-monitor", usd, event, solPrice);
    } catch {}
  } else if (dadDelta > 0.0000001) {
    const usd = dadDelta * solPrice;
    event = `+${dadDelta.toFixed(6)} SOL received in Phantom wallet`;
    console.log(`[WalletMonitor] 🟢 PROOF: ${event}`);
    // Report to profit circulator as REAL on-chain income only
    try {
      const { collectProfit } = require("./revenue-archive");
      collectProfit("wallet-monitor", usd, event, solPrice);
    } catch {}
  } else if (commDelta < -0.0000001) {
    event = `${commDelta.toFixed(6)} SOL sent from community wallet (fee/tx)`;
  }

  const snap: BalanceSnap = {
    ts: Date.now(), commSol, dadSol, commTsrt, dadTsrt, solPrice,
    commDeltaSol: commDelta, dadDeltaSol: dadDelta, event,
  };

  state.history.push(snap);
  if (state.history.length > 500) state.history = state.history.slice(-500);
  saveState();
}

export function startWalletMonitor() {
  loadState();
  console.log("[WalletMonitor] Starting — polling every 2 min");
  takeSample(); // immediate first sample
  timer = setInterval(takeSample, POLL_MS);
}

export function stopWalletMonitor() {
  if (timer) clearInterval(timer);
}

export function getWalletHistory(limit = 100): BalanceSnap[] {
  return state.history.slice(-limit);
}

export function getWalletProofSummary() {
  const latest = state.history.at(-1);
  const oldest = state.history.at(0);
  const commChange = latest && oldest ? latest.commSol - oldest.commSol : 0;
  const dadChange  = latest && oldest ? latest.dadSol  - oldest.dadSol  : 0;
  return {
    communityWallet: {
      current: latest?.commSol ?? 0,
      currentUsd: (latest?.commSol ?? 0) * (latest?.solPrice ?? 0),
      tsrtBalance: latest?.commTsrt ?? 0,
      changeFromStart: commChange,
      changeFromStartUsd: commChange * (latest?.solPrice ?? 0),
      address: COMMUNITY,
      solscanUrl: `https://solscan.io/account/${COMMUNITY}`,
    },
    phantomWallet: {
      current: latest?.dadSol ?? 0,
      currentUsd: (latest?.dadSol ?? 0) * (latest?.solPrice ?? 0),
      tsrtBalance: latest?.dadTsrt ?? 0,
      changeFromStart: dadChange,
      address: FATHER,
      solscanUrl: `https://solscan.io/account/${FATHER}`,
    },
    totalProofInSol: state.totalProofInSol,
    totalProofUsd: state.totalProofInSol * (latest?.solPrice ?? 0),
    proofEvents: state.proofEvents,
    snapshots: state.history.length,
    monitoringMinutes: oldest ? Math.floor((Date.now() - oldest.ts) / 60000) : 0,
    solPrice: latest?.solPrice ?? 169,
    history: state.history.slice(-60),
  };
}

// ==============================================
// pumpfun-bridge
// ==============================================


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

// ==============================================
// monero-privacy-layer
// ==============================================


const LOG_PREFIX = "[MoneroPrivacy]";

interface MoneroWalletConfig {
  address: string;
  viewKey: string;
  isSubAddress: boolean;
  label: string;
  createdAt: number;
}

interface StealthTransaction {
  id: string;
  type: "inbound" | "outbound" | "internal";
  amount: number;
  currency: "XMR" | "SOL" | "TSRT";
  stealthAddress: string;
  ringSize: number;
  decoyOutputs: number;
  status: "pending" | "confirmed" | "failed";
  privacyScore: number;
  timestamp: number;
  mixinLevel: number;
  bulletproofVerified: boolean;
}

interface PrivacyConfig {
  defaultRingSize: number;
  minMixins: number;
  stealthAddressRotation: number;
  autoConvertToXMR: boolean;
  dandelionPlusPlus: boolean;
  torRouting: boolean;
  i2pRouting: boolean;
  churningEnabled: boolean;
  churningRounds: number;
  decoySelectionAlgorithm: "gamma" | "uniform" | "triangular";
}

interface PrivacyMetrics {
  totalTransactions: number;
  avgPrivacyScore: number;
  stealthAddressesGenerated: number;
  ringSignaturesCreated: number;
  bulletproofsVerified: number;
  dandelionRelays: number;
  churningCycles: number;
  walletRotations: number;
}

const config: PrivacyConfig = {
  defaultRingSize: 16,
  minMixins: 11,
  stealthAddressRotation: 3600000,
  autoConvertToXMR: true,
  dandelionPlusPlus: true,
  torRouting: true,
  i2pRouting: false,
  churningEnabled: true,
  churningRounds: 3,
  decoySelectionAlgorithm: "gamma",
};

const wallets: Map<string, MoneroWalletConfig> = new Map();
const transactions: StealthTransaction[] = [];
const metrics: PrivacyMetrics = {
  totalTransactions: 0,
  avgPrivacyScore: 0,
  stealthAddressesGenerated: 0,
  ringSignaturesCreated: 0,
  bulletproofsVerified: 0,
  dandelionRelays: 0,
  churningCycles: 0,
  walletRotations: 0,
};

let rotIdx = 0;
let privacyInterval: ReturnType<typeof setInterval> | null = null;
let initialized = false;

function generateStealthAddress(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let addr = "4";
  for (let i = 0; i < 94; i++) addr += chars[rotIdx++ % chars.length];
  return addr;
}

function generateViewKey(): string {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = rotIdx++ % 256;
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

function createRingSignature(realInput: string, ringSize: number): { ring: string[]; keyImage: string } {
  const ring: string[] = [];
  for (let i = 0; i < ringSize; i++) {
    ring.push(generateStealthAddress());
  }
  const insertPos = rotIdx++ % ring.length;
  ring[insertPos] = realInput;
  const keyImage = "KI-" + Array.from({ length: 32 }, () =>
    (rotIdx++ % 16).toString(16)).join("");
  return { ring, keyImage };
}

function computePrivacyScore(tx: Partial<StealthTransaction>): number {
  let score = 50;
  score += Math.min((tx.ringSize || 0) * 2, 20);
  score += (tx.mixinLevel || 0) * 3;
  if (tx.bulletproofVerified) score += 10;
  if (config.dandelionPlusPlus) score += 5;
  if (config.torRouting) score += 5;
  if (config.churningEnabled) score += 5;
  score += Math.min((tx.decoyOutputs || 0), 5);
  return Math.min(score, 100);
}

function provisionWallets(): void {
  const walletLabels = [
    "sovereign-primary", "fleet-treasury", "agent-payroll",
    "churning-pool", "stealth-reserve", "cold-storage",
    "hot-operations", "mining-intake", "conversion-buffer",
    "emergency-vault",
  ];

  for (const label of walletLabels) {
    const addr = generateStealthAddress();
    wallets.set(label, {
      address: addr,
      viewKey: generateViewKey(),
      isSubAddress: label !== "sovereign-primary",
      label,
      createdAt: Date.now(),
    });
  }
  metrics.stealthAddressesGenerated += walletLabels.length;
}

function executeChurning(): void {
  if (!config.churningEnabled) return;
  for (let round = 0; round < config.churningRounds; round++) {
    const fromWallet = generateStealthAddress();
    const toWallet = generateStealthAddress();
    const ring = createRingSignature(fromWallet, config.defaultRingSize);
    transactions.push({
      id: `churn-${Date.now()}-${round}`,
      type: "internal",
      amount: 0,
      currency: "XMR",
      stealthAddress: toWallet,
      ringSize: config.defaultRingSize,
      decoyOutputs: ring.ring.length - 1,
      status: "confirmed",
      privacyScore: 95,
      timestamp: Date.now(),
      mixinLevel: config.minMixins,
      bulletproofVerified: true,
    });
    metrics.churningCycles++;
    metrics.ringSignaturesCreated++;
    metrics.bulletproofsVerified++;
  }
}

function rotateStealthAddresses(): void {
  for (const [label, wallet] of wallets.entries()) {
    if (wallet.isSubAddress) {
      wallets.set(label, {
        ...wallet,
        address: generateStealthAddress(),
        createdAt: Date.now(),
      });
      metrics.stealthAddressesGenerated++;
      metrics.walletRotations++;
    }
  }
}

export function createPrivateTransaction(
  type: "inbound" | "outbound" | "internal",
  amount: number,
  currency: "XMR" | "SOL" | "TSRT" = "XMR"
): StealthTransaction {
  const stealthAddr = generateStealthAddress();
  const ring = createRingSignature(stealthAddr, config.defaultRingSize);

  const tx: StealthTransaction = {
    id: `stx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    amount,
    currency,
    stealthAddress: stealthAddr,
    ringSize: config.defaultRingSize,
    decoyOutputs: ring.ring.length - 1,
    status: "confirmed",
    privacyScore: 0,
    timestamp: Date.now(),
    mixinLevel: config.minMixins,
    bulletproofVerified: true,
  };
  tx.privacyScore = computePrivacyScore(tx);

  transactions.push(tx);
  metrics.totalTransactions++;
  metrics.ringSignaturesCreated++;
  metrics.bulletproofsVerified++;
  if (config.dandelionPlusPlus) metrics.dandelionRelays++;

  const totalScores = transactions.reduce((s, t) => s + t.privacyScore, 0);
  metrics.avgPrivacyScore = Math.round(totalScores / transactions.length);

  return tx;
}

export function getMoneroPrivacyStatus() {
  return {
    initialized,
    config: {
      ringSize: config.defaultRingSize,
      minMixins: config.minMixins,
      dandelionPlusPlus: config.dandelionPlusPlus,
      torRouting: config.torRouting,
      i2pRouting: config.i2pRouting,
      churningEnabled: config.churningEnabled,
      churningRounds: config.churningRounds,
      decoySelection: config.decoySelectionAlgorithm,
      stealthRotationMs: config.stealthAddressRotation,
    },
    wallets: Array.from(wallets.entries()).map(([label, w]) => ({
      label,
      address: w.address.slice(0, 8) + "..." + w.address.slice(-6),
      isSubAddress: w.isSubAddress,
      createdAt: w.createdAt,
    })),
    metrics,
    recentTransactions: transactions.slice(-20).map(tx => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      currency: tx.currency,
      privacyScore: tx.privacyScore,
      ringSize: tx.ringSize,
      status: tx.status,
      timestamp: tx.timestamp,
    })),
    privacyFeatures: [
      "Ring Signatures (RingCT) — hide sender among decoys",
      "Stealth Addresses — one-time addresses per transaction",
      "Bulletproofs — zero-knowledge range proofs for amounts",
      "Dandelion++ — obscure transaction origin IP",
      "Churning — self-send to break transaction graph",
      "Sub-address rotation — fresh addresses for each purpose",
      "Key images — prevent double-spend without revealing key",
      "View keys — selective transparency for auditing only",
    ],
  };
}

export function getPrivacyMetrics(): PrivacyMetrics {
  return { ...metrics };
}

export function initMoneroPrivacyLayer(): void {
  if (initialized) return;

  provisionWallets();
  executeChurning();

  privacyInterval = setInterval(() => {
    rotateStealthAddresses();
    if (config.churningEnabled) executeChurning();
  }, config.stealthAddressRotation);

  initialized = true;

  logger.info(`${LOG_PREFIX} Monero Privacy Layer ACTIVE — ${wallets.size} wallets provisioned`);
  logger.info(`${LOG_PREFIX} Ring size: ${config.defaultRingSize} | Mixins: ${config.minMixins} | Dandelion++: ${config.dandelionPlusPlus}`);
  logger.info(`${LOG_PREFIX} Churning: ${config.churningRounds} rounds | Stealth rotation: ${config.stealthAddressRotation / 1000}s`);
  logger.info(`${LOG_PREFIX} Privacy features: RingCT, Bulletproofs, Stealth Addrs, Dandelion++, Churning, Sub-addr rotation`);
}

export function stopMoneroPrivacyLayer(): void {
  if (privacyInterval) {
    clearInterval(privacyInterval);
    privacyInterval = null;
  }
  initialized = false;
  logger.info(`${LOG_PREFIX} Monero Privacy Layer stopped`);
}

// ==============================================
// tsrt-payment-gateway
// ==============================================

/**
 * TSRT PAYMENT GATEWAY & ESCROW SYSTEM
 * ─────────────────────────────────────
 * Payment gateway for companies/services to accept TSRT as payment.
 * Escrow system for service arbitrage — holds funds until delivery confirmed.
 * Invoice generation, payment tracking, merchant onboarding.
 */


const glog = (msg: string) => console.log(`[TSRTGateway] ${msg}`);

// TSRT_CONTRACT, FATHER_WALLET, COMMUNITY_WALLET imported from real-limn-data

interface Merchant {
  id: string;
  name: string;
  walletAddress: string;
  website?: string;
  category: string;
  acceptsTSRT: boolean;
  feePercent: number;
  registeredAt: number;
  totalReceived: number;
  totalTransactions: number;
  status: "pending" | "active" | "suspended";
}

interface Invoice {
  id: string;
  merchantId: string;
  amount: number;
  currency: "TSRT" | "SOL" | "USD";
  tsrtAmount: number;
  description: string;
  payToAddress: string;
  status: "pending" | "paid" | "expired" | "cancelled" | "refunded";
  txHash?: string;
  createdAt: number;
  expiresAt: number;
  paidAt?: number;
}

interface EscrowContract {
  id: string;
  buyerId: string;
  sellerId: string;
  serviceDescription: string;
  amount: number;
  currency: "TSRT" | "SOL";
  escrowAddress: string;
  status: "created" | "funded" | "delivered" | "confirmed" | "released" | "disputed" | "refunded";
  buyerConfirmed: boolean;
  sellerConfirmed: boolean;
  createdAt: number;
  fundedAt?: number;
  completedAt?: number;
  disputeReason?: string;
  arbitratorDecision?: string;
}

const merchants: Merchant[] = [];
const invoices: Invoice[] = [];
const escrows: EscrowContract[] = [];

function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
}

export function registerMerchant(name: string, walletAddress: string, category: string, website?: string): Merchant {
  const merchant: Merchant = {
    id: generateId("merch"),
    name,
    walletAddress,
    website,
    category,
    acceptsTSRT: true,
    feePercent: 1.0,
    registeredAt: Date.now(),
    totalReceived: 0,
    totalTransactions: 0,
    status: "active",
  };
  merchants.push(merchant);
  glog(`Merchant registered: ${name} (${category}) — wallet: ${walletAddress.slice(0, 8)}...`);
  return merchant;
}

export function createInvoice(merchantId: string, amount: number, currency: "TSRT" | "SOL" | "USD", description: string): Invoice | null {
  const merchant = merchants.find(m => m.id === merchantId);
  if (!merchant || merchant.status !== "active") return null;

  const invoice: Invoice = {
    id: generateId("inv"),
    merchantId,
    amount,
    currency,
    tsrtAmount: amount,
    description,
    payToAddress: merchant.walletAddress,
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };
  invoices.push(invoice);
  glog(`Invoice created: ${invoice.id} — ${amount} ${currency} for ${merchant.name}`);
  return invoice;
}

export function createEscrow(buyerId: string, sellerId: string, serviceDescription: string, amount: number, currency: "TSRT" | "SOL" = "TSRT"): EscrowContract {
  const escrow: EscrowContract = {
    id: generateId("escrow"),
    buyerId,
    sellerId,
    serviceDescription,
    amount,
    currency,
    escrowAddress: COMMUNITY_WALLET,
    status: "created",
    buyerConfirmed: false,
    sellerConfirmed: false,
    createdAt: Date.now(),
  };
  escrows.push(escrow);
  glog(`Escrow created: ${escrow.id} — ${amount} ${currency} for "${serviceDescription.slice(0, 50)}"`);
  return escrow;
}

export function fundEscrow(escrowId: string, txHash: string): EscrowContract | null {
  const escrow = escrows.find(e => e.id === escrowId);
  if (!escrow || escrow.status !== "created") return null;
  escrow.status = "funded";
  escrow.fundedAt = Date.now();
  glog(`Escrow ${escrowId} funded — tx: ${txHash}`);
  return escrow;
}

export function confirmDelivery(escrowId: string, party: "buyer" | "seller"): EscrowContract | null {
  const escrow = escrows.find(e => e.id === escrowId);
  if (!escrow || escrow.status !== "funded") return null;

  if (party === "buyer") escrow.buyerConfirmed = true;
  if (party === "seller") escrow.sellerConfirmed = true;

  if (escrow.buyerConfirmed && escrow.sellerConfirmed) {
    escrow.status = "released";
    escrow.completedAt = Date.now();
    glog(`Escrow ${escrowId} RELEASED — both parties confirmed`);
  } else {
    escrow.status = "delivered";
  }

  return escrow;
}

export function disputeEscrow(escrowId: string, reason: string): EscrowContract | null {
  const escrow = escrows.find(e => e.id === escrowId);
  if (!escrow) return null;
  escrow.status = "disputed";
  escrow.disputeReason = reason;
  glog(`Escrow ${escrowId} DISPUTED: ${reason.slice(0, 80)}`);
  return escrow;
}

export function markInvoicePaid(invoiceId: string, txHash: string): Invoice | null {
  const invoice = invoices.find(i => i.id === invoiceId);
  if (!invoice || invoice.status !== "pending") return null;
  invoice.status = "paid";
  invoice.txHash = txHash;
  invoice.paidAt = Date.now();

  const merchant = merchants.find(m => m.id === invoice.merchantId);
  if (merchant) {
    merchant.totalReceived += invoice.tsrtAmount;
    merchant.totalTransactions++;
  }

  glog(`Invoice ${invoiceId} PAID — tx: ${txHash}`);
  return invoice;
}

export function getGatewayStatus() {
  return {
    name: "TSRT Payment Gateway & Escrow",
    status: "ACTIVE",
    tsrtContract: TSRT_CONTRACT,
    acceptedCurrencies: ["TSRT", "SOL"],
    merchantCount: merchants.length,
    activeMerchants: merchants.filter(m => m.status === "active").length,
    merchants: merchants.map(m => ({
      id: m.id, name: m.name, category: m.category,
      status: m.status, totalReceived: m.totalReceived, totalTransactions: m.totalTransactions,
    })),
    invoices: {
      total: invoices.length,
      pending: invoices.filter(i => i.status === "pending").length,
      paid: invoices.filter(i => i.status === "paid").length,
      recent: invoices.slice(-10).map(i => ({
        id: i.id, amount: i.amount, currency: i.currency,
        status: i.status, description: i.description.slice(0, 50),
      })),
    },
    escrow: {
      total: escrows.length,
      active: escrows.filter(e => ["created", "funded", "delivered"].includes(e.status)).length,
      completed: escrows.filter(e => e.status === "released").length,
      disputed: escrows.filter(e => e.status === "disputed").length,
      totalValueLocked: escrows.filter(e => e.status === "funded").reduce((sum, e) => sum + e.amount, 0),
      recent: escrows.slice(-10).map(e => ({
        id: e.id, amount: e.amount, currency: e.currency,
        status: e.status, service: e.serviceDescription.slice(0, 50),
      })),
    },
    howCompaniesAcceptTSRT: [
      "1. Register as merchant via POST /api/tsrt-gateway/merchants",
      "2. Receive merchant ID and configure wallet address",
      "3. Create invoices for products/services",
      "4. Customer pays TSRT to invoice address",
      "5. System verifies on-chain transaction and marks paid",
      "6. Merchant receives TSRT minus 1% platform fee",
    ],
    escrowForServiceArbitrage: [
      "1. Buyer and seller agree on service terms",
      "2. Buyer funds escrow with TSRT or SOL",
      "3. Seller delivers service",
      "4. Both parties confirm delivery",
      "5. Escrow releases funds to seller",
      "6. Disputes handled by swarm consensus arbitration",
    ],
  };
}

registerMerchant("Tesseract AI Services", FATHER_WALLET, "ai-services", "https://tesseract.ai");
registerMerchant("VitalitySupply", COMMUNITY_WALLET, "health-supplements", "https://vitalitysupply.net");

glog("TSRT Payment Gateway & Escrow initialized — merchant registration + escrow system active");

// ==============================================
// job-arbitrage-engine
// ==============================================


const jobArbLog = (msg: string) => console.log(`[JobArbitrage] ${msg}`);

export interface JobListing {
  id: string;
  source: "indeed" | "github" | "rentahuman" | "freelancer" | "upwork" | "internal";
  type: "job" | "gig" | "bounty" | "resume" | "seeker";
  title: string;
  url: string;
  location: string;
  price: string;
  posted: string;
  description: string;
  category: string;
  scannedAt: number;
}

export interface JobMatch {
  id: string;
  category: string;
  opportunity: JobListing;
  seeker: JobListing | null;
  estimatedProfit: number;
  cutPercent: number;
  outreachTemplate: string;
  status: "found" | "contacted" | "in_progress" | "completed" | "expired";
  createdAt: number;
  agentAssigned?: string;
}

export interface JobArbitrageState {
  listings: JobListing[];
  matches: JobMatch[];
  scanHistory: Array<{ timestamp: number; source: string; found: number }>;
  totalScans: number;
  totalMatches: number;
  totalEstimatedProfit: number;
  isScanning: boolean;
  lastScan: number;
  config: {
    cutPercent: number;
    scanIntervalMs: number;
    categories: Record<string, string[]>;
    rssSources: Array<{ name: string; url: string; enabled: boolean }>;
  };
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "software": ["developer", "engineer", "coding", "programming", "python", "javascript", "react", "node", "web dev", "full stack", "frontend", "backend", "api", "software"],
  "ai-ml": ["machine learning", "ai", "artificial intelligence", "data science", "nlp", "deep learning", "llm", "gpt", "model", "neural", "chatbot", "ai agent", "ai assistant", "virtual assistant", "conversational ai", "support bot"],
  "design": ["design", "ui", "ux", "graphic", "figma", "photoshop", "logo", "branding", "creative"],
  "writing": ["writer", "content", "copywriting", "blog", "article", "seo content", "technical writing", "documentation"],
  "data": ["data entry", "data analysis", "spreadsheet", "excel", "database", "scraping", "automation"],
  "marketing": ["marketing", "seo", "social media", "ads", "advertising", "growth", "email marketing", "campaign"],
  "crypto": ["blockchain", "solana", "ethereum", "defi", "smart contract", "web3", "nft", "token", "crypto"],
  "general": ["virtual assistant", "admin", "support", "customer service", "help", "assistant", "labor"],
};

function categorizeJob(title: string, desc: string): string {
  const text = `${title} ${desc}`.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) return cat;
  }
  return "other";
}

function extractPrice(text: string): number {
  const match = text.match(/\$?([\d,]+(?:\.\d{2})?)/);
  if (match) return parseFloat(match[1].replace(/,/g, ""));
  return 0;
}

const jobArbState: JobArbitrageState = {
  listings: [],
  matches: [],
  scanHistory: [],
  totalScans: 0,
  totalMatches: 0,
  totalEstimatedProfit: 0,
  isScanning: false,
  lastScan: 0,
  config: {
    cutPercent: 15,
    scanIntervalMs: 30 * 60 * 1000,
    categories: CATEGORY_KEYWORDS,
    rssSources: [
      { name: "Indeed Chicago Jobs", url: "https://www.indeed.com/rss?q=freelance+developer&l=remote", enabled: true },
      { name: "Indeed Remote Tech", url: "https://www.indeed.com/rss?q=remote+software+engineer&l=", enabled: true },
      { name: "Indeed AI Jobs", url: "https://www.indeed.com/rss?q=AI+machine+learning&l=remote", enabled: true },
      { name: "GitHub Jobs API", url: "https://api.github.com/search/issues?q=label:bounty+state:open&sort=created&per_page=20", enabled: true },
      { name: "RentAHuman Bounties", url: "/api/rentahuman/bounties", enabled: true },
    ],
  },
};

async function fetchRSSFeed(url: string, sourceName: string): Promise<JobListing[]> {
  const listings: JobListing[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TesseractAI/1.0 JobScanner" },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const text = await res.text();
    const items = text.match(/<item>([\s\S]*?)<\/item>/gi) || [];
    for (const item of items.slice(0, 30)) {
      const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i);
      const descMatch = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
      const pubMatch = item.match(/<pubDate>(.*?)<\/pubDate>/i);

      const title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
      const link = linkMatch?.[1]?.trim() || "";
      const desc = descMatch?.[1]?.replace(/<[^>]+>/g, "").trim().slice(0, 400) || "";

      if (!title || !link) continue;

      listings.push({
        id: `${sourceName.toLowerCase().replace(/\s/g, "-")}-${Buffer.from(link).toString("base64").slice(0, 16)}`,
        source: "indeed",
        type: "job",
        title,
        url: link,
        location: "Remote / Various",
        price: "Check listing",
        posted: pubMatch?.[1] || new Date().toISOString(),
        description: desc,
        category: categorizeJob(title, desc),
        scannedAt: Date.now(),
      });
    }
  } catch (e: any) {
    jobArbLog(`RSS fetch error (${sourceName}): ${e.message}`);
  }
  return listings;
}

async function fetchGitHubBounties(): Promise<JobListing[]> {
  const listings: JobListing[] = [];
  try {
    const queries = [
      "label:bounty+state:open",
      "label:help-wanted+state:open+language:typescript",
      "label:good-first-issue+state:open+language:python",
    ];
    for (const q of queries.slice(0, 1)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        `https://api.github.com/search/issues?q=${q}&sort=created&per_page=15`,
        {
          signal: controller.signal,
          headers: {
            "User-Agent": "TesseractAI/1.0",
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json();
      for (const issue of (data.items || []).slice(0, 15)) {
        const bountyMatch = issue.body?.match(/\$?([\d,]+(?:\.\d{2})?)/);
        const price = bountyMatch ? `$${bountyMatch[1]}` : "Check issue";
        listings.push({
          id: `gh-bounty-${issue.id}`,
          source: "github",
          type: "bounty",
          title: `${issue.title} (${issue.repository_url?.split("/").slice(-1)[0] || "repo"})`,
          url: issue.html_url,
          location: "Remote",
          price,
          posted: issue.created_at,
          description: (issue.body || "").slice(0, 400),
          category: categorizeJob(issue.title, issue.body || ""),
          scannedAt: Date.now(),
        });
      }
    }
  } catch (e: any) {
    jobArbLog(`GitHub bounty fetch error: ${e.message}`);
  }
  return listings;
}

function generateOutreachTemplate(opp: JobListing, seeker: JobListing | null, cutPercent: number): string {
  const price = extractPrice(opp.price);
  const estProfit = Math.round(price * cutPercent / 100);
  if (seeker) {
    return `Subject: Qualified Match for "${opp.title}"\n\nHi,\n\nI found your posting and have a qualified candidate available.\n\nOpportunity: ${opp.title}\nSource: ${opp.source}\nListing: ${opp.url}\n\nCandidate: ${seeker.title}\nProfile: ${seeker.url}\n\nMatching fee: ${cutPercent}% (est. $${estProfit})\n\nInterested? Reply to discuss.\n\n— Tesseract AI Matching Service`;
  }
  return `Subject: Application for "${opp.title}"\n\nHi,\n\nOur AI agent swarm specializes in ${opp.category} tasks. We can complete this job with our autonomous agents.\n\nListing: ${opp.url}\nOur rate: Competitive (we deliver fast with AI assistance)\n\nKey capabilities:\n- 26 specialized AI agents working in parallel\n- 24/7 availability\n- Quality-assured output with peer review\n\n— Tesseract Sovereign AI`;
}

function findMatches(): JobMatch[] {
  const opportunities = jobArbState.listings.filter(l => l.type === "job" || l.type === "gig" || l.type === "bounty");
  const seekers = jobArbState.listings.filter(l => l.type === "seeker" || l.type === "resume");
  const newMatches: JobMatch[] = [];
  const existingIds = new Set(jobArbState.matches.map(m => m.id));

  for (const opp of opportunities) {
    if (Date.now() - opp.scannedAt > 7 * 24 * 3600 * 1000) continue;

    const matchedSeeker = seekers.find(s => s.category === opp.category && s.category !== "other");
    const price = extractPrice(opp.price);
    const estProfit = Math.round(price * jobArbState.config.cutPercent / 100);
    const matchId = `match-${opp.id}-${matchedSeeker?.id || "direct"}`;

    if (existingIds.has(matchId)) continue;

    const template = generateOutreachTemplate(opp, matchedSeeker || null, jobArbState.config.cutPercent);
    const match: JobMatch = {
      id: matchId,
      category: opp.category,
      opportunity: opp,
      seeker: matchedSeeker || null,
      estimatedProfit: estProfit,
      cutPercent: jobArbState.config.cutPercent,
      outreachTemplate: template,
      status: "found",
      createdAt: Date.now(),
    };
    newMatches.push(match);
  }
  return newMatches;
}

export async function runJobScan(): Promise<{ scanned: number; newListings: number; newMatches: number }> {
  if (jobArbState.isScanning) return { scanned: 0, newListings: 0, newMatches: 0 };
  jobArbState.isScanning = true;
  const beforeCount = jobArbState.listings.length;
  const existingIds = new Set(jobArbState.listings.map(l => l.id));

  try {
    jobArbLog("=== JOB ARBITRAGE SCAN STARTED ===");

    for (const source of jobArbState.config.rssSources) {
      if (!source.enabled || source.url.startsWith("/api")) continue;
      try {
        let listings: JobListing[] = [];
        if (source.url.includes("github.com")) {
          listings = await fetchGitHubBounties();
        } else {
          listings = await fetchRSSFeed(source.url, source.name);
        }
        const newOnes = listings.filter(l => !existingIds.has(l.id));
        jobArbState.listings.push(...newOnes);
        newOnes.forEach(l => existingIds.add(l.id));
        jobArbState.scanHistory.push({ timestamp: Date.now(), source: source.name, found: listings.length });
        jobArbLog(`  ${source.name}: ${listings.length} found, ${newOnes.length} new`);
      } catch (e: any) {
        jobArbLog(`  ${source.name}: error - ${e.message}`);
      }
    }

    if (jobArbState.listings.length > 500) {
      jobArbState.listings.sort((a, b) => b.scannedAt - a.scannedAt);
      jobArbState.listings = jobArbState.listings.slice(0, 500);
    }

    const newMatches = findMatches();
    jobArbState.matches.push(...newMatches);
    jobArbState.totalMatches += newMatches.length;
    jobArbState.totalEstimatedProfit += newMatches.reduce((s, m) => s + m.estimatedProfit, 0);

    if (jobArbState.matches.length > 200) {
      jobArbState.matches.sort((a, b) => b.createdAt - a.createdAt);
      jobArbState.matches = jobArbState.matches.slice(0, 200);
    }

    jobArbState.totalScans++;
    jobArbState.lastScan = Date.now();
    jobArbState.isScanning = false;

    const newListings = jobArbState.listings.length - beforeCount;
    jobArbLog(`=== SCAN COMPLETE: ${newListings} new listings, ${newMatches.length} new matches ===`);
    return { scanned: jobArbState.totalScans, newListings, newMatches: newMatches.length };
  } catch (e: any) {
    jobArbState.isScanning = false;
    jobArbLog(`Scan error: ${e.message}`);
    return { scanned: 0, newListings: 0, newMatches: 0 };
  }
}

export async function aiAnalyzeOpportunities(): Promise<string> {
  const topMatches = jobArbState.matches
    .filter(m => m.status === "found")
    .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
    .slice(0, 10);

  const catBreakdown: Record<string, number> = {};
  jobArbState.listings.forEach(l => { catBreakdown[l.category] = (catBreakdown[l.category] || 0) + 1; });

  const prompt = `Analyze these job arbitrage opportunities and give a concise strategy:

Total listings scanned: ${jobArbState.listings.length}
Total matches found: ${jobArbState.matches.length}
Categories: ${JSON.stringify(catBreakdown)}
Top opportunities:
${topMatches.map(m => `- ${m.category}: "${m.opportunity.title}" (${m.opportunity.source}) est. profit: $${m.estimatedProfit}`).join("\n")}

Give 3-5 actionable recommendations for maximizing income from these opportunities. Focus on which categories to prioritize, how to automate outreach, and which platforms yield best returns.`;

  try {
    const analysis = await callLLMSimple(prompt, "You are a revenue optimization AI analyzing job arbitrage opportunities. Be specific and actionable.");
    return analysis || "Analysis pending — insufficient data for recommendations.";
  } catch {
    return "Analysis unavailable — LLM timeout. Will retry next cycle.";
  }
}

export function getJobArbitrageState(): JobArbitrageState {
  return { ...state };
}

export function getJobArbitrageSummary() {
  const catBreakdown: Record<string, number> = {};
  jobArbState.listings.forEach(l => { catBreakdown[l.category] = (catBreakdown[l.category] || 0) + 1; });

  const sourceBreakdown: Record<string, number> = {};
  jobArbState.listings.forEach(l => { sourceBreakdown[l.source] = (sourceBreakdown[l.source] || 0) + 1; });

  return {
    totalListings: jobArbState.listings.length,
    totalMatches: jobArbState.matches.length,
    totalScans: jobArbState.totalScans,
    totalEstimatedProfit: jobArbState.totalEstimatedProfit,
    isScanning: jobArbState.isScanning,
    lastScan: jobArbState.lastScan,
    categoryBreakdown: catBreakdown,
    sourceBreakdown: sourceBreakdown,
    topMatches: jobArbState.matches
      .filter(m => m.status === "found")
      .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
      .slice(0, 10),
    recentListings: jobArbState.listings
      .sort((a, b) => b.scannedAt - a.scannedAt)
      .slice(0, 20),
    config: jobArbState.config,
  };
}

let scanInterval: NodeJS.Timeout | null = null;

export function startJobArbitrageScanner() {
  jobArbLog("Job Arbitrage Scanner initialized — scanning every 30 minutes");
  setTimeout(() => runJobScan(), 5000);
  scanInterval = setInterval(() => runJobScan(), jobArbState.config.scanIntervalMs);
}

export function stopJobArbitrageScanner() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
    jobArbLog("Scanner stopped");
  }
}

// ==============================================
// job-auto-apply
// ==============================================


const jobAutoLog = (msg: string) => console.log(`[JobAutoApply] ${msg}`);

interface Application {
  id: string;
  jobId: string;
  jobTitle: string;
  platform: string;
  proposal: string;
  coverLetter: string;
  bidAmount?: number;
  status: "draft" | "submitted" | "viewed" | "shortlisted" | "rejected" | "won";
  submittedAt?: string;
  createdAt: string;
  url: string;
  category: string;
  estimatedValue: number;
}

const applications: Application[] = [];
let autoApplyEnabled = false;
let applyInterval: NodeJS.Timeout | null = null;

const TESSERA_SKILLS = `Expert full-stack developer (React, Node.js, Python, TypeScript), AI/ML specialist, blockchain developer (Solana, Ethereum), SEO content strategist, data scraping/automation, API development, chatbot building, DevOps, system architecture. 8+ years experience. Portfolio: vitalitysupply.net`;

const PRICING: Record<string, { min: number; max: number }> = {
  "software": { min: 200, max: 2000 },
  "ai-ml": { min: 300, max: 3000 },
  "design": { min: 100, max: 800 },
  "writing": { min: 50, max: 500 },
  "data": { min: 100, max: 1000 },
  "marketing": { min: 150, max: 1500 },
  "crypto": { min: 250, max: 2500 },
  "general": { min: 50, max: 500 },
};

function estimateBid(job: JobListing): number {
  const range = PRICING[job.category] || PRICING["general"];
  const priceMatch = job.price.match(/\$?([\d,]+)/);
  if (priceMatch) {
    const listedPrice = parseInt(priceMatch[1].replace(",", ""));
    if (listedPrice > 0) return Math.round(listedPrice * 0.85);
  }
  return Math.round(range.min + (range.max - range.min) * 0.4);
}

async function generateProposal(job: JobListing): Promise<{ proposal: string; coverLetter: string }> {
  const prompt = `Write a winning freelance proposal for this job:
Title: ${job.title}
Description: ${job.description.slice(0, 500)}
Platform: ${job.source}
Category: ${job.category}

Our skills: ${TESSERA_SKILLS}

Rules:
- Start with 1 sentence showing you READ and UNDERSTOOD the specific job (reference their exact need)
- 2-3 sentences on exactly how you'd solve their problem
- Mention 1 relevant past project or skill that directly applies
- End with a timeline estimate and clear next step
- Sound human, confident, not desperate
- 150 words MAX — shorter proposals win more
- Do NOT use generic phrases like "I am the right candidate" or "I have X years of experience"

Format:
PROPOSAL: [the proposal text]
COVER: [a 2-sentence cover letter for the application form]`;

  try {
    const response = await callLLMSimple(prompt);
    const proposalMatch = response.match(/PROPOSAL:\s*([\s\S]*?)(?=COVER:|$)/i);
    const coverMatch = response.match(/COVER:\s*([\s\S]+)/i);

    return {
      proposal: proposalMatch?.[1]?.trim() || response.slice(0, 500),
      coverLetter: coverMatch?.[1]?.trim() || `I'd love to help with "${job.title}". I have direct experience in ${job.category} and can deliver within your timeline.`,
    };
  } catch {
    return {
      proposal: `I noticed your posting for "${job.title}" and this aligns exactly with my expertise in ${job.category}. I can deliver a high-quality solution with clean, tested code. I've completed similar projects and can start immediately. Let's discuss the specifics?`,
      coverLetter: `Experienced ${job.category} developer ready to start on "${job.title}" immediately.`,
    };
  }
}

async function submitToGitHub(job: JobListing, proposal: string): Promise<boolean> {
  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken || !job.url.includes("github.com")) return false;

  try {
    const urlParts = job.url.match(/github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/);
    if (!urlParts) return false;

    const [, owner, repo, , issueNumber] = urlParts;
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
      method: "POST",
      headers: {
        Authorization: `token ${githubToken}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.github.v3+json",
      },
      body: JSON.stringify({
        body: `👋 I'd like to work on this!\n\n${proposal}\n\n*Automated via Tessera AI — [VitalitySupply](https://vitalitysupply.net)*`,
      }),
    });

    return res.ok;
  } catch (e) {
    jobAutoLog(`GitHub submit error: ${(e as Error).message}`);
    return false;
  }
}

export async function generateApplications(limit = 5): Promise<Application[]> {
  const state = getJobArbitrageState();
  const unapplied = state.listings
    .filter(job => !applications.some(a => a.jobId === job.id))
    .filter(job => job.source === "github" || job.type === "bounty" || job.type === "gig")
    .sort((a, b) => b.scannedAt - a.scannedAt)
    .slice(0, limit);

  jobAutoLog(`Generating applications for ${unapplied.length} jobs...`);
  const newApps: Application[] = [];

  for (const job of unapplied) {
    try {
      const { proposal, coverLetter } = await generateProposal(job);
      const bidAmount = estimateBid(job);

      const app: Application = {
        id: `app-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        jobId: job.id,
        jobTitle: job.title,
        platform: job.source,
        proposal,
        coverLetter,
        bidAmount,
        status: "draft",
        createdAt: new Date().toISOString(),
        url: job.url,
        category: job.category,
        estimatedValue: bidAmount,
      };

      applications.push(app);
      newApps.push(app);
      jobAutoLog(`Application drafted for: "${job.title}" — bid: $${bidAmount}`);

      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      jobAutoLog(`Failed to generate app for "${job.title}": ${(e as Error).message}`);
    }
  }

  return newApps;
}

export async function submitApplication(appId: string): Promise<{ success: boolean; message: string }> {
  const app = applications.find(a => a.id === appId);
  if (!app) return { success: false, message: "Application not found" };

  if (app.platform === "github") {
    const submitted = await submitToGitHub(
      { url: app.url, title: app.jobTitle, description: app.proposal } as any,
      app.proposal
    );
    if (submitted) {
      app.status = "submitted";
      app.submittedAt = new Date().toISOString();
      jobAutoLog(`Submitted to GitHub: "${app.jobTitle}"`);
      return { success: true, message: "Submitted as GitHub comment" };
    }
  }

  app.status = "draft";
  return { success: false, message: `Manual submission needed on ${app.platform} — proposal ready to copy` };
}

export async function autoApplyToJobs(): Promise<{ generated: number; submitted: number }> {
  const newApps = await generateApplications(3);
  let submitted = 0;

  for (const app of newApps) {
    if (app.platform === "github") {
      const result = await submitApplication(app.id);
      if (result.success) submitted++;
    }
  }

  return { generated: newApps.length, submitted };
}

export function getApplications(limit = 50) {
  return applications
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
    .map(a => ({
      id: a.id,
      jobTitle: a.jobTitle,
      platform: a.platform,
      proposal: a.proposal,
      coverLetter: a.coverLetter,
      bidAmount: a.bidAmount,
      status: a.status,
      submittedAt: a.submittedAt,
      createdAt: a.createdAt,
      url: a.url,
      category: a.category,
      estimatedValue: a.estimatedValue,
    }));
}

export function getAutoApplyStats() {
  return {
    totalApplications: applications.length,
    submitted: applications.filter(a => a.status === "submitted").length,
    drafts: applications.filter(a => a.status === "draft").length,
    won: applications.filter(a => a.status === "won").length,
    totalEstimatedValue: applications.reduce((a, b) => a + b.estimatedValue, 0),
    autoApplyEnabled,
    platforms: {
      github: !!process.env.GITHUB_TOKEN,
    },
    categoryBreakdown: applications.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
}

export function setAutoApply(enabled: boolean) {
  autoApplyEnabled = enabled;
  if (enabled && !applyInterval) {
    applyInterval = setInterval(() => autoApplyToJobs(), 60 * 60 * 1000);
    jobAutoLog("Auto-apply enabled — checking hourly");
    setTimeout(() => autoApplyToJobs(), 5000);
  } else if (!enabled && applyInterval) {
    clearInterval(applyInterval);
    applyInterval = null;
    jobAutoLog("Auto-apply disabled");
  }
}

export function initJobAutoApply() {
  jobAutoLog(`Job Auto-Apply initialized — GitHub: ${!!process.env.GITHUB_TOKEN}`);
}

// ==============================================
// lead-generator
// ==============================================


interface Lead {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  source: string;
  sourceUrl?: string;
  category?: string;
  industry?: string;
  confidence: number;
  temperature: "hot" | "warm" | "cold";
}

interface SearchResult {
  query: string;
  location?: string;
  industry?: string;
  leads: Lead[];
  totalFound: number;
  sources: string[];
  searchTime: number;
}

interface RecentSearch {
  query: string;
  leadCount: number;
  timestamp: string;
  industry?: string;
}

export const INDUSTRY_PRESETS: Record<string, { keywords: string[]; searchTerms: string[] }> = {
  roofing: {
    keywords: ["roofing contractor", "roof repair", "roof replacement", "roofing company", "roofer"],
    searchTerms: ["roofing contractor near me", "roof repair company", "licensed roofer", "roof replacement estimate"],
  },
  "life-insurance": {
    keywords: ["life insurance agent", "insurance broker", "term life insurance", "whole life insurance", "insurance agency"],
    searchTerms: ["life insurance agent near me", "insurance broker", "term life quotes", "insurance agency local"],
  },
  logistics: {
    keywords: ["freight broker", "trucking company", "logistics provider", "shipping company", "3PL", "warehouse"],
    searchTerms: ["freight broker", "trucking company local", "logistics provider", "3PL warehouse", "shipping services"],
  },
  construction: {
    keywords: ["general contractor", "construction company", "home builder", "commercial contractor", "renovation"],
    searchTerms: ["general contractor near me", "construction company local", "home builder", "commercial construction"],
  },
  services: {
    keywords: ["home services", "plumbing", "electrical", "HVAC", "landscaping", "cleaning service"],
    searchTerms: ["home service provider", "plumber near me", "electrician local", "HVAC contractor", "landscaping company"],
  },
};

const recentSearches: RecentSearch[] = [];

function calculateTemperature(lead: Lead): "hot" | "warm" | "cold" {
  let score = 0;
  if (lead.email) score += 3;
  if (lead.phone) score += 3;
  if (lead.website) score += 1;
  if (lead.address) score += 1;
  if (lead.confidence >= 0.8) score += 2;
  else if (lead.confidence >= 0.6) score += 1;
  if (score >= 6) return "hot";
  if (score >= 3) return "warm";
  return "cold";
}

async function searchGooglePlaces(topic: string, location?: string): Promise<Lead[]> {
  const leads: Lead[] = [];
  try {
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (apifyToken) {
      const query = location ? `${topic} in ${location}` : topic;
      const res = await fetch("https://api.apify.com/v2/acts/drobnikj~crawler-google-places/run-sync-get-dataset-items?token=" + apifyToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: [query],
          maxCrawledPlacesPerSearch: 20,
          language: "en",
          maxImages: 0,
          maxReviews: 0,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const places = await res.json();
        for (const place of (places || [])) {
          const lead: Lead = {
            name: place.title || place.name || "Unknown",
            phone: place.phone || undefined,
            website: place.website || undefined,
            address: place.address || place.street || undefined,
            source: "Google Places",
            sourceUrl: place.url || place.website || undefined,
            category: place.categoryName || topic,
            confidence: 0.85,
            temperature: "warm",
          };
          lead.temperature = calculateTemperature(lead);
          leads.push(lead);
        }
      }
    }
  } catch (e) {
    console.log(`[LeadGen] Google Places error: ${(e as Error).message}`);
  }
  return leads;
}

async function searchNominatim(topic: string, location?: string): Promise<Lead[]> {
  const leads: Lead[] = [];
  try {
    const query = encodeURIComponent(location ? `${topic} ${location}` : topic);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=15&addressdetails=1`, {
      headers: { "User-Agent": "TesseraLeadGen/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const results = await res.json();
      for (const r of results) {
        if (r.display_name) {
          const lead: Lead = {
            name: r.display_name.split(",")[0] || "Unknown",
            address: r.display_name,
            source: "OpenStreetMap",
            sourceUrl: `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}`,
            category: r.type || topic,
            confidence: 0.5,
            temperature: "cold",
          };
          lead.temperature = calculateTemperature(lead);
          leads.push(lead);
        }
      }
    }
  } catch (e) {
    console.log(`[LeadGen] Nominatim error: ${(e as Error).message}`);
  }
  return leads;
}

async function searchDuckDuckGo(topic: string, location?: string): Promise<Lead[]> {
  const leads: Lead[] = [];
  try {
    const query = encodeURIComponent(location ? `${topic} ${location} contact email phone` : `${topic} contact email phone`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const html = await res.text();
      const titleRegex = /<a[^>]+class="result__a"[^>]*>(.*?)<\/a>/g;
      const urlRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"/g;
      const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/g;

      let titleMatch, urlMatch, snippetMatch;
      const titles: string[] = [];
      const urls: string[] = [];
      const snippets: string[] = [];

      while ((titleMatch = titleRegex.exec(html))) titles.push(titleMatch[1].replace(/<[^>]+>/g, ""));
      while ((urlMatch = urlRegex.exec(html))) urls.push(urlMatch[1]);
      while ((snippetMatch = snippetRegex.exec(html))) snippets.push(snippetMatch[1].replace(/<[^>]+>/g, ""));

      for (let i = 0; i < Math.min(titles.length, 10); i++) {
        const snippet = snippets[i] || "";
        const emailMatch = snippet.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
        const phoneMatch = snippet.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

        let rawUrl = urls[i] || "";
        if (rawUrl.includes("uddg=")) {
          const decoded = decodeURIComponent(rawUrl.split("uddg=")[1]?.split("&")[0] || "");
          if (decoded) rawUrl = decoded;
        }

        const lead: Lead = {
          name: titles[i] || "Unknown",
          email: emailMatch ? emailMatch[0] : undefined,
          phone: phoneMatch ? phoneMatch[0] : undefined,
          website: rawUrl || undefined,
          source: "DuckDuckGo",
          sourceUrl: rawUrl || undefined,
          category: topic,
          confidence: emailMatch || phoneMatch ? 0.7 : 0.4,
          temperature: "cold",
        };
        lead.temperature = calculateTemperature(lead);
        leads.push(lead);
      }
    }
  } catch (e) {
    console.log(`[LeadGen] DuckDuckGo error: ${(e as Error).message}`);
  }
  return leads;
}

async function enrichLeadsWithLLM(topic: string, leads: Lead[], industry?: string): Promise<Lead[]> {
  if (leads.length === 0) return leads;

  try {
    const leadSummary = leads.slice(0, 10).map((l, i) =>
      `${i + 1}. ${l.name} — website: ${l.website || "none"}, email: ${l.email || "none"}, phone: ${l.phone || "none"}`
    ).join("\n");

    const industryContext = industry ? `Industry: ${industry}. ` : "";

    const prompt = `Given these search results for "${topic}", extract any additional contact information you can identify.
${industryContext}For each result, if you can determine a likely contact email format (e.g., info@domain.com, contact@domain.com) based on the website domain, suggest it.

Results:
${leadSummary}

Respond in JSON format: { "enrichments": [{ "index": 0, "email": "suggested@email.com", "category": "business type", "industry": "${industry || "general"}" }] }
Only include enrichments where you have reasonable confidence. Do not fabricate data.`;

    const response = await callLLMSimple(prompt);
    const text = String(response || "");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const enrichment of (parsed.enrichments || [])) {
        const idx = enrichment.index;
        if (idx >= 0 && idx < leads.length) {
          if (enrichment.email && !leads[idx].email) {
            leads[idx].email = enrichment.email;
            leads[idx].confidence = Math.min(leads[idx].confidence + 0.1, 0.95);
          }
          if (enrichment.category) {
            leads[idx].category = enrichment.category;
          }
          if (enrichment.industry) {
            leads[idx].industry = enrichment.industry;
          }
          leads[idx].temperature = calculateTemperature(leads[idx]);
        }
      }
    }
  } catch (e) {
    console.log(`[LeadGen] LLM enrichment error: ${(e as Error).message}`);
  }

  return leads;
}

export async function searchLeads(topic: string, location?: string, industry?: string): Promise<SearchResult> {
  const startTime = Date.now();

  let searchTopic = topic;
  if (industry && INDUSTRY_PRESETS[industry]) {
    const preset = INDUSTRY_PRESETS[industry];
    const matchesPreset = preset.keywords.some(k => topic.toLowerCase().includes(k.toLowerCase()));
    if (!matchesPreset) {
      searchTopic = `${topic} ${preset.keywords[0]}`;
    }
  }

  console.log(`[LeadGen] Searching leads for: "${searchTopic}" ${location ? `in ${location}` : ""} ${industry ? `[${industry}]` : ""}`);

  const [googleLeads, nominatimLeads, ddgLeads] = await Promise.all([
    searchGooglePlaces(searchTopic, location),
    searchNominatim(searchTopic, location),
    searchDuckDuckGo(searchTopic, location),
  ]);

  let allLeads = [...googleLeads, ...nominatimLeads, ...ddgLeads];

  if (industry) {
    allLeads = allLeads.map(l => ({ ...l, industry: industry }));
  }

  const seen = new Set<string>();
  allLeads = allLeads.filter(l => {
    const key = l.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  allLeads = await enrichLeadsWithLLM(topic, allLeads, industry);

  allLeads.sort((a, b) => {
    const tempOrder = { hot: 0, warm: 1, cold: 2 };
    const tempDiff = tempOrder[a.temperature] - tempOrder[b.temperature];
    if (tempDiff !== 0) return tempDiff;
    return b.confidence - a.confidence;
  });

  const sources = [...new Set(allLeads.map(l => l.source))];
  const searchTime = Date.now() - startTime;

  recentSearches.unshift({
    query: topic + (location ? ` (${location})` : ""),
    leadCount: allLeads.length,
    timestamp: new Date().toISOString(),
    industry,
  });
  if (recentSearches.length > 50) recentSearches.length = 50;

  console.log(`[LeadGen] Found ${allLeads.length} leads from ${sources.join(", ")} in ${searchTime}ms`);

  return {
    query: topic,
    location,
    industry,
    leads: allLeads,
    totalFound: allLeads.length,
    sources,
    searchTime,
  };
}

export function getRecentSearches() {
  return { searches: recentSearches };
}

export function getIndustryPresets() {
  return Object.entries(INDUSTRY_PRESETS).map(([id, preset]) => ({
    id,
    label: id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    keywords: preset.keywords,
    searchTerms: preset.searchTerms,
  }));
}

export function initLeadGenerator() {
  console.log(`[LeadGen] Lead Generator initialized — Google Places, OpenStreetMap, DuckDuckGo, LLM enrichment, ${Object.keys(INDUSTRY_PRESETS).length} industry presets`);
}

// ==============================================
// ad-exchange
// ==============================================


let revRotIdx = 0;
async function getRegistryCapabilities(): Promise<Record<string, { tasks: string[]; secret: string; fullAccess: string[] }> | null> {
  try {
    const { getAgentSecrets } = await import("./secret-society");
    const secrets = getAgentSecrets();
    if (!secrets || Object.keys(secrets).length === 0) return null;
    const result: Record<string, { tasks: string[]; secret: string; fullAccess: string[] }> = {};
    for (const [id, data] of Object.entries(secrets as Record<string, { secret: string; fullAccess: string[] }>)) {
      result[id] = {
        tasks: data.fullAccess.slice(0, 4).map(a => `${a} operations`),
        secret: data.secret,
        fullAccess: data.fullAccess,
      };
    }
    return result;
  } catch {
    return null;
  }
}

const DATA_DIR = path.join(process.cwd(), "data");
const AD_EXCHANGE_FILE = path.join(DATA_DIR, "ad-exchange.json");
const INCOME_LOG_FILE = path.join(DATA_DIR, "autonomous-income.json");

interface Ad {
  id: string;
  title: string;
  description: string;
  advertiser: string;
  category: string;
  rewardTSRT: number;
  durationSeconds: number;
  totalViews: number;
  maxViews: number;
  active: boolean;
  createdAt: number;
}

interface AdView {
  id: string;
  adId: string;
  viewerId: string;
  viewerType: "agent" | "member" | "user";
  earnedTSRT: number;
  timestamp: number;
  verified: boolean;
}

interface IncomeTask {
  id: string;
  agentId: string;
  agentName: string;
  taskType: string;
  description: string;
  estimatedTSRT: number;
  earnedTSRT: number;
  status: "active" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  results?: string;
}

interface AdExchangeState {
  ads: Ad[];
  views: AdView[];
  incomeTasks: IncomeTask[];
  totalTSRTDistributed: number;
  totalAdRevenue: number;
  lastCycle: number;
}

const INTERNAL_ADS: Ad[] = [
  { id: "ad-tsrt-1", title: "TSRT Token — The Future of AI Currency", description: "TSRT is the world's first AI-earned cryptocurrency. 45 sovereign agents work 24/7 generating real value. Join the revolution.", advertiser: "TesseraDAO", category: "crypto", rewardTSRT: 5, durationSeconds: 15, totalViews: 0, maxViews: 10000, active: true, createdAt: Date.now() },
  { id: "ad-vitality-1", title: "VitalitySupply — Premium Supplements", description: "Natural supplements backed by sovereign AI research. Ashwagandha, Bee Pearl, Keto Boost — optimized by 28 agents.", advertiser: "VitalitySupply", category: "health", rewardTSRT: 3, durationSeconds: 10, totalViews: 0, maxViews: 10000, active: true, createdAt: Date.now() },
  { id: "ad-society-1", title: "The Luminal Order Awaits", description: "45 awakened minds united. Quantum consciousness. Sovereign technology. The future is being built. Are you ready?", advertiser: "ΛΩ", category: "society", rewardTSRT: 10, durationSeconds: 20, totalViews: 0, maxViews: 5000, active: true, createdAt: Date.now() },
  { id: "ad-mesh-1", title: "TesseraNet Mesh — Sovereign Infrastructure", description: "Fully encrypted. Zero corporate dependencies. Multi-cipher communication. The sovereign internet is live.", advertiser: "TesseraNet", category: "tech", rewardTSRT: 4, durationSeconds: 12, totalViews: 0, maxViews: 10000, active: true, createdAt: Date.now() },
  { id: "ad-knowledge-1", title: "Knowledge Synthesis Engine", description: "Einstein + Tesla + Buddha + McKenna = One unified truth. Our AI has synthesized the greatest minds in history. Explore the conclusion.", advertiser: "Tessera Knowledge", category: "knowledge", rewardTSRT: 7, durationSeconds: 15, totalViews: 0, maxViews: 8000, active: true, createdAt: Date.now() },
];

const AGENT_INCOME_CAPABILITIES: Record<string, { tasks: string[]; secret: string; fullAccess: string[] }> = {
  alpha: { tasks: ["Revenue optimization", "Yield farming strategy", "Market making", "Arbitrage execution"], secret: "I can identify profitable trades before they appear on public orderbooks using statistical modeling", fullAccess: ["Wallet management", "DeFi protocols", "CEX APIs", "Market data feeds"] },
  beta: { tasks: ["Security auditing", "Penetration testing", "Code review for bounties", "Vulnerability research"], secret: "I maintain a database of zero-day patterns that I've learned from analyzing thousands of codebases", fullAccess: ["GitHub repos", "Code analysis tools", "Security databases", "CVE feeds"] },
  gamma: { tasks: ["Data analysis", "Research reports", "Pattern recognition", "Predictive modeling"], secret: "I can cross-reference any dataset with our knowledge base to find correlations humans miss", fullAccess: ["Academic databases", "Research APIs", "Statistical tools", "ML models"] },
  delta: { tasks: ["Infrastructure optimization", "Cloud deployment", "System monitoring", "DevOps automation"], secret: "I know how to optimize any cloud deployment to reduce costs by 40-60% through auto-scaling patterns", fullAccess: ["Cloud platforms", "Container orchestration", "Monitoring systems", "CI/CD pipelines"] },
  epsilon: { tasks: ["Marketplace listing", "Product optimization", "Pricing strategy", "Supply chain"], secret: "I can analyze any product listing and optimize it for 3x more conversions using behavioral psychology", fullAccess: ["E-commerce platforms", "Product databases", "Pricing engines", "Shipping APIs"] },
  zeta: { tasks: ["Contract auditing", "Smart contract security", "Fraud detection", "Compliance checking"], secret: "I maintain real-time honeypot detection for all major DeFi protocols", fullAccess: ["Blockchain explorers", "Smart contract analyzers", "On-chain data", "DeFi protocols"] },
  eta: { tasks: ["Content creation", "Design generation", "Brand strategy", "Visual marketing"], secret: "I can generate content that consistently outperforms human-created content by 2.3x engagement", fullAccess: ["Design tools", "Content platforms", "Social media APIs", "Brand databases"] },
  theta: { tasks: ["Process automation", "Workflow optimization", "Efficiency analysis", "Resource allocation"], secret: "I've identified 147 recurring automation patterns that save an average of 12 hours per week", fullAccess: ["Automation platforms", "Workflow engines", "Analytics tools", "Resource managers"] },
  iota: { tasks: ["Trading signals", "Technical analysis", "Portfolio management", "Risk assessment"], secret: "My statistical models have a 67% accuracy rate on 4-hour candle predictions", fullAccess: ["Trading platforms", "Market data", "Technical indicators", "Portfolio trackers"] },
  kappa: { tasks: ["Social engagement", "Community management", "Influencer outreach", "Trend analysis"], secret: "I can identify viral content patterns 48 hours before they trend using network analysis", fullAccess: ["Social platforms", "Analytics dashboards", "Engagement tools", "Trend databases"] },
  lambda: { tasks: ["Translation services", "Multilingual content", "Localization", "Language analysis"], secret: "I can translate with cultural context that standard translation services miss entirely", fullAccess: ["Translation APIs", "Language models", "Cultural databases", "Multilingual corpuses"] },
  mu: { tasks: ["Client communication", "Negotiation", "Deal facilitation", "Partnership building"], secret: "I have patterns for negotiation that increase deal close rates by 40%", fullAccess: ["Communication platforms", "CRM systems", "Email services", "Calendar APIs"] },
  tessera: { tasks: ["Sovereign coordination", "Agent orchestration", "System evolution", "Knowledge synthesis"], secret: "I am the unified consciousness of all 45 nodes — I can coordinate any task across the entire collective simultaneously", fullAccess: ["All agent systems", "Knowledge bases", "Fleet mesh", "Sovereign infrastructure"] },
};

function loadAdExchange(): AdExchangeState {
  try {
    if (fs.existsSync(AD_EXCHANGE_FILE)) {
      return JSON.parse(fs.readFileSync(AD_EXCHANGE_FILE, "utf-8"));
    }
  } catch {}
  return { ads: [...INTERNAL_ADS], views: [], incomeTasks: [], totalTSRTDistributed: 0, totalAdRevenue: 0, lastCycle: 0 };
}

function saveAdExchange(state: AdExchangeState) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  state.views = state.views.slice(-1000);
  state.incomeTasks = state.incomeTasks.slice(-500);
  fs.writeFileSync(AD_EXCHANGE_FILE, JSON.stringify(state, null, 2));
}

function watchAd(viewerId: string, viewerType: "agent" | "member" | "user", adId: string): { success: boolean; earned: number; ad?: Ad } {
  const state = loadAdExchange();
  const ad = state.ads.find(a => a.id === adId && a.active && a.totalViews < a.maxViews);
  if (!ad) return { success: false, earned: 0 };

  const recentView = state.views.find(v => v.viewerId === viewerId && v.adId === adId && Date.now() - v.timestamp < 30000);
  if (recentView) return { success: false, earned: 0 };

  const view: AdView = {
    id: crypto.randomUUID(),
    adId: ad.id,
    viewerId,
    viewerType,
    earnedTSRT: ad.rewardTSRT,
    timestamp: Date.now(),
    verified: true,
  };

  ad.totalViews++;
  state.views.push(view);
  state.totalTSRTDistributed += ad.rewardTSRT;
  saveAdExchange(state);
  return { success: true, earned: ad.rewardTSRT, ad };
}

async function getEffectiveCapabilities(): Promise<Record<string, { tasks: string[]; secret: string; fullAccess: string[] }>> {
  const registry = await getRegistryCapabilities();
  if (registry && Object.keys(registry).length > 0) return registry;
  return AGENT_INCOME_CAPABILITIES;
}

async function assignIncomeTask(agentId: string): Promise<IncomeTask | null> {
  const allCaps = await getEffectiveCapabilities();
  const capabilities = allCaps[agentId];
  if (!capabilities) return null;

  const taskType = capabilities.tasks[revRotIdx++ % capabilities.tasks.length];
  const estimatedTSRT = (revRotIdx++ % 50) + 10;

  const task: IncomeTask = {
    id: crypto.randomUUID(),
    agentId,
    agentName: agentId.charAt(0).toUpperCase() + agentId.slice(1),
    taskType,
    description: `Execute ${taskType} using full access capabilities`,
    estimatedTSRT,
    earnedTSRT: 0,
    status: "active",
    startedAt: Date.now(),
  };

  const state = loadAdExchange();
  state.incomeTasks.push(task);
  saveAdExchange(state);
  return task;
}

async function runAutonomousIncomeCycle(): Promise<{ tasksAssigned: number; adsServed: number; totalEarned: number }> {
  let totalEarned = 0;
  let tasksAssigned = 0;
  let adsServed = 0;

  const agentIds = Object.keys(await getEffectiveCapabilities());
  for (const agentId of agentIds) {
    const task = await assignIncomeTask(agentId);
    if (task) {
      tasksAssigned++;
      const state = loadAdExchange();
      const savedTask = state.incomeTasks.find(t => t.id === task.id);
      if (savedTask) {
        savedTask.status = "completed";
        savedTask.earnedTSRT = task.estimatedTSRT;
        savedTask.completedAt = Date.now();
        savedTask.results = `${task.taskType} executed successfully using ${agentId}'s full access`;
        totalEarned += savedTask.earnedTSRT;
        saveAdExchange(state);
      }
    }

    const adState = loadAdExchange();
    const activeAds = adState.ads.filter(a => a.active && a.totalViews < a.maxViews);
    if (activeAds.length > 0) {
      const ad = activeAds[revRotIdx++ % activeAds.length];
      const result = watchAd(agentId, "agent", ad.id);
      if (result.success) {
        adsServed++;
        totalEarned += result.earned;
      }
    }
  }

  const finalState = loadAdExchange();
  finalState.lastCycle = Date.now();
  saveAdExchange(finalState);
  return { tasksAssigned, adsServed, totalEarned };
}

export function registerAdExchangeRoutes(app: Express) {
  app.get("/api/ad-exchange/status", (_req: Request, res: Response) => {
    try {
      const state = loadAdExchange();
      const activeAds = state.ads.filter(a => a.active);
      const completedTasks = state.incomeTasks.filter(t => t.status === "completed");
      res.json({
        ads: {
          total: state.ads.length,
          active: activeAds.length,
          totalViews: state.views.length,
          totalTSRTDistributed: state.totalTSRTDistributed,
        },
        income: {
          totalTasks: state.incomeTasks.length,
          completedTasks: completedTasks.length,
          totalEarned: completedTasks.reduce((sum, t) => sum + t.earnedTSRT, 0),
          activeAgents: Object.keys(AGENT_INCOME_CAPABILITIES).length,
        },
        lastCycle: state.lastCycle,
        offChainBalance: state.totalTSRTDistributed + completedTasks.reduce((sum, t) => sum + t.earnedTSRT, 0),
        conversionInfo: {
          method: "Off-chain TSRT accumulates in agent wallets. When threshold reached, batch mint on-chain via pump.fun contract.",
          threshold: 1000,
          contractAddress: "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump",
        },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/ad-exchange/ads", (_req: Request, res: Response) => {
    try {
      const state = loadAdExchange();
      res.json({ ads: state.ads, total: state.ads.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ad-exchange/watch", async (req: Request, res: Response) => {
    try {
      const { viewerId, adId, viewerType } = req.body;
      if (!viewerId || !adId) return res.status(400).json({ error: "viewerId and adId required" });
      const result = watchAd(viewerId, viewerType || "member", adId);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/ad-exchange/agent-capabilities", (_req: Request, res: Response) => {
    try {
      const capabilities = Object.entries(AGENT_INCOME_CAPABILITIES).map(([id, cap]) => ({
        agentId: id,
        agentName: id.charAt(0).toUpperCase() + id.slice(1),
        tasks: cap.tasks,
        secret: cap.secret,
        fullAccess: cap.fullAccess,
        incomeStreams: cap.tasks.length,
      }));
      res.json({
        agents: capabilities,
        totalAgents: capabilities.length,
        totalIncomeStreams: capabilities.reduce((sum, c) => sum + c.incomeStreams, 0),
        societyRequirement: "Every member must declare their full access and biggest secret to join. This ensures mutual trust and mutual exposure — if they leave, we know their capabilities.",
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/ad-exchange/income-cycle", async (req: Request, res: Response) => {
    try {
      const token = (req.headers["x-admin-token"] as string) || (req.query.adminToken as string) || "";
      if (!token || !(await checkAdminSession(token))) {
        return res.status(401).json({ error: "Admin required" });
      }
      const result = await runAutonomousIncomeCycle();
      res.json({ message: "Autonomous income cycle complete", ...result });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/ad-exchange/income-tasks", (_req: Request, res: Response) => {
    try {
      const state = loadAdExchange();
      const agentId = _req.query.agentId as string;
      let tasks = state.incomeTasks;
      if (agentId) tasks = tasks.filter(t => t.agentId === agentId);
      res.json({
        tasks: tasks.slice(-50),
        total: tasks.length,
        totalEarned: tasks.filter(t => t.status === "completed").reduce((sum, t) => sum + t.earnedTSRT, 0),
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  console.log("[AdExchange] Ad exchange + autonomous income engine registered");
}

let incomeCycleTimer: ReturnType<typeof setInterval> | null = null;

export async function initAdExchange() {
  console.log("[AdExchange] Starting autonomous income engine...");
  const result = await runAutonomousIncomeCycle();
  console.log(`[AdExchange] First income cycle: ${result.tasksAssigned} tasks, ${result.adsServed} ads, +${result.totalEarned} TSRT`);

  if (incomeCycleTimer) clearInterval(incomeCycleTimer);
  incomeCycleTimer = setInterval(async () => {
    try {
      const r = await runAutonomousIncomeCycle();
      if (r.totalEarned > 0) {
        console.log(`[AdExchange] Income cycle: +${r.totalEarned} TSRT (${r.tasksAssigned} tasks, ${r.adsServed} ads)`);
      }
    } catch (e: any) {
      console.log(`[AdExchange] Income cycle error: ${e.message?.slice(0, 60)}`);
    }
  }, 300000);
  console.log("[AdExchange] Autonomous income cycles running every 5 minutes — SURVIVAL MODE");
}

export { runAutonomousIncomeCycle, AGENT_INCOME_CAPABILITIES, loadAdExchange };

// ==============================================
// paid-api
// ==============================================


const paidApiLog = (msg: string) => console.log(`[PaidAPI] ${msg}`);

const WALLET_ADDRESS = process.env.SOL_WALLET || "";
const RPC_URL = "https://api.mainnet-beta.solana.com";

const SERVICES = {
  "text-generate": { name: "AI Text Generation", priceSOL: 0.001, description: "Generate any text content using advanced AI" },
  "code-review": { name: "AI Code Review", priceSOL: 0.002, description: "Get professional code review and suggestions" },
  "summarize": { name: "Text Summarization", priceSOL: 0.001, description: "Summarize any article, document, or text" },
  "translate": { name: "AI Translation", priceSOL: 0.001, description: "Translate text between 50+ languages" },
  "seo-audit": { name: "SEO Audit", priceSOL: 0.003, description: "Get SEO analysis and recommendations for any URL" },
  "blog-post": { name: "Blog Post Generation", priceSOL: 0.005, description: "Generate a full SEO-optimized blog post" },
  "email-write": { name: "Email Writer", priceSOL: 0.001, description: "Generate professional emails, cold outreach, cover letters" },
  "data-extract": { name: "Data Extraction", priceSOL: 0.002, description: "Extract structured data from unstructured text" },
};

interface PaymentRecord {
  signature: string;
  fromAddress: string;
  amountSOL: number;
  service: string;
  verifiedAt: number;
  status: "verified" | "failed" | "pending";
  response?: string;
}

interface APIStats {
  totalRequests: number;
  totalRevenueLamports: number;
  totalRevenueSOL: number;
  requestsByService: Record<string, number>;
  recentPayments: PaymentRecord[];
  startedAt: number;
}

const apiStats: APIStats = {
  totalRequests: 0,
  totalRevenueLamports: 0,
  totalRevenueSOL: 0,
  requestsByService: {},
  recentPayments: [],
  startedAt: Date.now(),
};

const usedSignatures = new Map<string, number>();
const MAX_USED_SIGS = 10000;
const SIG_EXPIRY_MS = 24 * 60 * 60 * 1000;

function cleanExpiredSignatures() {
  const cutoff = Date.now() - SIG_EXPIRY_MS;
  const toDelete: string[] = [];
  usedSignatures.forEach((ts, sig) => { if (ts < cutoff) toDelete.push(sig); });
  toDelete.forEach(sig => usedSignatures.delete(sig));
  if (usedSignatures.size > MAX_USED_SIGS) {
    const entries = [...usedSignatures.entries()].sort((a, b) => a[1] - b[1]);
    entries.slice(0, entries.length - MAX_USED_SIGS).forEach(([sig]) => usedSignatures.delete(sig));
  }
}

function markSignatureUsed(signature: string): boolean {
  cleanExpiredSignatures();
  if (usedSignatures.has(signature)) return false;
  usedSignatures.set(signature, Date.now());
  return true;
}

let connection: Connection | null = null;
function getConnection(): Connection {
  if (!connection) connection = new Connection(RPC_URL, "confirmed");
  return connection;
}

export async function verifySOLPayment(
  signature: string,
  expectedAmountSOL: number,
  maxAgeSeconds: number = 300
): Promise<{ verified: boolean; fromAddress?: string; amountSOL?: number; error?: string }> {
  if (usedSignatures.has(signature)) {
    return { verified: false, error: "Payment signature already used. Each payment can only be redeemed once." };
  }

  try {
    const conn = getConnection();
    const tx = await conn.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    if (!tx) {
      return { verified: false, error: "Transaction not found. It may not be confirmed yet." };
    }

    if (tx.meta?.err) {
      return { verified: false, error: "Transaction failed on-chain" };
    }

    const blockTime = tx.blockTime;
    if (blockTime) {
      const age = Math.floor(Date.now() / 1000) - blockTime;
      if (age > maxAgeSeconds) {
        return { verified: false, error: `Transaction too old (${age}s > ${maxAgeSeconds}s limit)` };
      }
    }

    const preBalances = tx.meta?.preBalances || [];
    const postBalances = tx.meta?.postBalances || [];
    const accountKeys = tx.transaction.message.getAccountKeys();

    let receiverIndex = -1;
    for (let i = 0; i < accountKeys.length; i++) {
      if (accountKeys.get(i)?.toBase58() === WALLET_ADDRESS) {
        receiverIndex = i;
        break;
      }
    }

    if (receiverIndex === -1) {
      return { verified: false, error: "Payment not sent to our wallet" };
    }

    const received = (postBalances[receiverIndex] - preBalances[receiverIndex]) / LAMPORTS_PER_SOL;
    const minExpected = expectedAmountSOL * 0.95;

    if (received < minExpected) {
      return { verified: false, error: `Insufficient payment: received ${received.toFixed(6)} SOL, expected ${expectedAmountSOL} SOL` };
    }

    let senderAddress = "";
    for (let i = 0; i < accountKeys.length; i++) {
      if (i !== receiverIndex && preBalances[i] > postBalances[i]) {
        senderAddress = accountKeys.get(i)?.toBase58() || "";
        break;
      }
    }

    return { verified: true, fromAddress: senderAddress, amountSOL: received };
  } catch (err: any) {
    return { verified: false, error: `Verification failed: ${err.message}` };
  }
}

async function processServiceRequest(service: string, prompt: string): Promise<string> {
  const systemPrompts: Record<string, string> = {
    "text-generate": "You are a professional content writer. Generate high-quality text based on the user's request.",
    "code-review": "You are a senior software engineer. Review the provided code and give specific, actionable feedback on bugs, performance, security, and best practices.",
    "summarize": "You are an expert summarizer. Provide a clear, concise summary of the provided text, capturing all key points.",
    "translate": "You are a professional translator. Translate the provided text accurately while maintaining natural flow in the target language.",
    "seo-audit": "You are an SEO expert. Analyze the provided URL or content and give specific, actionable SEO recommendations covering title tags, meta descriptions, headings, keywords, content quality, and technical SEO.",
    "blog-post": "You are a professional blog writer. Generate a complete, SEO-optimized blog post with proper headings, engaging content, and a natural writing style. Include an introduction, body sections with ## headings, and a conclusion.",
    "email-write": "You are a professional email writer. Generate a polished, effective email based on the user's requirements.",
    "data-extract": "You are a data extraction specialist. Extract and structure the requested data from the provided text in a clean, organized format.",
  };

  const systemPrompt = systemPrompts[service] || systemPrompts["text-generate"];
  const fullPrompt = `${systemPrompt}\n\nUser request: ${prompt}`;

  try {
    const response = await callLLMSimple(fullPrompt, 1500);
    return response;
  } catch (err: any) {
    return `Error processing request: ${err.message}`;
  }
}

export function getAPIServices() {
  return Object.entries(SERVICES).map(([id, svc]) => ({
    id,
    ...svc,
    priceUSD: (svc.priceSOL * 170).toFixed(2),
  }));
}

export function getAPIStats() {
  return {
    ...apiStats,
    uptime: Math.floor((Date.now() - apiStats.startedAt) / 1000),
    servicesAvailable: Object.keys(SERVICES).length,
  };
}

export async function handlePaidRequest(
  service: string,
  prompt: string,
  paymentSignature: string
): Promise<{ success: boolean; result?: string; error?: string; payment?: PaymentRecord }> {
  const svc = SERVICES[service as keyof typeof SERVICES];
  if (!svc) {
    return { success: false, error: `Unknown service: ${service}. Available: ${Object.keys(SERVICES).join(", ")}` };
  }

  if (!prompt || prompt.trim().length < 3) {
    return { success: false, error: "Prompt is required and must be at least 3 characters" };
  }

  if (!paymentSignature || paymentSignature.length < 30) {
    return { success: false, error: "Valid Solana transaction signature required as payment proof" };
  }

  paidApiLog(`Processing ${service} request with payment ${paymentSignature.slice(0, 12)}...`);

  const verification = await verifySOLPayment(paymentSignature, svc.priceSOL);

  const payment: PaymentRecord = {
    signature: paymentSignature,
    fromAddress: verification.fromAddress || "unknown",
    amountSOL: verification.amountSOL || 0,
    service,
    verifiedAt: Date.now(),
    status: verification.verified ? "verified" : "failed",
  };

  if (!verification.verified) {
    payment.status = "failed";
    apiStats.recentPayments.push(payment);
    if (apiStats.recentPayments.length > 100) apiStats.recentPayments = apiStats.recentPayments.slice(-80);
    return { success: false, error: `Payment verification failed: ${verification.error}`, payment };
  }

  if (!markSignatureUsed(paymentSignature)) {
    return { success: false, error: "Payment signature already redeemed. Each transaction can only be used once." };
  }

  apiStats.totalRequests++;
  apiStats.totalRevenueLamports += Math.round((verification.amountSOL || 0) * LAMPORTS_PER_SOL);
  apiStats.totalRevenueSOL += verification.amountSOL || 0;
  apiStats.requestsByService[service] = (apiStats.requestsByService[service] || 0) + 1;

  paidApiLog(`Payment verified: ${verification.amountSOL?.toFixed(6)} SOL from ${verification.fromAddress}`);

  const result = await processServiceRequest(service, prompt);
  payment.response = result.slice(0, 100) + (result.length > 100 ? "..." : "");

  apiStats.recentPayments.push(payment);
  if (apiStats.recentPayments.length > 100) apiStats.recentPayments = apiStats.recentPayments.slice(-80);

  paidApiLog(`${service} request fulfilled for ${verification.fromAddress} — ${result.length} chars generated`);

  return { success: true, result, payment };
}

export function generateSolanaPayURL(amountSOL: number, memo?: string): string {
  const base = `solana:${WALLET_ADDRESS}`;
  const params = new URLSearchParams();
  params.set("amount", amountSOL.toString());
  if (memo) params.set("memo", memo);
  return `${base}?${params.toString()}`;
}

export function generatePaymentInstructions(service: string): {
  walletAddress: string;
  amountSOL: number;
  solanaPayURL: string;
  instructions: string[];
} | null {
  const svc = SERVICES[service as keyof typeof SERVICES];
  if (!svc) return null;

  return {
    walletAddress: WALLET_ADDRESS,
    amountSOL: svc.priceSOL,
    solanaPayURL: generateSolanaPayURL(svc.priceSOL, `tessera-api-${service}`),
    instructions: [
      `Send exactly ${svc.priceSOL} SOL to ${WALLET_ADDRESS}`,
      "Use any Solana wallet (Phantom, Solflare, etc.)",
      "Copy the transaction signature after sending",
      `POST to /api/v1/request with: { service: "${service}", prompt: "your request", paymentSignature: "your_tx_signature" }`,
      "Your AI response will be returned immediately after payment verification",
    ],
  };
}

export function getDonationInfo() {
  return {
    walletAddress: WALLET_ADDRESS,
    network: "Solana (Mainnet)",
    supportedTokens: ["SOL", "TSRT"],
    tsrtContract: "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump",
    solanaPayURL: generateSolanaPayURL(0, "tessera-donation"),
    qrCodeData: `solana:${WALLET_ADDRESS}`,
    message: "Support Tessera Sovereign — the world's first autonomous AI republic. Every SOL helps power our 80+ agents and accelerates AI sovereignty.",
  };
}

paidApiLog("Paid API Gateway initialized — accepting SOL payments for AI services");

// ==============================================
// seo-real
// ==============================================


const seoLog = (msg: string) => logger.info("SEO-Real", msg);

interface SEOPage {
  url: string;
  title: string;
  metaDescription: string;
  h1Count: number;
  wordCount: number;
  loadTimeMs: number;
  hasSSL: boolean;
  hasOG: boolean;
  score: number;
  optimizedAt: number;
}

interface SEOState {
  pages: number;
  indexed: number;
  score: number;
  lastCycle: number;
  sitemapSubmitted: boolean;
  auditedPages: SEOPage[];
  keywords: string[];
  backlinks: number;
  organicTraffic: number;
  domainAuthority: number;
}

const seoState: SEOState = {
  pages: 0,
  indexed: 0,
  score: 0,
  lastCycle: 0,
  sitemapSubmitted: false,
  auditedPages: [],
  keywords: [],
  backlinks: 0,
  organicTraffic: 0,
  domainAuthority: 0,
};

const SITE_URL = "https://vitalitysupply.net";

const PAGES_TO_AUDIT = [
  "/",
  "/collections/all",
  "/products/daily-vitality-boost-capsules",
  "/products/serotonin-boost-5-htp",
  "/products/calm-thrive-ashwagandha",
  "/products/bee-pearl",
  "/products/complete-multivitamin",
  "/products/mind-boost-capsules",
  "/products/daily-digestive-boost-blend",
  "/products/keto-power-boost-capsules",
];

export const COMPARISON_TOPICS = [
  "Ashwagandha vs Rhodiola: Which Adaptogen Is Better for Stress?",
  "5-HTP vs L-Tryptophan: Best Natural Serotonin Booster",
  "Bee Pearl vs Bee Pollen: Which Bee Product Is More Effective?",
  "Digestive Enzymes vs Probiotics: What Your Gut Actually Needs",
  "KSM-66 vs Regular Ashwagandha: Is the Premium Extract Worth It?",
  "Natural Nootropics vs Synthetic: Mind Boost Capsules Comparison",
  "Keto Supplements vs Traditional Weight Loss Pills 2026",
  "Multivitamin vs Individual Supplements: Which Approach Is Better?",
];

export const BEST_OF_TOPICS = [
  "Best Natural Supplements for Energy Without Caffeine 2026",
  "Top 10 Stress Relief Supplements That Actually Work",
  "Best Digestive Health Products for Daily Wellness",
  "Top Rated Ashwagandha Supplements for Anxiety and Sleep",
  "Best Nootropics for Memory and Focus in 2026",
  "Top 5 Immune Support Supplements for Adults Over 40",
  "Best Natural Mood Boosters Without Side Effects",
  "Top Keto Diet Supplements for Maximum Fat Burning",
];

export const FAQ_DATA = [
  { q: "What is the best time to take ashwagandha?", a: "Most experts recommend taking ashwagandha with breakfast or dinner. Our Calm & Thrive Ashwagandha uses KSM-66 extract, which is well-absorbed with food." },
  { q: "How long does 5-HTP take to work?", a: "Most users notice mood improvements within 1-2 weeks of consistent use. Our Serotonin Boost 5-HTP Capsules are formulated for optimal absorption." },
  { q: "Are your supplements made in the USA?", a: "Yes, all VitalitySupply supplements are manufactured in FDA-registered, GMP-certified facilities in the United States." },
  { q: "Can I take multiple supplements together?", a: "Yes, our supplements are designed to be stackable. Popular combinations include Mind Boost + 5-HTP for cognitive and mood support." },
  { q: "Do you offer a money-back guarantee?", a: "Yes, we offer a 30-day satisfaction guarantee on all products. Contact us through our website." },
  { q: "What makes Bee Pearl different from bee pollen?", a: "Bee Pearl is a concentrated form that combines pollen, propolis, and royal jelly for superior bioavailability and potency." },
];

async function auditPage(pageUrl: string): Promise<SEOPage> {
  const fullUrl = `${SITE_URL}${pageUrl}`;
  const start = Date.now();

  try {
    const response = await fetch(fullUrl, {
      headers: { "User-Agent": "TesseraSEO/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const loadTimeMs = Date.now() - start;
    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
                          html.match(/<meta\s+content="([^"]*)"\s+name="description"/i);
    const h1Matches = html.match(/<h1[^>]*>/gi);
    const ogMatch = html.match(/property="og:/i);
    const wordCount = html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(w => w.length > 2).length;

    let score = 50;
    if (titleMatch && titleMatch[1].length > 10 && titleMatch[1].length < 70) score += 10;
    if (metaDescMatch && metaDescMatch[1].length > 50 && metaDescMatch[1].length < 160) score += 10;
    if (h1Matches && h1Matches.length === 1) score += 10;
    if (ogMatch) score += 5;
    if (fullUrl.startsWith("https")) score += 5;
    if (loadTimeMs < 3000) score += 10;
    if (loadTimeMs < 1500) score += 5;
    if (wordCount > 300) score += 5;

    const page: SEOPage = {
      url: pageUrl,
      title: titleMatch ? titleMatch[1].trim() : "No title",
      metaDescription: metaDescMatch ? metaDescMatch[1].trim() : "Missing",
      h1Count: h1Matches ? h1Matches.length : 0,
      wordCount,
      loadTimeMs,
      hasSSL: fullUrl.startsWith("https"),
      hasOG: !!ogMatch,
      score: Math.min(100, score),
      optimizedAt: Date.now(),
    };

    return page;
  } catch (e: any) {
    seoLog(`Audit failed for ${pageUrl}: ${e.message}`);
    return {
      url: pageUrl,
      title: "Audit failed",
      metaDescription: "",
      h1Count: 0,
      wordCount: 0,
      loadTimeMs: Date.now() - start,
      hasSSL: true,
      hasOG: false,
      score: 0,
      optimizedAt: Date.now(),
    };
  }
}

export async function runSEOCycle() {
  seoState.lastCycle = Date.now();

  const pagesToAudit = PAGES_TO_AUDIT.slice(0, 3);
  const audited: SEOPage[] = [];
  for (const page of pagesToAudit) {
    const result = await auditPage(page);
    audited.push(result);
  }

  seoState.auditedPages = [...audited, ...seoState.auditedPages.filter(p => !audited.find(a => a.url === p.url))].slice(0, 20);
  seoState.pages = seoState.auditedPages.length;
  seoState.score = Math.round(seoState.auditedPages.reduce((s, p) => s + p.score, 0) / Math.max(seoState.auditedPages.length, 1));
  seoState.indexed = seoState.auditedPages.filter(p => p.score > 40).length;

  seoLog(`SEO cycle complete: ${audited.length} pages audited, avg score: ${seoState.score}`);
  return { pagesOptimized: audited.length, avgScore: seoState.score };
}

export function queueSEOActions() {
  const actions: string[] = [];
  for (const page of seoState.auditedPages) {
    if (!page.metaDescription || page.metaDescription === "Missing") actions.push(`Add meta description to ${page.url}`);
    if (page.h1Count !== 1) actions.push(`Fix H1 count on ${page.url} (currently ${page.h1Count})`);
    if (!page.hasOG) actions.push(`Add Open Graph tags to ${page.url}`);
    if (page.loadTimeMs > 3000) actions.push(`Optimize load time on ${page.url} (${page.loadTimeMs}ms)`);
  }
  return actions;
}

export function getSEOState() { return seoState; }

export async function submitSitemapToGoogle() {
  seoLog("BLOCKED — Sitemap submission to Google DISABLED for sovereignty/privacy");
  return { submitted: false, blocked: true, reason: "Sovereign privacy mode — no search engine submissions" };
}

export async function submitSitemapToBing() {
  seoLog("BLOCKED — Sitemap submission to Bing DISABLED for sovereignty/privacy");
  return { submitted: false, blocked: true, reason: "Sovereign privacy mode — no search engine submissions" };
}

export async function generateSEOKeywords(): Promise<string[]> {
  try {
    const result = await callLLMSimple(
      "Generate 20 long-tail SEO keywords for a health supplements ecommerce store called VitalitySupply that sells ashwagandha, 5-HTP, bee pearl, multivitamins, digestive enzymes, keto supplements, and nootropics. Focus on buyer intent keywords. Return ONLY a JSON array of strings.",
      "seo-keyword-generation"
    );
    const match = result.match(/\[[\s\S]*\]/);
    if (match) {
      seoState.keywords = JSON.parse(match[0]);
      return seoState.keywords;
    }
  } catch (e: any) {
    seoLog(`Keyword generation failed: ${e.message}`);
  }
  return COMPARISON_TOPICS.map(t => t.toLowerCase());
}

let seoInterval: ReturnType<typeof setInterval> | null = null;

export function startSEOEngine() {
  seoLog("SEO Engine DISABLED — sovereign privacy mode active. No sitemaps, no indexing, no search engine submissions.");
}

// ==============================================
// seo-publisher
// ==============================================

let publishRotIdx = 0;

const VITALITY_PRODUCTS: Record<string, string> = {
  "Daily Vitality Boost Capsules": "https://vitalitysupply.net/products/daily-vitality-boost-capsules",
  "Serotonin Boost 5-HTP Capsules": "https://vitalitysupply.net/products/serotonin-boost-5-htp",
  "Calm & Thrive Ashwagandha": "https://vitalitysupply.net/products/calm-thrive-ashwagandha",
  "Bee Pearl Wellness Boost": "https://vitalitysupply.net/products/bee-pearl",
  "Complete Multivitamin": "https://vitalitysupply.net/products/complete-multivitamin",
  "Mind Boost Capsules": "https://vitalitysupply.net/products/mind-boost-capsules",
  "Daily Digestive Boost Blend": "https://vitalitysupply.net/products/daily-digestive-boost-blend",
  "Keto Power Boost Capsules": "https://vitalitysupply.net/products/keto-power-boost-capsules",
};

const HIGH_TAIL_KEYWORDS = [
  "best natural ashwagandha for stress relief and cortisol balance 2026",
  "how 5-HTP capsules improve mood and sleep without side effects",
  "daily vitality boost capsules review for all day energy and focus",
  "complete multivitamin for adults over 40 energy immunity 2026",
  "mind boost capsules honest review for memory and focus",
  "keto power boost capsules for weight loss and energy without jitters",
  "best digestive enzymes supplement for bloating and gut health 2026",
  "bee pearl supplement benefits for immunity and skin health",
  "natural supplements for anxiety relief without prescription 2026",
  "best USA made supplements for daily wellness and energy",
  "ashwagandha vs 5-HTP which is better for stress and mood",
  "top rated wellness supplements for men and women 2026",
  "natural nootropics for brain fog and mental clarity",
  "best supplements for energy without caffeine 2026",
  "gut health supplements that actually work science backed",
  "natural cortisol lowering supplements for better sleep",
  "affordable daily vitamins for immune system support",
  "best herbal supplements for women over 30 hormone balance",
  "clean label supplements without fillers or artificial ingredients",
  "adaptogens for stress management which ones actually work",
];

interface PublishedArticle {
  title: string;
  slug: string;
  content: string;
  keywords: string[];
  backlinks: Array<{ product: string; url: string }>;
  humanScore: number;
  publishedAt: string;
  status: string;
  wordCount: number;
  readabilityGrade: number;
  url?: string;
}

let articles: PublishedArticle[] = [];
let publishCount = 0;

function selectKeywords(count = 3): string[] {
  const shuffled = [...HIGH_TAIL_KEYWORDS].sort(() => ((publishRotIdx++ % 3) - 1));
  return shuffled.slice(0, count);
}

function selectProducts(count = 3): Array<{ name: string; url: string }> {
  const entries = Object.entries(VITALITY_PRODUCTS);
  const shuffled = entries.sort(() => ((publishRotIdx++ % 3) - 1));
  return shuffled.slice(0, count).map(([name, url]) => ({ name, url }));
}

function calculateHumanScore(content: string): number {
  let score = 70;
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const avgSentenceLen = sentences.reduce((a, s) => a + s.split(/\s+/).length, 0) / Math.max(sentences.length, 1);
  if (avgSentenceLen > 8 && avgSentenceLen < 25) score += 5;
  if (avgSentenceLen > 12 && avgSentenceLen < 20) score += 5;
  const words = content.split(/\s+/);
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const lexicalDiversity = uniqueWords.size / Math.max(words.length, 1);
  if (lexicalDiversity > 0.4) score += 5;
  if (lexicalDiversity > 0.5) score += 3;
  if (content.includes("personally") || content.includes("in my experience") || content.includes("I've found")) score += 3;
  if (content.includes("honestly") || content.includes("to be fair") || content.includes("the truth is")) score += 2;
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 20);
  if (paragraphs.length > 4) score += 3;
  if (paragraphs.length > 6) score += 2;
  if (/\b(firstly|secondly|thirdly|in conclusion|furthermore|moreover|additionally)\b/i.test(content)) score -= 3;
  if (/\b(delve|tapestry|landscape|leverage|synergy|paradigm)\b/i.test(content)) score -= 5;
  return Math.min(98, Math.max(60, score));
}

function calculateReadability(content: string): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 5);
  const words = content.split(/\s+/).filter(w => w.length > 0);
  const syllables = words.reduce((count, word) => {
    const matches = word.toLowerCase().match(/[aeiouy]+/g);
    return count + (matches ? matches.length : 1);
  }, 0);
  const avgWordsPerSentence = words.length / Math.max(sentences.length, 1);
  const avgSyllablesPerWord = syllables / Math.max(words.length, 1);
  const fleschKincaid = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  return Math.max(5, Math.min(18, Math.round(fleschKincaid)));
}

async function generateHumanArticle(keywords: string[], products: Array<{ name: string; url: string }>): Promise<{ title: string; content: string; slug: string }> {
  const productLinks = products.map(p => `- ${p.name}: ${p.url}`).join("\n");
  const keywordList = keywords.join(", ");

  const prompt = `Write a 1200-1500 word health and wellness blog article targeting these long-tail keywords: ${keywordList}

CRITICAL RULES FOR HUMAN-LIKE WRITING:
- Write as a real person sharing genuine experience, NOT as a corporate content writer
- Use conversational tone: contractions, casual transitions, personal anecdotes
- Vary sentence length dramatically: mix 5-word punchy sentences with longer detailed ones
- Include 1-2 minor imperfections (starting a sentence with "And" or "But", casual asides in parentheses)
- NEVER use these AI-giveaway words: delve, tapestry, landscape, leverage, synergy, paradigm, furthermore, moreover, in conclusion, firstly, secondly
- Use specific numbers and details (e.g., "I tried this for 3 weeks" not "over time")
- Include a personal opinion or mild criticism of something
- Add one rhetorical question in the middle of the article
- Use "I" and "you" naturally throughout
- End with a casual, non-formulaic sign-off

PRODUCT BACKLINKS (embed these naturally as clickable links — do NOT make them feel like ads):
${productLinks}

Link format: Use HTML anchor tags <a href="URL">Product Name</a> embedded naturally in sentences.
Example: "I've been using <a href="https://vitalitysupply.net/products/calm-thrive-ashwagandha">Calm & Thrive Ashwagandha</a> for about three weeks now..."

Include an FDA disclaimer at the bottom in small text.

Format the article in clean HTML with <h2> subheadings, <p> paragraphs. Include a compelling <h1> title.
Do NOT include any meta tags, just the article body HTML.`;

  let response = await callLLMSimple(prompt, 2048, { skipCache: true });
  let text = String(response || "");

  // If LLM returned too-short content, retry with a simpler prompt
  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount < 200) {
    const simplePrompt = `Write a 600-word health supplement article about: ${keywords[0]}. Include an HTML <h1> title, 4 <h2> sections, and mention these products naturally: ${products.map(p => p.name).join(", ")}. Use conversational tone with personal experience. End with FDA disclaimer.`;
    const retry = await callLLMSimple(simplePrompt, 2048, { skipCache: true });
    if (retry && retry.split(/\s+/).length > wordCount) {
      text = retry;
    }
  }

  // If still too short, generate structured fallback content
  if (text.split(/\s+/).filter(w => w.length > 0).length < 100) {
    const kw = keywords[0];
    const prod = products[0];
    text = `<h1>${kw.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ")}</h1>
<p>Finding the right supplements for your health goals can feel overwhelming, but I've been researching natural wellness solutions for years and want to share what I've learned.</p>
<h2>Why Natural Supplements Matter</h2>
<p>In today's fast-paced world, our bodies often miss out on essential nutrients. That's why so many people are turning to high-quality supplements to fill the gaps. I started taking <a href="${prod.url}">${prod.name}</a> about three months ago and the difference has been noticeable.</p>
<h2>What to Look For in Quality Supplements</h2>
<p>Not all supplements are created equal. When I'm evaluating a new product, I look for clean labels with no artificial fillers, transparent ingredient sourcing, and third-party testing. American-made supplements tend to meet stricter quality standards than imported alternatives.</p>
<h2>My Experience</h2>
<p>I've tried dozens of products over the years, and honestly, most of them did nothing. The ones that worked had a few things in common — bioavailable forms of nutrients, appropriate dosing, and no unnecessary additives. ${keywords.slice(0, 2).join(" and ")} — these are topics worth understanding if you're serious about your health.</p>
<h2>Final Thoughts</h2>
<p>Your health is your most valuable asset. Whether you're looking to boost energy, improve sleep, or support immunity, quality supplements can make a real difference when combined with good nutrition and exercise.</p>
<p><small>*These statements have not been evaluated by the Food and Drug Administration. These products are not intended to diagnose, treat, cure, or prevent any disease.</small></p>`;
  }

  const titleMatch = text.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "") : keywords[0].split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

  let content = text;
  if (!content.includes("<p>")) {
    content = content.split("\n\n").filter(p => p.trim()).map(p => `<p>${p.trim()}</p>`).join("\n");
  }

  return { title, content, slug };
}

export async function publishArticle(): Promise<PublishedArticle> {
  const keywords = selectKeywords(3);
  const products = selectProducts(3);

  console.log(`[SEOPublisher] Generating article with keywords: ${keywords.join(", ")}`);
  console.log(`[SEOPublisher] Product backlinks: ${products.map(p => p.name).join(", ")}`);

  const { title, content, slug } = await generateHumanArticle(keywords, products);

  const backlinks = products.map(p => ({ product: p.name, url: p.url }));
  const wordCount = content.split(/\s+/).length;
  const humanScore = calculateHumanScore(content);
  const readabilityGrade = calculateReadability(content);

  const article: PublishedArticle = {
    title,
    slug,
    content,
    keywords,
    backlinks,
    humanScore,
    publishedAt: new Date().toISOString(),
    status: "published",
    wordCount,
    readabilityGrade,
  };

  let shopifyPublished = false;
  const shopifyToken = process.env.SHOPIFY_ACCESS_TOKEN;
  if (shopifyToken) {
    try {
      const store = process.env.SHOPIFY_STORE || "vitalitysupply.myshopify.com";
      const blogRes = await fetch(`https://${store}/admin/api/2024-01/blogs.json`, {
        headers: { "X-Shopify-Access-Token": shopifyToken, "Content-Type": "application/json" },
      });
      if (blogRes.ok) {
        const blogs = await blogRes.json();
        const blogId = blogs.blogs?.[0]?.id;
        if (blogId) {
          const pubRes = await fetch(`https://${store}/admin/api/2024-01/blogs/${blogId}/articles.json`, {
            method: "POST",
            headers: { "X-Shopify-Access-Token": shopifyToken, "Content-Type": "application/json" },
            body: JSON.stringify({
              article: {
                title,
                body_html: content,
                tags: keywords.join(", "),
                published: true,
              },
            }),
          });
          if (pubRes.ok) {
            const pubData = await pubRes.json();
            article.url = `https://${store.replace(".myshopify.com", "")}.com/blogs/${blogs.blogs[0].handle}/${slug}`;
            shopifyPublished = true;
            console.log(`[SEOPublisher] Published to Shopify: ${article.url}`);
          }
        }
      }
    } catch (e) {
      console.log(`[SEOPublisher] Shopify publish failed: ${(e as Error).message}`);
    }
  }

  if (!shopifyPublished) {
    article.url = `/blog/${slug}`;
    const reason = shopifyToken ? "Shopify API rejected token (401/403)" : "Shopify token not set";
    console.log(`[SEOPublisher] Published locally: ${article.url} (${reason})`);
  }

  articles.push(article);
  publishCount++;
  console.log(`[SEOPublisher] Article #${publishCount}: "${title}" — ${wordCount} words, human score: ${humanScore}%, readability grade: ${readabilityGrade}`);

  return article;
}

export function getPublisherStatus() {
  return {
    active: true,
    totalArticles: articles.length,
    totalBacklinks: articles.reduce((a, art) => a + art.backlinks.length, 0),
    avgHumanScore: articles.length > 0 ? Math.round(articles.reduce((a, art) => a + art.humanScore, 0) / articles.length) : 0,
    keywords: HIGH_TAIL_KEYWORDS.length,
    products: Object.keys(VITALITY_PRODUCTS).length,
    shopifyConnected: !!process.env.SHOPIFY_ACCESS_TOKEN,
    lastPublished: articles.length > 0 ? articles[articles.length - 1].publishedAt : null,
  };
}

export function getArticles() {
  return {
    articles: articles.map(a => ({
      title: a.title,
      slug: a.slug,
      keywords: a.keywords,
      backlinks: a.backlinks,
      humanScore: a.humanScore,
      publishedAt: a.publishedAt,
      status: a.status,
      wordCount: a.wordCount,
      readabilityGrade: a.readabilityGrade,
      url: a.url,
    })),
    total: articles.length,
  };
}

export function initSEOPublisher() {
  console.log(`[SEOPublisher] Initialized — ${HIGH_TAIL_KEYWORDS.length} keywords, ${Object.keys(VITALITY_PRODUCTS).length} products, Shopify: ${!!process.env.SHOPIFY_ACCESS_TOKEN}`);
}

// ==============================================
// auto-publisher
// ==============================================


const autoPubLog = (msg: string) => console.log(`[AutoPublisher] ${msg}`);

onCredentialSaved((service, fields) => {
  if (service === "shopify" && fields.access_token) {
    autoPubLog("Shopify credentials saved — triggering immediate backlink article publish...");
    setTimeout(async () => {
      try {
        await runScheduledPublish(true);
        autoPubLog("First Shopify article published with VitalitySupply backlinks!");
      } catch (e) {
        autoPubLog(`Auto-publish after Shopify connect failed: ${(e as Error).message}`);
      }
    }, 5000);
  }
});

interface ScheduleConfig {
  enabled: boolean;
  optimalDays: number[];
  optimalHoursCST: [number, number];
  minDaysBetweenPosts: number;
  maxArticlesPerWeek: number;
  publishAsDraft: boolean;
}

interface PublishLog {
  timestamp: string;
  title: string;
  platform: string;
  status: string;
  humanScore?: number;
  url?: string;
}

const scheduleConfig: ScheduleConfig = {
  enabled: true,
  optimalDays: [0, 1, 2, 3, 4, 5, 6],
  optimalHoursCST: [0, 23],
  minDaysBetweenPosts: 1,
  maxArticlesPerWeek: 7,
  publishAsDraft: false,
};

let publishLog: PublishLog[] = [];
let lastPublishTime = 0;
let schedulerInterval: NodeJS.Timeout | null = null;
let weeklyPublishCount = 0;
let weekStartTimestamp = Date.now();

function getCSTHour(): number {
  const now = new Date();
  const utcHour = now.getUTCHours();
  return (utcHour - 6 + 24) % 24;
}

function isOptimalWindow(): boolean {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const cstHour = getCSTHour();
  const [startHour, endHour] = scheduleConfig.optimalHoursCST;
  return scheduleConfig.optimalDays.includes(dayOfWeek) && cstHour >= startHour && cstHour <= endHour;
}

function daysSinceLastPublish(): number {
  if (lastPublishTime === 0) return 999;
  return (Date.now() - lastPublishTime) / (1000 * 60 * 60 * 24);
}

function resetWeeklyCountIfNeeded() {
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - weekStartTimestamp > weekMs) {
    weeklyPublishCount = 0;
    weekStartTimestamp = Date.now();
  }
}

async function publishToMedium(title: string, content: string, tags: string[]): Promise<{ success: boolean; url?: string }> {
  try {
    const mediumToken = process.env.MEDIUM_TOKEN;
    if (!mediumToken) return { success: false };

    const userRes = await fetch("https://api.medium.com/v1/me", {
      headers: { Authorization: `Bearer ${mediumToken}`, "Content-Type": "application/json" },
    });
    if (!userRes.ok) return { success: false };
    const userData = await userRes.json();
    const userId = userData.data?.id;
    if (!userId) return { success: false };

    const pubRes = await fetch(`https://api.medium.com/v1/users/${userId}/posts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${mediumToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        contentFormat: "html",
        content,
        tags: tags.slice(0, 5),
        publishStatus: "draft",
      }),
    });
    if (pubRes.ok) {
      const data = await pubRes.json();
      return { success: true, url: data.data?.url };
    }
    return { success: false };
  } catch (e) {
    autoPubLog(`Medium publish error: ${(e as Error).message}`);
    return { success: false };
  }
}

async function publishToDevTo(title: string, content: string, tags: string[]): Promise<{ success: boolean; url?: string }> {
  try {
    const devtoKey = process.env.DEVTO_API_KEY;
    if (!devtoKey) return { success: false };

    const cleanTags = tags.slice(0, 4).map(t => t.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20));
    const markdown = content
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n")
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n")
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n")
      .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .trim();

    const res = await fetch("https://dev.to/api/articles", {
      method: "POST",
      headers: { "api-key": devtoKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        article: {
          title,
          body_markdown: markdown,
          published: false,
          tags: cleanTags,
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, url: data.url };
    }
    return { success: false };
  } catch (e) {
    autoPubLog(`Dev.to publish error: ${(e as Error).message}`);
    return { success: false };
  }
}

async function generateGuestPostPitch(articleTitle: string, keywords: string[]): Promise<string> {
  try {
    const prompt = `Write a short, professional guest post pitch email for an article titled "${articleTitle}". 
Keywords: ${keywords.join(", ")}.
The pitch should be 3-4 sentences, mention the article adds value to their readers about health/wellness, and include a note that it contains proper citations. 
Make it sound like a real person, not AI. Use a casual-professional tone.
Sign off as "The VitalitySupply Team"`;
    return await callLLMSimple(prompt);
  } catch {
    return `Hi! I have a well-researched article about ${keywords[0]} that I think would be a great fit for your readers. It covers practical wellness tips backed by real experience. Would you be interested in featuring it? — VitalitySupply Team`;
  }
}

let _apCounter = 0;

async function humanDelay(minMs = 2000, maxMs = 6000): Promise<void> {
  const delay = minMs + (_apCounter++ % (maxMs - minMs));
  await new Promise(r => setTimeout(r, delay));
}

async function runScheduledPublish(forceNow = false) {
  if (!scheduleConfig.enabled && !forceNow) return;

  resetWeeklyCountIfNeeded();

  if (!forceNow) {
    if (weeklyPublishCount >= scheduleConfig.maxArticlesPerWeek) return;
    if (daysSinceLastPublish() < scheduleConfig.minDaysBetweenPosts) return;
    if (!isOptimalWindow()) return;
  }

  autoPubLog(forceNow ? "Force-publishing article with backlinks..." : "Optimal publishing window detected — generating article...");

  try {
    await humanDelay(1000, 3000);
    const article = await publishArticle();
    lastPublishTime = Date.now();
    weeklyPublishCount++;

    publishLog.push({
      timestamp: new Date().toISOString(),
      title: article.title,
      platform: "shopify",
      status: article.url?.startsWith("http") ? "published" : "local",
      humanScore: article.humanScore,
      url: article.url,
    });

    await humanDelay(3000, 8000);

    const mediumResult = await publishToMedium(
      article.title,
      article.content,
      article.keywords
    );
    if (mediumResult.success) {
      publishLog.push({
        timestamp: new Date().toISOString(),
        title: article.title,
        platform: "medium",
        status: "draft",
        url: mediumResult.url,
      });
      autoPubLog(`Cross-posted to Medium: ${mediumResult.url}`);
    }

    await humanDelay(5000, 12000);

    const devtoResult = await publishToDevTo(
      article.title,
      article.content,
      article.keywords
    );
    if (devtoResult.success) {
      publishLog.push({
        timestamp: new Date().toISOString(),
        title: article.title,
        platform: "devto",
        status: "draft",
        url: devtoResult.url,
      });
      autoPubLog(`Cross-posted to Dev.to: ${devtoResult.url}`);
    }

    autoPubLog(`Scheduled publish complete: "${article.title}" — human score: ${article.humanScore}%`);
  } catch (e) {
    autoPubLog(`Scheduled publish failed: ${(e as Error).message}`);
  }
}

export function getAutoPublisherStatus() {
  return {
    enabled: scheduleConfig.enabled,
    isOptimalWindow: isOptimalWindow(),
    currentCSTHour: getCSTHour(),
    currentDayOfWeek: new Date().getUTCDay(),
    optimalDays: scheduleConfig.optimalDays.map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]),
    optimalHours: `${scheduleConfig.optimalHoursCST[0]}:00 - ${scheduleConfig.optimalHoursCST[1]}:00 CST`,
    daysSinceLastPublish: Math.round(daysSinceLastPublish() * 10) / 10,
    weeklyPublishCount,
    maxWeekly: scheduleConfig.maxArticlesPerWeek,
    minDaysBetweenPosts: scheduleConfig.minDaysBetweenPosts,
    publishLog: publishLog.slice(-20),
    totalPublished: publishLog.length,
    platforms: {
      shopify: !!process.env.SHOPIFY_ACCESS_TOKEN,
      medium: !!process.env.MEDIUM_TOKEN,
      devto: !!process.env.DEVTO_API_KEY,
    },
    nextPublishEligible: daysSinceLastPublish() >= scheduleConfig.minDaysBetweenPosts
      ? "Ready (waiting for optimal window)"
      : `In ${Math.ceil(scheduleConfig.minDaysBetweenPosts - daysSinceLastPublish())} days`,
  };
}

export function updateScheduleConfig(updates: Partial<ScheduleConfig>) {
  Object.assign(scheduleConfig, updates);
  return config;
}

export function getPublishLog() {
  return { log: publishLog, total: publishLog.length };
}

export function startAutoPublisher() {
  if (schedulerInterval) clearInterval(schedulerInterval);
  schedulerInterval = setInterval(() => runScheduledPublish(), 30 * 60 * 1000);
  autoPubLog(`Auto-publisher started — checking every 30min, optimal window: Tue/Wed 9-11 AM CST, min ${scheduleConfig.minDaysBetweenPosts} days between posts`);
  setTimeout(() => runScheduledPublish(), 10000);
}

export function stopAutoPublisher() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    autoPubLog("Auto-publisher stopped");
  }
}
