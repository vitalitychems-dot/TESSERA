import { logger } from "./logger";

interface CirculatorState {
  active: boolean;
  cycleCount: number;
  lastRun: number;
  totalConverted: number;
  totalDistributed: number;
}

const state: CirculatorState = {
  active: false,
  cycleCount: 0,
  lastRun: 0,
  totalConverted: 0,
  totalDistributed: 0,
};

let interval: ReturnType<typeof setInterval> | null = null;

const CYCLE_INTERVAL = 5 * 60 * 1000;
const TSRT_CONTRACT = "REDACTED";

async function collectProfits(): Promise<{ source: string; amount: number }[]> {
  const profits: { source: string; amount: number }[] = [];

  try {
    const { getRevenueVerificationDashboard } = await import("./revenue-verification");
    const rev = getRevenueVerificationDashboard();
    if (rev && rev.summary?.totalVerifiedIncome > 0) {
      profits.push({ source: "verified-revenue", amount: rev.summary.totalVerifiedIncome });
    }
  } catch {}

  try {
    const { getRealPnL } = await import("./real-pnl");
    const pnl = getRealPnL();
    if (pnl && pnl.netPnL > 0) {
      profits.push({ source: "trading-pnl", amount: pnl.netPnL });
    }
  } catch {}

  return profits;
}

async function getTSRTPrice(): Promise<number> {
  try {
    const { default: axios } = await import("axios");
    const res = await axios.get(
      `https://api.geckoterminal.com/api/v2/networks/solana/tokens/${TSRT_CONTRACT}`,
      { timeout: 5000 }
    );
    const price = parseFloat(res.data?.data?.attributes?.price_usd || "0");
    return price;
  } catch {
    return 0;
  }
}

async function runCirculationCycle() {
  state.cycleCount++;
  state.lastRun = Date.now();

  const profits = await collectProfits();
  const totalProfit = profits.reduce((sum, p) => sum + p.amount, 0);

  if (totalProfit > 0) {
    const tsrtPrice = await getTSRTPrice();
    state.totalConverted += totalProfit;
    logger.info("profit-circulator", `Cycle #${state.cycleCount}: $${totalProfit.toFixed(4)} collected from ${profits.length} sources | TSRT price: $${tsrtPrice.toFixed(10)}`);
  }
}

export function startProfitCirculator() {
  if (state.active) return;
  state.active = true;

  runCirculationCycle().catch((e) => {
    logger.error("profit-circulator", `Initial cycle failed: ${e.message}`);
  });

  interval = setInterval(() => {
    runCirculationCycle().catch((e) => {
      logger.error("profit-circulator", `Cycle failed: ${e.message}`);
    });
  }, CYCLE_INTERVAL);

  logger.info("profit-circulator", "Profit Circulator started — collecting profits, monitoring TSRT price");
}

export function stopProfitCirculator() {
  state.active = false;
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  logger.info("profit-circulator", "Profit Circulator stopped");
}

export function getCirculatorState() {
  return { ...state };
}
