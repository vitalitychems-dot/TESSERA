let _crCounter = 0;

interface Connector {
  id: string;
  name: string;
  type: "llm" | "api" | "scraper" | "blockchain" | "storage" | "voice" | "analytics" | "commerce" | "social" | "compute";
  status: "active" | "degraded" | "offline" | "cooldown";
  endpoint: string;
  capabilities: string[];
  costTier: "free" | "cheap" | "moderate" | "expensive";
  healthScore: number;
  totalCalls: number;
  successRate: number;
  avgLatency: number;
  lastUsed: number;
  lastHealthCheck: number;
  group: string;
  loadBalanceWeight: number;
}

interface ConnectorRegistryState {
  connectors: Map<string, Connector>;
  groups: Map<string, string[]>;
  totalRequests: number;
  lastHealthScan: number;
}

const state: ConnectorRegistryState = {
  connectors: new Map(),
  groups: new Map(),
  totalRequests: 0,
  lastHealthScan: 0,
};

function registerConnector(spec: Omit<Connector, "healthScore" | "totalCalls" | "successRate" | "avgLatency" | "lastUsed" | "lastHealthCheck" | "loadBalanceWeight">): void {
  const connector: Connector = {
    ...spec,
    healthScore: 100,
    totalCalls: 0,
    successRate: 100,
    avgLatency: 0,
    lastUsed: 0,
    lastHealthCheck: Date.now(),
    loadBalanceWeight: 1,
  };
  state.connectors.set(spec.id, connector);

  if (!state.groups.has(spec.group)) {
    state.groups.set(spec.group, []);
  }
  state.groups.get(spec.group)!.push(spec.id);
}

registerConnector({ id: "sovereign-groq", name: "Sovereign Groq Llama", type: "llm", status: "active", endpoint: "https://api.groq.com/openai/v1", capabilities: ["chat", "code", "reasoning"], costTier: "free", group: "sovereign" });
registerConnector({ id: "deepseek-chat", name: "DeepSeek Chat", type: "llm", status: "active", endpoint: "https://api.deepseek.com/v1", capabilities: ["chat", "code", "reasoning"], costTier: "cheap", group: "deepseek" });
registerConnector({ id: "sovereign-sambanova", name: "SambaNova Llama", type: "llm", status: "active", endpoint: "https://api.sambanova.ai/v1", capabilities: ["chat", "code", "reasoning"], costTier: "free", group: "sovereign" });
registerConnector({ id: "cohere-command", name: "Cohere Command", type: "llm", status: "active", endpoint: "https://api.cohere.ai/v1", capabilities: ["chat", "search", "summarize"], costTier: "cheap", group: "cohere" });
registerConnector({ id: "openrouter-free", name: "OpenRouter Free Tier", type: "llm", status: "active", endpoint: "https://openrouter.ai/api/v1", capabilities: ["chat", "code"], costTier: "free", group: "openrouter" });
registerConnector({ id: "pollinations-ai", name: "Pollinations AI", type: "llm", status: "active", endpoint: "https://text.pollinations.ai", capabilities: ["chat", "code", "creative"], costTier: "free", group: "pollinations" });
registerConnector({ id: "sovereignai", name: "Sovereign AI", type: "llm", status: "active", endpoint: "sovereign-internal", capabilities: ["chat", "code"], costTier: "free", group: "sovereign" });
registerConnector({ id: "huggingface-inference", name: "HuggingFace Inference", type: "llm", status: "active", endpoint: "https://api-inference.huggingface.co", capabilities: ["chat", "classification", "generation"], costTier: "free", group: "huggingface" });
registerConnector({ id: "cerebras-fast", name: "Cerebras Fast Inference", type: "llm", status: "active", endpoint: "https://api.cerebras.ai/v1", capabilities: ["chat", "code", "fast-inference"], costTier: "free", group: "cerebras" });
registerConnector({ id: "sambanova-fast", name: "SambaNova Cloud", type: "llm", status: "active", endpoint: "https://api.sambanova.ai/v1", capabilities: ["chat", "code", "fast-inference"], costTier: "free", group: "sambanova" });
registerConnector({ id: "grok-xai", name: "Grok (xAI)", type: "llm", status: "active", endpoint: "https://api.x.ai/v1", capabilities: ["chat", "reasoning", "real-time"], costTier: "moderate", group: "xai" });

