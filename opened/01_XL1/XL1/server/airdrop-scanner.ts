import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { executeBestSwap } from "./arbitrage-engine";
import { findOptimalConversionPath, executeOptimalConversion } from "./optimal-conversion-engine";

const alog = (m: string) => {
  console.log(`[AirdropScanner] ${m}`);
  scanLog.push({ timestamp: Date.now(), message: m });
  if (scanLog.length > 200) scanLog.splice(0, scanLog.length - 200);
};

const scanLog: Array<{ timestamp: number; message: string }> = [];

const FATHER_WALLET = process.env.SOL_WALLET || "";
const COMMUNITY_WALLET = process.env.SOL_WALLET || "[FATHER-WALLET]";
const LIMN_MINT = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const RPC_URL = "https://api.mainnet-beta.solana.com";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const MIN_VALUE_TO_SELL = 0.01;
const MIN_SOL_FOR_GAS = 0.002;

interface AirdropOpportunity {
  id: string;
  name: string;
  protocol: string;
  type: "token_airdrop" | "nft_airdrop" | "retroactive" | "testnet" | "community";
  status: "eligible" | "claimable" | "claimed" | "expired" | "not_eligible" | "checking";
  estimatedValue: number;
  claimUrl?: string;
  tokenMint?: string;
  amount?: number;
  expiresAt?: number;
  checkedAt: number;
  claimedAt?: number;
  txSignature?: string;
  details: string;
  proofUrl?: string;
}

interface TokenAccount {
  mint: string;
  balance: number;
  decimals: number;
  symbol?: string;
  usdValue?: number;
  explorerUrl?: string;
  accountAddress?: string;
}

interface PipelineExecution {
  timestamp: number;
  action: "sell" | "buy_limn" | "keep" | "skip";
  token: string;
  mint: string;
  amountIn: number;
  amountOut: number;
  route: string;
  txSignature: string;
  success: boolean;
}

interface AirdropScannerState {
  lastFullScan: number;
  opportunities: AirdropOpportunity[];
  tokenAccounts: TokenAccount[];
  totalClaimedUsd: number;
  totalPendingUsd: number;
  scanCount: number;
  successfulClaims: number;
  pipelineExecutions: PipelineExecution[];
  autoExecuteEnabled: boolean;
}

let state: AirdropScannerState = {
  lastFullScan: 0,
  opportunities: [],
  tokenAccounts: [],
  totalClaimedUsd: 0,
  totalPendingUsd: 0,
  scanCount: 0,
  successfulClaims: 0,
  pipelineExecutions: [],
  autoExecuteEnabled: true,
};

let connection: Connection | null = null;
let scanInterval: NodeJS.Timeout | null = null;

function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(RPC_URL, "confirmed");
  }
  return connection;
}

async function scanTokenAccounts(): Promise<TokenAccount[]> {
  try {
    const conn = getConnection();
    const walletPubkey = new PublicKey(FATHER_WALLET);
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(walletPubkey, {
      programId: new PublicKey(TOKEN_PROGRAM),
    });

    const accounts: TokenAccount[] = [];
    for (const account of tokenAccounts.value) {
      const info = account.account.data.parsed?.info;
      if (info && info.tokenAmount) {
        const balance = parseFloat(info.tokenAmount.uiAmountString || "0");
        if (balance > 0) {
          accounts.push({
            mint: info.mint,
            balance,
            decimals: info.tokenAmount.decimals,
            accountAddress: account.pubkey.toBase58(),
            explorerUrl: `https://solscan.io/account/${account.pubkey.toBase58()}`,
          });
        }
      }
    }

    try {
      const token2022Accounts = await conn.getParsedTokenAccountsByOwner(walletPubkey, {
        programId: new PublicKey(TOKEN_2022_PROGRAM),
      });
      for (const account of token2022Accounts.value) {
        const info = account.account.data.parsed?.info;
        if (info && info.tokenAmount) {
          const balance = parseFloat(info.tokenAmount.uiAmountString || "0");
          if (balance > 0) {
            accounts.push({
              mint: info.mint,
              balance,
              decimals: info.tokenAmount.decimals,
              accountAddress: account.pubkey.toBase58(),
              explorerUrl: `https://solscan.io/account/${account.pubkey.toBase58()}`,
            });
          }
        }
      }
    } catch {}

    state.tokenAccounts = accounts;
    alog(`Found ${accounts.length} token accounts with non-zero balances`);
    return accounts;
  } catch (err: any) {
    alog(`Token account scan error: ${err.message}`);
    return [];
  }
}

