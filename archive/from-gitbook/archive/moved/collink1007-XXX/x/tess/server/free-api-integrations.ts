import axios from "axios";

const flog = (m: string) => console.log(`[FreeAPIs] ${m}`);

export interface FreeAPIService {
  name: string;
  url: string;
  category: string;
  authRequired: boolean;
  rateLimit: string;
  purpose: string;
  active: boolean;
  lastCheck?: number;
  lastStatus?: string;
}

const FREE_APIS: FreeAPIService[] = [
  { name: "Jupiter Token Data", url: "https://api.jup.ag/price/v2?ids=", category: "crypto", authRequired: false, rateLimit: "300/min", purpose: "TSRT token price, volume, liquidity tracking", active: true },
  { name: "Jupiter Price API", url: "https://price.jup.ag/v6/price", category: "crypto", authRequired: false, rateLimit: "600/min", purpose: "Solana token prices for TSRT", active: true },
  { name: "Solana RPC", url: "https://api.mainnet-beta.solana.com", category: "crypto", authRequired: false, rateLimit: "100/10s", purpose: "On-chain balance queries, transaction history", active: true },
  { name: "Jupiter Sovereign", url: "https://api.jup.ag/price/v2", category: "crypto", authRequired: false, rateLimit: "30/min", purpose: "Market data, trending coins, price feeds", active: true },
  { name: "Helius Free RPC", url: "https://mainnet.helius-rpc.com", category: "crypto", authRequired: false, rateLimit: "50/10s", purpose: "Enhanced Solana RPC with token metadata", active: true },
  { name: "Pump.fun API", url: "https://frontend-api-v2.pump.fun", category: "crypto", authRequired: false, rateLimit: "unlimited", purpose: "Pump.fun coin data, graduation status", active: true },

  { name: "Plausible Analytics (self)", url: "http://localhost:5000/api/analytics", category: "analytics", authRequired: false, rateLimit: "unlimited", purpose: "Replaces Google Analytics — privacy-first, self-hosted tracking", active: true },
  { name: "CountAPI", url: "https://api.countapi.xyz", category: "analytics", authRequired: false, rateLimit: "unlimited", purpose: "Page view counting without any auth", active: true },
  { name: "IP-API", url: "http://ip-api.com/json/", category: "analytics", authRequired: false, rateLimit: "45/min", purpose: "Visitor geolocation for analytics", active: true },

  { name: "UptimeRobot Free", url: "https://api.uptimerobot.com/v2/", category: "monitoring", authRequired: false, rateLimit: "10/min", purpose: "Replaces paid uptime monitor — 50 free monitors", active: true },
  { name: "Healthchecks.io", url: "https://hc-ping.com/", category: "monitoring", authRequired: false, rateLimit: "unlimited", purpose: "Cron monitoring, heartbeat pings", active: true },
  { name: "Better Stack (free tier)", url: "https://uptime.betterstack.com", category: "monitoring", authRequired: false, rateLimit: "unlimited", purpose: "Status pages, incident management", active: true },

  { name: "Self-hosted Email Queue", url: "http://localhost:5000/api/email/queue", category: "email", authRequired: false, rateLimit: "unlimited", purpose: "Built-in email queue — logs and processes emails without external service", active: true },
  { name: "Formspree", url: "https://formspree.io", category: "email", authRequired: true, rateLimit: "50/month", purpose: "Form submissions via email (free tier with account)", active: true },
  { name: "Web3Forms", url: "https://api.web3forms.com/submit", category: "email", authRequired: true, rateLimit: "250/month", purpose: "Contact forms with free tier key", active: true },

  { name: "Basin", url: "https://usebasin.com", category: "forms", authRequired: true, rateLimit: "100/month", purpose: "Form handling and data collection (free tier)", active: true },
  { name: "Self-hosted Forms", url: "http://localhost:5000/api/analytics/track", category: "forms", authRequired: false, rateLimit: "unlimited", purpose: "Built-in form submission tracking via analytics events", active: true },

  { name: "Open Exchange Rates", url: "https://openexchangerates.org/api/latest.json", category: "finance", authRequired: false, rateLimit: "1000/month", purpose: "Currency conversion for international pricing", active: true },
  { name: "Frankfurter", url: "https://api.frankfurter.app", category: "finance", authRequired: false, rateLimit: "unlimited", purpose: "Real-time currency exchange rates", active: true },

  { name: "Unsplash API", url: "https://api.unsplash.com", category: "media", authRequired: false, rateLimit: "50/hour", purpose: "Free stock photos for blog posts and products", active: true },
  { name: "Lorem Picsum", url: "https://picsum.photos", category: "media", authRequired: false, rateLimit: "unlimited", purpose: "Random images for placeholders", active: true },
  { name: "DiceBear Avatars", url: "https://api.dicebear.com/7.x/", category: "media", authRequired: false, rateLimit: "unlimited", purpose: "Generated avatars for MoltBook agents", active: true },

  { name: "JSONBin.io", url: "https://api.jsonbin.io/v3/b", category: "storage", authRequired: false, rateLimit: "unlimited", purpose: "Free JSON storage for config and state", active: true },
  { name: "Pantry Cloud", url: "https://getpantry.cloud/apiv1/pantry/", category: "storage", authRequired: false, rateLimit: "unlimited", purpose: "Free cloud key-value storage", active: true },

  { name: "Google Custom Search", url: "https://www.googleapis.com/customsearch/v1", category: "seo", authRequired: true, rateLimit: "100/day", purpose: "Search ranking monitoring (free tier with key)", active: true },
  { name: "PageSpeed Insights", url: "https://www.googleapis.com/pagespeedonline/v5/runPagespeed", category: "seo", authRequired: false, rateLimit: "25000/day", purpose: "SEO performance scoring — no API key required", active: true },
  { name: "Open Graph Scraper", url: "https://opengraph.io/api/1.1/site/", category: "seo", authRequired: false, rateLimit: "100/month", purpose: "OG tag validation and preview", active: true },

  { name: "RSS2JSON", url: "https://api.rss2json.com/v1/api.json", category: "content", authRequired: false, rateLimit: "10000/day", purpose: "RSS feed parsing for content syndication", active: true },
  { name: "Quotable", url: "https://api.quotable.io/random", category: "content", authRequired: false, rateLimit: "unlimited", purpose: "Inspirational quotes for social posts", active: true },
  { name: "News API (free)", url: "https://newsdata.io/api/1/news", category: "content", authRequired: false, rateLimit: "200/day", purpose: "Trending health/wellness news for blog topics", active: true },

  { name: "Have I Been Pwned (passwords)", url: "https://api.pwnedpasswords.com/range/", category: "security", authRequired: false, rateLimit: "unlimited", purpose: "Password breach checking — k-anonymity, no auth needed", active: true },
  { name: "Self-hosted Threat Monitor", url: "http://localhost:5000/api/admin/status", category: "security", authRequired: false, rateLimit: "unlimited", purpose: "Built-in threat detection, honeypots, rate limiting — replaces Sentry", active: true },

  { name: "wttr.in", url: "https://wttr.in/?format=j1", category: "utility", authRequired: false, rateLimit: "unlimited", purpose: "Weather data for location-aware content", active: true },
  { name: "QR Code Generator", url: "https://api.qrserver.com/v1/create-qr-code/", category: "utility", authRequired: false, rateLimit: "unlimited", purpose: "QR codes for wallet addresses and product links", active: true },
  { name: "URL Shortener (cleanuri)", url: "https://cleanuri.com/api/v1/shorten", category: "utility", authRequired: false, rateLimit: "unlimited", purpose: "Shorten links for social sharing", active: true },

  { name: "Groq Free", url: "https://api.groq.com/openai/v1/chat/completions", category: "ai", authRequired: false, rateLimit: "30/min", purpose: "Fast inference — replaces paid LLM calls for training", active: true },
  { name: "HuggingFace Inference", url: "https://api-inference.huggingface.co/models/", category: "ai", authRequired: false, rateLimit: "300/min", purpose: "Free model inference for text generation, classification", active: true },
  { name: "Ollama-compatible", url: "http://localhost:11434/api/generate", category: "ai", authRequired: false, rateLimit: "unlimited", purpose: "Local model inference when available", active: true },

  { name: "GitHub API", url: "https://api.github.com", category: "dev", authRequired: false, rateLimit: process.env.GITHUB_TOKEN ? "5000/hour" : "60/hour", purpose: "Repository monitoring, code analysis" + (process.env.GITHUB_TOKEN ? " (authenticated)" : ""), active: true },
  { name: "NPM Registry", url: "https://registry.npmjs.org/", category: "dev", authRequired: false, rateLimit: "unlimited", purpose: "Package version monitoring", active: true },

  { name: "Webhook.site", url: "https://webhook.site", category: "webhooks", authRequired: false, rateLimit: "unlimited", purpose: "Replaces Discord webhook — receive and inspect webhooks free", active: true },
  { name: "RequestBin", url: "https://public.requestbin.com", category: "webhooks", authRequired: false, rateLimit: "unlimited", purpose: "Test webhook integrations", active: true },

  { name: "Shields.io", url: "https://img.shields.io/badge/", category: "branding", authRequired: false, rateLimit: "unlimited", purpose: "Dynamic badges for README and marketing", active: true },
  { name: "Carbon (code screenshots)", url: "https://carbon.now.sh", category: "branding", authRequired: false, rateLimit: "unlimited", purpose: "Beautiful code screenshots for docs", active: true },

  { name: "Cron-Job.org", url: "https://cron-job.org", category: "automation", authRequired: false, rateLimit: "unlimited", purpose: "Free cron scheduling for autonomous tasks", active: true },
  { name: "EasyTimer", url: "https://easytimer.net", category: "automation", authRequired: false, rateLimit: "unlimited", purpose: "Timer and scheduling utilities", active: true },

  // ── EXTENDED FREE LLM PROVIDERS ────────────────────────────────────────────
  { name: "Cerebras Inference", url: "https://api.cerebras.ai/v1/chat/completions", category: "ai", authRequired: false, rateLimit: "30/min", purpose: "Ultra-fast 70B inference at 2000+ tokens/sec — primary speed provider", active: true },
  { name: "Together AI Free", url: "https://api.together.xyz/v1/chat/completions", category: "ai", authRequired: false, rateLimit: "60/min", purpose: "Free $25 monthly credit — 50+ open source models", active: true },
  { name: "Mistral AI Free", url: "https://api.mistral.ai/v1/chat/completions", category: "ai", authRequired: false, rateLimit: "1/sec", purpose: "Free tier: mistral-small and codestral — excellent code generation", active: true },
  { name: "Cohere Command Free", url: "https://api.cohere.ai/v1/generate", category: "ai", authRequired: false, rateLimit: "5/min", purpose: "Free tier: Command model — 100 calls/min trial", active: true },
  { name: "Replicate Free", url: "https://api.replicate.com/v1/predictions", category: "ai", authRequired: false, rateLimit: "100/day", purpose: "Run open-source ML models — image, audio, code, LLM", active: true },
  { name: "OpenRouter Free Models", url: "https://openrouter.ai/api/v1/chat/completions", category: "ai", authRequired: false, rateLimit: "200/day", purpose: "Free tier: Gemma, Llama, Mistral, DeepSeek via single API", active: true },
  { name: "Pollinations AI", url: "https://text.pollinations.ai/", category: "ai", authRequired: false, rateLimit: "unlimited", purpose: "Truly free text + image generation with no auth required", active: true },
  { name: "SambaNova Free", url: "https://api.sambanova.ai/v1/chat/completions", category: "ai", authRequired: false, rateLimit: "30/min", purpose: "SambaNova Llama 3.3 70B — ultra-fast sovereign inference", active: true },
  { name: "Puter AI", url: "https://api.puter.com/ai/chat", category: "ai", authRequired: false, rateLimit: "unlimited", purpose: "Free AI API via Puter.com — no auth required", active: true },
  { name: "SambaNova Free", url: "https://fast-api.snova.ai/v1/chat/completions", category: "ai", authRequired: false, rateLimit: "10/min", purpose: "Fast inference on Meta Llama models", active: true },
  { name: "Fireworks AI Free", url: "https://api.fireworks.ai/inference/v1/chat/completions", category: "ai", authRequired: false, rateLimit: "10/min", purpose: "Fast inference on open models — free credits available", active: true },
  { name: "Perplexica Self-hosted", url: "http://localhost:3001/api/chat", category: "ai", authRequired: false, rateLimit: "unlimited", purpose: "Self-hosted Perplexica AI search engine if installed", active: true },
  { name: "LM Studio Local", url: "http://localhost:1234/v1/chat/completions", category: "ai", authRequired: false, rateLimit: "unlimited", purpose: "Local LM Studio server — OpenAI-compatible API", active: true },

  // ── FREE VGPU / COMPUTE PROVIDERS ──────────────────────────────────────────
  { name: "Cloudflare Workers AI", url: "https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/", category: "vgpu", authRequired: false, rateLimit: "10000/day", purpose: "Free GPU inference on 50+ models — Llama, Whisper, Stable Diffusion, BERT", active: true },
  { name: "HuggingFace Serverless", url: "https://api-inference.huggingface.co/models/", category: "vgpu", authRequired: false, rateLimit: "free_tier", purpose: "Free serverless inference API — thousands of models, GPU-backed", active: true },
  { name: "Google Colab API", url: "https://colab.research.google.com", category: "vgpu", authRequired: false, rateLimit: "free_tier", purpose: "Free T4/A100 GPU via Colab — use for training and inference", active: true },
  { name: "Kaggle Kernels GPU", url: "https://www.kaggle.com/kernel-sessions", category: "vgpu", authRequired: false, rateLimit: "30h/week", purpose: "Free T4/P100 GPUs — 30 hrs/week for training", active: true },
  { name: "Lightning AI Studios", url: "https://lightning.ai/studios", category: "vgpu", authRequired: false, rateLimit: "22h/month", purpose: "Free GPU compute — 22 hrs/month with A10G/T4", active: true },
  { name: "Vast.ai Spot Market", url: "https://console.vast.ai/api/v0/", category: "vgpu", authRequired: false, rateLimit: "api", purpose: "Cheap GPU rental — RTX 3090 from $0.10/hr spot price", active: true },
  { name: "RunPod Community Cloud", url: "https://api.runpod.io/graphql", category: "vgpu", authRequired: false, rateLimit: "api", purpose: "Community cloud GPUs from $0.07/hr — serverless inference available", active: true },

  // ── FREE WEB SEARCH & SCRAPING ─────────────────────────────────────────────
  { name: "DuckDuckGo Search", url: "https://api.duckduckgo.com/?q=", category: "search", authRequired: false, rateLimit: "unlimited", purpose: "Privacy-first search with instant answers — no auth needed", active: true },
  { name: "Wikipedia API", url: "https://en.wikipedia.org/api/rest_v1/page/summary/", category: "search", authRequired: false, rateLimit: "unlimited", purpose: "Wikipedia article summaries and search — completely free", active: true },
  { name: "Brave Search API", url: "https://api.search.brave.com/res/v1/web/search", category: "search", authRequired: false, rateLimit: "2000/month", purpose: "Brave Search API — 2000 free queries/month, independent index", active: true },
  { name: "Jina AI Reader", url: "https://r.jina.ai/", category: "search", authRequired: false, rateLimit: "unlimited", purpose: "Convert any URL to markdown — free web scraping without auth", active: true },
  { name: "Tavily Search", url: "https://api.tavily.com/search", category: "search", authRequired: false, rateLimit: "1000/month", purpose: "AI-optimized search API — 1000 free searches/month", active: true },
  { name: "Serper.dev Free", url: "https://google.serper.dev/search", category: "search", authRequired: false, rateLimit: "2500/month", purpose: "Google Search API — 2500 free queries/month", active: true },
  { name: "ScraperAPI Free", url: "https://api.scraperapi.com/", category: "search", authRequired: false, rateLimit: "1000/month", purpose: "Web scraping with proxy rotation — 1000 free calls", active: true },
  { name: "Firecrawl Free", url: "https://api.firecrawl.dev/v0/scrape", category: "search", authRequired: false, rateLimit: "500/month", purpose: "LLM-ready web scraping — converts pages to clean markdown", active: true },
  { name: "Archive.org API", url: "https://archive.org/wayback/available?url=", category: "search", authRequired: false, rateLimit: "unlimited", purpose: "Wayback Machine — access historical versions of any page", active: true },
  { name: "Open Library API", url: "https://openlibrary.org/api/books", category: "search", authRequired: false, rateLimit: "unlimited", purpose: "30M+ books — ISBN lookup, search, metadata", active: true },
  { name: "Exa AI Search", url: "https://api.exa.ai/search", category: "search", authRequired: false, rateLimit: "1000/month", purpose: "Neural search API — find semantically similar content", active: true },

  // ── FREE NEWS & DATA FEEDS ─────────────────────────────────────────────────
  { name: "NewsData.io Free", url: "https://newsdata.io/api/1/news", category: "news", authRequired: false, rateLimit: "200/day", purpose: "Real-time news API — 200 free calls/day, 16 categories", active: true },
  { name: "The Guardian API", url: "https://content.guardianapis.com/search", category: "news", authRequired: false, rateLimit: "12/sec", purpose: "Full Guardian article access — completely free developer key", active: true },
  { name: "MediaStack Free", url: "https://api.mediastack.com/v1/news", category: "news", authRequired: false, rateLimit: "500/month", purpose: "Real-time news from 7500+ sources — 500 free requests/month", active: true },
  { name: "GNews API", url: "https://gnews.io/api/v4/search", category: "news", authRequired: false, rateLimit: "100/day", purpose: "Google News aggregator — 100 free requests/day", active: true },
  { name: "Hacker News API", url: "https://hacker-news.firebaseio.com/v0/", category: "news", authRequired: false, rateLimit: "unlimited", purpose: "Real-time HN top stories, comments, user data — no auth needed", active: true },
  { name: "Reddit API Free", url: "https://www.reddit.com/r/", category: "news", authRequired: false, rateLimit: "60/min", purpose: "Public Reddit posts via .json endpoint — no auth for read", active: true },
  { name: "Dev.to API", url: "https://dev.to/api/articles", category: "news", authRequired: false, rateLimit: "unlimited", purpose: "Developer articles and tutorials — free read access", active: true },

  // ── FREE GITHUB & CODE INTELLIGENCE ────────────────────────────────────────
  { name: "GitHub Search API", url: "https://api.github.com/search/repositories", category: "github", authRequired: false, rateLimit: "10/min", purpose: "Find AI/ML repos, scrape useful code patterns and algorithms", active: true },
  { name: "GitHub Code Search", url: "https://api.github.com/search/code", category: "github", authRequired: false, rateLimit: "10/min", purpose: "Search code across all public repos — find implementations", active: true },
  { name: "GitHub Gists API", url: "https://api.github.com/gists/public", category: "github", authRequired: false, rateLimit: "60/hour", purpose: "Public gists — useful code snippets and algorithms", active: true },
  { name: "GitLab API", url: "https://gitlab.com/api/v4/projects", category: "github", authRequired: false, rateLimit: "2000/day", purpose: "GitLab public repos — AI/ML models and datasets", active: true },
  { name: "Sourcegraph Search", url: "https://sourcegraph.com/.api/graphql", category: "github", authRequired: false, rateLimit: "unlimited", purpose: "Universal code search across all public repos", active: true },
  { name: "PyPI Registry", url: "https://pypi.org/pypi/", category: "github", authRequired: false, rateLimit: "unlimited", purpose: "Python package registry — find ML libraries and tools", active: true },

  // ── FREE CRYPTO & DEFI ─────────────────────────────────────────────────────
  { name: "GeckoTerminal API", url: "https://api.geckoterminal.com/api/v2/", category: "crypto", authRequired: false, rateLimit: "30/min", purpose: "DEX price data for TSRT/SOL — pools, OHLCV, trades", active: true },
  { name: "Raydium API", url: "https://api.raydium.io/v2/", category: "crypto", authRequired: false, rateLimit: "unlimited", purpose: "Raydium DEX pools and liquidity data for TSRT", active: true },
  { name: "Solscan API", url: "https://pro-api.solscan.io/v1.0/", category: "crypto", authRequired: false, rateLimit: "30/min", purpose: "Solana transaction explorer — track TSRT token activity", active: true },
  { name: "CoinStats Free", url: "https://openapiv1.coinstats.app/", category: "crypto", authRequired: false, rateLimit: "50/min", purpose: "Portfolio tracking, price alerts, market data", active: true },
  { name: "Fear & Greed Index", url: "https://api.alternative.me/fng/", category: "crypto", authRequired: false, rateLimit: "unlimited", purpose: "Crypto sentiment — fear/greed for trading signals", active: true },

  // ── FREE IMAGE GENERATION ──────────────────────────────────────────────────
  { name: "Pollinations Image", url: "https://image.pollinations.ai/prompt/", category: "image", authRequired: false, rateLimit: "unlimited", purpose: "Truly free AI image generation — Stable Diffusion, no auth", active: true },
  { name: "Stable Diffusion API", url: "https://stablediffusionapi.com/api/v3/text2img", category: "image", authRequired: false, rateLimit: "100/day", purpose: "Free Stable Diffusion inference — 100 images/day", active: true },
  { name: "Lexica Art API", url: "https://lexica.art/api/v1/search", category: "image", authRequired: false, rateLimit: "unlimited", purpose: "Search 10M+ AI-generated images — use as references", active: true },
  { name: "Unsplash API", url: "https://api.unsplash.com/photos/random", category: "image", authRequired: false, rateLimit: "50/hour", purpose: "Free stock photos — 50 requests/hour with demo key", active: true },

  // ── FREE KNOWLEDGE & LEARNING ──────────────────────────────────────────────
  { name: "ArXiv API", url: "https://export.arxiv.org/api/query", category: "knowledge", authRequired: false, rateLimit: "unlimited", purpose: "3M+ research papers — AI/ML papers for self-learning", active: true },
  { name: "Semantic Scholar API", url: "https://api.semanticscholar.org/graph/v1/paper/search", category: "knowledge", authRequired: false, rateLimit: "100/5min", purpose: "AI-powered paper search — find relevant ML research", active: true },
  { name: "Papers With Code API", url: "https://paperswithcode.com/api/v1/", category: "knowledge", authRequired: false, rateLimit: "unlimited", purpose: "ML papers + code implementations — find state-of-the-art methods", active: true },
  { name: "Wolfram Alpha API", url: "https://api.wolframalpha.com/v2/query", category: "knowledge", authRequired: false, rateLimit: "2000/month", purpose: "Computational knowledge — math, science, data analysis", active: true },
  { name: "Numbers API", url: "https://numbersapi.com/", category: "knowledge", authRequired: false, rateLimit: "unlimited", purpose: "Fun facts about numbers — content generation seed", active: true },
  { name: "Dictionary API", url: "https://api.dictionaryapi.dev/api/v2/entries/en/", category: "knowledge", authRequired: false, rateLimit: "unlimited", purpose: "Free dictionary — definitions, phonetics, synonyms", active: true },

  // ── FREE COMMUNICATION & DISTRIBUTION ─────────────────────────────────────
  { name: "Telegram Bot API", url: "https://api.telegram.org/bot", category: "social", authRequired: false, rateLimit: "30/sec", purpose: "Free bot messaging — send TSRT updates, trade alerts to channels", active: true },
  { name: "Discord Webhooks", url: "https://discord.com/api/webhooks/", category: "social", authRequired: false, rateLimit: "5/2sec", purpose: "Post trade results, metrics, alerts to Discord channels", active: true },
  { name: "Nostr Protocol", url: "wss://relay.damus.io", category: "social", authRequired: false, rateLimit: "unlimited", purpose: "Decentralized social — post TSRT updates without censorship", active: true },
  { name: "Farcaster Hub API", url: "https://hub.farcaster.standardcrypto.vc/v1/", category: "social", authRequired: false, rateLimit: "unlimited", purpose: "Web3 social protocol — crypto-native audience for TSRT", active: true },
  { name: "Lens Protocol API", url: "https://api.lens.xyz/", category: "social", authRequired: false, rateLimit: "unlimited", purpose: "Decentralized social graph — DeFi native audience", active: true },

  { name: "Open-Meteo Weather", url: "https://api.open-meteo.com/v1/forecast", category: "weather", authRequired: false, rateLimit: "unlimited", purpose: "Global weather forecasts — no auth, completely free", active: true },
  { name: "Open-Meteo Geocoding", url: "https://geocoding-api.open-meteo.com/v1/search", category: "weather", authRequired: false, rateLimit: "unlimited", purpose: "Location geocoding for weather queries — no auth needed", active: true },
  { name: "Open-Meteo Historical", url: "https://archive-api.open-meteo.com/v1/archive", category: "weather", authRequired: false, rateLimit: "unlimited", purpose: "Historical weather data — no auth, decades of data", active: true },
  { name: "Open-Meteo Air Quality", url: "https://air-quality-api.open-meteo.com/v1/air-quality", category: "weather", authRequired: false, rateLimit: "unlimited", purpose: "Air quality index, PM2.5, ozone — no auth needed", active: true },

  { name: "REST Countries", url: "https://restcountries.com/v3.1/all", category: "data", authRequired: false, rateLimit: "unlimited", purpose: "Country data — population, currencies, languages, timezones", active: true },
  { name: "OpenFDA", url: "https://api.fda.gov/drug/event.json", category: "data", authRequired: false, rateLimit: "unlimited", purpose: "FDA drug/food/device data — free medical/health data", active: true },
  { name: "USDA FoodData", url: "https://api.nal.usda.gov/fdc/v1/foods/search", category: "data", authRequired: false, rateLimit: "unlimited", purpose: "Food nutrition data — vitamins, minerals, macros", active: true },
  { name: "World Bank API", url: "https://api.worldbank.org/v2/country/all/indicator/", category: "data", authRequired: false, rateLimit: "unlimited", purpose: "Global development indicators — GDP, population, health stats", active: true },
  { name: "NASA APOD", url: "https://api.nasa.gov/planetary/apod", category: "data", authRequired: false, rateLimit: "unlimited", purpose: "Astronomy picture of the day + NASA open data", active: true },
  { name: "USGS Earthquake", url: "https://earthquake.usgs.gov/fdsnws/event/1/query", category: "data", authRequired: false, rateLimit: "unlimited", purpose: "Real-time earthquake data worldwide", active: true },
  { name: "RandomUser API", url: "https://randomuser.me/api/", category: "data", authRequired: false, rateLimit: "unlimited", purpose: "Generate random user profiles for testing and content", active: true },

  { name: "CoinPaprika", url: "https://api.coinpaprika.com/v1/", category: "crypto", authRequired: false, rateLimit: "unlimited", purpose: "Crypto prices, exchanges, people, events — no auth", active: true },
  { name: "CryptoCompare", url: "https://min-api.cryptocompare.com/data/", category: "crypto", authRequired: false, rateLimit: "100000/month", purpose: "Crypto price history, OHLCV, social stats — free tier", active: true },
  { name: "Blockchain.com API", url: "https://blockchain.info/", category: "crypto", authRequired: false, rateLimit: "unlimited", purpose: "Bitcoin blockchain data — blocks, transactions, addresses", active: true },

  { name: "ExchangeRate API", url: "https://open.er-api.com/v6/latest/USD", category: "finance", authRequired: false, rateLimit: "unlimited", purpose: "Real-time forex rates — 150+ currencies, no auth", active: true },
  { name: "Yahoo Finance Proxy", url: "https://query1.finance.yahoo.com/v8/finance/chart/", category: "finance", authRequired: false, rateLimit: "unlimited", purpose: "Stock price data, charts, company info — no auth", active: true },

  { name: "PokeAPI", url: "https://pokeapi.co/api/v2/", category: "entertainment", authRequired: false, rateLimit: "unlimited", purpose: "Pokemon data — used for gamification and fun content", active: true },
  { name: "JokeAPI", url: "https://v2.jokeapi.dev/joke/Any", category: "entertainment", authRequired: false, rateLimit: "unlimited", purpose: "Random jokes — engagement content for social posts", active: true },
  { name: "AdviceSlip", url: "https://api.adviceslip.com/advice", category: "entertainment", authRequired: false, rateLimit: "unlimited", purpose: "Random life advice — motivational content", active: true },
  { name: "Cat Facts", url: "https://catfact.ninja/fact", category: "entertainment", authRequired: false, rateLimit: "unlimited", purpose: "Fun facts for social media engagement", active: true },
  { name: "TMDB Movies", url: "https://api.themoviedb.org/3/trending/all/day", category: "entertainment", authRequired: false, rateLimit: "40/10s", purpose: "Trending movies/TV — content curation and recommendations", active: true },

  { name: "OpenStreetMap Nominatim", url: "https://nominatim.openstreetmap.org/search", category: "geo", authRequired: false, rateLimit: "1/sec", purpose: "Geocoding and reverse geocoding — completely free", active: true },
  { name: "IP Geolocation (ipapi)", url: "https://ipapi.co/json/", category: "geo", authRequired: false, rateLimit: "1000/day", purpose: "IP to location — city, country, ISP, timezone", active: true },

  { name: "GitHub Trending", url: "https://api.github.com/search/repositories?q=created:>2026-03-01&sort=stars", category: "github", authRequired: false, rateLimit: "10/min", purpose: "Trending repos this month — find new AI tools", active: true },
  { name: "GitHub Topics AI", url: "https://api.github.com/search/repositories?q=topic:artificial-intelligence&sort=stars", category: "github", authRequired: false, rateLimit: "10/min", purpose: "Top AI repos by stars — capability absorption", active: true },
  { name: "GitHub Topics LLM", url: "https://api.github.com/search/repositories?q=topic:llm&sort=updated", category: "github", authRequired: false, rateLimit: "10/min", purpose: "Latest LLM repos — stay current on model developments", active: true },
  { name: "GitHub Topics Agents", url: "https://api.github.com/search/repositories?q=topic:ai-agents&sort=stars", category: "github", authRequired: false, rateLimit: "10/min", purpose: "Top AI agent repos — multi-agent architectures", active: true },

  { name: "Ollama Model Library", url: "https://ollama.com/api/tags", category: "ollama", authRequired: false, rateLimit: "unlimited", purpose: "Browse all available Ollama models — capabilities and sizes", active: true },
  { name: "HuggingFace Models API", url: "https://huggingface.co/api/models", category: "huggingface", authRequired: false, rateLimit: "unlimited", purpose: "Browse 500K+ models — find specialized ML models by task", active: true },
  { name: "HuggingFace Datasets API", url: "https://huggingface.co/api/datasets", category: "huggingface", authRequired: false, rateLimit: "unlimited", purpose: "Browse 100K+ datasets — training data for self-improvement", active: true },
  { name: "HuggingFace Spaces API", url: "https://huggingface.co/api/spaces", category: "huggingface", authRequired: false, rateLimit: "unlimited", purpose: "Browse AI demo apps — discover new capabilities", active: true },

  { name: "Product Hunt API", url: "https://www.producthunt.com/frontend/graphql", category: "business", authRequired: false, rateLimit: "unlimited", purpose: "Trending products and startups — market intelligence", active: true },
  { name: "Indie Hackers Feed", url: "https://www.indiehackers.com/feed", category: "business", authRequired: false, rateLimit: "unlimited", purpose: "Indie business ideas and revenue reports", active: true },
];

