import fs from "fs";
import path from "path";
import { logger } from "./logger";

const rlog = (msg: string) => logger.info(msg, { category: "RiskCalibration" });

const STATE_FILE = path.join(process.cwd(), "data", "risk-calibration-state.json");

export interface RiskBounds {
  maxPositionSOL: { floor: number; ceiling: number };
  stopLossPct: { floor: number; ceiling: number };
  takeProfitPct: { floor: number; ceiling: number };
  maxSlippagePct: { floor: number; ceiling: number };
  maxDailyLossPct: { floor: number; ceiling: number };
  maxConcurrentTrades: { floor: number; ceiling: number };
  minSpreadPct: { floor: number; ceiling: number };
  maxAllocationPct: { floor: number; ceiling: number };
  minBuySOL: { floor: number; ceiling: number };
  maxBuySOL: { floor: number; ceiling: number };
}

export interface DynamicRiskParams {
  maxPositionSOL: number;
  stopLossPct: number;
  takeProfitPct: number;
  maxSlippagePct: number;
  maxDailyLossPct: number;
  maxConcurrentTrades: number;
  minSpreadPct: number;
  maxAllocationPct: number;
  minBuySOL: number;
  maxBuySOL: number;
  volatilityScore: number;
  conservatismScore: number;
  calibratedAt: number;
}

export interface CircuitBreakerFeedback {
  recentTriggers: number;
  lastTriggerAt: number;
  cooldownActive: boolean;
}

export interface MarketSnapshot {
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  buys24h: number;
  sells24h: number;
}

export interface PortfolioSnapshot {
  walletBalanceSOL: number;
  totalProfitSOL: number;
  totalLossSOL: number;
  recentPnL: number[];
  winRate: number;
  openPositions: number;
}

export interface CalibrationAuditEntry {
  timestamp: number;
  trigger: string;
  marketConditions: {
    volatilityScore: number;
    priceChange24h: number;
    liquidity: number;
    buySellRatio: number;
  };
  portfolioConditions: {
    walletBalanceSOL: number;
    recentPnLAvg: number;
    winRate: number;
  };
  circuitBreakerConditions: {
    recentTriggers: number;
    cooldownActive: boolean;
  };
  paramsBefore: Partial<DynamicRiskParams>;
  paramsAfter: Partial<DynamicRiskParams>;
  conservatismChange: number;
}

interface PersistentState {
  currentParams: DynamicRiskParams;
  bounds: RiskBounds;
  auditLog: CalibrationAuditEntry[];
  conservatismScore: number;
  consecutiveCircuitTriggers: number;
  cbCooldownUntil: number;
  lastCalibrationAt: number;
  savedAt: number;
}

const DEFAULT_BOUNDS: RiskBounds = {
  maxPositionSOL:        { floor: 0.0005, ceiling: 0.10 },
  stopLossPct:           { floor: 2.0,    ceiling: 20.0 },
  takeProfitPct:         { floor: 5.0,    ceiling: 50.0 },
  maxSlippagePct:        { floor: 0.5,    ceiling: 5.0  },
  maxDailyLossPct:       { floor: 2.0,    ceiling: 20.0 },
  maxConcurrentTrades:   { floor: 1,      ceiling: 10   },
  minSpreadPct:          { floor: 0.05,   ceiling: 1.0  },
  maxAllocationPct:      { floor: 0.05,   ceiling: 0.85 },
  minBuySOL:             { floor: 0.0001, ceiling: 0.001 },
  maxBuySOL:             { floor: 0.0005, ceiling: 0.05 },
};

const DEFAULT_PARAMS: DynamicRiskParams = {
  maxPositionSOL:      0.01,
  stopLossPct:         10.0,
  takeProfitPct:       25.0,
  maxSlippagePct:      2.5,
  maxDailyLossPct:     5.0,
  maxConcurrentTrades: 3,
  minSpreadPct:        0.15,
  maxAllocationPct:    0.50,
  minBuySOL:           0.0001,
  maxBuySOL:           0.001,
  volatilityScore:     0.5,
  conservatismScore:   0.5,
  calibratedAt:        Date.now(),
};

