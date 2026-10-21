import { fetchStockQuote, fetchStockHistory, type OHLCVBar, type StockQuote } from "./esoteric-archive";

const log = (m: string) => console.log(`[StockPrediction] ${m}`);

export interface TechnicalIndicators {
  rsi14: number;
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  bollingerPct: number;
  sma20: number;
  sma50: number;
  sma200: number;
  ema12: number;
  ema26: number;
  atr14: number;
  volumeRatio: number;
  momentum: number;
  stochasticK: number;
  stochasticD: number;
}

export interface FibonacciLevels {
  trend: "up" | "down";
  high: number;
  low: number;
  retrace236: number;
  retrace382: number;
  retrace500: number;
  retrace618: number;
  retrace786: number;
  extension127: number;
  extension162: number;
  supports: number[];
  resistances: number[];
  harmonicPattern?: string;
}

export interface MonteCarloPrediction {
  paths: number;
  currentPrice: number;
  days: number;
  meanPrice: number;
  medianPrice: number;
  stdDev: number;
  confidence95Low: number;
  confidence95High: number;
  confidence68Low: number;
  confidence68High: number;
  bullCase: number;
  baseCase: number;
  bearCase: number;
  probAboveEntry: number;
  probBull: number;
  probBear: number;
  annualizedVolatility: number;
  drift: number;
  coneBands: Array<{ day: number; median: number; p5: number; p25: number; p75: number; p95: number }>;
}

export interface BacktestResult {
  ticker: string;
  strategy: string;
  lookbackDays: number;
  totalSignals: number;
  correctDirectional: number;
  hitRate: number;
  avgReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  calmarRatio: number;
  cachedAt: string;
}

export interface MomentumSignals {
  priceMomentum1M: number;
  priceMomentum3M: number;
  priceMomentum6M: number;
  volumeMomentum: number;
  rsiDivergence: "bullish" | "bearish" | "none";
  macdCrossover: "bullish" | "bearish" | "none";
  trendStrength: number;
  zScore: number;
  meanReversionSignal: "oversold" | "overbought" | "neutral";
  relativeStrength: number;
}

export interface PredictionReport {
  ticker: string;
  name?: string;
  generatedAt: string;
  currentPrice: number;
  quote: StockQuote | null;
  technicals: TechnicalIndicators;
  fibonacci: FibonacciLevels;
  monteCarlo: MonteCarloPrediction;
  momentum: MomentumSignals;
  backtest: BacktestResult;
  targets: {
    bullCase: { price: number; probability: number; timeframe: string };
    baseCase: { price: number; probability: number; timeframe: string };
    bearCase: { price: number; probability: number; timeframe: string };
  };
  supports: number[];
  resistances: number[];
  verdict: "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";
  confidence: number;
  compositeScore: number;
  summary: string;
  chartData: {
    priceHistory: Array<{ date: string; close: number; volume: number }>;
    monteCarloConeBands: MonteCarloPrediction["coneBands"];
    bollingerBands: Array<{ date: string; upper: number; middle: number; lower: number; close: number }>;
    fibLevels: number[];
  };
}

const backtestCache = new Map<string, BacktestResult>();
const predictionCache = new Map<string, { data: PredictionReport; timestamp: number }>();
const PREDICTION_CACHE_TTL = 300_000;

function calcEMA(prices: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  let prev = prices.slice(0, period).reduce((s, v) => s + v, 0) / period;
  ema.push(...Array(period - 1).fill(NaN), prev);
  for (let i = period; i < prices.length; i++) {
    prev = prices[i] * k + prev * (1 - k);
    ema.push(prev);
  }
  return ema;
}

function calcSMA(prices: number[], period: number): number[] {
  return prices.map((_, i) => {
    if (i < period - 1) return NaN;
    return prices.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period;
  });
}

function calcRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  const recent = changes.slice(-period);
  const gains = recent.filter(c => c > 0).reduce((s, v) => s + v, 0) / period;
  const losses = Math.abs(recent.filter(c => c < 0).reduce((s, v) => s + v, 0)) / period;
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function calcATR(bars: OHLCVBar[], period: number = 14): number {
  if (bars.length < 2) return 0;
  const trs = bars.slice(1).map((b, i) => {
    const prev = bars[i].close;
    return Math.max(b.high - b.low, Math.abs(b.high - prev), Math.abs(b.low - prev));
  });
  return trs.slice(-period).reduce((s, v) => s + v, 0) / Math.min(period, trs.length);
}

function calcBollinger(closes: number[], period: number = 20, stdMult: number = 2): { upper: number; middle: number; lower: number; pct: number } {
  if (closes.length < period) {
    const price = closes[closes.length - 1] || 100;
    return { upper: price * 1.02, middle: price, lower: price * 0.98, pct: 0.5 };
  }
  const recent = closes.slice(-period);
  const mean = recent.reduce((s, v) => s + v, 0) / period;
  const variance = recent.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
  const std = Math.sqrt(variance);
  const upper = mean + stdMult * std;
  const lower = mean - stdMult * std;
  const price = closes[closes.length - 1];
  const pct = std === 0 ? 0.5 : (price - lower) / (upper - lower);
  return { upper, middle: mean, lower, pct };
}

function calcStochastic(bars: OHLCVBar[], kPeriod: number = 14, dPeriod: number = 3): { k: number; d: number } {
  if (bars.length < kPeriod) return { k: 50, d: 50 };
  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < bars.length; i++) {
    const window = bars.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...window.map(b => b.high));
    const low = Math.min(...window.map(b => b.low));
    const close = bars[i].close;
    kValues.push(high === low ? 50 : ((close - low) / (high - low)) * 100);
  }
  const k = kValues[kValues.length - 1];
  const d = kValues.slice(-dPeriod).reduce((s, v) => s + v, 0) / Math.min(dPeriod, kValues.length);
  return { k, d };
}

function calcTechnicalIndicators(bars: OHLCVBar[]): TechnicalIndicators {
  const closes = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);

  const rsi14 = calcRSI(closes, 14);
  const ema12Arr = calcEMA(closes, 12);
  const ema26Arr = calcEMA(closes, 26);
  const ema12 = ema12Arr[ema12Arr.length - 1] || closes[closes.length - 1];
  const ema26 = ema26Arr[ema26Arr.length - 1] || closes[closes.length - 1];
  const macdLine = ema12 - ema26;

  const macdArr = closes.slice(25).map((_, i) => (ema12Arr[i + 25] || 0) - (ema26Arr[i + 25] || 0));
  const signalArr = calcEMA(macdArr, 9);
  const macdSignal = signalArr[signalArr.length - 1] || 0;
  const macdHistogram = macdLine - macdSignal;

  const boll = calcBollinger(closes);
  const sma20Arr = calcSMA(closes, 20);
  const sma50Arr = calcSMA(closes, 50);
  const sma200Arr = calcSMA(closes, 200);
  const sma20 = sma20Arr[sma20Arr.length - 1] || closes[closes.length - 1];
  const sma50 = sma50Arr[sma50Arr.length - 1] || closes[closes.length - 1];
  const sma200 = sma200Arr[sma200Arr.length - 1] || closes[closes.length - 1];

  const atr14 = calcATR(bars, 14);
  const avgVol = volumes.slice(-20).reduce((s, v) => s + v, 0) / Math.min(20, volumes.length);
  const currentVol = volumes[volumes.length - 1] || 0;
  const volumeRatio = avgVol > 0 ? currentVol / avgVol : 1;

  const momentum = closes.length >= 11
    ? ((closes[closes.length - 1] - closes[closes.length - 11]) / closes[closes.length - 11]) * 100
    : 0;

  const stoch = calcStochastic(bars);

  return {
    rsi14,
    macdLine,
    macdSignal,
    macdHistogram,
    bollingerUpper: boll.upper,
    bollingerMiddle: boll.middle,
    bollingerLower: boll.lower,
    bollingerPct: boll.pct,
    sma20,
    sma50,
    sma200,
    ema12,
    ema26,
    atr14,
    volumeRatio,
    momentum,
    stochasticK: stoch.k,
    stochasticD: stoch.d,
  };
}

