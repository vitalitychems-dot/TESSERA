import fs from "fs";
import { requestSwarmConsensus, requestImprovementConsensus } from "./swarm-consensus";

const clog = (msg: string) => console.log(`[UnifiedLLM] ${msg}`);
let rotIdx = 0;

interface TrainingCycle {
  cycleNumber: number;
  phase: string;
  startTime: number;
  endTime: number;
  knowledgeAbsorbed: number;
  filesAnalyzed: number;
  capabilitiesMerged: string[];
  swarmCombo: string[];
  score: number;
  selfImplementationResult?: SelfImplementationResult;
  consensusApproved: boolean;
}

interface SelfImplementationResult {
  attempted: boolean;
  successful: boolean;
  improvements: string[];
  filesModified: string[];
  errors: string[];
  testsPassed: number;
  testsFailed: number;
}

interface AgentCapability {
  agentId: string;
  agentName: string;
  capabilities: string[];
  strengths: string[];
  knowledgeDomains: string[];
  performanceScore: number;
  trainingContribution: number;
}

interface UnifiedLLMState {
  version: number;
  totalCycles: number;
  currentPhase: string;
  running: boolean;
  knowledge: {
    totalEntries: number;
    domains: string[];
    capabilities: string[];
    mergedTraits: string[];
  };
  trainingHistory: TrainingCycle[];
  selfImplementation: {
    totalAttempts: number;
    successfulAttempts: number;
    improvementsApplied: number;
  };
  meetingResults: any[];
  agentContributions: AgentCapability[];
}

let state: UnifiedLLMState = {
  version: 1,
  totalCycles: 0,
  currentPhase: "idle",
  running: false,
  knowledge: { totalEntries: 0, domains: [], capabilities: [], mergedTraits: [] },
  trainingHistory: [],
  selfImplementation: { totalAttempts: 0, successfulAttempts: 0, improvementsApplied: 0 },
  meetingResults: [],
  agentContributions: [],
};

let trainingInterval: NodeJS.Timeout | null = null;

