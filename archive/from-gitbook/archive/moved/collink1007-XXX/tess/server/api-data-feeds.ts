import axios from "axios";
import { Router } from "express";

const router = Router();
const log = (m: string) => console.log(`[DataFeeds] ${m}`);

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const dataCache = new Map<string, CacheEntry<any>>();
const CACHE_TTL: Record<string, number> = {
  crypto: 30_000,
  forex: 60_000,
  fearGreed: 120_000,
  weather: 300_000,
  polymarket: 60_000,
  sports: 60_000,
  trending: 60_000,
  alphaVantage: 300_000,
};

function getCached<T>(key: string, ttl: number): T | null {
  const entry = dataCache.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) return entry.data as T;
  return null;
}

function setCache(key: string, data: any) {
  dataCache.set(key, { data, timestamp: Date.now() });
  if (dataCache.size > 200) {
    const entries = Array.from(dataCache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 50; i++) dataCache.delete(entries[i][0]);
  }
}

const providerFailures = new Map<string, { count: number; cooldownUntil: number }>();
const COOLDOWN_MS = 120_000;

function isAvailable(provider: string): boolean {
  const f = providerFailures.get(provider);
  if (!f) return true;
  if (Date.now() > f.cooldownUntil) {
    providerFailures.delete(provider);
    return true;
  }
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

async function fetchCoinGeckoPrices(): Promise<any[]> {
  const topTokens = [
    { id: "solana", symbol: "SOL", mint: "So11111111111111111111111111111111111111112" },
    { id: "bitcoin", symbol: "BTC", mint: "" },
    { id: "ethereum", symbol: "ETH", mint: "" },
    { id: "usd-coin", symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  ];
  const results: any[] = [];
  try {
    const jupRes = await axios.get("https://api.jup.ag/price/v2?ids=" + topTokens.filter(t => t.mint).map(t => t.mint).join(","), { timeout: 8000 });
    for (const token of topTokens) {
      const jupData = jupRes.data?.data?.[token.mint];
      results.push({
        id: token.id, symbol: token.symbol, name: token.id,
        price: jupData?.price ? parseFloat(jupData.price) : 0,
        marketCap: 0, volume24h: 0, change1h: 0, change24h: 0, change7d: 0,
        high24h: 0, low24h: 0, image: "", rank: results.length + 1,
      });
    }
  } catch (e: any) {
    log(`Sovereign price feed (Jupiter) failed: ${e.message?.substring(0, 80)}`);
  }
  return results;
}

async function fetchCoinGeckoTrending(): Promise<any[]> {
  try {
    const res = await axios.get("https://api.jup.ag/tokens/v1/tagged/verified", { timeout: 8000 });
    return (res.data || []).slice(0, 10).map((t: any, i: number) => ({
      id: t.address, name: t.name, symbol: t.symbol?.toUpperCase(),
      marketCapRank: i + 1, thumb: t.logoURI || "", score: 10 - i,
    }));
  } catch {
    return [];
  }
}

async function fetchDexScreenerTokens(addresses: string): Promise<any[]> {
  const jupRes = await axios.get(`https://api.jup.ag/price/v2?ids=${addresses}`, { timeout: 8000 });
  const mints = addresses.split(",");
  return mints.map((mint: string) => {
    const data = jupRes.data?.data?.[mint];
    return {
    dex: "jupiter-sovereign",
    pairAddress: mint,
    baseToken: { address: mint, symbol: data?.mintSymbol || "UNKNOWN" },
    quoteToken: { address: "USDC", symbol: "USDC" },
    priceUsd: data?.price || "0",
    priceNative: data?.price || "0",
    volume24h: 0,
    priceChange24h: 0,
    liquidity: 0,
    fdv: 0,
    url: `https://jup.ag/swap/USDC-${mint}`,
  };
  });
}

async function fetchGeckoTerminalTrending(): Promise<any[]> {
  const res = await axios.get("https://api.geckoterminal.com/api/v2/networks/trending_pools", { timeout: 8000 });
  return (res.data?.data || []).slice(0, 15).map((p: any) => ({
    id: p.id,
    name: p.attributes?.name,
    address: p.attributes?.address,
    priceUsd: p.attributes?.base_token_price_usd,
    volume24h: p.attributes?.volume_usd?.h24,
    priceChange24h: p.attributes?.price_change_percentage?.h24,
    network: p.relationships?.network?.data?.id,
  }));
}

router.get("/api/data-feeds/crypto", async (_req, res) => {
  const cached = getCached<any>("crypto-prices", CACHE_TTL.crypto);
  if (cached) return res.json(cached);

  const result = await fetchWithRotation([
    { name: "CoinGecko", fetch: fetchCoinGeckoPrices },
    {
      name: "GeckoTerminal",
      fetch: async () => {
        const r = await axios.get("https://api.geckoterminal.com/api/v2/networks/eth/trending_pools", { timeout: 8000 });
        return (r.data?.data || []).slice(0, 20).map((p: any) => ({
          id: p.id,
          symbol: p.attributes?.name?.split("/")[0] || "?",
          name: p.attributes?.name || "Unknown",
          price: parseFloat(p.attributes?.base_token_price_usd || "0"),
          volume24h: parseFloat(p.attributes?.volume_usd?.h24 || "0"),
          change24h: parseFloat(p.attributes?.price_change_percentage?.h24 || "0"),
        }));
      },
    },
  ]);

  if (result) {
    const response = { coins: result.data, source: result.source, timestamp: new Date().toISOString() };
    setCache("crypto-prices", response);
    return res.json(response);
  }
  res.status(503).json({ error: "All crypto data providers unavailable", coins: [] });
});

router.get("/api/data-feeds/crypto/trending", async (_req, res) => {
  const cached = getCached<any>("crypto-trending", CACHE_TTL.trending);
  if (cached) return res.json(cached);

  const result = await fetchWithRotation([
    { name: "CoinGecko-Trending", fetch: fetchCoinGeckoTrending },
    { name: "GeckoTerminal-Trending", fetch: fetchGeckoTerminalTrending },
  ]);

  if (result) {
    const response = { trending: result.data, source: result.source, timestamp: new Date().toISOString() };
    setCache("crypto-trending", response);
    return res.json(response);
  }
  res.status(503).json({ error: "Trending data unavailable", trending: [] });
});

router.get("/api/data-feeds/dex/:address", async (req, res) => {
  const { address } = req.params;
  const cacheKey = `dex-${address}`;
  const cached = getCached<any>(cacheKey, CACHE_TTL.crypto);
  if (cached) return res.json(cached);

  const result = await fetchWithRotation([
    { name: "DexScreener", fetch: () => fetchDexScreenerTokens(address) },
    {
      name: "GeckoTerminal-Token",
      fetch: async () => {
        const r = await axios.get(`https://api.geckoterminal.com/api/v2/networks/solana/tokens/${address}`, { timeout: 8000 });
        const t = r.data?.data?.attributes;
        return [{ priceUsd: t?.price_usd, name: t?.name, symbol: t?.symbol, volume24h: t?.volume_usd?.h24 }];
      },
    },
  ]);

  if (result) {
    const response = { pairs: result.data, source: result.source, timestamp: new Date().toISOString() };
    setCache(cacheKey, response);
    return res.json(response);
  }
  res.status(503).json({ error: "DEX data unavailable", pairs: [] });
});

router.get("/api/data-feeds/forex", async (_req, res) => {
  const cached = getCached<any>("forex-rates", CACHE_TTL.forex);
  if (cached) return res.json(cached);

  const result = await fetchWithRotation([
    {
      name: "Frankfurter",
      fetch: async () => {
        const r = await axios.get("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CAD,AUD,CHF,CNY,INR,MXN,BRL,KRW,SGD,HKD,NOK,SEK,DKK,NZD,ZAR,TRY,RUB", { timeout: 8000 });
        return { base: r.data.base, date: r.data.date, rates: r.data.rates };
      },
    },
    {
      name: "Frankfurter-Fallback",
      fetch: async () => {
        const r = await axios.get("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CAD,AUD,CHF", { timeout: 8000 });
        return { base: r.data.base, date: r.data.date, rates: r.data.rates };
      },
    },
  ]);

  if (result) {
    const response = { ...result.data, source: result.source, timestamp: new Date().toISOString() };
    setCache("forex-rates", response);
    return res.json(response);
  }
  res.status(503).json({ error: "Forex data unavailable", rates: {} });
});

router.get("/api/data-feeds/forex/historical", async (req, res) => {
  const { from = "USD", to = "EUR", days = "30" } = req.query;
  const cacheKey = `forex-hist-${from}-${to}-${days}`;
  const cached = getCached<any>(cacheKey, CACHE_TTL.forex * 5);
  if (cached) return res.json(cached);

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days as string));
    const start = startDate.toISOString().split("T")[0];
    const end = endDate.toISOString().split("T")[0];
    const r = await axios.get(`https://api.frankfurter.app/${start}..${end}?from=${from}&to=${to}`, { timeout: 10_000 });
    const response = { base: r.data.base, rates: r.data.rates, start_date: r.data.start_date, end_date: r.data.end_date, source: "Frankfurter", timestamp: new Date().toISOString() };
    setCache(cacheKey, response);
    res.json(response);
  } catch (err: any) {
    res.status(503).json({ error: "Historical forex data unavailable" });
  }
});

