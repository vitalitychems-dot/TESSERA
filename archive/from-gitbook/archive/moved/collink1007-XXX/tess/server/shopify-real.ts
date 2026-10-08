import { logger } from "./logger";

const log = (msg: string) => logger.info("Shopify-Real", msg);

function normalizeStoreDomain(raw: string): string {
  let domain = raw.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
  if (domain.includes(".myshopify.com")) return domain;
  if (domain.includes(".")) {
    const name = domain.split(".")[0];
    return `${name}.myshopify.com`;
  }
  return `${domain}.myshopify.com`;
}

const RAW_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN || "vitalitysupply";
const STORE_DOMAIN = normalizeStoreDomain(RAW_DOMAIN);
const ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || "";
const API_VERSION = "2024-01";

interface ShopifyState {
  initialized: boolean;
  products: number;
  blogs: number;
  orders: number;
  revenue: number;
  lastCycle: number;
  connected: boolean;
  storeName: string;
  publishedArticles: ShopifyArticle[];
  productList: ShopifyProduct[];
  seoKeywords: string[];
  discountCodes: DiscountCode[];
}

interface ShopifyProduct {
  id: string;
  title: string;
  url: string;
  price: string;
  status: string;
  inventory: number;
}

interface ShopifyArticle {
  title: string;
  slug: string;
  publishedAt: string;
  wordCount: number;
  humanScore: number;
  backlinks: string[];
}

interface DiscountCode {
  code: string;
  type: "percentage" | "fixed";
  amount: number;
  usageCount: number;
  createdAt: number;
  expiresAt?: number;
}

const shopifyState: ShopifyState = {
  initialized: false,
  products: 8,
  blogs: 0,
  orders: 0,
  revenue: 0,
  lastCycle: 0,
  connected: false,
  storeName: "VitalitySupply",
  publishedArticles: [],
  productList: [
    { id: "vs-001", title: "Daily Vitality Boost Capsules", url: "/products/daily-vitality-boost-capsules", price: "29.99", status: "active", inventory: 100 },
    { id: "vs-002", title: "Serotonin Boost 5-HTP Capsules", url: "/products/serotonin-boost-5-htp", price: "24.99", status: "active", inventory: 100 },
    { id: "vs-003", title: "Calm & Thrive Ashwagandha", url: "/products/calm-thrive-ashwagandha", price: "27.99", status: "active", inventory: 100 },
    { id: "vs-004", title: "Bee Pearl Wellness Boost", url: "/products/bee-pearl", price: "34.99", status: "active", inventory: 100 },
    { id: "vs-005", title: "Complete Multivitamin", url: "/products/complete-multivitamin", price: "22.99", status: "active", inventory: 100 },
    { id: "vs-006", title: "Mind Boost Capsules", url: "/products/mind-boost-capsules", price: "31.99", status: "active", inventory: 100 },
    { id: "vs-007", title: "Daily Digestive Boost Blend", url: "/products/daily-digestive-boost-blend", price: "26.99", status: "active", inventory: 100 },
    { id: "vs-008", title: "Keto Power Boost Capsules", url: "/products/keto-power-boost-capsules", price: "28.99", status: "active", inventory: 100 },
  ],
  seoKeywords: [
    "best ashwagandha supplement 2026", "natural 5-HTP for mood", "bee pearl benefits",
    "digestive enzymes for bloating", "keto weight loss supplements", "nootropics for focus",
    "multivitamin adults over 40", "stress relief supplements natural",
  ],
  discountCodes: [],
};

async function shopifyAPI(endpoint: string, method = "GET", body?: any) {
  if (!ACCESS_TOKEN) return null;
  const url = `https://${STORE_DOMAIN}/admin/api/${API_VERSION}/${endpoint}`;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        "X-Shopify-Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      if (response.status !== 401 || !shopifyState._401warned) {
        log(`Shopify API error ${response.status}: ${endpoint}`);
        if (response.status === 401) shopifyState._401warned = true;
      }
      return null;
    }
    return await response.json();
  } catch (e: any) {
    log(`Shopify API failed: ${e.message}`);
    return null;
  }
}

export function initShopify() {
  shopifyState.initialized = true;
  shopifyState.connected = !!ACCESS_TOKEN;
  if (ACCESS_TOKEN) {
    log(`Shopify connected to ${STORE_DOMAIN} (from: ${RAW_DOMAIN}) with API access`);
    syncProducts().catch(() => {});
  } else {
    log("Shopify initialized without credentials — awaiting SHOPIFY_ACCESS_TOKEN");
  }
}

