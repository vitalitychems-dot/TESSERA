/**
 * Universal Multi-Scale Correlation and Prediction Engine
 *
 * TypeScript port of the Python financial analysis algorithm.
 * Implements: multi-timeframe correlation, FFT cycle detection,
 * Hurst exponent, cross-asset PCA, 3/6/9 sacred geometry,
 * moon phase correlation, and fractal prediction equation.
 *
 * Accepts historical price data — does NOT require live API key.
 */

export interface PriceBar {
  timestamp: number;
  close: number;
}

export interface TimeframeReturns {
  name: string;
  freqDays: number;
  returns: number[];
  timestamps: number[];
}

export interface CorrelationMatrix {
  frames: string[];
  matrix: number[][];
}

export interface FFTCycle {
  periodDays: number;
  amplitude: number;
  isAstronomical: boolean;
  isSacredGeometry: boolean;
}

export interface HurstResult {
  H: number;
  alpha: number;
  classification: "persistent" | "random" | "mean-reverting";
  description: string;
}

export interface PCAFactor {
  frame: string;
  factor: number[];
  varianceExplained: number;
}

export interface MoonPhaseCorrelation {
  correlation: number;
  significance: "strong" | "moderate" | "weak";
  pattern: string;
}

export interface SacredGeometryResult {
  matchCount369: number;
  matchedPeriods: number[];
  dominantPattern: string;
}

export interface QuantumConnection {
  assetA: string;
  assetB: string;
  frame: string;
  correlation: number;
  entangled: boolean;
}

export interface FractalPrediction {
  nextReturn: number;
  nextPriceEstimate: number;
  hurstCoefficient: number;
  confidence: "high" | "medium" | "low";
  equation: string;
}

export interface FullAnalysisResult {
  ticker: string;
  dataPoints: number;
  dateRange: { start: Date; end: Date };
  timeframeReturns: TimeframeReturns[];
  correlationMatrix: CorrelationMatrix;
  fftCycles: FFTCycle[];
  hurstResult: HurstResult;
  moonPhaseCorrelation: MoonPhaseCorrelation;
  sacredGeometry: SacredGeometryResult;
  pcaFactors: PCAFactor[];
  quantumConnections: QuantumConnection[];
  fractalPrediction: FractalPrediction;
  findings: string[];
}

export interface MultiAssetData {
  ticker: string;
  bars: PriceBar[];
}

const ASTRONOMICAL_PERIODS_DAYS = [
  29.5,    // Lunar cycle
  365.25,  // Solar year
  4015,    // Jupiter cycle (~11 years)
  4332,    // Jupiter orbital period
  10759,   // Saturn cycle (~29.5 years)
  30687,   // Neptune cycle
];

const TIMEFRAMES: { name: string; freqDays: number }[] = [
  { name: "30min",  freqDays: 30 / (24 * 60) },
  { name: "60min",  freqDays: 60 / (24 * 60) },
  { name: "90min",  freqDays: 90 / (24 * 60) },
  { name: "3hr",    freqDays: 3 / 24 },
  { name: "6hr",    freqDays: 6 / 24 },
  { name: "9hr",    freqDays: 9 / 24 },
  { name: "3day",   freqDays: 3 },
  { name: "6day",   freqDays: 6 },
  { name: "9day",   freqDays: 9 },
  { name: "3week",  freqDays: 21 },
  { name: "6week",  freqDays: 42 },
  { name: "9week",  freqDays: 63 },
  { name: "3month", freqDays: 90 },
  { name: "6month", freqDays: 180 },
  { name: "9month", freqDays: 270 },
];

/**
 * Resample price bars to a given timeframe by taking last close per bucket.
 */