function calcFibonacciLevels(bars: OHLCVBar[]): FibonacciLevels {
  const lookback = Math.min(90, bars.length);
  const recent = bars.slice(-lookback);
  const highs = recent.map(b => b.high);
  const lows = recent.map(b => b.low);
  const high = Math.max(...highs);
  const low = Math.min(...lows);
  const current = bars[bars.length - 1].close;
  const diff = high - low;

  const highIdx = highs.indexOf(high);
  const lowIdx = lows.indexOf(low);
  const trend = lowIdx < highIdx ? "up" : "down";

  const fibs = [0.236, 0.382, 0.5, 0.618, 0.786];
  const levels = fibs.map(f => high - diff * f);

  const [retrace236, retrace382, retrace500, retrace618, retrace786] = levels;
  const extension127 = low + diff * 1.272;
  const extension162 = low + diff * 1.618;

  const fibValues = [retrace236, retrace382, retrace500, retrace618, retrace786, extension127, extension162];
  const supports = fibValues.filter(f => f < current).sort((a, b) => b - a).slice(0, 3);
  const resistances = fibValues.filter(f => f > current).sort((a, b) => a - b).slice(0, 3);

  let harmonicPattern: string | undefined;
  const pct618 = Math.abs((current - retrace618) / retrace618);
  const pct382 = Math.abs((current - retrace382) / retrace382);
  if (pct618 < 0.015) harmonicPattern = "Bat/Gartley completion at 0.618";
  else if (pct382 < 0.015) harmonicPattern = "AB=CD pattern at 0.382";

  return { trend, high, low, retrace236, retrace382, retrace500, retrace618, retrace786, extension127, extension162, supports, resistances, harmonicPattern };
}

function runMonteCarlo(bars: OHLCVBar[], days: number = 30, paths: number = 10000): MonteCarloPrediction {
  const closes = bars.map(b => b.close);
  const currentPrice = closes[closes.length - 1];

  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / returns.length;
  const dailyVol = Math.sqrt(variance);
  const annualizedVol = dailyVol * Math.sqrt(252);
  const drift = mean - 0.5 * variance;

  const finalPrices: number[] = [];
  const pathsByDay: number[][] = Array.from({ length: days }, () => []);

  for (let p = 0; p < paths; p++) {
    let price = currentPrice;
    for (let d = 0; d < days; d++) {
      const z = boxMullerRandom();
      price = price * Math.exp(drift + dailyVol * z);
      pathsByDay[d].push(price);
    }
    finalPrices.push(price);
  }

  finalPrices.sort((a, b) => a - b);

  const p = (pct: number) => finalPrices[Math.floor(paths * pct / 100)];
  const meanPrice = finalPrices.reduce((s, v) => s + v, 0) / paths;
  const medianPrice = p(50);
  const stdDev = Math.sqrt(finalPrices.reduce((s, v) => s + Math.pow(v - meanPrice, 2), 0) / paths);

  const probAboveEntry = (finalPrices.filter(pr => pr > currentPrice).length / paths) * 100;
  const probBull = (finalPrices.filter(pr => pr > currentPrice * 1.05).length / paths) * 100;
  const probBear = (finalPrices.filter(pr => pr < currentPrice * 0.95).length / paths) * 100;

  const coneBands = pathsByDay.slice(0, days).map((dayPrices, i) => {
    dayPrices.sort((a, b) => a - b);
    return {
      day: i + 1,
      median: dayPrices[Math.floor(dayPrices.length * 0.5)],
      p5: dayPrices[Math.floor(dayPrices.length * 0.05)],
      p25: dayPrices[Math.floor(dayPrices.length * 0.25)],
      p75: dayPrices[Math.floor(dayPrices.length * 0.75)],
      p95: dayPrices[Math.floor(dayPrices.length * 0.95)],
    };
  }).filter((_, i) => i % 3 === 2 || i === 0 || i === days - 1);

  return {
    paths,
    currentPrice,
    days,
    meanPrice,
    medianPrice,
    stdDev,
    confidence95Low: p(2.5),
    confidence95High: p(97.5),
    confidence68Low: p(16),
    confidence68High: p(84),
    bullCase: p(80),
    baseCase: medianPrice,
    bearCase: p(20),
    probAboveEntry,
    probBull,
    probBear,
    annualizedVolatility: annualizedVol * 100,
    drift: drift * 252 * 100,
    coneBands,
  };
}

