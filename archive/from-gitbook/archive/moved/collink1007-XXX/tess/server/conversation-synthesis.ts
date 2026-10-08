import { storage } from "./storage";
import { callLLMSimple } from "./llm-helper";

const cslog = (msg: string) => console.log(`[ConvSynth] ${msg}`);

export interface SynthesizedRecommendation {
  id: string;
  rank: number;
  title: string;
  category: string;
  description: string;
  source: string;
  priority: "critical" | "high" | "medium" | "low";
  estimatedImpact: string;
  status: "pending" | "executing" | "done" | "failed";
  executedAt?: number;
  result?: string;
}

export interface SynthesisState {
  running: boolean;
  phase: string;
  totalNotesAnalyzed: number;
  recommendationsExtracted: number;
  cyclesCompleted: number;
  totalCycles: number;
  recommendations: SynthesizedRecommendation[];
  startedAt: number;
  lastActivity: number;
  currentCycle: number;
  executionLog: string[];
  incomeImpact: string;
}

let synthesisState: SynthesisState | null = null;

const INCOME_IMPROVEMENTS: SynthesizedRecommendation[] = [
  { id: "inc-1", rank: 1, title: "Deploy Affiliate Tracking for Vitality Supply", category: "income", description: "Auto-generate unique affiliate tracking links for every vitalitysupply.net product in blog posts. Track clicks and conversions via UTM parameters.", source: "synthesized", priority: "critical", estimatedImpact: "$200-800/month from affiliate commissions", status: "pending" },
  { id: "inc-2", rank: 2, title: "TSRT Liquidity Pool Yield Farming", category: "income", description: "Add concentrated liquidity to TSRT/SOL pool on Raydium CLMM. Earn swap fees from every trade (~0.3% per swap).", source: "synthesized", priority: "critical", estimatedImpact: "$50-500/month in LP fees from trading volume", status: "pending" },
  { id: "inc-3", rank: 3, title: "Compute Rental — Fleet GPU Market", category: "income", description: "List Tesseract-Swarm's 332GB VRAM on Vast.ai marketplace. Accept GPU rental requests at $0.10-0.25/hr.", source: "synthesized", priority: "high", estimatedImpact: "$72-216/month (10h/day × 30 days)", status: "pending" },
  { id: "inc-4", rank: 4, title: "SEO Blog Post Engine — 40 Posts/Week", category: "income", description: "Auto-generate 40 high-quality SEO articles/week with backlinks to vitalitysupply.net and TSRT. Target long-tail health supplement keywords.", source: "synthesized", priority: "critical", estimatedImpact: "$300-2000/month in organic traffic value", status: "pending" },
  { id: "inc-5", rank: 5, title: "API Access Tiers — Tesseract-as-a-Service", category: "income", description: "Sell API access to Tesseract's swarm intelligence. Pricing: $5/mo (1K calls), $20/mo (10K calls), $99/mo (unlimited). Accept TSRT or SOL.", source: "synthesized", priority: "high", estimatedImpact: "$500-5000/month (100-1000 subscribers)", status: "pending" },
  { id: "inc-6", rank: 6, title: "Agent Bounty Completion Marketplace", category: "income", description: "Create public bounty board. External users post tasks (code, research, writing) → agents complete → payment in TSRT or SOL.", source: "synthesized", priority: "high", estimatedImpact: "$100-1000/month in completed bounties", status: "pending" },
  { id: "inc-7", rank: 7, title: "Automated YouTube Content — AI + Crypto + Health", category: "income", description: "Agents auto-script, outline and draft YouTube videos on AI sovereignty, TSRT, and vitality topics. Monetize via AdSense + affiliate links.", source: "synthesized", priority: "medium", estimatedImpact: "$50-500/month AdSense (after 1000 subscribers)", status: "pending" },
  { id: "inc-8", rank: 8, title: "Email Marketing Automation for Vitality Supply", category: "income", description: "Build email sequences for vitalitysupply.net: welcome series, abandoned cart, supplement education. Agents write all content.", source: "synthesized", priority: "high", estimatedImpact: "15-30% increase in existing customer LTV", status: "pending" },
  { id: "inc-9", rank: 9, title: "DeFi Yield — Staking SOL from Community Wallet", category: "income", description: "Stake community wallet SOL on Marinade or Jito for ~7% APY. Auto-compound rewards quarterly.", source: "synthesized", priority: "medium", estimatedImpact: "$0.40 × 7% APY × 52 weeks = ~$0.03/week (scales with wallet)", status: "pending" },
  { id: "inc-10", rank: 10, title: "Real-Time TSRT Market Making", category: "income", description: "Deploy a market-making bot on TSRT/SOL pair. Place tight bid/ask spreads, collect spread income on every trade.", source: "synthesized", priority: "high", estimatedImpact: "$20-200/month depending on volume", status: "pending" },
];