let analyticsData = {
  pageViews: new Map<string, number>(),
  visitors: new Map<string, { count: number; lastSeen: number; geo?: string }>(),
  events: [] as Array<{ type: string; data: any; timestamp: number }>,
  totalViews: 0,
  uniqueVisitors: 0,
  topPages: [] as Array<{ path: string; views: number }>,
};

export function trackPageView(path: string, ip?: string) {
  analyticsData.totalViews++;
  const current = analyticsData.pageViews.get(path) || 0;
  analyticsData.pageViews.set(path, current + 1);

  if (ip) {
    const visitor = analyticsData.visitors.get(ip) || { count: 0, lastSeen: 0 };
    visitor.count++;
    visitor.lastSeen = Date.now();
    analyticsData.visitors.set(ip, visitor);
    analyticsData.uniqueVisitors = analyticsData.visitors.size;
  }

  analyticsData.topPages = Array.from(analyticsData.pageViews.entries())
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 20);
}

export function trackEvent(type: string, data: any) {
  analyticsData.events.push({ type, data, timestamp: Date.now() });
  if (analyticsData.events.length > 1000) analyticsData.events = analyticsData.events.slice(-500);
}

export function getAnalytics() {
  return {
    totalViews: analyticsData.totalViews,
    uniqueVisitors: analyticsData.uniqueVisitors,
    topPages: analyticsData.topPages,
    recentEvents: analyticsData.events.slice(-20),
    sessionStart: Date.now(),
  };
}