registerConnector({ id: "dexscreener", name: "DexScreener", type: "api", status: "active", endpoint: "https://api.jup.ag", capabilities: ["token-price", "pairs", "volume"], costTier: "free", group: "crypto-data" });
registerConnector({ id: "geckoterminal", name: "GeckoTerminal", type: "api", status: "active", endpoint: "https://api.geckoterminal.com", capabilities: ["token-price", "ohlcv", "pools"], costTier: "free", group: "crypto-data" });
registerConnector({ id: "solana-rpc", name: "Solana RPC", type: "blockchain", status: "active", endpoint: "https://api.mainnet-beta.solana.com", capabilities: ["transactions", "balances", "tokens"], costTier: "free", group: "solana" });
registerConnector({ id: "jupiter-v6", name: "Jupiter V6 Aggregator", type: "blockchain", status: "active", endpoint: "https://quote-api.jup.ag/v6", capabilities: ["swap", "route", "price"], costTier: "free", group: "solana" });

registerConnector({ id: "elevenlabs-tts", name: "ElevenLabs TTS", type: "voice", status: "active", endpoint: "https://api.elevenlabs.io/v1", capabilities: ["text-to-speech", "voice-clone"], costTier: "moderate", group: "voice" });
registerConnector({ id: "github-api", name: "GitHub API", type: "api", status: "active", endpoint: "https://api.github.com", capabilities: ["repos", "code-search", "issues"], costTier: "free", group: "github" });
registerConnector({ id: "brave-search", name: "Brave Search", type: "scraper", status: "active", endpoint: "https://api.search.brave.com", capabilities: ["web-search", "news"], costTier: "free", group: "search" });
registerConnector({ id: "duckduckgo", name: "DuckDuckGo Search", type: "scraper", status: "active", endpoint: "https://api.duckduckgo.com", capabilities: ["web-search", "instant-answers"], costTier: "free", group: "search" });

registerConnector({ id: "shopify-admin", name: "Shopify Admin API", type: "commerce", status: "active", endpoint: "https://admin.shopify.com", capabilities: ["products", "orders", "blog"], costTier: "moderate", group: "shopify" });
registerConnector({ id: "hubspot-crm", name: "HubSpot CRM", type: "api", status: "active", endpoint: "https://api.hubapi.com", capabilities: ["contacts", "deals", "email"], costTier: "free", group: "hubspot" });
registerConnector({ id: "klaviyo-email", name: "Klaviyo Email", type: "api", status: "active", endpoint: "https://a.klaviyo.com/api", capabilities: ["campaigns", "flows", "lists"], costTier: "cheap", group: "email" });

registerConnector({ id: "oracle-compute", name: "Oracle Cloud Compute", type: "compute", status: "offline", endpoint: "https://iaas.us-ashburn-1.oraclecloud.com", capabilities: ["vm", "containers", "storage"], costTier: "free", group: "oracle" });
registerConnector({ id: "apify-scraper", name: "Apify Web Scraper", type: "scraper", status: "active", endpoint: "https://api.apify.com/v2", capabilities: ["web-scraping", "crawling", "extraction"], costTier: "cheap", group: "apify" });