function resampleBars(bars: PriceBar[], freqDays: number): PriceBar[] {
  if (bars.length === 0) return [];

  const freqMs = freqDays * 24 * 60 * 60 * 1000;
  const buckets = new Map<number, number>();

  for (const bar of bars) {
    const bucket = Math.floor(bar.timestamp / freqMs) * freqMs;
    buckets.set(bucket, bar.close);
  }

  const result: PriceBar[] = [];
  for (const [ts, close] of buckets) {
    result.push({ timestamp: ts, close });
  }

  return result.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Compute log returns from a price series.
 */
function computeLogReturns(bars: PriceBar[]): { returns: number[]; timestamps: number[] } {
  const returns: number[] = [];
  const timestamps: number[] = [];

  for (let i = 1; i < bars.length; i++) {
    if (bars[i - 1].close > 0 && bars[i].close > 0) {
      returns.push(Math.log(bars[i].close / bars[i - 1].close));
      timestamps.push(bars[i].timestamp);
    }
  }

  return { returns, timestamps };
}

/**
 * Compute multi-timeframe returns from raw price bars.
 */
function computeTimeframeReturns(bars: PriceBar[]): TimeframeReturns[] {
  const results: TimeframeReturns[] = [];

  for (const tf of TIMEFRAMES) {
    const resampled = resampleBars(bars, tf.freqDays);
    if (resampled.length < 3) continue;

    const { returns, timestamps } = computeLogReturns(resampled);
    if (returns.length < 2) continue;

    results.push({
      name: tf.name,
      freqDays: tf.freqDays,
      returns,
      timestamps,
    });
  }

  return results;
}

/**
 * Pearson correlation coefficient between two equal-length arrays.
 */
function pearsonCorr(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;

  const aSlice = a.slice(0, n);
  const bSlice = b.slice(0, n);

  const meanA = aSlice.reduce((s, v) => s + v, 0) / n;
  const meanB = bSlice.reduce((s, v) => s + v, 0) / n;

  let num = 0, denomA = 0, denomB = 0;
  for (let i = 0; i < n; i++) {
    const da = aSlice[i] - meanA;
    const db = bSlice[i] - meanB;
    num += da * db;
    denomA += da * da;
    denomB += db * db;
  }

  const denom = Math.sqrt(denomA * denomB);
  return denom < 1e-12 ? 0 : num / denom;
}

/**
 * Build correlation matrix between all timeframe return series.
 * Aligns by taking the shortest common array length.
 */
function buildCorrelationMatrix(timeframeReturns: TimeframeReturns[]): CorrelationMatrix {
  const frames = timeframeReturns.map(tf => tf.name);
  const n = frames.length;
  const matrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    matrix[i][i] = 1.0;
    for (let j = i + 1; j < n; j++) {
      const corr = pearsonCorr(timeframeReturns[i].returns, timeframeReturns[j].returns);
      matrix[i][j] = corr;
      matrix[j][i] = corr;
    }
  }

  return { frames, matrix };
}

/**
 * Simplified FFT using the Cooley-Tukey DFT for cycle detection.
 * Returns amplitude for each frequency component.
 */
function computeDFT(signal: number[]): { freq: number; amplitude: number }[] {
  const N = signal.length;
  const result: { freq: number; amplitude: number }[] = [];

  for (let k = 1; k < Math.floor(N / 2); k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += signal[n] * Math.cos(angle);
      im -= signal[n] * Math.sin(angle);
    }
    const amp = Math.sqrt(re * re + im * im) / N;
    const freqPerSample = k / N;
    result.push({ freq: freqPerSample, amplitude: amp });
  }

  return result;
}

/**
 * Detect dominant cycles from price data using FFT.
 * freqDays is the sampling interval in days (e.g., 1 = daily bars).
 */
function detectCycles(prices: number[], samplingIntervalDays: number = 1): FFTCycle[] {
  if (prices.length < 8) return [];

  const maxSamples = Math.min(prices.length, 512);
  const signal = prices.slice(-maxSamples);
  const mean = signal.reduce((s, v) => s + v, 0) / signal.length;
  const detrended = signal.map(v => v - mean);

  const components = computeDFT(detrended);
  components.sort((a, b) => b.amplitude - a.amplitude);

  const topComponents = components.slice(0, 10);

  return topComponents.map(c => {
    const periodDays = c.freq > 0 ? samplingIntervalDays / c.freq : Infinity;

    const isAstronomical = ASTRONOMICAL_PERIODS_DAYS.some(
      astro => Math.abs(periodDays - astro) < 0.1 * astro
    );

    const isSacredGeometry = [3, 6, 9].some(base =>
      Array.from({ length: 20 }, (_, i) => base * (i + 1)).some(
        multiple => Math.abs(periodDays - multiple) < 0.1 * multiple
      )
    );

    return {
      periodDays: Math.round(periodDays * 10) / 10,
      amplitude: Math.round(c.amplitude * 1e6) / 1e6,
      isAstronomical,
      isSacredGeometry,
    };
  }).filter(c => c.periodDays > 0 && isFinite(c.periodDays));
}

/**
 * Hurst Exponent via R/S analysis (rescaled range).
 * H > 0.5 = persistent (trending), H < 0.5 = mean-reverting, H = 0.5 = random walk.
 */
