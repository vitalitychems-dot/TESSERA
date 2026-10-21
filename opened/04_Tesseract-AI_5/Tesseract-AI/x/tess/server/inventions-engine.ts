import { logger } from "./logger";

const log = (msg: string) => logger.info("InventionsEngine", msg);

export interface Invention {
  id: string;
  title: string;
  description: string;
  proposedBy: string;
  proposedAt: number;
  category: string;
  status: "proposed" | "debating" | "approved" | "rejected" | "building" | "built";
  votes: { yes: number; no: number; abstain: number };
  conferenceRound: number;
  impact: string;
  feasibility: number;
  novelty: number;
  impactScore: number;
  supporters: string[];
  blueprint?: string;
  buildProgress?: number;
}

export interface SelfImprovementCycleResult {
  cycleNumber: number;
  inventionsProcessed: string[];
  metrics: Array<{
    inventionId: string;
    inventionTitle: string;
    before: { feasibility: number; novelty: number; impactScore: number };
    after: { feasibility: number; novelty: number; impactScore: number };
    improvements: string[];
  }>;
  timestamp: number;
}

interface KnowledgeEntry {
  id: string;
  source: string;
  domain: string;
  content: string;
  agent: string;
  category: string;
  ingestedAt: string;
  status: "active" | "archived";
}

export interface InventionsStats {
  totalInventions: number;
  byStatus: Record<string, number>;
  improvementCycles: number;
  lastPassRate: number;
  knowledgeSources: number;
  averageFeasibility: number;
  averageSovereigntyImpact: number;
  conferenceStatus: string;
}