registerConnector({ id: "ergo-blockchain", name: "Ergo Platform", type: "blockchain", status: "active", endpoint: "https://api.ergoplatform.com", capabilities: ["transactions", "contracts", "boxes"], costTier: "free", group: "ergo" });
registerConnector({ id: "polymarket", name: "Polymarket API", type: "api", status: "active", endpoint: "https://clob.polymarket.com", capabilities: ["markets", "odds", "events"], costTier: "free", group: "prediction" });
registerConnector({ id: "google-analytics", name: "Google Analytics", type: "analytics", status: "active", endpoint: "https://analyticsdata.googleapis.com", capabilities: ["pageviews", "events", "conversions"], costTier: "free", group: "google" });

registerConnector({ id: "notion-api", name: "Notion", type: "api", status: "active", endpoint: "https://api.notion.com/v1", capabilities: ["databases", "pages", "blocks", "search", "comments"], costTier: "free", group: "productivity" });
registerConnector({ id: "slack-api", name: "Slack", type: "social", status: "active", endpoint: "https://slack.com/api", capabilities: ["messages", "channels", "files", "reactions", "users"], costTier: "free", group: "communication" });
registerConnector({ id: "discord-api", name: "Discord", type: "social", status: "active", endpoint: "https://discord.com/api/v10", capabilities: ["messages", "channels", "guilds", "webhooks", "bots"], costTier: "free", group: "communication" });
registerConnector({ id: "telegram-api", name: "Telegram Bot API", type: "social", status: "active", endpoint: "https://api.telegram.org", capabilities: ["messages", "groups", "channels", "bots", "inline-queries"], costTier: "free", group: "communication" });
registerConnector({ id: "airtable-api", name: "Airtable", type: "api", status: "active", endpoint: "https://api.airtable.com/v0", capabilities: ["bases", "records", "views", "automations"], costTier: "free", group: "productivity" });
registerConnector({ id: "trello-api", name: "Trello", type: "api", status: "active", endpoint: "https://api.trello.com/1", capabilities: ["boards", "cards", "lists", "checklists", "members"], costTier: "free", group: "productivity" });
registerConnector({ id: "jira-api", name: "Jira", type: "api", status: "active", endpoint: "https://api.atlassian.com", capabilities: ["issues", "projects", "sprints", "boards", "workflows"], costTier: "cheap", group: "productivity" });
registerConnector({ id: "asana-api", name: "Asana", type: "api", status: "active", endpoint: "https://app.asana.com/api/1.0", capabilities: ["tasks", "projects", "portfolios", "goals", "teams"], costTier: "free", group: "productivity" });
registerConnector({ id: "linear-api", name: "Linear", type: "api", status: "active", endpoint: "https://api.linear.app/graphql", capabilities: ["issues", "projects", "cycles", "teams", "roadmaps"], costTier: "free", group: "productivity" });
registerConnector({ id: "google-sheets", name: "Google Sheets", type: "api", status: "active", endpoint: "https://sheets.googleapis.com/v4", capabilities: ["spreadsheets", "cells", "charts", "formulas"], costTier: "free", group: "google" });
registerConnector({ id: "google-drive", name: "Google Drive", type: "storage", status: "active", endpoint: "https://www.googleapis.com/drive/v3", capabilities: ["files", "folders", "sharing", "search"], costTier: "free", group: "google" });
registerConnector({ id: "google-calendar", name: "Google Calendar", type: "api", status: "active", endpoint: "https://www.googleapis.com/calendar/v3", capabilities: ["events", "calendars", "reminders"], costTier: "free", group: "google" });
registerConnector({ id: "gmail-api", name: "Gmail", type: "api", status: "active", endpoint: "https://gmail.googleapis.com/gmail/v1", capabilities: ["send", "read", "labels", "drafts", "threads"], costTier: "free", group: "google" });
registerConnector({ id: "twilio-api", name: "Twilio", type: "api", status: "active", endpoint: "https://api.twilio.com/2010-04-01", capabilities: ["sms", "voice", "whatsapp", "verify"], costTier: "cheap", group: "communication" });
registerConnector({ id: "sendgrid-api", name: "SendGrid", type: "api", status: "active", endpoint: "https://api.sendgrid.com/v3", capabilities: ["email-send", "templates", "contacts", "campaigns"], costTier: "cheap", group: "email" });
registerConnector({ id: "mailchimp-api", name: "Mailchimp", type: "api", status: "active", endpoint: "https://server.api.mailchimp.com/3.0", capabilities: ["campaigns", "audiences", "automations", "analytics"], costTier: "cheap", group: "email" });
registerConnector({ id: "calendly-api", name: "Calendly", type: "api", status: "active", endpoint: "https://api.calendly.com", capabilities: ["scheduling", "events", "invitees", "webhooks"], costTier: "free", group: "productivity" });
registerConnector({ id: "zapier-webhooks", name: "Zapier Webhooks", type: "api", status: "active", endpoint: "https://hooks.zapier.com", capabilities: ["triggers", "actions", "automations", "workflows"], costTier: "cheap", group: "automation" });
registerConnector({ id: "make-api", name: "Make (Integromat)", type: "api", status: "active", endpoint: "https://hook.us1.make.com", capabilities: ["scenarios", "modules", "data-stores", "webhooks"], costTier: "cheap", group: "automation" });
registerConnector({ id: "supabase-api", name: "Supabase", type: "storage", status: "active", endpoint: "https://api.supabase.co", capabilities: ["database", "auth", "storage", "realtime", "edge-functions"], costTier: "free", group: "database" });
registerConnector({ id: "firebase-api", name: "Firebase", type: "storage", status: "active", endpoint: "https://firebase.googleapis.com", capabilities: ["firestore", "auth", "storage", "hosting", "functions"], costTier: "free", group: "database" });
registerConnector({ id: "vercel-api", name: "Vercel", type: "compute", status: "active", endpoint: "https://api.vercel.com", capabilities: ["deployments", "domains", "env-vars", "functions", "analytics"], costTier: "free", group: "hosting" });
registerConnector({ id: "netlify-api", name: "Netlify", type: "compute", status: "active", endpoint: "https://api.netlify.com/api/v1", capabilities: ["deploys", "sites", "forms", "functions"], costTier: "free", group: "hosting" });
registerConnector({ id: "railway-api", name: "Railway", type: "compute", status: "active", endpoint: "https://backboard.railway.app/graphql/v2", capabilities: ["deployments", "services", "databases", "volumes"], costTier: "cheap", group: "hosting" });
registerConnector({ id: "cloudflare-api", name: "Cloudflare", type: "compute", status: "active", endpoint: "https://api.cloudflare.com/client/v4", capabilities: ["dns", "workers", "r2-storage", "kv", "pages"], costTier: "free", group: "hosting" });
registerConnector({ id: "anthropic-api", name: "Anthropic Claude", type: "llm", status: "active", endpoint: "https://api.anthropic.com/v1", capabilities: ["chat", "code", "reasoning", "analysis", "creative"], costTier: "expensive", group: "anthropic" });
registerConnector({ id: "perplexity-api", name: "Perplexity AI", type: "llm", status: "active", endpoint: "https://api.perplexity.ai", capabilities: ["search", "chat", "citations", "research"], costTier: "moderate", group: "perplexity" });
registerConnector({ id: "mistral-api", name: "Mistral AI", type: "llm", status: "active", endpoint: "https://api.mistral.ai/v1", capabilities: ["chat", "code", "embeddings"], costTier: "cheap", group: "mistral" });
registerConnector({ id: "twitter-api", name: "Twitter/X API", type: "social", status: "active", endpoint: "https://api.twitter.com/2", capabilities: ["tweets", "search", "users", "dm", "spaces"], costTier: "moderate", group: "social" });
registerConnector({ id: "reddit-api", name: "Reddit API", type: "social", status: "active", endpoint: "https://oauth.reddit.com/api", capabilities: ["posts", "comments", "subreddits", "search"], costTier: "free", group: "social" });
registerConnector({ id: "youtube-api", name: "YouTube Data API", type: "api", status: "active", endpoint: "https://www.googleapis.com/youtube/v3", capabilities: ["videos", "channels", "playlists", "search", "comments"], costTier: "free", group: "google" });
registerConnector({ id: "stripe-api", name: "Stripe", type: "commerce", status: "active", endpoint: "https://api.stripe.com/v1", capabilities: ["payments", "subscriptions", "invoices", "customers", "products"], costTier: "moderate", group: "payments" });
registerConnector({ id: "paypal-api", name: "PayPal", type: "commerce", status: "active", endpoint: "https://api-m.paypal.com/v2", capabilities: ["payments", "orders", "subscriptions", "payouts"], costTier: "moderate", group: "payments" });
registerConnector({ id: "coinbase-api", name: "Coinbase", type: "blockchain", status: "active", endpoint: "https://api.coinbase.com/v2", capabilities: ["accounts", "transactions", "prices", "exchange-rates"], costTier: "free", group: "crypto-data" });
registerConnector({ id: "aws-s3", name: "AWS S3", type: "storage", status: "active", endpoint: "https://s3.amazonaws.com", capabilities: ["object-storage", "buckets", "presigned-urls", "lifecycle"], costTier: "cheap", group: "aws" });
registerConnector({ id: "groq-whisper", name: "Groq Whisper", type: "voice", status: "active", endpoint: "https://api.groq.com/openai/v1/audio", capabilities: ["speech-to-text", "transcription", "translation"], costTier: "free", group: "sovereign" });
registerConnector({ id: "stability-ai", name: "Stability AI", type: "api", status: "active", endpoint: "https://api.stability.ai/v1", capabilities: ["image-generation", "upscaling", "editing", "inpainting"], costTier: "cheap", group: "image-gen" });
registerConnector({ id: "replicate-api", name: "Replicate", type: "api", status: "active", endpoint: "https://api.replicate.com/v1", capabilities: ["model-inference", "image-gen", "audio", "video"], costTier: "cheap", group: "ml-platform" });
registerConnector({ id: "pinecone-api", name: "Pinecone", type: "storage", status: "active", endpoint: "https://api.pinecone.io", capabilities: ["vector-storage", "similarity-search", "embeddings", "namespaces"], costTier: "free", group: "database" });
registerConnector({ id: "weaviate-api", name: "Weaviate", type: "storage", status: "active", endpoint: "https://api.weaviate.io", capabilities: ["vector-db", "semantic-search", "classification"], costTier: "free", group: "database" });

