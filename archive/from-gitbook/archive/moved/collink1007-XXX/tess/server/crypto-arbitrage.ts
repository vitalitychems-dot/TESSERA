import { Router, Request, Response } from "express";
import axios from "axios";

const router = Router();

interface CryptoOpp {
  id: string;
  coin: string;
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  spread: number;
  spreadPct: number;
  volume24h: number;
  profit: number;
  buyUrl: string;
  sellUrl: string;
  timestamp: number;
}

const EXCHANGE_URLS: Record<string, string> = {
  binance: "https://www.binance.com/en/trade",
  coinbase: "https://www.coinbase.com/price",
  kraken: "https://www.kraken.com/prices",
  kucoin: "https://www.kucoin.com/price",
  bybit: "https://www.bybit.com/en/coin-price",
  gate_io: "https://www.gate.io/trade",
  bitfinex: "https://trading.bitfinex.com",
  huobi: "https://www.htx.com/price",
  okx: "https://www.okx.com/prices",
  mexc: "https://www.mexc.com/price",
};

let cachedOpps: CryptoOpp[] = [];
let lastScan = 0;
let apiSourceIndex = 0;

const FREE_CRYPTO_APIS = [
  { name: "jupiter", url: "https://api.jup.ag/price/v2" },
  { name: "coinpaprika", url: "https://api.coinpaprika.com/v1" },
];

async function fetchCoinGeckoPrices(): Promise<any[]> {
  try {
    const res = await axios.get(`${FREE_CRYPTO_APIS[0].url}/coins/markets`, {
      params: { vs_currency: "usd", order: "market_cap_desc", per_page: 50, page: 1, sparkline: false },
      timeout: 15000,
    });
    return res.data || [];
  } catch (err: any) {
    console.log(`[CryptoArb] CoinGecko error: ${err.message}`);
    return [];
  }
}

async function fetchExchangePrices(coinId: string): Promise<{ exchange: string; price: number; volume: number }[]> {
  try {
    const res = await axios.get(`${FREE_CRYPTO_APIS[0].url}/coins/${coinId}/tickers`, {
      params: { include_exchange_logo: false },
      timeout: 10000,
    });
    const tickers = res.data?.tickers || [];
    const seen = new Set<string>();
    return tickers
      .filter((t: any) => t.target === "USDT" || t.target === "USD")
      .filter((t: any) => {
        const ex = t.market?.identifier;
        if (seen.has(ex)) return false;
        seen.add(ex);
        return true;
      })
      .map((t: any) => ({
        exchange: t.market?.identifier || "unknown",
        price: t.last || 0,
        volume: t.volume || 0,
      }))
      .slice(0, 15);
  } catch {
    return [];
  }
}

function findCryptoArbs(coin: any, prices: { exchange: string; price: number; volume: number }[], investment: number): CryptoOpp[] {
  const opps: CryptoOpp[] = [];
  for (let i = 0; i < prices.length; i++) {
    for (let j = 0; j < prices.length; j++) {
      if (i === j) continue;
      const buy = prices[i];
      const sell = prices[j];
      if (sell.price > buy.price) {
        const spreadPct = ((sell.price - buy.price) / buy.price) * 100;
        if (spreadPct > 0.3) {
          const profit = investment * (spreadPct / 100);
          opps.push({
            id: `${coin.symbol}-${buy.exchange}-${sell.exchange}`,
            coin: coin.name,
            symbol: coin.symbol?.toUpperCase(),
            buyExchange: buy.exchange,
            sellExchange: sell.exchange,
            buyPrice: buy.price,
            sellPrice: sell.price,
            spread: sell.price - buy.price,
            spreadPct: Math.round(spreadPct * 100) / 100,
            volume24h: Math.min(buy.volume, sell.volume),
            profit: Math.round(profit * 100) / 100,
            buyUrl: EXCHANGE_URLS[buy.exchange] || `https://www.google.com/search?q=${buy.exchange}+exchange`,
            sellUrl: EXCHANGE_URLS[sell.exchange] || `https://www.google.com/search?q=${sell.exchange}+exchange`,
            timestamp: Date.now(),
          });
        }
      }
    }
  }
  return opps;
}

router.post("/scan", async (req: Request, res: Response) => {
  try {
    const { coins, investment = 1000 } = req.body;
    const allOpps: CryptoOpp[] = [];

    const topCoins = await fetchCoinGeckoPrices();
    const coinsToScan = coins
      ? topCoins.filter((c: any) => coins.includes(c.id) || coins.includes(c.symbol))
      : topCoins.slice(0, 10);

    for (const coin of coinsToScan.slice(0, 8)) {
      const prices = await fetchExchangePrices(coin.id);
      const opps = findCryptoArbs(coin, prices, investment);
      allOpps.push(...opps);
      await new Promise(r => setTimeout(r, 1200));
    }

    cachedOpps = allOpps.sort((a, b) => b.spreadPct - a.spreadPct);
    lastScan = Date.now();

    res.json({
      opportunities: cachedOpps.slice(0, 30),
      totalFound: cachedOpps.length,
      coinsScanned: coinsToScan.length,
      investment,
      lastScan,
      exchanges: Object.keys(EXCHANGE_URLS),
    });
  } catch (error: any) {
    console.error("[CryptoArb] Scan error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get("/opportunities", (_req: Request, res: Response) => {
  res.json({ opportunities: cachedOpps, lastScan, exchanges: Object.keys(EXCHANGE_URLS) });
});

router.get("/prices/:coinId", async (req: Request, res: Response) => {
  try {
    const prices = await fetchExchangePrices(req.params.coinId);
    res.json({ coinId: req.params.coinId, prices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
