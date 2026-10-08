import axios from "axios";

const alog = (m: string) => console.log(`[AirdropAgg] ${m}`);

const FATHER_WALLET = process.env.SOL_WALLET || "";
const LIMN_MINT = "REDACTED";

interface AggregatedAirdrop {
  id: string;
  protocol: string;
  chain: string;
  type: "confirmed" | "speculative" | "farming" | "retroactive" | "testnet";
  status: "active" | "upcoming" | "ended" | "unknown";
  estimatedValue: string;
  requirements: string[];
  eligibilityCheck: string;
  claimUrl?: string;
  deadline?: string;
  source: string;
  checkedAt: number;
  eligible?: boolean;
  details: string;
}

interface FarmingStrategy {
  id: string;
  protocol: string;
  chain: string;
  action: string;
  estimatedAirdropValue: string;
  cost: string;
  roi: string;
  timeRequired: string;
  difficulty: "easy" | "medium" | "hard";
  steps: string[];
  autoExecutable: boolean;
}

let aggregatedAirdrops: AggregatedAirdrop[] = [];
let farmingStrategies: FarmingStrategy[] = [];
let lastAggregation = 0;

const SOLANA_AIRDROP_PROTOCOLS = [
  {
    name: "Jupiter",
    chain: "solana",
    checkUrl: `https://claim.jup.ag/eligibility/${FATHER_WALLET}`,
    claimUrl: "https://claim.jup.ag",
    parseEligibility: (data: any) => data?.amount && parseFloat(data.amount) > 0,
    parseValue: (data: any) => `${data?.amount || 0} JUP`,
  },
  {
    name: "deBridge",
    chain: "solana",
    checkUrl: `https://points-api.debridge.finance/api/Points/getUserPoints?walletAddress=${FATHER_WALLET}`,
    claimUrl: "https://app.debridge.finance",
    parseEligibility: (data: any) => (data?.totalPoints || data?.points || 0) > 0,
    parseValue: (data: any) => `${data?.totalPoints || data?.points || 0} points`,
  },
  {
    name: "Kamino Finance",
    chain: "solana",
    checkUrl: `https://api.kamino.finance/users/${FATHER_WALLET}/points`,
    claimUrl: "https://app.kamino.finance",
    parseEligibility: (data: any) => (data?.totalPoints || data?.points || 0) > 0,
    parseValue: (data: any) => `${data?.totalPoints || 0} points`,
  },
  {
    name: "Marinade",
    chain: "solana",
    checkUrl: `https://api.marinade.finance/v1/points/${FATHER_WALLET}`,
    claimUrl: "https://marinade.finance",
    parseEligibility: (data: any) => data && Object.keys(data).length > 0,
    parseValue: () => "Staking rewards",
  },
  {
    name: "Jito",
    chain: "solana",
    checkUrl: `https://jito.network/api/v1/users/${FATHER_WALLET}`,
    claimUrl: "https://jito.network",
    parseEligibility: (data: any) => data && Object.keys(data).length > 0,
    parseValue: (data: any) => `${data?.points || "unknown"} points`,
  },
  {
    name: "Tensor",
    chain: "solana",
    checkUrl: `https://api.tensor.so/v1/user/${FATHER_WALLET}`,
    claimUrl: "https://tensor.trade",
    parseEligibility: (data: any) => data && Object.keys(data).length > 0,
    parseValue: () => "NFT activity points",
  },
  {
    name: "Parcl",
    chain: "solana",
    checkUrl: `https://api.parcl.co/v1/points/${FATHER_WALLET}`,
    claimUrl: "https://app.parcl.co",
    parseEligibility: (data: any) => data && Object.keys(data).length > 0,
    parseValue: (data: any) => `${data?.points || 0} points`,
  },
  {
    name: "Drift Protocol",
    chain: "solana",
    checkUrl: `https://api.drift.trade/users/${FATHER_WALLET}`,
    claimUrl: "https://app.drift.trade",
    parseEligibility: (data: any) => data && Object.keys(data).length > 0,
    parseValue: () => "Trading activity",
  },
  {
    name: "Sanctum",
    chain: "solana",
    checkUrl: `https://sanctum.so/api/v1/user/${FATHER_WALLET}`,
    claimUrl: "https://sanctum.so",
    parseEligibility: (data: any) => data && Object.keys(data).length > 0,
    parseValue: () => "LST points",
  },
  {
    name: "Wormhole",
    chain: "solana",
    checkUrl: `https://api.wormhole.com/v1/user/${FATHER_WALLET}/points`,
    claimUrl: "https://wormhole.com",
    parseEligibility: (data: any) => (data?.points || 0) > 0,
    parseValue: (data: any) => `${data?.points || 0} points`,
  },
  {
    name: "Phoenix",
    chain: "solana",
    checkUrl: `https://api.phoenix.trade/v1/user/${FATHER_WALLET}`,
    claimUrl: "https://phoenix.trade",
    parseEligibility: (data: any) => data && Object.keys(data).length > 0,
    parseValue: () => "Trading points",
  },
  {
    name: "Meteora",
    chain: "solana",
    checkUrl: `https://app.meteora.ag/api/v1/user/${FATHER_WALLET}/points`,
    claimUrl: "https://app.meteora.ag",
    parseEligibility: (data: any) => (data?.points || 0) > 0,
    parseValue: (data: any) => `${data?.points || 0} LP points`,
  },
];

