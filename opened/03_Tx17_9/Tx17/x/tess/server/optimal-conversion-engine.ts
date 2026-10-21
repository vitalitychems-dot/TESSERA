import axios from "axios";
import { fetchJupiterQuote, executeBestSwap } from "./arbitrage-engine";

const olog = (m: string) => console.log(`[OptimalConvert] ${m}`);

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const LIMN_MINT = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";
const RAY_MINT = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R";
const JUP_MINT = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const BONK_MINT = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";

const INTERMEDIATE_TOKENS = [
  { symbol: "SOL", mint: SOL_MINT, decimals: 9 },
  { symbol: "USDC", mint: USDC_MINT, decimals: 6 },
  { symbol: "USDT", mint: USDT_MINT, decimals: 6 },
  { symbol: "RAY", mint: RAY_MINT, decimals: 6 },
  { symbol: "JUP", mint: JUP_MINT, decimals: 6 },
  { symbol: "BONK", mint: BONK_MINT, decimals: 5 },
];

interface ConversionPath {
  id: string;
  hops: Array<{ from: string; to: string; fromMint: string; toMint: string; outAmount: number; priceImpact: number }>;
  totalHops: number;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  finalOutputAmount: number;
  effectiveRate: number;
  estimatedSlippage: number;
  routeDescription: string;
  advantage: number;
  timestamp: number;
}

interface ConversionResult {
  bestPath: ConversionPath | null;
  allPaths: ConversionPath[];
  directQuote: number;
  bestMultiHop: number;
  improvementPct: number;
  timestamp: number;
}

interface ArbitrageLoop {
  id: string;
  path: string[];
  mints: string[];
  profitPct: number;
  estimatedProfitLamports: number;
  timestamp: number;
  confidence: number;
}

const conversionHistory: ConversionResult[] = [];
const detectedLoops: ArbitrageLoop[] = [];

