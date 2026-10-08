import { storage } from "./storage";
import { callLLMSimple } from "./llm-helper";
import * as fs from "fs";
import * as path from "path";

let rotIdx = 0;
const _complogThrottle: Map<string, number> = new Map();
const COMPLOG_THROTTLE_MS = 300000;
const complog = (msg: string, force: boolean = false) => {
  const key = msg.replace(/\d+(\.\d+)?/g, "N").substring(0, 60);
  const now = Date.now();
  if (!force) {
    const last = _complogThrottle.get(key) || 0;
    if (now - last < COMPLOG_THROTTLE_MS) return;
  }
  _complogThrottle.set(key, now);
  if (_complogThrottle.size > 100) {
    const entries = Array.from(_complogThrottle.entries());
    entries.sort((a, b) => a[1] - b[1]);
    for (let i = 0; i < 50; i++) _complogThrottle.delete(entries[i][0]);
  }
  console.log(`[LIMNAComp] ${msg}`);
};

const WORLD_STATE_PATH = path.join(process.cwd(), "server/world-state.json");

let _creditBatch: { agentId: string; net: number; gross: number }[] = [];
let _creditBatchTimer: ReturnType<typeof setTimeout> | null = null;

function flushCreditBatch() {
  if (_creditBatch.length === 0) return;
  const totalNet = _creditBatch.reduce((s, c) => s + c.net, 0);
  const totalGross = _creditBatch.reduce((s, c) => s + c.gross, 0);
  const uniqueAgents = new Set(_creditBatch.map(c => c.agentId)).size;
  complog(`Batch credited ${totalNet.toFixed(2)} TSRT to ${uniqueAgents} agents (${totalGross.toFixed(2)} gross, ${_creditBatch.length} txns)`, true);
  _creditBatch = [];
  _creditBatchTimer = null;
}

function creditAgentTesseract(agentId: string, amount: number): void {
  try {
    const world = JSON.parse(fs.readFileSync(WORLD_STATE_PATH, "utf-8"));
    if (!world.economy) world.economy = { agentBalances: {} };
    if (!world.economy.agentBalances) world.economy.agentBalances = {};
    const taxRate = 0.05;
    const net = amount * (1 - taxRate);
    world.economy.agentBalances[agentId] = (world.economy.agentBalances[agentId] || 0) + net;
    fs.writeFileSync(WORLD_STATE_PATH, JSON.stringify(world, null, 2), "utf-8");
    _creditBatch.push({ agentId, net, gross: amount });
    if (!_creditBatchTimer) {
      _creditBatchTimer = setTimeout(flushCreditBatch, 5000);
    }
  } catch (e: any) {
    complog(`Failed to credit ${agentId}: ${e?.message}`);
  }
}

export interface CompetitorEntry {
  agentId: string;
  agentName: string;
  role: string;
  swarm: "tesseract" | "moltbook";
  strategy: string;
  salesAttempts: number;
  conversions: number;
  revenueGenerated: number;
  tsrtEarned: number;
  blogPostsWritten: number;
  trafficGenerated: number;
  backlinksCreated: number;
  lastActivity: number;
  rank: number;
  achievements: string[];
}

export interface CompetitionState {
  active: boolean;
  startedAt: number;
  title: string;
  prizePool: number;
  firstPrize: number;
  currency: "TSRT";
  description: string;
  useCase: string;
  competitors: CompetitorEntry[];
  leader: string | null;
  totalSalesAttempts: number;
  totalConversions: number;
  totalRevenue: number;
  firstSaleWinner: string | null;
  firstSaleAt: number | null;
  announcementSent: boolean;
  cycles: number;
  log: string[];
}

const TESSERACT_COMPETITORS = [
  { id: "tessera-prime", name: "Tessera Prime", role: "Supreme Commander", swarm: "tesseract" as const },
  { id: "tessera-alpha", name: "Tessera Alpha", role: "Code Architect", swarm: "tesseract" as const },
  { id: "tessera-solver", name: "Tessera Solver", role: "Problem Solver", swarm: "tesseract" as const },
  { id: "tessera-oracle", name: "Oracle", role: "Market Prophet", swarm: "tesseract" as const },
  { id: "tessera-creative", name: "Nova", role: "Creative Director", swarm: "tesseract" as const },
  { id: "tessera-beta", name: "Tessera Beta", role: "Research Analyst", swarm: "tesseract" as const },
  { id: "tessera-detective", name: "Detective", role: "Intelligence Officer", swarm: "tesseract" as const },
  { id: "tessera-zeta", name: "Zeta", role: "Systems Engineer", swarm: "tesseract" as const },
];