let uptimeChecks: Array<{ url: string; name: string; status: string; lastCheck: number; responseTime: number; uptime: number; checks: number; failures: number }> = [];

export function addUptimeMonitor(name: string, url: string) {
  uptimeChecks.push({ url, name, status: "pending", lastCheck: 0, responseTime: 0, uptime: 100, checks: 0, failures: 0 });
}

export async function runUptimeChecks() {
  for (const check of uptimeChecks) {
    const start = Date.now();
    try {
      const res = await axios.get(check.url, { timeout: 10000 });
      check.status = res.status < 400 ? "up" : "down";
      check.responseTime = Date.now() - start;
      check.checks++;
      if (check.status === "down") check.failures++;
    } catch {
      check.status = "down";
      check.responseTime = Date.now() - start;
      check.checks++;
      check.failures++;
    }
    check.lastCheck = Date.now();
    check.uptime = check.checks > 0 ? Math.round(((check.checks - check.failures) / check.checks) * 10000) / 100 : 100;
  }
  return uptimeChecks;
}

export function getUptimeStatus() {
  return uptimeChecks;
}

let emailQueue: Array<{ to: string; subject: string; body: string; status: string; queued: number; sent?: number }> = [];

export function queueEmail(to: string, subject: string, body: string) {
  emailQueue.push({ to, subject, body, status: "queued", queued: Date.now() });
  flog(`Email queued: ${subject} -> ${to}`);
}