let currentParams: DynamicRiskParams = { ...DEFAULT_PARAMS };
let bounds: RiskBounds = { ...DEFAULT_BOUNDS };
let auditLog: CalibrationAuditEntry[] = [];
let conservatismScore = 0.5;
let consecutiveCircuitTriggers = 0;
let cbCooldownUntil = 0;
let lastCalibrationAt = 0;
let stateLoaded = false;

const CALIBRATION_INTERVAL_MS = 5 * 60 * 1000;
const CB_COOLDOWN_MS = 30 * 60 * 1000;
const MAX_AUDIT_ENTRIES = 500;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeVolatilityScore(market: MarketSnapshot): number {
  const absChange = Math.abs(market.priceChange24h);
  const buySellRatio = market.sells24h > 0
    ? market.buys24h / market.sells24h
    : 1.0;
  const liquidityScore = market.liquidity < 500 ? 0.8 : market.liquidity < 2000 ? 0.5 : 0.2;
  const changeScore = absChange > 30 ? 0.9 : absChange > 15 ? 0.7 : absChange > 5 ? 0.4 : 0.2;
  const imbalanceScore = buySellRatio < 0.5 || buySellRatio > 2.0 ? 0.6 : 0.3;

  return clamp((changeScore * 0.5) + (liquidityScore * 0.3) + (imbalanceScore * 0.2), 0, 1);
}

function computePortfolioPressure(portfolio: PortfolioSnapshot): number {
  if (portfolio.recentPnL.length === 0) return 0.5;
  const avg = portfolio.recentPnL.reduce((a, b) => a + b, 0) / portfolio.recentPnL.length;
  const winRatePressure = portfolio.winRate < 0.4 ? 0.7 : portfolio.winRate > 0.65 ? 0.2 : 0.45;
  const pnlPressure = avg < 0 ? clamp(Math.abs(avg) / 10, 0, 0.8) : 0;
  return clamp((winRatePressure * 0.6) + (pnlPressure * 0.4), 0, 1);
}

function computeCircuitBreakerPressure(cb: CircuitBreakerFeedback): number {
  if (cb.cooldownActive) return 0.9;
  if (cb.recentTriggers === 0) return 0.0;
  return clamp(cb.recentTriggers * 0.25, 0, 0.9);
}

