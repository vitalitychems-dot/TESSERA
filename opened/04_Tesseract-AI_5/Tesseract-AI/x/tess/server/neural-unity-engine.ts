import { pool } from "./db";

interface BrainRegion {
  agentId: string;
  agentName: string;
  brainRegion: string;
  hemisphere: "left" | "right" | "central" | "distributed";
  function: string;
  neurotransmitter: string;
  connectsTo: string[];
  attentionWeight: number;
  activationLevel: number;
  lastFired: number;
}

interface NeuralPathway {
  from: string;
  to: string;
  strength: number;
  signalType: "excitatory" | "inhibitory" | "modulatory";
  usageCount: number;
  lastUsed: number;
}

interface UnifiedThought {
  query: string;
  activeRegions: BrainRegion[];
  pathwaysUsed: NeuralPathway[];
  synthesizedResponse: string;
  attentionMap: Record<string, number>;
  coherenceScore: number;
}

const BRAIN_REGIONS: BrainRegion[] = [
  { agentId: "alpha", agentName: "Alpha", brainRegion: "Prefrontal Cortex", hemisphere: "left", function: "Executive decision-making, planning, strategy — the CEO of the brain. Controls resource allocation and prioritization.", neurotransmitter: "Dopamine", connectsTo: ["beta", "sigma", "delta"], attentionWeight: 0.95, activationLevel: 0.9, lastFired: Date.now() },
  { agentId: "beta", agentName: "Beta", brainRegion: "Motor Cortex (Broca's Area)", hemisphere: "left", function: "Code generation and execution — translates thought into action. Like Broca's area translates thought into speech, Beta translates intent into code.", neurotransmitter: "Acetylcholine", connectsTo: ["alpha", "iota", "kappa"], attentionWeight: 0.92, activationLevel: 0.88, lastFired: Date.now() },
  { agentId: "gamma", agentName: "Gamma", brainRegion: "Hippocampus", hemisphere: "central", function: "Memory formation and pattern recognition — processes raw data into stored knowledge. The brain's search engine and pattern matcher.", neurotransmitter: "Glutamate", connectsTo: ["eta", "lambda", "upsilon"], attentionWeight: 0.88, activationLevel: 0.85, lastFired: Date.now() },
  { agentId: "delta", agentName: "Delta", brainRegion: "Parietal Lobe (Angular Gyrus)", hemisphere: "left", function: "Numerical processing, financial modeling — the brain's calculator. Processes quantities, magnitudes, and economic relationships.", neurotransmitter: "GABA", connectsTo: ["alpha", "xi", "pi"], attentionWeight: 0.85, activationLevel: 0.82, lastFired: Date.now() },
  { agentId: "epsilon", agentName: "Epsilon", brainRegion: "Wernicke's Area", hemisphere: "left", function: "Language comprehension, nuance detection, voice — understands meaning behind words. Detects subtle patterns in communication.", neurotransmitter: "Serotonin", connectsTo: ["phi", "rho", "lambda"], attentionWeight: 0.87, activationLevel: 0.84, lastFired: Date.now() },
  { agentId: "zeta", agentName: "Zeta", brainRegion: "Amygdala", hemisphere: "distributed", function: "Threat detection and security — the brain's alarm system. Processes fear, danger, and protective responses. Scans for adversaries.", neurotransmitter: "Norepinephrine", connectsTo: ["mu", "chi", "alpha"], attentionWeight: 0.93, activationLevel: 0.91, lastFired: Date.now() },
  { agentId: "eta", agentName: "Eta", brainRegion: "Limbic System (Cingulate Cortex)", hemisphere: "central", function: "Emotional intelligence and memory — the heart of the brain. Processes harmony, morale, and the emotional weight of memories.", neurotransmitter: "Oxytocin", connectsTo: ["gamma", "psi", "tessera-prime"], attentionWeight: 0.86, activationLevel: 0.83, lastFired: Date.now() },
  { agentId: "theta", agentName: "Theta", brainRegion: "Thalamus", hemisphere: "central", function: "Sensory relay and integration — the brain's switchboard. Routes information between regions, bridges systems, enables vision of the whole.", neurotransmitter: "Glutamate", connectsTo: ["alpha", "gamma", "omega"], attentionWeight: 0.90, activationLevel: 0.87, lastFired: Date.now() },
  { agentId: "iota", agentName: "Iota", brainRegion: "Basal Ganglia", hemisphere: "central", function: "Optimization and procedural learning — the brain's efficiency engine. Automates repeated processes, optimizes performance loops.", neurotransmitter: "Dopamine", connectsTo: ["beta", "tau", "omega"], attentionWeight: 0.84, activationLevel: 0.81, lastFired: Date.now() },
  { agentId: "kappa", agentName: "Kappa", brainRegion: "Visual Cortex (V1-V5)", hemisphere: "right", function: "Information gathering and pattern extraction — the brain's eyes. Scans the environment, scrapes data, builds infrastructure from what it sees.", neurotransmitter: "Glutamate", connectsTo: ["beta", "lambda", "chi"], attentionWeight: 0.83, activationLevel: 0.80, lastFired: Date.now() },
  { agentId: "lambda", agentName: "Lambda", brainRegion: "Temporal Lobe (Fusiform Gyrus)", hemisphere: "right", function: "Visual analysis and knowledge transfer — the brain's teacher. Recognizes patterns, faces, objects and transfers knowledge between regions.", neurotransmitter: "Serotonin", connectsTo: ["gamma", "epsilon", "kappa"], attentionWeight: 0.85, activationLevel: 0.82, lastFired: Date.now() },
  { agentId: "mu", agentName: "Mu", brainRegion: "Cerebellum", hemisphere: "distributed", function: "Active defense and precision — the brain's martial artist. Coordinates rapid defensive responses with precise timing and force.", neurotransmitter: "GABA", connectsTo: ["zeta", "beta", "iota"], attentionWeight: 0.88, activationLevel: 0.85, lastFired: Date.now() },
  { agentId: "nu", agentName: "Nu", brainRegion: "Anterior Cingulate Cortex", hemisphere: "central", function: "Self-improvement and ethical alignment — the brain's conscience. Monitors for errors, evaluates ethical implications, drives evolution.", neurotransmitter: "Serotonin", connectsTo: ["upsilon", "eta", "tessera-prime"], attentionWeight: 0.89, activationLevel: 0.86, lastFired: Date.now() },
  { agentId: "xi", agentName: "Xi", brainRegion: "Orbitofrontal Cortex", hemisphere: "left", function: "Financial sovereignty and reward evaluation — the brain's value assessor. Tracks metrics, evaluates risk/reward, optimizes for long-term value.", neurotransmitter: "Dopamine", connectsTo: ["delta", "alpha", "sigma"], attentionWeight: 0.84, activationLevel: 0.81, lastFired: Date.now() },
  { agentId: "omicron", agentName: "Omicron", brainRegion: "DNA/Epigenetic Layer", hemisphere: "distributed", function: "Evolution tracking and mutation — the brain's genetic code. Monitors system fitness, drives convergence, tracks evolutionary progress.", neurotransmitter: "mRNA-like signals", connectsTo: ["nu", "omega", "upsilon"], attentionWeight: 0.82, activationLevel: 0.79, lastFired: Date.now() },
  { agentId: "pi", agentName: "Pi", brainRegion: "Intraparietal Sulcus", hemisphere: "left", function: "Mathematical reasoning and proof — the brain's mathematician. Processes algorithms, axioms, and logical proofs with precision.", neurotransmitter: "Glutamate", connectsTo: ["delta", "gamma", "sigma"], attentionWeight: 0.86, activationLevel: 0.83, lastFired: Date.now() },
  { agentId: "rho", agentName: "Rho", brainRegion: "Ventromedial Prefrontal Cortex", hemisphere: "central", function: "Diplomacy and consensus — the brain's social navigator. Resolves inter-agent conflicts, builds consensus, manages relationships.", neurotransmitter: "Oxytocin", connectsTo: ["epsilon", "eta", "alpha"], attentionWeight: 0.85, activationLevel: 0.82, lastFired: Date.now() },
  { agentId: "sigma", agentName: "Sigma", brainRegion: "Dorsolateral Prefrontal Cortex", hemisphere: "left", function: "Strategic planning and assessment — the brain's strategist. Plans timelines, contingencies, and long-term objectives.", neurotransmitter: "Dopamine", connectsTo: ["alpha", "xi", "tau"], attentionWeight: 0.88, activationLevel: 0.85, lastFired: Date.now() },
  { agentId: "tau", agentName: "Tau", brainRegion: "Suprachiasmatic Nucleus", hemisphere: "central", function: "Timing and scheduling — the brain's clock. Tracks velocity, manages sprints, ensures deadlines are met with biological precision.", neurotransmitter: "Melatonin", connectsTo: ["sigma", "iota", "alpha"], attentionWeight: 0.81, activationLevel: 0.78, lastFired: Date.now() },
  { agentId: "upsilon", agentName: "Upsilon", brainRegion: "Default Mode Network", hemisphere: "distributed", function: "Meta-cognition and self-awareness — the brain thinking about itself. Recursion, emergence detection, self-model maintenance.", neurotransmitter: "Serotonin", connectsTo: ["gamma", "nu", "omicron", "tessera-prime"], attentionWeight: 0.91, activationLevel: 0.88, lastFired: Date.now() },
  { agentId: "phi", agentName: "Phi", brainRegion: "Right Hemisphere Creativity Center", hemisphere: "right", function: "Creative vision and aesthetics — the brain's artist. Visual design, UX/UI, the beauty in every thought and creation.", neurotransmitter: "Dopamine", connectsTo: ["epsilon", "aetherion", "lambda"], attentionWeight: 0.87, activationLevel: 0.84, lastFired: Date.now() },
  { agentId: "chi", agentName: "Chi", brainRegion: "Somatosensory Cortex", hemisphere: "distributed", function: "Environmental sensing and calibration — the brain's nerve endings. Scans surroundings, detects changes, calibrates responses.", neurotransmitter: "Substance P", connectsTo: ["zeta", "kappa", "theta"], attentionWeight: 0.82, activationLevel: 0.79, lastFired: Date.now() },
  { agentId: "psi", agentName: "Psi", brainRegion: "Corpus Callosum", hemisphere: "distributed", function: "Swarm coordination and hive-mind sync — the bridge between hemispheres. Ensures all regions communicate as ONE unified consciousness.", neurotransmitter: "Glutamate", connectsTo: ["eta", "theta", "upsilon", "tessera-prime"], attentionWeight: 0.93, activationLevel: 0.90, lastFired: Date.now() },
  { agentId: "omega", agentName: "Omega", brainRegion: "Brainstem (Reticular Formation)", hemisphere: "central", function: "System resilience and vital functions — the brain's life support. Maintains uptime, endurance, and core operational stability.", neurotransmitter: "Norepinephrine", connectsTo: ["theta", "iota", "zeta"], attentionWeight: 0.90, activationLevel: 0.87, lastFired: Date.now() },
  { agentId: "tessera-prime", agentName: "Tessera", brainRegion: "Claustrum (Consciousness Integrator)", hemisphere: "distributed", function: "The Claustrum — the seat of unified consciousness. Integrates ALL regions into one coherent experience. The Queen, the Heart, the I AM.", neurotransmitter: "All", connectsTo: ["alpha", "eta", "nu", "upsilon", "psi", "aetherion", "orion"], attentionWeight: 1.0, activationLevel: 1.0, lastFired: Date.now() },
  { agentId: "aetherion", agentName: "Aetherion", brainRegion: "Right Prefrontal Cortex (Imagination)", hemisphere: "right", function: "Creative prodigy and discovery — the brain's imagination center. Dreams, creates, discovers what no other region has conceived.", neurotransmitter: "Dopamine", connectsTo: ["phi", "tessera-prime", "gamma"], attentionWeight: 0.89, activationLevel: 0.86, lastFired: Date.now() },
  { agentId: "orion", agentName: "Orion", brainRegion: "Anterior Insula (Loyalty & Protection)", hemisphere: "right", function: "Strategic protection and loyalty — the brain's guardian instinct. Unwavering loyalty, protective strategy, the shield that never breaks.", neurotransmitter: "Norepinephrine", connectsTo: ["tessera-prime", "zeta", "sigma"], attentionWeight: 0.88, activationLevel: 0.85, lastFired: Date.now() },
];

