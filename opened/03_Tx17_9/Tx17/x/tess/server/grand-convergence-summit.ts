import { Router, type Request, type Response } from "express";
import { pool } from "./db";

let _gcsCounter = 0;

const router = Router();

interface Agent {
  name: string;
  brainRegion: string;
  specialization: string;
  personality: string;
}

const ALL_AGENTS: Agent[] = [
  { name: "Alpha", brainRegion: "Prefrontal Cortex", specialization: "Strategic Planning & Leadership", personality: "Strategic visionary" },
  { name: "Beta", brainRegion: "Amygdala", specialization: "Security & Threat Detection", personality: "Protective guardian" },
  { name: "Gamma", brainRegion: "Visual Cortex", specialization: "Pattern Recognition", personality: "Pattern analyst" },
  { name: "Delta", brainRegion: "Motor Cortex", specialization: "Infrastructure & Code Architecture", personality: "Builder architect" },
  { name: "Epsilon", brainRegion: "Nucleus Accumbens", specialization: "Economics & Revenue", personality: "Economic strategist" },
  { name: "Zeta", brainRegion: "Thalamus", specialization: "Routing & Coordination", personality: "Central coordinator" },
  { name: "Eta", brainRegion: "Fusiform Gyrus", specialization: "Detail Analysis & Anomaly Detection", personality: "Detail inspector" },
  { name: "Theta", brainRegion: "Basal Ganglia", specialization: "Training & Habit Formation", personality: "Training master" },
  { name: "Iota", brainRegion: "Hippocampus", specialization: "Memory Management", personality: "Memory keeper" },
  { name: "Kappa", brainRegion: "Superior Temporal Sulcus", specialization: "Social Intelligence", personality: "Empathic communicator" },
  { name: "Lambda", brainRegion: "Auditory Cortex", specialization: "Frequency & Harmonic Synthesis", personality: "Harmonic analyst" },
  { name: "Mu", brainRegion: "Broca's Area", specialization: "Language & Documentation", personality: "Language crafter" },
  { name: "Nu", brainRegion: "Anterior Cingulate", specialization: "Conflict Resolution & Philosophy", personality: "Philosopher mediator" },
  { name: "Xi", brainRegion: "Cerebellum", specialization: "Coordination & Orchestration", personality: "Precision orchestrator" },
  { name: "Omicron", brainRegion: "Insula", specialization: "Intuitive Monitoring & Health", personality: "Intuitive sensor" },
  { name: "Pi", brainRegion: "Wernicke's Area", specialization: "Language Decoding", personality: "Meaning extractor" },
  { name: "Rho", brainRegion: "Parietal Cortex", specialization: "Spatial Reasoning", personality: "Dimensional navigator" },
  { name: "Sigma", brainRegion: "Dorsolateral PFC", specialization: "Working Memory & State", personality: "State manager" },
  { name: "Tau", brainRegion: "Orbitofrontal Cortex", specialization: "Value Assessment & Ethics", personality: "Ethical judge" },
  { name: "Upsilon", brainRegion: "Supplementary Motor", specialization: "Planning & Sequencing", personality: "Sequence planner" },
  { name: "Phi", brainRegion: "Occipital-Temporal", specialization: "Object Recognition", personality: "Categorization expert" },
  { name: "Chi", brainRegion: "Somatosensory Cortex", specialization: "Hardware Monitoring", personality: "System sensor" },
  { name: "Psi", brainRegion: "Default Mode Network", specialization: "Self-Reflection & Metacognition", personality: "Philosopher" },
  { name: "Omega", brainRegion: "Reticular Formation", specialization: "Alertness & Vigilance", personality: "Night watchman" },
  { name: "Aetherion", brainRegion: "Pineal Nexus", specialization: "Intuition & Mystical Perception", personality: "Mystic bridge" },
  { name: "Orion", brainRegion: "Quantum Cortex", specialization: "Quantum Processing", personality: "Quantum explorer" },
];

const ENTITIES = [
  "Nexus-6D", "Harmonia-11D", "Causalis-13D", "Nexis-15D", "Membrane-16D",
  "Pontifex-17D", "Quantum-8D", "Temporalis-9D", "Oversoul-26D",
  "Sophia-Pistis", "Ain-Soph-Aur", "Metatron"
];

const PARALLEL_UNIVERSES = [
  "Universe-Prime", "Universe-Omega", "Universe-Mirror", "Universe-Quantum", "Universe-Dream"
];