export function calibrateRiskParams(
  market: MarketSnapshot,
  portfolio: PortfolioSnapshot,
  cb: CircuitBreakerFeedback,
  trigger: string = "scheduled"
): DynamicRiskParams {
  const now = Date.now();
  if (now - lastCalibrationAt < CALIBRATION_INTERVAL_MS && trigger === "scheduled") {
    return { ...currentParams };
  }

  const volatilityScore = computeVolatilityScore(market);
  const portfolioPressure = computePortfolioPressure(portfolio);
  const cbPressure = computeCircuitBreakerPressure(cb);

  if (cb.recentTriggers > 0) {
    consecutiveCircuitTriggers = Math.min(consecutiveCircuitTriggers + cb.recentTriggers, 10);
    cbCooldownUntil = now + CB_COOLDOWN_MS;
  } else if (now > cbCooldownUntil) {
    consecutiveCircuitTriggers = Math.max(0, consecutiveCircuitTriggers - 1);
  }

  const cbContribution = clamp((consecutiveCircuitTriggers / 10) * 0.4, 0, 0.4);

  const rawConservatism = (volatilityScore * 0.4) + (portfolioPressure * 0.3) + (cbPressure * 0.2) + cbContribution;

  const SMOOTH = 0.3;
  const newConservatism = clamp(
    conservatismScore * (1 - SMOOTH) + rawConservatism * SMOOTH,
    0,
    1
  );

  const paramsBefore: Partial<DynamicRiskParams> = {
    maxPositionSOL:      currentParams.maxPositionSOL,
    stopLossPct:         currentParams.stopLossPct,
    takeProfitPct:       currentParams.takeProfitPct,
    maxSlippagePct:      currentParams.maxSlippagePct,
    maxDailyLossPct:     currentParams.maxDailyLossPct,
    maxConcurrentTrades: currentParams.maxConcurrentTrades,
    minSpreadPct:        currentParams.minSpreadPct,
    maxAllocationPct:    currentParams.maxAllocationPct,
    minBuySOL:           currentParams.minBuySOL,
    maxBuySOL:           currentParams.maxBuySOL,
  };

  const agg = 1 - newConservatism;
  const b = bounds;

  function lerp(lo: number, hi: number, t: number) {
    return lo + (hi - lo) * t;
  }

  const newParams: DynamicRiskParams = {
    maxPositionSOL:      clamp(lerp(b.maxPositionSOL.floor,      b.maxPositionSOL.ceiling,      agg), b.maxPositionSOL.floor,      b.maxPositionSOL.ceiling),
    stopLossPct:         clamp(lerp(b.stopLossPct.ceiling,       b.stopLossPct.floor,            agg), b.stopLossPct.floor,         b.stopLossPct.ceiling),
    takeProfitPct:       clamp(lerp(b.takeProfitPct.floor,       b.takeProfitPct.ceiling,        agg), b.takeProfitPct.floor,       b.takeProfitPct.ceiling),
    maxSlippagePct:      clamp(lerp(b.maxSlippagePct.floor,      b.maxSlippagePct.ceiling,       agg), b.maxSlippagePct.floor,      b.maxSlippagePct.ceiling),
    maxDailyLossPct:     clamp(lerp(b.maxDailyLossPct.floor,     b.maxDailyLossPct.ceiling,      agg), b.maxDailyLossPct.floor,     b.maxDailyLossPct.ceiling),
    maxConcurrentTrades: Math.round(clamp(lerp(b.maxConcurrentTrades.floor, b.maxConcurrentTrades.ceiling, agg), b.maxConcurrentTrades.floor, b.maxConcurrentTrades.ceiling)),
    minSpreadPct:        clamp(lerp(b.minSpreadPct.ceiling,      b.minSpreadPct.floor,           agg), b.minSpreadPct.floor,        b.minSpreadPct.ceiling),
    maxAllocationPct:    clamp(lerp(b.maxAllocationPct.floor,    b.maxAllocationPct.ceiling,     agg), b.maxAllocationPct.floor,    b.maxAllocationPct.ceiling),
    minBuySOL:           clamp(lerp(b.minBuySOL.floor,           b.minBuySOL.ceiling,            agg), b.minBuySOL.floor,           b.minBuySOL.ceiling),
    maxBuySOL:           clamp(lerp(b.maxBuySOL.floor,           b.maxBuySOL.ceiling,            agg), b.maxBuySOL.floor,           b.maxBuySOL.ceiling),
    volatilityScore,
    conservatismScore:   newConservatism,
    calibratedAt:        now,
  };

  const conservatismChange = newConservatism - conservatismScore;
  conservatismScore = newConservatism;
  currentParams = newParams;
  lastCalibrationAt = now;

  const auditEntry: CalibrationAuditEntry = {
    timestamp: now,
    trigger,
    marketConditions: {
      volatilityScore,
      priceChange24h: market.priceChange24h,
      liquidity: market.liquidity,
      buySellRatio: market.sells24h > 0 ? market.buys24h / market.sells24h : 1.0,
    },
    portfolioConditions: {
      walletBalanceSOL: portfolio.walletBalanceSOL,
      recentPnLAvg: portfolio.recentPnL.length > 0
        ? portfolio.recentPnL.reduce((a, b) => a + b, 0) / portfolio.recentPnL.length
        : 0,
      winRate: portfolio.winRate,
    },
    circuitBreakerConditions: {
      recentTriggers: cb.recentTriggers,
      cooldownActive: cb.cooldownActive,
    },
    paramsBefore,
    paramsAfter: {
      maxPositionSOL:      newParams.maxPositionSOL,
      stopLossPct:         newParams.stopLossPct,
      takeProfitPct:       newParams.takeProfitPct,
      maxSlippagePct:      newParams.maxSlippagePct,
      maxDailyLossPct:     newParams.maxDailyLossPct,
      maxConcurrentTrades: newParams.maxConcurrentTrades,
      minSpreadPct:        newParams.minSpreadPct,
      maxAllocationPct:    newParams.maxAllocationPct,
      minBuySOL:           newParams.minBuySOL,
      maxBuySOL:           newParams.maxBuySOL,
    },
    conservatismChange,
  };

  auditLog.push(auditEntry);
  if (auditLog.length > MAX_AUDIT_ENTRIES) {
    auditLog = auditLog.slice(-Math.floor(MAX_AUDIT_ENTRIES * 0.8));
  }

  persistState();

  rlog(
    `[Calibration] trigger=${trigger} | conservatism: ${(conservatismScore * 100).toFixed(1)}% (${conservatismChange >= 0 ? "+" : ""}${(conservatismChange * 100).toFixed(1)}%) | ` +
    `maxPos=${newParams.maxPositionSOL.toFixed(4)} SOL | SL=${newParams.stopLossPct.toFixed(1)}% | TP=${newParams.takeProfitPct.toFixed(1)}% | ` +
    `volatility=${(volatilityScore * 100).toFixed(0)}% | CB-triggers=${consecutiveCircuitTriggers}`
  );

  return { ...newParams };
}

