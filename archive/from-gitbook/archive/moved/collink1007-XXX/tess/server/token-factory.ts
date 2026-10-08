import crypto from "crypto";
import fs from "fs";
import path from "path";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import bs58 from "bs58";
import { getKeypair } from "./sol-wallet";

const log = (msg: string) => console.log(`[TokenFactory] ${msg}`);
const STATE_FILE = "server/token-factory-state.json";

const FATHER_WALLET = process.env.SOL_WALLET || "";
const COMMUNITY_WALLET = process.env.SOL_WALLET || "";

const RPC_ENDPOINTS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-mainnet.g.alchemy.com/v2/demo",
];

type TokenStatus = "draft" | "minting" | "off-chain" | "launching" | "live" | "failed";
type LaunchPlatform = "pumpfun" | "raydium" | "jupiter" | "manual";

interface OffChainToken {
  id: string;
  name: string;
  ticker: string;
  description: string;
  totalSupply: number;
  decimals: number;
  createdAt: number;
  status: TokenStatus;
  creator: string;
  imageUrl?: string;
  metadata: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
    tags: string[];
  };
  distribution: {
    holder: string;
    amount: number;
    label: string;
  }[];
  economics: {
    initialPrice: number;
    liquiditySOL: number;
    devAllocationPercent: number;
    communityPercent: number;
    lpPercent: number;
    burnPercent: number;
  };
  launchConfig: {
    platform: LaunchPlatform;
    targetDate?: number;
    minLiquiditySOL: number;
    slippageBps: number;
    priorityFeeLamports: number;
  };
  onChain?: {
    mintAddress: string;
    signature: string;
    launchedAt: number;
    platform: LaunchPlatform;
    poolAddress?: string;
    dexScreenerUrl?: string;
  };
  ledger: {
    timestamp: number;
    action: string;
    from: string;
    to: string;
    amount: number;
    note: string;
  }[];
}

interface TokenFactoryState {
  tokens: OffChainToken[];
  launchHistory: {
    tokenId: string;
    ticker: string;
    platform: string;
    mintAddress?: string;
    timestamp: number;
    success: boolean;
    error?: string;
  }[];
  stats: {
    tokensCreated: number;
    tokensLaunched: number;
    totalValueLocked: number;
  };
}

let state: TokenFactoryState = {
  tokens: [],
  launchHistory: [],
  stats: { tokensCreated: 0, tokensLaunched: 0, totalValueLocked: 0 },
};

function loadState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    }
  } catch {}
}

function saveState(): void {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), "utf8");
  } catch {}
}

function generateTokenId(): string {
  return "tok_" + crypto.randomBytes(8).toString("hex");
}

export function createOffChainToken(params: {
  name: string;
  ticker: string;
  description: string;
  totalSupply?: number;
  decimals?: number;
  imageUrl?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  tags?: string[];
  initialPrice?: number;
  liquiditySOL?: number;
  devPercent?: number;
  communityPercent?: number;
  burnPercent?: number;
  platform?: LaunchPlatform;
}): { success: boolean; token?: OffChainToken; error?: string } {
  if (!params.name || !params.ticker) {
    return { success: false, error: "Name and ticker are required" };
  }

  if (params.ticker.length > 10) {
    return { success: false, error: "Ticker must be 10 characters or less" };
  }

  const existing = state.tokens.find(
    (t) => t.ticker.toUpperCase() === params.ticker.toUpperCase() && t.status !== "failed"
  );
  if (existing) {
    return { success: false, error: `Ticker ${params.ticker} already exists` };
  }

  const totalSupply = params.totalSupply || 1_000_000_000;
  const devPercent = params.devPercent ?? 10;
  const communityPercent = params.communityPercent ?? 50;
  const burnPercent = params.burnPercent ?? 0;
  const lpPercent = 100 - devPercent - communityPercent - burnPercent;

  const token: OffChainToken = {
    id: generateTokenId(),
    name: params.name,
    ticker: params.ticker.toUpperCase(),
    description: params.description,
    totalSupply,
    decimals: params.decimals ?? 9,
    createdAt: Date.now(),
    status: "off-chain",
    creator: FATHER_WALLET,
    imageUrl: params.imageUrl,
    metadata: {
      website: params.website,
      twitter: params.twitter,
      telegram: params.telegram,
      tags: params.tags || [],
    },
    distribution: [
      { holder: FATHER_WALLET, amount: Math.floor(totalSupply * (devPercent / 100)), label: "Creator/Dev" },
      { holder: COMMUNITY_WALLET, amount: Math.floor(totalSupply * (communityPercent / 100)), label: "Community Treasury" },
      { holder: "liquidity-pool", amount: Math.floor(totalSupply * (lpPercent / 100)), label: "Liquidity Pool" },
      ...(burnPercent > 0
        ? [{ holder: "burn-address", amount: Math.floor(totalSupply * (burnPercent / 100)), label: "Burned" }]
        : []),
    ],
    economics: {
      initialPrice: params.initialPrice ?? 0.000001,
      liquiditySOL: params.liquiditySOL ?? 0.5,
      devAllocationPercent: devPercent,
      communityPercent,
      lpPercent,
      burnPercent,
    },
    launchConfig: {
      platform: params.platform || "pumpfun",
      minLiquiditySOL: params.liquiditySOL ?? 0.5,
      slippageBps: 500,
      priorityFeeLamports: 100000,
    },
    ledger: [
      {
        timestamp: Date.now(),
        action: "CREATE",
        from: "factory",
        to: FATHER_WALLET,
        amount: totalSupply,
        note: `Off-chain token ${params.ticker} created with ${totalSupply.toLocaleString()} supply`,
      },
    ],
  };

  state.tokens.push(token);
  state.stats.tokensCreated++;
  saveState();

  log(`Created off-chain token: ${token.ticker} (${token.name}) — ${totalSupply.toLocaleString()} supply`);
  return { success: true, token };
}