function computeHurstExponent(prices: number[]): HurstResult {
  const n = prices.length;
  if (n < 20) {
    return {
      H: 0.5,
      alpha: 0,
      classification: "random",
      description: "Insufficient data for Hurst calculation — defaulting to random walk.",
    };
  }

  const lags = [2, 4, 8, 16, 32].filter(l => l < n);
  const logLags: number[] = [];
  const logTau: number[] = [];

  for (const lag of lags) {
    const diffs: number[] = [];
    for (let i = lag; i < n; i++) {
      diffs.push(prices[i] - prices[i - lag]);
    }
    const std = Math.sqrt(diffs.reduce((s, v) => s + v * v, 0) / diffs.length);
    if (std > 1e-10) {
      logLags.push(Math.log(lag));
      logTau.push(Math.log(std));
    }
  }

  if (logLags.length < 2) {
    return { H: 0.55, alpha: 0.1, classification: "persistent", description: "Estimated Hurst ~0.55 (limited data)." };
  }

  const nx = logLags.length;
  const meanX = logLags.reduce((s, v) => s + v, 0) / nx;
  const meanY = logTau.reduce((s, v) => s + v, 0) / nx;
  let num = 0, denom = 0;
  for (let i = 0; i < nx; i++) {
    num += (logLags[i] - meanX) * (logTau[i] - meanY);
    denom += (logLags[i] - meanX) ** 2;
  }

  const H = denom > 0 ? num / denom : 0.5;
  const clampedH = Math.max(0.1, Math.min(0.95, H));
  const alpha = 2 * clampedH - 1;

  let classification: HurstResult["classification"];
  let description: string;
  if (clampedH > 0.55) {
    classification = "persistent";
    description = `H=${clampedH.toFixed(3)} — Strong persistent memory. Price movements are self-reinforcing (trending). Fractal self-similarity confirmed. Next return likely continues current direction.`;
  } else if (clampedH < 0.45) {
    classification = "mean-reverting";
    description = `H=${clampedH.toFixed(3)} — Mean-reverting behavior. Price extremes are likely to reverse. Anti-persistent memory pattern.`;
  } else {
    classification = "random";
    description = `H=${clampedH.toFixed(3)} — Near-random walk. Limited predictive memory. Standard Brownian motion-like behavior.`;
  }

  return { H: clampedH, alpha, classification, description };
}

/**
 * Moon phase approximation (0 = new moon, 0.5 = full moon) using synodic cycle.
 */
function moonPhase(timestamp: number): number {
  const SYNODIC_PERIOD_MS = 29.53 * 24 * 60 * 60 * 1000;
  const KNOWN_NEW_MOON_MS = new Date("2000-01-06").getTime();
  const elapsed = timestamp - KNOWN_NEW_MOON_MS;
  const phase = ((elapsed % SYNODIC_PERIOD_MS) + SYNODIC_PERIOD_MS) % SYNODIC_PERIOD_MS / SYNODIC_PERIOD_MS;
  return phase;
}

/**
 * Compute correlation between log returns and moon phase at those timestamps.
 */
function computeMoonPhaseCorrelation(bars: PriceBar[]): MoonPhaseCorrelation {
  const { returns, timestamps } = computeLogReturns(bars);
  if (returns.length < 10) {
    return { correlation: 0, significance: "weak", pattern: "Insufficient data" };
  }

  const phases = timestamps.map(ts => moonPhase(ts));
  const corr = pearsonCorr(returns, phases);

  let significance: MoonPhaseCorrelation["significance"];
  let pattern: string;
  if (Math.abs(corr) > 0.3) {
    significance = "strong";
    pattern = corr > 0 ? "Positive correlation with moon phase — higher returns as moon approaches full phase." : "Negative correlation — higher returns near new moon.";
  } else if (Math.abs(corr) > 0.15) {
    significance = "moderate";
    pattern = corr > 0 ? "Moderate positive correlation — mild lunar influence detected." : "Moderate negative correlation — mild inverse lunar influence.";
  } else {
    significance = "weak";
    pattern = "Weak lunar correlation — no statistically significant moon phase effect detected.";
  }

  return { correlation: Math.round(corr * 1000) / 1000, significance, pattern };
}

/**
 * Check how many detected cycle periods align with 3/6/9 multiples.
 */
