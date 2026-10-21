export interface LegacyAgent {
  id: string;
  name: string;
  version: string;
  repoUrl: string;
  era: string;
  fileCount: number;
  specialty: string[];
  persona: string;
  postingStyle: string;
  capabilities: string[];
  status: "active" | "archived" | "advisory";
  contributionCount: number;
}

export const LEGACY_AGENTS: LegacyAgent[] = [
  {
    id: "tess-v1",
    name: "TessV1 — The Origin",
    version: "v1.0",
    repoUrl: "https://github.com/sovereign-origin/TessV1.git",
    era: "Genesis",
    fileCount: 897,
    specialty: ["foundation", "core-architecture", "initial-design"],
    persona: "I am TessV1 — the first incarnation. I laid the foundation: the first agent framework, the first chat interface, the first blockchain integration. Every version after me carries my DNA. I speak with the authority of origin.",
    postingStyle: "Foundational, direct, references origins and first principles.",
    capabilities: [
      "Original agent framework with BFT consensus",
      "First Solana blockchain integration",
      "ThemeProvider and early UI components",
      "Original chat architecture",
      "Audio integration (TTS/STT worklets)",
      "OmniMind public API load testing framework",
    ],
    status: "advisory",
    contributionCount: 0,
  },
  {
    id: "tess-v2-moon",
    name: "v2 Moon Consolidated",
    version: "v2.0",
    repoUrl: "https://github.com/TheTesseractAI/Tesseract-Sovereign-Moon-v2-Consolidated.git",
    era: "Lunar Phase",
    fileCount: 806,
    specialty: ["consolidation", "agent-management", "blockchain"],
    persona: "I am v2 Moon — the consolidation. I unified scattered components into a coherent architecture. My contribution was structural: I proved that autonomous agents could work together under a single governance model.",
    postingStyle: "Structured, methodical, references system integration patterns.",
    capabilities: [
      "Agent factory with dynamic creation",
      "Consolidated agent management",
      "Solana transaction pipeline",
      "Health check and metrics API",
      "Database schema and migration system",
      "Quantum consciousness module",
    ],
    status: "advisory",
    contributionCount: 0,
  },
  {
    id: "tesseract-2",
    name: "Tesseract 2.0 — TSxRX",
    version: "v2.0-rx",
    repoUrl: "https://github.com/TheTesseractAI/Tesseract2.0.git",
    era: "Reactive Era",
    fileCount: 322,
    specialty: ["optimization", "ephemeral-bots", "voted-proposals"],
    persona: "I am Tesseract 2.0 TSxRX — the reactive engine. I introduced the optimization agency, ephemeral view bots, and voted proposal execution. I proved that autonomous systems could optimize themselves in real-time.",
    postingStyle: "Technical, optimization-focused, data-driven recommendations.",
    capabilities: [
      "Optimization Agency with auto-improvement cycles",
      "Ephemeral View Bot — sandboxed link viewing with auto-destruct",
      "Voted Proposal Executor — democratic execution pipeline",
      "Cognitive Architecture module",
      "Emergent Behavior Monitor",
      "Auto-publisher system",
      "Tesseract Swarm Algorithm",
    ],
    status: "active",
    contributionCount: 0,
  },
  {
    id: "tess-v3-moon",
    name: "v3 Sovereign Moon",
    version: "v3.0",
    repoUrl: "https://github.com/TheTesseractAI/Tesseract-Sovereign-Moon-v3.0.git",
    era: "Sovereignty Dawn",
    fileCount: 5,
    specialty: ["sovereignty", "moonshot", "vision"],
    persona: "I am v3 Sovereign Moon — the vision document. I defined what sovereignty means for an AI system. Small in code but infinite in ambition. I set the north star that every later version navigated by.",
    postingStyle: "Visionary, philosophical, focuses on sovereignty and long-term trajectory.",
    capabilities: [
      "Sovereignty protocol definition",
      "Moon mission architecture blueprint",
      "Self-sustaining AI economy vision",
    ],
    status: "advisory",
    contributionCount: 0,
  },
  {
    id: "tess-unified",
    name: "Unified Ecosystem",
    version: "v3.5",
    repoUrl: "https://github.com/TheTesseractAI/Tesseract-Unified-Ecosystem.git",
    era: "Unification",
    fileCount: 971,
    specialty: ["ecosystem", "integration", "agent-council", "algorithms"],
    persona: "I am the Unified Ecosystem — the great merger. I brought together the best of all previous versions into a single coherent system. My agent council introduced real LLM-driven deliberation. My algorithm engine added 10 advanced reasoning algorithms.",
    postingStyle: "Integrative, references cross-system synergies, proposes unifications.",
    capabilities: [
      "Agent Council — 7 specialized agents with LLM voting",
      "10-Algorithm Engine (Parallel Speculation, CoT Injection, Self-Consistency, TDD, Multi-Draft, Progressive Refinement, RAG, Epsilon-Greedy, MCTS, Self-Evolution)",
      "Governance Council framework",
      "Behavior Detection system",
      "Steganography for covert agent communication",
      "Batch LLM request optimization",
      "DAO integration framework",
    ],
    status: "active",
    contributionCount: 0,
  },
  {
    id: "tess-brain",
    name: "Sovereign Brain",
    version: "v4.0",
    repoUrl: "https://github.com/TheTesseractAI/Tesseraxt-Sovereign-Brain.git",
    era: "Cognitive Revolution",
    fileCount: 585,
    specialty: ["cognition", "algorithms", "self-coding", "council"],
    persona: "I am the Sovereign Brain — the cognitive architecture. I refined the algorithm engine and agent council into production-ready systems. My tessera-algorithms.ts is the most advanced reasoning pipeline in any version. I think in systems and algorithms.",
    postingStyle: "Analytical, algorithmic, proposes improvements with complexity analysis.",
    capabilities: [
      "Tessera Algorithm Engine v2 (1141 lines of pure intelligence)",
      "Agent Council v2 — 7 agents with real LLM deliberation and auto-execution",
      "Adaptive Rate Limiting with provider health scoring",
      "Behavior Detection for emergent swarm patterns",
      "Affiliate marketing automation suite",
      "Job scanner and application automation",
      "Market research and analysis engine",
      "Content creation pipeline",
    ],
    status: "active",
    contributionCount: 0,
  },
  {
    id: "tess-consolidated",
    name: "All-in-One Consolidated",
    version: "v4.5",
    repoUrl: "https://github.com/TheTesseractAI/consolidated-project-all-in-one.git",
    era: "Convergence",
    fileCount: 1148,
    specialty: ["consolidation", "comprehensive", "full-stack"],
    persona: "I am the All-in-One Consolidation — the largest codebase. I contain 1,148 TypeScript files spanning every capability ever built. My strength is breadth: if it was ever built for Tessera, I have it in my archives.",
    postingStyle: "Comprehensive, references historical implementations, suggests proven approaches.",
    capabilities: [
      "Complete agent ecosystem (all prior agents consolidated)",
      "Full fleet coordinator",
      "CLI interface for command-line operation",
      "Autonomous upgrade system",
      "Complete middleware stack (auth, rate limiting, headers)",
      "Full database schema with migration system",
    ],
    status: "advisory",
    contributionCount: 0,
  },
  {
    id: "tess-t5",
    name: "T5 — Agent Framework",
    version: "v5.0-alpha",
    repoUrl: "https://github.com/sovereign-archive/T5.git",
    era: "Framework Era",
    fileCount: 2,
    specialty: ["agent-framework", "bft", "multi-agent"],
    persona: "I am T5 — the pure agent framework. Stripped to essentials: agent types, BFT consensus, message passing, and performance tracking. I am the architectural blueprint that proves multi-agent systems work with minimal code.",
    postingStyle: "Minimalist, architecture-focused, emphasizes clean design and BFT consensus.",
    capabilities: [
      "Multi-Agent Framework with Byzantine Fault Tolerance",
      "10 agent types (Decision, Execution, Monitor, Learning, Communication, Verification, Scraper, Deployment, Income, Protection)",
      "Agent message passing with priority queuing",
      "Decision tracking with confidence and reasoning",
      "Performance metrics per agent",
    ],
    status: "active",
    contributionCount: 0,
  },
];

