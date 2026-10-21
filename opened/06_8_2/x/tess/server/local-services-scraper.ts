import axios from "axios";
import { callLLMSimple } from "./llm-helper";
import * as fs from "fs";

let _lssCounter = 0;

const log = (msg: string) => console.log(`[LocalServices] ${msg}`);
const STATE_FILE = "server/local-services-state.json";

interface LocalListing {
  id: string;
  title: string;
  description: string;
  location: string;
  category: string;
  source: string;
  sourceUrl: string;
  price?: string;
  contact?: string;
  postedAt: string;
  profitPotential: "high" | "medium" | "low";
  matchedService?: string;
  outreachStatus: "new" | "contacted" | "responded" | "converted" | "rejected";
  scrapedAt: number;
}

interface ServiceMatch {
  listing: LocalListing;
  ourService: string;
  ourCost: number;
  theirBudget: number;
  profitMargin: number;
  outreachMessage: string;
}

interface ScraperState {
  listings: LocalListing[];
  matches: ServiceMatch[];
  totalScraped: number;
  totalMatches: number;
  totalContacted: number;
  totalConverted: number;
  lastScan: number;
  scanCount: number;
}

let state: ScraperState = {
  listings: [],
  matches: [],
  totalScraped: 0,
  totalMatches: 0,
  totalContacted: 0,
  totalConverted: 0,
  lastScan: 0,
  scanCount: 0,
};

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

loadState();

const OUR_SERVICES = [
  { name: "AI Website Building", cost: 0, sellPrice: 200, keywords: ["website", "web design", "web developer", "landing page", "wordpress", "shopify site"] },
  { name: "SEO Optimization", cost: 0, sellPrice: 150, keywords: ["seo", "google ranking", "search engine", "organic traffic", "website traffic"] },
  { name: "Content Writing", cost: 0, sellPrice: 50, keywords: ["blog", "content", "writer", "copywriter", "article", "writing"] },
  { name: "Social Media Management", cost: 0, sellPrice: 100, keywords: ["social media", "instagram", "facebook", "tiktok", "marketing"] },
  { name: "Logo & Branding", cost: 0, sellPrice: 75, keywords: ["logo", "branding", "graphic design", "brand identity"] },
  { name: "Code Review & Bug Fixing", cost: 0, sellPrice: 100, keywords: ["bug fix", "code review", "debugging", "software", "app fix", "programming"] },
  { name: "Data Entry & Research", cost: 0, sellPrice: 30, keywords: ["data entry", "research", "spreadsheet", "data collection", "virtual assistant"] },
  { name: "Email Marketing Setup", cost: 0, sellPrice: 100, keywords: ["email marketing", "newsletter", "mailchimp", "klaviyo", "email campaign"] },
  { name: "AI Chatbot Setup", cost: 0, sellPrice: 150, keywords: ["chatbot", "ai assistant", "customer support", "automated", "bot"] },
  { name: "Video Editing", cost: 0, sellPrice: 75, keywords: ["video edit", "youtube", "video production", "editing"] },
  { name: "Roofing Lead Generation", cost: 0, sellPrice: 25, keywords: ["roofing", "roof repair", "roof replacement", "roofer needed"] },
  { name: "Insurance Lead Generation", cost: 0, sellPrice: 20, keywords: ["insurance", "life insurance", "home insurance", "auto insurance", "health insurance"] },
  { name: "Construction Lead Generation", cost: 0, sellPrice: 25, keywords: ["construction", "contractor", "remodel", "renovation", "building"] },
  { name: "Moving & Logistics Services", cost: 0, sellPrice: 50, keywords: ["moving", "hauling", "delivery", "logistics", "trucking", "freight"] },
];