router.get("/api/data-feeds/fear-greed", async (_req, res) => {
  const cached = getCached<any>("fear-greed", CACHE_TTL.fearGreed);
  if (cached) return res.json(cached);

  const result = await fetchWithRotation([
    {
      name: "Alternative.me",
      fetch: async () => {
        const r = await axios.get("https://api.alternative.me/fng/?limit=30", { timeout: 6000 });
        return (r.data?.data || []).map((d: any) => ({
          value: parseInt(d.value),
          label: d.value_classification,
          timestamp: parseInt(d.timestamp) * 1000,
          date: new Date(parseInt(d.timestamp) * 1000).toISOString().split("T")[0],
        }));
      },
    },
  ]);

  if (result) {
    const current = result.data[0] || { value: 50, label: "Neutral" };
    const response = {
      current: current,
      history: result.data,
      source: result.source,
      timestamp: new Date().toISOString(),
    };
    setCache("fear-greed", response);
    return res.json(response);
  }
  res.status(503).json({ error: "Fear & Greed data unavailable", current: { value: 50, label: "Neutral" } });
});

router.get("/api/data-feeds/weather", async (req, res) => {
  const { lat = "40.7128", lon = "-74.0060" } = req.query;
  const cacheKey = `weather-${lat}-${lon}`;
  const cached = getCached<any>(cacheKey, CACHE_TTL.weather);
  if (cached) return res.json(cached);

  const result = await fetchWithRotation<any>([
    {
      name: "Open-Meteo",
      fetch: async () => {
        const r = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&timezone=auto&forecast_days=7`, { timeout: 8000 });
        return {
          current: r.data.current,
          daily: r.data.daily,
          timezone: r.data.timezone,
          elevation: r.data.elevation,
          units: r.data.current_units,
        };
      },
    },
    {
      name: "wttr.in",
      fetch: async () => {
        const r = await axios.get(`https://wttr.in/${lat},${lon}?format=j1`, { timeout: 8000, headers: { "User-Agent": "curl/7.68.0" } });
        const current = r.data?.current_condition?.[0] || {};
        return {
          current: {
            temperature_2m: parseFloat(current.temp_C || "0"),
            humidity: parseFloat(current.humidity || "0"),
            wind_speed: parseFloat(current.windspeedKmph || "0"),
            description: current.weatherDesc?.[0]?.value || "Unknown",
          },
          forecast: (r.data?.weather || []).map((d: any) => ({
            date: d.date,
            maxTemp: parseFloat(d.maxtempC || "0"),
            minTemp: parseFloat(d.mintempC || "0"),
          })),
        };
      },
    },
  ]);

  if (result) {
    const response = { ...result.data, source: result.source, timestamp: new Date().toISOString() };
    setCache(cacheKey, response);
    return res.json(response);
  }
  res.status(503).json({ error: "Weather data unavailable" });
});