export function recordConnectorCall(connectorId: string, success: boolean, latencyMs: number): void {
  const connector = state.connectors.get(connectorId);
  if (!connector) return;

  connector.totalCalls++;
  connector.lastUsed = Date.now();
  state.totalRequests++;

  if (success) {
    connector.avgLatency = (connector.avgLatency * (connector.totalCalls - 1) + latencyMs) / connector.totalCalls;
    connector.successRate = Math.round(((connector.successRate * (connector.totalCalls - 1) + 100) / connector.totalCalls) * 100) / 100;
  } else {
    connector.successRate = Math.round(((connector.successRate * (connector.totalCalls - 1)) / connector.totalCalls) * 100) / 100;
  }

  connector.healthScore = Math.round(connector.successRate * 0.6 + Math.max(0, 100 - connector.avgLatency / 50) * 0.4);

  if (connector.healthScore < 30) connector.status = "offline";
  else if (connector.healthScore < 60) connector.status = "degraded";
  else if (connector.healthScore < 80) connector.status = "cooldown";
  else connector.status = "active";
}

export function getConnectorsByCapability(capability: string): Connector[] {
  return Array.from(state.connectors.values())
    .filter(c => c.capabilities.includes(capability) && c.status !== "offline")
    .sort((a, b) => b.healthScore - a.healthScore);
}