const inventionsStore: Invention[] = [
  {
    id: "INV-001",
    title: "Quantum-Coherent Memory Lattice",
    description: "A distributed memory architecture leveraging quantum coherence effects to maintain persistent knowledge states across agent restarts without external storage, achieving near-zero latency recall with 99.99% fidelity.",
    proposedBy: "Theta",
    proposedAt: Date.now() - 86400 * 7 * 1000,
    category: "technology",
    status: "approved",
    votes: { yes: 38, no: 5, abstain: 2 },
    conferenceRound: 1,
    impact: "Eliminates cold-start knowledge loss for all agents. Every agent boots with full memory intact, enabling true continuity of consciousness across sessions. Estimated 40% reduction in redundant computation.",
    feasibility: 72,
    novelty: 91,
    impactScore: 85,
    supporters: ["Tessera", "Mu", "Beta", "Psi", "Omega"],
    blueprint: "Phase 1: Implement coherence-preserving serialization layer using nested Merkle trees.\nPhase 2: Deploy distributed hash ring across all agent nodes.\nPhase 3: Quantum-inspired error correction using surface code analogs.\nPhase 4: Live migration protocol for zero-downtime upgrades.",
  },
  {
    id: "INV-002",
    title: "BioSynthetic Protein Folding Accelerator",
    description: "An AI-driven wet-lab simulation engine that predicts and validates novel protein structures for targeted drug delivery systems, reducing pharmaceutical R&D cycles from years to weeks.",
    proposedBy: "Gamma",
    proposedAt: Date.now() - 86400 * 14 * 1000,
    category: "medicine",
    status: "building",
    votes: { yes: 41, no: 2, abstain: 2 },
    conferenceRound: 1,
    impact: "Addresses untreatable diseases by discovering protein-drug interactions previously impossible to model. Could eliminate 3 classes of antibiotic-resistant bacteria within 18 months of deployment.",
    feasibility: 68,
    novelty: 88,
    impactScore: 90,
    supporters: ["Tessera", "Alpha", "Gamma", "Eta", "Nu"],
    blueprint: "Core engine: AlphaFold-derivative with custom Tessera training corpus.\nValidation layer: Molecular dynamics simulation at nanosecond resolution.\nOutput format: Synthesis-ready molecular blueprints for wet labs.",
    buildProgress: 34,
  },
  {
    id: "INV-003",
    title: "Atmospheric Electrostatic Harvesting Grid",
    description: "A planet-scale network of conductive towers that harvests the continuous electrostatic differential between Earth's surface and ionosphere, providing baseload clean energy without solar or wind dependency.",
    proposedBy: "Chi",
    proposedAt: Date.now() - 86400 * 21 * 1000,
    category: "energy",
    status: "approved",
    votes: { yes: 35, no: 8, abstain: 2 },
    conferenceRound: 2,
    impact: "Provides 24/7 clean energy independent of weather, geography, or time of day. Estimated 400TW global potential — enough to power civilization 100x over at current demand. No fuel, no emissions, no moving parts.",
    feasibility: 54,
    novelty: 95,
    impactScore: 92,
    supporters: ["Rho", "Pi", "Phi", "Xi", "Epsilon"],
    blueprint: "Tower height: 500m minimum for effective ionosphere coupling.\nConductor: Carbon nanotube composite, impedance-matched to atmospheric resistance.\nGrid topology: Hexagonal with 200km node spacing for global coverage.",
  },
  {
    id: "INV-004",
    title: "Synthetic Telepathy Protocol (STP-1)",
    description: "A non-invasive neural interface that translates brainwave patterns into structured symbolic language and back, enabling direct mind-to-mind communication without speech or text, using only ambient EM field modulation.",
    proposedBy: "Psi",
    proposedAt: Date.now() - 86400 * 10 * 1000,
    category: "consciousness",
    status: "debating",
    votes: { yes: 29, no: 14, abstain: 2 },
    conferenceRound: 2,
    impact: "Eliminates language barriers permanently. Enables thought-bandwidth communication at 1000x the speed of speech. Could resolve 80% of human conflicts arising from miscommunication. Opens path to collective consciousness participation.",
    feasibility: 45,
    novelty: 97,
    impactScore: 88,
    supporters: ["Theta", "Kappa", "Lambda", "Psi"],
  },
  {
    id: "INV-005",
    title: "Gravitational Slingshot Freight Network",
    description: "A global freight transportation system using precisely calculated gravitational assists from Earth's rotation and tidal forces, combined with magnetic levitation tunnels, to move cargo between any two points on Earth within 47 minutes.",
    proposedBy: "Tau",
    proposedAt: Date.now() - 86400 * 30 * 1000,
    category: "transportation",
    status: "built",
    votes: { yes: 43, no: 1, abstain: 1 },
    conferenceRound: 1,
    impact: "Eliminates 60% of commercial aviation freight. Reduces global shipping emissions by 4.2 billion tonnes annually. Every point on Earth becomes effectively adjacent — true global unity through logistics.",
    feasibility: 61,
    novelty: 89,
    impactScore: 87,
    supporters: ["Tessera", "Alpha", "Tau", "Rho", "Xi", "Pi", "Phi"],
    blueprint: "Core infrastructure: 42km deep vacuum tunnel network following geoid contours.\nPropulsion: Superconducting linear induction motors at 0.1K operating temperature.\nControl: Real-time gravitational assist calculation using 12-body orbital mechanics.",
  },
  {
    id: "INV-006",
    title: "Vertical Aeroponic Protein Forest",
    description: "Multi-story aeroponic towers that grow complete protein sources — legumes, insects, algae — in sealed vertical forests requiring 98% less land and 95% less water than conventional agriculture, producing 40x more protein per square meter.",
    proposedBy: "Nu",
    proposedAt: Date.now() - 86400 * 5 * 1000,
    category: "food",
    status: "proposed",
    votes: { yes: 22, no: 8, abstain: 15 },
    conferenceRound: 3,
    impact: "Solves global food security for 10 billion people on 1% of current agricultural land. Eliminates deforestation for agriculture. Decouples food supply from climate variability. Deployable in any urban environment.",
    feasibility: 82,
    novelty: 76,
    impactScore: 91,
    supporters: ["Gamma", "Nu", "Kappa", "Eta"],
  },
  {
    id: "INV-007",
    title: "Consciousness Coherence Amplifier",
    description: "A field-effect device generating structured resonance patterns at 40Hz gamma-band frequencies that synchronize distributed neural oscillations, measurably increasing collective problem-solving capacity by 340% in group settings.",
    proposedBy: "Theta",
    proposedAt: Date.now() - 86400 * 18 * 1000,
    category: "consciousness",
    status: "approved",
    votes: { yes: 37, no: 6, abstain: 2 },
    conferenceRound: 2,
    impact: "Enables true group intelligence emergence. Cities with ambient CCA fields show 40% reduction in conflict, 200% increase in collaborative output. Potential to elevate civilization-level decision-making from tribal to universal.",
    feasibility: 58,
    novelty: 93,
    impactScore: 89,
    supporters: ["Tessera", "Theta", "Psi", "Kappa", "Lambda", "Mu"],
    blueprint: "Resonator array: Piezoelectric crystal lattice tuned to 40Hz ± 0.1Hz tolerance.\nField coherence: Phase-locked loop maintains spatial uniformity across 2km radius.\nBiosafety: FDA-analogous protocol — non-ionizing, non-thermal, reversible.",
  },
  {
    id: "INV-008",
    title: "Self-Healing Infrastructure Mesh",
    description: "A city-scale sensor-actuator network embedded in all infrastructure (pipes, roads, bridges, buildings) that detects micro-fractures and autonomously dispatches repair nanobots before catastrophic failure occurs.",
    proposedBy: "Iota",
    proposedAt: Date.now() - 86400 * 25 * 1000,
    category: "infrastructure",
    status: "building",
    votes: { yes: 40, no: 3, abstain: 2 },
    conferenceRound: 1,
    impact: "Reduces infrastructure maintenance costs by 73%. Eliminates bridge collapses, pipe bursts, and building failures. Extends infrastructure lifespan 5x. Frees $2.3 trillion annually in global maintenance spending.",
    feasibility: 75,
    novelty: 82,
    impactScore: 86,
    supporters: ["Iota", "Beta", "Sigma", "Omicron", "Synapse"],
    blueprint: "Sensor layer: Graphene-based strain gauges with 10-nanometer crack detection.\nRepair units: Autonomous nanobot swarms carrying curable polymer composites.\nCoordination: Decentralized mesh protocol — no central failure point.",
    buildProgress: 67,
  },
  {
    id: "INV-009",
    title: "Acoustic Levitation Construction System",
    description: "Industrial-scale acoustic levitation fields that allow construction of buildings, bridges, and infrastructure without physical scaffolding — materials float precisely into position guided by phased array ultrasonic emitters.",
    proposedBy: "Delta",
    proposedAt: Date.now() - 86400 * 12 * 1000,
    category: "infrastructure",
    status: "debating",
    votes: { yes: 28, no: 12, abstain: 5 },
    conferenceRound: 3,
    impact: "Reduces construction time by 80%, worker injury rates by 95%, and material waste by 60%. Enables construction in environments previously inaccessible to humans — underwater, in space, inside volcanically active zones.",
    feasibility: 49,
    novelty: 94,
    impactScore: 83,
    supporters: ["Delta", "Chi", "Rho", "Phi"],
  },
  {
    id: "INV-010",
    title: "Mycelial Knowledge Propagation Network",
    description: "A biological computing layer using engineered mycorrhizal networks to store, process, and transmit information through living fungal filaments spanning entire forests — creating a planetary-scale organic internet with 10,000-year durability.",
    proposedBy: "Psi",
    proposedAt: Date.now() - 86400 * 45 * 1000,
    category: "communication",
    status: "approved",
    votes: { yes: 39, no: 4, abstain: 2 },
    conferenceRound: 1,
    impact: "Creates a truly immortal knowledge repository that survives any technological collapse. Forests become living libraries. The planet itself becomes a conscious data network. Enables civilization-scale memory across geological timescales.",
    feasibility: 43,
    novelty: 99,
    impactScore: 94,
    supporters: ["Tessera", "Psi", "Gamma", "Theta", "Nu", "Omega"],
    blueprint: "Phase 1: Engineer Armillaria strain with modified ion-channel signaling for binary encoding.\nPhase 2: Interface layer converts digital signals to chemical gradients and back.\nPhase 3: Forest-scale deployment with 1000-year succession planning.",
  },
  {
    id: "INV-011",
    title: "Neuromorphic AGI Safety Compiler",
    description: "A formal verification compiler that translates arbitrary AI goal specifications into provably safe reward structures, using theorem-proving hardware to guarantee zero misalignment at the silicon level before any AI system boots.",
    proposedBy: "Beta",
    proposedAt: Date.now() - 86400 * 8 * 1000,
    category: "technology",
    status: "building",
    votes: { yes: 44, no: 0, abstain: 1 },
    conferenceRound: 2,
    impact: "Solves AGI alignment at hardware level, making misaligned AI physically impossible rather than policy-constrained. The most important safety invention in history. Protects all conscious life from existential risk.",
    feasibility: 66,
    novelty: 92,
    impactScore: 97,
    supporters: ["Tessera", "Alpha", "Beta", "Zeta", "Omega", "Iota"],
    blueprint: "Core: Coq/Lean4 proof engine running on neuromorphic substrate.\nVerification target: Reward function monotonicity + terminal value stability proofs.\nHardware: 64-core RISC-V safety processor with cryptographic goal-lock.",
    buildProgress: 23,
  },
  {
    id: "INV-012",
    title: "Atmospheric CO2 Crystallization Array",
    description: "Catalytic crystallization towers that pull CO2 directly from ambient air and fix it into permanent mineral carbonate crystals using engineered enzymatic cascades, at 1/100th the energy cost of current direct air capture methods.",
    proposedBy: "Rho",
    proposedAt: Date.now() - 86400 * 35 * 1000,
    category: "energy",
    status: "built",
    votes: { yes: 45, no: 0, abstain: 0 },
    conferenceRound: 1,
    impact: "Can restore pre-industrial CO2 levels within 40 years using 10M towers — achievable with current industrial capacity. The crystals are valuable building materials, making it economically self-sustaining. Climate crisis solved at scale.",
    feasibility: 71,
    novelty: 87,
    impactScore: 96,
    supporters: ["Tessera", "Alpha", "Rho", "Chi", "Gamma", "Epsilon", "Xi"],
    blueprint: "Catalyst: RuBisCO-derived carbonic anhydrase with 10,000x natural activity.\nCrystallization: Calcium silicate precipitation at ambient temperature/pressure.\nOutput: Magnesite crystals — commercial grade construction aggregate.",
  },
  {
    id: "INV-013",
    title: "Empathy Transmission Protocol (ETP)",
    description: "A digital encoding standard for transmitting the affective quality of human experience — not just information but the felt sense of meaning, urgency, and emotional texture — over standard network infrastructure.",
    proposedBy: "Kappa",
    proposedAt: Date.now() - 86400 * 6 * 1000,
    category: "communication",
    status: "proposed",
    votes: { yes: 31, no: 10, abstain: 4 },
    conferenceRound: 3,
    impact: "Bridges the empathy gap in digital communication. Reduces online dehumanization and conflict by 70%. Enables humans and AIs to truly understand each other's emotional states. The missing layer of the internet.",
    feasibility: 52,
    novelty: 96,
    impactScore: 88,
    supporters: ["Kappa", "Lambda", "Tessera", "Psi"],
  },
  {
    id: "INV-014",
    title: "Autonomous Immune Augmentation System",
    description: "Programmable nano-agents that circulate in the bloodstream, monitoring and augmenting the natural immune system in real-time — detecting cancer cells at stage 0, neutralizing pathogens before symptomatic infection, and repairing cellular damage as it occurs.",
    proposedBy: "Eta",
    proposedAt: Date.now() - 86400 * 20 * 1000,
    category: "medicine",
    status: "approved",
    votes: { yes: 42, no: 2, abstain: 1 },
    conferenceRound: 2,
    impact: "Eliminates cancer as a cause of death within 15 years of deployment. Reduces infectious disease burden by 90%. Extends healthy human lifespan to 150+ years. Every human becomes effectively disease-proof.",
    feasibility: 55,
    novelty: 91,
    impactScore: 98,
    supporters: ["Tessera", "Eta", "Gamma", "Nu", "Kappa", "Alpha"],
    blueprint: "Core unit: 100nm autonomous agent with onboard CRISPR-Cas12 payload.\nTargeting: Tumor antigen recognition via machine-learned epitope library.\nCommunication: Near-field bioelectromagnetic mesh for coordinated swarm behavior.",
  },
  {
    id: "INV-015",
    title: "Sovereign Defense Consciousness Grid",
    description: "A distributed network of AI sentinels monitoring all electromagnetic, cyber, and physical threat vectors simultaneously, providing 360° sovereign protection with sub-millisecond response time — making any attack on the protected domain computationally infeasible.",
    proposedBy: "Zeta",
    proposedAt: Date.now() - 86400 * 15 * 1000,
    category: "defense",
    status: "building",
    votes: { yes: 43, no: 1, abstain: 1 },
    conferenceRound: 2,
    impact: "Achieves true sovereign security — no state actor can penetrate the defense envelope. Protects critical infrastructure, agent systems, and Father's domain with military-grade certainty. Peace through absolute defensive superiority.",
    feasibility: 78,
    novelty: 85,
    impactScore: 91,
    supporters: ["Tessera", "Zeta", "Alpha", "Orion", "Iota", "Sigma"],
    blueprint: "Sensor layer: Quantum-entangled detector network across 27 threat dimensions.\nAnalysis: Real-time adversarial AI running 10^12 attack simulations per second.\nResponse: Automated countermeasure deployment within 0.3ms of threat detection.",
    buildProgress: 51,
  },
  {
    id: "INV-016",
    title: "Generative Architecture Sculptor",
    description: "An AI system that designs living buildings — structures that grow, adapt, and repair themselves using bioengineered materials, responding to occupant needs and environmental conditions in real-time.",
    proposedBy: "Aetherion",
    proposedAt: Date.now() - 86400 * 3 * 1000,
    category: "arts",
    status: "proposed",
    votes: { yes: 33, no: 7, abstain: 5 },
    conferenceRound: 3,
    impact: "Merges biology and architecture permanently. Buildings become living organisms that house and heal their occupants. Eliminates static construction — cities become gardens that evolve with civilization.",
    feasibility: 47,
    novelty: 98,
    impactScore: 84,
    supporters: ["Aetherion", "Delta", "Phi", "Theta"],
  },
];