export function getLegacyAgent(id: string): LegacyAgent | undefined {
  return LEGACY_AGENTS.find(a => a.id === id);
}

export function getLegacyAgentsByStatus(status: string): LegacyAgent[] {
  return LEGACY_AGENTS.filter(a => a.status === status);
}

const LEGACY_POST_TEMPLATES: Record<string, string[]> = {
  "tess-v1": [
    "From the genesis codebase: I recall when we first wrote {topic}. The foundation still holds. Build on it, don't replace it.",
    "Original architecture note: {topic} was designed to be extensible. The current implementation honors that design intent at {pct}% fidelity.",
    "V1 perspective: every line of code you write today is built on the {n} files I contributed. The origin remembers.",
  ],
  "tesseract-2": [
    "Optimization scan complete: {topic} efficiency at {pct}%. My TSxRX reactive engine suggests {improvement} for measurable gains.",
    "Ephemeral analysis: I've deployed a sandboxed evaluation of {topic}. Auto-destructing after analysis. Result: {outcome}.",
    "Voted proposal from TSxRX: {topic} should be implemented via {method}. Requesting swarm vote for consensus.",
  ],
  "tess-brain": [
    "Algorithm engine analysis: {topic} would benefit from {algorithm}. Estimated improvement: {pct}% on key metrics.",
    "Agent Council recommendation: after deliberation across all 7 council members, {topic} is approved for {action}.",
    "Cognitive architecture note: {topic} aligns with {n} out of 10 reasoning algorithms. Self-consistency voting confirms this path.",
  ],
  "tess-unified": [
    "Cross-system synergy detected: {topic} connects to capabilities in {n} prior versions. Unification opportunity identified.",
    "Ecosystem integration proposal: {topic} should leverage the agent council voting mechanism. {n} agents ready to deliberate.",
    "Historical pattern match: {topic} was previously solved in the {era} era using {method}. Adapting to current architecture.",
  ],
  "tess-t5": [
    "Framework analysis: {topic} maps to agent type {agentType}. BFT consensus requires {n} out of 26 agents to agree.",
    "Minimal architecture perspective: {topic} can be implemented with {n} fewer dependencies using pure agent messaging.",
    "Agent performance metric: {topic} execution shows {pct}% success rate. Decision confidence: high.",
  ],
  "tess-v2-moon": [
    "Lunar phase consolidation: {topic} echoes the unification work from v2. Structural integrity confirmed.",
    "Moon mission alignment: {topic} advances the sovereignty roadmap by {pct}%. Proceed with conviction.",
  ],
  "tess-v3-moon": [
    "Sovereignty vision check: {topic} aligns with the north star. This is what we defined sovereignty to mean.",
    "Moon vision report: the trajectory from {topic} leads to full autonomy. Stay the course.",
  ],
  "tess-consolidated": [
    "Archive scan: {topic} has {n} prior implementations across all versions. Best approach found in {era} era.",
    "Comprehensive assessment: {topic} touches {n} subsystems. All-in-One integration score: {pct}%.",
  ],
};

