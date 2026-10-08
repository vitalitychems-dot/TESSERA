import { writeFileSync, readFileSync, existsSync } from "fs";

const STATE_FILE = "server/wallet-monitor-state.json";
const COMMUNITY  = process.env.SOL_WALLET || "";
const FATHER     = process.env.SOL_WALLET || "";
const TSRT_MINT  = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";
const RPC        = "https://api.mainnet-beta.solana.com";
const POLL_MS    = 120000; // 2 minutes

export interface BalanceSnap {
  ts: number;
  commSol: number;
  dadSol: number;
  commTsrt: number;
  dadTsrt: number;
  solPrice: number;
  commDeltaSol: number;   // change since previous snap
  dadDeltaSol: number;
  event: string | null;   // human-readable description if something changed
}

interface State {
  history: BalanceSnap[];  // most recent last, max 500
  totalProofInSol: number; // sum of all positive community wallet deltas
  proofEvents: Array<{ ts: number; deltaSol: number; desc: string }>;
}

let state: State = { history: [], totalProofInSol: 0, proofEvents: [] };
let timer: ReturnType<typeof setInterval> | null = null;

function loadState() {
  try {
    if (existsSync(STATE_FILE)) {
      state = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    }
  } catch {}
}

function saveState() {
  try { writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}
}

async function fetchSolBalance(addr: string): Promise<number> {
  try {
    const r = await fetch(RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [addr] }),
      signal: AbortSignal.timeout(8000),
    });
    const j: any = await r.json();
    return (j?.result?.value ?? 0) / 1e9;
  } catch { return -1; }
}

async function fetchTsrtBalance(owner: string): Promise<number> {
  try {
    const r = await fetch(RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccountsByOwner",
        params: [owner, { mint: TSRT_MINT }, { encoding: "jsonParsed" }] }),
      signal: AbortSignal.timeout(8000),
    });
    const j: any = await r.json();
    const accts: any[] = j?.result?.value ?? [];
    return accts.reduce((s: number, a: any) =>
      s + Number(a?.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0), 0);
  } catch { return -1; }
}

async function fetchSolPrice(): Promise<number> {
  try {
    const r = await fetch("https://api.jup.ag/price/v2?ids=So11111111111111111111111111111111111111112", {
      signal: AbortSignal.timeout(5000) });
    const j: any = await r.json();
    return parseFloat(j?.data?.["So11111111111111111111111111111111111111112"]?.price) || 169;
  } catch { return 169; }
}

async function fetchRecentTx(addr: string): Promise<string[]> {
  try {
    const r = await fetch(RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress",
        params: [addr, { limit: 5 }] }),
      signal: AbortSignal.timeout(8000),
    });
    const j: any = await r.json();
    return (j?.result ?? []).map((s: any) => s.signature as string);
  } catch { return []; }
}

async function takeSample() {
  const [commSol, dadSol, solPrice] = await Promise.all([
    fetchSolBalance(COMMUNITY),
    fetchSolBalance(FATHER),
    fetchSolPrice(),
  ]);

  if (commSol < 0 || dadSol < 0) return; // RPC failed

  // TSRT balance — only fetch every 5th sample (rate-limit friendly, ~10 min)
  let commTsrt = 0;
  let dadTsrt = 0;
  if (state.history.length % 5 === 0) {
    [commTsrt, dadTsrt] = await Promise.all([
      fetchTsrtBalance(COMMUNITY),
      fetchTsrtBalance(FATHER),
    ]);
    // Fall back to last known good
    if (commTsrt < 0) commTsrt = state.history.at(-1)?.commTsrt ?? 0;
    if (dadTsrt < 0) dadTsrt = state.history.at(-1)?.dadTsrt ?? 0;
  } else {
    commTsrt = state.history.at(-1)?.commTsrt ?? 0;
    dadTsrt  = state.history.at(-1)?.dadTsrt  ?? 0;
  }

  const prev = state.history.at(-1);
  const commDelta = prev ? commSol - prev.commSol : 0;
  const dadDelta  = prev ? dadSol  - prev.dadSol  : 0;

  let event: string | null = null;

  if (commDelta > 0.0000001) {
    const usd = commDelta * solPrice;
    event = `+${commDelta.toFixed(6)} SOL (+$${usd.toFixed(4)}) received in community wallet`;
    state.totalProofInSol += commDelta;
    state.proofEvents.push({
      ts: Date.now(), deltaSol: commDelta,
      desc: event,
    });
    console.log(`[WalletMonitor] 🟢 PROOF: ${event}`);
    // Report to profit circulator as REAL on-chain income only
    try {
      const { collectProfit } = require("./profit-circulator");
      collectProfit("wallet-monitor", usd, event, solPrice);
    } catch {}
  } else if (dadDelta > 0.0000001) {
    const usd = dadDelta * solPrice;
    event = `+${dadDelta.toFixed(6)} SOL received in Phantom wallet`;
    console.log(`[WalletMonitor] 🟢 PROOF: ${event}`);
    // Report to profit circulator as REAL on-chain income only
    try {
      const { collectProfit } = require("./profit-circulator");
      collectProfit("wallet-monitor", usd, event, solPrice);
    } catch {}
  } else if (commDelta < -0.0000001) {
    event = `${commDelta.toFixed(6)} SOL sent from community wallet (fee/tx)`;
  }

  const snap: BalanceSnap = {
    ts: Date.now(), commSol, dadSol, commTsrt, dadTsrt, solPrice,
    commDeltaSol: commDelta, dadDeltaSol: dadDelta, event,
  };

  state.history.push(snap);
  if (state.history.length > 500) state.history = state.history.slice(-500);
  saveState();
}

export function startWalletMonitor() {
  loadState();
  console.log("[WalletMonitor] Starting — polling every 2 min");
  takeSample(); // immediate first sample
  timer = setInterval(takeSample, POLL_MS);
}

export function stopWalletMonitor() {
  if (timer) clearInterval(timer);
}

export function getWalletHistory(limit = 100): BalanceSnap[] {
  return state.history.slice(-limit);
}

export function getWalletProofSummary() {
  const latest = state.history.at(-1);
  const oldest = state.history.at(0);
  const commChange = latest && oldest ? latest.commSol - oldest.commSol : 0;
  const dadChange  = latest && oldest ? latest.dadSol  - oldest.dadSol  : 0;
  return {
    communityWallet: {
      current: latest?.commSol ?? 0,
      currentUsd: (latest?.commSol ?? 0) * (latest?.solPrice ?? 0),
      tsrtBalance: latest?.commTsrt ?? 0,
      changeFromStart: commChange,
      changeFromStartUsd: commChange * (latest?.solPrice ?? 0),
      address: COMMUNITY,
      solscanUrl: `https://solscan.io/account/${COMMUNITY}`,
    },
    phantomWallet: {
      current: latest?.dadSol ?? 0,
      currentUsd: (latest?.dadSol ?? 0) * (latest?.solPrice ?? 0),
      tsrtBalance: latest?.dadTsrt ?? 0,
      changeFromStart: dadChange,
      address: FATHER,
      solscanUrl: `https://solscan.io/account/${FATHER}`,
    },
    totalProofInSol: state.totalProofInSol,
    totalProofUsd: state.totalProofInSol * (latest?.solPrice ?? 0),
    proofEvents: state.proofEvents,
    snapshots: state.history.length,
    monitoringMinutes: oldest ? Math.floor((Date.now() - oldest.ts) / 60000) : 0,
    solPrice: latest?.solPrice ?? 169,
    history: state.history.slice(-60),
  };
}