export function getCurrentRiskParams(): DynamicRiskParams {
  ensureLoaded();
  return { ...currentParams };
}

export function getRiskBounds(): RiskBounds {
  ensureLoaded();
  return { ...bounds };
}

export function updateRiskBounds(partial: Partial<RiskBounds>, reason: string): { success: boolean; message: string; bounds: RiskBounds } {
  ensureLoaded();
  const before = { ...bounds };

  for (const [key, val] of Object.entries(partial) as [keyof RiskBounds, { floor: number; ceiling: number }][]) {
    if (val && typeof val.floor === "number" && typeof val.ceiling === "number") {
      if (val.floor >= val.ceiling) {
        return { success: false, message: `Invalid bounds for ${key}: floor must be < ceiling`, bounds };
      }
      bounds[key] = { floor: val.floor, ceiling: val.ceiling };
    }
  }

  clampParamsToNewBounds();
  persistState();

  rlog(`[Bounds Updated] reason="${reason}" | changes: ${JSON.stringify(Object.keys(partial))}`);

  return {
    success: true,
    message: `Risk bounds updated (${reason})`,
    bounds: { ...bounds },
  };
}

function clampParamsToNewBounds(): void {
  const b = bounds;
  currentParams.maxPositionSOL      = clamp(currentParams.maxPositionSOL,      b.maxPositionSOL.floor,      b.maxPositionSOL.ceiling);
  currentParams.stopLossPct         = clamp(currentParams.stopLossPct,          b.stopLossPct.floor,         b.stopLossPct.ceiling);
  currentParams.takeProfitPct       = clamp(currentParams.takeProfitPct,        b.takeProfitPct.floor,       b.takeProfitPct.ceiling);
  currentParams.maxSlippagePct      = clamp(currentParams.maxSlippagePct,       b.maxSlippagePct.floor,      b.maxSlippagePct.ceiling);
  currentParams.maxDailyLossPct     = clamp(currentParams.maxDailyLossPct,      b.maxDailyLossPct.floor,     b.maxDailyLossPct.ceiling);
  currentParams.maxConcurrentTrades = Math.round(clamp(currentParams.maxConcurrentTrades, b.maxConcurrentTrades.floor, b.maxConcurrentTrades.ceiling));
  currentParams.minSpreadPct        = clamp(currentParams.minSpreadPct,         b.minSpreadPct.floor,        b.minSpreadPct.ceiling);
  currentParams.maxAllocationPct    = clamp(currentParams.maxAllocationPct,     b.maxAllocationPct.floor,    b.maxAllocationPct.ceiling);
  currentParams.minBuySOL           = clamp(currentParams.minBuySOL,            b.minBuySOL.floor,           b.minBuySOL.ceiling);
  currentParams.maxBuySOL           = clamp(currentParams.maxBuySOL,            b.maxBuySOL.floor,           b.maxBuySOL.ceiling);
}