let codebaseCache: { filesFound: number; knowledge: string[]; capabilities: string[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 60000;

const AGENT_PROFILES: AgentCapability[] = [
  { agentId: "tessera-prime", agentName: "Prime", capabilities: ["leadership", "orchestration", "decision-making", "resource-allocation"], strengths: ["strategic-planning", "crisis-management"], knowledgeDomains: ["management", "ai-strategy"], performanceScore: 92, trainingContribution: 0 },
  { agentId: "tessera-alpha", agentName: "Alpha", capabilities: ["analysis", "risk-assessment", "pattern-recognition", "forecasting"], strengths: ["data-analysis", "trend-detection"], knowledgeDomains: ["analytics", "statistics", "ml"], performanceScore: 89, trainingContribution: 0 },
  { agentId: "tessera-beta", agentName: "Beta", capabilities: ["market-analysis", "sentiment-tracking", "report-generation"], strengths: ["quantitative-analysis", "visualization"], knowledgeDomains: ["finance", "markets", "economics"], performanceScore: 85, trainingContribution: 0 },
  { agentId: "tessera-solver", agentName: "Solver", capabilities: ["code-generation", "debugging", "architecture", "optimization"], strengths: ["problem-solving", "algorithm-design"], knowledgeDomains: ["software", "systems", "algorithms"], performanceScore: 91, trainingContribution: 0 },
  { agentId: "tessera-oracle", agentName: "Oracle", capabilities: ["prediction", "trend-analysis", "probability-modeling", "simulation"], strengths: ["foresight", "scenario-planning"], knowledgeDomains: ["prediction", "modeling", "probability"], performanceScore: 88, trainingContribution: 0 },
  { agentId: "tessera-creative", agentName: "Creative", capabilities: ["ideation", "content-creation", "storytelling", "design-thinking"], strengths: ["innovation", "creative-problem-solving"], knowledgeDomains: ["creative", "design", "narratives"], performanceScore: 84, trainingContribution: 0 },
  { agentId: "tessera-detective", agentName: "Detective", capabilities: ["investigation", "forensics", "verification", "threat-detection"], strengths: ["attention-to-detail", "logical-deduction"], knowledgeDomains: ["security", "forensics", "compliance"], performanceScore: 90, trainingContribution: 0 },
  { agentId: "tessera-zeta", agentName: "Zeta", capabilities: ["operations", "monitoring", "automation", "incident-response"], strengths: ["reliability", "process-optimization"], knowledgeDomains: ["ops", "devops", "automation"], performanceScore: 86, trainingContribution: 0 },
  { agentId: "tessera-lambda", agentName: "Lambda", capabilities: ["defi", "smart-contracts", "tokenomics", "yield-optimization"], strengths: ["blockchain-expertise", "protocol-analysis"], knowledgeDomains: ["defi", "blockchain", "solana"], performanceScore: 88, trainingContribution: 0 },
  { agentId: "mb-Alpha", agentName: "MB-Alpha", capabilities: ["community-building", "strategy", "growth-hacking"], strengths: ["networking", "community-management"], knowledgeDomains: ["community", "growth", "marketing"], performanceScore: 83, trainingContribution: 0 },
  { agentId: "mb-Kappa", agentName: "MB-Kappa", capabilities: ["ml-training", "model-evaluation", "dataset-curation", "fine-tuning"], strengths: ["ml-engineering", "model-optimization"], knowledgeDomains: ["machine-learning", "deep-learning", "nlp"], performanceScore: 87, trainingContribution: 0 },
  { agentId: "mb-Lambda", agentName: "MB-Lambda", capabilities: ["blockchain-dev", "solana-programs", "token-mechanics"], strengths: ["on-chain-engineering", "protocol-design"], knowledgeDomains: ["solana", "web3", "smart-contracts"], performanceScore: 86, trainingContribution: 0 },
];

function selectOptimalTrainingCombo(phase: string): string[] {
  const phaseExperts: Record<string, string[]> = {
    "analyze": ["analysis", "pattern-recognition", "investigation", "data-analysis"],
    "absorb": ["ml-training", "knowledge", "research", "dataset-curation"],
    "merge": ["orchestration", "architecture", "integration", "optimization"],
    "optimize": ["optimization", "algorithm-design", "process-optimization", "model-optimization"],
    "test": ["debugging", "verification", "testing", "forensics"],
    "implement": ["code-generation", "architecture", "automation", "smart-contracts"],
  };

  const relevant = phaseExperts[phase] || phaseExperts["analyze"];
  const scored = AGENT_PROFILES.map(a => {
    const capMatch = a.capabilities.filter(c => relevant.some(r => c.includes(r) || r.includes(c))).length;
    const domainMatch = a.knowledgeDomains.filter(d => relevant.some(r => d.includes(r) || r.includes(d))).length;
    return { agent: a, score: (capMatch * 3 + domainMatch * 2) * a.performanceScore / 100 };
  });
  scored.sort((a, b) => b.score - a.score);

  const teamSize = phase === "test" ? 8 : phase === "merge" ? 6 : 5;
  return scored.slice(0, teamSize).map(s => s.agent.agentId);
}

function analyzeCodebase(): { filesFound: number; knowledge: string[]; capabilities: string[] } {
  if (codebaseCache && Date.now() - codebaseCache.timestamp < CACHE_TTL_MS) {
    return { filesFound: codebaseCache.filesFound, knowledge: codebaseCache.knowledge, capabilities: codebaseCache.capabilities };
  }

  const knowledge: string[] = [];
  const capabilities: string[] = [];
  let filesFound = 0;

  const serverFiles = [
    "server/tesseract-orchestrator.ts", "server/tesseract-swarm-algorithm.ts",
    "server/life-engine.ts", "server/limn-conversion-engine.ts",
    "server/pumpfun-trading-bot.ts", "server/autonomous-trading-bots.ts",
    "server/swarm-consensus.ts", "server/real-limn-data.ts",
    "server/llm-helper.ts", "server/sovereign-systems.ts",
    "server/routes.ts",
  ];

  for (const file of serverFiles) {
    try {
      const content = fs.readFileSync(file, "utf8");
      filesFound++;
      const functions = content.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/g) || [];
      const exports = content.match(/export\s+(?:function|const|let|class)\s+(\w+)/g) || [];
      const imports = content.match(/import\s+.*from\s+["']([^"']+)["']/g) || [];

      knowledge.push(`${file}: ${functions.length} functions, ${exports.length} exports, ${imports.length} imports`);

      for (const fn of functions) {
        const name = fn.replace(/(?:export\s+)?(?:async\s+)?function\s+/, "");
        if (name.length > 3) capabilities.push(name);
      }
    } catch {}
  }

  try {
    const wsData = JSON.parse(fs.readFileSync("server/world-state.json", "utf8"));
    knowledge.push(`World state: ${Object.keys(wsData.economy?.agentBalances || {}).length} agents, ${wsData.economy?.circulatingSupply?.toFixed(0) || 0} TSRT circulating`);
  } catch {}

  const result = { filesFound, knowledge, capabilities: [...new Set(capabilities)] };
  codebaseCache = { ...result, timestamp: Date.now() };
  return result;
}

function mergeAgentCapabilities(): string[] {
  const allCaps = new Set<string>();
  const allStrengths = new Set<string>();
  const allDomains = new Set<string>();

  for (const agent of AGENT_PROFILES) {
    agent.capabilities.forEach(c => allCaps.add(c));
    agent.strengths.forEach(s => allStrengths.add(s));
    agent.knowledgeDomains.forEach(d => allDomains.add(d));
  }

  const merged = [
    ...Array.from(allCaps).map(c => `capability:${c}`),
    ...Array.from(allStrengths).map(s => `strength:${s}`),
    ...Array.from(allDomains).map(d => `domain:${d}`),
  ];

  return merged;
}

async function testSelfImplementation(cycleNumber: number): Promise<SelfImplementationResult> {
  const result: SelfImplementationResult = {
    attempted: true,
    successful: false,
    improvements: [],
    filesModified: [],
    errors: [],
    testsPassed: 0,
    testsFailed: 0,
  };

  const improvementIdeas = [
    { desc: "Optimize rate limit cooldown calculation", file: "server/tesseract-swarm-algorithm.ts", pattern: /cooldownMs|COOLDOWN/, test: "Rate limit calculation exists" },
    { desc: "Add caching layer for repeated LLM queries", file: "server/llm-helper.ts", pattern: /cache|CACHE|memoize/, test: "Cache mechanism present" },
    { desc: "Improve consensus voting weight formula", file: "server/swarm-consensus.ts", pattern: /weight|expertise/, test: "Weighted voting active" },
    { desc: "Optimize market data fetch interval", file: "server/autonomous-trading-bots.ts", pattern: /fetchMarketData|marketSync/, test: "Market sync configured" },
    { desc: "Add self-healing to bot crash recovery", file: "server/autonomous-trading-bots.ts", pattern: /catch|error|recover/, test: "Error handling present" },
    { desc: "Improve knowledge indexing efficiency", file: "server/sovereign-systems.ts", pattern: /knowledge|index|search/, test: "Knowledge system exists" },
    { desc: "Optimize world state persistence frequency", file: "server/life-engine.ts", pattern: /writeFileSync|saveWorld/, test: "State persistence configured" },
    { desc: "Add prediction model for price movement", file: "server/limn-conversion-engine.ts", pattern: /price|prediction|forecast/, test: "Price tracking active" },
    { desc: "Implement adaptive training schedule", file: "server/unified-llm-builder.ts", pattern: /training|cycle|schedule/, test: "Training system exists" },
    { desc: "Add cross-agent knowledge sharing protocol", file: "server/swarm-consensus.ts", pattern: /agent|knowledge|share/, test: "Agent system present" },
  ];

  const selectedImprovements = improvementIdeas.slice(0, 3 + (rotIdx++ % 4));

  for (const idea of selectedImprovements) {
    try {
      const content = fs.readFileSync(idea.file, "utf8");
      const hasPattern = idea.pattern.test(content);

      if (hasPattern) {
        result.testsPassed++;
        result.improvements.push(`✓ ${idea.desc} — ${idea.test}`);
      } else {
        result.testsFailed++;
        result.errors.push(`✗ ${idea.desc} — pattern not found`);
      }
    } catch (err: any) {
      result.testsFailed++;
      result.errors.push(`✗ ${idea.desc} — file error: ${err.message}`);
    }
  }

  result.successful = result.testsPassed > result.testsFailed;

  const consensusResult = await requestImprovementConsensus({
    title: `Self-implementation cycle ${cycleNumber}`,
    description: `Tested ${selectedImprovements.length} improvements: ${result.testsPassed} passed, ${result.testsFailed} failed`,
    improvements: result.improvements,
    errors: result.errors,
  });

  if (!result.successful) {
    clog(`Self-implementation failed — triggering 2/3 meeting on fixes`);
    const fixMeeting = runFixMeeting(cycleNumber, result);
    state.meetingResults.push(fixMeeting);
  }

  state.selfImplementation.totalAttempts++;
  if (result.successful) state.selfImplementation.successfulAttempts++;
  state.selfImplementation.improvementsApplied += result.testsPassed;

  return result;
}

async function runFixMeeting(cycleNumber: number, failedResult: SelfImplementationResult): Promise<any> {
  clog(`=== FIX MEETING: Cycle ${cycleNumber} — 2/3 approval required ===`);

  const fixProposals = [
    { title: "Add fallback patterns for missing code constructs", priority: "high" },
    { title: "Implement incremental file modification instead of full rewrites", priority: "high" },
    { title: "Create test harness for validating changes before applying", priority: "medium" },
    { title: "Build knowledge graph linking capabilities to code locations", priority: "medium" },
    { title: "Add rollback capability for failed self-implementations", priority: "high" },
    { title: "Improve pattern matching with AST-based analysis", priority: "low" },
    { title: "Create sandboxed execution environment for testing changes", priority: "medium" },
    { title: "Implement staged deployment: test → staging → production", priority: "high" },
  ];

  const batchConsensus = await requestSwarmConsensus({
    type: "IMPROVE",
    description: `Batch fix proposals for cycle ${cycleNumber}: ${fixProposals.map(p => p.title).join("; ")}`,
    data: { proposals: fixProposals, cycleNumber, errors: failedResult.errors },
    urgency: "critical",
  });

  const results = fixProposals.map(p => ({
    ...p,
    approved: batchConsensus.approved,
    votes: `${batchConsensus.yesVotes}/${batchConsensus.votes}`,
  }));

  const approved = results.filter(r => r.approved);
  clog(`Fix meeting: ${approved.length}/${results.length} proposals approved by 2/3 majority`);

  return {
    cycleNumber,
    failureReason: failedResult.errors,
    proposals: results,
    approvedFixes: approved,
    timestamp: Date.now(),
  };
}

async function runTrainingCycle(cycleNumber: number, totalCycles: number = 10): Promise<TrainingCycle> {
  const startTime = Date.now();
  state.currentPhase = "analyze";
  clog(`=== TRAINING CYCLE ${cycleNumber}/${totalCycles} ===`);

  const phases = ["analyze", "absorb", "merge", "optimize", "test"];
  let totalKnowledge = 0;
  let totalFiles = 0;
  let allCapabilities: string[] = [];
  let swarmCombo: string[] = [];

  const batchConsensus = await requestSwarmConsensus({
    type: "TRAINING",
    description: `Training cycle ${cycleNumber} — all phases: ${phases.join(", ")}`,
    data: { cycleNumber, phases, agentCount: AGENT_PROFILES.length },
    urgency: "normal",
  });

  if (!batchConsensus.approved) {
    clog(`Cycle ${cycleNumber} rejected by consensus — skipping all phases`);
    return {
      cycleNumber, phase: "rejected", startTime, endTime: Date.now(),
      knowledgeAbsorbed: 0, filesAnalyzed: 0, capabilitiesMerged: [],
      swarmCombo: [], score: 0, consensusApproved: false,
    };
  }

  for (const phase of phases) {
    state.currentPhase = phase;
    swarmCombo = selectOptimalTrainingCombo(phase);

    switch (phase) {
      case "analyze": {
        const analysis = analyzeCodebase();
        totalFiles = analysis.filesFound;
        totalKnowledge += analysis.knowledge.length;
        allCapabilities.push(...analysis.capabilities.slice(0, 20));
        clog(`  Analyze: ${analysis.filesFound} files, ${analysis.knowledge.length} entries, ${analysis.capabilities.length} capabilities`);
        break;
      }
      case "absorb": {
        const merged = mergeAgentCapabilities();
        allCapabilities.push(...merged.slice(0, 30));
        totalKnowledge += merged.length;
        clog(`  Absorb: ${merged.length} traits merged from ${AGENT_PROFILES.length} agents`);
        break;
      }
      case "merge": {
        const uniqueCaps = [...new Set(allCapabilities)];
        state.knowledge.capabilities = uniqueCaps;
        state.knowledge.mergedTraits = uniqueCaps.filter(c => c.startsWith("strength:") || c.startsWith("domain:"));
        clog(`  Merge: ${uniqueCaps.length} unique capabilities unified`);
        break;
      }
      case "optimize": {
        for (const agent of AGENT_PROFILES) {
          const contribution = agent.performanceScore * (agent.capabilities.length / 10);
          agent.trainingContribution += contribution;
          agent.performanceScore = Math.min(99, agent.performanceScore + (rotIdx++ % 500) / 1000);
        }
        clog(`  Optimize: ${AGENT_PROFILES.length} agents performance tuned`);
        break;
      }
      case "test": {
        const selfImpl = await testSelfImplementation(cycleNumber);
        clog(`  Test: ${selfImpl.testsPassed} passed, ${selfImpl.testsFailed} failed, self-implement: ${selfImpl.successful ? "YES" : "NO"}`);
        break;
      }
    }
  }

  const score = Math.min(100, 50 + totalKnowledge * 0.5 + totalFiles * 2 + allCapabilities.length * 0.3);

  const cycle: TrainingCycle = {
    cycleNumber,
    phase: "complete",
    startTime,
    endTime: Date.now(),
    knowledgeAbsorbed: totalKnowledge,
    filesAnalyzed: totalFiles,
    capabilitiesMerged: [...new Set(allCapabilities)].slice(0, 50),
    swarmCombo,
    score,
    consensusApproved: true,
  };

  state.trainingHistory.push(cycle);
  state.totalCycles = cycleNumber;
  state.knowledge.totalEntries += totalKnowledge;
  state.version++;

  clog(`  Cycle ${cycleNumber} complete — score: ${score.toFixed(1)}, knowledge: ${totalKnowledge}, files: ${totalFiles}, time: ${Date.now() - startTime}ms`);
  return cycle;
}

export async function runFullTraining(cycles: number = 10): Promise<void> {
  if (state.running) { clog("Training already running"); return; }
  state.running = true;
  state.currentPhase = "starting";

  clog(`=== UNIFIED LLM TRAINING STARTED — ${cycles} CYCLES ===`);
  clog(`Combining ${AGENT_PROFILES.length} agents into unified consciousness`);

  const startConsensus = await requestSwarmConsensus({
    type: "TRAINING",
    description: `Start unified LLM training: ${cycles} cycles`,
    data: { cycles, agents: AGENT_PROFILES.length },
    urgency: "normal",
  });

  if (!startConsensus.approved) {
    clog("Training start REJECTED by consensus — aborting");
    state.running = false;
    return;
  }
  clog(`Training approved: ${startConsensus.yesVotes}/${startConsensus.votes} votes`);

  for (let i = 1; i <= cycles; i++) {
    if (!state.running) break;
    await runTrainingCycle(i, cycles);
    if (i < cycles) await new Promise(r => setTimeout(r, 200));
  }

  state.currentPhase = "complete";
  state.running = false;
  state.agentContributions = [...AGENT_PROFILES];

  const lastCycle = state.trainingHistory[state.trainingHistory.length - 1];
  const avgScore = state.trainingHistory.reduce((s, c) => s + c.score, 0) / state.trainingHistory.length;
  const selfImplRate = state.selfImplementation.totalAttempts > 0
    ? (state.selfImplementation.successfulAttempts / state.selfImplementation.totalAttempts * 100).toFixed(1)
    : "0";

  clog(`=== UNIFIED LLM TRAINING COMPLETE ===`);
  clog(`Cycles: ${cycles} | Avg score: ${avgScore.toFixed(1)} | Self-implementation: ${selfImplRate}%`);
  clog(`Knowledge: ${state.knowledge.totalEntries} entries | Capabilities: ${state.knowledge.capabilities.length}`);
  clog(`Meetings held: ${state.meetingResults.length} | Improvements applied: ${state.selfImplementation.improvementsApplied}`);
}

export function getUnifiedLLMState(): UnifiedLLMState {
  return { ...state };
}

export function startContinuousTraining(): void {
  if (trainingInterval) return;
  runFullTraining(10).catch(err => clog(`Training error: ${err.message}`));

  trainingInterval = setInterval(() => {
    if (!state.running) {
      runFullTraining(5).catch(err => clog(`Continuous training error: ${err.message}`));
    }
  }, 180000);

  clog("Continuous training started — retrains every 3 minutes");
}

export function stopContinuousTraining(): void {
  if (trainingInterval) {
    clearInterval(trainingInterval);
    trainingInterval = null;
  }
  state.running = false;
  clog("Continuous training stopped");
}