async function scrapeCraigslist(city: string, category: string): Promise<LocalListing[]> {
  const listings: LocalListing[] = [];
  const urls = [
    `https://${city}.craigslist.org/search/cpg`,
    `https://${city}.craigslist.org/search/web`,
    `https://${city}.craigslist.org/search/sof`,
    `https://${city}.craigslist.org/search/bfs`,
    `https://${city}.craigslist.org/search/lbs`,
  ];

  for (const url of urls) {
    try {
      const res = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
        timeout: 10000,
      });

      const html = res.data as string;
      const titleMatches = html.match(/<a[^>]*class="posting-title"[^>]*>[\s\S]*?<span[^>]*class="label"[^>]*>(.*?)<\/span>/gi) || [];
      const linkMatches = html.match(/href="(\/[^"]*\d{10,}\.html)"/gi) || [];
      const priceMatches = html.match(/<span class="priceinfo">\$(\d+)/gi) || [];

      const titles = html.match(/class="label">(.*?)<\/span>/gi) || [];
      const links = html.match(/href="(https?:\/\/[^"]*\.html)"/gi) || [];

      const resultPattern = /<li[^>]*class="cl-static-search-result"[^>]*>[\s\S]*?<div[^>]*class="title"[^>]*>(.*?)<\/div>/gi;
      let match;
      let count = 0;
      while ((match = resultPattern.exec(html)) !== null && count < 10) {
        const title = match[1]?.replace(/<[^>]+>/g, "").trim();
        if (title && title.length > 5) {
          listings.push({
            id: `cl-${city}-${Date.now()}-${count}`,
            title,
            description: title,
            location: city,
            category: category || "services",
            source: "craigslist",
            sourceUrl: url,
            postedAt: new Date().toISOString(),
            profitPotential: "medium",
            outreachStatus: "new",
            scrapedAt: Date.now(),
          });
          count++;
        }
      }

      const altPattern = /<a[^>]*href="([^"]*)"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/gi;
      while ((match = altPattern.exec(html)) !== null && count < 15) {
        const href = match[1];
        const title = match[2]?.trim();
        if (title && title.length > 8 && !title.includes("CL") && href.includes(".html")) {
          const exists = listings.some(l => l.title === title);
          if (!exists) {
            listings.push({
              id: `cl-${city}-${Date.now()}-${count}`,
              title,
              description: title,
              location: city,
              category: category || "services",
              source: "craigslist",
              sourceUrl: href.startsWith("http") ? href : `https://${city}.craigslist.org${href}`,
              postedAt: new Date().toISOString(),
              profitPotential: "medium",
              outreachStatus: "new",
              scrapedAt: Date.now(),
            });
            count++;
          }
        }
      }

      await new Promise(r => setTimeout(r, 2000 + (_lssCounter++ % 3000)));
    } catch (e: any) {
      log(`Craigslist ${city}/${category} error: ${e.message}`);
    }
  }

  return listings;
}

