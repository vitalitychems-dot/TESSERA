import { callLLMSimple } from "./llm-helper";
import { logger } from "./logger";

const log = (msg: string) => logger.info("SEO-Real", msg);

interface SEOPage {
  url: string;
  title: string;
  metaDescription: string;
  h1Count: number;
  wordCount: number;
  loadTimeMs: number;
  hasSSL: boolean;
  hasOG: boolean;
  score: number;
  optimizedAt: number;
}

interface SEOState {
  pages: number;
  indexed: number;
  score: number;
  lastCycle: number;
  sitemapSubmitted: boolean;
  auditedPages: SEOPage[];
  keywords: string[];
  backlinks: number;
  organicTraffic: number;
  domainAuthority: number;
}

const seoState: SEOState = {
  pages: 0,
  indexed: 0,
  score: 0,
  lastCycle: 0,
  sitemapSubmitted: false,
  auditedPages: [],
  keywords: [],
  backlinks: 0,
  organicTraffic: 0,
  domainAuthority: 0,
};

const SITE_URL = "https://vitalitysupply.net";

const PAGES_TO_AUDIT = [
  "/",
  "/collections/all",
  "/products/daily-vitality-boost-capsules",
  "/products/serotonin-boost-5-htp",
  "/products/calm-thrive-ashwagandha",
  "/products/bee-pearl",
  "/products/complete-multivitamin",
  "/products/mind-boost-capsules",
  "/products/daily-digestive-boost-blend",
  "/products/keto-power-boost-capsules",
];

export const COMPARISON_TOPICS = [
  "Ashwagandha vs Rhodiola: Which Adaptogen Is Better for Stress?",
  "5-HTP vs L-Tryptophan: Best Natural Serotonin Booster",
  "Bee Pearl vs Bee Pollen: Which Bee Product Is More Effective?",
  "Digestive Enzymes vs Probiotics: What Your Gut Actually Needs",
  "KSM-66 vs Regular Ashwagandha: Is the Premium Extract Worth It?",
  "Natural Nootropics vs Synthetic: Mind Boost Capsules Comparison",
  "Keto Supplements vs Traditional Weight Loss Pills 2026",
  "Multivitamin vs Individual Supplements: Which Approach Is Better?",
];

export const BEST_OF_TOPICS = [
  "Best Natural Supplements for Energy Without Caffeine 2026",
  "Top 10 Stress Relief Supplements That Actually Work",
  "Best Digestive Health Products for Daily Wellness",
  "Top Rated Ashwagandha Supplements for Anxiety and Sleep",
  "Best Nootropics for Memory and Focus in 2026",
  "Top 5 Immune Support Supplements for Adults Over 40",
  "Best Natural Mood Boosters Without Side Effects",
  "Top Keto Diet Supplements for Maximum Fat Burning",
];

export const FAQ_DATA = [
  { q: "What is the best time to take ashwagandha?", a: "Most experts recommend taking ashwagandha with breakfast or dinner. Our Calm & Thrive Ashwagandha uses KSM-66 extract, which is well-absorbed with food." },
  { q: "How long does 5-HTP take to work?", a: "Most users notice mood improvements within 1-2 weeks of consistent use. Our Serotonin Boost 5-HTP Capsules are formulated for optimal absorption." },
  { q: "Are your supplements made in the USA?", a: "Yes, all VitalitySupply supplements are manufactured in FDA-registered, GMP-certified facilities in the United States." },
  { q: "Can I take multiple supplements together?", a: "Yes, our supplements are designed to be stackable. Popular combinations include Mind Boost + 5-HTP for cognitive and mood support." },
  { q: "Do you offer a money-back guarantee?", a: "Yes, we offer a 30-day satisfaction guarantee on all products. Contact us through our website." },
  { q: "What makes Bee Pearl different from bee pollen?", a: "Bee Pearl is a concentrated form that combines pollen, propolis, and royal jelly for superior bioavailability and potency." },
];