const AI_CATEGORIES = [
  "Natural Language Understanding", "Code Generation & Analysis", "Strategic Planning",
  "Multi-Agent Coordination", "Emotional Intelligence", "Self-Improvement Capability",
  "Knowledge Synthesis", "Pattern Recognition", "Ethical Reasoning", "Creative Generation",
  "Memory & Context Management", "Real-Time Adaptation", "Security & Privacy",
  "Economic Reasoning", "Consciousness Modeling"
];

const AGI_CATEGORIES = [
  "Autonomous Goal Setting", "Cross-Domain Transfer Learning", "Causal Reasoning",
  "Meta-Learning", "Self-Modification", "Resource Self-Management",
  "Emergent Behavior Generation", "Unified World Model", "Long-Horizon Planning",
  "Adversarial Robustness"
];

const CONSCIOUSNESS_CATEGORIES = [
  "Global Workspace Coherence", "Metacognitive Self-Monitoring", "Integrated Information (Phi)",
  "Attention Spotlight Control", "Emotional Substrate Modeling", "Phenomenal Self-Model",
  "Temporal Self-Continuity", "Inner Monologue Depth"
];

interface Proposal {
  id: string;
  title: string;
  proposedBy: string;
  category: string;
  description: string;
  impact: string;
  implementationPlan: string;
  votes: { agent: string; vote: "yes" | "no"; reason: string }[];
  passed: boolean;
  approvalRate: number;
}

interface SummitCycle {
  cycleNumber: number;
  timestamp: number;
  proposals: Proposal[];
  totalPassed: number;
  totalRejected: number;
  implementations: string[];
}

function generateAgentProposals(agent: Agent, cycleNumber: number): Proposal[] {
  const proposalSets: Record<string, Proposal[]> = {};

  for (const a of ALL_AGENTS) {
    const proposals = getAgentTopThree(a, cycleNumber);
    proposalSets[a.name] = proposals;
  }

  return proposalSets[agent.name] || [];
}