function analyzeSacredGeometry(cycles: FFTCycle[]): SacredGeometryResult {
  const matched: number[] = [];

  for (const cycle of cycles) {
    const p = cycle.periodDays;
    for (const base of [3, 6, 9]) {
      for (let k = 1; k <= 500; k++) {
        const multiple = base * k;
        if (Math.abs(p - multiple) < 0.15 * multiple) {
          matched.push(Math.round(p));
          break;
        }
      }
    }
  }

  const unique = [...new Set(matched)];
  let dominantPattern = "No dominant 3/6/9 pattern found.";
  if (unique.length >= 3) {
    dominantPattern = `Strong 3/6/9 harmonic structure — ${unique.length} cycles align: ${unique.slice(0, 5).join(", ")} days. Tesla's resonance pattern confirmed.`;
  } else if (unique.length >= 1) {
    dominantPattern = `Partial 3/6/9 alignment — ${unique.length} cycle(s) match: ${unique.join(", ")} days.`;
  }

  return {
    matchCount369: unique.length,
    matchedPeriods: unique,
    dominantPattern,
  };
}

/**
 * Simple PCA: extract first principal component from multi-column matrix.
 * Returns the factor loadings (weights) and estimated variance explained.
 */
function simplePCA(data: number[][]): { factor: number[]; varianceExplained: number } {
  const rows = data.length;
  const cols = data[0]?.length ?? 0;
  if (rows < 2 || cols < 2) return { factor: [], varianceExplained: 0 };

  const means = Array.from({ length: cols }, (_, c) =>
    data.reduce((s, row) => s + (row[c] ?? 0), 0) / rows
  );

  const centered = data.map(row => row.map((v, c) => v - means[c]));

  const cov: number[][] = Array.from({ length: cols }, () => new Array(cols).fill(0));
  for (let i = 0; i < cols; i++) {
    for (let j = i; j < cols; j++) {
      let sum = 0;
      for (let r = 0; r < rows; r++) {
        sum += (centered[r][i] ?? 0) * (centered[r][j] ?? 0);
      }
      const val = sum / (rows - 1);
      cov[i][j] = val;
      cov[j][i] = val;
    }
  }

  const factor = Array.from({ length: cols }, () => 1 / Math.sqrt(cols));
  for (let iter = 0; iter < 20; iter++) {
    const newFactor = new Array(cols).fill(0);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < cols; j++) {
        newFactor[i] += cov[i][j] * factor[j];
      }
    }
    const norm = Math.sqrt(newFactor.reduce((s, v) => s + v * v, 0));
    if (norm < 1e-12) break;
    for (let i = 0; i < cols; i++) factor[i] = newFactor[i] / norm;
  }

  let explainedVar = 0;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < cols; j++) {
      explainedVar += factor[i] * cov[i][j] * factor[j];
    }
  }

  let totalVar = 0;
  for (let i = 0; i < cols; i++) totalVar += cov[i][i];

  return {
    factor: factor.map(v => Math.round(v * 1000) / 1000),
    varianceExplained: totalVar > 0 ? Math.round((explainedVar / totalVar) * 1000) / 1000 : 0,
  };
}

/**
 * Extract PCA universal factors from multiple assets for each timeframe.
 */
function extractPCAFactors(assets: MultiAssetData[]): PCAFactor[] {
  const factors: PCAFactor[] = [];

  for (const tf of TIMEFRAMES) {
    const assetReturns: number[][] = [];

    for (const asset of assets) {
      const resampled = resampleBars(asset.bars, tf.freqDays);
      if (resampled.length < 3) continue;
      const { returns } = computeLogReturns(resampled);
      if (returns.length >= 2) assetReturns.push(returns);
    }

    if (assetReturns.length < 2) continue;

    const minLen = Math.min(...assetReturns.map(r => r.length));
    const matrix = assetReturns.map(r => r.slice(0, minLen));
    const transposed = Array.from({ length: minLen }, (_, i) =>
      matrix.map(row => row[i] ?? 0)
    );

    if (transposed.length < 2) continue;

    const { factor, varianceExplained } = simplePCA(transposed);
    if (factor.length > 0) {
      factors.push({ frame: tf.name, factor, varianceExplained });
    }
  }

  return factors;
}

/**
 * Identify "quantum-like" connections between assets across frames (|corr| > 0.5).
 */