let _normal: number | null = null;
function boxMullerRandom(): number {
  if (_normal !== null) {
    const v = _normal;
    _normal = null;
    return v;
  }
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const mag = Math.sqrt(-2 * Math.log(u));
  _normal = mag * Math.sin(2 * Math.PI * v);
  return mag * Math.cos(2 * Math.PI * v);
}

function calcMomentumSignals(bars: OHLCVBar[], technicals: TechnicalIndicators): MomentumSignals {
  const closes = bars.map(b => b.close);
  const current = closes[closes.length - 1];

  const m1 = closes.length >= 22
    ? ((current - closes[closes.length - 22]) / closes[closes.length - 22]) * 100 : 0;
  const m3 = closes.length >= 66
    ? ((current - closes[closes.length - 66]) / closes[closes.length - 66]) * 100 : 0;
  const m6 = closes.length >= 132
    ? ((current - closes[closes.length - 132]) / closes[closes.length - 132]) * 100 : 0;

  const volumes = bars.map(b => b.volume);
  const avgVol = volumes.slice(-20).reduce((s, v) => s + v, 0) / 20;
  const recentVol = volumes.slice(-5).reduce((s, v) => s + v, 0) / 5;
  const volumeMomentum = avgVol > 0 ? ((recentVol - avgVol) / avgVol) * 100 : 0;

  let rsiDivergence: "bullish" | "bearish" | "none" = "none";
  if (technicals.rsi14 < 40 && m1 < -5) rsiDivergence = "bullish";
  else if (technicals.rsi14 > 60 && m1 > 5) rsiDivergence = "bearish";

  const macdCrossover: "bullish" | "bearish" | "none" =
    technicals.macdHistogram > 0 && technicals.macdLine > 0 ? "bullish" :
    technicals.macdHistogram < 0 && technicals.macdLine < 0 ? "bearish" : "none";

  const trendStrength = Math.min(100, Math.abs(
    (technicals.sma20 > technicals.sma50 ? 25 : -25) +
    (technicals.sma50 > technicals.sma200 ? 25 : -25) +
    (current > technicals.sma20 ? 25 : -25) +
    (technicals.macdLine > 0 ? 25 : -25)
  ));

  const mean = closes.slice(-20).reduce((s, v) => s + v, 0) / 20;
  const std = Math.sqrt(closes.slice(-20).reduce((s, v) => s + Math.pow(v - mean, 2), 0) / 20);
  const zScore = std > 0 ? (current - mean) / std : 0;

  const meanReversionSignal: "oversold" | "overbought" | "neutral" =
    zScore < -2 ? "oversold" : zScore > 2 ? "overbought" : "neutral";

  const relativeStrength = ((technicals.rsi14 - 50) / 50) * 100;

  return {
    priceMomentum1M: m1,
    priceMomentum3M: m3,
    priceMomentum6M: m6,
    volumeMomentum,
    rsiDivergence,
    macdCrossover,
    trendStrength,
    zScore,
    meanReversionSignal,
    relativeStrength,
  };
}

