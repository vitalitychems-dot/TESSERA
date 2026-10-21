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

interface AffiliateProgram {
  id: string;
  name: string;
  network: string;
  commission: string;
  cookieDays: number;
  category: string;
  url: string;
  estimatedEarnings: string;
  difficulty: string;
  description: string;
}

interface ReferralTier {
  level: number;
  name: string;
  commission: string;
  members: number;
  earnings: number;
}

let cachedPrograms: AffiliateProgram[] = [];
let referralStructure: ReferralTier[] = [
  { level: 1, name: "Direct Referrals", commission: "30%", members: 0, earnings: 0 },
  { level: 2, name: "Tier 2", commission: "10%", members: 0, earnings: 0 },
  { level: 3, name: "Tier 3", commission: "5%", members: 0, earnings: 0 },
];
let lastScan = 0;

router.post("/scan-programs", async (req: Request, res: Response) => {
  try {
    const { niche = "health supplements", minCommission = 10 } = req.body;

    const analysis = await aiAnalyze(
      `Find the top 15 affiliate programs for "${niche}" with at least ${minCommission}% commission. Return ONLY a valid JSON array. Each object: {"name":"string","network":"string","commission":"string","cookieDays":number,"category":"string","url":"string","estimatedEarnings":"string","difficulty":"easy|medium|hard","description":"string"}. Include programs from ShareASale, CJ Affiliate, Impact, Amazon Associates, ClickBank, Rakuten, individual brand programs. Focus on highest converting, best paying programs.`,
      "You are an affiliate marketing expert. Return ONLY valid JSON arrays with real affiliate program data."
    );

    try {
      const match = analysis.match(/\[[\s\S]*\]/);
      if (match) {
        cachedPrograms = JSON.parse(match[0]).map((p: any, i: number) => ({ ...p, id: `aff-${Date.now()}-${i}` }));
      }
    } catch { }

    lastScan = Date.now();
    res.json({ programs: cachedPrograms, totalFound: cachedPrograms.length, niche, lastScan });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/build-funnel", async (req: Request, res: Response) => {
  try {
    const { program, targetAudience = "health-conscious adults 25-55" } = req.body;

    const analysis = await aiAnalyze(
      `Create a complete affiliate marketing funnel for: ${program}. Target: ${targetAudience}. Include: 1) Landing page copy, 2) Email sequence (5 emails), 3) Social media posts (5 for each: Instagram, TikTok, Facebook), 4) Blog post outline, 5) YouTube video script outline, 6) Referral incentive structure. Return structured JSON.`,
      "You are an expert affiliate marketer and copywriter. Create high-converting marketing materials."
    );
    res.json({ funnel: analysis, program, timestamp: Date.now() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/programs", (_req: Request, res: Response) => {
  res.json({ programs: cachedPrograms, referralStructure, lastScan });
});

router.post("/referral-structure", (req: Request, res: Response) => {
  const { tiers } = req.body;
  if (Array.isArray(tiers)) referralStructure = tiers;
  res.json({ referralStructure });
});

router.post("/service-match", async (req: Request, res: Response) => {
  try {
    const { location = "Chicago", serviceType = "all" } = req.body;

    const analysis = await aiAnalyze(
      `Find service arbitrage opportunities in ${location} for ${serviceType}. Scan for: 1) People offering services cheaply (Facebook Marketplace, Craigslist, Angi's List, Thumbtack), 2) People who NEED those services (matching demand), 3) The price gap (arbitrage opportunity). Return JSON array: {"provider":{"name":"string","service":"string","price":"string","platform":"string","contact":"string","url":"string"},"demand":{"client":"string","budget":"string","platform":"string","contact":"string","url":"string"},"arbitrage":{"profitMargin":"string","strategy":"string"}}. Find 10 real opportunities.`,
      "You are a service arbitrage expert. Match service providers with clients at different price points to profit from the spread."
    );

    res.json({ matches: analysis, location, serviceType, timestamp: Date.now() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
