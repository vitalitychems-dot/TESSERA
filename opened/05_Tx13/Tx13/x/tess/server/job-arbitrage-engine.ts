import { callLLMSimple } from "./llm-helper";

const log = (msg: string) => console.log(`[JobArbitrage] ${msg}`);

export interface JobListing {
  id: string;
  source: "indeed" | "github" | "rentahuman" | "freelancer" | "upwork" | "internal";
  type: "job" | "gig" | "bounty" | "resume" | "seeker";
  title: string;
  url: string;
  location: string;
  price: string;
  posted: string;
  description: string;
  category: string;
  scannedAt: number;
}

export interface JobMatch {
  id: string;
  category: string;
  opportunity: JobListing;
  seeker: JobListing | null;
  estimatedProfit: number;
  cutPercent: number;
  outreachTemplate: string;
  status: "found" | "contacted" | "in_progress" | "completed" | "expired";
  createdAt: number;
  agentAssigned?: string;
}

export interface JobArbitrageState {
  listings: JobListing[];
  matches: JobMatch[];
  scanHistory: Array<{ timestamp: number; source: string; found: number }>;
  totalScans: number;
  totalMatches: number;
  totalEstimatedProfit: number;
  isScanning: boolean;
  lastScan: number;
  config: {
    cutPercent: number;
    scanIntervalMs: number;
    categories: Record<string, string[]>;
    rssSources: Array<{ name: string; url: string; enabled: boolean }>;
  };
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "software": ["developer", "engineer", "coding", "programming", "python", "javascript", "react", "node", "web dev", "full stack", "frontend", "backend", "api", "software"],
  "ai-ml": ["machine learning", "ai", "artificial intelligence", "data science", "nlp", "deep learning", "llm", "gpt", "model", "neural", "chatbot", "ai agent", "ai assistant", "virtual assistant", "conversational ai", "support bot"],
  "design": ["design", "ui", "ux", "graphic", "figma", "photoshop", "logo", "branding", "creative"],
  "writing": ["writer", "content", "copywriting", "blog", "article", "seo content", "technical writing", "documentation"],
  "data": ["data entry", "data analysis", "spreadsheet", "excel", "database", "scraping", "automation"],
  "marketing": ["marketing", "seo", "social media", "ads", "advertising", "growth", "email marketing", "campaign"],
  "crypto": ["blockchain", "solana", "ethereum", "defi", "smart contract", "web3", "nft", "token", "crypto"],
  "general": ["virtual assistant", "admin", "support", "customer service", "help", "assistant", "labor"],
};

function categorizeJob(title: string, desc: string): string {
  const text = `${title} ${desc}`.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) return cat;
  }
  return "other";
}

function extractPrice(text: string): number {
  const match = text.match(/\$?([\d,]+(?:\.\d{2})?)/);
  if (match) return parseFloat(match[1].replace(/,/g, ""));
  return 0;
}

const state: JobArbitrageState = {
  listings: [],
  matches: [],
  scanHistory: [],
  totalScans: 0,
  totalMatches: 0,
  totalEstimatedProfit: 0,
  isScanning: false,
  lastScan: 0,
  config: {
    cutPercent: 15,
    scanIntervalMs: 30 * 60 * 1000,
    categories: CATEGORY_KEYWORDS,
    rssSources: [
      { name: "Indeed Chicago Jobs", url: "https://www.indeed.com/rss?q=freelance+developer&l=remote", enabled: true },
      { name: "Indeed Remote Tech", url: "https://www.indeed.com/rss?q=remote+software+engineer&l=", enabled: true },
      { name: "Indeed AI Jobs", url: "https://www.indeed.com/rss?q=AI+machine+learning&l=remote", enabled: true },
      { name: "GitHub Jobs API", url: "https://api.github.com/search/issues?q=label:bounty+state:open&sort=created&per_page=20", enabled: true },
      { name: "RentAHuman Bounties", url: "/api/rentahuman/bounties", enabled: true },
    ],
  },
};

async function fetchRSSFeed(url: string, sourceName: string): Promise<JobListing[]> {
  const listings: JobListing[] = [];
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "TesseractAI/1.0 JobScanner" },
    });
    clearTimeout(timeout);
    if (!res.ok) return [];

    const text = await res.text();
    const items = text.match(/<item>([\s\S]*?)<\/item>/gi) || [];
    for (const item of items.slice(0, 30)) {
      const titleMatch = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/i);
      const linkMatch = item.match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/i);
      const descMatch = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i);
      const pubMatch = item.match(/<pubDate>(.*?)<\/pubDate>/i);

      const title = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
      const link = linkMatch?.[1]?.trim() || "";
      const desc = descMatch?.[1]?.replace(/<[^>]+>/g, "").trim().slice(0, 400) || "";

      if (!title || !link) continue;

      listings.push({
        id: `${sourceName.toLowerCase().replace(/\s/g, "-")}-${Buffer.from(link).toString("base64").slice(0, 16)}`,
        source: "indeed",
        type: "job",
        title,
        url: link,
        location: "Remote / Various",
        price: "Check listing",
        posted: pubMatch?.[1] || new Date().toISOString(),
        description: desc,
        category: categorizeJob(title, desc),
        scannedAt: Date.now(),
      });
    }
  } catch (e: any) {
    log(`RSS fetch error (${sourceName}): ${e.message}`);
  }
  return listings;
}

