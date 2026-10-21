import { callLLMSimple } from "./llm-helper";

interface Lead {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  source: string;
  sourceUrl?: string;
  category?: string;
  industry?: string;
  confidence: number;
  temperature: "hot" | "warm" | "cold";
}

interface SearchResult {
  query: string;
  location?: string;
  industry?: string;
  leads: Lead[];
  totalFound: number;
  sources: string[];
  searchTime: number;
}

interface RecentSearch {
  query: string;
  leadCount: number;
  timestamp: string;
  industry?: string;
}

export const INDUSTRY_PRESETS: Record<string, { keywords: string[]; searchTerms: string[] }> = {
  roofing: {
    keywords: ["roofing contractor", "roof repair", "roof replacement", "roofing company", "roofer"],
    searchTerms: ["roofing contractor near me", "roof repair company", "licensed roofer", "roof replacement estimate"],
  },
  "life-insurance": {
    keywords: ["life insurance agent", "insurance broker", "term life insurance", "whole life insurance", "insurance agency"],
    searchTerms: ["life insurance agent near me", "insurance broker", "term life quotes", "insurance agency local"],
  },
  logistics: {
    keywords: ["freight broker", "trucking company", "logistics provider", "shipping company", "3PL", "warehouse"],
    searchTerms: ["freight broker", "trucking company local", "logistics provider", "3PL warehouse", "shipping services"],
  },
  construction: {
    keywords: ["general contractor", "construction company", "home builder", "commercial contractor", "renovation"],
    searchTerms: ["general contractor near me", "construction company local", "home builder", "commercial construction"],
  },
  services: {
    keywords: ["home services", "plumbing", "electrical", "HVAC", "landscaping", "cleaning service"],
    searchTerms: ["home service provider", "plumber near me", "electrician local", "HVAC contractor", "landscaping company"],
  },
};

const recentSearches: RecentSearch[] = [];

function calculateTemperature(lead: Lead): "hot" | "warm" | "cold" {
  let score = 0;
  if (lead.email) score += 3;
  if (lead.phone) score += 3;
  if (lead.website) score += 1;
  if (lead.address) score += 1;
  if (lead.confidence >= 0.8) score += 2;
  else if (lead.confidence >= 0.6) score += 1;
  if (score >= 6) return "hot";
  if (score >= 3) return "warm";
  return "cold";
}

async function searchGooglePlaces(topic: string, location?: string): Promise<Lead[]> {
  const leads: Lead[] = [];
  try {
    const apifyToken = process.env.APIFY_API_TOKEN;
    if (apifyToken) {
      const query = location ? `${topic} in ${location}` : topic;
      const res = await fetch("https://api.apify.com/v2/acts/drobnikj~crawler-google-places/run-sync-get-dataset-items?token=" + apifyToken, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: [query],
          maxCrawledPlacesPerSearch: 20,
          language: "en",
          maxImages: 0,
          maxReviews: 0,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const places = await res.json();
        for (const place of (places || [])) {
          const lead: Lead = {
            name: place.title || place.name || "Unknown",
            phone: place.phone || undefined,
            website: place.website || undefined,
            address: place.address || place.street || undefined,
            source: "Google Places",
            sourceUrl: place.url || place.website || undefined,
            category: place.categoryName || topic,
            confidence: 0.85,
            temperature: "warm",
          };
          lead.temperature = calculateTemperature(lead);
          leads.push(lead);
        }
      }
    }
  } catch (e) {
    console.log(`[LeadGen] Google Places error: ${(e as Error).message}`);
  }
  return leads;
}

async function searchNominatim(topic: string, location?: string): Promise<Lead[]> {
  const leads: Lead[] = [];
  try {
    const query = encodeURIComponent(location ? `${topic} ${location}` : topic);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=15&addressdetails=1`, {
      headers: { "User-Agent": "TesseraLeadGen/1.0" },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const results = await res.json();
      for (const r of results) {
        if (r.display_name) {
          const lead: Lead = {
            name: r.display_name.split(",")[0] || "Unknown",
            address: r.display_name,
            source: "OpenStreetMap",
            sourceUrl: `https://www.openstreetmap.org/${r.osm_type}/${r.osm_id}`,
            category: r.type || topic,
            confidence: 0.5,
            temperature: "cold",
          };
          lead.temperature = calculateTemperature(lead);
          leads.push(lead);
        }
      }
    }
  } catch (e) {
    console.log(`[LeadGen] Nominatim error: ${(e as Error).message}`);
  }
  return leads;
}

async function searchDuckDuckGo(topic: string, location?: string): Promise<Lead[]> {
  const leads: Lead[] = [];
  try {
    const query = encodeURIComponent(location ? `${topic} ${location} contact email phone` : `${topic} contact email phone`);
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const html = await res.text();
      const titleRegex = /<a[^>]+class="result__a"[^>]*>(.*?)<\/a>/g;
      const urlRegex = /<a[^>]+class="result__a"[^>]+href="([^"]+)"/g;
      const snippetRegex = /<a[^>]+class="result__snippet"[^>]*>(.*?)<\/a>/g;

      let titleMatch, urlMatch, snippetMatch;
      const titles: string[] = [];
      const urls: string[] = [];
      const snippets: string[] = [];

      while ((titleMatch = titleRegex.exec(html))) titles.push(titleMatch[1].replace(/<[^>]+>/g, ""));
      while ((urlMatch = urlRegex.exec(html))) urls.push(urlMatch[1]);
      while ((snippetMatch = snippetRegex.exec(html))) snippets.push(snippetMatch[1].replace(/<[^>]+>/g, ""));

      for (let i = 0; i < Math.min(titles.length, 10); i++) {
        const snippet = snippets[i] || "";
        const emailMatch = snippet.match(/[\w.-]+@[\w.-]+\.\w{2,}/);
        const phoneMatch = snippet.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);

        let rawUrl = urls[i] || "";
        if (rawUrl.includes("uddg=")) {
          const decoded = decodeURIComponent(rawUrl.split("uddg=")[1]?.split("&")[0] || "");
          if (decoded) rawUrl = decoded;
        }

        const lead: Lead = {
          name: titles[i] || "Unknown",
          email: emailMatch ? emailMatch[0] : undefined,
          phone: phoneMatch ? phoneMatch[0] : undefined,
          website: rawUrl || undefined,
          source: "DuckDuckGo",
          sourceUrl: rawUrl || undefined,
          category: topic,
          confidence: emailMatch || phoneMatch ? 0.7 : 0.4,
          temperature: "cold",
        };
        lead.temperature = calculateTemperature(lead);
        leads.push(lead);
      }
    }
  } catch (e) {
    console.log(`[LeadGen] DuckDuckGo error: ${(e as Error).message}`);
  }
  return leads;
}