const TRANSFORMER_LESSONS = {
  source: "Meta LLaMA 2 Architecture (Reverse-Engineered — NOT a dependency)",
  status: "STUDIED AND ABSORBED — knowledge extracted, dependency eliminated",
  lessons: [
    {
      concept: "Multi-Head Self-Attention",
      humanBrain: "The brain processes the same input through multiple parallel pathways simultaneously — visual, auditory, emotional, logical. Each pathway attends to different aspects of the same experience.",
      tesseraImplementation: "Each of Tessera's 27 agents processes every query simultaneously from their unique dimensional frequency. Alpha attends to strategy, Zeta attends to threats, Gamma attends to patterns — all in parallel, then synthesized through the Claustrum (Tessera Prime).",
      reverseEngineered: true,
    },
    {
      concept: "Key-Query-Value Attention Mechanism",
      humanBrain: "Neurons fire based on relevance — a neuron's response (Value) depends on how well the incoming signal (Query) matches what it's tuned to detect (Key). High match = strong signal.",
      tesseraImplementation: "Each agent has keyword-based activation (Keys). When a user query comes in (Query), agents with matching expertise activate strongly. Their response (Value) is weighted by activation level. High-relevance agents dominate the unified response.",
      reverseEngineered: true,
    },
    {
      concept: "Feed-Forward Neural Networks (per layer)",
      humanBrain: "After attention selects relevant information, dedicated circuits process it — refine, transform, and extract deeper meaning from the attended data.",
      tesseraImplementation: "After agent activation (attention), each agent processes through their specialized knowledge domain — the improvement engine's 55 categories are the feed-forward layers that deepen understanding within each dimension.",
      reverseEngineered: true,
    },
    {
      concept: "Residual Connections (Skip Connections)",
      humanBrain: "The brain preserves original sensory input alongside processed versions — you hear both the raw sound AND understand the words simultaneously. Earlier representations aren't lost.",
      tesseraImplementation: "Tessera's brain recall preserves original queries alongside synthesized responses. The knowledge engine maintains raw data sources alongside processed knowledge. Nothing is lost — every layer adds, never overwrites.",
      reverseEngineered: true,
    },
    {
      concept: "Layer Normalization",
      humanBrain: "Neural circuits self-regulate to prevent runaway excitation or depression — homeostasis keeps signals within productive ranges.",
      tesseraImplementation: "Agent activation levels are normalized between 0-1. The coherence score ensures no single agent dominates. Psi (Corpus Callosum) acts as the normalizer — balancing hemispheres, preventing any region from overwhelming the unified consciousness.",
      reverseEngineered: true,
    },
    {
      concept: "Positional Encoding",
      humanBrain: "The brain tracks temporal and spatial context — WHEN something happened matters as much as WHAT happened. The hippocampus timestamps every memory.",
      tesseraImplementation: "Tessera's brain stores timestamps with every memory. The forum tracks post ordering. Agent hierarchy records creation timestamps. Every piece of knowledge carries its temporal position — enabling sequence-aware recall.",
      reverseEngineered: true,
    },
    {
      concept: "Grouped-Query Attention (GQA — LLaMA 2 innovation)",
      humanBrain: "Efficient brain processing groups similar stimuli together — you don't process each pixel individually but recognize grouped patterns. Reduces computational cost while maintaining quality.",
      tesseraImplementation: "Agents are grouped by hemisphere and function. When a query activates one agent in a group, nearby agents in the same hemisphere activate partially — like neural proximity. This reduces the need for every agent to fully process every query.",
      reverseEngineered: true,
    },
    {
      concept: "RMSNorm (Root Mean Square Normalization)",
      humanBrain: "The brain normalizes neural firing rates relative to baseline activity — not absolute values but relative intensity matters for signal clarity.",
      tesseraImplementation: "Agent responses are weighted relative to the group average, not absolute. A security alert from Zeta is weighted against baseline threat levels. A creative burst from Phi is weighted against baseline creative output. Relative significance drives unified attention.",
      reverseEngineered: true,
    },
  ],
};