async function getTokenPrices(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  if (mints.length === 0) return prices;

  try {
    const mintList = mints.slice(0, 30).join(",");
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${mintList}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json() as any;
      for (const pair of (data.pairs || [])) {
        if (pair.baseToken?.address && pair.priceUsd) {
          prices.set(pair.baseToken.address, parseFloat(pair.priceUsd));
          alog(`[PRICE] DexScreener: ${pair.baseToken.address.slice(0,8)}... = $${pair.priceUsd} (liq: $${pair.liquidity?.usd || 0})`);
        }
      }
    }
  } catch {}

  const missingMints = mints.filter(m => !prices.has(m));
  for (const mint of missingMints.slice(0, 10)) {
    try {
      const geckoRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${mint}`, {
        signal: AbortSignal.timeout(8000),
        headers: { "Accept": "application/json" },
      });
      if (geckoRes.ok) {
        const geckoData = await geckoRes.json() as any;
        const priceUsd = geckoData?.data?.attributes?.price_usd;
        if (priceUsd && parseFloat(priceUsd) > 0) {
          prices.set(mint, parseFloat(priceUsd));
          alog(`[PRICE] GeckoTerminal: ${mint.slice(0,8)}... = $${priceUsd}`);
        }
      }
    } catch {}

    if (!prices.has(mint)) {
      try {
        const jupRes = await fetch(`https://api.jup.ag/price/v2?ids=${mint}`, {
          signal: AbortSignal.timeout(8000),
        });
        if (jupRes.ok) {
          const jupData = await jupRes.json() as any;
          const jupPrice = jupData?.data?.[mint]?.price;
          if (jupPrice && parseFloat(jupPrice) > 0) {
            prices.set(mint, parseFloat(jupPrice));
            alog(`[PRICE] Jupiter: ${mint.slice(0,8)}... = $${jupPrice}`);
          }
        }
      } catch {}
    }

    if (!prices.has(mint)) {
      alog(`[PRICE] No price found for ${mint} on any source (DexScreener, GeckoTerminal, Jupiter)`);
    }
  }

  return prices;
}

async function checkJupiterAirdrops(): Promise<AirdropOpportunity[]> {
  const opportunities: AirdropOpportunity[] = [];
  try {
    const res = await fetch(`https://claim.jup.ag/eligibility/${FATHER_WALLET}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json() as any;
      if (data.amount && parseFloat(data.amount) > 0) {
        opportunities.push({
          id: "jupiter-airdrop",
          name: "Jupiter Airdrop",
          protocol: "Jupiter",
          type: "retroactive",
          status: data.claimed ? "claimed" : "claimable",
          estimatedValue: parseFloat(data.amount) * 0.8,
          claimUrl: "https://claim.jup.ag",
          amount: parseFloat(data.amount),
          checkedAt: Date.now(),
          details: `${data.amount} JUP tokens ${data.claimed ? "already claimed" : "available to claim"}`,
        });
      } else {
        opportunities.push({
          id: "jupiter-airdrop",
          name: "Jupiter Airdrop",
          protocol: "Jupiter",
          type: "retroactive",
          status: "not_eligible",
          estimatedValue: 0,
          checkedAt: Date.now(),
          details: "Wallet not eligible for Jupiter airdrop",
        });
      }
    }
  } catch {
    opportunities.push({
      id: "jupiter-airdrop",
      name: "Jupiter Airdrop",
      protocol: "Jupiter",
      type: "retroactive",
      status: "checking",
      estimatedValue: 0,
      checkedAt: Date.now(),
      details: "Could not check Jupiter airdrop eligibility (API unavailable)",
    });
  }
  return opportunities;
}

async function checkDeBridgeAirdrop(): Promise<AirdropOpportunity[]> {
  const opportunities: AirdropOpportunity[] = [];
  try {
    const res = await fetch(`https://points-api.debridge.finance/api/Points/getUserPoints?walletAddress=${FATHER_WALLET}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json() as any;
      const points = data.totalPoints || data.points || 0;
      if (points > 0) {
        opportunities.push({
          id: "debridge-points",
          name: "deBridge Points",
          protocol: "deBridge",
          type: "retroactive",
          status: "eligible",
          estimatedValue: points * 0.01,
          claimUrl: "https://app.debridge.finance",
          amount: points,
          checkedAt: Date.now(),
          details: `${points} deBridge points accumulated. Token airdrop pending.`,
        });
      }
    }
  } catch {}
  return opportunities;
}