router.get("/api/data-feeds/polymarket", async (_req, res) => {
  const cached = getCached<any>("polymarket", CACHE_TTL.polymarket);
  if (cached) return res.json(cached);

  const result = await fetchWithRotation([
    {
      name: "Polymarket-CLOB",
      fetch: async () => {
        const r = await axios.get("https://clob.polymarket.com/markets", {
          timeout: 10_000,
          params: { limit: 20, active: true },
        });
        return (Array.isArray(r.data) ? r.data : r.data?.data || []).slice(0, 20).map((m: any) => ({
          id: m.condition_id || m.id,
          question: m.question,
          outcomes: m.tokens?.map((t: any) => t.outcome) || [],
          outcomePrices: m.tokens?.map((t: any) => parseFloat(t.price || "0")) || [],
          volume: m.volume,
          endDate: m.end_date_iso,
          active: m.active,
        }));
      },
    },
    {
      name: "Polymarket-Gamma",
      fetch: async () => {
        const r = await axios.get("https://gamma-api.polymarket.com/markets", {
          timeout: 10_000,
          params: { limit: 20, active: true, closed: false },
        });
        return (Array.isArray(r.data) ? r.data : []).slice(0, 20).map((m: any) => ({
          id: m.id,
          question: m.question,
          outcomes: m.outcomes ? JSON.parse(m.outcomes) : [],
          outcomePrices: m.outcomePrices ? JSON.parse(m.outcomePrices) : [],
          volume: m.volume,
          endDate: m.endDate,
          active: m.active,
        }));
      },
    },
  ]);

  if (result) {
    const response = { markets: result.data, source: result.source, timestamp: new Date().toISOString() };
    setCache("polymarket", response);
    return res.json(response);
  }
  res.status(503).json({ error: "Prediction market data unavailable", markets: [] });
});