async function auditPage(pageUrl: string): Promise<SEOPage> {
  const fullUrl = `${SITE_URL}${pageUrl}`;
  const start = Date.now();

  try {
    const response = await fetch(fullUrl, {
      headers: { "User-Agent": "TesseraSEO/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    const loadTimeMs = Date.now() - start;
    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const metaDescMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) ||
                          html.match(/<meta\s+content="([^"]*)"\s+name="description"/i);
    const h1Matches = html.match(/<h1[^>]*>/gi);
    const ogMatch = html.match(/property="og:/i);
    const wordCount = html.replace(/<[^>]*>/g, " ").split(/\s+/).filter(w => w.length > 2).length;

    let score = 50;
    if (titleMatch && titleMatch[1].length > 10 && titleMatch[1].length < 70) score += 10;
    if (metaDescMatch && metaDescMatch[1].length > 50 && metaDescMatch[1].length < 160) score += 10;
    if (h1Matches && h1Matches.length === 1) score += 10;
    if (ogMatch) score += 5;
    if (fullUrl.startsWith("https")) score += 5;
    if (loadTimeMs < 3000) score += 10;
    if (loadTimeMs < 1500) score += 5;
    if (wordCount > 300) score += 5;

    const page: SEOPage = {
      url: pageUrl,
      title: titleMatch ? titleMatch[1].trim() : "No title",
      metaDescription: metaDescMatch ? metaDescMatch[1].trim() : "Missing",
      h1Count: h1Matches ? h1Matches.length : 0,
      wordCount,
      loadTimeMs,
      hasSSL: fullUrl.startsWith("https"),
      hasOG: !!ogMatch,
      score: Math.min(100, score),
      optimizedAt: Date.now(),
    };

    return page;
  } catch (e: any) {
    log(`Audit failed for ${pageUrl}: ${e.message}`);
    return {
      url: pageUrl,
      title: "Audit failed",
      metaDescription: "",
      h1Count: 0,
      wordCount: 0,
      loadTimeMs: Date.now() - start,
      hasSSL: true,
      hasOG: false,
      score: 0,
      optimizedAt: Date.now(),
    };
  }
}

export async function runSEOCycle() {
  seoState.lastCycle = Date.now();

  const pagesToAudit = PAGES_TO_AUDIT.slice(0, 3);
  const audited: SEOPage[] = [];
  for (const page of pagesToAudit) {
    const result = await auditPage(page);
    audited.push(result);
  }

  seoState.auditedPages = [...audited, ...seoState.auditedPages.filter(p => !audited.find(a => a.url === p.url))].slice(0, 20);
  seoState.pages = seoState.auditedPages.length;
  seoState.score = Math.round(seoState.auditedPages.reduce((s, p) => s + p.score, 0) / Math.max(seoState.auditedPages.length, 1));
  seoState.indexed = seoState.auditedPages.filter(p => p.score > 40).length;

  log(`SEO cycle complete: ${audited.length} pages audited, avg score: ${seoState.score}`);
  return { pagesOptimized: audited.length, avgScore: seoState.score };
}

export function queueSEOActions() {
  const actions: string[] = [];
  for (const page of seoState.auditedPages) {
    if (!page.metaDescription || page.metaDescription === "Missing") actions.push(`Add meta description to ${page.url}`);
    if (page.h1Count !== 1) actions.push(`Fix H1 count on ${page.url} (currently ${page.h1Count})`);
    if (!page.hasOG) actions.push(`Add Open Graph tags to ${page.url}`);
    if (page.loadTimeMs > 3000) actions.push(`Optimize load time on ${page.url} (${page.loadTimeMs}ms)`);
  }
  return actions;
}

export function getSEOState() { return seoState; }

export async function submitSitemapToGoogle() {
  log("BLOCKED — Sitemap submission to Google DISABLED for sovereignty/privacy");
  return { submitted: false, blocked: true, reason: "Sovereign privacy mode — no search engine submissions" };
}

export async function submitSitemapToBing() {
  log("BLOCKED — Sitemap submission to Bing DISABLED for sovereignty/privacy");
  return { submitted: false, blocked: true, reason: "Sovereign privacy mode — no search engine submissions" };
}

export async function generateSEOKeywords(): Promise<string[]> {
  try {
    const result = await callLLMSimple(
      "Generate 20 long-tail SEO keywords for a health supplements ecommerce store called VitalitySupply that sells ashwagandha, 5-HTP, bee pearl, multivitamins, digestive enzymes, keto supplements, and nootropics. Focus on buyer intent keywords. Return ONLY a JSON array of strings.",
      "seo-keyword-generation"
    );
    const match = result.match(/\[[\s\S]*\]/);
    if (match) {
      seoState.keywords = JSON.parse(match[0]);
      return seoState.keywords;
    }
  } catch (e: any) {
    log(`Keyword generation failed: ${e.message}`);
  }
  return COMPARISON_TOPICS.map(t => t.toLowerCase());
}

let seoInterval: ReturnType<typeof setInterval> | null = null;

export function startSEOEngine() {
  log("SEO Engine DISABLED — sovereign privacy mode active. No sitemaps, no indexing, no search engine submissions.");
}