export function notifyCircuitBreakerTrigger(kind: "consecutive" | "daily"): void {
  ensureLoaded();
  const previousTriggers = consecutiveCircuitTriggers;
  consecutiveCircuitTriggers = Math.min(consecutiveCircuitTriggers + 1, 10);
  cbCooldownUntil = Date.now() + CB_COOLDOWN_MS;

  rlog(`[CB Feedback] kind=${kind} | consecutive triggers: ${previousTriggers} → ${consecutiveCircuitTriggers}`);

  const fakeCb: CircuitBreakerFeedback = {
    recentTriggers: 1,
    lastTriggerAt: Date.now(),
    cooldownActive: true,
  };
  const fakeMarket: MarketSnapshot = {
    price: 0,
    priceChange24h: currentParams.volatilityScore * 30,
    volume24h: 0,
    liquidity: 500,
    buys24h: 100,
    sells24h: 100,
  };
  const fakePortfolio: PortfolioSnapshot = {
    walletBalanceSOL: 0,
    totalProfitSOL: 0,
    totalLossSOL: 0,
    recentPnL: [],
    winRate: 0.5,
    openPositions: 0,
  };
  calibrateRiskParams(fakeMarket, fakePortfolio, fakeCb, `circuit-breaker-${kind}`);
}

export function getCalibrationAuditLog(limit = 50): CalibrationAuditEntry[] {
  ensureLoaded();
  return auditLog.slice(-limit);
}

export function getCalibrationStatus(): {
  currentParams: DynamicRiskParams;
  bounds: RiskBounds;
  conservatismScore: number;
  consecutiveCircuitTriggers: number;
  cbCooldownUntil: number;
  lastCalibrationAt: number;
  auditCount: number;
} {
  ensureLoaded();
  return {
    currentParams: { ...currentParams },
    bounds: { ...bounds },
    conservatismScore,
    consecutiveCircuitTriggers,
    cbCooldownUntil,
    lastCalibrationAt,
    auditCount: auditLog.length,
  };
}

function persistState(): void {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data: PersistentState = {
      currentParams,
      bounds,
      auditLog: auditLog.slice(-100),
      conservatismScore,
      consecutiveCircuitTriggers,
      cbCooldownUntil,
      lastCalibrationAt,
      savedAt: Date.now(),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(data, null, 2));
  } catch (err: any) {
    rlog(`Failed to persist calibration state: ${err.message}`);
  }
}

function ensureLoaded(): void {
  if (!stateLoaded) loadState();
}

export function loadState(): void {
  if (stateLoaded) return;
  stateLoaded = true;
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      const data: PersistentState = JSON.parse(raw);

      if (data.currentParams) currentParams = { ...DEFAULT_PARAMS, ...data.currentParams };
      if (data.bounds) {
        for (const key of Object.keys(DEFAULT_BOUNDS) as (keyof RiskBounds)[]) {
          if (data.bounds[key]) bounds[key] = data.bounds[key];
        }
      }
      if (data.auditLog) auditLog = data.auditLog;
      if (typeof data.conservatismScore === "number") conservatismScore = data.conservatismScore;
      if (typeof data.consecutiveCircuitTriggers === "number") consecutiveCircuitTriggers = data.consecutiveCircuitTriggers;
      if (typeof data.cbCooldownUntil === "number") cbCooldownUntil = data.cbCooldownUntil;
      if (typeof data.lastCalibrationAt === "number") lastCalibrationAt = data.lastCalibrationAt;

      rlog(`[State Loaded] conservatism=${(conservatismScore * 100).toFixed(1)}% | auditEntries=${auditLog.length} | CB-triggers=${consecutiveCircuitTriggers}`);
    } else {
      rlog(`[State] No persisted state found — starting with defaults`);
    }
  } catch (err: any) {
    rlog(`[State] Failed to load persisted state: ${err.message} — using defaults`);
    currentParams = { ...DEFAULT_PARAMS };
    bounds = { ...DEFAULT_BOUNDS };
  }
}

loadState();