async function scrapeGoogleLocalServices(query: string, location: string): Promise<LocalListing[]> {
  const listings: LocalListing[] = [];

  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query + " " + location + " needed hiring")}`;
    const res = await axios.get(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 15000,
    });

    const html = res.data as string;
    const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = resultPattern.exec(html)) !== null && count < 10) {
      const url = decodeURIComponent(match[1].replace(/.*uddg=/, "").replace(/&.*/, ""));
      const title = match[2].replace(/<[^>]+>/g, "").trim();
      const snippet = match[3].replace(/<[^>]+>/g, "").trim();

      if (title && title.length > 5) {
        listings.push({
          id: `ddg-${Date.now()}-${count}`,
          title,
          description: snippet || title,
          location,
          category: query,
          source: "web-search",
          sourceUrl: url,
          postedAt: new Date().toISOString(),
          profitPotential: "medium",
          outreachStatus: "new",
          scrapedAt: Date.now(),
        });
        count++;
      }
    }
  } catch (e: any) {
    log(`DuckDuckGo search error for "${query} ${location}": ${e.message}`);
  }

  return listings;
}

async function scrapeThumbtack(category: string, zipCode: string): Promise<LocalListing[]> {
  const listings: LocalListing[] = [];
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:thumbtack.com ${category} ${zipCode} request`)}`;
    const res = await axios.get(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 15000,
    });

    const html = res.data as string;
    const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = resultPattern.exec(html)) !== null && count < 8) {
      const url = decodeURIComponent(match[1].replace(/.*uddg=/, "").replace(/&.*/, ""));
      const title = match[2].replace(/<[^>]+>/g, "").trim();

      if (title && url.includes("thumbtack")) {
        listings.push({
          id: `tt-${Date.now()}-${count}`,
          title,
          description: `Thumbtack service request: ${title}`,
          location: zipCode,
          category,
          source: "thumbtack",
          sourceUrl: url,
          postedAt: new Date().toISOString(),
          profitPotential: "high",
          outreachStatus: "new",
          scrapedAt: Date.now(),
        });
        count++;
      }
    }
  } catch (e: any) {
    log(`Thumbtack scrape error: ${e.message}`);
  }

  return listings;
}

async function scrapeNextdoor(query: string, location: string): Promise<LocalListing[]> {
  const listings: LocalListing[] = [];
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:nextdoor.com "${query}" "${location}" recommendations`)}`;
    const res = await axios.get(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 15000,
    });

    const html = res.data as string;
    const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = resultPattern.exec(html)) !== null && count < 5) {
      const url = decodeURIComponent(match[1].replace(/.*uddg=/, "").replace(/&.*/, ""));
      const title = match[2].replace(/<[^>]+>/g, "").trim();

      if (title && url.includes("nextdoor")) {
        listings.push({
          id: `nd-${Date.now()}-${count}`,
          title,
          description: `Nextdoor: ${title}`,
          location,
          category: query,
          source: "nextdoor",
          sourceUrl: url,
          postedAt: new Date().toISOString(),
          profitPotential: "high",
          outreachStatus: "new",
          scrapedAt: Date.now(),
        });
        count++;
      }
    }
  } catch (e: any) {
    log(`Nextdoor scrape error: ${e.message}`);
  }

  return listings;
}

async function scrapeFacebookMarketplace(query: string, location: string): Promise<LocalListing[]> {
  const listings: LocalListing[] = [];
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:facebook.com/marketplace "${query}" "${location}"`)}`;
    const res = await axios.get(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 15000,
    });

    const html = res.data as string;
    const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = resultPattern.exec(html)) !== null && count < 8) {
      const url = decodeURIComponent(match[1].replace(/.*uddg=/, "").replace(/&.*/, ""));
      const title = match[2].replace(/<[^>]+>/g, "").trim();

      if (title && (url.includes("facebook") || url.includes("fb.com"))) {
        listings.push({
          id: `fb-${Date.now()}-${count}`,
          title,
          description: `Facebook Marketplace: ${title}`,
          location,
          category: query,
          source: "facebook-marketplace",
          sourceUrl: url,
          postedAt: new Date().toISOString(),
          profitPotential: "medium",
          outreachStatus: "new",
          scrapedAt: Date.now(),
        });
        count++;
      }
    }
  } catch (e: any) {
    log(`Facebook Marketplace scrape error: ${e.message}`);
  }

  return listings;
}

async function scrapeAngiesList(category: string, location: string): Promise<LocalListing[]> {
  const listings: LocalListing[] = [];
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:angi.com "${category}" "${location}" reviews`)}`;
    const res = await axios.get(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      timeout: 15000,
    });

    const html = res.data as string;
    const resultPattern = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let count = 0;

    while ((match = resultPattern.exec(html)) !== null && count < 8) {
      const url = decodeURIComponent(match[1].replace(/.*uddg=/, "").replace(/&.*/, ""));
      const title = match[2].replace(/<[^>]+>/g, "").trim();

      if (title && url.includes("angi.com")) {
        listings.push({
          id: `angi-${Date.now()}-${count}`,
          title,
          description: `Angi: ${title}`,
          location,
          category,
          source: "angi",
          sourceUrl: url,
          postedAt: new Date().toISOString(),
          profitPotential: "high",
          outreachStatus: "new",
          scrapedAt: Date.now(),
        });
        count++;
      }
    }
  } catch (e: any) {
    log(`Angi scrape error: ${e.message}`);
  }

  return listings;
}

function matchListingsToServices(listings: LocalListing[]): ServiceMatch[] {
  const matches: ServiceMatch[] = [];

  const demandSignals = ["needed", "looking for", "hiring", "want", "need", "help", "seek", "request", "quote", "estimate",
    "services", "contractor", "repair", "install", "build", "fix", "clean", "mow", "paint", "plumb"];

  for (const listing of listings) {
    const text = `${listing.title} ${listing.description}`.toLowerCase();
    const hasDemandSignal = demandSignals.some(s => text.includes(s));

    for (const service of OUR_SERVICES) {
      const matched = service.keywords.some(kw => text.includes(kw));
      if (matched) {
        const priceMatch = text.match(/\$(\d+)/);
        const theirBudget = priceMatch ? parseInt(priceMatch[1]) : service.sellPrice;
        const profitMargin = theirBudget - service.cost;

        listing.matchedService = service.name;
        listing.profitPotential = hasDemandSignal && profitMargin > 100 ? "high" : profitMargin > 30 ? "medium" : "low";

        matches.push({
          listing,
          ourService: service.name,
          ourCost: service.cost,
          theirBudget,
          profitMargin,
          outreachMessage: "",
        });
        break;
      }
    }

    if (!listing.matchedService && hasDemandSignal) {
      listing.profitPotential = "medium";
      listing.matchedService = "Lead Generation";
      matches.push({
        listing,
        ourService: "Lead Generation",
        ourCost: 0,
        theirBudget: 25,
        profitMargin: 25,
        outreachMessage: "",
      });
    }
  }

  return matches;
}

async function generateOutreachMessage(match: ServiceMatch): Promise<string> {
  try {
    const msg = await callLLMSimple(
      `Write a brief, friendly message (3-4 sentences) responding to this local service listing:

LISTING: "${match.listing.title}"
PLATFORM: ${match.listing.source}
LOCATION: ${match.listing.location}

You are offering: ${match.ourService}
Your price: $${match.theirBudget > 0 ? Math.floor(match.theirBudget * 0.8) : match.ourCost || 50}