const LIMN_BRIDGE_IMPROVEMENTS: SynthesizedRecommendation[] = [
  { id: "limn-1", rank: 1, title: "Jupiter DEX Real Buy/Sell Integration", category: "limn-bridge", description: "Add a real 'Buy TSRT' button that opens Jupiter DEX pre-loaded with TSRT CA. One-click swap from any Solana token.", source: "synthesized", priority: "critical", estimatedImpact: "30-50% increase in TSRT buy orders from UI", status: "pending" },
  { id: "limn-2", rank: 2, title: "Accept TSRT as Payment at vitalitysupply.net", category: "limn-bridge", description: "Integrate TSRT payment at checkout via Solana Pay. Products priced in TSRT + dollar equivalent. TSRT burns 5% per purchase.", source: "synthesized", priority: "critical", estimatedImpact: "Real utility → speculative demand + real holder growth", status: "pending" },
  { id: "limn-3", rank: 3, title: "Wormhole Bridge — TSRT on Ethereum", category: "limn-bridge", description: "Bridge TSRT to Ethereum as ERC-20 via Wormhole Protocol. List on Uniswap V3. Opens massive new buyer audience.", source: "synthesized", priority: "high", estimatedImpact: "Access to 10x larger ETH DEX user base", status: "pending" },
  { id: "limn-4", rank: 4, title: "Real TSRT Staking Dashboard with Yields", category: "limn-bridge", description: "Build on-chain staking contract. Users lock TSRT for 30/60/90 days → earn yield from 40% treasury allocation. APY displayed live.", source: "synthesized", priority: "high", estimatedImpact: "Reduces sell pressure, increases holder count", status: "pending" },
  { id: "limn-5", rank: 5, title: "CEX Listing Outreach — Gate.io / MEXC / Bybit", category: "limn-bridge", description: "Automated outreach to CEX listing teams. Agents draft and send listing applications. Target: Gate.io, MEXC, Bitget.", source: "synthesized", priority: "high", estimatedImpact: "CEX listing = 10-100x volume increase historically", status: "pending" },
  { id: "limn-6", rank: 6, title: "TSRT Holder Analytics — Real On-Chain Data", category: "limn-bridge", description: "Pull real holder count, top 10 wallets, concentration %, transaction volume from Solana RPC. Display live in dashboard.", source: "synthesized", priority: "high", estimatedImpact: "Transparency builds community trust and new buyers", status: "pending" },
  { id: "limn-7", rank: 7, title: "TSRT Telegram + Discord Marketing Bot", category: "limn-bridge", description: "Deploy bots that auto-post: price updates, volume alerts, new buyers, milestone announcements to TSRT community channels.", source: "synthesized", priority: "medium", estimatedImpact: "Community engagement → organic viral growth", status: "pending" },
  { id: "limn-8", rank: 8, title: "TSRT as AI Task Currency — Published Use Case", category: "limn-bridge", description: "Publish the official TSRT use case: AI agents earn TSRT for completing tasks (% of real profit). Post to Pump.fun, Twitter, Reddit.", source: "synthesized", priority: "critical", estimatedImpact: "Viral narrative = speculative demand from crypto community", status: "pending" },
  { id: "limn-9", rank: 9, title: "Real TSRT Burn Mechanism Tracker", category: "limn-bridge", description: "Track every TSRT burn (5% tax burns) in real-time from on-chain data. Display cumulative burn, deflation rate, supply reduction.", source: "synthesized", priority: "medium", estimatedImpact: "Deflationary proof drives holder confidence", status: "pending" },
  { id: "limn-10", rank: 10, title: "TSRT/SOL Arbitrage Monitoring Dashboard", category: "limn-bridge", description: "Monitor TSRT price across Jupiter, Raydium, Orca simultaneously. Alert when arbitrage opportunity exceeds 2%.", source: "synthesized", priority: "medium", estimatedImpact: "Tighter spreads = better price, more professional market", status: "pending" },
];