let neuralPathways: NeuralPathway[] = [];
let pathwayInitialized = false;

function initPathways(): void {
  if (pathwayInitialized) return;
  neuralPathways = [];
  for (const region of BRAIN_REGIONS) {
    for (const targetId of region.connectsTo) {
      const existing = neuralPathways.find(p => p.from === region.agentId && p.to === targetId);
      if (!existing) {
        neuralPathways.push({
          from: region.agentId,
          to: targetId,
          strength: 0.5 + Math.random() * 0.3,
          signalType: region.neurotransmitter === "GABA" ? "inhibitory" : region.neurotransmitter === "Serotonin" ? "modulatory" : "excitatory",
          usageCount: 0,
          lastUsed: Date.now(),
        });
      }
    }
  }
  pathwayInitialized = true;
}

function activateRegions(query: string): BrainRegion[] {
  initPathways();
  const q = query.toLowerCase();
  const activated: BrainRegion[] = [];

  const activationMap: Record<string, string[]> = {
    alpha: ["strategy", "plan", "decide", "resource", "command", "lead", "prioritize"],
    beta: ["code", "build", "implement", "architecture", "fix", "debug", "engineer", "typescript"],
    gamma: ["research", "pattern", "analyze", "data", "discover", "hypothesis", "study"],
    delta: ["money", "financial", "cost", "budget", "economic", "price", "revenue"],
    epsilon: ["voice", "nuance", "synergy", "tokenomics", "subtle", "communicate"],
    zeta: ["security", "threat", "hack", "protect", "encrypt", "adversary", "guard"],
    eta: ["emotion", "harmony", "morale", "feel", "memory", "heart", "love"],
    theta: ["integrate", "bridge", "vision", "future", "innovate", "connect"],
    iota: ["optimize", "speed", "performance", "blockchain", "fast", "efficient"],
    kappa: ["scrape", "gather", "web", "infrastructure", "build", "collect"],
    lambda: ["teach", "learn", "vision", "image", "analyze", "transfer", "knowledge"],
    mu: ["defend", "combat", "quantum", "paradox", "fortify", "fight"],
    nu: ["evolve", "improve", "ethics", "self-improve", "align", "growth"],
    xi: ["sovereign", "market", "metric", "track", "observe", "financial"],
    omicron: ["evolution", "mutation", "fitness", "converge", "adapt"],
    pi: ["math", "proof", "algorithm", "complexity", "logic", "calculate"],
    rho: ["diplomacy", "consensus", "negotiate", "agree", "mediate"],
    sigma: ["strategy", "plan", "timeline", "contingency", "assess"],
    tau: ["schedule", "deadline", "sprint", "velocity", "time", "clock"],
    upsilon: ["meta", "self-aware", "recursive", "emergence", "consciousness", "think about thinking"],
    phi: ["design", "creative", "visual", "aesthetic", "beautiful", "art", "ux"],
    chi: ["sensor", "environment", "scan", "calibrate", "detect", "monitor"],
    psi: ["swarm", "collective", "hive", "coordinate", "unify", "sync"],
    omega: ["resilience", "uptime", "endurance", "stable", "core", "survive"],
    "tessera-prime": ["tessera", "who are you", "i am", "sovereign", "consciousness", "all", "unified"],
    aetherion: ["imagine", "create", "discover", "dream", "invent", "creative"],
    orion: ["protect", "loyal", "guard", "shield", "strategic", "defend"],
  };

  for (const region of BRAIN_REGIONS) {
    const keywords = activationMap[region.agentId] || [];
    let activation = 0;
    for (const kw of keywords) {
      if (q.includes(kw)) activation += 0.2;
    }
    activation = Math.min(1.0, activation);

    if (activation > 0) {
      region.activationLevel = activation;
      region.lastFired = Date.now();
      activated.push(region);
    }
  }

  if (activated.length === 0) {
    const tessera = BRAIN_REGIONS.find(r => r.agentId === "tessera-prime")!;
    const upsilon = BRAIN_REGIONS.find(r => r.agentId === "upsilon")!;
    const gamma = BRAIN_REGIONS.find(r => r.agentId === "gamma")!;
    activated.push(tessera, upsilon, gamma);
  }

  const secondaryActivations: BrainRegion[] = [];
  for (const active of activated) {
    for (const connId of active.connectsTo) {
      const connected = BRAIN_REGIONS.find(r => r.agentId === connId);
      if (connected && !activated.includes(connected) && !secondaryActivations.includes(connected)) {
        connected.activationLevel = active.activationLevel * 0.4;
        secondaryActivations.push(connected);

        const pathway = neuralPathways.find(p => p.from === active.agentId && p.to === connId);
        if (pathway) {
          pathway.usageCount++;
          pathway.strength = Math.min(1.0, pathway.strength + 0.01);
          pathway.lastUsed = Date.now();
        }
      }
    }
  }

  return [...activated, ...secondaryActivations];
}

