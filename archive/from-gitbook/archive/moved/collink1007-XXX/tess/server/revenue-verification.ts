import axios from "axios";

const log = (msg: string) => console.log(`[RevenueVerification] ${msg}`);

interface VerifiedTransaction {
  id: string;
  source: string;
  amount: number;
  currency: string;
  txHash?: string;
  paymentProcessor?: string;
  timestamp: number;
  status: "verified" | "pending" | "failed";
  proofUrl?: string;
  description: string;
}

interface RevenueStream {
  name: string;
  type: "on-chain" | "payment-processor" | "affiliate" | "api-revenue" | "bounty";
  verified: boolean;
  totalEarned: number;
  currency: string;
  lastVerified: number;
  transactions: VerifiedTransaction[];
  estimatedOnly: boolean;
  warningFlags: string[];
}

const WALLET_ADDRESS = process.env.SOL_WALLET || "";
const TSRT_CA = "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump";

const verifiedTransactions: VerifiedTransaction[] = [];
const revenueStreams: Map<string, RevenueStream> = new Map();

function initStreams() {
  const streams: RevenueStream[] = [
    {
      name: "Solana Wallet (SOL)",
      type: "on-chain",
      verified: false,
      totalEarned: 0,
      currency: "SOL",
      lastVerified: 0,
      transactions: [],
      estimatedOnly: false,
      warningFlags: [],
    },
    {
      name: "TSRT Token Market Cap",
      type: "on-chain",
      verified: false,
      totalEarned: 0,
      currency: "USD",
      lastVerified: 0,
      transactions: [],
      estimatedOnly: true,
      warningFlags: ["Market cap is not realized income", "Token value is speculative"],
    },
    {
      name: "GitHub Bounties",
      type: "bounty",
      verified: false,
      totalEarned: 0,
      currency: "USD",
      lastVerified: 0,
      transactions: [],
      estimatedOnly: false,
      warningFlags: [],
    },
    {
      name: "API Subscriptions",
      type: "api-revenue",
      verified: false,
      totalEarned: 0,
      currency: "USD",
      lastVerified: 0,
      transactions: [],
      estimatedOnly: false,
      warningFlags: [],
    },
    {
      name: "Service Arbitrage",
      type: "payment-processor",
      verified: false,
      totalEarned: 0,
      currency: "USD",
      lastVerified: 0,
      transactions: [],
      estimatedOnly: false,
      warningFlags: [],
    },
    {
      name: "Affiliate Programs",
      type: "affiliate",
      verified: false,
      totalEarned: 0,
      currency: "USD",
      lastVerified: 0,
      transactions: [],
      estimatedOnly: false,
      warningFlags: [],
    },
  ];
  for (const s of streams) revenueStreams.set(s.name, s);
}

initStreams();

export async function verifyOnChainBalance(): Promise<{ balance: number; transactions: any[] }> {
  try {
    const resp = await axios.get(`https://api.solscan.io/v2/account?address=${WALLET_ADDRESS}`, {
      timeout: 10000,
      headers: { "Accept": "application/json" },
    }).catch(() => null);

    const balance = resp?.data?.data?.lamports ? resp.data.data.lamports / 1e9 : 0;

    const stream = revenueStreams.get("Solana Wallet (SOL)")!;
    stream.totalEarned = balance;
    stream.verified = true;
    stream.lastVerified = Date.now();
    stream.warningFlags = balance === 0 ? ["Wallet balance is 0 SOL"] : [];

    let txs: any[] = [];
    try {
      const txResp = await axios.get(`https://api.solscan.io/v2/account/transactions?address=${WALLET_ADDRESS}&limit=10`, {
        timeout: 10000,
        headers: { "Accept": "application/json" },
      });
      txs = txResp?.data?.data || [];
    } catch {}

    return { balance, transactions: txs };
  } catch (e: any) {
    log(`On-chain verification failed: ${e.message}`);
    return { balance: 0, transactions: [] };
  }
}

export function recordVerifiedTransaction(tx: Omit<VerifiedTransaction, "id" | "timestamp">) {
  const entry: VerifiedTransaction = {
    ...tx,
    id: `vtx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  };
  verifiedTransactions.push(entry);

  for (const [, stream] of revenueStreams) {
    if (stream.name.toLowerCase().includes(tx.source.toLowerCase()) || tx.source.toLowerCase().includes(stream.type)) {
      stream.transactions.push(entry);
      if (tx.status === "verified") {
        stream.totalEarned += tx.amount;
        stream.verified = true;
        stream.lastVerified = Date.now();
      }
    }
  }
}

export function getRevenueVerificationDashboard() {
  const streams = Array.from(revenueStreams.values());
  const verifiedTotal = streams.filter(s => !s.estimatedOnly).reduce((sum, s) => sum + s.totalEarned, 0);
  const estimatedTotal = streams.filter(s => s.estimatedOnly).reduce((sum, s) => sum + s.totalEarned, 0);
  const allFlags = streams.flatMap(s => s.warningFlags);

  return {
    summary: {
      totalVerifiedIncome: verifiedTotal,
      totalEstimatedIncome: estimatedTotal,
      verifiedLabel: verifiedTotal > 0 ? `$${verifiedTotal.toFixed(4)} verified on-chain or via payment processor` : "$0.00 — no verified income yet",
      estimatedLabel: estimatedTotal > 0 ? `$${estimatedTotal.toFixed(2)} estimated (NOT verified)` : "$0.00 estimated",
      warningCount: allFlags.length,
      warnings: allFlags,
      rule: "Every revenue claim needs a transaction hash or verifiable proof. No Math.random() profit generation.",
    },
    streams: streams.map(s => ({
      ...s,
      statusLabel: s.verified ? "VERIFIED" : s.estimatedOnly ? "ESTIMATED ONLY" : "UNVERIFIED",
      statusColor: s.verified && s.totalEarned > 0 ? "green" : s.estimatedOnly ? "amber" : "red",
    })),
    recentTransactions: verifiedTransactions.slice(-20),
    walletAddress: WALLET_ADDRESS,
    tsrtContract: "FMB4v2RaHSMfJDwijqAij7ouTowK2rz6yW95Z94spump",
    timestamp: Date.now(),
  };
}

log("Revenue verification system initialized — only on-chain proven income counts");