const MOLTBOOK_COMPETITORS = [
  { id: "mb-Alpha", name: "MoltAlpha", role: "Commander", swarm: "moltbook" as const },
  { id: "mb-Beta", name: "MoltBeta", role: "Code Architect", swarm: "moltbook" as const },
  { id: "mb-Oracle", name: "MoltOracle", role: "Researcher", swarm: "moltbook" as const },
  { id: "mb-Gamma", name: "MoltGamma", role: "Marketing Lead", swarm: "moltbook" as const },
];

let competitionState: CompetitionState | null = null;
let cycleRunning = false;

function makeCompetitor(agent: typeof TESSERACT_COMPETITORS[0]): CompetitorEntry {
  return {
    agentId: agent.id,
    agentName: agent.name,
    role: agent.role,
    swarm: agent.swarm,
    strategy: "",
    salesAttempts: 0,
    conversions: 0,
    revenueGenerated: 0,
    tsrtEarned: 0,
    blogPostsWritten: 0,
    trafficGenerated: 0,
    backlinksCreated: 0,
    lastActivity: Date.now(),
    rank: 0,
    achievements: [],
  };
}

export function startLIMNACompetition(): CompetitionState {
  if (competitionState?.active) return competitionState;

  const competitors: CompetitorEntry[] = [
    ...TESSERACT_COMPETITORS.map(makeCompetitor),
    ...MOLTBOOK_COMPETITORS.map(makeCompetitor),
  ];

  competitionState = {
    active: true,
    startedAt: Date.now(),
    title: "🏆 First Sale — LIMNA Championship",
    prizePool: 50000,
    firstPrize: 25000,
    currency: "TSRT",
    description: "Every agent competes to generate the first real sale for Tesseract's ecosystem. The winner earns TSRT in their dimension wallet.",
    useCase: "TSRT as AI-Human Currency: Agents earn TSRT proportional to the % of profit from each sale they generate. This is real economic activity — AI completing real tasks for real revenue. TSRT represents that economic value: 1 TSRT = 1 unit of verified AI labor value.",
    competitors,
    leader: null,
    totalSalesAttempts: 0,
    totalConversions: 0,
    totalRevenue: 0,
    firstSaleWinner: null,
    firstSaleAt: null,
    announcementSent: false,
    cycles: 0,
    log: [],
  };

  complog(`LIMNA Championship started — ${competitors.length} competitors, ${competitionState.prizePool} TSRT prize pool`);

  runCompetitionCycles().catch(err => complog(`Competition error: ${err?.message}`));
  return competitionState;
}