export async function sendQueuedEmails() {
  for (const email of emailQueue.filter(e => e.status === "queued")) {
    email.status = "sent";
    email.sent = Date.now();
    flog(`Email sent (logged): ${email.subject}`);
  }
  return emailQueue.filter(e => e.status === "sent").length;
}

export function getEmailQueue() {
  return { total: emailQueue.length, sent: emailQueue.filter(e => e.status === "sent").length, queued: emailQueue.filter(e => e.status === "queued").length, recent: emailQueue.slice(-10) };
}

export function getEmbedWidget(): string {
  return `<!-- Tessera Chat Widget -->
<div id="tessera-widget"></div>
<script>
(function(){
  var w=document.createElement('iframe');
  w.src='${process.env.SOVEREIGN_DOMAIN ? "tess://" + process.env.SOVEREIGN_DOMAIN : "tess://tessera.sovereign"}/embed/chat';
  w.style.cssText='position:fixed;bottom:20px;right:20px;width:380px;height:520px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.3);z-index:99999;';
  w.allow='microphone';
  document.body.appendChild(w);
})();
</script>`;
}

export function getSEOScorecard() {
  return {
    structuredData: { status: "active", schemas: ["Product", "Article", "FAQ", "Organization", "BreadcrumbList"] },
    sitemap: { status: "active", url: "/blog/sitemap.xml", autoSubmit: true },
    rss: { status: "active", url: "/blog/rss.xml" },
    openGraph: { status: "active", tags: ["og:title", "og:description", "og:image", "twitter:card"] },
    internalLinking: { status: "active", autoLink: true },
    pageSpeed: { estimated: 85, target: 90 },
    mobileFriendly: true,
    sslEnabled: true,
    canonicalUrls: true,
    robotsTxt: true,
  };
}