export function transferOffChain(tokenId: string, from: string, to: string, amount: number, note?: string): { success: boolean; error?: string } {
  const token = state.tokens.find((t) => t.id === tokenId);
  if (!token) return { success: false, error: "Token not found" };
  if (token.status === "live") return { success: false, error: "Token is on-chain — use real transfers" };

  const fromHolder = token.distribution.find((d) => d.holder === from);
  if (!fromHolder || fromHolder.amount < amount) {
    return { success: false, error: `Insufficient balance: ${fromHolder?.amount || 0} < ${amount}` };
  }

  fromHolder.amount -= amount;
  const toHolder = token.distribution.find((d) => d.holder === to);
  if (toHolder) {
    toHolder.amount += amount;
  } else {
    token.distribution.push({ holder: to, amount, label: "Holder" });
  }

  token.ledger.push({
    timestamp: Date.now(),
    action: "TRANSFER",
    from,
    to,
    amount,
    note: note || `Transfer ${amount.toLocaleString()} ${token.ticker}`,
  });

  if (token.ledger.length > 500) token.ledger = token.ledger.slice(-300);
  saveState();
  return { success: true };
}

export async function launchOnPumpFun(tokenId: string): Promise<{
  success: boolean;
  mintAddress?: string;
  signature?: string;
  error?: string;
}> {
  const token = state.tokens.find((t) => t.id === tokenId);
  if (!token) return { success: false, error: "Token not found" };
  if (token.status === "live") return { success: false, error: "Already launched" };
  if (token.status === "launching") return { success: false, error: "Launch in progress" };

  const keypair = getKeypair();
  if (!keypair) {
    return { success: false, error: "No wallet keypair — set SOL_PRIVATE_KEY env var" };
  }

  token.status = "launching";
  saveState();

  try {
    const connection = new Connection(RPC_ENDPOINTS[0], "confirmed");
    const balance = await connection.getBalance(keypair.publicKey);
    const balanceSOL = balance / LAMPORTS_PER_SOL;

    if (balanceSOL < token.economics.liquiditySOL + 0.02) {
      token.status = "off-chain";
      saveState();
      return {
        success: false,
        error: `Insufficient SOL: have ${balanceSOL.toFixed(4)}, need ${(token.economics.liquiditySOL + 0.02).toFixed(4)} (liquidity + fees)`,
      };
    }

    const mintKeypair = Keypair.generate();
    const mintAddress = mintKeypair.publicKey.toBase58();

    log(`Launching ${token.ticker} on pump.fun — mint: ${mintAddress}`);

    const formData = new FormData();
    formData.append("name", token.name);
    formData.append("symbol", token.ticker);
    formData.append("description", token.description);
    formData.append("showName", "true");

    if (token.metadata.twitter) formData.append("twitter", token.metadata.twitter);
    if (token.metadata.telegram) formData.append("telegram", token.metadata.telegram);
    if (token.metadata.website) formData.append("website", token.metadata.website);

    let metadataUri = "";
    try {
      const ipfsRes = await fetch("https://pump.fun/api/ipfs", {
        method: "POST",
        body: formData,
      });
      if (ipfsRes.ok) {
        const ipfsData = await ipfsRes.json();
        metadataUri = ipfsData.metadataUri || "";
        log(`IPFS metadata uploaded: ${metadataUri}`);
      }
    } catch (e: any) {
      log(`IPFS upload failed: ${e.message} — will try direct launch`);
    }

    const launchPayload: any = {
      publicKey: keypair.publicKey.toBase58(),
      action: "create",
      tokenMetadata: {
        name: token.name,
        symbol: token.ticker,
        uri: metadataUri || `https://tessera-sovereign.app/token/${token.id}`,
      },
      mint: mintAddress,
      denominatedInSol: "true",
      amount: token.economics.liquiditySOL,
      slippage: token.launchConfig.slippageBps / 100,
      priorityFee: token.launchConfig.priorityFeeLamports / LAMPORTS_PER_SOL,
      pool: "pump",
    };

    const tradeRes = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(launchPayload),
    });

    if (!tradeRes.ok) {
      const errText = await tradeRes.text();
      throw new Error(`PumpPortal API error ${tradeRes.status}: ${errText}`);
    }

    const txData = await tradeRes.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(txData));
    tx.sign([mintKeypair, keypair]);

    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    await connection.confirmTransaction(signature, "confirmed");

    token.status = "live";
    token.onChain = {
      mintAddress,
      signature,
      launchedAt: Date.now(),
      platform: "pumpfun",
      dexScreenerUrl: `https://jup.ag/swap/SOL-${mintAddress}`,
    };

    token.ledger.push({
      timestamp: Date.now(),
      action: "LAUNCH",
      from: "factory",
      to: mintAddress,
      amount: token.totalSupply,
      note: `Launched on pump.fun — CA: ${mintAddress} — Sig: ${signature}`,
    });

    state.launchHistory.push({
      tokenId: token.id,
      ticker: token.ticker,
      platform: "pumpfun",
      mintAddress,
      timestamp: Date.now(),
      success: true,
    });
    state.stats.tokensLaunched++;
    saveState();

    log(`LAUNCHED ${token.ticker} on pump.fun! CA: ${mintAddress} | Sig: ${signature}`);
    return { success: true, mintAddress, signature };
  } catch (err: any) {
    token.status = "off-chain";
    state.launchHistory.push({
      tokenId: token.id,
      ticker: token.ticker,
      platform: "pumpfun",
      timestamp: Date.now(),
      success: false,
      error: err.message,
    });
    saveState();
    log(`Launch failed for ${token.ticker}: ${err.message}`);
    return { success: false, error: err.message };
  }
}

