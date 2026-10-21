import { Router, Request, Response } from "express";
import axios from "axios";

const router = Router();

const GROQ_KEY = process.env.GROQ_API_KEY;

async function aiAnalyze(prompt: string, systemPrompt: string = ""): Promise<string> {
  if (!GROQ_KEY) return "";
  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) await new Promise(r => setTimeout(r, 2000 * attempt));
      const res = await axios.post("https://api.groq.com/openai/v1/chat/completions", {
        model: "llama-3.3-70b-versatile", messages, max_tokens: 4096, temperature: 0.3,
      }, { headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" }, timeout: 60000 });
      return res.data?.choices?.[0]?.message?.content || "";
    } catch (err: any) {
      if (attempt === 2) throw err;
    }
  }
  return "";
}

interface PropertyLead {
  id: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  estimatedValue: number;
  discount: number;
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  yearBuilt: number;
  daysOnMarket: number;
  propertyType: string;
  source: string;
  listingUrl: string;
  ownerInfo: string;
  offerPrice: number;
  offerScript: string;
  issues: string[];
  score: number;
}

let cachedLeads: PropertyLead[] = [];
let lastScan = 0;

router.post("/scan", async (req: Request, res: Response) => {
  try {
    const { location = "Chicago, IL", maxPrice = 200000, minDiscount = 20, propertyType = "all" } = req.body;

    const analysis = await aiAnalyze(
      `Find wholesale real estate deals in ${location} under $${maxPrice} with at least ${minDiscount}% below market value. Property type: ${propertyType}.

Return ONLY a valid JSON array of 10 properties. Each object must have these exact fields:
{"address":"string","city":"string","state":"string","zip":"string","price":number,"estimatedValue":number,"bedrooms":number,"bathrooms":number,"sqft":number,"yearBuilt":number,"daysOnMarket":number,"propertyType":"string","source":"string","listingUrl":"string","issues":["string"],"ownerContact":"string","areaComps":"string"}

Focus on: foreclosures, pre-foreclosures, tax liens, probate sales, motivated sellers, long-listed properties (90+ days). Include realistic Chicago-area addresses, prices based on current market data, and actionable owner contact strategies.`,
      "You are a wholesale real estate analyst. Return ONLY valid JSON arrays with realistic property data. All prices and details must be realistic for the specified market. Include actual listing sites like Zillow, Redfin, Realtor.com, Auction.com, HUD homes, and county tax sale sites."
    );

    let properties: any[] = [];
    try {
      const match = analysis.match(/\[[\s\S]*\]/);
      if (match) properties = JSON.parse(match[0]);
    } catch { properties = []; }

    cachedLeads = properties.map((p: any, i: number) => {
      const discount = p.estimatedValue > 0 ? Math.round(((p.estimatedValue - p.price) / p.estimatedValue) * 100) : 25;
      const offerPrice = Math.round(p.estimatedValue * 0.65);
      return {
        id: `prop-${Date.now()}-${i}`,
        address: p.address || `${1000 + i * 100} Example St`,
        city: p.city || location.split(",")[0],
        state: p.state || location.split(",")[1]?.trim() || "IL",
        zip: p.zip || "60601",
        price: p.price || maxPrice * 0.7,
        estimatedValue: p.estimatedValue || maxPrice,
        discount,
        bedrooms: p.bedrooms || 3,
        bathrooms: p.bathrooms || 2,
        sqft: p.sqft || 1500,
        yearBuilt: p.yearBuilt || 1980,
        daysOnMarket: p.daysOnMarket || 120,
        propertyType: p.propertyType || "Single Family",
        source: p.source || "Zillow",
        listingUrl: p.listingUrl || `https://www.zillow.com/homes/${encodeURIComponent(p.address || 'Chicago')}_rb/`,
        ownerInfo: p.ownerContact || "Contact via listing agent",
        offerPrice,
        offerScript: `Hi, I noticed your property at ${p.address || 'this address'} has been listed for ${p.daysOnMarket || 120}+ days. I'm a local investor and can close quickly in cash within 14 days at $${offerPrice.toLocaleString()}. No repairs needed, no agent fees. Would you be open to discussing?`,
        issues: p.issues || [],
        score: Math.min(100, discount + Math.min(p.daysOnMarket || 0, 50) / 5 + (p.issues?.length || 0) * 5),
      };
    });

    lastScan = Date.now();
    res.json({ leads: cachedLeads, totalFound: cachedLeads.length, location, lastScan });
  } catch (error: any) {
    console.error("[RealEstate] Scan error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.post("/analyze-property", async (req: Request, res: Response) => {
  try {
    const { address, city, state } = req.body;
    const analysis = await aiAnalyze(
      `Deep analysis of property at ${address}, ${city}, ${state}. Provide: 1) Estimated ARV (after repair value), 2) Repair cost estimate, 3) Comparable sales in area, 4) Best offer price and strategy, 5) Potential issues (liens, code violations, structural), 6) Estimated wholesale fee, 7) Best buyer pool (rehabbers, landlords, etc), 8) Recommended marketing to end buyers. Return detailed JSON.`,
      "You are a wholesale real estate expert with deep knowledge of property analysis, comps, and deal structuring."
    );
    res.json({ analysis, address, timestamp: Date.now() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/leads", (_req: Request, res: Response) => {
  res.json({ leads: cachedLeads, lastScan });
});

export default router;