router.get("/api/data-feeds/sports-odds", async (_req, res) => {
  const cached = getCached<any>("sports-odds", CACHE_TTL.sports);
  if (cached) return res.json(cached);

  const result = await fetchWithRotation([
    {
      name: "TheOddsAPI-Free",
      fetch: async () => {
        const apiKey = process.env.ODDS_API_KEY;
        if (!apiKey) throw new Error("No ODDS_API_KEY");
        const r = await axios.get("https://api.the-odds-api.com/v4/sports/upcoming/odds", {
          params: { apiKey, regions: "us", markets: "h2h", oddsFormat: "american" },
          timeout: 10_000,
        });
        return (r.data || []).slice(0, 20).map((g: any) => ({
          id: g.id,
          sport: g.sport_key,
          homeTeam: g.home_team,
          awayTeam: g.away_team,
          commenceTime: g.commence_time,
          bookmakers: (g.bookmakers || []).slice(0, 3).map((b: any) => ({
            key: b.key,
            title: b.title,
            markets: (b.markets || []).map((m: any) => ({
              key: m.key,
              outcomes: m.outcomes,
            })),
          })),
        }));
      },
    },
    {
      name: "SportsDB-Free",
      fetch: async () => {
        const r = await axios.get("https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=" + new Date().toISOString().split("T")[0], { timeout: 8000 });
        return (r.data?.events || []).slice(0, 20).map((e: any) => ({
          id: e.idEvent,
          sport: e.strSport,
          homeTeam: e.strHomeTeam,
          awayTeam: e.strAwayTeam,
          commenceTime: e.strTimestamp || e.dateEvent,
          league: e.strLeague,
          homeScore: e.intHomeScore,
          awayScore: e.intAwayScore,
          status: e.strStatus,
        }));
      },
    },
  ]);

  if (result) {
    const response = { events: result.data, source: result.source, timestamp: new Date().toISOString() };
    setCache("sports-odds", response);
    return res.json(response);
  }
  res.status(503).json({ error: "Sports data unavailable", events: [] });
});

