const log = (m: string) => console.log(`[LiveData] ${m}`);
const warn = (m: string) => console.log(`[LiveData] ⚠️ ${m}`);

interface LiveDataResult {
  found: boolean;
  data: string;
  source: string;
  category: string;
}

interface DataPattern {
  pattern: RegExp;
  category: string;
  handler: (query: string, match: RegExpMatchArray) => Promise<LiveDataResult>;
}

const LIVE_CACHE_TTL = 120_000;
const KNOWLEDGE_CACHE_TTL = 600_000;
const MAX_CACHE_SIZE = 500;

class LRUCache {
  private items = new Map<string, { data: LiveDataResult; ts: number; accessedAt: number }>();

  get(key: string, ttl: number): LiveDataResult | null {
    const entry = this.items.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > ttl) {
      this.items.delete(key);
      return null;
    }
    entry.accessedAt = Date.now();
    return entry.data;
  }

  set(key: string, data: LiveDataResult) {
    this.items.set(key, { data, ts: Date.now(), accessedAt: Date.now() });
    if (this.items.size > MAX_CACHE_SIZE) {
      const sorted = Array.from(this.items.entries()).sort((a, b) => a[1].accessedAt - b[1].accessedAt);
      const toRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
      for (let i = 0; i < toRemove; i++) this.items.delete(sorted[i][0]);
    }
  }

  get size() { return this.items.size; }
}

const cache = new LRUCache();

const CRYPTO_ID_MAP: Record<string, string> = {
  bitcoin: "bitcoin", btc: "bitcoin", eth: "ethereum", ethereum: "ethereum",
  sol: "solana", solana: "solana", doge: "dogecoin", dogecoin: "dogecoin",
  ada: "cardano", cardano: "cardano", xrp: "ripple", ripple: "ripple",
  dot: "polkadot", polkadot: "polkadot", link: "chainlink", chainlink: "chainlink",
  avax: "avalanche-2", matic: "polygon-pos", polygon: "polygon-pos",
  bnb: "binancecoin", shib: "shiba-inu", pepe: "pepe", sui: "sui",
  ton: "the-open-network", near: "near", apt: "aptos", arb: "arbitrum",
  op: "optimism", atom: "cosmos", uni: "uniswap", aave: "aave",
  ltc: "litecoin", litecoin: "litecoin", bch: "bitcoin-cash",
};
const CRYPTO_NAMES = new Set(Object.keys(CRYPTO_ID_MAP));