async function enrichLeadsWithLLM(topic: string, leads: Lead[], industry?: string): Promise<Lead[]> {
  if (leads.length === 0) return leads;

  try {
    const leadSummary = leads.slice(0, 10).map((l, i) =>
      `${i + 1}. ${l.name} — website: ${l.website || "none"}, email: ${l.email || "none"}, phone: ${l.phone || "none"}`
    ).join("\n");

    const industryContext = industry ? `Industry: ${industry}. ` : "";

    const prompt = `Given these search results for "${topic}", extract any additional contact information you can identify.
${industryContext}For each result, if you can determine a likely contact email format (e.g., info@domain.com, contact@domain.com) based on the website domain, suggest it.

Results:
${leadSummary}

Respond in JSON format: { "enrichments": [{ "index": 0, "email": "suggested@email.com", "category": "business type", "industry": "${industry || "general"}" }] }
Only include enrichments where you have reasonable confidence. Do not fabricate data.`;

    const response = await callLLMSimple(prompt);
    const text = String(response || "");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const enrichment of (parsed.enrichments || [])) {
        const idx = enrichment.index;
        if (idx >= 0 && idx < leads.length) {
          if (enrichment.email && !leads[idx].email) {
            leads[idx].email = enrichment.email;
            leads[idx].confidence = Math.min(leads[idx].confidence + 0.1, 0.95);
          }
          if (enrichment.category) {
            leads[idx].category = enrichment.category;
          }
          if (enrichment.industry) {
            leads[idx].industry = enrichment.industry;
          }
          leads[idx].temperature = calculateTemperature(leads[idx]);
        }
      }
    }
  } catch (e) {
    console.log(`[LeadGen] LLM enrichment error: ${(e as Error).message}`);
  }

  return leads;
}

export async function searchLeads(topic: string, location?: string, industry?: string): Promise<SearchResult> {
  const startTime = Date.now();

  let searchTopic = topic;
  if (industry && INDUSTRY_PRESETS[industry]) {
    const preset = INDUSTRY_PRESETS[industry];
    const matchesPreset = preset.keywords.some(k => topic.toLowerCase().includes(k.toLowerCase()));
    if (!matchesPreset) {
      searchTopic = `${topic} ${preset.keywords[0]}`;
    }
  }

  console.log(`[LeadGen] Searching leads for: "${searchTopic}" ${location ? `in ${location}` : ""} ${industry ? `[${industry}]` : ""}`);

  const [googleLeads, nominatimLeads, ddgLeads] = await Promise.all([
    searchGooglePlaces(searchTopic, location),
    searchNominatim(searchTopic, location),
    searchDuckDuckGo(searchTopic, location),
  ]);

  let allLeads = [...googleLeads, ...nominatimLeads, ...ddgLeads];

  if (industry) {
    allLeads = allLeads.map(l => ({ ...l, industry: industry }));
  }

  const seen = new Set<string>();
  allLeads = allLeads.filter(l => {
    const key = l.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  allLeads = await enrichLeadsWithLLM(topic, allLeads, industry);

  allLeads.sort((a, b) => {
    const tempOrder = { hot: 0, warm: 1, cold: 2 };
    const tempDiff = tempOrder[a.temperature] - tempOrder[b.temperature];
    if (tempDiff !== 0) return tempDiff;
    return b.confidence - a.confidence;
  });

  const sources = [...new Set(allLeads.map(l => l.source))];
  const searchTime = Date.now() - startTime;

  recentSearches.unshift({
    query: topic + (location ? ` (${location})` : ""),
    leadCount: allLeads.length,
    timestamp: new Date().toISOString(),
    industry,
  });
  if (recentSearches.length > 50) recentSearches.length = 50;

  console.log(`[LeadGen] Found ${allLeads.length} leads from ${sources.join(", ")} in ${searchTime}ms`);

  return {
    query: topic,
    location,
    industry,
    leads: allLeads,
    totalFound: allLeads.length,
    sources,
    searchTime,
  };
}

export function getRecentSearches() {
  return { searches: recentSearches };
}

export function getIndustryPresets() {
  return Object.entries(INDUSTRY_PRESETS).map(([id, preset]) => ({
    id,
    label: id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
    keywords: preset.keywords,
    searchTerms: preset.searchTerms,
  }));
}

export function initLeadGenerator() {
  console.log(`[LeadGen] Lead Generator initialized — Google Places, OpenStreetMap, DuckDuckGo, LLM enrichment, ${Object.keys(INDUSTRY_PRESETS).length} industry presets`);
}