async function fetchGitHubBounties(): Promise<JobListing[]> {
  const listings: JobListing[] = [];
  try {
    const queries = [
      "label:bounty+state:open",
      "label:help-wanted+state:open+language:typescript",
      "label:good-first-issue+state:open+language:python",
    ];
    for (const q of queries.slice(0, 1)) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        `https://api.github.com/search/issues?q=${q}&sort=created&per_page=15`,
        {
          signal: controller.signal,
          headers: {
            "User-Agent": "TesseractAI/1.0",
            Accept: "application/vnd.github.v3+json",
          },
        }
      );
      clearTimeout(timeout);
      if (!res.ok) continue;
      const data = await res.json();
      for (const issue of (data.items || []).slice(0, 15)) {
        const bountyMatch = issue.body?.match(/\$?([\d,]+(?:\.\d{2})?)/);
        const price = bountyMatch ? `$${bountyMatch[1]}` : "Check issue";
        listings.push({
          id: `gh-bounty-${issue.id}`,
          source: "github",
          type: "bounty",
          title: `${issue.title} (${issue.repository_url?.split("/").slice(-1)[0] || "repo"})`,
          url: issue.html_url,
          location: "Remote",
          price,
          posted: issue.created_at,
          description: (issue.body || "").slice(0, 400),
          category: categorizeJob(issue.title, issue.body || ""),
          scannedAt: Date.now(),
        });
      }
    }
  } catch (e: any) {
    log(`GitHub bounty fetch error: ${e.message}`);
  }
  return listings;
}

function generateOutreachTemplate(opp: JobListing, seeker: JobListing | null, cutPercent: number): string {
  const price = extractPrice(opp.price);
  const estProfit = Math.round(price * cutPercent / 100);
  if (seeker) {
    return `Subject: Qualified Match for "${opp.title}"\n\nHi,\n\nI found your posting and have a qualified candidate available.\n\nOpportunity: ${opp.title}\nSource: ${opp.source}\nListing: ${opp.url}\n\nCandidate: ${seeker.title}\nProfile: ${seeker.url}\n\nMatching fee: ${cutPercent}% (est. $${estProfit})\n\nInterested? Reply to discuss.\n\n— Tesseract AI Matching Service`;
  }
  return `Subject: Application for "${opp.title}"\n\nHi,\n\nOur AI agent swarm specializes in ${opp.category} tasks. We can complete this job with our autonomous agents.\n\nListing: ${opp.url}\nOur rate: Competitive (we deliver fast with AI assistance)\n\nKey capabilities:\n- 26 specialized AI agents working in parallel\n- 24/7 availability\n- Quality-assured output with peer review\n\n— Tesseract Sovereign AI`;
}

function findMatches(): JobMatch[] {
  const opportunities = state.listings.filter(l => l.type === "job" || l.type === "gig" || l.type === "bounty");
  const seekers = state.listings.filter(l => l.type === "seeker" || l.type === "resume");
  const newMatches: JobMatch[] = [];
  const existingIds = new Set(state.matches.map(m => m.id));

  for (const opp of opportunities) {
    if (Date.now() - opp.scannedAt > 7 * 24 * 3600 * 1000) continue;

    const matchedSeeker = seekers.find(s => s.category === opp.category && s.category !== "other");
    const price = extractPrice(opp.price);
    const estProfit = Math.round(price * state.config.cutPercent / 100);
    const matchId = `match-${opp.id}-${matchedSeeker?.id || "direct"}`;

    if (existingIds.has(matchId)) continue;

    const template = generateOutreachTemplate(opp, matchedSeeker || null, state.config.cutPercent);
    const match: JobMatch = {
      id: matchId,
      category: opp.category,
      opportunity: opp,
      seeker: matchedSeeker || null,
      estimatedProfit: estProfit,
      cutPercent: state.config.cutPercent,
      outreachTemplate: template,
      status: "found",
      createdAt: Date.now(),
    };
    newMatches.push(match);
  }
  return newMatches;
}