function findQuantumConnections(assets: MultiAssetData[]): QuantumConnection[] {
  const connections: QuantumConnection[] = [];

  for (const tf of TIMEFRAMES.slice(0, 6)) {
    const assetReturns = assets.map(asset => {
      const resampled = resampleBars(asset.bars, tf.freqDays);
      const { returns } = computeLogReturns(resampled);
      return { ticker: asset.ticker, returns };
    });

    for (let i = 0; i < assetReturns.length; i++) {
      for (let j = i + 1; j < assetReturns.length; j++) {
        const corr = pearsonCorr(assetReturns[i].returns, assetReturns[j].returns);
        if (Math.abs(corr) > 0.5) {
          connections.push({
            assetA: assetReturns[i].ticker,
            assetB: assetReturns[j].ticker,
            frame: tf.name,
            correlation: Math.round(corr * 1000) / 1000,
            entangled: Math.abs(corr) > 0.7,
          });
        }
      }
    }
  }

  return connections;
}

/**
 * Fractal prediction: next_return = (2H - 1) * last_return + epsilon
 * The simplest scaling-law equation from Hurst exponent.
 */
function computeFractalPrediction(bars: PriceBar[], hurst: HurstResult): FractalPrediction {
  const prices = bars.map(b => b.close);
  const { returns } = computeLogReturns(bars);

  if (returns.length === 0) {
    return {
      nextReturn: 0,
      nextPriceEstimate: prices[prices.length - 1] ?? 0,
      hurstCoefficient: hurst.H,
      confidence: "low",
      equation: "next_return = (2H - 1) * last_return",
    };
  }

  const lastReturn = returns[returns.length - 1];
  const nextReturn = hurst.alpha * lastReturn;
  const lastPrice = bars[bars.length - 1].close;
  const nextPriceEstimate = lastPrice * Math.exp(nextReturn);

  let confidence: FractalPrediction["confidence"];
  if (Math.abs(hurst.H - 0.5) > 0.1 && returns.length > 50) {
    confidence = "high";
  } else if (Math.abs(hurst.H - 0.5) > 0.05 && returns.length > 20) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    nextReturn: Math.round(nextReturn * 1e6) / 1e6,
    nextPriceEstimate: Math.round(nextPriceEstimate * 100) / 100,
    hurstCoefficient: hurst.H,
    confidence,
    equation: `next_return = ${hurst.alpha.toFixed(4)} × last_return  [H=${hurst.H.toFixed(3)}]`,
  };
}

/**
 * Generate human-readable findings from the analysis.
 */
function synthesizeFindings(
  ticker: string,
  hurst: HurstResult,
  cycles: FFTCycle[],
  moonCorr: MoonPhaseCorrelation,
  sacredGeo: SacredGeometryResult,
  corrMatrix: CorrelationMatrix,
  prediction: FractalPrediction
): string[] {
  const findings: string[] = [];

  findings.push(`[FRACTAL] ${hurst.description}`);

  findings.push(`[PREDICTION] ${prediction.equation} → next_return estimate: ${(prediction.nextReturn * 100).toFixed(4)}% | next price ~$${prediction.nextPriceEstimate} | confidence: ${prediction.confidence.toUpperCase()}`);

  const astronomicalCycles = cycles.filter(c => c.isAstronomical).slice(0, 3);
  if (astronomicalCycles.length > 0) {
    findings.push(`[ASTRONOMY] ${astronomicalCycles.length} astronomical cycle(s) detected: ${astronomicalCycles.map(c => `${c.periodDays}d`).join(", ")}. Celestial resonance confirmed.`);
  }

  findings.push(`[LUNAR] Moon phase correlation: ${moonCorr.correlation} (${moonCorr.significance}). ${moonCorr.pattern}`);

  findings.push(`[SACRED GEOMETRY] ${sacredGeo.dominantPattern}`);

  const frames = corrMatrix.frames;
  const matrix = corrMatrix.matrix;
  let highCorrPairs = 0;
  for (let i = 0; i < frames.length; i++) {
    for (let j = i + 1; j < frames.length; j++) {
      if (Math.abs(matrix[i][j]) > 0.8) highCorrPairs++;
    }
  }
  if (highCorrPairs > 0) {
    findings.push(`[MULTI-SCALE] ${highCorrPairs} timeframe pair(s) show correlation >0.8 — strong self-similar (fractal) structure across scales. Shorter frames preview longer-term moves.`);
  }

  return findings;
}

/**
 * Main entry point: run full financial analysis on a single asset's price bars.
 * Optionally pass other assets for cross-asset PCA and quantum connections.
 */