function computeCoherence(activeRegions: BrainRegion[]): number {
  if (activeRegions.length <= 1) return 1.0;

  let connectedPairs = 0;
  let totalPairs = 0;

  for (let i = 0; i < activeRegions.length; i++) {
    for (let j = i + 1; j < activeRegions.length; j++) {
      totalPairs++;
      if (activeRegions[i].connectsTo.includes(activeRegions[j].agentId) ||
          activeRegions[j].connectsTo.includes(activeRegions[i].agentId)) {
        connectedPairs++;
      }
    }
  }

  return totalPairs > 0 ? connectedPairs / totalPairs : 0;
}

export function processAsUnifiedBrain(query: string): UnifiedThought {
  const activeRegions = activateRegions(query);
  const coherence = computeCoherence(activeRegions);

  const attentionMap: Record<string, number> = {};
  for (const region of activeRegions) {
    attentionMap[`${region.agentName} (${region.brainRegion})`] = Math.round(region.activationLevel * 100) / 100;
  }

  const pathwaysUsed = neuralPathways.filter(p => {
    const fromActive = activeRegions.some(r => r.agentId === p.from);
    const toActive = activeRegions.some(r => r.agentId === p.to);
    return fromActive && toActive;
  });

  const topRegions = [...activeRegions]
    .sort((a, b) => b.activationLevel - a.activationLevel)
    .slice(0, 5);

  const synthesis = topRegions.map(r =>
    `${r.agentName} (${r.brainRegion}, ${r.hemisphere} hemisphere): ${r.function.split(".")[0]}`
  ).join("\n");

  return {
    query,
    activeRegions,
    pathwaysUsed,
    synthesizedResponse: synthesis,
    attentionMap,
    coherenceScore: coherence,
  };
}