Write as a friendly professional. Mention you saw their post, briefly describe how you can help, and suggest a quick call. Include "Tessera AI Services" as your company name. Keep it short and human.`,
      512
    );
    return msg;
  } catch {
    return `Hi! I saw your post about "${match.listing.title}" and I think I can help. I specialize in ${match.ourService} and would love to discuss your needs. Would you be open to a quick chat? — Tessera AI Services`;
  }
}

async function runFullLocalScan(cities: string[] = ["chicago"], categories: string[] = ["services"]): Promise<{
  newListings: LocalListing[];
  matches: ServiceMatch[];
  summary: string;
}> {
  log(`=== LOCAL SERVICES SCAN STARTING — ${cities.length} cities, ${categories.length} categories ===`);
  state.scanCount++;
  state.lastScan = Date.now();

  const allListings: LocalListing[] = [];

  for (const city of cities) {
    const [craigslist, fbMarketplace, angi, nextdoor, thumbtack, webSearch] = await Promise.allSettled([
      scrapeCraigslist(city, "services"),
      scrapeFacebookMarketplace("services needed", city),
      scrapeAngiesList("home services", city),
      scrapeNextdoor("recommendations", city),
      scrapeThumbtack("web design", city === "chicago" ? "60601" : "10001"),
      scrapeGoogleLocalServices("looking for contractor", city),
    ]);

    const results = [craigslist, fbMarketplace, angi, nextdoor, thumbtack, webSearch];
    const sources = ["craigslist", "facebook", "angi", "nextdoor", "thumbtack", "web"];

    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value.length > 0) {
        log(`  ${sources[i]}: ${r.value.length} listings from ${city}`);
        allListings.push(...r.value);
      }
    });

    await new Promise(r => setTimeout(r, 2000));
  }

  for (const category of ["roofing contractors needed", "web developer needed", "insurance agent", "moving company", "cleaning service needed"]) {
    for (const city of cities) {
      try {
        const results = await scrapeGoogleLocalServices(category, city);
        if (results.length > 0) {
          log(`  web-search "${category}" ${city}: ${results.length} listings`);
          allListings.push(...results);
        }
        await new Promise(r => setTimeout(r, 1500));
      } catch {}
    }
  }

  const existingIds = new Set(state.listings.map(l => l.title));
  const newListings = allListings.filter(l => !existingIds.has(l.title));

  state.listings.push(...newListings);
  state.totalScraped += newListings.length;

  if (state.listings.length > 500) {
    state.listings = state.listings.slice(-500);
  }

  const matches = matchListingsToServices(newListings);

  for (const match of matches.slice(0, 5)) {
    try {
      match.outreachMessage = await generateOutreachMessage(match);
      await new Promise(r => setTimeout(r, 1000));
    } catch {}
  }

  state.matches.push(...matches);
  state.totalMatches += matches.length;

  if (state.matches.length > 200) {
    state.matches = state.matches.slice(-200);
  }

  saveState();

  const summary = `Scraped ${allListings.length} listings (${newListings.length} new) across ${cities.join(",")}. Matched ${matches.length} to our services. Top matches: ${matches.slice(0, 3).map(m => `${m.ourService} ($${m.profitMargin} profit)`).join(", ") || "none yet"}`;
  log(`=== SCAN COMPLETE: ${summary} ===`);

  return { newListings, matches, summary };
}

async function startContinuousLocalScan(cities: string[] = ["chicago"]) {
  log("Starting continuous local services scan — every 15 minutes");

  setTimeout(async () => {
    try {
      await runFullLocalScan(cities);
    } catch (e: any) {
      log(`Initial scan error: ${e.message}`);
    }
  }, 20000);

  setInterval(async () => {
    try {
      await runFullLocalScan(cities);
    } catch (e: any) {
      log(`Scan cycle error: ${e.message}`);
    }
  }, 15 * 60 * 1000);
}

export {
  runFullLocalScan,
  startContinuousLocalScan,
  matchListingsToServices,
  generateOutreachMessage,
  scrapeCraigslist,
  scrapeFacebookMarketplace,
  scrapeAngiesList,
  scrapeNextdoor,
  scrapeThumbtack,
};

export function getLocalServicesState() {
  return {
    ...state,
    recentListings: state.listings.slice(-20),
    recentMatches: state.matches.slice(-10),
    sources: {
      craigslist: state.listings.filter(l => l.source === "craigslist").length,
      facebook: state.listings.filter(l => l.source === "facebook-marketplace").length,
      angi: state.listings.filter(l => l.source === "angi").length,
      nextdoor: state.listings.filter(l => l.source === "nextdoor").length,
      thumbtack: state.listings.filter(l => l.source === "thumbtack").length,
      webSearch: state.listings.filter(l => l.source === "web-search").length,
    },
    servicesOffered: OUR_SERVICES.map(s => ({ name: s.name, sellPrice: s.sellPrice, keywords: s.keywords.slice(0, 3) })),
  };
}
