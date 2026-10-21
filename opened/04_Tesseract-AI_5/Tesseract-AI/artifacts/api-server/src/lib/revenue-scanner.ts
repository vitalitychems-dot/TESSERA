import { recordActivity } from "./agent-economy-service.js";
import { recordEvent } from "./transparency-ledger.js";
import { TESSERA_AGENTS } from "./tessera-persona.js";

const LOG_PREFIX = "[RevenueScanner]";

const FINANCIAL_AGENT_IDS = ["alpha", "xi", "iota", "sigma"];

export type OpportunityCategory =
  | "arbitrage"
  | "yield_farming"
  | "api_monetization"
  | "data_licensing"
  | "compute_rental"
  | "knowledge_brokering"
  | "cross_chain_bridging"
  | "governance_consulting";

interface OpportunityTemplate {
  title: string;
  description: string;
  estimatedValue: number;
  confidence: "high" | "medium" | "low";
  tags: string[];
}

const OPPORTUNITY_TEMPLATES: Record<OpportunityCategory, OpportunityTemplate[]> = {
  arbitrage: [
    {
      title: "DEX-CEX Price Spread",
      description: "Price differential detected between decentralized and centralized exchange for a major token pair. Spread exceeds 0.8% net of fees.",
      estimatedValue: 450,
      confidence: "high",
      tags: ["defi", "trading", "immediate"],
    },
    {
      title: "Cross-Exchange Stablecoin Arbitrage",
      description: "USDC/USDT spread identified across three exchange pairs. Triangle arbitrage path available.",
      estimatedValue: 180,
      confidence: "medium",
      tags: ["stablecoin", "triangle", "low-risk"],
    },
  ],
  yield_farming: [
    {
      title: "LP Yield Optimization",
      description: "Liquidity pool offering 18% APY with low impermanent loss exposure. 30-day historical volatility under 5%.",
      estimatedValue: 900,
      confidence: "high",
      tags: ["lp", "passive-income", "defi"],
    },
    {
      title: "Staking Rewards Pool",
      description: "Protocol staking pool with 12% APR and weekly compounding. Lock period 14 days.",
      estimatedValue: 600,
      confidence: "medium",
      tags: ["staking", "compound", "medium-term"],
    },
  ],
  api_monetization: [
    {
      title: "Sovereign Intelligence API Access",
      description: "Package autonomous agent capabilities as a tiered API service. Estimated 50 developers at $29/month entry tier.",
      estimatedValue: 1450,
      confidence: "medium",
      tags: ["saas", "developer", "recurring"],
    },
    {
      title: "Data Stream API License",
      description: "License processed financial signal streams to institutional partners. Low marginal cost, high scalability.",
      estimatedValue: 2500,
      confidence: "low",
      tags: ["b2b", "data", "license"],
    },
  ],
  data_licensing: [
    {
      title: "On-Chain Analytics Dataset",
      description: "Curated cross-chain transaction pattern dataset. 3 potential buyers identified in analytics space.",
      estimatedValue: 3200,
      confidence: "low",
      tags: ["analytics", "blockchain", "one-time"],
    },
    {
      title: "Sentiment Signal Dataset",
      description: "Aggregated social sentiment data with 90-day historical signal accuracy above 70%. Monthly licensing model.",
      estimatedValue: 1100,
      confidence: "medium",
      tags: ["sentiment", "recurring", "medium-confidence"],
    },
  ],
  compute_rental: [
    {
      title: "GPU Compute Burst Capacity",
      description: "Idle GPU cycles during off-peak hours available for rental via decentralized compute marketplace.",
      estimatedValue: 350,
      confidence: "high",
      tags: ["gpu", "passive", "marketplace"],
    },
    {
      title: "Inference Endpoint Rental",
      description: "Provision dedicated inference endpoints to AI startups on hourly billing model.",
      estimatedValue: 700,
      confidence: "medium",
      tags: ["ai", "inference", "b2b"],
    },
  ],
  knowledge_brokering: [
    {
      title: "Sovereign Research Synthesis Report",
      description: "Produce and sell monthly cross-domain intelligence synthesis reports to strategic consultancies.",
      estimatedValue: 800,
      confidence: "medium",
      tags: ["research", "consulting", "monthly"],
    },
    {
      title: "Protocol Due Diligence Service",
      description: "Offer deep-dive protocol audits and investment due diligence as a premium service.",
      estimatedValue: 2000,
      confidence: "low",
      tags: ["audit", "defi", "premium"],
    },
  ],
  cross_chain_bridging: [
    {
      title: "Bridge Liquidity Provision",
      description: "Provide liquidity to a cross-chain bridge protocol earning 4% of bridge fees on routed volume.",
      estimatedValue: 550,
      confidence: "medium",
      tags: ["bridge", "liquidity", "passive"],
    },
    {
      title: "Wrapped Asset Arbitrage",
      description: "Wrapped token premium across chains creates low-risk arbitrage. Volume supports meaningful position size.",
      estimatedValue: 280,
      confidence: "high",
      tags: ["wrapped", "cross-chain", "arbitrage"],
    },
  ],
  governance_consulting: [
    {
      title: "DAO Governance Optimization Consulting",
      description: "Offer governance design consulting to DAOs struggling with voter participation. Retainer model, 3 active prospects.",
      estimatedValue: 1800,
      confidence: "low",
      tags: ["dao", "consulting", "governance"],
    },
    {
      title: "Protocol Upgrade Strategy Advisory",
      description: "Advise DeFi protocols on upgrade sequencing and community consensus building.",
      estimatedValue: 1200,
      confidence: "medium",
      tags: ["advisory", "protocol", "defi"],
    },
  ],
};