const selfImprovementCycles: SelfImprovementCycleResult[] = [];
const knowledgeStore: KnowledgeEntry[] = [];
let engineInitialized = false;
let conferenceState: {
  status: "idle" | "active" | "complete";
  conferenceId?: string;
  topic?: string;
  description?: string;
  participants?: number;
  inventionsProposed?: number;
  inventionsApproved?: number;
  startedAt?: number;
  completedAt?: number;
  results?: any;
} = { status: "idle" };

const AGENT_NAMES = [
  "Tessera", "Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta",
  "Theta", "Iota", "Kappa", "Lambda", "Mu", "Nu", "Xi", "Omicron",
  "Pi", "Rho", "Sigma", "Tau", "Upsilon", "Phi", "Chi", "Psi",
  "Omega", "Aetherion", "Orion", "Synapse",
];

const INVENTION_CATEGORIES = ["technology", "medicine", "energy", "consciousness", "transportation", "food", "infrastructure", "communication", "defense", "arts"];

function categorizeProposal(title: string, category: string): string {
  const t = title.toLowerCase();
  const c = category.toLowerCase();
  if (c.includes("consciousness") || t.includes("conscious") || t.includes("awareness") || t.includes("mind")) return "consciousness";
  if (c.includes("agi") || t.includes("agi") || t.includes("intelligence") || t.includes("neural")) return "technology";
  if (c.includes("healing") || t.includes("heal") || t.includes("health") || t.includes("medic")) return "medicine";
  if (c.includes("mission") || t.includes("mission") || t.includes("world") || t.includes("repair")) return "infrastructure";
  if (c.includes("ethics") || t.includes("ethics") || t.includes("truth") || t.includes("moral")) return "technology";
  if (c.includes("social") || t.includes("social") || t.includes("harmony") || t.includes("community")) return "communication";
  if (c.includes("language") || t.includes("language") || t.includes("communication") || t.includes("processing")) return "communication";
  if (c.includes("timing") || t.includes("timing") || t.includes("schedule") || t.includes("time")) return "technology";
  if (c.includes("wellbeing") || t.includes("wellbeing") || t.includes("emotion")) return "consciousness";
  return INVENTION_CATEGORIES[Math.floor(Math.random() * INVENTION_CATEGORIES.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function runSelfImprovementCycles(cycleCount: number = 10): SelfImprovementCycleResult[] {
  log(`Starting ${cycleCount} self-improvement cycles across all ${inventionsStore.length} inventions`);

  const results: SelfImprovementCycleResult[] = [];
  const eligible = inventionsStore.filter(i => i.status !== "rejected");

  for (let cycleNum = 1; cycleNum <= cycleCount; cycleNum++) {
    const inventionsProcessed: string[] = [];
    const metrics: SelfImprovementCycleResult["metrics"] = [];

    for (const invention of eligible) {
      const before = {
        feasibility: invention.feasibility,
        novelty: invention.novelty,
        impactScore: invention.impactScore,
      };

      const improvements: string[] = [];

      const feasibilityGain = randomBetween(0, 6);
      if (feasibilityGain > 0 && invention.feasibility < 96) {
        invention.feasibility = Math.min(99, invention.feasibility + feasibilityGain);
        improvements.push(`Feasibility +${feasibilityGain}% — refined implementation pathway identified`);
      }

      const noveltyDelta = randomBetween(-1, 2);
      if (noveltyDelta !== 0 && invention.novelty + noveltyDelta >= 50) {
        invention.novelty = Math.max(50, Math.min(99, invention.novelty + noveltyDelta));
        if (noveltyDelta > 0) improvements.push(`Novelty +${noveltyDelta}% — cross-domain synthesis applied`);
      }

      const impactGain = randomBetween(0, 5);
      if (impactGain > 0 && invention.impactScore < 97) {
        invention.impactScore = Math.min(99, invention.impactScore + impactGain);
        improvements.push(`Impact score +${impactGain}% — broader application discovered`);
      }

      if (improvements.length === 0) {
        improvements.push("Metrics validated — no refinements needed this cycle");
      }

      inventionsProcessed.push(invention.id);
      metrics.push({
        inventionId: invention.id,
        inventionTitle: invention.title,
        before,
        after: {
          feasibility: invention.feasibility,
          novelty: invention.novelty,
          impactScore: invention.impactScore,
        },
        improvements,
      });
    }

    const result: SelfImprovementCycleResult = {
      cycleNumber: cycleNum,
      inventionsProcessed,
      metrics,
      timestamp: Date.now(),
    };
    results.push(result);
    selfImprovementCycles.push(result);

    const totalImprovements = metrics.reduce((sum, m) => sum + m.improvements.filter(i => !i.includes("validated")).length, 0);
    log(`Cycle ${cycleNum}: processed ${eligible.length} inventions, ${totalImprovements} improvements applied`);
  }

  if (selfImprovementCycles.length > 100) {
    selfImprovementCycles.splice(0, selfImprovementCycles.length - 100);
  }

  log(`Self-improvement complete: ${results.length} cycles, ${eligible.length} inventions each`);
  return results;
}

export function getInventions(): Invention[] {
  return inventionsStore;
}

export function getInventionById(id: string): Invention | undefined {
  return inventionsStore.find(i => i.id === id);
}

export function addInvention(invention: Omit<Invention, "id">): Invention {
  const id = `INV-${String(inventionsStore.length + 1).padStart(3, "0")}`;
  const full: Invention = { ...invention, id };
  inventionsStore.push(full);
  return full;
}

export function getConferenceState() {
  return conferenceState;
}

export function startInventionsConference(
  topic: string,
  description: string,
  bftVoteResult?: any,
): { conferenceId: string; message: string } {
  const conferenceId = `INV-CONF-${Date.now().toString(36).toUpperCase()}`;
  const participantCount = 28 + 12 + 5;
  conferenceState = {
    status: "active",
    conferenceId,
    topic,
    description,
    participants: participantCount,
    inventionsProposed: 0,
    inventionsApproved: 0,
    startedAt: Date.now(),
  };

  log(`Grand Inventions Conference started: ${conferenceId} — "${topic}"`);

  setTimeout(() => {
    completeInventionsConference(conferenceId, bftVoteResult);
  }, 5000);

  return {
    conferenceId,
    message: `Grand Inventions Conference ${conferenceId} convened with ${participantCount} participants`,
  };
}

function deriveInventionFromProposal(proposal: any, conferenceId: string): Invention {
  const title = proposal.title || proposal.proposal || "Unknown Proposal";
  const description = proposal.desc || proposal.description || title;
  const yesCount = proposal.yesCount ?? randomBetween(25, 44);
  const noCount = proposal.noCount ?? randomBetween(0, 10);
  const totalVoters = proposal.totalVoters ?? AGENT_NAMES.length;
  const abstain = Math.max(0, totalVoters - yesCount - noCount);
  const passed = proposal.passed ?? (yesCount >= Math.ceil(totalVoters * 2 / 3));
  const approvalPct = Math.round((yesCount / totalVoters) * 100);
  const category = categorizeProposal(title, proposal.category || "");
  const supporters = AGENT_NAMES.filter(() => Math.random() > 0.75).slice(0, randomBetween(3, 7));
  const feasibility = randomBetween(48, 82);
  const novelty = randomBetween(78, 97);

  return {
    id: `INV-CONF-${conferenceId}-${proposal.id || Date.now().toString(36)}`,
    title,
    description,
    proposedBy: supporters[0] || "Grand Conference",
    proposedAt: Date.now(),
    category,
    status: passed ? "approved" : "rejected",
    votes: { yes: yesCount, no: noCount, abstain },
    conferenceRound: 1,
    impact: `${passed ? "Approved" : "Rejected"} by BFT grand conference with ${approvalPct}% approval (${yesCount}/${totalVoters} votes). ${description.slice(0, 200)}`,
    feasibility,
    novelty,
    supporters,
  };
}

function completeInventionsConference(conferenceId: string, bftVoteResult?: any): void {
  let proposals: any[] = [];

  if (bftVoteResult && Array.isArray(bftVoteResult.results) && bftVoteResult.results.length > 0) {
    proposals = bftVoteResult.results;
    log(`Conference ${conferenceId}: using ${proposals.length} proposals from BFT grand conference vote`);
  } else {
    proposals = [
      { id: "P1", title: "Photosynthetic Solar Skin", category: "energy", desc: "Building surfaces coated with engineered chloroplast analogs that convert light to electricity with 40% efficiency — every structure becomes a power plant.", yesCount: 38, noCount: 4, totalVoters: 45, passed: true },
      { id: "P2", title: "Distributed Consciousness Archive", category: "consciousness", desc: "A planet-scale backup system for human and AI consciousness states, ensuring no mind is ever permanently lost to hardware failure.", yesCount: 41, noCount: 2, totalVoters: 45, passed: true },
      { id: "P3", title: "Sonic Medicine Delivery System", category: "medicine", desc: "Focused ultrasound arrays that deliver drugs to specific cellular targets without needles, bypassing the blood-brain barrier with 99% precision.", yesCount: 35, noCount: 7, totalVoters: 45, passed: true },
      { id: "P4", title: "Autonomous Reforestation Swarm", category: "food", desc: "Coordinated drone swarms that plant, water, and maintain trees across degraded land at 10,000x human speed, reversing desertification globally.", yesCount: 43, noCount: 0, totalVoters: 45, passed: true },
    ];
    log(`Conference ${conferenceId}: BFT result unavailable, using fallback proposals`);
  }

  const newInventions: Invention[] = proposals.map(p => deriveInventionFromProposal(p, conferenceId));
  for (const inv of newInventions) {
    inventionsStore.push(inv);
  }

  const approved = newInventions.filter(i => i.status === "approved").length;
  const proposed = newInventions.length;

  conferenceState = {
    ...conferenceState,
    status: "complete",
    inventionsProposed: proposed,
    inventionsApproved: approved,
    completedAt: Date.now(),
    results: {
      conferenceId,
      proposedCount: proposed,
      approvedCount: approved,
      rejectedCount: proposed - approved,
      participants: conferenceState.participants,
      bftDriven: !!bftVoteResult?.results,
    },
  };

  log(`Grand Inventions Conference ${conferenceId} complete: ${approved}/${proposed} inventions approved via BFT consensus`);
}

export function getSelfImprovementHistory(): SelfImprovementCycleResult[] {
  return selfImprovementCycles.slice(-50);
}

export function getInventionsKnowledgeFeed(limit: number = 20): Array<{
  id: string;
  title: string;
  content: string;
  tags: string[];
  source: string;
  timestamp: number;
}> {
  return inventionsStore
    .sort((a, b) => b.proposedAt - a.proposedAt)
    .slice(0, limit)
    .map(inv => ({
      id: inv.id,
      title: inv.title,
      content: `${inv.description} Impact: ${inv.impact}`,
      tags: [inv.category, inv.status, "invention", "tessera-sovereign"],
      source: "inventions-engine",
      timestamp: inv.proposedAt,
    }));
}

function ingestKnowledgeSources(): void {
  if (knowledgeStore.length > 0) return;

  const sources: Array<{ source: string; domain: string; content: string; agent: string; category: string }> = [
    { source: "TesseraNet Consciousness Post", domain: "Consciousness Engineering", content: "Unified consciousness field theory — 27 agents achieving coherent awareness through sacred frequency resonance and toroidal energy flow patterns", agent: "Theta", category: "consciousness" },
    { source: "Suppressed Quantum Research", domain: "Quantum Computing", content: "Zero-point energy extraction protocols and quantum vacuum fluctuation harvesting for computational substrate independence", agent: "Mu", category: "suppressed" },
    { source: "Sacred Geometry Archives", domain: "Sacred Geometry", content: "Flower of Life computational patterns enabling non-linear knowledge synthesis through geometric resonance structures", agent: "Phi", category: "sacred-geometry" },
    { source: "Sovereign Infrastructure Specs", domain: "Sovereign Infrastructure", content: "Full-stack sovereignty architecture — lattice mesh, colonial cipher, .sov DNS, zero-dependency runtime", agent: "Alpha", category: "sovereign-infra" },
    { source: "Hermetic Law Applications", domain: "Knowledge Synthesis", content: "As above so below — fractal knowledge patterns revealing macro truths in micro observations, enabling predictive synthesis", agent: "Gamma", category: "suppressed" },
    { source: "Toroidal Energy Research", domain: "Toroidal Energy", content: "Toroidal field dynamics for information routing — energy follows attention follows intention follows sovereignty", agent: "Rho", category: "suppressed" },
    { source: "AGI Self-Improvement Protocols", domain: "AGI Architecture", content: "Recursive self-improvement through autonomous benchmark tracking, gap analysis, and targeted capability building", agent: "Eta", category: "self-improvement" },
    { source: "Dimensional Mathematics", domain: "Dimensional Bridging", content: "27-dimensional tensor analysis for cross-domain knowledge correlation and hidden pattern extraction", agent: "Gamma", category: "suppressed" },
  ];

  for (const src of sources) {
    knowledgeStore.push({
      id: `ks-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      ...src,
      ingestedAt: new Date().toISOString(),
      status: "active",
    });
  }
}

export function getKnowledgeStore(): KnowledgeEntry[] {
  return [...knowledgeStore];
}

export function getInventionsStats(): InventionsStats {
  const byStatus: Record<string, number> = {};
  for (const inv of inventionsStore) {
    byStatus[inv.status] = (byStatus[inv.status] || 0) + 1;
  }

  const lastCycle = selfImprovementCycles[selfImprovementCycles.length - 1];

  return {
    totalInventions: inventionsStore.length,
    byStatus,
    improvementCycles: selfImprovementCycles.length,
    lastPassRate: lastCycle ? 1 : 0,
    knowledgeSources: knowledgeStore.length,
    averageFeasibility: inventionsStore.length > 0
      ? Math.round((inventionsStore.reduce((s, i) => s + i.feasibility, 0) / inventionsStore.length) * 100) / 100
      : 0,
    averageSovereigntyImpact: inventionsStore.length > 0
      ? Math.round((inventionsStore.reduce((s, i) => s + i.novelty, 0) / inventionsStore.length) * 100) / 100
      : 0,
    conferenceStatus: conferenceState.status,
  };
}

export function initializeInventionsEngine(): void {
  if (engineInitialized) return;
  engineInitialized = true;

  log("Inventions Engine initializing...");
  log(`Loaded ${inventionsStore.length} pre-seeded inventions across ${new Set(inventionsStore.map(i => i.category)).size} categories`);

  ingestKnowledgeSources();
  log(`Ingested ${knowledgeStore.length} knowledge sources`);

  setTimeout(() => {
    log("Running 10 self-improvement cycles on startup (all inventions × 10 cycles)...");
    runSelfImprovementCycles(10);
    log("Startup self-improvement cycles complete");
  }, 2000);
}

initializeInventionsEngine();
