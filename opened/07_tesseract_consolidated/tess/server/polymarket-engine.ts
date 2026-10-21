/**
 * POLYMARKET PREDICTION MARKET ENGINE
 * ────────────────────────────────────
 * Real-time prediction market data feed, autonomous analysis,
 * and arbitrage detection from Polymarket CLOB API.
 */

const plog = (msg: string) => console.log(`[Polymarket] ${msg}`);

const POLYMARKET_API = "https://clob.polymarket.com";
const GAMMA_API = "https://gamma-api.polymarket.com";

interface PredictionMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  outcomes: string[];
  outcomePrices: number[];
  volume: number;
  volumeH24: number;
  liquidity: number;
  endDate: string;
  active: boolean;
  category: string;
  fetchedAt: number;
}

interface ArbitrageOpportunity {
  id: string;
  marketId: string;
  question: string;
  totalProbability: number;
  deviation: number;
  potentialProfit: number;
  outcomes: { name: string; price: number }[];
  detectedAt: number;
  status: "detected" | "analyzed" | "expired";
}

let cachedMarkets: PredictionMarket[] = [];
let lastMarketFetch = 0;
const MARKET_CACHE_TTL = 60000;
const arbitrageOpps: ArbitrageOpportunity[] = [];
let scanCount = 0;

async function fetchActiveMarkets(): Promise<PredictionMarket[]> {
  const now = Date.now();
  if (cachedMarkets.length > 0 && now - lastMarketFetch < MARKET_CACHE_TTL) return cachedMarkets;

  try {
    const res = await fetch(`${GAMMA_API}/markets?limit=50&active=true&order=volume&ascending=false`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      plog(`Gamma API HTTP ${res.status}`);
      return cachedMarkets;
    }

    const rawMarkets = await res.json();
    const markets: PredictionMarket[] = (rawMarkets || []).map((m: any) => ({
      id: m.id || m.condition_id || "",
      question: m.question || m.title || "",
      conditionId: m.condition_id || "",
      slug: m.slug || "",
      outcomes: m.outcomes ? (typeof m.outcomes === "string" ? JSON.parse(m.outcomes) : m.outcomes) : ["Yes", "No"],
      outcomePrices: m.outcomePrices ? (typeof m.outcomePrices === "string" ? JSON.parse(m.outcomePrices) : m.outcomePrices).map(Number) : [0, 0],
      volume: Number(m.volume || 0),
      volumeH24: Number(m.volume24hr || 0),
      liquidity: Number(m.liquidity || 0),
      endDate: m.end_date_iso || m.endDate || "",
      active: m.active !== false,
      category: m.category || "general",
      fetchedAt: now,
    }));

    cachedMarkets = markets;
    lastMarketFetch = now;
    return markets;
  } catch (err: any) {
    plog(`Market fetch error: ${err.message}`);
    return cachedMarkets;
  }
}

function detectArbitrage(markets: PredictionMarket[]): ArbitrageOpportunity[] {
  const newOpps: ArbitrageOpportunity[] = [];

  for (const market of markets) {
    if (!market.outcomePrices || market.outcomePrices.length < 2) continue;

    const totalProb = market.outcomePrices.reduce((sum, p) => sum + p, 0);
    const deviation = Math.abs(totalProb - 1.0);

    if (deviation > 0.02) {
      const opp: ArbitrageOpportunity = {
        id: `arb-${market.id}-${Date.now().toString(36)}`,
        marketId: market.id,
        question: market.question,
        totalProbability: totalProb,
        deviation,
        potentialProfit: deviation * 100,
        outcomes: market.outcomes.map((name, i) => ({
          name,
          price: market.outcomePrices[i] || 0,
        })),
        detectedAt: Date.now(),
        status: "detected",
      };
      newOpps.push(opp);
    }
  }

  if (newOpps.length > 0) {
    arbitrageOpps.push(...newOpps);
    if (arbitrageOpps.length > 200) arbitrageOpps.splice(0, arbitrageOpps.length - 200);
  }

  return newOpps;
}

export async function scanPolymarketOpportunities(): Promise<{
  marketsScanned: number;
  arbitrageFound: number;
  topOpportunities: ArbitrageOpportunity[];
}> {
  scanCount++;
  const markets = await fetchActiveMarkets();
  const newOpps = detectArbitrage(markets);

  return {
    marketsScanned: markets.length,
    arbitrageFound: newOpps.length,
    topOpportunities: newOpps.sort((a, b) => b.potentialProfit - a.potentialProfit).slice(0, 10),
  };
}

export async function getPolymarketStatus() {
  const markets = await fetchActiveMarkets();

  const topByVolume = [...markets].sort((a, b) => b.volume - a.volume).slice(0, 10);
  const categories = new Map<string, number>();
  for (const m of markets) {
    categories.set(m.category, (categories.get(m.category) || 0) + 1);
  }

  return {
    name: "Polymarket Prediction Engine",
    status: "ACTIVE",
    marketsTracked: markets.length,
    totalScanCycles: scanCount,
    arbitrageOpportunities: {
      total: arbitrageOpps.length,
      active: arbitrageOpps.filter(o => o.status === "detected").length,
      recent: arbitrageOpps.slice(-5),
    },
    topMarkets: topByVolume.map(m => ({
      question: m.question.slice(0, 100),
      volume: m.volume,
      volume24h: m.volumeH24,
      outcomes: m.outcomes.map((name, i) => ({ name, price: m.outcomePrices[i] })),
    })),
    categories: Object.fromEntries(categories),
    capabilities: [
      "Real-time Polymarket CLOB API integration",
      "Automated arbitrage detection (probability deviation > 2%)",
      "Market category analysis",
      "Volume and liquidity tracking",
      "Autonomous scanning cycles",
    ],
    integrationWithTSRT: [
      "Arbitrage profits can be converted to TSRT via Jupiter",
      "Market data feeds into Tesseract intelligence network",
      "Prediction market insights inform autonomous trading decisions",
    ],
  };
}

export async function getMarketDetails(marketId: string) {
  const markets = await fetchActiveMarkets();
  return markets.find(m => m.id === marketId || m.slug === marketId) || null;
}

plog("Polymarket Prediction Engine initialized — real-time CLOB API + arbitrage detection");