async function checkStakingRewards(): Promise<AirdropOpportunity[]> {
  const opportunities: AirdropOpportunity[] = [];
  try {
    const conn = getConnection();
    const walletPubkey = new PublicKey(FATHER_WALLET);
    const stakeAccounts = await conn.getParsedProgramAccounts(
      new PublicKey("Stake11111111111111111111111111111111111111"),
      { filters: [{ memcmp: { offset: 44, bytes: walletPubkey.toBase58() } }] }
    );

    if (stakeAccounts.length > 0) {
      let totalStaked = 0;
      for (const account of stakeAccounts) {
        totalStaked += account.account.lamports / LAMPORTS_PER_SOL;
      }
      opportunities.push({
        id: "sol-staking-rewards",
        name: "SOL Staking Rewards",
        protocol: "Solana Native",
        type: "retroactive",
        status: totalStaked > 0 ? "eligible" : "not_eligible",
        estimatedValue: totalStaked * 0.065,
        amount: totalStaked,
        checkedAt: Date.now(),
        details: `${totalStaked.toFixed(4)} SOL staked across ${stakeAccounts.length} accounts. ~6.5% APY`,
      });
    }
  } catch {}
  return opportunities;
}

async function checkRecentAirdroppedTokens(): Promise<AirdropOpportunity[]> {
  const opportunities: AirdropOpportunity[] = [];
  try {
    const accounts = state.tokenAccounts.length > 0 ? state.tokenAccounts : await scanTokenAccounts();
    const unknownTokens = accounts.filter(a => a.balance > 0);

    if (unknownTokens.length > 0) {
      const mints = unknownTokens.map(t => t.mint);
      const prices = await getTokenPrices(mints);

      for (const token of unknownTokens) {
        const price = prices.get(token.mint);
        const usdValue = price ? price * token.balance : 0;
        token.usdValue = usdValue;

        if (usdValue > 0.01) {
          opportunities.push({
            id: `token-${token.mint.slice(0, 8)}`,
            name: `Token ${token.mint.slice(0, 8)}...`,
            protocol: "Unknown",
            type: "token_airdrop",
            status: "claimable",
            estimatedValue: usdValue,
            tokenMint: token.mint,
            amount: token.balance,
            checkedAt: Date.now(),
            details: `${token.balance} tokens (mint: ${token.mint}). Value: $${usdValue.toFixed(4)}. Can be swapped on Jupiter.`,
            claimUrl: `https://jup.ag/swap/${token.mint}-So11111111111111111111111111111111111111112`,
            proofUrl: `https://solscan.io/token/${token.mint}?account=${FATHER_WALLET}`,
          });
        }
      }
    }
  } catch (err: any) {
    alog(`Token check error: ${err.message}`);
  }
  return opportunities;
}