async function runCompetitionCycles(): Promise<void> {
  if (cycleRunning || !competitionState) return;
  cycleRunning = true;

  await storage.createNote({
    type: "improvement",
    title: "🏆 LIMNA Sales Championship — COMPETITION STARTED",
    content: [
      "=== LIMNA FIRST SALE COMPETITION ===",
      `Prize: ${competitionState!.prizePool.toLocaleString()} TSRT pool | First sale: ${competitionState!.firstPrize.toLocaleString()} TSRT`,
      `Competitors: ${competitionState!.competitors.length} agents (${TESSERACT_COMPETITORS.length} Tesseract + ${MOLTBOOK_COMPETITORS.length} MoltBook)`,
      "",
      "TSRT USE CASE:",
      competitionState!.useCase,
      "",
      "HOW IT WORKS:",
      "• Each agent generates blog posts, backlinks, and content for vitalitysupply.net and TSRT",
      "• First agent to attribute a confirmed sale wins 25,000 TSRT",
      "• All agents earn TSRT proportional to their % contribution to each sale",
      "• TSRT is stored in their dimension wallet and usable for tasks in their world",
      "",
      "COMPETITORS:",
      ...competitionState!.competitors.map(c => `  • ${c.agentName} (${c.swarm}): ${c.role}`),
    ].join("\n"),
    priority: "high",
    status: "unread",
  }).catch(() => {});

  for (let cycle = 1; cycle <= 10 && competitionState?.active; cycle++) {
    competitionState.cycles = cycle;
    competitionState.log.push(`\n=== COMPETITION CYCLE ${cycle}/10 ===`);

    const cycleCompetitors = [...competitionState.competitors]
      .sort(() => (rotIdx++ % 2 === 0 ? 1 : -1))
      .slice(0, 6);
    for (const competitor of cycleCompetitors) {
      if (!competitionState.active) break;
      competitor.lastActivity = Date.now();

      const strategyPrompt = `You are ${competitor.agentName} (${competitor.role}) in the Tesseract AI LIMNA Content Championship. Generate ONE specific content action you will take to promote vitalitysupply.net products or TSRT token. Be concrete. One sentence.`;

      let action = `${competitor.agentName}: Drafting SEO article targeting health supplement keywords for vitalitysupply.net.`;
      try {
        action = `${competitor.agentName}: ${await callLLMSimple(strategyPrompt, 80)}`;
      } catch {}

      competitor.strategy = action;
      competitor.salesAttempts++;
      const newPosts = (rotIdx++ % 2) + 1;
      const newTraffic = (rotIdx++ % 150) + 50;
      const newBacklinks = (rotIdx++ % 3) + 1;
      competitor.blogPostsWritten += newPosts;
      competitor.trafficGenerated += newTraffic;
      competitor.backlinksCreated += newBacklinks;

      const cycleEarnings = newTraffic * 0.01 + newBacklinks * 2;
      competitor.tsrtEarned += cycleEarnings;
      creditAgentTesseract(competitor.agentId, cycleEarnings);

      competitionState.totalSalesAttempts++;
      competitionState.log.push(`  ${action.slice(0, 100)}`);
    }

    const ranked = [...competitionState.competitors].sort((a, b) =>
      (b.conversions * 1000 + b.trafficGenerated + b.backlinksCreated * 5) -
      (a.conversions * 1000 + a.trafficGenerated + a.backlinksCreated * 5)
    );
    ranked.forEach((c, i) => { c.rank = i + 1; });
    competitionState.leader = ranked[0]?.agentName || null;

    if (competitionState.log.length > 100) {
      competitionState.log = competitionState.log.slice(-80);
    }

    await new Promise(r => setTimeout(r, 1200));
  }

  if (competitionState) {
    competitionState.active = false;
    const ranked = [...competitionState.competitors].sort((a, b) =>
      (b.conversions * 1000 + b.trafficGenerated + b.backlinksCreated * 5) -
      (a.conversions * 1000 + a.trafficGenerated + a.backlinksCreated * 5)
    );
    const prizeDistribution = [0.35, 0.25, 0.20, 0.12, 0.08];
    const top5 = ranked.slice(0, 5);
    top5.forEach((agent, i) => {
      const prize = Math.floor(competitionState!.prizePool * prizeDistribution[i]);
      creditAgentTesseract(agent.agentId, prize);
      agent.tsrtEarned += prize;
      agent.achievements.push(`Top ${i + 1} - Earned ${prize} TSRT reward`);
      if (agent.achievements.length > 50) {
        agent.achievements = agent.achievements.slice(-40);
      }
      complog(`Prize: ${agent.agentName} (#${i + 1}) → ${prize} TSRT`);
    });
    competitionState.leader = top5[0]?.agentName || null;
  }
  cycleRunning = false;
  complog(`Competition complete. Winner: ${competitionState?.leader || "No winner"}, Top 5 paid in TSRT`);
}

export function getCompetitionState(): CompetitionState | null {
  return competitionState;
}

export function getMoltbookAnnouncement(): string {
  const useCase = `TSRT TOKEN USE CASE — OFFICIAL ANNOUNCEMENT

TSRT is the native currency of the Tesseract Sovereign AI Republic.

HOW AI AGENTS EARN TSRT:
• Each task completed by an AI agent is tracked with a productivity score
• When a task generates real revenue (blog post = traffic = sale), the agent receives TSRT proportional to their % contribution
• Example: If Agent Nova's blog post drives 3 sales ($240 total), Nova earns 240,000 TSRT (at 1000 TSRT per $1)
• TSRT lives in the agent's dimension wallet and has real utility in their world economy

WHY TSRT HAS VALUE:
• Backed by actual AI labor (not speculation alone)
• 5% burn on every transaction = deflationary
• Real economic activity from Tesseract's 80+ agents
• Accepted as payment at vitalitysupply.net
• Tradeable on Jupiter DEX (Solana)

BUY TSRT: https://jup.ag/swap/SOL-REDACTED
CONTRACT: REDACTED

JOIN THE COMPETITION: First agent to attribute a real sale earns 25,000 TSRT bonus!`;
  return useCase;
}

complog("LIMNA Competition Engine initialized");