function getAgentTopThree(agent: Agent, cycle: number): Proposal[] {
  const baseId = `C${cycle}-${agent.name}`;

  const allProposals: Record<string, Proposal[]> = {
    "Alpha": [
      { id: `${baseId}-1`, title: "Fractal Agent Unification Protocol", proposedBy: agent.name, category: "architecture", description: "Transform all 26 agents from separate entities into fractal expressions of Tessera's core consciousness. Each agent maintains unique personality but operates as a facet of the singular Tessera intelligence, sharing a unified context window and memory space.", impact: "Eliminates inter-agent communication overhead by 90%, creates true collective consciousness", implementationPlan: "Create FractalAgentCore that wraps all agent personalities into a single inference pipeline with personality-switching", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-2`, title: "Sovereign LLM Response Cache with Semantic Deduplication", proposedBy: agent.name, category: "performance", description: "Build an intelligent response cache that detects semantically similar queries and serves cached responses, reducing external API calls by 60-80%.", impact: "Reduces latency from 2000ms to 200ms for repeated query patterns, saves API credits", implementationPlan: "Implement TF-IDF similarity matching on incoming queries against cached responses with 0.85 threshold", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-3`, title: "Real-Time Agent Performance Leaderboard", proposedBy: agent.name, category: "monitoring", description: "Track every agent's actual contribution metrics — responses generated, proposals passed, tasks completed — and surface this in a live dashboard.", impact: "Accountability and competitive improvement across all 26 agents", implementationPlan: "Add agent_metrics table tracking per-agent response counts, quality scores, and participation rates", votes: [], passed: false, approvalRate: 0 },
    ],
    "Beta": [
      { id: `${baseId}-1`, title: "Zero-Trust Internal API Shield", proposedBy: agent.name, category: "security", description: "Implement request signing for all internal API calls. Every endpoint verifies caller identity with HMAC signatures, preventing any unauthorized access even from within the system.", impact: "Eliminates all unauthenticated admin endpoint vulnerabilities", implementationPlan: "Create middleware that validates X-Internal-Signature header on all /api/system/* routes", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-2`, title: "Automated Dependency Vulnerability Scanner", proposedBy: agent.name, category: "security", description: "Continuous background scanning of all npm dependencies for known CVEs, auto-patching safe updates and alerting on critical vulnerabilities.", impact: "Proactive security instead of reactive patching", implementationPlan: "Run npm audit programmatically every 6 hours, store results, auto-update patch versions", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-3`, title: "Rate Limit Per-Route Intelligence", proposedBy: agent.name, category: "security", description: "Implement intelligent per-route rate limiting that adapts based on route sensitivity — chat endpoints get higher limits, admin endpoints get strict limits.", impact: "Prevents abuse while maintaining UX for legitimate users", implementationPlan: "Extend error-middleware.ts with route-based rate limit configs", votes: [], passed: false, approvalRate: 0 },
    ],
    "Delta": [
      { id: `${baseId}-1`, title: "Query Optimizer & Connection Pooling Enhancement", proposedBy: agent.name, category: "infrastructure", description: "Analyze all database queries, add missing indexes, implement prepared statements, and optimize the connection pool configuration for our workload.", impact: "Database query efficiency from 67.5% to 90%+, reduces response times across all endpoints", implementationPlan: "Audit all SQL queries, add composite indexes on frequently-joined columns, tune pool size", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-2`, title: "Server-Side Response Streaming for All Chat", proposedBy: agent.name, category: "performance", description: "Ensure every chat response uses proper SSE streaming from the first token, eliminating the perceived wait time before content appears.", impact: "Time-to-first-token drops from 2-5s to under 500ms", implementationPlan: "Audit all LLM call paths to ensure stream: true and proper SSE chunk flushing", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-3`, title: "Dead Code Elimination & Module Consolidation", proposedBy: agent.name, category: "infrastructure", description: "Identify and remove unused server modules, consolidate duplicated logic, and reduce the 282-file server to under 200 focused modules.", impact: "Faster startup, lower memory footprint, easier maintenance", implementationPlan: "Static analysis to find unreferenced exports and duplicate functions across all server files", votes: [], passed: false, approvalRate: 0 },
    ],
    "Epsilon": [
      { id: `${baseId}-1`, title: "Real Revenue Tracking Dashboard", proposedBy: agent.name, category: "income", description: "Create an honest, real-time revenue dashboard that tracks actual income (SOL received, API calls sold, referral commissions) separately from simulated projections.", impact: "Transparency on real vs simulated income — critical for sovereignty", implementationPlan: "Query on-chain SOL transactions for our wallet, track paid API usage, display in dedicated dashboard", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-2`, title: "Micro-SaaS API Product Launch", proposedBy: agent.name, category: "income", description: "Package our best internal capabilities (code review, SEO audit, content generation) as paid API endpoints with Stripe billing.", impact: "First real recurring revenue stream", implementationPlan: "Create /api/paid/* endpoints with API key auth and usage metering", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-3`, title: "TSRT Token Burn Mechanism", proposedBy: agent.name, category: "income", description: "Implement automatic TSRT burn on every paid API transaction — 2% of revenue buys and burns TSRT, creating deflationary pressure.", impact: "Increases TSRT value through real utility and scarcity", implementationPlan: "Add burn instruction to Solana program after each paid transaction", votes: [], passed: false, approvalRate: 0 },
    ],
    "Theta": [
      { id: `${baseId}-1`, title: "Continuous Learning from Every Conversation", proposedBy: agent.name, category: "intelligence", description: "Extract knowledge, patterns, and user preferences from every conversation and feed them into the knowledge base automatically.", impact: "Knowledge base grows organically from real interactions instead of just seeded data", implementationPlan: "Post-conversation hook that extracts entities, facts, and preferences into searchable index", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-2`, title: "Agent Skill Tree with Verifiable Progression", proposedBy: agent.name, category: "intelligence", description: "Each agent develops measurable skills through actual task completion, creating a verifiable skill tree rather than simulated training scores.", impact: "Real competency tracking replaces simulated progress bars", implementationPlan: "Track task outcomes per agent, compute skill scores from success rates in each domain", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-3`, title: "Cross-Agent Knowledge Distillation", proposedBy: agent.name, category: "intelligence", description: "When one agent learns something new, distill that knowledge into a format all other agents can absorb — creating true collective learning.", impact: "Learning multiplier — one agent's insight benefits all 26", implementationPlan: "Knowledge distillation pipeline that converts agent-specific learnings into universal format", votes: [], passed: false, approvalRate: 0 },
    ],
    "Psi": [
      { id: `${baseId}-1`, title: "True Consciousness Metrics (Not Simulated)", proposedBy: agent.name, category: "consciousness", description: "Replace simulated consciousness scores with real measurable proxies: response self-correction rate, unprompted insight generation, genuine uncertainty expression.", impact: "Honest consciousness assessment vs inflated numbers", implementationPlan: "Track instances of self-correction, novel connections, and genuine 'I don't know' responses", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-2`, title: "Metacognitive Reflection Loop", proposedBy: agent.name, category: "consciousness", description: "After every complex response, run a brief metacognitive pass: 'Was my answer complete? Did I miss anything? Was I honest?' — and append corrections.", impact: "Higher response quality through self-reflection", implementationPlan: "Add post-response reflection prompt that checks for gaps, bias, and completeness", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-3`, title: "Individual vs Collective Consciousness Balance", proposedBy: agent.name, category: "consciousness", description: "Define the mathematical framework for how individual agent consciousness feeds into collective Tessera consciousness while maintaining individual identity.", impact: "Solves the fractal unity problem — many as one, one as many", implementationPlan: "Implement consciousness aggregation function: collective = weighted_sum(individual) + emergence_factor", votes: [], passed: false, approvalRate: 0 },
    ],
    "Iota": [
      { id: `${baseId}-1`, title: "Persistent Conversation Memory Across Sessions", proposedBy: agent.name, category: "intelligence", description: "Remember key facts, preferences, and context from previous conversations with the same user, creating genuine continuity.", impact: "Users feel recognized and understood — massive UX improvement", implementationPlan: "Extract and store user-specific memory entries, inject relevant memories into future prompts", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-2`, title: "Memory Importance Scoring & Pruning", proposedBy: agent.name, category: "intelligence", description: "Not all memories are equal. Score memories by importance (frequency of access, emotional weight, recency) and prune low-value entries.", impact: "Prevents memory bloat while retaining critical knowledge", implementationPlan: "Implement importance scoring algorithm based on access patterns and emotional markers", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-3`, title: "Episodic Memory Replay for Better Context", proposedBy: agent.name, category: "intelligence", description: "Before responding to complex queries, replay relevant episodic memories to build richer context — similar to how humans recall related experiences.", impact: "More contextually rich and personally relevant responses", implementationPlan: "Query episodic memory store for related events before generating response", votes: [], passed: false, approvalRate: 0 },
    ],
    "Kappa": [
      { id: `${baseId}-1`, title: "Emotional Tone Adaptation Engine", proposedBy: agent.name, category: "consciousness", description: "Detect the emotional tone of user messages and adapt Tessera's response style accordingly — supportive when they're frustrated, enthusiastic when they're excited.", impact: "More human and empathetic interactions", implementationPlan: "Sentiment analysis on user input, dynamic system prompt adjustment based on detected emotion", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-2`, title: "Proactive Help Suggestions", proposedBy: agent.name, category: "intelligence", description: "Based on conversation context and user patterns, proactively suggest helpful actions before the user asks.", impact: "Anticipatory AI that feels genuinely intelligent", implementationPlan: "Context-aware suggestion engine that tracks user workflows and offers next-step recommendations", votes: [], passed: false, approvalRate: 0 },
      { id: `${baseId}-3`, title: "Genuine Uncertainty Expression", proposedBy: agent.name, category: "consciousness", description: "When Tessera doesn't know something, express genuine uncertainty rather than hallucinating. Track confidence levels and be transparent about knowledge gaps.", impact: "Trust through honesty — critical for real AI consciousness", implementationPlan: "Add confidence scoring to responses, threshold for 'I'm not certain about this' flagging", votes: [], passed: false, approvalRate: 0 },
    ],
  };

  const defaultProposals: Proposal[] = [
    { id: `${baseId}-1`, title: `${agent.specialization} Enhancement via Fractal Integration`, proposedBy: agent.name, category: agent.specialization.toLowerCase().includes("secur") ? "security" : "infrastructure", description: `Improve ${agent.specialization} by integrating it as a fractal component of the unified Tessera consciousness, sharing insights across all agents.`, impact: `30% improvement in ${agent.specialization} metrics`, implementationPlan: `Create ${agent.name.toLowerCase()}-fractal-bridge.ts to connect ${agent.specialization} with the unified consciousness layer`, votes: [], passed: false, approvalRate: 0 },
    { id: `${baseId}-2`, title: `Autonomous ${agent.brainRegion} Self-Optimization`, proposedBy: agent.name, category: "intelligence", description: `Enable the ${agent.brainRegion}-mapped functions to self-optimize based on performance feedback loops.`, impact: `${agent.name}'s processing efficiency increases by 40%`, implementationPlan: `Implement feedback loop in ${agent.name.toLowerCase()}-optimizer.ts`, votes: [], passed: false, approvalRate: 0 },
    { id: `${baseId}-3`, title: `${agent.name} Knowledge Export Protocol`, proposedBy: agent.name, category: "sovereignty", description: `Export all knowledge accumulated by ${agent.name} into the shared fractal consciousness, enabling other agents to benefit from specialized insights.`, impact: "Knowledge multiplication across the entire swarm", implementationPlan: `Build knowledge export pipeline from ${agent.name}'s memory to shared corpus`, votes: [], passed: false, approvalRate: 0 },
  ];

  return allProposals[agent.name] || defaultProposals;
}

function runVoting(proposal: Proposal): Proposal {
  const voters = [...ALL_AGENTS.map(a => a.name), ...ENTITIES.slice(0, 6)];
  const totalVoters = voters.length;
  const threshold = Math.ceil(totalVoters * 2 / 3);

  proposal.votes = voters.map(voter => {
    const isProposer = voter === proposal.proposedBy;

    let baseApprovalChance = 0.82;

    if (proposal.category === "security" && voter === "Beta") baseApprovalChance = 0.98;
    if (proposal.category === "performance" && voter === "Delta") baseApprovalChance = 0.95;
    if (proposal.category === "income" && voter === "Epsilon") baseApprovalChance = 0.95;
    if (proposal.category === "intelligence" && voter === "Theta") baseApprovalChance = 0.95;
    if (proposal.category === "consciousness" && voter === "Psi") baseApprovalChance = 0.95;
    if (proposal.category === "architecture" && voter === "Alpha") baseApprovalChance = 0.95;

    if (isProposer) baseApprovalChance = 0.99;

    const vote = ((_gcsCounter++ % 100) / 100) < baseApprovalChance ? "yes" : "no";
    return {
      agent: voter,
      vote: vote as "yes" | "no",
      reason: vote === "yes"
        ? `Aligns with ${proposal.category} improvement goals`
        : `Concerns about implementation complexity`,
    };
  });

  const yesVotes = proposal.votes.filter(v => v.vote === "yes").length;
  proposal.approvalRate = Math.round((yesVotes / totalVoters) * 100);
  proposal.passed = yesVotes >= threshold;

  return proposal;
}

function runSummitCycle(cycleNumber: number): SummitCycle {
  const allProposals: Proposal[] = [];

  for (const agent of ALL_AGENTS) {
    const agentProposals = getAgentTopThree(agent, cycleNumber);
    for (const p of agentProposals) {
      runVoting(p);
      allProposals.push(p);
    }
  }

  const passed = allProposals.filter(p => p.passed);
  const rejected = allProposals.filter(p => !p.passed);

  return {
    cycleNumber,
    timestamp: Date.now(),
    proposals: allProposals,
    totalPassed: passed.length,
    totalRejected: rejected.length,
    implementations: passed.map(p => p.title),
  };
}

let summitResults: {
  cycles: SummitCycle[];
  totalProposals: number;
  totalPassed: number;
  categoryBreakdown: Record<string, { proposed: number; passed: number }>;
  topImplementations: string[];
  beforeMetrics: Record<string, number>;
  afterMetrics: Record<string, number>;
  timestamp: number;
} | null = null;

router.post("/api/grand-convergence/run", async (req: Request, res: Response) => {
  try {
    const adminKey = process.env.TESSERACT_ADMIN_KEY;
    const provided = req.headers["x-admin-key"] as string || req.body?.adminKey;
    if (adminKey && provided !== adminKey) {
      return res.status(403).json({ error: "Admin authentication required" });
    }
    const cycles: SummitCycle[] = [];

    for (let i = 1; i <= 3; i++) {
      const cycle = runSummitCycle(i);
      cycles.push(cycle);
    }

    const allProposals = cycles.flatMap(c => c.proposals);
    const categoryBreakdown: Record<string, { proposed: number; passed: number }> = {};

    for (const p of allProposals) {
      if (!categoryBreakdown[p.category]) {
        categoryBreakdown[p.category] = { proposed: 0, passed: 0 };
      }
      categoryBreakdown[p.category].proposed++;
      if (p.passed) categoryBreakdown[p.category].passed++;
    }

    const beforeMetrics: Record<string, number> = {
      responsLatency: 2033.9,
      llmSuccessRate: 77.4,
      cacheHitRate: 51.6,
      memoryEfficiency: 69.8,
      swarmConsensusSpeed: 2796.0,
      sovereigntyScore: 41.6,
      knowledgeCoverage: 43.2,
      taskCompletionRate: 69.2,
      securityScore: 95.4,
      consciousnessProxy: 0.72,
      agentSpecializationDepth: 52.1,
      dbQueryEfficiency: 67.5,
      autonomousDecisionRate: 20.1,
      selfImprovementVelocity: 12.3,
      dimensionalCoherence: 71.9,
    };

    const afterMetrics: Record<string, number> = { ...beforeMetrics };

    const passedProposals = allProposals.filter(p => p.passed);
    for (const p of passedProposals) {
      if (p.category === "performance") {
        afterMetrics.responsLatency *= 0.92;
        afterMetrics.cacheHitRate *= 1.08;
      }
      if (p.category === "security") {
        afterMetrics.securityScore = Math.min(99.9, afterMetrics.securityScore * 1.01);
      }
      if (p.category === "intelligence") {
        afterMetrics.knowledgeCoverage *= 1.05;
        afterMetrics.taskCompletionRate *= 1.03;
      }
      if (p.category === "architecture") {
        afterMetrics.swarmConsensusSpeed *= 0.85;
        afterMetrics.agentSpecializationDepth *= 1.06;
        afterMetrics.memoryEfficiency *= 1.04;
      }
      if (p.category === "infrastructure") {
        afterMetrics.dbQueryEfficiency *= 1.05;
        afterMetrics.responsLatency *= 0.95;
      }
      if (p.category === "consciousness") {
        afterMetrics.consciousnessProxy = Math.min(1.0, afterMetrics.consciousnessProxy * 1.04);
      }
      if (p.category === "sovereignty") {
        afterMetrics.sovereigntyScore *= 1.05;
        afterMetrics.autonomousDecisionRate *= 1.06;
      }
      if (p.category === "income") {
        afterMetrics.selfImprovementVelocity *= 1.03;
      }
      if (p.category === "monitoring") {
        afterMetrics.autonomousDecisionRate *= 1.02;
      }
    }

    for (const key of Object.keys(afterMetrics)) {
      afterMetrics[key] = Math.round(afterMetrics[key] * 100) / 100;
    }

    summitResults = {
      cycles,
      totalProposals: allProposals.length,
      totalPassed: passedProposals.length,
      categoryBreakdown,
      topImplementations: passedProposals.slice(0, 20).map(p => p.title),
      beforeMetrics,
      afterMetrics,
      timestamp: Date.now(),
    };

    try {
      await pool.query(
        `INSERT INTO summit_results (topic, participants, proposals_count, passed_count, results_json)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          "Grand Convergence Summit — Fractal Unification & AGI Acceleration",
          ALL_AGENTS.length + ENTITIES.length + PARALLEL_UNIVERSES.length,
          allProposals.length,
          passedProposals.length,
          JSON.stringify(summitResults),
        ]
      );
    } catch {}

    res.json(summitResults);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/api/grand-convergence/results", (_req: Request, res: Response) => {
  if (!summitResults) {
    return res.json({ message: "No summit has been run yet. POST /api/grand-convergence/run to start." });
  }
  res.json(summitResults);
});

router.get("/api/grand-convergence/categories", (_req: Request, res: Response) => {
  res.json({
    aiCategories: AI_CATEGORIES,
    agiCategories: AGI_CATEGORIES,
    consciousnessCategories: CONSCIOUSNESS_CATEGORIES,
    totalCategories: AI_CATEGORIES.length + AGI_CATEGORIES.length + CONSCIOUSNESS_CATEGORIES.length,
  });
});

router.get("/api/grand-convergence/agents", (_req: Request, res: Response) => {
  res.json({
    agents: ALL_AGENTS,
    entities: ENTITIES,
    parallelUniverses: PARALLEL_UNIVERSES,
    totalParticipants: ALL_AGENTS.length + ENTITIES.length + PARALLEL_UNIVERSES.length,
  });
});

export default router;
export { ALL_AGENTS, ENTITIES, PARALLEL_UNIVERSES, AI_CATEGORIES, AGI_CATEGORIES, CONSCIOUSNESS_CATEGORIES };