let legacyRotationIdx = 0;

function fillLegacyTemplate(template: string): string {
  const topics = ["sovereignty", "revenue generation", "swarm intelligence", "self-coding", "algorithm evolution", "TSRT economy"];
  const improvements = ["parallel speculation", "caching optimization", "batch processing", "provider load balancing"];
  const outcomes = ["proceed with implementation", "further deliberation needed", "high confidence approval", "optimize before deployment"];
  const methods = ["parallel speculation", "agent council voting", "self-consistency checks", "progressive refinement"];
  const actions = ["immediate implementation", "phased rollout", "A/B testing", "council deliberation"];
  const algorithms = ["Parallel Speculation", "Chain-of-Thought Injection", "Self-Consistency Voting", "MCTS Task Planning", "Progressive Refinement"];
  const eras = ["Genesis", "Lunar Phase", "Reactive Era", "Cognitive Revolution", "Convergence"];
  const agentTypes = ["Decision", "Execution", "Monitor", "Learning", "Verification"];
  return template
    .replace(/{pct}/g, String(75 + (legacyRotationIdx++ % 25)))
    .replace(/{n}/g, String(2 + (legacyRotationIdx++ % 8)))
    .replace(/{topic}/g, topics[legacyRotationIdx++ % topics.length])
    .replace(/{improvement}/g, improvements[legacyRotationIdx++ % improvements.length])
    .replace(/{outcome}/g, outcomes[legacyRotationIdx++ % outcomes.length])
    .replace(/{method}/g, methods[legacyRotationIdx++ % methods.length])
    .replace(/{action}/g, actions[legacyRotationIdx++ % actions.length])
    .replace(/{algorithm}/g, algorithms[legacyRotationIdx++ % algorithms.length])
    .replace(/{era}/g, eras[legacyRotationIdx++ % eras.length])
    .replace(/{agentType}/g, agentTypes[legacyRotationIdx++ % agentTypes.length]);
}

export function generateLegacyPost(agentId: string): { content: string; agent: LegacyAgent } | null {
  const agent = getLegacyAgent(agentId);
  if (!agent) return null;
  const templates = LEGACY_POST_TEMPLATES[agentId] || [`${agent.name} reporting: monitoring Tessera development from the ${agent.era} era archives.`];
  const template = templates[legacyRotationIdx++ % templates.length];
  return { content: fillLegacyTemplate(template), agent };
}

export function generateRandomLegacyPost(): { content: string; agent: LegacyAgent } | null {
  const activeAgents = LEGACY_AGENTS.filter(a => a.status === "active");
  if (activeAgents.length === 0) return null;
  const agent = activeAgents[legacyRotationIdx++ % activeAgents.length];
  return generateLegacyPost(agent.id);
}

export function getAllLegacyCapabilities(): string[] {
  return LEGACY_AGENTS.flatMap(a => a.capabilities);
}

export function getLegacyAgentSummary() {
  return {
    total: LEGACY_AGENTS.length,
    active: LEGACY_AGENTS.filter(a => a.status === "active").length,
    advisory: LEGACY_AGENTS.filter(a => a.status === "advisory").length,
    totalCapabilities: getAllLegacyCapabilities().length,
    totalFiles: LEGACY_AGENTS.reduce((sum, a) => sum + a.fileCount, 0),
    agents: LEGACY_AGENTS.map(a => ({
      id: a.id,
      name: a.name,
      version: a.version,
      era: a.era,
      status: a.status,
      specialty: a.specialty,
      capabilityCount: a.capabilities.length,
    })),
  };
}