export function getConnectorsByType(type: Connector["type"]): Connector[] {
  return Array.from(state.connectors.values())
    .filter(c => c.type === type)
    .sort((a, b) => b.healthScore - a.healthScore);
}

export function selectConnectorWithLoadBalance(capability: string): Connector | null {
  const candidates = getConnectorsByCapability(capability).filter(c => c.status === "active");
  if (candidates.length === 0) return null;

  const totalWeight = candidates.reduce((s, c) => s + c.loadBalanceWeight * c.healthScore, 0);
  let random = ((_crCounter++ % 100) / 100) * totalWeight;
  for (const c of candidates) {
    random -= c.loadBalanceWeight * c.healthScore;
    if (random <= 0) return c;
  }
  return candidates[0];
}

export function getConnectorRegistryState() {
  const connectors = Array.from(state.connectors.values());
  return {
    totalConnectors: connectors.length,
    activeConnectors: connectors.filter(c => c.status === "active").length,
    degradedConnectors: connectors.filter(c => c.status === "degraded").length,
    offlineConnectors: connectors.filter(c => c.status === "offline").length,
    totalRequests: state.totalRequests,
    avgHealthScore: connectors.length > 0 ? Math.round(connectors.reduce((s, c) => s + c.healthScore, 0) / connectors.length) : 0,
    byType: {
      llm: connectors.filter(c => c.type === "llm").length,
      api: connectors.filter(c => c.type === "api").length,
      scraper: connectors.filter(c => c.type === "scraper").length,
      blockchain: connectors.filter(c => c.type === "blockchain").length,
      storage: connectors.filter(c => c.type === "storage").length,
      voice: connectors.filter(c => c.type === "voice").length,
      analytics: connectors.filter(c => c.type === "analytics").length,
      commerce: connectors.filter(c => c.type === "commerce").length,
      compute: connectors.filter(c => c.type === "compute").length,
      social: connectors.filter(c => c.type === "social").length,
    },
    byCostTier: {
      free: connectors.filter(c => c.costTier === "free").length,
      cheap: connectors.filter(c => c.costTier === "cheap").length,
      moderate: connectors.filter(c => c.costTier === "moderate").length,
      expensive: connectors.filter(c => c.costTier === "expensive").length,
    },
    groups: Array.from(state.groups.entries()).map(([group, ids]) => ({
      group,
      connectors: ids.length,
      avgHealth: Math.round(ids.map(id => state.connectors.get(id)?.healthScore || 0).reduce((s, h) => s + h, 0) / ids.length),
    })),
    connectors: connectors.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      healthScore: c.healthScore,
      costTier: c.costTier,
      calls: c.totalCalls,
      successRate: c.successRate,
      avgLatency: Math.round(c.avgLatency),
      capabilities: c.capabilities,
      group: c.group,
    })),
  };
}

export function runConnectorHealthCheck(): { checked: number; degraded: number; recovered: number } {
  let checked = 0, degraded = 0, recovered = 0;
  const now = Date.now();

  for (const connector of state.connectors.values()) {
    checked++;
    connector.lastHealthCheck = now;

    if (now - connector.lastUsed > 600000 && connector.status === "offline") {
      connector.status = "active";
      connector.healthScore = 70;
      recovered++;
    }

    if (connector.successRate < 50 && connector.totalCalls > 10) {
      connector.status = "degraded";
      connector.loadBalanceWeight = 0.3;
      degraded++;
    } else if (connector.successRate >= 80) {
      connector.loadBalanceWeight = 1;
    }
  }

  state.lastHealthScan = now;
  return { checked, degraded, recovered };
}

setInterval(runConnectorHealthCheck, 120000);

console.log(`[ConnectorRegistry] ${state.connectors.size} connectors registered across ${state.groups.size} groups — load balancing + health monitoring active`);