async function syncProducts() {
  const data = await shopifyAPI("products.json?limit=50");
  if (data?.products) {
    shopifyState.productList = data.products.map((p: any) => ({
      id: String(p.id),
      title: p.title,
      url: `/products/${p.handle}`,
      price: p.variants?.[0]?.price || "0",
      status: p.status,
      inventory: p.variants?.[0]?.inventory_quantity || 0,
    }));
    shopifyState.products = shopifyState.productList.length;
    log(`Synced ${shopifyState.products} products from Shopify`);
  }
}

export async function runShopifyCycle() {
  shopifyState.lastCycle = Date.now();

  if (ACCESS_TOKEN) {
    const orders = await shopifyAPI("orders.json?status=any&limit=10");
    if (orders?.orders) {
      shopifyState.orders = orders.orders.length;
      shopifyState.revenue = orders.orders.reduce((s: number, o: any) => s + parseFloat(o.total_price || "0"), 0);
    }
  }

  return { success: true, orders: shopifyState.orders, revenue: shopifyState.revenue };
}

export async function publishBlogToShopify(title: string, content: string) {
  if (!ACCESS_TOKEN) {
    shopifyState.blogs++;
    shopifyState.publishedArticles.push({
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      publishedAt: new Date().toISOString(),
      wordCount: content.split(/\s+/).length,
      humanScore: 0,
      backlinks: [],
    });
    log(`Blog queued (no Shopify credentials): "${title}"`);
    return { published: false, queued: true };
  }

  const blogs = await shopifyAPI("blogs.json");
  const blogId = blogs?.blogs?.[0]?.id;
  if (!blogId) {
    log("No blog found on Shopify store — creating one");
    const newBlog = await shopifyAPI("blogs.json", "POST", { blog: { title: "VitalitySupply Wellness Blog" } });
    if (!newBlog?.blog?.id) return { published: false, error: "Could not create blog" };
  }

  const finalBlogId = blogId || (await shopifyAPI("blogs.json"))?.blogs?.[0]?.id;
  const article = await shopifyAPI(`blogs/${finalBlogId}/articles.json`, "POST", {
    article: {
      title,
      body_html: content,
      published: true,
      tags: "health,supplements,wellness,vitality",
    },
  });

  if (article?.article) {
    shopifyState.blogs++;
    shopifyState.publishedArticles.push({
      title,
      slug: article.article.handle || "",
      publishedAt: new Date().toISOString(),
      wordCount: content.split(/\s+/).length,
      humanScore: 85,
      backlinks: [],
    });
    log(`Blog PUBLISHED to Shopify: "${title}"`);
    return { published: true, url: `https://${STORE_DOMAIN}/blogs/news/${article.article.handle}` };
  }

  return { published: false, error: "Failed to publish" };
}

export function createDiscount(code: string, amount: number) {
  const discount: DiscountCode = {
    code,
    type: "percentage",
    amount,
    usageCount: 0,
    createdAt: Date.now(),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };
  shopifyState.discountCodes.push(discount);
  log(`Discount code created: ${code} (${amount}% off)`);
  return { created: true, code, amount };
}

export function getShopifyState() { return shopifyState; }

export function generateBlogPost(topic: string) {
  return {
    title: topic,
    content: `SEO-optimized article about ${topic} for VitalitySupply.net`,
    published: false,
    queued: true,
  };
}

export function runSEOBlogCycle() {
  return { postsGenerated: shopifyState.publishedArticles.length, total: shopifyState.blogs };
}

export function isOptimalPostingWindow() {
  const hour = new Date().getUTCHours();
  const cstHour = (hour - 6 + 24) % 24;
  return cstHour >= 8 && cstHour <= 20;
}

export function getVitalityProducts() { return shopifyState.productList; }
export function getSeoKeywords() { return shopifyState.seoKeywords; }

export function getShopifyOAuthUrl() {
  return `https://${STORE_DOMAIN}/admin/oauth/authorize?client_id=YOUR_CLIENT_ID&scope=read_products,write_content,read_orders&redirect_uri=tess://tessera.sovereign/api/shopify/callback`;
}

export function exchangeShopifyCode(_code: string) {
  return { success: false, message: "Use environment variables: SHOPIFY_ACCESS_TOKEN and SHOPIFY_STORE_DOMAIN" };
}