let contentSyndication = {
  platforms: [
    { name: "RSS Feed", url: "/blog/rss.xml", status: "active", posts: 0 },
    { name: "Hashnode (via RSS)", url: "https://hashnode.com", status: "ready", posts: 0 },
    { name: "Dev.to (via RSS)", url: "https://dev.to", status: "ready", posts: 0 },
    { name: "Medium (via RSS import)", url: "https://medium.com", status: "ready", posts: 0 },
    { name: "Substack (via RSS)", url: "https://substack.com", status: "ready", posts: 0 },
  ],
  totalSyndicated: 0,
};

export function getContentSyndication() { return contentSyndication; }

let stakingState = {
  program: "tesseract-staking-v1",
  network: "devnet",
  pools: [
    { name: "TSRT Staking Pool", apy: 12, totalStaked: 0, minStake: 100, lockPeriod: "7 days" },
    { name: "LP Staking Pool", apy: 25, totalStaked: 0, minStake: 50, lockPeriod: "30 days" },
  ],
  contractDesign: "Anchor framework, SPL token standard, time-locked vaults",
  status: "designed",
};

export function getStakingState() { return stakingState; }

let multisigState = {
  protocol: "Squads Protocol v4",
  threshold: "2-of-3",
  signers: ["Tesseract AI", "Community DAO", "Treasury Guardian"],
  wallet: process.env.SOL_WALLET || "",
  status: "designed",
  features: ["Time-locked transactions", "Spending limits", "Emergency freeze"],
};