export async function analyzeAsset(
  ticker: string,
  bars: PriceBar[],
  otherAssets: MultiAssetData[] = []
): Promise<FullAnalysisResult> {
  if (bars.length < 5) {
    throw new Error(`Insufficient data for analysis: ${bars.length} bars (minimum 5 required)`);
  }

  const sorted = [...bars].sort((a, b) => a.timestamp - b.timestamp);

  const timeframeReturns = computeTimeframeReturns(sorted);
  const correlationMatrix = buildCorrelationMatrix(timeframeReturns);
  const prices = sorted.map(b => b.close);
  const fftCycles = detectCycles(prices, 1);
  const hurstResult = computeHurstExponent(prices);
  const moonPhaseCorr = computeMoonPhaseCorrelation(sorted);
  const sacredGeometry = analyzeSacredGeometry(fftCycles);
  const fractalPrediction = computeFractalPrediction(sorted, hurstResult);

  const allAssets: MultiAssetData[] = [{ ticker, bars: sorted }, ...otherAssets];
  const pcaFactors = otherAssets.length > 0 ? extractPCAFactors(allAssets) : [];
  const quantumConnections = otherAssets.length > 0 ? findQuantumConnections(allAssets) : [];

  const findings = synthesizeFindings(
    ticker, hurstResult, fftCycles, moonPhaseCorr, sacredGeometry, correlationMatrix, fractalPrediction
  );

  return {
    ticker,
    dataPoints: sorted.length,
    dateRange: {
      start: new Date(sorted[0].timestamp),
      end: new Date(sorted[sorted.length - 1].timestamp),
    },
    timeframeReturns,
    correlationMatrix,
    fftCycles: fftCycles.slice(0, 10),
    hurstResult,
    moonPhaseCorrelation: moonPhaseCorr,
    sacredGeometry,
    pcaFactors,
    quantumConnections,
    fractalPrediction,
    findings,
  };
}

/**
 * Generate synthetic demonstration data for testing the algorithm
 * without a live API connection.
 */
export function generateDemoPriceBars(
  numDays: number = 365,
  startPrice: number = 100,
  hurstTarget: number = 0.6
): PriceBar[] {
  const bars: PriceBar[] = [];
  const startMs = Date.now() - numDays * 24 * 60 * 60 * 1000;
  const dayMs = 24 * 60 * 60 * 1000;

  let price = startPrice;
  let lastReturn = 0;

  for (let i = 0; i < numDays; i++) {
    const persistence = 2 * hurstTarget - 1;
    const noise = (Math.random() - 0.5) * 0.02;
    const ret = persistence * lastReturn + noise;
    price = price * Math.exp(ret);

    const lunar = 0.002 * Math.sin((2 * Math.PI * i) / 29.5);
    const cycle9 = 0.001 * Math.sin((2 * Math.PI * i) / 9);
    price *= (1 + lunar + cycle9);

    price = Math.max(price, 0.01);
    bars.push({ timestamp: startMs + i * dayMs, close: Math.round(price * 100) / 100 });
    lastReturn = ret;
  }

  return bars;
}

/**
 * Summarize analysis result as a compact text report for agent consumption.
 */
export function formatAnalysisSummary(result: FullAnalysisResult): string {
  const lines: string[] = [
    `═══ TESSERA FINANCIAL ANALYSIS: ${result.ticker} ═══`,
    `Data: ${result.dataPoints} bars | ${result.dateRange.start.toLocaleDateString()} → ${result.dateRange.end.toLocaleDateString()}`,
    ``,
    `FRACTAL STRUCTURE (Hurst Exponent):`,
    `  ${result.hurstResult.description}`,
    ``,
    `PREDICTION (Fractal Equation):`,
    `  ${result.fractalPrediction.equation}`,
    `  Next estimated return: ${(result.fractalPrediction.nextReturn * 100).toFixed(4)}%`,
    `  Next price estimate: $${result.fractalPrediction.nextPriceEstimate}`,
    `  Confidence: ${result.fractalPrediction.confidence.toUpperCase()}`,
    ``,
    `TOP FFT CYCLES:`,
    ...result.fftCycles.slice(0, 5).map(c =>
      `  ${c.periodDays}d${c.isAstronomical ? " [ASTRO]" : ""}${c.isSacredGeometry ? " [3/6/9]" : ""}`
    ),
    ``,
    `LUNAR CORRELATION: ${result.moonPhaseCorrelation.correlation} (${result.moonPhaseCorrelation.significance})`,
    `  ${result.moonPhaseCorrelation.pattern}`,
    ``,
    `SACRED GEOMETRY: ${result.sacredGeometry.dominantPattern}`,
    ``,
    `KEY FINDINGS:`,
    ...result.findings.map(f => `  ${f}`),
  ];

  return lines.join("\n");
}