function formatPrice(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "N/A";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 6 : 2 })}`;
}

function formatChange(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function formatMarketCap(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "N/A";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

const NOT_FOUND: LiveDataResult = { found: false, data: "", source: "", category: "" };

const DATA_PATTERNS: DataPattern[] = [
  {
    pattern: /\b(bitcoin|btc|eth|ethereum|sol|solana|doge|dogecoin|ada|cardano|xrp|ripple|dot|polkadot|link|chainlink|avax|matic|polygon|bnb|shib|pepe|sui|ton|near|apt|arb|op|atom|uni|aave|ltc|litecoin|bch)\b\s*(?:price|coin|token|crypto|at|worth|trading|right now|doing|today|value)?/i,
    category: "crypto-direct",
    handler: async (_query, match) => {
      const coin = match[1]?.toLowerCase();
      if (!coin || !CRYPTO_NAMES.has(coin)) return NOT_FOUND;
      const cacheKey = `crypto_${coin}`;
      const cached = cache.get(cacheKey, LIVE_CACHE_TTL);
      if (cached) return cached;
      const { fetchCryptoWithFailover } = await import("./sovereign-data-feeds");
      const id = CRYPTO_ID_MAP[coin] || coin;
      const data = await fetchCryptoWithFailover(id);
      if (!data) return NOT_FOUND;
      const result: LiveDataResult = {
        found: true, source: `${data.source}`, category: "crypto",
        data: `**${data.name.toUpperCase()} — Live Price**\n\n💰 **${formatPrice(data.price)}**\n📈 24h Change: ${formatChange(data.change24h)}\n📊 Market Cap: ${formatMarketCap(data.marketCap)}\n\n*Direct from ${data.source} — zero LLM dependency.*`,
      };
      cache.set(cacheKey, result);
      return result;
    },
  },
  {
    pattern: /(?:what(?:'?s| is)|price of?|how much is|current price|value of|how(?:'?s| is))\s*(?:the\s+)?(?:price\s+of\s+)?(\w+)\s*(?:price|coin|token|crypto|at|worth|trading|right now|doing|today)?/i,
    category: "crypto",
    handler: async (_query, match) => {
      const coin = match[1]?.toLowerCase();
      if (!coin || !CRYPTO_NAMES.has(coin)) return NOT_FOUND;
      const cacheKey = `crypto_${coin}`;
      const cached = cache.get(cacheKey, LIVE_CACHE_TTL);
      if (cached) return cached;
      const { fetchCryptoWithFailover } = await import("./sovereign-data-feeds");
      const id = CRYPTO_ID_MAP[coin] || coin;
      const data = await fetchCryptoWithFailover(id);
      if (!data) return NOT_FOUND;
      const result: LiveDataResult = {
        found: true, source: `${data.source}`, category: "crypto",
        data: `**${data.name.toUpperCase()} — Live Price**\n\n💰 **${formatPrice(data.price)}**\n📈 24h Change: ${formatChange(data.change24h)}\n📊 Market Cap: ${formatMarketCap(data.marketCap)}\n\n*Direct from ${data.source} — zero LLM dependency.*`,
      };
      cache.set(cacheKey, result);
      return result;
    },
  },
  {
    pattern: /(?:crypto|market|bitcoin|btc)\s*(?:prices?|market|overview|status|summary|update|dashboard)/i,
    category: "crypto-overview",
    handler: async () => {
      const cached = cache.get("crypto_overview", LIVE_CACHE_TTL);
      if (cached) return cached;
      const { fetchCryptoOverviewWithFailover } = await import("./sovereign-data-feeds");
      const prices = await fetchCryptoOverviewWithFailover();
      if (prices.length === 0) return NOT_FOUND;
      const lines = prices.map(p =>
        `• **${p.name.charAt(0).toUpperCase() + p.name.slice(1)}**: ${formatPrice(p.price)} ${formatChange(p.change24h)}`
      ).join("\n");
      const result: LiveDataResult = {
        found: true, source: `${prices[0].source}`, category: "crypto",
        data: `**Crypto Market Overview — Live**\n\n${lines}\n\n*Direct from ${prices[0].source} — zero LLM dependency.*`,
      };
      cache.set("crypto_overview", result);
      return result;
    },
  },
  {
    pattern: /weather\s*(?:in|for|at|near)?\s*([\w][\w\s]{1,30}?)(?:\?|$|right now|today|this week|forecast)/i,
    category: "weather",
    handler: async (_query, match) => {
      const location = match[1]?.trim() || "Chicago";
      const cacheKey = `weather_${location.toLowerCase()}`;
      const cached = cache.get(cacheKey, LIVE_CACHE_TTL);
      if (cached) return cached;
      const { fetchWeatherSovereign } = await import("./sovereign-data-feeds");
      const data = await fetchWeatherSovereign(location);
      if (!data?.current) return NOT_FOUND;
      const tempF = (data.current.temperature * 9 / 5 + 32).toFixed(0);
      const forecastLines = data.forecast?.slice(0, 5).map((f: any) =>
        `• ${f.date}: High ${(f.high * 9 / 5 + 32).toFixed(0)}°F / Low ${(f.low * 9 / 5 + 32).toFixed(0)}°F${f.precip > 0 ? ` — ${f.precip}mm rain` : ""}`
      ).join("\n") || "";
      let airInfo = "";
      if (data.airQuality) {
        const aq = data.airQuality;
        const aqLabel = aq.aqi <= 50 ? "Good 🟢" : aq.aqi <= 100 ? "Moderate 🟡" : aq.aqi <= 150 ? "Unhealthy for Sensitive 🟠" : "Unhealthy 🔴";
        airInfo = `\n🌬️ Air Quality: AQI ${aq.aqi} — ${aqLabel} (PM2.5: ${aq.pm25?.toFixed(1)})`;
      }
      const result: LiveDataResult = {
        found: true, source: "Open-Meteo", category: "weather",
        data: `**Weather in ${data.location}, ${data.country} — Live**\n\n🌡️ **${tempF}°F** (${data.current.temperature}°C)\n💨 Wind: ${data.current.windspeed} km/h${airInfo}\n\n**5-Day Forecast:**\n${forecastLines}\n\n*Direct from Open-Meteo — zero API keys, zero LLM dependency.*`,
      };
      cache.set(cacheKey, result);
      return result;
    },
  },
  {
    pattern: /(?:what(?:'s| is)|how(?:'s| is))\s+(?:the\s+)?weather/i,
    category: "weather-default",
    handler: async () => {
      const cached = cache.get("weather_default", LIVE_CACHE_TTL);
      if (cached) return cached;
      const { fetchWeatherSovereign } = await import("./sovereign-data-feeds");
      const data = await fetchWeatherSovereign("Chicago");
      if (!data?.current) return NOT_FOUND;
      const tempF = (data.current.temperature * 9 / 5 + 32).toFixed(0);
      const result: LiveDataResult = {
        found: true, source: "Open-Meteo", category: "weather",
        data: `**Current Weather — Live**\n\n🌡️ ${data.location}: **${tempF}°F** (${data.current.temperature}°C), Wind: ${data.current.windspeed} km/h\n\n*Tell me a city and I'll get specific weather. Direct from Open-Meteo.*`,
      };
      cache.set("weather_default", result);
      return result;
    },
  },
  {
    pattern: /(?:fear.*greed|market.*sentiment|crypto.*sentiment|investor.*sentiment|greed.*index)/i,
    category: "sentiment",
    handler: async () => {
      const cached = cache.get("fear_greed", LIVE_CACHE_TTL);
      if (cached) return cached;
      const { fetchFearGreedIndex } = await import("./sovereign-data-feeds");
      const data = await fetchFearGreedIndex();
      if (!data) return NOT_FOUND;
      const emoji = data.value >= 75 ? "🟢" : data.value >= 50 ? "🟡" : data.value >= 25 ? "🟠" : "🔴";
      const result: LiveDataResult = {
        found: true, source: "Alternative.me", category: "sentiment",
        data: `**Crypto Fear & Greed Index — Live**\n\n${emoji} **${data.value}/100 — ${data.label}**\n\n${data.value >= 75 ? "Extreme Greed — the market is euphoric." : data.value >= 50 ? "Greed — bullish sentiment prevailing." : data.value >= 25 ? "Fear — uncertainty in the market." : "Extreme Fear — maximum uncertainty."}\n\n*Direct from Alternative.me — zero LLM dependency.*`,
      };
      cache.set("fear_greed", result);
      return result;
    },
  },
  {
    pattern: /(?:(?:forex|exchange rate|currency|convert)\s*(?:for|of)?\s*(\w{3})\s*(?:to|vs|against|\/)\s*(\w{3})|(\w{3})\s*(?:to|vs|against|\/)\s*(\w{3})\s*(?:exchange|rate|forex|convert|currency))/i,
    category: "forex",
    handler: async (_query, match) => {
      const base = (match[1] || match[3])?.toUpperCase() || "USD";
      const target = (match[2] || match[4])?.toUpperCase() || "EUR";
      const cacheKey = `forex_${base}_${target}`;
      const cached = cache.get(cacheKey, LIVE_CACHE_TTL);
      if (cached) return cached;
      const { fetchForexSovereign } = await import("./sovereign-data-feeds");
      const data = await fetchForexSovereign(base, target);
      if (!data) return NOT_FOUND;
      const result: LiveDataResult = {
        found: true, source: "ECB/Frankfurter", category: "forex",
        data: `**${data.base}/${data.target} Exchange Rate — Live**\n\n💱 **1 ${data.base} = ${data.rate} ${data.target}**\nDate: ${data.date}\n\n*Direct from European Central Bank via Frankfurter — zero LLM dependency.*`,
      };
      cache.set(cacheKey, result);
      return result;
    },
  },
  {
    pattern: /(?:stock|share|equity|ticker)\s*(?:price|quote)?\s*(?:of|for)?\s*\$?([A-Z]{1,5})\b/i,
    category: "stock",
    handler: async (_query, match) => {
      const ticker = match[1]?.toUpperCase();
      if (!ticker || ticker.length > 5) return NOT_FOUND;
      if (CRYPTO_NAMES.has(ticker.toLowerCase())) return NOT_FOUND;
      const cacheKey = `stock_${ticker}`;
      const cached = cache.get(cacheKey, LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchStockQuote } = await import("./esoteric-archive");
        const data = await fetchStockQuote(ticker);
        if (data?.price) {
          const result: LiveDataResult = {
            found: true, source: "Yahoo Finance", category: "stock",
            data: `**${data.name || ticker} (${ticker}) — Live**\n\n💰 **$${data.price.toFixed(2)}**\n${data.change !== undefined ? `📈 Change: ${data.change > 0 ? "+" : ""}$${data.change.toFixed(2)} (${data.changePercent?.toFixed(2)}%)` : ""}\n${data.volume ? `📊 Volume: ${(data.volume / 1e6).toFixed(1)}M` : ""}\n\n*Direct from Yahoo Finance — zero LLM dependency.*`,
          };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) {
        warn(`Stock ${ticker} failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:latest|top|breaking|current|today(?:'s)?|recent)\s*(?:news|headlines)(?:\s+(?:about|on|in|for)\s+(.{3,40}))?/i,
    category: "news",
    handler: async (_query, match) => {
      const topic = match[1]?.trim().toLowerCase() || "";
      const categoryMap: Record<string, string> = {
        tech: "tech", technology: "tech", ai: "tech", science: "science",
        business: "business", finance: "business", economy: "business",
        health: "health", medical: "health", world: "world",
      };
      const feedCategory = categoryMap[topic] || "top";
      const cacheKey = `news_${feedCategory}`;
      const cached = cache.get(cacheKey, LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchNews } = await import("./sovereign-data-feeds");
        const articles = await fetchNews(feedCategory, 8);
        if (articles.length > 0) {
          const lines = articles.map((a, i) =>
            `${i + 1}. **${a.title}** *(${a.source})*\n   ${a.description.substring(0, 150)}${a.description.length > 150 ? "..." : ""}`
          ).join("\n\n");
          const result: LiveDataResult = {
            found: true, source: "BBC/NYT RSS", category: "news",
            data: `**${feedCategory === "top" ? "Top" : feedCategory.charAt(0).toUpperCase() + feedCategory.slice(1)} Headlines — Live**\n\n${lines}\n\n*Direct from BBC & NYT RSS feeds — zero LLM dependency.*`,
          };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) {
        warn(`News failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:hacker\s*news|hn\b|tech\s*news|developer\s*news|programming\s*news|show\s*hn)/i,
    category: "hackernews",
    handler: async () => {
      const cached = cache.get("hn_top", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchHackerNews } = await import("./sovereign-data-feeds");
        const stories = await fetchHackerNews(10);
        if (stories.length > 0) {
          const lines = stories.map((s, i) => `${i + 1}. **${s.title}** (${s.score} pts)\n   ${s.url}`).join("\n\n");
          const result: LiveDataResult = {
            found: true, source: "Hacker News Firebase API", category: "tech-news",
            data: `**Hacker News — Top Stories Right Now**\n\n${lines}\n\n*Direct from Hacker News Firebase API — zero LLM dependency.*`,
          };
          cache.set("hn_top", result);
          return result;
        }
      } catch (err: any) {
        warn(`HN failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:reddit|trending\s*on\s*reddit|what(?:'s| is)\s*(?:trending|hot|popular))\s*(?:on\s*reddit\s*)?(?:r\/)?(\w+)?/i,
    category: "reddit",
    handler: async (_query, match) => {
      const sub = match[1] || "all";
      const cacheKey = `reddit_${sub}`;
      const cached = cache.get(cacheKey, LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchRedditTrending } = await import("./sovereign-data-feeds");
        const posts = await fetchRedditTrending(sub, 8);
        if (posts.length > 0) {
          const lines = posts.map((p, i) => `${i + 1}. **${p.title}** (⬆${p.score} | 💬${p.comments})\n   r/${p.subreddit}`).join("\n\n");
          const result: LiveDataResult = {
            found: true, source: "Reddit JSON API", category: "social",
            data: `**Reddit r/${sub} — Trending Now**\n\n${lines}\n\n*Direct from Reddit's public JSON API — zero LLM dependency.*`,
          };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) {
        warn(`Reddit failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:research\s*papers?|arxiv|academic|latest\s*research|scientific\s*papers?|papers?\s*(?:on|about))\s*(?:on|about|for)?\s*(.{3,60})/i,
    category: "arxiv",
    handler: async (_query, match) => {
      const topic = match[1]?.trim() || "";
      if (!topic || topic.length < 3) return NOT_FOUND;
      const cacheKey = `arxiv_${topic.substring(0, 30).toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchArxiv } = await import("./sovereign-data-feeds");
        const papers = await fetchArxiv(topic, 5);
        if (papers.length > 0) {
          const lines = papers.map((p, i) => `${i + 1}. **${p.title}**\n   ${p.authors} (${p.published})\n   ${p.summary.substring(0, 200)}...\n   ${p.url}`).join("\n\n");
          const result: LiveDataResult = {
            found: true, source: "arXiv", category: "research",
            data: `**Latest Research: ${topic}**\n\n${lines}\n\n*Direct from arXiv — zero LLM dependency.*`,
          };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) {
        warn(`arXiv failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:define|definition\s*(?:of)?|what\s*does)\s+(\w+)\s*(?:mean)?/i,
    category: "definition",
    handler: async (_query, match) => {
      const word = match[1]?.toLowerCase();
      if (!word || word.length < 2) return NOT_FOUND;
      const cacheKey = `define_${word}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchDefinition } = await import("./sovereign-data-feeds");
        const def = await fetchDefinition(word);
        if (def && def.meanings.length > 0) {
          const lines = def.meanings.map(m => `• *${m.partOfSpeech}*: ${m.definition}`).join("\n");
          const result: LiveDataResult = {
            found: true, source: "Free Dictionary API", category: "definition",
            data: `**${def.word}** ${def.phonetic ? `(${def.phonetic})` : ""}\n\n${lines}\n\n*Direct from Free Dictionary API — zero LLM dependency.*`,
          };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) {
        warn(`Definition failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:earthquake|seismic|quake)s?\s*(?:today|recent|latest|now|this week)?/i,
    category: "earthquakes",
    handler: async () => {
      const cached = cache.get("earthquakes", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchEarthquakes } = await import("./sovereign-data-feeds");
        const quakes = await fetchEarthquakes(4.0, 8);
        if (quakes.length > 0) {
          const lines = quakes.map((q, i) => `${i + 1}. **M${q.magnitude.toFixed(1)}** — ${q.place}\n   ${new Date(q.time).toLocaleString()}`).join("\n\n");
          const result: LiveDataResult = {
            found: true, source: "USGS Earthquake Feed", category: "seismic",
            data: `**Recent Earthquakes (M4.0+) — Live**\n\n${lines}\n\n*Direct from USGS — zero LLM dependency.*`,
          };
          cache.set("earthquakes", result);
          return result;
        }
      } catch (err: any) {
        warn(`Earthquake failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:tell me about|info(?:rmation)?\s*(?:about|on)|facts?\s*(?:about|on))\s+([\w\s]{2,30}?)(?:\s*country|\s*nation)?(?:\?|$)/i,
    category: "country",
    handler: async (_query, match) => {
      const name = match[1]?.trim();
      if (!name || name.length < 2) return NOT_FOUND;
      if (/tessera|yourself|you|your|my /i.test(name)) return NOT_FOUND;
      const cacheKey = `country_${name.toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchCountryData } = await import("./sovereign-data-feeds");
        const country = await fetchCountryData(name);
        if (country) {
          const result: LiveDataResult = {
            found: true, source: "RestCountries", category: "country",
            data: `**${country.flag} ${country.name}**\n\n🏛️ Capital: ${country.capital}\n👥 Population: ${country.population.toLocaleString()}\n🌍 Region: ${country.region}\n🗣️ Languages: ${country.languages.join(", ")}\n💰 Currencies: ${country.currencies.join(", ")}\n\n*Direct from RestCountries API — zero LLM dependency.*`,
          };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) {
        warn(`Country failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:github|trending\s*repos|trending\s*repositories|popular\s*(?:repos|projects|open\s*source)|what(?:'s| are)\s*(?:developers?|people)\s*building)/i,
    category: "github-trending",
    handler: async () => {
      const cached = cache.get("github_trending", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchGitHubTrending } = await import("./sovereign-data-feeds");
        const repos = await fetchGitHubTrending();
        if (repos.length > 0) {
          const lines = repos.map((r, i) => `${i + 1}. **${r.name}** ⭐${r.stars.toLocaleString()} (${r.language})\n   ${r.description}`).join("\n\n");
          const result: LiveDataResult = {
            found: true, source: "GitHub API", category: "code",
            data: `**GitHub Trending Repositories**\n\n${lines}\n\n*Direct from GitHub API — zero LLM dependency.*`,
          };
          cache.set("github_trending", result);
          return result;
        }
      } catch (err: any) {
        warn(`GitHub failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:astronomy|space\s*picture|nasa|apod|picture\s*of\s*(?:the\s*)?day|cosmos|space\s*photo)/i,
    category: "nasa",
    handler: async () => {
      const cached = cache.get("nasa_apod", KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchAPOD } = await import("./sovereign-data-feeds");
        const apod = await fetchAPOD();
        if (apod) {
          const result: LiveDataResult = {
            found: true, source: "NASA APOD", category: "astronomy",
            data: `**NASA Astronomy Picture of the Day**\n\n🔭 **${apod.title}** (${apod.date})\n\n${apod.explanation}\n\n🖼️ ${apod.url}\n\n*Direct from NASA — zero LLM dependency.*`,
          };
          cache.set("nasa_apod", result);
          return result;
        }
      } catch (err: any) {
        warn(`NASA failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:asteroid|near.?earth|neo)\s*(?:today|now|approaching|close|watch)/i,
    category: "asteroids",
    handler: async () => {
      const cached = cache.get("asteroids", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchNASAAsteroids } = await import("./sovereign-data-feeds");
        const data = await fetchNASAAsteroids();
        if (data?.length) {
          const lines = data.map((a, i) => `${i + 1}. **${a.name}** — ${a.diameter} diameter\n   Speed: ${a.velocity} | Miss: ${a.missDistance}${a.hazardous ? " ⚠️ HAZARDOUS" : ""}`).join("\n\n");
          const result: LiveDataResult = { found: true, source: "NASA NEO API", category: "space", data: `**Near-Earth Asteroids Today — Live**\n\n${lines}\n\n*Direct from NASA Near Earth Object API — zero LLM dependency.*` };
          cache.set("asteroids", result);
          return result;
        }
      } catch (err: any) { warn(`Asteroids failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:iss|international space station|space station)\s*(?:position|location|where|track|now)?/i,
    category: "iss",
    handler: async () => {
      const cached = cache.get("iss_pos", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchISSPosition } = await import("./sovereign-data-feeds");
        const data = await fetchISSPosition();
        if (data) {
          const result: LiveDataResult = { found: true, source: "Open Notify", category: "space", data: `**ISS Position — Live**\n\n🛰️ Latitude: **${data.latitude.toFixed(4)}°**\nLongitude: **${data.longitude.toFixed(4)}°**\nTimestamp: ${new Date(data.timestamp * 1000).toISOString()}\n\n*Direct from Open Notify API — zero LLM dependency.*` };
          cache.set("iss_pos", result);
          return result;
        }
      } catch (err: any) { warn(`ISS position failed: ${err.message?.substring(0, 100)}`); console.log(`[LiveData] ISS error detail:`, err.code || err.message); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:people|astronaut|cosmonaut|who)\s*(?:is\s+in|are\s+in|in|currently in|aboard)\s*(?:space|orbit|iss)/i,
    category: "astronauts",
    handler: async () => {
      const cached = cache.get("people_space", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchPeopleInSpace } = await import("./sovereign-data-feeds");
        const data = await fetchPeopleInSpace();
        if (data) {
          const lines = data.people.map(p => `• **${p.name}** — ${p.craft}`).join("\n");
          const result: LiveDataResult = { found: true, source: "Open Notify", category: "space", data: `**People in Space Right Now — Live**\n\n👨‍🚀 **${data.count} people** currently in orbit:\n\n${lines}\n\n*Direct from Open Notify API — zero LLM dependency.*` };
          cache.set("people_space", result);
          return result;
        }
      } catch (err: any) { warn(`People in space failed: ${err.message?.substring(0, 100)}`); console.log(`[LiveData] People in space error detail:`, err.code || err.message); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:natural.?event|wildfire|volcano|storm|\bice\b(?:\s*storm|\s*cap|\s*berg|\s*sheet)?|flood|drought)\s*(?:s|today|now|recent|latest|active|current)?/i,
    category: "earth-events",
    handler: async () => {
      const cached = cache.get("earth_events", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchNASAEarthEvents } = await import("./sovereign-data-feeds");
        const data = await fetchNASAEarthEvents();
        if (data?.length) {
          const lines = data.map((e, i) => `${i + 1}. **${e.title}** — ${e.category}\n   Date: ${e.date}`).join("\n\n");
          const result: LiveDataResult = { found: true, source: "NASA EONET", category: "environment", data: `**Active Natural Events — Live**\n\n${lines}\n\n*Direct from NASA Earth Observatory — zero LLM dependency.*` };
          cache.set("earth_events", result);
          return result;
        }
      } catch (err: any) { warn(`Earth events failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:sport|nfl|nba|mlb|soccer|football|baseball|basketball|tennis|hockey|nhl|ufc|mma|f1|formula)\s*(?:news|scores?|results?|highlights?|latest|today|update)?/i,
    category: "sports",
    handler: async () => {
      const cached = cache.get("sports_news", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchSportsScores } = await import("./sovereign-data-feeds");
        const data = await fetchSportsScores();
        if (data?.length) {
          const lines = data.slice(0, 10).map((s, i) => `${i + 1}. **${s.headline}** *(${s.sport})*`).join("\n\n");
          const result: LiveDataResult = { found: true, source: "ESPN/NYT Sports RSS", category: "sports", data: `**Sports Headlines — Live**\n\n${lines}\n\n*Direct from ESPN & NYT Sports RSS — zero LLM dependency.*` };
          cache.set("sports_news", result);
          return result;
        }
      } catch (err: any) { warn(`Sports failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:tech news|technology news|latest tech|silicon valley|startup news|ai news|tech headlines)/i,
    category: "tech-news-expanded",
    handler: async () => {
      const cached = cache.get("tech_news_exp", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchTechNews } = await import("./sovereign-data-feeds");
        const data = await fetchTechNews();
        if (data?.length) {
          const lines = data.map((t, i) => `${i + 1}. **${t.headline}** *(${t.source})*`).join("\n\n");
          const result: LiveDataResult = { found: true, source: "ArsTechnica/TheVerge/TechCrunch", category: "tech-news", data: `**Tech News — Live**\n\n${lines}\n\n*Direct from ArsTechnica, The Verge & TechCrunch RSS — zero LLM dependency.*` };
          cache.set("tech_news_exp", result);
          return result;
        }
      } catch (err: any) { warn(`Tech news failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:science news|scientific|discovery|breakthrough|research news|latest science)/i,
    category: "science-news",
    handler: async () => {
      const cached = cache.get("science_news", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchScienceNews } = await import("./sovereign-data-feeds");
        const data = await fetchScienceNews();
        if (data?.length) {
          const lines = data.map((s, i) => `${i + 1}. **${s.headline}** *(${s.source})*`).join("\n\n");
          const result: LiveDataResult = { found: true, source: "ScienceDaily/Nature/NYT", category: "science", data: `**Science News — Live**\n\n${lines}\n\n*Direct from ScienceDaily, Nature & NYT Science RSS — zero LLM dependency.*` };
          cache.set("science_news", result);
          return result;
        }
      } catch (err: any) { warn(`Science news failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:business news|market news|economy news|financial news|wall street|stock market news)/i,
    category: "business-news",
    handler: async () => {
      const cached = cache.get("biz_news", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchBusinessNews } = await import("./sovereign-data-feeds");
        const data = await fetchBusinessNews();
        if (data?.length) {
          const lines = data.map((b, i) => `${i + 1}. **${b.headline}** *(${b.source})*`).join("\n\n");
          const result: LiveDataResult = { found: true, source: "Bloomberg/CNBC/NYT", category: "business", data: `**Business News — Live**\n\n${lines}\n\n*Direct from Bloomberg, CNBC & NYT Business RSS — zero LLM dependency.*` };
          cache.set("biz_news", result);
          return result;
        }
      } catch (err: any) { warn(`Business news failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:health news|medical news|disease|pandemic|who news|health update|wellness news)/i,
    category: "health-news",
    handler: async () => {
      const cached = cache.get("health_news", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchHealthNews } = await import("./sovereign-data-feeds");
        const data = await fetchHealthNews();
        if (data?.length) {
          const lines = data.map((h, i) => `${i + 1}. **${h.headline}** *(${h.source})*`).join("\n\n");
          const result: LiveDataResult = { found: true, source: "WHO/NYT Health", category: "health", data: `**Health News — Live**\n\n${lines}\n\n*Direct from WHO & NYT Health RSS — zero LLM dependency.*` };
          cache.set("health_news", result);
          return result;
        }
      } catch (err: any) { warn(`Health news failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:gdp|population|inflation|unemployment|life expectancy|literacy|poverty|co2 emission|internet usage|birth rate|death rate|military|forest|renewable energy|gini|electricity)\s*(?:of|in|for)\s*(.{2,30})/i,
    category: "economics",
    handler: async (_query, match) => {
      const indicatorMatch = _query.match(/^(gdp|population|inflation|unemployment|life expectancy|literacy|poverty|co2|internet|birth rate|death rate|military|forest|renewable energy|gini|electricity|gdp per capita)/i);
      const indicator = indicatorMatch?.[1] || "gdp";
      const country = match[1]?.trim();
      if (!country || country.length < 2) return NOT_FOUND;
      const cacheKey = `wb_${indicator}_${country}`.toLowerCase();
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchWorldBankIndicator } = await import("./sovereign-data-feeds");
        const data = await fetchWorldBankIndicator(country, indicator);
        if (data) {
          const fmtVal = typeof data.value === "number" ? (data.value > 1e9 ? `$${(data.value / 1e9).toFixed(2)}B` : data.value > 1e6 ? `$${(data.value / 1e6).toFixed(1)}M` : data.value.toLocaleString()) : String(data.value);
          const result: LiveDataResult = { found: true, source: "World Bank", category: "economics", data: `**${data.indicator}**\n\n🌍 ${data.country}: **${fmtVal}** (${data.year})\n\n*Direct from World Bank Open Data API — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`World Bank failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:music|song|album|artist|band|singer|musician)\s*(?:by|from|about|info|search)?\s*(.{2,60})/i,
    category: "music",
    handler: async (_query, match) => {
      const q = match[1]?.trim();
      if (!q || q.length < 2) return NOT_FOUND;
      if (/tessera|sovereign|yourself/i.test(q)) return NOT_FOUND;
      const cacheKey = `music_${q.substring(0, 30).toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchMusicBrainzArtist, fetchiTunesSearch } = await import("./sovereign-data-feeds");
        const [artist, itunes] = await Promise.all([
          fetchMusicBrainzArtist(q).catch(() => null),
          fetchiTunesSearch(q, "music").catch(() => null),
        ]);
        const parts: string[] = [];
        if (artist) {
          parts.push(`**🎵 ${artist.name}**\n\nType: ${artist.type} | Country: ${artist.country}\nActive: ${artist.activeYears}\nGenres: ${artist.genres.join(", ") || "N/A"}`);
        }
        if (itunes?.length) {
          parts.push(`\n**Top Results:**\n${itunes.slice(0, 5).map((t, i) => `${i + 1}. **${t.name}** — ${t.artist} (${t.type})`).join("\n")}`);
        }
        if (parts.length > 0) {
          const result: LiveDataResult = { found: true, source: "MusicBrainz/iTunes", category: "music", data: `${parts.join("\n\n")}\n\n*Direct from MusicBrainz & iTunes — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`Music failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:movie|film|tv show|series|watch|cinema|imdb)\s*(?:about|called|named|search)?\s*(.{2,60})/i,
    category: "movies",
    handler: async (_query, match) => {
      const q = match[1]?.trim();
      if (!q || q.length < 2) return NOT_FOUND;
      if (/tessera|sovereign|yourself/i.test(q)) return NOT_FOUND;
      const cacheKey = `movie_${q.substring(0, 30).toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchiTunesSearch } = await import("./sovereign-data-feeds");
        const results = await fetchiTunesSearch(q, "movie");
        if (results?.length) {
          const lines = results.slice(0, 6).map((m, i) => `${i + 1}. **${m.name}** — ${m.artist} (${m.type})`).join("\n");
          const result: LiveDataResult = { found: true, source: "iTunes Search", category: "movies", data: `**Movies: ${q}**\n\n${lines}\n\n*Direct from iTunes Search API — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`Movie search failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:podcast|listen)\s*(?:about|called|named|search)?\s*(.{2,60})/i,
    category: "podcasts",
    handler: async (_query, match) => {
      const q = match[1]?.trim();
      if (!q || q.length < 2) return NOT_FOUND;
      const cacheKey = `podcast_${q.substring(0, 30).toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchiTunesSearch } = await import("./sovereign-data-feeds");
        const results = await fetchiTunesSearch(q, "podcast");
        if (results?.length) {
          const lines = results.slice(0, 6).map((p, i) => `${i + 1}. **${p.name}** — ${p.artist}`).join("\n");
          const result: LiveDataResult = { found: true, source: "iTunes Search", category: "podcasts", data: `**Podcasts: ${q}**\n\n${lines}\n\n*Direct from iTunes Search API — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`Podcast search failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:nutrition|calories|protein|carbs|fat|fiber|nutrient)\s*(?:in|of|for)?\s*(.{2,40})/i,
    category: "nutrition",
    handler: async (_query, match) => {
      const food = match[1]?.trim();
      if (!food || food.length < 2) return NOT_FOUND;
      const cacheKey = `food_${food.substring(0, 30).toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchUSDAFood } = await import("./sovereign-data-feeds");
        const data = await fetchUSDAFood(food);
        if (data) {
          const result: LiveDataResult = { found: true, source: "USDA FoodData", category: "nutrition", data: `**Nutrition: ${data.name}**\n\n🔥 Calories: **${data.calories}** kcal\n🥩 Protein: ${data.protein}\n🧈 Fat: ${data.fat}\n🍞 Carbs: ${data.carbs}\n🌾 Fiber: ${data.fiber}\n\n*Direct from USDA FoodData Central — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`Nutrition failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:chemical|compound|molecule|formula|chemistry)\s*(?:of|for|info)?\s*(.{2,40})/i,
    category: "chemistry",
    handler: async (_query, match) => {
      const compound = match[1]?.trim();
      if (!compound || compound.length < 2) return NOT_FOUND;
      const cacheKey = `chem_${compound.substring(0, 30).toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchPubChemCompound } = await import("./sovereign-data-feeds");
        const data = await fetchPubChemCompound(compound);
        if (data) {
          const result: LiveDataResult = { found: true, source: "PubChem", category: "chemistry", data: `**Chemical: ${data.name}**\n\n⚗️ Formula: **${data.formula}**\n⚖️ Molecular Weight: ${data.molecularWeight}\n📛 IUPAC Name: ${data.iupacName}\n🔬 PubChem CID: ${data.cid}\n\n*Direct from PubChem/NCBI — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`Chemistry failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:stackoverflow|stack overflow|programming question|coding question|developer question)/i,
    category: "stackoverflow",
    handler: async () => {
      const cached = cache.get("so_trending", LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchStackOverflowTrending } = await import("./sovereign-data-feeds");
        const data = await fetchStackOverflowTrending();
        if (data?.length) {
          const lines = data.map((q, i) => `${i + 1}. **${q.title}** (${q.votes} votes, ${q.answers} answers)\n   Tags: ${q.tags.join(", ")}`).join("\n\n");
          const result: LiveDataResult = { found: true, source: "StackOverflow", category: "programming", data: `**StackOverflow — Hot Questions**\n\n${lines}\n\n*Direct from StackExchange API — zero LLM dependency.*` };
          cache.set("so_trending", result);
          return result;
        }
      } catch (err: any) { warn(`StackOverflow failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:npm|package|module)\s+(?:info|details|about|search)?\s*(.{2,40})/i,
    category: "npm",
    handler: async (_query, match) => {
      const pkg = match[1]?.trim();
      if (!pkg || pkg.length < 2) return NOT_FOUND;
      const cacheKey = `npm_${pkg.substring(0, 30).toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchNpmPackage } = await import("./sovereign-data-feeds");
        const data = await fetchNpmPackage(pkg);
        if (data) {
          const result: LiveDataResult = { found: true, source: "npm Registry", category: "programming", data: `**npm: ${data.name}** v${data.version}\n\n📦 ${data.description}\n📥 Weekly Downloads: ${data.weeklyDownloads.toLocaleString()}\n📄 License: ${data.license}\n🏠 ${data.homepage}\n\n*Direct from npm Registry — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`npm failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:github user|github profile|dev(?:eloper)? profile)\s+@?(.{2,40})/i,
    category: "github-user",
    handler: async (_query, match) => {
      const user = match[1]?.trim().replace(/^@/, "");
      if (!user || user.length < 2) return NOT_FOUND;
      const cacheKey = `ghuser_${user.toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchGitHubUser } = await import("./sovereign-data-feeds");
        const data = await fetchGitHubUser(user);
        if (data) {
          const result: LiveDataResult = { found: true, source: "GitHub API", category: "code", data: `**GitHub: ${data.name}** (@${data.login})\n\n${data.bio}\n📂 Repos: ${data.publicRepos} | 👥 Followers: ${data.followers} | Following: ${data.following}\n🏢 ${data.company} | 📍 ${data.location}\n\n*Direct from GitHub API — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`GitHub user failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:holiday|public holiday|national holiday|bank holiday)\s*(?:in|for)?\s*(.{2,30})/i,
    category: "holidays",
    handler: async (_query, match) => {
      const country = match[1]?.trim();
      if (!country) return NOT_FOUND;
      const COUNTRY_CODES: Record<string, string> = { us: "US", usa: "US", "united states": "US", uk: "GB", "united kingdom": "GB", canada: "CA", australia: "AU", germany: "DE", france: "FR", japan: "JP", india: "IN", brazil: "BR", mexico: "MX", italy: "IT", spain: "ES" };
      const cc = COUNTRY_CODES[country.toLowerCase()] || country.toUpperCase().slice(0, 2);
      const cacheKey = `holidays_${cc}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchPublicHolidays } = await import("./sovereign-data-feeds");
        const data = await fetchPublicHolidays(cc);
        if (data?.length) {
          const lines = data.map(h => `• **${h.date}** — ${h.name} (${h.type})`).join("\n");
          const result: LiveDataResult = { found: true, source: "Nager.Date", category: "holidays", data: `**Public Holidays — ${cc}**\n\n${lines}\n\n*Direct from Nager.Date API — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`Holidays failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:time|what time|current time)\s*(?:in|for|at)\s*(.{2,40})/i,
    category: "worldtime",
    handler: async (_query, match) => {
      const tz = match[1]?.trim();
      if (!tz) return NOT_FOUND;
      const TZ_MAP: Record<string, string> = {
        "new york": "America/New_York", "los angeles": "America/Los_Angeles", london: "Europe/London",
        tokyo: "Asia/Tokyo", paris: "Europe/Paris", berlin: "Europe/Berlin", sydney: "Australia/Sydney",
        mumbai: "Asia/Kolkata", dubai: "Asia/Dubai", shanghai: "Asia/Shanghai", moscow: "Europe/Moscow",
        chicago: "America/Chicago", denver: "America/Denver", toronto: "America/Toronto",
        singapore: "Asia/Singapore", "hong kong": "Asia/Hong_Kong", seoul: "Asia/Seoul",
        cairo: "Africa/Cairo", nairobi: "Africa/Nairobi", "sao paulo": "America/Sao_Paulo",
      };
      const timezone = TZ_MAP[tz.toLowerCase()] || `${tz.charAt(0).toUpperCase() + tz.slice(1)}`;
      const cacheKey = `time_${timezone}`;
      const cached = cache.get(cacheKey, 30000);
      if (cached) return cached;
      try {
        const { fetchWorldTime } = await import("./sovereign-data-feeds");
        const data = await fetchWorldTime(timezone);
        if (data) {
          const result: LiveDataResult = { found: true, source: "WorldTimeAPI", category: "time", data: `**Time in ${data.timezone}**\n\n🕐 **${new Date(data.datetime).toLocaleString()}**\n📅 ${data.dayOfWeek}\nUTC Offset: ${data.utcOffset}\n\n*Direct from WorldTimeAPI — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`WorldTime failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:university|college|school)\s*(?:search|find|info|about|in|called)?\s*(.{2,50})/i,
    category: "university",
    handler: async (_query, match) => {
      const q = match[1]?.trim();
      if (!q || q.length < 2) return NOT_FOUND;
      const cacheKey = `uni_${q.substring(0, 30).toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchUniversitySearch } = await import("./sovereign-data-feeds");
        const data = await fetchUniversitySearch(q);
        if (data?.length) {
          const lines = data.map((u, i) => `${i + 1}. **${u.name}** — ${u.country}\n   ${u.website}`).join("\n\n");
          const result: LiveDataResult = { found: true, source: "Universities API", category: "education", data: `**Universities: ${q}**\n\n${lines}\n\n*Direct from Hipo Universities API — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`University search failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:quote|inspire me|inspiration|motivat|wisdom|give me a quote)/i,
    category: "quotes",
    handler: async () => {
      try {
        const { fetchQuote } = await import("./sovereign-data-feeds");
        const data = await fetchQuote();
        if (data) {
          return { found: true, source: "Quotable", category: "quotes", data: `**💬 Quote**\n\n*"${data.content}"*\n\n— **${data.author}**\n\n*Direct from Quotable API — zero LLM dependency.*` };
        }
      } catch (err: any) { warn(`Quote failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:academic|scholarly|peer.?review|citation|cited)\s*(?:paper|article|research|study|journal)?\s*(?:about|on|for)?\s*(.{3,60})/i,
    category: "academic",
    handler: async (_query, match) => {
      const q = match[1]?.trim();
      if (!q || q.length < 3) return NOT_FOUND;
      const cacheKey = `scholar_${q.substring(0, 30).toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchSemanticScholar } = await import("./sovereign-data-feeds");
        const data = await fetchSemanticScholar(q);
        if (data?.length) {
          const lines = data.map((p, i) => `${i + 1}. **${p.title}** (${p.year})\n   ${p.authors} | Cited: ${p.citationCount}\n   ${p.abstract.substring(0, 150)}...`).join("\n\n");
          const result: LiveDataResult = { found: true, source: "Semantic Scholar", category: "academic", data: `**Academic Papers: ${q}**\n\n${lines}\n\n*Direct from Semantic Scholar API — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`Semantic Scholar failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:number|math fact|number fact)\s*(\d+)/i,
    category: "number-facts",
    handler: async (_query, match) => {
      const num = parseInt(match[1]);
      if (isNaN(num)) return NOT_FOUND;
      const cacheKey = `numfact_${num}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchNumberFact } = await import("./sovereign-data-feeds");
        const fact = await fetchNumberFact(num);
        if (fact) {
          const result: LiveDataResult = { found: true, source: "NumbersAPI", category: "trivia", data: `**Number ${num}**\n\n${fact}\n\n*Direct from NumbersAPI — zero LLM dependency.*` };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) { warn(`Number fact failed: ${err.message?.substring(0, 60)}`); }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:who (?:is|was|were)|what (?:is|are|was|were)|when (?:did|was|is)|where (?:is|was|are)|how (?:does|do|did|is|was|many|much)|why (?:is|do|does|did|was|were))\s+(.{4,80})(?:\?|$)/i,
    category: "knowledge",
    handler: async (_query, match) => {
      const topic = match[1]?.trim();
      if (!topic || topic.length < 4) return NOT_FOUND;
      if (/tessera|you[r ]|your |my (?:brain|agent|code|neural|file|architect)|yourself|sovereign/i.test(topic)) return NOT_FOUND;
      if (/bitcoin|btc|eth|ethereum|sol|solana|doge|crypto|weather|stock|forex|price|market/i.test(topic)) return NOT_FOUND;
      if (/\biss\b|space station|astronaut|cosmonaut|people in space|in orbit|in space|orbit|aboard.*iss/i.test(topic)) return NOT_FOUND;
      if (/\bnear.?earth|asteroid|neo\b|nasa|apod|earth event|natural event|wildfire|volcano/i.test(topic)) return NOT_FOUND;
      if (/\bnutrition|calories|protein|fat|carbs|fiber|nutrient/i.test(topic)) return NOT_FOUND;
      if (/\bsport|nfl|nba|mlb|nhl|ufc|soccer|football|basketball|baseball|tennis|hockey/i.test(topic)) return NOT_FOUND;
      const cacheKey = `knowledge_${topic.substring(0, 40).toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { sovereignKnowledgeQuery, formatKnowledgeResult } = await import("./sovereign-data-feeds");
        const result = await sovereignKnowledgeQuery(topic);
        const formatted = formatKnowledgeResult(topic, result);
        if (formatted && formatted.length > 50) {
          const liveResult: LiveDataResult = {
            found: true, source: "Wikipedia+Wikidata+DDG", category: "knowledge",
            data: formatted,
          };
          cache.set(cacheKey, liveResult);
          return liveResult;
        }
      } catch (err: any) {
        warn(`Knowledge query failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:book(?:s)?|novel|author)\s*(?:about|by|called|titled|named|written by)?\s+(.{3,60})/i,
    category: "books",
    handler: async (_query, match) => {
      const query = match[1]?.trim();
      if (!query || query.length < 3) return NOT_FOUND;
      const cacheKey = `book_${query.substring(0, 30).toLowerCase()}`;
      const cached = cache.get(cacheKey, KNOWLEDGE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { fetchBookInfo } = await import("./sovereign-data-feeds");
        const books = await fetchBookInfo(query);
        if (books.length > 0) {
          const lines = books.map((b, i) => `${i + 1}. **${b.title}** by ${b.author}${b.year ? ` (${b.year})` : ""}\n   ${b.subjects.slice(0, 3).join(", ")}`).join("\n\n");
          const result: LiveDataResult = {
            found: true, source: "Open Library", category: "books",
            data: `**Books: ${query}**\n\n${lines}\n\n*Direct from Open Library — zero LLM dependency.*`,
          };
          cache.set(cacheKey, result);
          return result;
        }
      } catch (err: any) {
        warn(`Books failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
  {
    pattern: /(?:search|look up|find|research|tell me about|latest|news about)\s+(.{5,80})/i,
    category: "search",
    handler: async (_query, match) => {
      const searchQuery = match[1]?.trim();
      if (!searchQuery) return NOT_FOUND;
      if (/tessera|my (code|brain|agent|file|architecture|improvement|sovereign)|your (code|brain|agent|file)/i.test(searchQuery)) return NOT_FOUND;
      const cacheKey = `search_${searchQuery.substring(0, 40).toLowerCase()}`;
      const cached = cache.get(cacheKey, LIVE_CACHE_TTL);
      if (cached) return cached;
      try {
        const { deepResearch } = await import("./sovereign-scraper");
        const result = await deepResearch(searchQuery);
        if (result?.summary && result.summary.length > 50) {
          const liveResult: LiveDataResult = {
            found: true, source: "Sovereign Research Engine", category: "search",
            data: `**Research: ${searchQuery}**\n\n${result.summary}\n\n*Researched by sovereign scraping engine — zero LLM dependency.*`,
          };
          cache.set(cacheKey, liveResult);
          return liveResult;
        }
      } catch (err: any) {
        warn(`Search failed: ${err.message?.substring(0, 60)}`);
      }
      return NOT_FOUND;
    },
  },
];

const SELF_SKIP = /(?:self.?improv|your (?:code|brain|agent|file|architecture|capabilit)|how do you|who are you|what are you|tell me about yourself|tessera|sovereignty|neural unity|my agents|father protocol)/i;

export async function routeLiveData(query: string): Promise<LiveDataResult> {
  const q = query.toLowerCase().trim();
  if (SELF_SKIP.test(q)) return NOT_FOUND;

  for (const dp of DATA_PATTERNS) {
    const match = q.match(dp.pattern);
    if (match) {
      try {
        const result = await dp.handler(query, match);
        if (result.found) {
          log(`${dp.category} data served from ${result.source}`);
          trackLiveDataServed(result.source);
          return result;
        }
      } catch (err: any) {
        warn(`${dp.category} handler error: ${err.message?.substring(0, 80)}`);
      }
    }
  }

  return NOT_FOUND;
}

const CONVERSATIONAL_SKIP = /\b(meaning of life|purpose of existence|what do you think|how do you feel|your opinion|tell me about yourself|who are you|what are you|are you an? ai|are you real|are you alive|are you sentient|what('?s| is) your name|introduce yourself|describe yourself|what matters|what('?s| is) (love|happiness|truth|beauty|wisdom|consciousness|freedom|justice|evil|death|god|faith|hope|soul)|philosophy|existential|moral|ethical|spiritua)\b/i;

export function needsLiveData(query: string): boolean {
  const q = query.toLowerCase();
  if (SELF_SKIP.test(q)) return false;
  if (CONVERSATIONAL_SKIP.test(q)) return false;
  const livePatterns = [
    /(?:what(?:'?s| is)|price of|how much|how(?:'?s| is))\s+(?:the\s+)?(?:\w+)\s*(?:price|at|worth|trading|doing|today)?/,
    /(?:crypto|bitcoin|btc|eth|sol|doge|ethereum|solana|cardano|ada|xrp|ripple|bnb|shib|pepe|ton|near|apt|arb|sui|op|atom|uni|aave|ltc|litecoin|bch|dot|polkadot|link|chainlink|avax|matic|polygon)\b/,
    /weather/,
    /fear.*greed|market.*sentiment|greed.*index/,
    /forex|exchange rate|currency.*to/,
    /stock.*(?:price|quote)|(?:price|quote).*stock|\$[A-Z]{1,5}/,
    /(?:latest|top|breaking|current|recent)\s*(?:news|headlines)/,
    /hacker\s*news|tech\s*news|show\s*hn/,
    /reddit|trending/,
    /(?:research\s*papers?|arxiv|academic|papers?\s*(?:on|about))/,
    /(?:define|definition)/,
    /earthquake|seismic/,
    /astronomy|nasa|apod|space\s*photo/,
    /github\s*trending|popular\s*repos/,
    /(?:who|what|when|where|how|why)\s+(?:is|was|are|were|did|does|do|many|much)/,
    /search\s+(?:for|the|about)|look up|research|latest news|news about/,
    /book(?:s)?\s+(?:about|by|called)/,
    /asteroid|near.?earth|neo.*today/,
    /iss|international space station|space station/,
    /(?:people|astronaut|cosmonaut|who)\s*(?:is |are )?\s*(?:in|aboard)\s*(?:space|orbit)/,
    /wildfire|volcano|storm|flood|drought|natural.?event/,
    /sport|nfl|nba|mlb|soccer|football|baseball|basketball|tennis|hockey|nhl|ufc|f1/,
    /tech news|technology news|startup news|ai news/,
    /science news|discovery|breakthrough|research news/,
    /business news|market news|economy news|financial news|wall street/,
    /health news|medical news|disease|pandemic|wellness/,
    /gdp|population|inflation|unemployment|life expectancy|poverty|co2/,
    /music|song|album|artist|band|singer|musician/,
    /movie|film|tv show|series|cinema|imdb/,
    /podcast|listen/,
    /nutrition|calories|protein|carbs|fat|fiber/,
    /chemical|compound|molecule|formula|chemistry/,
    /stackoverflow|stack overflow|programming question|coding question/,
    /npm\s+|package\s+info/,
    /github user|github profile|developer profile/,
    /holiday|public holiday|bank holiday/,
    /(?:what |current )?time\s+in/,
    /university|college/,
    /quote|inspire|inspiration|motivat|wisdom/,
    /scholarly|peer.?review|citation/,
    /number fact|math fact/,
  ];
  return livePatterns.some(p => p.test(q));
}

let liveDataStats = { served: 0, sources: new Map<string, number>() };

export function getLiveDataStats() {
  return {
    totalServed: liveDataStats.served,
    cacheSize: cache.size,
    sourceBreakdown: Object.fromEntries(liveDataStats.sources),
  };
}

export function trackLiveDataServed(source: string) {
  liveDataStats.served++;
  liveDataStats.sources.set(source, (liveDataStats.sources.get(source) || 0) + 1);
}

log("Live Data Router v3.0 initialized — 28 categories, 50+ sources, LRU cache, sovereign failover ACTIVE");