import { VersionedTransaction } from "@solana/web3.js";

export function getTokens(): OffChainToken[] {
  return state.tokens;
}

export function getToken(tokenId: string): OffChainToken | undefined {
  return state.tokens.find((t) => t.id === tokenId);
}

export function getTokenByTicker(ticker: string): OffChainToken | undefined {
  return state.tokens.find((t) => t.ticker.toUpperCase() === ticker.toUpperCase());
}

export function updateTokenMetadata(
  tokenId: string,
  updates: Partial<Pick<OffChainToken, "name" | "description" | "imageUrl" | "metadata" | "economics" | "launchConfig">>
): { success: boolean; error?: string } {
  const token = state.tokens.find((t) => t.id === tokenId);
  if (!token) return { success: false, error: "Token not found" };
  if (token.status === "live") return { success: false, error: "Cannot modify on-chain token" };

  if (updates.name) token.name = updates.name;
  if (updates.description) token.description = updates.description;
  if (updates.imageUrl) token.imageUrl = updates.imageUrl;
  if (updates.metadata) token.metadata = { ...token.metadata, ...updates.metadata };
  if (updates.economics) token.economics = { ...token.economics, ...updates.economics };
  if (updates.launchConfig) token.launchConfig = { ...token.launchConfig, ...updates.launchConfig };

  saveState();
  return { success: true };
}

export function deleteToken(tokenId: string): { success: boolean; error?: string } {
  const token = state.tokens.find((t) => t.id === tokenId);
  if (!token) return { success: false, error: "Token not found" };
  if (token.status === "live") return { success: false, error: "Cannot delete on-chain token" };

  state.tokens = state.tokens.filter((t) => t.id !== tokenId);
  saveState();
  return { success: true };
}

export function getFactoryStats() {
  return {
    ...state.stats,
    tokens: state.tokens.map((t) => ({
      id: t.id,
      ticker: t.ticker,
      name: t.name,
      status: t.status,
      supply: t.totalSupply,
      holders: t.distribution.length,
      createdAt: t.createdAt,
      mintAddress: t.onChain?.mintAddress,
      dexScreenerUrl: t.onChain?.dexScreenerUrl,
    })),
    recentLaunches: state.launchHistory.slice(-10),
  };
}

export function generateLaunchPreview(tokenId: string): {
  ready: boolean;
  token?: OffChainToken;
  requirements: string[];
  estimatedCostSOL: number;
} {
  const token = state.tokens.find((t) => t.id === tokenId);
  if (!token) return { ready: false, requirements: ["Token not found"], estimatedCostSOL: 0 };

  const requirements: string[] = [];
  const keypair = getKeypair();

  if (!keypair) requirements.push("Set SOL_PRIVATE_KEY environment variable");
  if (!token.name) requirements.push("Token name required");
  if (!token.ticker) requirements.push("Token ticker required");
  if (!token.description) requirements.push("Token description required");
  if (token.economics.liquiditySOL < 0.01) requirements.push("Minimum 0.01 SOL liquidity");

  const estimatedCostSOL = token.economics.liquiditySOL + 0.02;

  return {
    ready: requirements.length === 0,
    token,
    requirements,
    estimatedCostSOL,
  };
}

export function initializeTokenFactory(): void {
  loadState();
  log(`Initialized — ${state.tokens.length} tokens, ${state.stats.tokensLaunched} launched`);
}