router.get("/api/data-feeds/alpha-vantage/:function", async (req, res) => {
  const fn = req.params.function;
  const symbol = (req.query.symbol as string) || "AAPL";
  const cacheKey = `av-${fn}-${symbol}`;
  const cached = getCached<any>(cacheKey, CACHE_TTL.alphaVantage);
  if (cached) return res.json(cached);

  const apiKey = process.env.ALPHA_VANTAGE_KEY || "demo";
  const functionMap: Record<string, string> = {
    quote: "GLOBAL_QUOTE",
    intraday: "TIME_SERIES_INTRADAY",
    daily: "TIME_SERIES_DAILY",
    sma: "SMA",
    rsi: "RSI",
    macd: "MACD",
  };
  const avFunction = functionMap[fn] || fn.toUpperCase();

  try {
    const params: Record<string, string> = { function: avFunction, symbol, apikey: apiKey };
    if (fn === "intraday") params.interval = "5min";
    if (fn === "sma" || fn === "rsi") { params.interval = "daily"; params.time_period = "14"; params.series_type = "close"; }
    if (fn === "macd") { params.series_type = "close"; }

    const r = await axios.get("https://www.alphavantage.co/query", { params, timeout: 12_000 });
    const response = { data: r.data, source: "AlphaVantage", function: avFunction, symbol, timestamp: new Date().toISOString() };
    setCache(cacheKey, response);
    res.json(response);
  } catch (err: any) {
    res.status(503).json({ error: "Alpha Vantage unavailable", message: err.message });
  }
});

router.get("/api/data-feeds/status", (_req, res) => {
  const providers = [
    "CoinGecko", "GeckoTerminal", "DexScreener", "Frankfurter",
    "Open-Meteo", "wttr.in", "Alternative.me", "Polymarket-CLOB",
    "Polymarket-Gamma", "TheOddsAPI-Free", "SportsDB-Free", "AlphaVantage",
    "CoinGecko-Trending", "GeckoTerminal-Trending", "Frankfurter-Fallback",
    "GeckoTerminal-Token",
  ];

  const status = providers.map(name => {
    const f = providerFailures.get(name);
    return {
      name,
      available: isAvailable(name),
      failures: f?.count || 0,
      cooldownUntil: f?.cooldownUntil || null,
      cooldownRemaining: f ? Math.max(0, Math.round((f.cooldownUntil - Date.now()) / 1000)) : 0,
    };
  });

  res.json({
    providers: status,
    cacheEntries: dataCache.size,
    activeSources: status.filter(s => s.available).length,
    totalSources: providers.length,
    timestamp: new Date().toISOString(),
  });
});

router.get("/api/data-feeds/all", async (_req, res) => {
  const [crypto, forex, fearGreed] = await Promise.allSettled([
    (async () => {
      const cached = getCached<any>("crypto-prices", CACHE_TTL.crypto);
      if (cached) return cached;
      const result = await fetchWithRotation([{ name: "CoinGecko", fetch: fetchCoinGeckoPrices }]);
      if (result) {
        const r = { coins: result.data, source: result.source, timestamp: new Date().toISOString() };
        setCache("crypto-prices", r);
        return r;
      }
      return { coins: [], source: "none" };
    })(),
    (async () => {
      const cached = getCached<any>("forex-rates", CACHE_TTL.forex);
      if (cached) return cached;
      try {
        const r = await axios.get("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CAD,AUD,CHF", { timeout: 8000 });
        const data = { base: r.data.base, date: r.data.date, rates: r.data.rates, source: "Frankfurter", timestamp: new Date().toISOString() };
        setCache("forex-rates", data);
        return data;
      } catch { return { rates: {}, source: "none" }; }
    })(),
    (async () => {
      const cached = getCached<any>("fear-greed", CACHE_TTL.fearGreed);
      if (cached) return cached;
      try {
        const r = await axios.get("https://api.alternative.me/fng/?limit=7", { timeout: 6000 });
        const history = (r.data?.data || []).map((d: any) => ({ value: parseInt(d.value), label: d.value_classification }));
        const data = { current: history[0] || { value: 50, label: "Neutral" }, history, source: "Alternative.me", timestamp: new Date().toISOString() };
        setCache("fear-greed", data);
        return data;
      } catch { return { current: { value: 50, label: "Neutral" }, source: "none" }; }
    })(),
  ]);

  res.json({
    crypto: crypto.status === "fulfilled" ? crypto.value : { coins: [] },
    forex: forex.status === "fulfilled" ? forex.value : { rates: {} },
    fearGreed: fearGreed.status === "fulfilled" ? fearGreed.value : { current: { value: 50, label: "Neutral" } },
    timestamp: new Date().toISOString(),
  });
});

log("Data feeds module loaded — crypto, forex, weather, polymarket, sports, alpha-vantage with rotation");

export default router;
