import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const log = (msg: string) => console.log(`[RealPnL] ${msg}`);

const WALLET_ADDRESS = process.env.SOL_WALLET || "";
const RPC_URL = "https://api.mainnet-beta.solana.com";

interface RealTransaction {
  signature: string;
  blockTime: number;
  type: "incoming" | "outgoing" | "unknown";
  amountSOL: number;
  counterparty: string;
  fee: number;
  success: boolean;
}

interface PnLState {
  totalIncoming: number;
  totalOutgoing: number;
  totalFees: number;
  netPnL: number;
  transactionCount: number;
  lastUpdated: number;
  transactions: RealTransaction[];
  balanceHistory: Array<{ timestamp: number; balance: number }>;
  currentBalance: number;
}

const pnlState: PnLState = {
  totalIncoming: 0,
  totalOutgoing: 0,
  totalFees: 0,
  netPnL: 0,
  transactionCount: 0,
  lastUpdated: 0,
  transactions: [],
  balanceHistory: [],
  currentBalance: 0,
};

let connection: Connection | null = null;
function getConnection(): Connection {
  if (!connection) connection = new Connection(RPC_URL, "confirmed");
  return connection;
}

export async function fetchRealBalance(): Promise<number> {
  try {
    const conn = getConnection();
    const pubkey = new PublicKey(WALLET_ADDRESS);
    const lamports = await conn.getBalance(pubkey);
    const balance = lamports / LAMPORTS_PER_SOL;
    pnlState.currentBalance = balance;
    pnlState.balanceHistory.push({ timestamp: Date.now(), balance });
    if (pnlState.balanceHistory.length > 1000) pnlState.balanceHistory = pnlState.balanceHistory.slice(-500);
    return balance;
  } catch (err: any) {
    log(`Balance fetch error: ${err.message}`);
    return pnlState.currentBalance;
  }
}

export async function fetchRealTransactions(limit: number = 20): Promise<RealTransaction[]> {
  try {
    const conn = getConnection();
    const pubkey = new PublicKey(WALLET_ADDRESS);
    const signatures = await conn.getSignaturesForAddress(pubkey, { limit });

    const sigSlice = signatures.slice(0, Math.min(limit, 10));
    const txResults = await Promise.allSettled(
      sigSlice.map(sigInfo =>
        Promise.race([
          conn.getTransaction(sigInfo.signature, { maxSupportedTransactionVersion: 0, commitment: "confirmed" })
            .then(tx => ({ tx, sigInfo })),
          new Promise<null>((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000))
        ])
      )
    );

    const transactions: RealTransaction[] = [];
    for (const result of txResults) {
      if (result.status !== "fulfilled" || !result.value) continue;
      const { tx, sigInfo } = result.value as { tx: any; sigInfo: any };
      if (!tx || !tx.meta) continue;

      const accountKeys = tx.transaction.message.getAccountKeys();
      let walletIndex = -1;
      for (let i = 0; i < accountKeys.length; i++) {
        if (accountKeys.get(i)?.toBase58() === WALLET_ADDRESS) {
          walletIndex = i;
          break;
        }
      }
      if (walletIndex === -1) continue;

      const preBal = tx.meta.preBalances[walletIndex] / LAMPORTS_PER_SOL;
      const postBal = tx.meta.postBalances[walletIndex] / LAMPORTS_PER_SOL;
      const diff = postBal - preBal;
      const fee = (tx.meta.fee || 0) / LAMPORTS_PER_SOL;

      let counterparty = "";
      const searchBalances = diff > 0 ? "pre" : "post";
      for (let i = 0; i < accountKeys.length; i++) {
        if (i !== walletIndex) {
          const check = diff > 0
            ? tx.meta.preBalances[i] > tx.meta.postBalances[i]
            : tx.meta.postBalances[i] > tx.meta.preBalances[i];
          if (check) {
            counterparty = accountKeys.get(i)?.toBase58() || "";
            break;
          }
        }
      }

      transactions.push({
        signature: sigInfo.signature,
        blockTime: sigInfo.blockTime || 0,
        type: diff > 0 ? "incoming" : diff < 0 ? "outgoing" : "unknown",
        amountSOL: Math.abs(diff),
        counterparty,
        fee,
        success: !tx.meta.err,
      });
    }

    pnlState.transactions = transactions;
    pnlState.transactionCount = transactions.length;
    pnlState.totalIncoming = transactions.filter(t => t.type === "incoming").reduce((s, t) => s + t.amountSOL, 0);
    pnlState.totalOutgoing = transactions.filter(t => t.type === "outgoing").reduce((s, t) => s + t.amountSOL, 0);
    pnlState.totalFees = transactions.reduce((s, t) => s + t.fee, 0);
    pnlState.netPnL = pnlState.totalIncoming - pnlState.totalOutgoing;
    pnlState.lastUpdated = Date.now();

    log(`Fetched ${transactions.length} real transactions: +${pnlState.totalIncoming.toFixed(6)} / -${pnlState.totalOutgoing.toFixed(6)} SOL`);

    return transactions;
  } catch (err: any) {
    log(`Transaction fetch error: ${err.message}`);
    return pnlState.transactions;
  }
}

export function getRealPnL() {
  return { ...pnlState, walletAddress: WALLET_ADDRESS };
}

export async function refreshPnL(): Promise<PnLState> {
  await fetchRealBalance();
  await fetchRealTransactions();
  return pnlState;
}

log("Real P&L tracker initialized — tracking on-chain transactions");