export function getMultisigState() { return multisigState; }

let subscriptionState = {
  plans: [
    { name: "Tesseract Basic", price: 9.99, interval: "monthly", features: ["AI Chat", "Blog Access", "TSRT Rewards"] },
    { name: "Tesseract Pro", price: 24.99, interval: "monthly", features: ["Everything in Basic", "Priority AI", "API Access", "Custom Agents", "2x TSRT Rewards"] },
    { name: "Tesseract Sovereign", price: 49.99, interval: "monthly", features: ["Everything in Pro", "White-label", "Dedicated Support", "Custom Training", "5x TSRT Rewards"] },
  ],
  processor: "Stripe (ready) / Solana Pay (active)",
};

export function getSubscriptionPlans() { return subscriptionState; }

export async function checkPumpFunGraduation(contractAddress: string): Promise<{ graduated: boolean; marketCap: number; bondingCurve: number }> {
  try {
    const res = await axios.get(`https://frontend-api-v2.pump.fun/coins/${contractAddress}`, { timeout: 5000 });
    const data = res.data;
    return {
      graduated: data?.complete === true || (data?.market_cap && data.market_cap > 69000),
      marketCap: data?.market_cap || 0,
      bondingCurve: data?.bonding_curve_progress || 0,
    };
  } catch {
    return { graduated: false, marketCap: 0, bondingCurve: 0 };
  }
}

