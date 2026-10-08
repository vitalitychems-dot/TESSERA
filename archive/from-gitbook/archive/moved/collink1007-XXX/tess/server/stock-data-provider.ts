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

const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY || "demo";

async function fetchQuoteAlphaVantage(ticker: string): Promise<StockQuote> {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${ticker}&apikey=${ALPHA_VANTAGE_KEY}`;
  const r = await axios.get(url, { timeout: 12000 });
  const q = r.data?.["Global Quote"];
  if (!q || !q["05. price"]) throw new Error("AlphaVantage: no data");
  const price = parseFloat(q["05. price"]);
  const prev = parseFloat(q["08. previous close"]);
  return {
    ticker,
    price,
    open: parseFloat(q["02. open"]),
    high: parseFloat(q["03. high"]),
    low: parseFloat(q["04. low"]),
    previousClose: prev,
    change: parseFloat(q["09. change"]),
    changePercent: parseFloat(q["10. change percent"]?.replace("%", "")),
    volume: parseInt(q["06. volume"]),
    source: "AlphaVantage",
    timestamp: new Date().toISOString(),
  };
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

async function fetchQuoteFMP(ticker: string): Promise<StockQuote> {
  const apiKey = process.env.FMP_API_KEY || "demo";
  const url = `https://financialmodelingprep.com/api/v3/quote/${ticker}?apikey=${apiKey}`;
  const r = await axios.get(url, { timeout: 10000 });
  const q = r.data?.[0];
  if (!q || !q.price) throw new Error("FMP: no data");
  return {
    ticker,
    price: q.price,
    open: q.open,
    high: q.dayHigh,
    low: q.dayLow,
    previousClose: q.previousClose,
    change: q.change,
    changePercent: q.changesPercentage,
    volume: q.volume,
    marketCap: q.marketCap,
    pe: q.pe,
    eps: q.eps,
    name: q.name,
    fiftyTwoWeekHigh: q.yearHigh,
    fiftyTwoWeekLow: q.yearLow,
    source: "FMP",
    timestamp: new Date().toISOString(),
  };
}

async function fetchQuoteTwelveData(ticker: string): Promise<StockQuote> {
  const apiKey = process.env.TWELVE_DATA_KEY || "";
  if (!apiKey) throw new Error("No TWELVE_DATA_KEY");
  const url = `https://api.twelvedata.com/quote?symbol=${ticker}&apikey=${apiKey}`;
  const r = await axios.get(url, { timeout: 10000 });
  const q = r.data;
  if (!q || q.status === "error" || !q.close) throw new Error("TwelveData: no data");
  const price = parseFloat(q.close);
  const prev = parseFloat(q.previous_close || q.close);
  return {
    ticker,
    price,
    open: parseFloat(q.open),
    high: parseFloat(q.high),
    low: parseFloat(q.low),
    previousClose: prev,
    change: price - prev,
    changePercent: ((price - prev) / prev) * 100,
    volume: parseInt(q.volume || "0"),
    name: q.name,
    fiftyTwoWeekHigh: parseFloat(q["52_week"]["high"] || "0"),
    fiftyTwoWeekLow: parseFloat(q["52_week"]["low"] || "0"),
    source: "TwelveData",
    timestamp: new Date().toISOString(),
  };
}

export async function fetchStockQuote(ticker: string): Promise<StockQuote | null> {
  const cacheKey = `quote-${ticker}`;
  const cached = getCached<StockQuote>(cacheKey, 60_000);
  if (cached) return cached;

  const result = await fetchWithRotation<StockQuote>([
    { name: "YahooFinance", fetch: () => fetchQuoteYahooFinance(ticker) },
    { name: "AlphaVantage", fetch: () => fetchQuoteAlphaVantage(ticker) },
    { name: "FMP", fetch: () => fetchQuoteFMP(ticker) },
    { name: "TwelveData", fetch: () => fetchQuoteTwelveData(ticker) },
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

async function fetchHistoryAlphaVantage(ticker: string): Promise<OHLCVBar[]> {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${ticker}&outputsize=compact&apikey=${ALPHA_VANTAGE_KEY}`;
  const r = await axios.get(url, { timeout: 15000 });
  const series = r.data?.["Time Series (Daily)"];
  if (!series) throw new Error("AV history: no data");
  const bars: OHLCVBar[] = Object.entries(series).map(([date, vals]: [string, any]) => ({
    date,
    open: parseFloat(vals["1. open"]),
    high: parseFloat(vals["2. high"]),
    low: parseFloat(vals["3. low"]),
    close: parseFloat(vals["4. close"]),
    volume: parseInt(vals["5. volume"]),
  })).sort((a, b) => a.date.localeCompare(b.date));
  return bars;
}

async function fetchHistoryFMP(ticker: string, days: number): Promise<OHLCVBar[]> {
  const apiKey = process.env.FMP_API_KEY || "demo";
  const url = `https://financialmodelingprep.com/api/v3/historical-price-full/${ticker}?timeseries=${days}&apikey=${apiKey}`;
  const r = await axios.get(url, { timeout: 15000 });
  const hist = r.data?.historical;
  if (!hist || hist.length === 0) throw new Error("FMP history: no data");
  return hist.map((d: any) => ({
    date: d.date,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volume,
  })).sort((a: OHLCVBar, b: OHLCVBar) => a.date.localeCompare(b.date));
}

export async function fetchStockHistory(ticker: string, days: number = 252): Promise<StockHistory | null> {
  const cacheKey = `history-${ticker}-${days}`;
  const cached = getCached<StockHistory>(cacheKey, 3_600_000);
  if (cached) return cached;

  const result = await fetchWithRotation<OHLCVBar[]>([
    { name: "YahooHistory", fetch: () => fetchHistoryYahoo(ticker, days + 10) },
    { name: "AVHistory", fetch: () => fetchHistoryAlphaVantage(ticker) },
    { name: "FMPHistory", fetch: () => fetchHistoryFMP(ticker, days) },
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
