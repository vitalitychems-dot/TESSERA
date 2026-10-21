import { Router, Request, Response } from "express";
import axios from "axios";

const router = Router();

const ODDS_API_KEYS = [
  process.env.ODDS_API_KEY,
  process.env.ODDS_API_KEY_2,
  process.env.ODDS_API_KEY_3,
].filter(Boolean) as string[];

let currentKeyIndex = 0;
function getNextOddsKey(): string | null {
  if (ODDS_API_KEYS.length === 0) return null;
  const key = ODDS_API_KEYS[currentKeyIndex % ODDS_API_KEYS.length];
  currentKeyIndex++;
  return key;
}

const FREE_ODDS_SOURCES = [
  { name: "odds-api", baseUrl: "https://api.the-odds-api.com/v4" },
];

interface ArbitrageOpp {
  id: string;
  sport: string;
  event: string;
  market: string;
  book1: { name: string; odds: number; pick: string; betUrl: string };
  book2: { name: string; odds: number; pick: string; betUrl: string };
  profitPct: number;
  bet1Amount: number;
  bet2Amount: number;
  guaranteedProfit: number;
  timestamp: number;
}

const SPORTSBOOK_URLS: Record<string, string> = {
  "draftkings": "https://sportsbook.draftkings.com",
  "fanduel": "https://sportsbook.fanduel.com",
  "betmgm": "https://sports.betmgm.com",
  "caesars": "https://www.williamhill.com/us",
  "pointsbet": "https://pointsbet.com",
  "bovada": "https://www.bovada.lv",
  "betonlineag": "https://www.betonline.ag",
  "mybookieag": "https://mybookie.ag",
  "betrivers": "https://www.betrivers.com",
  "unibet": "https://www.unibet.com",
  "pinnacle": "https://www.pinnacle.com",
  "williamhill_us": "https://www.caesars.com/sportsbook-and-casino",
  "superbook": "https://co.superbook.com",
  "wynnbet": "https://www.wynnbet.com",
  "bet365": "https://www.bet365.com",
  "barstool": "https://www.barstoolsportsbook.com",
  "twinspires": "https://www.twinspires.com",
  "betus": "https://www.betus.com.pa",
  "lowvig": "https://www.lowvig.ag",
  "betanysports": "https://www.betanysports.eu",
};

const AVAILABLE_SPORTS = [
  { key: "americanfootball_nfl", title: "NFL" },
  { key: "americanfootball_ncaaf", title: "NCAAF" },
  { key: "basketball_nba", title: "NBA" },
  { key: "basketball_ncaab", title: "NCAAB" },
  { key: "baseball_mlb", title: "MLB" },
  { key: "icehockey_nhl", title: "NHL" },
  { key: "soccer_epl", title: "EPL Soccer" },
  { key: "soccer_usa_mls", title: "MLS" },
  { key: "mma_mixed_martial_arts", title: "MMA/UFC" },
  { key: "boxing_boxing", title: "Boxing" },
  { key: "tennis_atp_french_open", title: "Tennis" },
  { key: "golf_masters_tournament_winner", title: "Golf" },
];

const MARKETS = ["h2h", "spreads", "totals"];

let cachedOpportunities: ArbitrageOpp[] = [];
let lastScanTime = 0;
let userBankroll = 1000;

function americanToDecimal(odds: number): number {
  if (odds > 0) return (odds / 100) + 1;
  return (100 / Math.abs(odds)) + 1;
}

function findArbitrageOpps(events: any[], bankroll: number): ArbitrageOpp[] {
  const opps: ArbitrageOpp[] = [];

  for (const event of events) {
    if (!event.bookmakers || event.bookmakers.length < 2) continue;

    for (const market of MARKETS) {
      const allOutcomes: Map<string, { bookmaker: string; price: number; point?: number }[]> = new Map();

      for (const bookmaker of event.bookmakers) {
        const mkt = bookmaker.markets?.find((m: any) => m.key === market);
        if (!mkt) continue;

        for (const outcome of mkt.outcomes) {
          const key = outcome.name + (outcome.point !== undefined ? `_${outcome.point}` : '');
          if (!allOutcomes.has(key)) allOutcomes.set(key, []);
          allOutcomes.get(key)!.push({
            bookmaker: bookmaker.key,
            price: outcome.price,
            point: outcome.point,
          });
        }
      }

      const outcomeKeys = Array.from(allOutcomes.keys());
      if (outcomeKeys.length < 2) continue;

      for (let i = 0; i < outcomeKeys.length; i++) {
        for (let j = i + 1; j < outcomeKeys.length; j++) {
          const side1Entries = allOutcomes.get(outcomeKeys[i])!;
          const side2Entries = allOutcomes.get(outcomeKeys[j])!;

          for (const s1 of side1Entries) {
            for (const s2 of side2Entries) {
              if (s1.bookmaker === s2.bookmaker) continue;

              const dec1 = americanToDecimal(s1.price);
              const dec2 = americanToDecimal(s2.price);
              const impliedProb = (1 / dec1) + (1 / dec2);

              if (impliedProb < 1) {
                const profitPct = ((1 / impliedProb) - 1) * 100;
                const bet1 = bankroll * (1 / dec1) / impliedProb;
                const bet2 = bankroll * (1 / dec2) / impliedProb;
                const profit = (bet1 * dec1) - bankroll;

                const bookUrl1 = SPORTSBOOK_URLS[s1.bookmaker] || `https://www.google.com/search?q=${encodeURIComponent(s1.bookmaker + ' sportsbook')}`;
                const bookUrl2 = SPORTSBOOK_URLS[s2.bookmaker] || `https://www.google.com/search?q=${encodeURIComponent(s2.bookmaker + ' sportsbook')}`;

                opps.push({
                  id: `${event.id}-${market}-${i}-${j}-${s1.bookmaker}-${s2.bookmaker}`,
                  sport: event.sport_title || event.sport_key,
                  event: `${event.home_team} vs ${event.away_team}`,
                  market: market === 'h2h' ? 'Moneyline' : market === 'spreads' ? 'Spread' : 'Over/Under',
                  book1: { name: s1.bookmaker, odds: s1.price, pick: outcomeKeys[i].split('_')[0], betUrl: bookUrl1 },
                  book2: { name: s2.bookmaker, odds: s2.price, pick: outcomeKeys[j].split('_')[0], betUrl: bookUrl2 },
                  profitPct: Math.round(profitPct * 100) / 100,
                  bet1Amount: Math.round(bet1 * 100) / 100,
                  bet2Amount: Math.round(bet2 * 100) / 100,
                  guaranteedProfit: Math.round(profit * 100) / 100,
                  timestamp: Date.now(),
                });
              }
            }
          }
        }
      }
    }
  }

  return opps.sort((a, b) => b.profitPct - a.profitPct);
}