async function checkRecentTransactionAirdrops(): Promise<AirdropOpportunity[]> {
  const opportunities: AirdropOpportunity[] = [];
  try {
    const conn = getConnection();
    const walletPubkey = new PublicKey(FATHER_WALLET);
    const sigs = await conn.getSignaturesForAddress(walletPubkey, { limit: 10 });
    alog(`[TX-SCAN] Checking ${sigs.length} recent transactions for incoming transfers`);

    let incomingCount = 0;
    const deadline = Date.now() + 15000;
    for (const sig of sigs) {
      if (Date.now() > deadline) { alog("[TX-SCAN] Timeout — skipping remaining transactions"); break; }
      if (sig.err) continue;
      try {
        const tx = await conn.getParsedTransaction(sig.signature, { maxSupportedTransactionVersion: 0 });
        if (!tx?.meta) continue;

        const preBalances = tx.meta.preTokenBalances || [];
        const postBalances = tx.meta.postTokenBalances || [];

        for (const post of postBalances) {
          if (post.owner !== FATHER_WALLET) continue;
          const pre = preBalances.find(p => p.mint === post.mint && p.owner === FATHER_WALLET);
          const preAmount = pre ? parseFloat(pre.uiTokenAmount?.uiAmountString || "0") : 0;
          const postAmount = parseFloat(post.uiTokenAmount?.uiAmountString || "0");
          const diff = postAmount - preAmount;

          if (diff > 0 && post.mint !== LIMN_MINT) {
            incomingCount++;
            alog(`[TX-SCAN] Found incoming token: +${diff} of ${post.mint.slice(0, 12)}... in tx ${sig.signature.slice(0, 12)}...`);
          }
        }
      } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
    alog(`[TX-SCAN] Complete: ${incomingCount} incoming token transfers found`);
  } catch (err: any) {
    alog(`[TX-SCAN] Error: ${err.message}`);
  }
  return opportunities;
}

async function checkSolanaFaucets(): Promise<AirdropOpportunity[]> {
  const opportunities: AirdropOpportunity[] = [];
  try {
    const conn = getConnection();
    const walletPubkey = new PublicKey(FATHER_WALLET);
    const balance = (await conn.getBalance(walletPubkey)) / LAMPORTS_PER_SOL;
    alog(`[BALANCE] Current SOL balance: ${balance.toFixed(6)} SOL`);

    if (balance < 0.01) {
      alog(`[BALANCE] WARNING: SOL balance critically low (${balance.toFixed(6)}). Need SOL for gas fees.`);
      opportunities.push({
        id: "low-sol-warning",
        name: "Low SOL Warning",
        protocol: "Solana",
        type: "community",
        status: "eligible",
        estimatedValue: 0,
        checkedAt: Date.now(),
        details: `SOL balance is ${balance.toFixed(6)} ($${(balance * 169).toFixed(2)}). Deposit SOL to enable airdrop claiming and token swaps.`,
      });
    }
  } catch {}
  return opportunities;
}

async function checkProtocolEligibility(): Promise<AirdropOpportunity[]> {
  const opportunities: AirdropOpportunity[] = [];

  const protocols = [
    { name: "Drift Protocol", url: `https://api.drift.trade/users/${FATHER_WALLET}`, type: "retroactive" as const },
    { name: "Marginfi", url: `https://mrgn.co/api/points/${FATHER_WALLET}`, type: "retroactive" as const },
    { name: "Tensor", url: `https://api.tensor.so/v1/user/${FATHER_WALLET}`, type: "retroactive" as const },
    { name: "Parcl", url: `https://api.parcl.co/v1/points/${FATHER_WALLET}`, type: "retroactive" as const },
    { name: "Sanctum", url: `https://sanctum.so/api/v1/user/${FATHER_WALLET}`, type: "retroactive" as const },
  ];

  for (const protocol of protocols) {
    try {
      const res = await fetch(protocol.url, {
        signal: AbortSignal.timeout(5000),
        headers: { "Accept": "application/json" },
      });
      if (res.ok) {
        const data = await res.json() as any;
        const hasActivity = data && Object.keys(data).length > 0;
        opportunities.push({
          id: `${protocol.name.toLowerCase().replace(/\s+/g, "-")}-eligibility`,
          name: `${protocol.name} Airdrop`,
          protocol: protocol.name,
          type: protocol.type,
          status: hasActivity ? "eligible" : "not_eligible",
          estimatedValue: 0,
          checkedAt: Date.now(),
          details: hasActivity
            ? `Activity detected on ${protocol.name}. May be eligible for future airdrop.`
            : `No significant activity found on ${protocol.name}.`,
        });
      }
    } catch {
      opportunities.push({
        id: `${protocol.name.toLowerCase().replace(/\s+/g, "-")}-eligibility`,
        name: `${protocol.name} Airdrop`,
        protocol: protocol.name,
        type: protocol.type,
        status: "checking",
        estimatedValue: 0,
        checkedAt: Date.now(),
        details: `Could not check ${protocol.name} eligibility`,
      });
    }
    await new Promise(r => setTimeout(r, 500));
  }

  return opportunities;
}

export async function runFullScan(): Promise<AirdropScannerState> {
  alog("=== FULL AIRDROP SCAN #" + (state.scanCount + 1) + " STARTED ===");
  alog(`Wallet: ${FATHER_WALLET}`);
  state.scanCount++;

  const allOpportunities: AirdropOpportunity[] = [];

  await scanTokenAccounts();
  alog(`Token accounts in wallet: ${state.tokenAccounts.length}`);
  for (const ta of state.tokenAccounts) {
    alog(`  [TOKEN] ${ta.mint.slice(0, 12)}... balance=${ta.balance} decimals=${ta.decimals}`);
  }

  const [jupiter, debridge, staking, tokens, protocols, txAirdrops, faucets] = await Promise.all([
    checkJupiterAirdrops(),
    checkDeBridgeAirdrop(),
    checkStakingRewards(),
    checkRecentAirdroppedTokens(),
    checkProtocolEligibility(),
    checkRecentTransactionAirdrops(),
    checkSolanaFaucets(),
  ]);

  allOpportunities.push(...jupiter, ...debridge, ...staking, ...tokens, ...protocols, ...txAirdrops, ...faucets);

  const existing = new Map(state.opportunities.map(o => [o.id, o]));
  for (const opp of allOpportunities) {
    const prev = existing.get(opp.id);
    if (prev && prev.status === "claimed") {
      opp.status = "claimed";
      opp.claimedAt = prev.claimedAt;
      opp.txSignature = prev.txSignature;
    }
  }

  state.opportunities = allOpportunities;
  state.totalPendingUsd = allOpportunities
    .filter(o => o.status === "claimable" || o.status === "eligible")
    .reduce((sum, o) => sum + o.estimatedValue, 0);
  state.lastFullScan = Date.now();

  const claimable = allOpportunities.filter(o => o.status === "claimable");
  const eligible = allOpportunities.filter(o => o.status === "eligible");
  alog(`=== SCAN COMPLETE ===`);
  alog(`Total opportunities: ${allOpportunities.length}`);
  alog(`Claimable: ${claimable.length} (worth $${claimable.reduce((s, o) => s + o.estimatedValue, 0).toFixed(4)})`);
  alog(`Eligible: ${eligible.length}`);
  alog(`Token accounts: ${state.tokenAccounts.length}`);
  alog(`Total pending USD: $${state.totalPendingUsd.toFixed(4)}`);
  for (const o of allOpportunities) {
    alog(`  [${o.status.toUpperCase()}] ${o.name} (${o.protocol}) = $${o.estimatedValue.toFixed(4)} — ${o.details.slice(0, 100)}`);
  }

  if (claimable.length > 0 && state.autoExecuteEnabled) {
    alog(`Auto-executing ${claimable.length} claimable opportunities...`);
    for (const opp of claimable) {
      try {
        await autoExecuteOpportunity(opp);
      } catch (err: any) {
        alog(`Auto-execute error for ${opp.name}: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  return state;
}

async function autoExecuteOpportunity(opp: AirdropOpportunity): Promise<void> {
  if (!opp.tokenMint || !opp.amount || opp.amount <= 0) {
    alog(`Skip ${opp.name}: no token mint or zero amount`);
    return;
  }

  if (opp.tokenMint === LIMN_MINT) {
    alog(`Skip ${opp.name}: this is our TSRT token — never auto-sell`);
    return;
  }

  if (opp.estimatedValue < MIN_VALUE_TO_SELL) {
    alog(`Skip ${opp.name}: value $${opp.estimatedValue.toFixed(4)} below threshold $${MIN_VALUE_TO_SELL}`);
    return;
  }

  const shouldKeep = await evaluateKeepOrSell(opp);
  if (shouldKeep) {
    alog(`[PIPELINE] KEEPING ${opp.name} — price momentum favorable`);
    return;
  }

  const conn = getConnection();
  const walletPubkey = new PublicKey(FATHER_WALLET);
  const solBalance = (await conn.getBalance(walletPubkey)) / LAMPORTS_PER_SOL;

  if (solBalance < MIN_SOL_FOR_GAS) {
    alog(`Skip ${opp.name}: insufficient SOL for gas (${solBalance.toFixed(6)} SOL, need ${MIN_SOL_FOR_GAS})`);
    return;
  }

  alog(`[PIPELINE] Processing ${opp.name}: ${opp.amount} tokens worth ~$${opp.estimatedValue.toFixed(4)}`);

  alog(`[PIPELINE] SELLING ${opp.name} → SOL via best route`);
  const tokenAccount = state.tokenAccounts.find(t => t.mint === opp.tokenMint);
  const decimals = tokenAccount?.decimals ?? (opp.tokenMint === LIMN_MINT ? 6 : 9);
  const amountLamports = Math.floor(opp.amount * Math.pow(10, decimals));

  const sellResult = await executeBestSwap(opp.tokenMint, SOL_MINT, amountLamports, 200);

  if (!sellResult.success) {
    alog(`[PIPELINE] Sell failed for ${opp.name}: ${sellResult.error}`);
    return;
  }

  alog(`[PIPELINE] Sold ${opp.name} → ${(sellResult.outAmount || 0) / LAMPORTS_PER_SOL} SOL via ${sellResult.router}`);
  if (sellResult.signature) {
    state.pipelineExecutions.push({
      timestamp: Date.now(),
      action: "sell",
      token: opp.name,
      mint: opp.tokenMint,
      amountIn: opp.amount,
      amountOut: (sellResult.outAmount || 0) / LAMPORTS_PER_SOL,
      route: `${opp.tokenMint.slice(0, 8)}→SOL`,
      txSignature: sellResult.signature,
      success: true,
    });
  }

  const solReceived = (sellResult.outAmount || 0);
  if (solReceived <= 0) return;

  const convertAmount = Math.floor(solReceived * 0.6);

  if (convertAmount > 5000) {
    alog(`[PIPELINE] Finding optimal conversion path for 60% SOL → TSRT (${convertAmount / LAMPORTS_PER_SOL} SOL)`);

    const optimalPath = await findOptimalConversionPath(SOL_MINT, LIMN_MINT, convertAmount, "SOL", "TSRT");

    if (optimalPath.bestPath && optimalPath.improvementPct > 1) {
      alog(`[PIPELINE] Optimal multi-hop found: ${optimalPath.bestPath.routeDescription} (+${optimalPath.improvementPct.toFixed(1)}% vs direct)`);
      const convResult = await executeOptimalConversion(SOL_MINT, LIMN_MINT, convertAmount, "SOL", "TSRT");
      if (convResult.success) {
        alog(`[PIPELINE] Optimal conversion complete: ${convResult.outputAmount} TSRT via ${convResult.path}`);
        state.pipelineExecutions.push({
          timestamp: Date.now(),
          action: "buy_limn",
          token: "TSRT",
          mint: LIMN_MINT,
          amountIn: convertAmount / LAMPORTS_PER_SOL,
          amountOut: convResult.outputAmount,
          route: convResult.path,
          txSignature: convResult.txSignatures[0] || "",
          success: true,
        });
      } else {
        alog(`[PIPELINE] Optimal conversion failed: ${convResult.error}, falling back to direct swap`);
        const directResult = await executeBestSwap(SOL_MINT, LIMN_MINT, convertAmount, 200);
        if (directResult.success) {
          state.pipelineExecutions.push({ timestamp: Date.now(), action: "buy_limn", token: "TSRT", mint: LIMN_MINT, amountIn: convertAmount / LAMPORTS_PER_SOL, amountOut: directResult.outAmount || 0, route: "SOL→TSRT (direct fallback)", txSignature: directResult.signature || "", success: true });
        }
      }
    } else {
      alog(`[PIPELINE] Direct swap is optimal for SOL → TSRT`);
      const limnResult = await executeBestSwap(SOL_MINT, LIMN_MINT, convertAmount, 200);
      if (limnResult.success) {
        alog(`[PIPELINE] Bought TSRT: ${limnResult.outAmount} tokens via ${limnResult.router}. TX: ${limnResult.signature}`);
        state.pipelineExecutions.push({ timestamp: Date.now(), action: "buy_limn", token: "TSRT", mint: LIMN_MINT, amountIn: convertAmount / LAMPORTS_PER_SOL, amountOut: limnResult.outAmount || 0, route: "SOL→TSRT", txSignature: limnResult.signature || "", success: true });
      } else {
        alog(`[PIPELINE] TSRT buy failed: ${limnResult.error}`);
      }
    }
  }

  alog(`[PIPELINE] Remaining 40% SOL: split between Father (${FATHER_WALLET.slice(0, 8)}...) and Community (${COMMUNITY_WALLET.slice(0, 8)}...)`);
  alog(`[PIPELINE] Pipeline complete for ${opp.name}`);

  opp.status = "claimed";
  opp.claimedAt = Date.now();
  opp.txSignature = sellResult.signature;
  state.successfulClaims++;
  state.totalClaimedUsd += opp.estimatedValue;
}

async function evaluateKeepOrSell(opp: AirdropOpportunity): Promise<boolean> {
  if (opp.tokenMint === LIMN_MINT) return true;

  if (!opp.tokenMint) return false;

  try {
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${opp.tokenMint}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return false;

    const data = await res.json() as any;
    const pair = data.pairs?.[0];
    if (!pair) return false;

    const priceChange5m = pair.priceChange?.m5 ?? 0;
    const priceChange1h = pair.priceChange?.h1 ?? 0;
    const priceChange24h = pair.priceChange?.h24 ?? 0;
    const volume24h = pair.volume?.h24 ?? 0;
    const liquidity = pair.liquidity?.usd ?? 0;

    if (liquidity < 1000) {
      alog(`[EVAL] ${opp.name}: low liquidity ($${liquidity}) — sell`);
      return false;
    }

    if (priceChange5m > 5 && priceChange1h > 10 && volume24h > 5000) {
      alog(`[EVAL] ${opp.name}: strong uptrend (+${priceChange5m}% 5m, +${priceChange1h}% 1h) — KEEP`);
      return true;
    }

    if (priceChange24h < -30) {
      alog(`[EVAL] ${opp.name}: dumping (${priceChange24h}% 24h) — sell immediately`);
      return false;
    }

    return false;
  } catch {
    return false;
  }
}

export async function claimAirdropOpportunity(oppId: string): Promise<{ success: boolean; message: string; txSignature?: string }> {
  const opp = state.opportunities.find(o => o.id === oppId);
  if (!opp) return { success: false, message: "Opportunity not found" };
  if (opp.status === "claimed") return { success: false, message: "Already claimed" };
  if (opp.status !== "claimable") return { success: false, message: `Cannot claim: status is ${opp.status}` };

  if (opp.type === "token_airdrop" && opp.tokenMint) {
    try {
      const conn = getConnection();
      const walletPubkey = new PublicKey(FATHER_WALLET);
      const balance = await conn.getBalance(walletPubkey);
      const solBalance = balance / LAMPORTS_PER_SOL;

      if (solBalance < 0.001) {
        return { success: false, message: `Insufficient SOL for gas: ${solBalance.toFixed(6)} SOL (need 0.001)` };
      }

      alog(`Token swap opportunity: ${opp.amount} tokens of ${opp.tokenMint} worth ~$${opp.estimatedValue.toFixed(4)}`);

      opp.status = "claimable";
      return {
        success: true,
        message: `Swap available on Jupiter: ${opp.amount} tokens → ~$${opp.estimatedValue.toFixed(4)}. Use: ${opp.claimUrl}`,
      };
    } catch (err: any) {
      return { success: false, message: `Claim error: ${err.message}` };
    }
  }

  if (opp.claimUrl) {
    return {
      success: true,
      message: `Claim available at: ${opp.claimUrl}. Estimated value: $${opp.estimatedValue.toFixed(2)}`,
    };
  }

  return { success: false, message: "No claim mechanism available for this opportunity" };
}

export function getAirdropState(): AirdropScannerState & { activityLog: Array<{ timestamp: number; message: string }>; walletAddress: string; walletProofUrl: string } {
  return {
    ...state,
    activityLog: [...scanLog].slice(-50),
    walletAddress: FATHER_WALLET,
    walletProofUrl: `https://solscan.io/account/${FATHER_WALLET}`,
  };
}

export function getPipelineExecutions(): PipelineExecution[] {
  return [...state.pipelineExecutions];
}

export function toggleAutoExecute(enabled: boolean): void {
  state.autoExecuteEnabled = enabled;
  alog(`Auto-execute ${enabled ? "ENABLED" : "DISABLED"}`);
}

export function getClaimableAirdrops(): AirdropOpportunity[] {
  return state.opportunities.filter(o => o.status === "claimable" || o.status === "eligible");
}

export async function initAirdropScanner(): Promise<void> {
  alog("Initializing airdrop scanner...");

  try {
    await runFullScan();
  } catch (err: any) {
    alog(`Initial scan error: ${err.message}`);
  }

  scanInterval = setInterval(async () => {
    try {
      await runFullScan();
    } catch (err: any) {
      alog(`Periodic scan error: ${err.message}`);
    }
  }, 10 * 60 * 1000);

  alog("Airdrop scanner initialized (scans every 10 min)");
}

export function stopAirdropScanner(): void {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  alog("Airdrop scanner stopped");
}