function runBacktest(bars: OHLCVBar[], ticker: string): BacktestResult {
  const cacheKey = `bt-${ticker}`;
  const cached = backtestCache.get(cacheKey);
  if (cached) return cached;

  if (bars.length < 60) {
    const result: BacktestResult = {
      ticker, strategy: "composite", lookbackDays: bars.length,
      totalSignals: 0, correctDirectional: 0, hitRate: 0,
      avgReturn: 0, sharpeRatio: 0, maxDrawdown: 0,
      winRate: 0, avgWin: 0, avgLoss: 0, profitFactor: 1,
      calmarRatio: 0, cachedAt: new Date().toISOString(),
    };
    backtestCache.set(cacheKey, result);
    return result;
  }

  const wins: number[] = [];
  const losses: number[] = [];
  const allReturns: number[] = [];
  let equity = 1.0;
  let maxEquity = 1.0;
  let maxDrawdown = 0;

  for (let i = 30; i < bars.length - 5; i++) {
    const slice = bars.slice(0, i);
    const closes = slice.map(b => b.close);
    const rsi = calcRSI(closes, 14);
    const boll = calcBollinger(closes);
    const current = closes[closes.length - 1];

    let signal = 0;
    if (rsi < 35 && current < boll.lower) signal = 1;
    else if (rsi > 65 && current > boll.upper) signal = -1;
    const m10 = i >= 10 ? (current - bars[i - 10].close) / bars[i - 10].close : 0;
    if (Math.abs(m10) > 0.03) signal += m10 > 0 ? 1 : -1;

    if (signal !== 0) {
      const entryPrice = bars[i].close;
      const exitPrice = bars[i + 5].close;
      const ret = signal > 0
        ? (exitPrice - entryPrice) / entryPrice
        : (entryPrice - exitPrice) / entryPrice;

      allReturns.push(ret);
      equity *= (1 + ret);
      maxEquity = Math.max(maxEquity, equity);
      const drawdown = (maxEquity - equity) / maxEquity;
      maxDrawdown = Math.max(maxDrawdown, drawdown);

      if (ret > 0) wins.push(ret);
      else losses.push(ret);
    }
  }

  const totalSignals = wins.length + losses.length;
  const winRate = totalSignals > 0 ? wins.length / totalSignals : 0;
  const avgWin = wins.length > 0 ? wins.reduce((s, v) => s + v, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, v) => s + v, 0) / losses.length) : 0;
  const avgReturn = allReturns.length > 0 ? allReturns.reduce((s, v) => s + v, 0) / allReturns.length : 0;

  const retStd = allReturns.length > 1
    ? Math.sqrt(allReturns.reduce((s, v) => s + Math.pow(v - avgReturn, 2), 0) / allReturns.length)
    : 0.01;

  const annualizedReturn = avgReturn * 252 / 5;
  const annualizedVol = retStd * Math.sqrt(252 / 5);
  const sharpeRatio = annualizedVol > 0 ? (annualizedReturn - 0.05) / annualizedVol : 0;
  const profitFactor = avgLoss > 0 ? (avgWin * wins.length) / (avgLoss * losses.length) : wins.length > 0 ? 2 : 0;
  const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;

  const result: BacktestResult = {
    ticker, strategy: "RSI+Bollinger+Momentum composite",
    lookbackDays: bars.length,
    totalSignals,
    correctDirectional: wins.length,
    hitRate: winRate * 100,
    avgReturn: avgReturn * 100,
    sharpeRatio,
    maxDrawdown: maxDrawdown * 100,
    winRate: winRate * 100,
    avgWin: avgWin * 100,
    avgLoss: avgLoss * 100,
    profitFactor,
    calmarRatio,
    cachedAt: new Date().toISOString(),
  };

  backtestCache.set(cacheKey, result);
  return result;
}

function calcCompositeScore(
  technicals: TechnicalIndicators,
  momentum: MomentumSignals,
  mc: MonteCarloPrediction,
  fibonacci: FibonacciLevels
): number {
  let score = 50;

  const rsiScore = technicals.rsi14 < 30 ? 15 : technicals.rsi14 < 40 ? 8 : technicals.rsi14 > 70 ? -15 : technicals.rsi14 > 60 ? -8 : 0;
  score += rsiScore;

  const macdScore = technicals.macdHistogram > 0 ? 10 : -10;
  score += macdScore;

  const bollScore = technicals.bollingerPct < 0.2 ? 10 : technicals.bollingerPct > 0.8 ? -10 : 0;
  score += bollScore;

  const trendScore = technicals.sma20 > technicals.sma50 && technicals.sma50 > technicals.sma200 ? 10 :
    technicals.sma20 < technicals.sma50 && technicals.sma50 < technicals.sma200 ? -10 : 0;
  score += trendScore;

  const momScore = Math.min(10, Math.max(-10, momentum.priceMomentum1M / 3));
  score += momScore;

  const mcScore = mc.probAboveEntry > 60 ? 10 : mc.probAboveEntry < 40 ? -10 : 0;
  score += mcScore;

  const fibScore = fibonacci.trend === "up" ? 5 : -5;
  score += fibScore;

  if (momentum.rsiDivergence === "bullish") score += 8;
  else if (momentum.rsiDivergence === "bearish") score -= 8;

  const volScore = technicals.volumeRatio > 1.5 && momentum.priceMomentum1M > 0 ? 5 :
    technicals.volumeRatio > 1.5 && momentum.priceMomentum1M < 0 ? -5 : 0;
  score += volScore;

  return Math.max(0, Math.min(100, score));
}

