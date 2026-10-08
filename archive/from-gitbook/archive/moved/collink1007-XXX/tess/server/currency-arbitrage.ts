import { Router, Request, Response } from "express";
import axios from "axios";

const router = Router();

interface CurrencyOpp {
  id: string;
  path: string[];
  rates: number[];
  profitPct: number;
  investment: number;
  profit: number;
  sources: string[];
  timestamp: number;
}

let cachedOpps: CurrencyOpp[] = [];
let cachedRates: Record<string, Record<string, number>> = {};
let lastScan = 0;
let apiIndex = 0;

const FREE_FOREX_APIS = [
  "https://api.frankfurter.app/latest",
  "https://open.er-api.com/v6/latest",
];

const MAJOR_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD", "CNY", "HKD", "SGD", "SEK", "NOK", "MXN", "ZAR", "BRL", "INR", "KRW", "TRY", "PLN"];

const FREE_FOREX_APIS_ALT = [
  "https://api.exchangerate.host/latest",
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies",
];

let lastFetchTimes: Record<string, number> = {};
let fetchErrors: Record<string, number> = {};
let totalFetches = 0;
let successfulFetches = 0;

async function fetchRates(base: string): Promise<Record<string, number>> {
  const url = FREE_FOREX_APIS[apiIndex % FREE_FOREX_APIS.length];
  apiIndex++;
  totalFetches++;
  try {
    let rates: Record<string, number> = {};

    if (url.includes("frankfurter")) {
      const res = await axios.get(`https://api.frankfurter.app/latest`, {
        params: { from: base },
        timeout: 10000,
      });
      rates = res.data?.rates || {};
    } else if (url.includes("er-api")) {
      const res = await axios.get(`https://open.er-api.com/v6/latest/${base}`, {
        timeout: 10000,
      });
      rates = res.data?.rates || {};
    }

    if (Object.keys(rates).length === 0) {
      for (const altUrl of FREE_FOREX_APIS_ALT) {
        try {
          if (altUrl.includes("exchangerate.host")) {
            const res = await axios.get(altUrl, { params: { base, symbols: MAJOR_CURRENCIES.join(",") }, timeout: 8000 });
            if (res.data?.rates && Object.keys(res.data.rates).length > 0) {
              rates = res.data.rates;
              break;
            }
          }
        } catch {}
      }
    }

    if (Object.keys(rates).length > 0) {
      successfulFetches++;
      lastFetchTimes[base] = Date.now();
    }
    return rates;
  } catch (err: any) {
    fetchErrors[base] = (fetchErrors[base] || 0) + 1;
    if (Object.keys(fetchErrors).length > 100) {
      const keys = Object.keys(fetchErrors);
      for (const k of keys.slice(0, keys.length - 50)) delete fetchErrors[k];
    }
    if (Object.keys(lastFetchTimes).length > 100) {
      const keys = Object.keys(lastFetchTimes);
      for (const k of keys.slice(0, keys.length - 50)) delete lastFetchTimes[k];
    }
    console.log(`[CurrencyArb] API error for ${base}: ${err.message}`);
    return {};
  }
}

function findTriangularArbs(rates: Record<string, Record<string, number>>, investment: number): CurrencyOpp[] {
  const opps: CurrencyOpp[] = [];
  const currencies = Object.keys(rates);

  for (const a of currencies) {
    for (const b of currencies) {
      if (a === b || !rates[a]?.[b]) continue;
      for (const c of currencies) {
        if (c === a || c === b || !rates[b]?.[c] || !rates[c]?.[a]) continue;

        const rateAB = rates[a][b];
        const rateBC = rates[b][c];
        const rateCA = rates[c][a];

        const result = investment * rateAB * rateBC * rateCA;
        const profitPct = ((result - investment) / investment) * 100;

        if (profitPct > 0.05) {
          opps.push({
            id: `${a}-${b}-${c}`,
            path: [a, b, c, a],
            rates: [rateAB, rateBC, rateCA],
            profitPct: Math.round(profitPct * 1000) / 1000,
            investment,
            profit: Math.round((result - investment) * 100) / 100,
            sources: [FREE_FOREX_APIS[0], FREE_FOREX_APIS[1]],
            timestamp: Date.now(),
          });
        }
      }
    }
  }

  return opps.sort((a, b) => b.profitPct - a.profitPct).slice(0, 50);
}

router.post("/scan", async (req: Request, res: Response) => {
  try {
    const rawInvestment = Number(req.body.investment) || 10000;
    const investment = Math.min(Math.max(rawInvestment, 1), 10000000);
    const rawCurrencies = req.body.currencies;
    const currenciesToUse = (Array.isArray(rawCurrencies)
      ? rawCurrencies.filter((c: any) => typeof c === "string" && /^[A-Z]{3}$/.test(c)).slice(0, 20)
      : MAJOR_CURRENCIES.slice(0, 10));

    const allRates: Record<string, Record<string, number>> = {};
    for (const base of currenciesToUse.slice(0, 6)) {
      const rates = await fetchRates(base);
      if (Object.keys(rates).length > 0) {
        allRates[base] = {};
        for (const [k, v] of Object.entries(rates)) {
          if (currenciesToUse.includes(k)) allRates[base][k] = v as number;
        }
      }
      await new Promise(r => setTimeout(r, 500));
    }

    cachedRates = allRates;
    cachedOpps = findTriangularArbs(allRates, investment);
    lastScan = Date.now();

    res.json({
      opportunities: cachedOpps,
      totalFound: cachedOpps.length,
      currenciesScanned: Object.keys(allRates).length,
      rates: allRates,
      investment,
      lastScan,
      dataSource: "live",
      dataSourceLabel: "Real-time forex rates from frankfurter.app and open.er-api.com",
      apiHealth: {
        totalFetches,
        successfulFetches,
        successRate: totalFetches > 0 ? Math.round((successfulFetches / totalFetches) * 100) : 0,
        errors: fetchErrors,
        lastFetchTimes,
      },
    });
  } catch (error: any) {
    console.error("[CurrencyArb] Scan error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

router.get("/opportunities", (_req: Request, res: Response) => {
  res.json({ opportunities: cachedOpps, rates: cachedRates, lastScan, currencies: MAJOR_CURRENCIES });
});

router.get("/rates", async (_req: Request, res: Response) => {
  try {
    const rates = await fetchRates("USD");
    res.json({ base: "USD", rates, timestamp: Date.now() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