router.post("/set-bankroll", (req: Request, res: Response) => {
  const { amount } = req.body;
  if (!amount || amount < 1) return res.status(400).json({ error: "Invalid bankroll amount" });
  userBankroll = amount;
  if (cachedOpportunities.length > 0) {
    cachedOpportunities = cachedOpportunities.map(opp => {
      const dec1 = americanToDecimal(opp.book1.odds);
      const dec2 = americanToDecimal(opp.book2.odds);
      const impliedProb = (1 / dec1) + (1 / dec2);
      const bet1 = amount * (1 / dec1) / impliedProb;
      const bet2 = amount * (1 / dec2) / impliedProb;
      return { ...opp, bet1Amount: Math.round(bet1 * 100) / 100, bet2Amount: Math.round(bet2 * 100) / 100, guaranteedProfit: Math.round((bet1 * dec1 - amount) * 100) / 100 };
    });
  }
  res.json({ bankroll: amount, opportunities: cachedOpportunities });
});

router.get("/opportunities", (_req: Request, res: Response) => {
  res.json({
    opportunities: cachedOpportunities,
    bankroll: userBankroll,
    lastScan: lastScanTime,
    sports: AVAILABLE_SPORTS,
    sportsbooks: Object.keys(SPORTSBOOK_URLS),
  });
});

router.post("/scan", async (req: Request, res: Response) => {
  try {
    const { sports, bankroll } = req.body;
    if (bankroll) userBankroll = bankroll;

    const sportsToScan = sports || AVAILABLE_SPORTS.map(s => s.key);
    const allEvents: any[] = [];
    const apiKey = getNextOddsKey();

    if (apiKey) {
      for (const sport of sportsToScan.slice(0, 5)) {
        try {
          const res = await axios.get(`${FREE_ODDS_SOURCES[0].baseUrl}/sports/${sport}/odds`, {
            params: {
              apiKey,
              regions: "us,us2,eu",
              markets: "h2h,spreads,totals",
              oddsFormat: "american",
            },
            timeout: 15000,
          });
          if (Array.isArray(res.data)) allEvents.push(...res.data);
          await new Promise(r => setTimeout(r, 500));
        } catch (err: any) {
          console.log(`[SportsArb] Failed to fetch ${sport}: ${err?.response?.status || err.message}`);
        }
      }
    }

    if (allEvents.length === 0) {
      cachedOpportunities = [];
      lastScanTime = Date.now();
      const noKeyMessage = !apiKey
        ? "No ODDS_API_KEY configured. Get a free key at https://the-odds-api.com/ and set ODDS_API_KEY in your environment variables."
        : "No events found from the API for the selected sports. Try again later or select different sports.";
      return res.json({
        opportunities: [],
        totalFound: 0,
        eventsScanned: 0,
        bankroll: userBankroll,
        lastScan: lastScanTime,
        dataSource: "no_data",
        message: noKeyMessage,
      });
    }

    cachedOpportunities = findArbitrageOpps(allEvents, userBankroll);
    lastScanTime = Date.now();

    res.json({
      opportunities: cachedOpportunities.slice(0, 50),
      totalFound: cachedOpportunities.length,
      eventsScanned: allEvents.length,
      bankroll: userBankroll,
      lastScan: lastScanTime,
      dataSource: "live",
    });
  } catch (error: any) {
    console.error("[SportsArb] Scan error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get("/sports", (_req: Request, res: Response) => {
  res.json({ sports: AVAILABLE_SPORTS, sportsbooks: Object.keys(SPORTSBOOK_URLS).map(k => ({ key: k, url: SPORTSBOOK_URLS[k] })) });
});

export default router;
