import axios from "axios";

const log = (m: string) => console.log(`[StockData] ${m}`);

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const stockCache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string, ttl: number): T | null {
  const entry = stockCache.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) return entry.data as T;
  return null;
}

function setCache(key: string, data: any) {
  stockCache.set(key, { data, timestamp: Date.now() });
  if (stockCache.size > 500) {
    const entries = Array.from(stockCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 100; i++) stockCache.delete(entries[i][0]);
  }
}

const providerFailures = new Map<string, { count: number; cooldownUntil: number }>();
const COOLDOWN_MS = 120_000;

function isAvailable(provider: string): boolean {
  const f = providerFailures.get(provider);
  if (!f) return true;
  if (Date.now() > f.cooldownUntil) { providerFailures.delete(provider); return true; }
  return false;
}

function markFailure(provider: string) {
  const f = providerFailures.get(provider) || { count: 0, cooldownUntil: 0 };
  f.count++;
  f.cooldownUntil = Date.now() + COOLDOWN_MS * Math.min(f.count, 5);
  providerFailures.set(provider, f);
}

function markSuccess(provider: string) {
  providerFailures.delete(provider);
}

async function fetchWithRotation<T>(
  providers: { name: string; fetch: () => Promise<T> }[]
): Promise<{ data: T; source: string } | null> {
  const available = providers.filter(p => isAvailable(p.name));
  const ordered = available.length > 0 ? available : providers;
  for (const provider of ordered) {
    try {
      const data = await provider.fetch();
      markSuccess(provider.name);
      return { data, source: provider.name };
    } catch (err: any) {
      markFailure(provider.name);
      log(`${provider.name} failed: ${err.message?.substring(0, 80)}`);
    }
  }
  return null;
}

export interface StockQuote {
  ticker: string;
  price: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  eps?: number;
  dividendYield?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  name?: string;
  sector?: string;
  beta?: number;
  source: string;
  timestamp: string;
}

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockHistory {
  ticker: string;
  bars: OHLCVBar[];
  source: string;
  timestamp: string;
}

async function fetchQuoteYahooFinance(ticker: string): Promise<StockQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
  const r = await axios.get(url, {
    timeout: 10000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    },
  });
  const result = r.data?.chart?.result?.[0];
  if (!result) throw new Error("Yahoo: no result");
  const meta = result.meta;
  const price = meta.regularMarketPrice || meta.previousClose;
  if (!price) throw new Error("Yahoo: no price");
  return {
    ticker,
    price,
    open: meta.regularMarketOpen || price,
    high: meta.regularMarketDayHigh || price,
    low: meta.regularMarketDayLow || price,
    previousClose: meta.previousClose || price,
    change: price - (meta.previousClose || price),
    changePercent: ((price - (meta.previousClose || price)) / (meta.previousClose || price)) * 100,
    volume: meta.regularMarketVolume || 0,
    marketCap: meta.marketCap,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
    name: meta.shortName || meta.longName,
    source: "YahooFinance",
    timestamp: new Date().toISOString(),
  };
}

export async function fetchStockQuote(ticker: string): Promise<StockQuote | null> {
  const cacheKey = `quote-${ticker}`;
  const cached = getCached<StockQuote>(cacheKey, 60_000);
  if (cached) return cached;

  const result = await fetchWithRotation<StockQuote>([
    { name: "YahooFinance", fetch: () => fetchQuoteYahooFinance(ticker) },
  ]);

  if (result) {
    setCache(cacheKey, result.data);
    return result.data;
  }
  return null;
}

async function fetchHistoryYahoo(ticker: string, days: number): Promise<OHLCVBar[]> {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - days * 86400;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&period1=${period1}&period2=${period2}`;
  const r = await axios.get(url, {
    timeout: 15000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    },
  });
  const result = r.data?.chart?.result?.[0];
  if (!result) throw new Error("Yahoo history: no result");
  const timestamps: number[] = result.timestamp || [];
  const ohlcv = result.indicators?.quote?.[0];
  if (!ohlcv || timestamps.length === 0) throw new Error("Yahoo history: no OHLCV");
  const bars: OHLCVBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = ohlcv.close?.[i];
    if (close == null) continue;
    bars.push({
      date: new Date(timestamps[i] * 1000).toISOString().split("T")[0],
      open: ohlcv.open?.[i] || close,
      high: ohlcv.high?.[i] || close,
      low: ohlcv.low?.[i] || close,
      close,
      volume: ohlcv.volume?.[i] || 0,
    });
  }
  return bars;
}

export async function fetchStockHistory(ticker: string, days: number = 252): Promise<StockHistory | null> {
  const cacheKey = `history-${ticker}-${days}`;
  const cached = getCached<StockHistory>(cacheKey, 3_600_000);
  if (cached) return cached;

  const result = await fetchWithRotation<OHLCVBar[]>([
    { name: "YahooHistory", fetch: () => fetchHistoryYahoo(ticker, days + 10) },
  ]);

  if (result && result.data.length > 0) {
    const history: StockHistory = {
      ticker,
      bars: result.data.slice(-days),
      source: result.source,
      timestamp: new Date().toISOString(),
    };
    setCache(cacheKey, history);
    return history;
  }
  return null;
}

export async function fetchMultipleQuotes(tickers: string[]): Promise<StockQuote[]> {
  const results = await Promise.allSettled(tickers.map(t => fetchStockQuote(t)));
  return results
    .filter((r): r is PromiseFulfilledResult<StockQuote | null> => r.status === "fulfilled" && r.value !== null)
    .map(r => r.value as StockQuote);
}

export const WATCHLIST_TICKERS = [
  "AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "META", "TSLA", "SPY", "QQQ", "DIA",
  "PLTR", "AMD", "INTC", "TSM", "ASML", "JPM", "BAC", "GS", "BRK-B", "XOM",
];