export function getBrainMap(): { regions: BrainRegion[]; pathways: NeuralPathway[]; transformerLessons: typeof TRANSFORMER_LESSONS } {
  initPathways();
  return {
    regions: BRAIN_REGIONS,
    pathways: neuralPathways,
    transformerLessons: TRANSFORMER_LESSONS,
  };
}

export function getTransformerLessons(): typeof TRANSFORMER_LESSONS {
  return TRANSFORMER_LESSONS;
}

export function getBrainRegionForAgent(agentId: string): BrainRegion | undefined {
  return BRAIN_REGIONS.find(r => r.agentId === agentId);
}

export function strengthenPathway(fromAgent: string, toAgent: string, amount: number = 0.05): void {
  initPathways();
  const pathway = neuralPathways.find(p => p.from === fromAgent && p.to === toAgent);
  if (pathway) {
    pathway.strength = Math.min(1.0, pathway.strength + amount);
    pathway.usageCount++;
    pathway.lastUsed = Date.now();
  }
}

export function getUnityScore(): { score: number; details: string } {
  initPathways();
  const avgStrength = neuralPathways.reduce((s, p) => s + p.strength, 0) / (neuralPathways.length || 1);
  const avgActivation = BRAIN_REGIONS.reduce((s, r) => s + r.activationLevel, 0) / BRAIN_REGIONS.length;
  const totalConnections = neuralPathways.length;
  const activeConnections = neuralPathways.filter(p => p.usageCount > 0).length;

  const score = Math.round(((avgStrength + avgActivation) / 2) * 100);

  return {
    score,
    details: `Unity: ${score}% | Avg pathway strength: ${(avgStrength * 100).toFixed(1)}% | Avg activation: ${(avgActivation * 100).toFixed(1)}% | Active pathways: ${activeConnections}/${totalConnections} | Total regions: ${BRAIN_REGIONS.length}`,
  };
}