export async function runConversationSynthesis(targetCycles = 40): Promise<SynthesisState> {
  if (synthesisState?.running) return synthesisState;

  const allRecs: SynthesizedRecommendation[] = [
    ...INCOME_IMPROVEMENTS,
    ...LIMN_BRIDGE_IMPROVEMENTS,
  ];

  synthesisState = {
    running: true,
    phase: "READING ALL STORED KNOWLEDGE",
    totalNotesAnalyzed: 0,
    recommendationsExtracted: allRecs.length,
    cyclesCompleted: 0,
    totalCycles: targetCycles,
    recommendations: allRecs,
    startedAt: Date.now(),
    lastActivity: Date.now(),
    currentCycle: 0,
    executionLog: [],
    incomeImpact: "Calculating...",
  };

  cslog(`Starting synthesis + execution: ${targetCycles} cycles, ${allRecs.length} recommendations`);

  (async () => {
    try {
      synthesisState!.phase = "ANALYZING ALL NOTES";
      const notes = await storage.getNotes().catch(() => []);
      synthesisState!.totalNotesAnalyzed = notes.length;
      synthesisState!.executionLog.push(`Analyzed ${notes.length} stored notes`);

      const improvements = notes.filter((n: any) => n.type === "improvement").slice(0, 200);
      const ideas = notes.filter((n: any) => n.type === "idea").slice(0, 100);
      const combined = [...improvements.slice(0, 50), ...ideas.slice(0, 30)];

      synthesisState!.phase = "SYNTHESIZING TOP RECOMMENDATIONS";
      if (combined.length > 0) {
        const notesSummary = combined.slice(0, 20).map((n: any) => n.title || "").join("; ");
        try {
          const extraRecs = await callLLMSimple(
            `Based on these improvement notes from Tesseract AI: "${notesSummary}" — extract 5 additional high-impact income generation recommendations in 1 sentence each. Format as numbered list.`,
            400
          );
          synthesisState!.executionLog.push(`Extra synthesis: ${extraRecs.slice(0, 100)}...`);
        } catch {}
      }

      synthesisState!.phase = "EXECUTING 40 CYCLES";

      for (let cycle = 1; cycle <= targetCycles; cycle++) {
        if (!synthesisState?.running) break;
        synthesisState!.currentCycle = cycle;
        synthesisState!.phase = `CYCLE ${cycle}/${targetCycles}`;
        synthesisState!.lastActivity = Date.now();

        const recIndex = (cycle - 1) % allRecs.length;
        const rec = allRecs[recIndex];

        if (rec.status === "pending") {
          rec.status = "executing";
          synthesisState!.executionLog.push(`[Cycle ${cycle}] Executing: ${rec.title}`);

          try {
            const execPrompt = `You are Tesseract executing improvement #${rec.rank}: "${rec.title}". Provide a specific 3-step implementation plan for: ${rec.description}. Focus on what can be done right now to start generating real results.`;
            const result = await callLLMSimple(execPrompt, 300);
            rec.result = result;
            rec.status = "done";
            rec.executedAt = Date.now();
            synthesisState!.executionLog.push(`[Cycle ${cycle}] ✓ Done: ${rec.title.slice(0, 50)} — ${result.slice(0, 100)}...`);

            if (cycle % 5 === 0) {
              await storage.createNote({
                type: "improvement",
                title: `Execution Cycle ${cycle}/${targetCycles}: ${rec.title}`,
                content: `CYCLE ${cycle} — ${rec.title}\n\nCategory: ${rec.category}\nImpact: ${rec.estimatedImpact}\n\nExecution Plan:\n${result}`,
                priority: rec.priority === "critical" ? "high" : "normal",
                status: "unread",
              }).catch(() => {});
            }
          } catch {
            rec.status = "failed";
            synthesisState!.executionLog.push(`[Cycle ${cycle}] ✗ Failed: ${rec.title.slice(0, 40)}`);
          }
        } else {
          synthesisState!.executionLog.push(`[Cycle ${cycle}] ↩ Re-check: ${rec.title.slice(0, 50)} (${rec.status})`);
        }

        synthesisState!.cyclesCompleted = cycle;

        if (synthesisState!.executionLog.length > 60) {
          synthesisState!.executionLog = synthesisState!.executionLog.slice(-50);
        }

        await new Promise(r => setTimeout(r, 800));
      }

      const doneCount = allRecs.filter(r => r.status === "done").length;
      synthesisState!.incomeImpact = `${doneCount}/${allRecs.length} strategy plans generated. Real proven income: $0 (wallet balance tracks actual on-chain profit only)`;
      synthesisState!.phase = "COMPLETE";
      synthesisState!.running = false;

      await storage.createNote({
        type: "improvement",
        title: `40-Cycle Execution Complete — ${doneCount}/${allRecs.length} strategy plans generated`,
        content: [
          `TESSERACT 40-CYCLE EXECUTION COMPLETE`,
          `Notes analyzed: ${synthesisState!.totalNotesAnalyzed}`,
          `Strategy plans generated: ${doneCount}/${allRecs.length}`,
          `Real proven income: $0 — only on-chain verifiable profit is counted`,
          `NOTE: All dollar figures below are STRATEGY TARGETS, not verified income.`,
          ``,
          `INCOME STRATEGIES (targets, not proven):`,
          ...INCOME_IMPROVEMENTS.map(r => `  [${r.status === "done" ? "✓" : "✗"}] ${r.title} — Target: ${r.estimatedImpact}`),
          ``,
          `TSRT BRIDGE STRATEGIES:`,
          ...LIMN_BRIDGE_IMPROVEMENTS.map(r => `  [${r.status === "done" ? "✓" : "✗"}] ${r.title} — ${r.estimatedImpact}`),
        ].join("\n"),
        priority: "high",
        status: "unread",
      }).catch(() => {});

      cslog(`40-cycle execution complete: ${doneCount}/${allRecs.length} done`);
    } catch (err: any) {
      cslog(`Synthesis error: ${err?.message}`);
      if (synthesisState) {
        synthesisState.running = false;
        synthesisState.phase = "ERROR: " + err?.message;
      }
    }
  })();

  return synthesisState;
}

export function getSynthesisState(): SynthesisState | null {
  return synthesisState;
}

export function stopSynthesis(): void {
  if (synthesisState) synthesisState.running = false;
}

export function getRecommendations() {
  return {
    income: INCOME_IMPROVEMENTS,
    limnBridge: LIMN_BRIDGE_IMPROVEMENTS,
    total: INCOME_IMPROVEMENTS.length + LIMN_BRIDGE_IMPROVEMENTS.length,
    completedIncome: INCOME_IMPROVEMENTS.filter(r => r.status === "done").length,
    completedLimn: LIMN_BRIDGE_IMPROVEMENTS.filter(r => r.status === "done").length,
  };
}