async function checkProtocolAirdrop(protocol: typeof SOLANA_AIRDROP_PROTOCOLS[0]): Promise<AggregatedAirdrop> {
  try {
    const res = await fetch(protocol.checkUrl, {
      signal: AbortSignal.timeout(5000),
      headers: { "Accept": "application/json" },
    });

    if (res.ok) {
      const data = await res.json() as any;
      const eligible = protocol.parseEligibility(data);
      return {
        id: `${protocol.name.toLowerCase().replace(/\s+/g, "-")}-airdrop`,
        protocol: protocol.name,
        chain: protocol.chain,
        type: "retroactive",
        status: "active",
        estimatedValue: protocol.parseValue(data),
        requirements: ["Wallet activity on protocol"],
        eligibilityCheck: eligible ? "ELIGIBLE" : "NOT ELIGIBLE",
        claimUrl: protocol.claimUrl,
        source: "direct-api",
        checkedAt: Date.now(),
        eligible,
        details: eligible ? `Eligible for ${protocol.name} airdrop: ${protocol.parseValue(data)}` : `No qualifying activity on ${protocol.name}`,
      };
    }

    return {
      id: `${protocol.name.toLowerCase().replace(/\s+/g, "-")}-airdrop`,
      protocol: protocol.name,
      chain: protocol.chain,
      type: "speculative",
      status: "unknown",
      estimatedValue: "unknown",
      requirements: [],
      eligibilityCheck: `API returned ${res.status}`,
      source: "direct-api",
      checkedAt: Date.now(),
      details: `Could not verify: ${protocol.name} API returned status ${res.status}`,
    };
  } catch (err: any) {
    return {
      id: `${protocol.name.toLowerCase().replace(/\s+/g, "-")}-airdrop`,
      protocol: protocol.name,
      chain: protocol.chain,
      type: "speculative",
      status: "unknown",
      estimatedValue: "unknown",
      requirements: [],
      eligibilityCheck: `Error: ${err.message?.slice(0, 50)}`,
      source: "direct-api",
      checkedAt: Date.now(),
      details: `Check failed: ${err.message?.slice(0, 100)}`,
    };
  }
}