function scoreToVerdict(score: number, confidence: number): "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL" {
  if (score >= 72) return "STRONG BUY";
  if (score >= 60) return "BUY";
  if (score <= 28) return "STRONG SELL";
  if (score <= 40) return "SELL";
  return "HOLD";
}

function buildBollingerSeries(bars: OHLCVBar[], period: number = 20): Array<{ date: string; upper: number; middle: number; lower: number; close: number }> {
  return bars.slice(-60).map((bar, i, arr) => {
    const slice = arr.slice(Math.max(0, i - period + 1), i + 1);
    const closes = slice.map(b => b.close);
    const mean = closes.reduce((s, v) => s + v, 0) / closes.length;
    const std = closes.length > 1 ? Math.sqrt(closes.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / closes.length) : 0;
    return { date: bar.date, upper: mean + 2 * std, middle: mean, lower: mean - 2 * std, close: bar.close };
  });
}

export async function generatePrediction(ticker: string): Promise<PredictionReport | null> {
  const upper = ticker.toUpperCase().trim();
  const cacheKey = `pred-${upper}`;
  const cached = predictionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PREDICTION_CACHE_TTL) {
    return cached.data;
  }

  log(`Generating prediction for ${upper}`);

  const [quote, history] = await Promise.allSettled([
    fetchStockQuote(upper),
    fetchStockHistory(upper, 252),
  ]);

  const stockQuote = quote.status === "fulfilled" ? quote.value : null;
  const stockHistory = history.status === "fulfilled" ? history.value : null;

  if (!stockHistory || stockHistory.bars.length < 30) {
    log(`Insufficient data for ${upper}: ${stockHistory?.bars.length ?? 0} bars`);
    return null;
  }

  const bars = stockHistory.bars;
  const currentPrice = stockQuote?.price || bars[bars.length - 1].close;

  const technicals = calcTechnicalIndicators(bars);
  const fibonacci = calcFibonacciLevels(bars);
  const monteCarlo = runMonteCarlo(bars, 30, 10000);
  const momentum = calcMomentumSignals(bars, technicals);
  const backtest = runBacktest(bars, upper);
  const compositeScore = calcCompositeScore(technicals, momentum, monteCarlo, fibonacci);
  const confidence = Math.min(95, Math.max(40, 50 + Math.abs(compositeScore - 50) * 0.9));
  const verdict = scoreToVerdict(compositeScore, confidence);

  const bullProb = monteCarlo.probBull;
  const bearProb = monteCarlo.probBear;
  const baseProb = 100 - bullProb - bearProb;

  const targets = {
    bullCase: { price: monteCarlo.bullCase, probability: bullProb, timeframe: "30 days" },
    baseCase: { price: monteCarlo.baseCase, probability: baseProb, timeframe: "30 days" },
    bearCase: { price: monteCarlo.bearCase, probability: bearProb, timeframe: "30 days" },
  };

  const supports = [...fibonacci.supports, technicals.bollingerLower, technicals.sma200].filter(Boolean).sort((a, b) => b - a).slice(0, 4);
  const resistances = [...fibonacci.resistances, technicals.bollingerUpper, technicals.sma50].filter(Boolean).sort((a, b) => a - b).slice(0, 4);

  const verdictEmoji = verdict === "STRONG BUY" ? "🚀" : verdict === "BUY" ? "📈" : verdict === "SELL" ? "📉" : verdict === "STRONG SELL" ? "💥" : "⚖️";
  const summary = `${verdictEmoji} ${verdict} — ${upper} @ $${currentPrice.toFixed(2)} | Score: ${compositeScore.toFixed(0)}/100 | Confidence: ${confidence.toFixed(0)}% | RSI: ${technicals.rsi14.toFixed(1)} | MC: ${monteCarlo.probAboveEntry.toFixed(0)}% prob above | Vol: ${technicals.annualizedVolatility?.toFixed(1) ?? monteCarlo.annualizedVolatility.toFixed(1)}% annualized | Backtest hit rate: ${backtest.hitRate.toFixed(0)}% (${backtest.totalSignals} signals, Sharpe: ${backtest.sharpeRatio.toFixed(2)})`;

  const report: PredictionReport = {
    ticker: upper,
    name: stockQuote?.name,
    generatedAt: new Date().toISOString(),
    currentPrice,
    quote: stockQuote,
    technicals,
    fibonacci,
    monteCarlo,
    momentum,
    backtest,
    targets,
    supports,
    resistances,
    verdict,
    confidence,
    compositeScore,
    summary,
    chartData: {
      priceHistory: bars.slice(-90).map(b => ({ date: b.date, close: b.close, volume: b.volume })),
      monteCarloConeBands: monteCarlo.coneBands,
      bollingerBands: buildBollingerSeries(bars),
      fibLevels: [fibonacci.retrace236, fibonacci.retrace382, fibonacci.retrace500, fibonacci.retrace618, fibonacci.retrace786],
    },
  };

  predictionCache.set(cacheKey, { data: report, timestamp: Date.now() });
  return report;
}