async function getJupiterMultiQuote(inputMint: string, outputMint: string, amount: number, slippage: number = 100): Promise<{ outAmount: number; priceImpact: number; route: string } | null> {
  try {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippage}&onlyDirectRoutes=false&maxAccounts=64`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json() as any;
    if (!data.outAmount) return null;
    const routeLabels = (data.routePlan || []).map((r: any) => r.swapInfo?.label || "?").join("→");
    return {
      outAmount: parseInt(data.outAmount),
      priceImpact: parseFloat(data.priceImpactPct || "0"),
      route: routeLabels || "direct",
    };
  } catch {
    return null;
  }
}

export async function findOptimalConversionPath(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  inputSymbol: string = "TOKEN",
  outputSymbol: string = "TSRT"
): Promise<ConversionResult> {
  olog(`Finding optimal path: ${inputSymbol} → ${outputSymbol} (amount: ${amountLamports})`);
  const paths: ConversionPath[] = [];

  const directQuote = await getJupiterMultiQuote(inputMint, outputMint, amountLamports);
  const directOut = directQuote?.outAmount || 0;

  if (directOut > 0) {
    paths.push({
      id: `direct-${inputSymbol}-${outputSymbol}`,
      hops: [{ from: inputSymbol, to: outputSymbol, fromMint: inputMint, toMint: outputMint, outAmount: directOut, priceImpact: directQuote!.priceImpact }],
      totalHops: 1,
      inputMint, outputMint, inputAmount: amountLamports,
      finalOutputAmount: directOut,
      effectiveRate: directOut / amountLamports,
      estimatedSlippage: directQuote!.priceImpact,
      routeDescription: `${inputSymbol} → ${outputSymbol} (${directQuote!.route})`,
      advantage: 0,
      timestamp: Date.now(),
    });
  }

  const intermediates = INTERMEDIATE_TOKENS.filter(t => t.mint !== inputMint && t.mint !== outputMint);

  const hop1Promises = intermediates.map(async (inter) => {
    const q1 = await getJupiterMultiQuote(inputMint, inter.mint, amountLamports);
    if (!q1 || q1.outAmount <= 0) return null;

    const q2 = await getJupiterMultiQuote(inter.mint, outputMint, q1.outAmount);
    if (!q2 || q2.outAmount <= 0) return null;

    return {
      intermediate: inter,
      hop1Out: q1.outAmount,
      hop1Impact: q1.priceImpact,
      hop1Route: q1.route,
      hop2Out: q2.outAmount,
      hop2Impact: q2.priceImpact,
      hop2Route: q2.route,
      finalOut: q2.outAmount,
    };
  });

  const hop1Results = (await Promise.all(hop1Promises)).filter(Boolean);

  for (const r of hop1Results) {
    if (!r) continue;
    const improvement = directOut > 0 ? ((r.finalOut - directOut) / directOut) * 100 : 0;
    paths.push({
      id: `2hop-${inputSymbol}-${r.intermediate.symbol}-${outputSymbol}`,
      hops: [
        { from: inputSymbol, to: r.intermediate.symbol, fromMint: inputMint, toMint: r.intermediate.mint, outAmount: r.hop1Out, priceImpact: r.hop1Impact },
        { from: r.intermediate.symbol, to: outputSymbol, fromMint: r.intermediate.mint, toMint: outputMint, outAmount: r.hop2Out, priceImpact: r.hop2Impact },
      ],
      totalHops: 2,
      inputMint, outputMint, inputAmount: amountLamports,
      finalOutputAmount: r.finalOut,
      effectiveRate: r.finalOut / amountLamports,
      estimatedSlippage: r.hop1Impact + r.hop2Impact,
      routeDescription: `${inputSymbol} → ${r.intermediate.symbol} (${r.hop1Route}) → ${outputSymbol} (${r.hop2Route})`,
      advantage: improvement,
      timestamp: Date.now(),
    });
  }

  const topIntermediates = hop1Results
    .filter(Boolean)
    .sort((a, b) => (b?.finalOut || 0) - (a?.finalOut || 0))
    .slice(0, 3);

  for (const first of topIntermediates) {
    if (!first) continue;
    const secondHopIntermediates = INTERMEDIATE_TOKENS.filter(
      t => t.mint !== inputMint && t.mint !== outputMint && t.mint !== first.intermediate.mint
    );

    for (const second of secondHopIntermediates.slice(0, 3)) {
      try {
        const q2 = await getJupiterMultiQuote(first.intermediate.mint, second.mint, first.hop1Out);
        if (!q2 || q2.outAmount <= 0) continue;

        const q3 = await getJupiterMultiQuote(second.mint, outputMint, q2.outAmount);
        if (!q3 || q3.outAmount <= 0) continue;

        const improvement = directOut > 0 ? ((q3.outAmount - directOut) / directOut) * 100 : 0;
        paths.push({
          id: `3hop-${inputSymbol}-${first.intermediate.symbol}-${second.symbol}-${outputSymbol}`,
          hops: [
            { from: inputSymbol, to: first.intermediate.symbol, fromMint: inputMint, toMint: first.intermediate.mint, outAmount: first.hop1Out, priceImpact: first.hop1Impact },
            { from: first.intermediate.symbol, to: second.symbol, fromMint: first.intermediate.mint, toMint: second.mint, outAmount: q2.outAmount, priceImpact: q2.priceImpact },
            { from: second.symbol, to: outputSymbol, fromMint: second.mint, toMint: outputMint, outAmount: q3.outAmount, priceImpact: q3.priceImpact },
          ],
          totalHops: 3,
          inputMint, outputMint, inputAmount: amountLamports,
          finalOutputAmount: q3.outAmount,
          effectiveRate: q3.outAmount / amountLamports,
          estimatedSlippage: first.hop1Impact + q2.priceImpact + q3.priceImpact,
          routeDescription: `${inputSymbol} → ${first.intermediate.symbol} → ${second.symbol} → ${outputSymbol}`,
          advantage: improvement,
          timestamp: Date.now(),
        });
      } catch {}
    }
  }

  paths.sort((a, b) => b.finalOutputAmount - a.finalOutputAmount);

  const bestPath = paths[0] || null;
  const bestMultiHop = paths.find(p => p.totalHops > 1)?.finalOutputAmount || 0;
  const improvementPct = directOut > 0 && bestMultiHop > directOut
    ? ((bestMultiHop - directOut) / directOut) * 100
    : 0;

  const result: ConversionResult = {
    bestPath,
    allPaths: paths.slice(0, 10),
    directQuote: directOut,
    bestMultiHop,
    improvementPct,
    timestamp: Date.now(),
  };

  if (bestPath) {
    olog(`Best path: ${bestPath.routeDescription} → ${bestPath.finalOutputAmount} output`);
    if (improvementPct > 0) {
      olog(`Multi-hop advantage: +${improvementPct.toFixed(2)}% over direct route`);
    }
  }

  conversionHistory.push(result);
  if (conversionHistory.length > 100) conversionHistory.splice(0, conversionHistory.length - 100);

  return result;
}

export async function findDEXArbitrageLoops(startMint: string = SOL_MINT, amountLamports: number = 100_000_000): Promise<ArbitrageLoop[]> {
  olog(`Scanning DEX triangular arbitrage loops from ${startMint === SOL_MINT ? "SOL" : startMint.slice(0, 8)}...`);
  const loops: ArbitrageLoop[] = [];
  const startSymbol = INTERMEDIATE_TOKENS.find(t => t.mint === startMint)?.symbol || "TOKEN";

  const midTokens = INTERMEDIATE_TOKENS.filter(t => t.mint !== startMint);

  for (const mid of midTokens) {
    const q1 = await getJupiterMultiQuote(startMint, mid.mint, amountLamports);
    if (!q1 || q1.outAmount <= 0) continue;

    const endTokens = INTERMEDIATE_TOKENS.filter(t => t.mint !== startMint && t.mint !== mid.mint);
    for (const end of endTokens) {
      try {
        const q2 = await getJupiterMultiQuote(mid.mint, end.mint, q1.outAmount);
        if (!q2 || q2.outAmount <= 0) continue;

        const q3 = await getJupiterMultiQuote(end.mint, startMint, q2.outAmount);
        if (!q3 || q3.outAmount <= 0) continue;

        const profitPct = ((q3.outAmount - amountLamports) / amountLamports) * 100;
        if (profitPct > -5) {
          loops.push({
            id: `loop-${startSymbol}-${mid.symbol}-${end.symbol}`,
            path: [startSymbol, mid.symbol, end.symbol, startSymbol],
            mints: [startMint, mid.mint, end.mint, startMint],
            profitPct: Math.round(profitPct * 1000) / 1000,
            estimatedProfitLamports: q3.outAmount - amountLamports,
            timestamp: Date.now(),
            confidence: profitPct > 0.5 ? 0.8 : profitPct > 0 ? 0.5 : 0.2,
          });
        }
      } catch {}
    }
  }

  loops.sort((a, b) => b.profitPct - a.profitPct);

  const profitable = loops.filter(l => l.profitPct > 0);
  olog(`Found ${loops.length} loops, ${profitable.length} profitable`);
  for (const l of profitable.slice(0, 5)) {
    olog(`  ${l.path.join("→")} = +${l.profitPct.toFixed(3)}%`);
  }

  detectedLoops.push(...loops);
  if (detectedLoops.length > 500) detectedLoops.splice(0, detectedLoops.length - 500);

  return loops;
}

export async function executeOptimalConversion(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  inputSymbol: string = "TOKEN",
  outputSymbol: string = "TSRT"
): Promise<{ success: boolean; path: string; outputAmount: number; router: string; txSignatures: string[]; error?: string }> {
  const result = await findOptimalConversionPath(inputMint, outputMint, amountLamports, inputSymbol, outputSymbol);

  if (!result.bestPath) {
    return { success: false, path: "none", outputAmount: 0, router: "none", txSignatures: [], error: "No conversion path found" };
  }

  const best = result.bestPath;

  if (best.totalHops === 1) {
    olog(`Executing direct swap: ${best.routeDescription}`);
    const swapResult = await executeBestSwap(inputMint, outputMint, amountLamports, 150);
    return {
      success: swapResult.success,
      path: best.routeDescription,
      outputAmount: swapResult.outAmount || 0,
      router: swapResult.router,
      txSignatures: swapResult.signature ? [swapResult.signature] : [],
      error: swapResult.error,
    };
  }

  olog(`Executing multi-hop: ${best.routeDescription} (${best.totalHops} hops, +${best.advantage.toFixed(2)}% better)`);
  const txSignatures: string[] = [];
  let currentMint = inputMint;
  let currentAmount = amountLamports;

  for (let i = 0; i < best.hops.length; i++) {
    const hop = best.hops[i];
    olog(`  Hop ${i + 1}/${best.hops.length}: ${hop.from} → ${hop.to}`);
    const swapResult = await executeBestSwap(currentMint, hop.toMint, currentAmount, 200);

    if (!swapResult.success) {
      olog(`  Hop ${i + 1} failed: ${swapResult.error}`);
      return {
        success: false,
        path: best.routeDescription,
        outputAmount: 0,
        router: swapResult.router,
        txSignatures,
        error: `Hop ${i + 1} failed: ${swapResult.error}`,
      };
    }

    if (swapResult.signature) txSignatures.push(swapResult.signature);
    currentMint = hop.toMint;
    currentAmount = swapResult.outAmount || 0;
    olog(`  Hop ${i + 1} complete: received ${currentAmount}`);

    if (i < best.hops.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  olog(`Multi-hop conversion complete: ${currentAmount} ${outputSymbol} received`);
  return {
    success: true,
    path: best.routeDescription,
    outputAmount: currentAmount,
    router: "multi-hop-optimal",
    txSignatures,
  };
}

export async function scanAndConvertAirdropsToTSRT(
  tokenAccounts: Array<{ mint: string; balance: number; decimals: number; symbol?: string }>,
  minValueUSD: number = 0.01
): Promise<Array<{ token: string; mint: string; path: string; limnReceived: number; success: boolean; error?: string }>> {
  olog(`Scanning ${tokenAccounts.length} tokens for optimal TSRT conversion`);
  const results: Array<{ token: string; mint: string; path: string; limnReceived: number; success: boolean; error?: string }> = [];

  const prices = new Map<string, number>();
  const mints = tokenAccounts.map(t => t.mint).filter(m => m !== LIMN_MINT && m !== SOL_MINT);

  for (const batch of chunk(mints, 30)) {
    try {
      const res = await fetch(`https://api.jup.ag/price/v2?ids=${batch.join(",")}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json() as any;
        for (const pair of (data.pairs || [])) {
          if (pair.baseToken?.address && pair.priceUsd) {
            prices.set(pair.baseToken.address, parseFloat(pair.priceUsd));
          }
        }
      }
    } catch {}
  }

  for (const token of tokenAccounts) {
    if (token.mint === LIMN_MINT || token.mint === SOL_MINT) continue;

    const price = prices.get(token.mint) || 0;
    const valueUSD = price * token.balance;
    if (valueUSD < minValueUSD) continue;

    olog(`Processing ${token.symbol || token.mint.slice(0, 8)}: ${token.balance} tokens ($${valueUSD.toFixed(4)})`);

    const amountLamports = Math.floor(token.balance * Math.pow(10, token.decimals));
    const conversionResult = await findOptimalConversionPath(
      token.mint, LIMN_MINT, amountLamports,
      token.symbol || token.mint.slice(0, 8), "TSRT"
    );

    if (!conversionResult.bestPath) {
      results.push({ token: token.symbol || token.mint.slice(0, 8), mint: token.mint, path: "none", limnReceived: 0, success: false, error: "No path found" });
      continue;
    }

    results.push({
      token: token.symbol || token.mint.slice(0, 8),
      mint: token.mint,
      path: conversionResult.bestPath.routeDescription,
      limnReceived: conversionResult.bestPath.finalOutputAmount,
      success: true,
    });
  }

  olog(`Conversion analysis complete: ${results.filter(r => r.success).length}/${results.length} tokens have TSRT paths`);
  return results;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export function getConversionHistory(): ConversionResult[] { return [...conversionHistory]; }
export function getDetectedLoops(): ArbitrageLoop[] { return [...detectedLoops]; }

export function getOptimalConversionStats() {
  const profitable = detectedLoops.filter(l => l.profitPct > 0);
  return {
    totalPathsAnalyzed: conversionHistory.reduce((s, r) => s + r.allPaths.length, 0),
    totalConversions: conversionHistory.length,
    avgImprovement: conversionHistory.length > 0
      ? conversionHistory.reduce((s, r) => s + r.improvementPct, 0) / conversionHistory.length
      : 0,
    totalLoopsDetected: detectedLoops.length,
    profitableLoops: profitable.length,
    bestLoop: profitable[0] || null,
    intermediateTokens: INTERMEDIATE_TOKENS.map(t => t.symbol),
  };
}

olog("Optimal Conversion Engine initialized — multi-hop routing, DEX triangular arbitrage, airdrop→TSRT pipeline active");