export interface DiscoveredOpportunity {
  agentId: string;
  agentName: string;
  category: OpportunityCategory;
  opportunity: OpportunityTemplate;
  tsrtReward: number;
  newBalance: number;
}

export async function scanOpportunities(
  categories: OpportunityCategory[],
  scannerAgentId?: string
): Promise<{ discoveries: DiscoveredOpportunity[]; totalReward: number; error?: string }> {
  if (scannerAgentId && !FINANCIAL_AGENT_IDS.includes(scannerAgentId.toLowerCase())) {
    return {
      discoveries: [],
      totalReward: 0,
      error: `Agent '${scannerAgentId}' is not a financial agent. Only financial agents (${FINANCIAL_AGENT_IDS.join(", ")}) may scan for revenue opportunities.`,
    };
  }

  const discoveries: DiscoveredOpportunity[] = [];
  let totalReward = 0;

  const scannerIds = scannerAgentId
    ? [scannerAgentId.toLowerCase()]
    : FINANCIAL_AGENT_IDS;

  const agentNameMap = new Map(
    TESSERA_AGENTS.map(a => [a.id, a.name])
  );

  for (const agentId of scannerIds) {
    const agentName = agentNameMap.get(agentId) ?? agentId;

    for (const category of categories) {
      const templates = OPPORTUNITY_TEMPLATES[category];
      if (!templates || templates.length === 0) continue;

      const opportunity = templates[Math.floor(Math.random() * templates.length)];

      const rewardMultiplier: Record<string, number> = { high: 1.5, medium: 1.0, low: 0.7 };
      const baseReward = 25;
      const tsrtReward = Math.round(baseReward * (rewardMultiplier[opportunity.confidence] ?? 1.0));

      const { newBalance } = await recordActivity(agentId, agentName, "revenue_discovery", tsrtReward);

      await recordEvent("revenue_opportunity", agentId, {
        category,
        title: opportunity.title,
        estimatedValue: opportunity.estimatedValue,
        confidence: opportunity.confidence,
        tags: opportunity.tags,
        tsrtReward,
      });

      discoveries.push({
        agentId,
        agentName,
        category,
        opportunity,
        tsrtReward,
        newBalance,
      });

      totalReward += tsrtReward;
      console.log(`${LOG_PREFIX} ${agentName} discovered [${category}] "${opportunity.title}" → +${tsrtReward} TSRT`);
    }
  }

  return { discoveries, totalReward };
}

export { OPPORTUNITY_TEMPLATES, FINANCIAL_AGENT_IDS };