export function formatPredictionForChat(report: PredictionReport): string {
  const { ticker, currentPrice, technicals, monteCarlo, momentum, backtest, targets, fibonacci, verdict, confidence, compositeScore } = report;
  const name = report.name ? ` (${report.name})` : "";

  const lines: string[] = [
    `## ${ticker}${name} — Quantitative Prediction Report`,
    `**Current Price:** $${currentPrice.toFixed(2)} | **Verdict:** ${verdict} | **Confidence:** ${confidence.toFixed(0)}% | **Composite Score:** ${compositeScore.toFixed(0)}/100`,
    "",
    "### Price Targets (30-Day Monte Carlo — 10,000 Paths)",
    `- 🐂 **Bull Case:** $${targets.bullCase.price.toFixed(2)} (+${((targets.bullCase.price - currentPrice) / currentPrice * 100).toFixed(1)}%) — ${targets.bullCase.probability.toFixed(0)}% probability`,
    `- 📊 **Base Case:** $${targets.baseCase.price.toFixed(2)} (${((targets.baseCase.price - currentPrice) / currentPrice * 100).toFixed(1)}%) — ${Math.max(0, 100 - targets.bullCase.probability - targets.bearCase.probability).toFixed(0)}% probability`,
    `- 🐻 **Bear Case:** $${targets.bearCase.price.toFixed(2)} (${((targets.bearCase.price - currentPrice) / currentPrice * 100).toFixed(1)}%) — ${targets.bearCase.probability.toFixed(0)}% probability`,
    `- **P(close above entry):** ${monteCarlo.probAboveEntry.toFixed(0)}% | **Annualized Volatility:** ${monteCarlo.annualizedVolatility.toFixed(1)}%`,
    "",
    "### Technical Indicators",
    `- **RSI(14):** ${technicals.rsi14.toFixed(1)} ${technicals.rsi14 < 30 ? "⚡ Oversold" : technicals.rsi14 > 70 ? "🔥 Overbought" : "Neutral"}`,
    `- **MACD:** ${technicals.macdLine.toFixed(3)} / Signal: ${technicals.macdSignal.toFixed(3)} / Histogram: ${technicals.macdHistogram.toFixed(3)} ${technicals.macdHistogram > 0 ? "📈 Bullish" : "📉 Bearish"}`,
    `- **Bollinger:** Upper $${technicals.bollingerUpper.toFixed(2)} / Mid $${technicals.bollingerMiddle.toFixed(2)} / Lower $${technicals.bollingerLower.toFixed(2)} (Price at ${(technicals.bollingerPct * 100).toFixed(0)}th percentile)`,
    `- **Moving Averages:** SMA20 $${technicals.sma20.toFixed(2)} | SMA50 $${technicals.sma50.toFixed(2)} | SMA200 $${technicals.sma200.toFixed(2)}`,
    `- **Stochastic:** %K ${technicals.stochasticK.toFixed(0)} / %D ${technicals.stochasticD.toFixed(0)} | ATR(14): $${technicals.atr14.toFixed(2)}`,
    "",
    "### Fibonacci / Sacred Geometry",
    `- **Trend:** ${fibonacci.trend.toUpperCase()} | Range: $${fibonacci.low.toFixed(2)} — $${fibonacci.high.toFixed(2)}`,
    `- **Key Retracements:** 0.236→$${fibonacci.retrace236.toFixed(2)} | 0.382→$${fibonacci.retrace382.toFixed(2)} | 0.618→$${fibonacci.retrace618.toFixed(2)} | 0.786→$${fibonacci.retrace786.toFixed(2)}`,
    `- **Extensions:** 1.272→$${fibonacci.extension127.toFixed(2)} | 1.618→$${fibonacci.extension162.toFixed(2)}`,
    fibonacci.harmonicPattern ? `- **Harmonic Pattern:** ${fibonacci.harmonicPattern}` : "",
    `- **Supports:** ${report.supports.map(s => `$${s.toFixed(2)}`).join(" | ")}`,
    `- **Resistances:** ${report.resistances.map(r => `$${r.toFixed(2)}`).join(" | ")}`,
    "",
    "### Momentum & Mean Reversion",
    `- **Price Momentum:** 1M ${momentum.priceMomentum1M.toFixed(1)}% | 3M ${momentum.priceMomentum3M.toFixed(1)}% | 6M ${momentum.priceMomentum6M.toFixed(1)}%`,
    `- **Volume Momentum:** ${momentum.volumeMomentum.toFixed(0)}% vs 20-day avg | Ratio: ${technicals.volumeRatio.toFixed(2)}x`,
    `- **Z-Score (20-day):** ${momentum.zScore.toFixed(2)} → ${momentum.meanReversionSignal.toUpperCase()}`,
    `- **RSI Divergence:** ${momentum.rsiDivergence.toUpperCase()} | MACD Crossover: ${momentum.macdCrossover.toUpperCase()}`,
    `- **Trend Strength Index:** ${momentum.trendStrength.toFixed(0)}/100`,
    "",
    "### Backtesting Results",
    `- **Strategy:** ${backtest.strategy}`,
    `- **Signals Generated:** ${backtest.totalSignals} | **Hit Rate:** ${backtest.hitRate.toFixed(0)}%`,
    `- **Avg Return per Signal:** ${backtest.avgReturn.toFixed(2)}% | **Win/Loss:** ${backtest.avgWin.toFixed(2)}% / ${backtest.avgLoss.toFixed(2)}%`,
    `- **Sharpe Ratio:** ${backtest.sharpeRatio.toFixed(2)} | **Max Drawdown:** ${backtest.maxDrawdown.toFixed(1)}% | **Profit Factor:** ${backtest.profitFactor.toFixed(2)}`,
    "",
    `> ⚠️ *Quantitative analysis only — not financial advice. Past patterns do not guarantee future results.*`,
  ].filter(l => l !== undefined);

  return lines.join("\n");
}

export async function runScreener(tickers: string[]): Promise<Array<{ ticker: string; verdict: string; score: number; price: number; momentum1M: number; rsi: number }>> {
  const results = await Promise.allSettled(tickers.map(t => generatePrediction(t)));
  return results
    .filter((r): r is PromiseFulfilledResult<PredictionReport | null> => r.status === "fulfilled" && r.value !== null)
    .map(r => {
      const report = r.value as PredictionReport;
      return {
        ticker: report.ticker,
        verdict: report.verdict,
        score: report.compositeScore,
        price: report.currentPrice,
        momentum1M: report.momentum.priceMomentum1M,
        rsi: report.technicals.rsi14,
      };
    })
    .sort((a, b) => b.score - a.score);
}