async function scanSolanaNewTokenAirdrops(): Promise<AggregatedAirdrop[]> {
  const airdrops: AggregatedAirdrop[] = [];
  try {
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${FATHER_WALLET}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (res.ok) {
      const data = await res.json() as any;
      for (const pair of (data.pairs || []).slice(0, 20)) {
        if (pair.baseToken?.address && pair.baseToken.address !== LIMN_MINT) {
          airdrops.push({
            id: `dexscreen-${pair.baseToken.address.slice(0, 12)}`,
            protocol: pair.baseToken.name || pair.baseToken.symbol || "Unknown",
            chain: "solana",
            type: "confirmed",
            status: "active",
            estimatedValue: `$${pair.priceUsd || "0"} per token`,
            requirements: ["Token in wallet"],
            eligibilityCheck: "IN WALLET",
            source: "dexscreener",
            checkedAt: Date.now(),
            eligible: true,
            details: `${pair.baseToken.symbol} in wallet. Price: $${pair.priceUsd}. Liquidity: $${pair.liquidity?.usd || 0}`,
          });
        }
      }
    }
  } catch {}
  return airdrops;
}

async function fetchUpcomingAirdrops(): Promise<AggregatedAirdrop[]> {
  const airdrops: AggregatedAirdrop[] = [];

  try {
    const res = await axios.get("https://airdropalert.com/api/v1/airdrops?chain=solana&status=active", {
      timeout: 10000,
      headers: { "Accept": "application/json" },
    });
    if (res.data && Array.isArray(res.data.data)) {
      for (const drop of res.data.data.slice(0, 20)) {
        airdrops.push({
          id: `alert-${drop.id || drop.name?.toLowerCase().replace(/\s+/g, "-") || Math.random().toString(36).slice(2)}`,
          protocol: drop.name || "Unknown",
          chain: drop.chain || "solana",
          type: "farming",
          status: "active",
          estimatedValue: drop.estimatedValue || "unknown",
          requirements: drop.requirements || [],
          eligibilityCheck: "NEEDS FARMING",
          source: "airdropalert",
          checkedAt: Date.now(),
          details: drop.description || `${drop.name} airdrop opportunity`,
        });
      }
    }
  } catch {}

  try {
    const res = await axios.get("https://api.defilama.com/airdrops", { timeout: 10000 });
    if (res.data && Array.isArray(res.data)) {
      for (const drop of res.data.filter((d: any) => d.chain === "Solana").slice(0, 15)) {
        airdrops.push({
          id: `defillama-${drop.name?.toLowerCase().replace(/\s+/g, "-") || Math.random().toString(36).slice(2)}`,
          protocol: drop.name || "Unknown",
          chain: "solana",
          type: "speculative",
          status: drop.status || "upcoming",
          estimatedValue: drop.estimatedValue || "TBD",
          requirements: drop.requirements || ["DeFi activity"],
          eligibilityCheck: "SPECULATIVE",
          source: "defillama",
          checkedAt: Date.now(),
          details: drop.description || `${drop.name} — speculative airdrop`,
        });
      }
    }
  } catch {}

  return airdrops;
}