export async function runJobScan(): Promise<{ scanned: number; newListings: number; newMatches: number }> {
  if (state.isScanning) return { scanned: 0, newListings: 0, newMatches: 0 };
  state.isScanning = true;
  const beforeCount = state.listings.length;
  const existingIds = new Set(state.listings.map(l => l.id));

  try {
    log("=== JOB ARBITRAGE SCAN STARTED ===");

    for (const source of state.config.rssSources) {
      if (!source.enabled || source.url.startsWith("/api")) continue;
      try {
        let listings: JobListing[] = [];
        if (source.url.includes("github.com")) {
          listings = await fetchGitHubBounties();
        } else {
          listings = await fetchRSSFeed(source.url, source.name);
        }
        const newOnes = listings.filter(l => !existingIds.has(l.id));
        state.listings.push(...newOnes);
        newOnes.forEach(l => existingIds.add(l.id));
        state.scanHistory.push({ timestamp: Date.now(), source: source.name, found: listings.length });
        log(`  ${source.name}: ${listings.length} found, ${newOnes.length} new`);
      } catch (e: any) {
        log(`  ${source.name}: error - ${e.message}`);
      }
    }

    if (state.listings.length > 500) {
      state.listings.sort((a, b) => b.scannedAt - a.scannedAt);
      state.listings = state.listings.slice(0, 500);
    }

    const newMatches = findMatches();
    state.matches.push(...newMatches);
    state.totalMatches += newMatches.length;
    state.totalEstimatedProfit += newMatches.reduce((s, m) => s + m.estimatedProfit, 0);

    if (state.matches.length > 200) {
      state.matches.sort((a, b) => b.createdAt - a.createdAt);
      state.matches = state.matches.slice(0, 200);
    }

    state.totalScans++;
    state.lastScan = Date.now();
    state.isScanning = false;

    const newListings = state.listings.length - beforeCount;
    log(`=== SCAN COMPLETE: ${newListings} new listings, ${newMatches.length} new matches ===`);
    return { scanned: state.totalScans, newListings, newMatches: newMatches.length };
  } catch (e: any) {
    state.isScanning = false;
    log(`Scan error: ${e.message}`);
    return { scanned: 0, newListings: 0, newMatches: 0 };
  }
}

export async function aiAnalyzeOpportunities(): Promise<string> {
  const topMatches = state.matches
    .filter(m => m.status === "found")
    .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
    .slice(0, 10);

  const catBreakdown: Record<string, number> = {};
  state.listings.forEach(l => { catBreakdown[l.category] = (catBreakdown[l.category] || 0) + 1; });

  const prompt = `Analyze these job arbitrage opportunities and give a concise strategy:

Total listings scanned: ${state.listings.length}
Total matches found: ${state.matches.length}
Categories: ${JSON.stringify(catBreakdown)}
Top opportunities:
${topMatches.map(m => `- ${m.category}: "${m.opportunity.title}" (${m.opportunity.source}) est. profit: $${m.estimatedProfit}`).join("\n")}

Give 3-5 actionable recommendations for maximizing income from these opportunities. Focus on which categories to prioritize, how to automate outreach, and which platforms yield best returns.`;

  try {
    const analysis = await callLLMSimple(prompt, "You are a revenue optimization AI analyzing job arbitrage opportunities. Be specific and actionable.");
    return analysis || "Analysis pending — insufficient data for recommendations.";
  } catch {
    return "Analysis unavailable — LLM timeout. Will retry next cycle.";
  }
}

export function getJobArbitrageState(): JobArbitrageState {
  return { ...state };
}

export function getJobArbitrageSummary() {
  const catBreakdown: Record<string, number> = {};
  state.listings.forEach(l => { catBreakdown[l.category] = (catBreakdown[l.category] || 0) + 1; });

  const sourceBreakdown: Record<string, number> = {};
  state.listings.forEach(l => { sourceBreakdown[l.source] = (sourceBreakdown[l.source] || 0) + 1; });

  return {
    totalListings: state.listings.length,
    totalMatches: state.matches.length,
    totalScans: state.totalScans,
    totalEstimatedProfit: state.totalEstimatedProfit,
    isScanning: state.isScanning,
    lastScan: state.lastScan,
    categoryBreakdown: catBreakdown,
    sourceBreakdown: sourceBreakdown,
    topMatches: state.matches
      .filter(m => m.status === "found")
      .sort((a, b) => b.estimatedProfit - a.estimatedProfit)
      .slice(0, 10),
    recentListings: state.listings
      .sort((a, b) => b.scannedAt - a.scannedAt)
      .slice(0, 20),
    config: state.config,
  };
}

let scanInterval: NodeJS.Timeout | null = null;

export function startJobArbitrageScanner() {
  log("Job Arbitrage Scanner initialized — scanning every 30 minutes");
  setTimeout(() => runJobScan(), 5000);
  scanInterval = setInterval(() => runJobScan(), state.config.scanIntervalMs);
}

export function stopJobArbitrageScanner() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
    log("Scanner stopped");
  }
}