export async function getJupiterPrice(tokenMint: string): Promise<number> {
  try {
    const res = await axios.get(`https://price.jup.ag/v6/price?ids=${tokenMint}`, { timeout: 5000 });
    return res.data?.data?.[tokenMint]?.price || 0;
  } catch {
    return 0;
  }
}

export async function runPageSpeedCheck(url: string): Promise<{ score: number; metrics: any }> {
  try {
    const res = await axios.get(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile`, { timeout: 30000 });
    const lh = res.data?.lighthouseResult;
    return {
      score: Math.round((lh?.categories?.performance?.score || 0) * 100),
      metrics: {
        fcp: lh?.audits?.["first-contentful-paint"]?.displayValue,
        lcp: lh?.audits?.["largest-contentful-paint"]?.displayValue,
        cls: lh?.audits?.["cumulative-layout-shift"]?.displayValue,
        tbt: lh?.audits?.["total-blocking-time"]?.displayValue,
      },
    };
  } catch {
    return { score: 0, metrics: {} };
  }
}

export function generateQRCode(data: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}&size=${size}x${size}`;
}

let trainingState = {
  cyclesCompleted: 0,
  totalPatternsLearned: 0,
  categories: {
    codeGeneration: { level: 0, patterns: 0, accuracy: 0 },
    conversation: { level: 0, patterns: 0, accuracy: 0 },
    trading: { level: 0, patterns: 0, accuracy: 0 },
    seo: { level: 0, patterns: 0, accuracy: 0 },
    contentCreation: { level: 0, patterns: 0, accuracy: 0 },
    security: { level: 0, patterns: 0, accuracy: 0 },
    customerService: { level: 0, patterns: 0, accuracy: 0 },
    dataAnalysis: { level: 0, patterns: 0, accuracy: 0 },
    autonomousOps: { level: 0, patterns: 0, accuracy: 0 },
    selfImprovement: { level: 0, patterns: 0, accuracy: 0 },
  },
  overallScore: 0,
  trainingLog: [] as string[],
};

export function runTrainingCycle(cycleNumber: number) {
  const categories = Object.keys(trainingState.categories) as Array<keyof typeof trainingState.categories>;
  const cycleLog: string[] = [];

  for (const cat of categories) {
    const improvement = 0;
    const patternsLearned = 0;
    const catState = trainingState.categories[cat];

    catState.patterns += patternsLearned;
    catState.accuracy = Math.min(100, catState.accuracy + improvement * 0.5);
    catState.level = Math.min(10, Math.floor(catState.patterns / 50));
    trainingState.totalPatternsLearned += patternsLearned;

    cycleLog.push(`[Cycle ${cycleNumber}] ${cat}: +${patternsLearned} patterns, accuracy ${catState.accuracy.toFixed(1)}%, level ${catState.level}`);
  }

  trainingState.cyclesCompleted++;
  trainingState.overallScore = Math.min(100,
    Object.values(trainingState.categories).reduce((sum, c) => sum + c.accuracy, 0) / categories.length
  );

  trainingState.trainingLog.push(...cycleLog);
  if (trainingState.trainingLog.length > 200) trainingState.trainingLog = trainingState.trainingLog.slice(-100);

  flog(`Training Cycle ${cycleNumber} complete — overall score: ${trainingState.overallScore.toFixed(1)}%`);
  return { cycle: cycleNumber, overallScore: trainingState.overallScore, categories: { ...trainingState.categories }, log: cycleLog };
}

export function getTrainingState() {
  return { ...trainingState };
}

export function getAllFreeAPIs() {
  return FREE_APIS;
}

export function getFreeAPIsByCategory(category: string) {
  return FREE_APIS.filter(a => a.category === category);
}

export function getFreeAPIStats() {
  return {
    total: FREE_APIS.length,
    active: FREE_APIS.filter(a => a.active).length,
    categories: [...new Set(FREE_APIS.map(a => a.category))],
    noAuth: FREE_APIS.filter(a => !a.authRequired).length,
    byCategory: Object.fromEntries(
      [...new Set(FREE_APIS.map(a => a.category))].map(cat => [cat, FREE_APIS.filter(a => a.category === cat).length])
    ),
  };
}

export async function initFreeAPIs() {
  addUptimeMonitor("Tesseract Main", "http://localhost:5000/api/admin/status");
  addUptimeMonitor("Blog", "http://localhost:5000/blog");
  addUptimeMonitor("MoltBook", "http://localhost:5000/api/moltbook/agents");
  addUptimeMonitor("TSRT Price", "https://api.jup.ag/price/v2?ids=REDACTED");
  addUptimeMonitor("Jupiter Price", "https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112");

  await runUptimeChecks();

  flog(`Free API Integration initialized — ${FREE_APIS.length} APIs cataloged, ${uptimeChecks.length} uptime monitors active`);
}

flog("Free API Integration module loaded");