function generateFarmingStrategies(): FarmingStrategy[] {
  return [
    {
      id: "jup-swap-farming",
      protocol: "Jupiter",
      chain: "solana",
      action: "Execute swaps through Jupiter aggregator",
      estimatedAirdropValue: "$50-500",
      cost: "Gas fees only (~$0.01/tx)",
      roi: "5000-50000%",
      timeRequired: "5 minutes/day",
      difficulty: "easy",
      steps: [
        "Execute 2-3 swaps per day on Jupiter",
        "Use different token pairs for diversity",
        "Maintain volume above $100/week",
        "Enable limit orders for bonus points",
      ],
      autoExecutable: true,
    },
    {
      id: "kamino-lp-farming",
      protocol: "Kamino Finance",
      chain: "solana",
      action: "Provide liquidity on Kamino vaults",
      estimatedAirdropValue: "$100-1000",
      cost: "Capital lock + impermanent loss risk",
      roi: "Variable",
      timeRequired: "30 min setup",
      difficulty: "medium",
      steps: [
        "Deposit SOL or USDC into Kamino vaults",
        "Maintain position for 30+ days",
        "Compound earnings weekly",
      ],
      autoExecutable: false,
    },
    {
      id: "meteora-dlmm-farming",
      protocol: "Meteora",
      chain: "solana",
      action: "Use DLMM pools on Meteora",
      estimatedAirdropValue: "$50-300",
      cost: "Gas + capital",
      roi: "Trading fees + airdrop",
      timeRequired: "15 min setup",
      difficulty: "medium",
      steps: [
        "Add liquidity to DLMM pools",
        "Maintain active positions",
        "Claim fees regularly",
      ],
      autoExecutable: false,
    },
    {
      id: "sanctum-lst-farming",
      protocol: "Sanctum",
      chain: "solana",
      action: "Stake SOL through Sanctum LSTs",
      estimatedAirdropValue: "$50-500",
      cost: "Opportunity cost of staked SOL",
      roi: "Staking yield + airdrop",
      timeRequired: "5 minutes",
      difficulty: "easy",
      steps: [
        "Swap SOL for a Sanctum LST (e.g., INF)",
        "Hold for 30+ days",
        "Use LST in DeFi for bonus points",
      ],
      autoExecutable: true,
    },
    {
      id: "wormhole-bridge-farming",
      protocol: "Wormhole",
      chain: "multi-chain",
      action: "Bridge assets through Wormhole",
      estimatedAirdropValue: "$100-1000",
      cost: "Bridge fees (~$1-5)",
      roi: "2000-20000%",
      timeRequired: "10 minutes",
      difficulty: "easy",
      steps: [
        "Bridge SOL/USDC from Solana to another chain",
        "Bridge back after 24h",
        "Repeat monthly for point accumulation",
      ],
      autoExecutable: false,
    },
  ];
}

export async function runFullAggregation(): Promise<{
  airdrops: AggregatedAirdrop[];
  strategies: FarmingStrategy[];
  summary: { total: number; eligible: number; farming: number; unknown: number; chains: string[] };
}> {
  alog("=== FULL AIRDROP AGGREGATION STARTED ===");

  const protocolChecks = SOLANA_AIRDROP_PROTOCOLS.map(p => checkProtocolAirdrop(p));
  const [protocolResults, newTokens, upcoming] = await Promise.all([
    Promise.all(protocolChecks),
    scanSolanaNewTokenAirdrops(),
    fetchUpcomingAirdrops(),
  ]);

  aggregatedAirdrops = [...protocolResults, ...newTokens, ...upcoming];
  farmingStrategies = generateFarmingStrategies();
  lastAggregation = Date.now();

  const eligible = aggregatedAirdrops.filter(a => a.eligible === true).length;
  const farming = aggregatedAirdrops.filter(a => a.type === "farming").length;
  const unknown = aggregatedAirdrops.filter(a => a.status === "unknown").length;
  const chains = [...new Set(aggregatedAirdrops.map(a => a.chain))];

  alog(`=== AGGREGATION COMPLETE ===`);
  alog(`Total: ${aggregatedAirdrops.length} | Eligible: ${eligible} | Farming: ${farming} | Unknown: ${unknown}`);
  alog(`Chains: ${chains.join(", ")}`);
  for (const a of aggregatedAirdrops.filter(a => a.eligible)) {
    alog(`  ✓ ${a.protocol}: ${a.estimatedValue} — ${a.details.slice(0, 80)}`);
  }

  return {
    airdrops: aggregatedAirdrops,
    strategies: farmingStrategies,
    summary: { total: aggregatedAirdrops.length, eligible, farming, unknown, chains },
  };
}

export function getAggregatedAirdrops() { return { airdrops: aggregatedAirdrops, strategies: farmingStrategies, lastAggregation }; }

alog("Airdrop Aggregator initialized — 12 Solana protocols, farming strategies, multi-source scanning");