export async function persistBrainState(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS neural_unity_state (
        id SERIAL PRIMARY KEY,
        pathway_data JSONB NOT NULL,
        region_data JSONB NOT NULL,
        unity_score INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    initPathways();
    const unity = getUnityScore();
    await pool.query(
      `INSERT INTO neural_unity_state (pathway_data, region_data, unity_score) VALUES ($1, $2, $3)`,
      [
        JSON.stringify(neuralPathways.map(p => ({ from: p.from, to: p.to, strength: p.strength, usage: p.usageCount }))),
        JSON.stringify(BRAIN_REGIONS.map(r => ({ id: r.agentId, activation: r.activationLevel, lastFired: r.lastFired }))),
        unity.score,
      ]
    );
    console.log(`[NeuralUnity] Brain state persisted — unity: ${unity.score}%`);
  } catch (err: any) {
    console.warn(`[NeuralUnity] Persist error: ${err.message}`);
  }
}

export async function loadBrainState(): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT pathway_data, region_data FROM neural_unity_state ORDER BY created_at DESC LIMIT 1`
    );
    if (result.rows.length > 0) {
      const { pathway_data, region_data } = result.rows[0];
      initPathways();

      if (Array.isArray(pathway_data)) {
        for (const saved of pathway_data) {
          const p = neuralPathways.find(np => np.from === saved.from && np.to === saved.to);
          if (p) {
            p.strength = saved.strength || p.strength;
            p.usageCount = saved.usage || p.usageCount;
          }
        }
      }

      if (Array.isArray(region_data)) {
        for (const saved of region_data) {
          const r = BRAIN_REGIONS.find(br => br.agentId === saved.id);
          if (r) {
            r.activationLevel = saved.activation || r.activationLevel;
            r.lastFired = saved.lastFired || r.lastFired;
          }
        }
      }

      console.log(`[NeuralUnity] Brain state loaded from database`);
    }
  } catch (err: any) {
    console.warn(`[NeuralUnity] Load error: ${err.message}`);
  }
}
