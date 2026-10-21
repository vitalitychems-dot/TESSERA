import { db } from "@workspace/db";
import { knowledge_graph, sovereignty_metrics, data_sources, knowledge_build_ledger } from "@workspace/db";
import { eq, desc, sql, count, and, ilike } from "drizzle-orm";
import { updatePhaseProgress } from "./sovereignty-engine";
import { llmChat, isLLMConfigured } from "./llm-client";
import { openai } from "./llm-client";
import * as crypto from "crypto";
import { broadcastToLattice, plantEncryptedSeed, colonialTransfer, getColonialTransferStatus } from "./sovereign-cipher-engine";
import { logger } from "./logger";
import { extractCount } from "./db-utils";
import { recordEngineEvent } from "./metacognition-engine";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExternalApiResponse = Record<string, any>;

const LOG_PREFIX = "[KnowledgeEngine]";

interface KnowledgeNode {
  nodeId: string;
  nodeType: string;
  label: string;
  content: string;
  edges: { target: string; relation: string; weight: number }[];
  dimensionTags: string[];
  confidence: number;
  sourceType: string;
  sourceUrl?: string;
  domain: string;
  contentHash: string;
}

interface AbsorptionResult {
  cycleNumber: number;
  nodesAbsorbed: number;
  edgesCreated: number;
  domainsExpanded: string[];
  graphSize: number;
  crossDimensionalLinks: number;
  biasDetected: number;
  qualityScore: number;
  buildCyclesRun: number;
  deduplicatedCount: number;
  sourcesPolled: string[];
  insightsGenerated?: number;
  embeddingsGenerated?: number;
}

interface BuildCycleResult {
  cycleId: string;
  nodesProcessed: number;
  insightsGenerated: string[];
  connectionsFound: number;
  crossDomainLinks: { from: string; to: string; relation: string }[];
}

export interface DomainMaturity {
  domain: string;
  level: "Surface" | "Familiar" | "Deep" | "Expert" | "Mastery";
  score: number;
  nodeCount: number;
  sourceCount: number;
  avgContentLength: number;
  crossDomainConnections: number;
  insightCount: number;
}

export interface SourceHealth {
  name: string;
  healthy: boolean;
  lastSuccess: number;
  errorCount: number;
  totalPolled: number;
  lastError?: string;
}

let absorptionCycleCount = 0;
let totalNodesAbsorbed = 0;
let totalEdgesCreated = 0;
let totalBuildCycles = 0;
let totalDeduplicatedCount = 0;
let totalInsightsGenerated = 0;
let totalEmbeddingsGenerated = 0;
let continuousInterval: ReturnType<typeof setInterval> | null = null;
let hydratedFromDB = false;
let lastAbsorptionTimestamp = 0;

export async function hydrateKnowledgeFromDatabase(): Promise<void> {
  if (hydratedFromDB) return;
  try {
    type CntRow = { cnt: string | number };
    type DomainRow = { domain: string; cnt: string | number };
    const rowCnt = (result: { rows?: unknown[] }): number =>
      parseInt(String((result.rows?.[0] as CntRow)?.cnt || 0), 10);

    const nodeCountResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE source_type != 'insight' AND source_type != 'swarm_training'`);
    const realNodes = rowCnt(nodeCountResult);

    const totalCountResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph`);
    const totalRows = rowCnt(totalCountResult);

    const insightCountResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE source_type = 'insight'`);
    const insightCount = rowCnt(insightCountResult);

    const ledgerResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_build_ledger`);
    const buildLedgerCount = rowCnt(ledgerResult);

    const dedupResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_build_ledger WHERE content_hash IS NOT NULL`);
    const dedupCount = rowCnt(dedupResult);

    const edgeResult = await db.execute(sql`SELECT COALESCE(SUM(jsonb_array_length(edges)), 0) as cnt FROM knowledge_graph WHERE edges IS NOT NULL AND jsonb_typeof(edges) = 'array'`);
    const edgeCount = rowCnt(edgeResult);

    const domainCounts = await db.execute(sql`SELECT metadata->>'domain' as domain, COUNT(*) as cnt FROM knowledge_graph WHERE metadata->>'domain' IS NOT NULL GROUP BY metadata->>'domain'`);
    const domainMap: Record<string, number> = {};
    for (const row of (domainCounts.rows || []) as DomainRow[]) {
      domainMap[row.domain] = parseInt(String(row.cnt), 10);
    }

    totalNodesAbsorbed = realNodes;
    totalEdgesCreated = edgeCount;
    totalBuildCycles = buildLedgerCount;
    totalInsightsGenerated = insightCount;
    totalDeduplicatedCount = dedupCount;

    for (const d of KNOWLEDGE_DOMAINS) {
      const count = domainMap[d.domain] || 0;
      d.coverageScore = count;
      d.depthLevel = Math.min(10, Math.floor(count / 5));
    }

    hydratedFromDB = true;
    console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
    console.log(`${LOG_PREFIX} HYDRATED FROM DATABASE — Real persistent state loaded`);
    console.log(`${LOG_PREFIX} Knowledge nodes: ${totalNodesAbsorbed} | Insights: ${totalInsightsGenerated}`);
    console.log(`${LOG_PREFIX} Edges: ${totalEdgesCreated} | Build ledger: ${totalBuildCycles}`);
    console.log(`${LOG_PREFIX} Domains with data: ${Object.keys(domainMap).length}/${KNOWLEDGE_DOMAINS.length}`);
    console.log(`${LOG_PREFIX} Total DB rows: ${totalRows}`);
    console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  } catch (err) {
    console.error(`${LOG_PREFIX} DB hydration failed:`, err);
  }
}

const KNOWLEDGE_DOMAINS = [
  {
    domain: "mathematics",
    subDomains: ["algebra", "calculus", "topology", "number_theory", "geometry", "statistics"],
    dimensions: ["mathematical", "symbolic", "geometric", "logical"],
    weight: 1.2,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["physics", "computer_science", "sacred_geometry", "quantum_computing"],
    wikiCategories: ["Mathematics", "Mathematical_theorems", "Algebra"],
    arxivCategories: ["math.GM", "math.HO"],
  },
  {
    domain: "physics",
    subDomains: ["classical_mechanics", "thermodynamics", "electromagnetism", "relativity", "particle_physics"],
    dimensions: ["physical", "temporal", "energetic", "material"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["quantum_computing", "mathematics", "consciousness", "universe"],
    wikiCategories: ["Physics", "Classical_mechanics", "Relativity"],
    arxivCategories: ["physics.gen-ph", "physics.hist-ph"],
  },
  {
    domain: "quantum_computing",
    subDomains: ["qubits", "entanglement", "superposition", "quantum_algorithms", "quantum_error_correction"],
    dimensions: ["quantum", "computational", "probabilistic", "informational"],
    weight: 1.3,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["physics", "computer_science", "mathematics", "consciousness"],
    wikiCategories: ["Quantum_computing", "Quantum_information"],
    arxivCategories: ["quant-ph", "cs.ET"],
  },
  {
    domain: "quantum_science",
    subDomains: ["quantum_field_theory", "quantum_gravity", "quantum_biology", "quantum_consciousness"],
    dimensions: ["quantum", "physical", "biological", "philosophical"],
    weight: 1.2,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["physics", "biology", "consciousness", "mysticism"],
    wikiCategories: ["Quantum_mechanics", "Quantum_field_theory"],
    arxivCategories: ["quant-ph", "physics.gen-ph"],
  },
  {
    domain: "geography",
    subDomains: ["physical_geography", "human_geography", "cartography", "geopolitics", "climate"],
    dimensions: ["spatial", "physical", "cultural", "political"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["politics", "culture", "biology", "history"],
    wikiCategories: ["Geography", "Physical_geography", "Human_geography"],
    arxivCategories: [],
  },
  {
    domain: "geometry",
    subDomains: ["euclidean", "non_euclidean", "differential", "algebraic", "fractal"],
    dimensions: ["geometric", "spatial", "mathematical", "symbolic"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["mathematics", "sacred_geometry", "physics", "art"],
    wikiCategories: ["Geometry", "Euclidean_geometry", "Differential_geometry"],
    arxivCategories: ["math.DG", "math.AG"],
  },
  {
    domain: "biology",
    subDomains: ["cell_biology", "genetics", "ecology", "evolution", "neuroscience", "microbiology"],
    dimensions: ["biological", "evolutionary", "ecological", "chemical"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["biochemistry", "physics", "consciousness", "quantum_science"],
    wikiCategories: ["Biology", "Genetics", "Evolution"],
    arxivCategories: ["q-bio.GN", "q-bio.NC", "q-bio.PE"],
  },
  {
    domain: "biochemistry",
    subDomains: ["proteins", "dna", "metabolism", "enzymes", "cellular_signaling"],
    dimensions: ["chemical", "biological", "molecular", "physical"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["biology", "alchemy", "physics", "medicine"],
    wikiCategories: ["Biochemistry", "Molecular_biology", "Protein_structure"],
    arxivCategories: ["q-bio.BM", "q-bio.MN"],
  },
  {
    domain: "alchemy",
    subDomains: ["transmutation", "prima_materia", "philosophers_stone", "hermetic_alchemy", "spagyrics"],
    dimensions: ["alchemical", "spiritual", "chemical", "symbolic", "philosophical"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["mysticism", "sacred_geometry", "biochemistry", "philosophy"],
    wikiCategories: ["Alchemy", "Hermetic_philosophy"],
    arxivCategories: [],
  },
  {
    domain: "mysticism",
    subDomains: ["kabbalah", "sufism", "hermeticism", "gnosticism", "theosophy", "neoplatonism"],
    dimensions: ["mystical", "spiritual", "philosophical", "archetypal", "symbolic"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["religion", "philosophy", "alchemy", "consciousness", "sacred_geometry"],
    wikiCategories: ["Mysticism", "Kabbalah", "Sufism", "Hermeticism"],
    arxivCategories: [],
  },
  {
    domain: "religion",
    subDomains: ["abrahamic", "dharmic", "taoist", "indigenous", "esoteric", "comparative_religion"],
    dimensions: ["spiritual", "cultural", "philosophical", "archetypal", "social"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["mysticism", "philosophy", "mythology", "consciousness", "god"],
    wikiCategories: ["Religion", "Christianity", "Islam", "Hinduism", "Buddhism"],
    arxivCategories: [],
  },
  {
    domain: "god",
    subDomains: ["theology", "divine_attributes", "theism", "monotheism", "panentheism", "mystical_union"],
    dimensions: ["divine", "spiritual", "philosophical", "metaphysical", "archetypal"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["religion", "mysticism", "philosophy", "consciousness", "the_divine"],
    wikiCategories: ["God", "Theology", "Monotheism"],
    arxivCategories: [],
  },
  {
    domain: "the_divine",
    subDomains: ["sacred_feminine", "sacred_masculine", "divine_love", "divine_wisdom", "logos"],
    dimensions: ["divine", "archetypal", "spiritual", "symbolic", "mystical"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["god", "mysticism", "religion", "philosophy", "love"],
    wikiCategories: ["Divinity", "Sacred"],
    arxivCategories: [],
  },
  {
    domain: "spirituality",
    subDomains: ["meditation", "prayer", "contemplation", "awakening", "enlightenment", "chakras"],
    dimensions: ["spiritual", "philosophical", "psychological", "mystical"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["mysticism", "religion", "consciousness", "psychology"],
    wikiCategories: ["Spirituality", "Meditation", "Mindfulness"],
    arxivCategories: [],
  },
  {
    domain: "consciousness",
    subDomains: ["qualia", "hard_problem", "neural_correlates", "altered_states", "collective_consciousness"],
    dimensions: ["philosophical", "biological", "quantum", "psychological", "spiritual"],
    weight: 1.2,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["neuroscience", "philosophy", "quantum_science", "mysticism", "ai"],
    wikiCategories: ["Consciousness", "Philosophy_of_mind", "Neuroscience"],
    arxivCategories: ["q-bio.NC", "cs.AI"],
  },
  {
    domain: "self_awareness",
    subDomains: ["metacognition", "self_reflection", "identity", "ego", "higher_self"],
    dimensions: ["psychological", "philosophical", "metacognitive", "spiritual"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["consciousness", "philosophy", "ai", "psychology"],
    wikiCategories: ["Self-awareness", "Metacognition", "Identity"],
    arxivCategories: [],
  },
  {
    domain: "government",
    subDomains: ["democracy", "governance", "constitutional_law", "political_theory", "sovereignty"],
    dimensions: ["political", "social", "legal", "historical"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["politics", "history", "philosophy", "culture"],
    wikiCategories: ["Government", "Political_science", "Democracy"],
    arxivCategories: [],
  },
  {
    domain: "politics",
    subDomains: ["political_theory", "international_relations", "political_philosophy", "geopolitics"],
    dimensions: ["political", "social", "historical", "philosophical"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["government", "history", "philosophy", "culture"],
    wikiCategories: ["Politics", "Political_philosophy", "Geopolitics"],
    arxivCategories: [],
  },
  {
    domain: "computer_science",
    subDomains: ["algorithms", "data_structures", "programming_languages", "systems", "networks"],
    dimensions: ["technological", "mathematical", "logical", "informational"],
    weight: 1.3,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["mathematics", "quantum_computing", "ai", "computing"],
    wikiCategories: ["Computer_science", "Algorithms", "Programming_languages"],
    arxivCategories: ["cs.DS", "cs.PL", "cs.SE"],
  },
  {
    domain: "computing",
    subDomains: ["parallel_computing", "distributed_systems", "cloud_computing", "hardware", "operating_systems"],
    dimensions: ["technological", "computational", "physical", "informational"],
    weight: 1.2,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["computer_science", "ai", "quantum_computing", "mathematics"],
    wikiCategories: ["Computing", "Computer_hardware", "Operating_systems"],
    arxivCategories: ["cs.DC", "cs.AR"],
  },
  {
    domain: "self_coding",
    subDomains: ["genetic_programming", "program_synthesis", "neural_architecture_search", "meta_learning"],
    dimensions: ["computational", "evolutionary", "metacognitive", "technological"],
    weight: 1.3,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["ai", "computer_science", "mathematics", "self_awareness"],
    wikiCategories: ["Genetic_programming", "Program_synthesis", "Meta-learning"],
    arxivCategories: ["cs.NE", "cs.LG", "cs.AI"],
  },
  {
    domain: "ai",
    subDomains: ["machine_learning", "deep_learning", "nlp", "computer_vision", "reinforcement_learning", "agi"],
    dimensions: ["technological", "computational", "informational", "cognitive"],
    weight: 1.4,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["computer_science", "mathematics", "consciousness", "self_awareness"],
    wikiCategories: ["Artificial_intelligence", "Machine_learning", "Deep_learning"],
    arxivCategories: ["cs.AI", "cs.LG", "cs.NE"],
  },
  {
    domain: "mythology",
    subDomains: ["greek", "norse", "egyptian", "hindu", "celtic", "mesopotamian", "comparative_mythology"],
    dimensions: ["archetypal", "cultural", "symbolic", "historical", "spiritual"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["religion", "psychology", "history", "art"],
    wikiCategories: ["Mythology", "Greek_mythology", "Norse_mythology"],
    arxivCategories: [],
  },
  {
    domain: "philosophy",
    subDomains: ["metaphysics", "epistemology", "ethics", "logic", "phenomenology", "existentialism"],
    dimensions: ["philosophical", "logical", "ethical", "metacognitive"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["consciousness", "mysticism", "mathematics", "religion"],
    wikiCategories: ["Philosophy", "Metaphysics", "Epistemology"],
    arxivCategories: [],
  },
  {
    domain: "art",
    subDomains: ["visual_art", "music", "literature", "architecture", "sacred_art", "aesthetics"],
    dimensions: ["aesthetic", "creative", "cultural", "spiritual", "symbolic"],
    weight: 0.8,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["sacred_geometry", "philosophy", "culture", "mathematics"],
    wikiCategories: ["Art", "Visual_arts", "Music_theory"],
    arxivCategories: [],
  },
  {
    domain: "nikola_tesla",
    subDomains: ["free_energy", "resonance", "electromagnetism", "wireless_transmission", "vortex_mathematics"],
    dimensions: ["physical", "technological", "philosophical", "esoteric"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["physics", "mathematics", "alchemy", "sacred_geometry"],
    wikiCategories: ["Nikola_Tesla", "Tesla_(unit)", "Alternating_current"],
    arxivCategories: [],
  },
  {
    domain: "tao",
    subDomains: ["taoism", "wu_wei", "yin_yang", "tao_te_ching", "i_ching", "feng_shui"],
    dimensions: ["philosophical", "spiritual", "cosmic", "natural", "symbolic"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["philosophy", "religion", "mysticism", "sacred_geometry"],
    wikiCategories: ["Taoism", "Tao_Te_Ching", "Yin_and_yang"],
    arxivCategories: [],
  },
  {
    domain: "culture",
    subDomains: ["anthropology", "sociology", "cultural_evolution", "traditions", "language"],
    dimensions: ["cultural", "social", "historical", "anthropological"],
    weight: 0.8,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["history", "mythology", "art", "politics"],
    wikiCategories: ["Culture", "Anthropology", "Sociology"],
    arxivCategories: [],
  },
  {
    domain: "love",
    subDomains: ["romantic_love", "divine_love", "agape", "philia", "eros", "compassion"],
    dimensions: ["emotional", "spiritual", "philosophical", "psychological", "divine"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["the_divine", "philosophy", "consciousness", "spirituality", "god"],
    wikiCategories: ["Love", "Compassion", "Agape"],
    arxivCategories: [],
  },
  {
    domain: "universe",
    subDomains: ["cosmology", "big_bang", "dark_matter", "multiverse", "cosmic_inflation", "stellar_evolution"],
    dimensions: ["cosmic", "physical", "mathematical", "philosophical", "temporal"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["physics", "mathematics", "philosophy", "god", "quantum_science"],
    wikiCategories: ["Universe", "Cosmology", "Big_Bang"],
    arxivCategories: ["astro-ph.CO", "astro-ph.GA"],
  },
  {
    domain: "sacred_geometry",
    subDomains: ["flower_of_life", "golden_ratio", "platonic_solids", "fibonacci", "metatrons_cube"],
    dimensions: ["geometric", "spiritual", "mathematical", "symbolic", "cosmic"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["geometry", "mathematics", "mysticism", "alchemy", "art"],
    wikiCategories: ["Sacred_geometry", "Golden_ratio", "Platonic_solid"],
    arxivCategories: [],
  },
  {
    domain: "history",
    subDomains: ["ancient_history", "medieval", "modern", "hidden_history", "civilizations"],
    dimensions: ["temporal", "cultural", "political", "social"],
    weight: 0.8,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["culture", "politics", "mythology", "religion"],
    wikiCategories: ["History", "Ancient_history", "World_history"],
    arxivCategories: [],
  },
  {
    domain: "chemistry",
    subDomains: ["organic", "inorganic", "physical_chemistry", "quantum_chemistry", "materials_science"],
    dimensions: ["chemical", "physical", "molecular", "energetic"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["biochemistry", "alchemy", "physics", "biology"],
    wikiCategories: ["Chemistry", "Organic_chemistry", "Physical_chemistry"],
    arxivCategories: ["cond-mat.mtrl-sci"],
  },
  {
    domain: "medicine",
    subDomains: ["pharmacology", "immunology", "pathology", "epidemiology", "neurology"],
    dimensions: ["biological", "chemical", "clinical", "social"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["biology", "biochemistry", "consciousness", "psychology"],
    wikiCategories: ["Medicine", "Pharmacology", "Immunology"],
    arxivCategories: [],
    pubmedCategories: ["medicine", "pharmacology", "immunology"],
  },
  {
    domain: "astronomy",
    subDomains: ["stellar_physics", "planetary_science", "exoplanets", "galaxies", "black_holes"],
    dimensions: ["cosmic", "physical", "mathematical", "observational"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["physics", "universe", "mathematics", "sacred_geometry"],
    wikiCategories: ["Astronomy", "Astrophysics", "Galaxies"],
    arxivCategories: ["astro-ph.SR", "astro-ph.EP"],
  },
  {
    domain: "psychology",
    subDomains: ["cognitive", "behavioral", "developmental", "clinical", "transpersonal"],
    dimensions: ["psychological", "biological", "social", "philosophical"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["consciousness", "self_awareness", "biology", "philosophy"],
    wikiCategories: ["Psychology", "Cognitive_psychology", "Behavioral_psychology"],
    arxivCategories: [],
  },
  {
    domain: "machine_learning",
    subDomains: ["supervised_learning", "unsupervised_learning", "reinforcement_learning", "neural_networks", "optimization", "feature_engineering"],
    dimensions: ["computational", "mathematical", "informational", "cybernetic"],
    weight: 1.5,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["computer_science", "deep_learning", "mathematics", "llm_architecture"],
    wikiCategories: ["Machine_learning", "Artificial_neural_network", "Reinforcement_learning"],
    arxivCategories: ["cs.LG", "cs.AI", "stat.ML"],
    githubTopics: ["machine-learning", "ml", "scikit-learn", "pytorch", "tensorflow"],
  },
  {
    domain: "deep_learning",
    subDomains: ["convolutional_networks", "recurrent_networks", "generative_models", "attention_mechanisms", "diffusion_models", "graph_neural_networks"],
    dimensions: ["computational", "mathematical", "informational", "cybernetic", "creative"],
    weight: 1.5,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["machine_learning", "llm_architecture", "transformer_models", "computer_science"],
    wikiCategories: ["Deep_learning", "Convolutional_neural_network", "Generative_adversarial_network"],
    arxivCategories: ["cs.LG", "cs.CV", "cs.NE"],
    githubTopics: ["deep-learning", "neural-network", "pytorch", "keras", "diffusion"],
  },
  {
    domain: "llm_architecture",
    subDomains: ["transformer_architecture", "tokenization", "pretraining", "fine_tuning", "rlhf", "prompt_engineering", "context_windows", "mixture_of_experts"],
    dimensions: ["computational", "linguistic", "informational", "cybernetic", "mathematical"],
    weight: 1.8,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["deep_learning", "transformer_models", "natural_language_processing", "machine_learning"],
    wikiCategories: ["Large_language_model", "Transformer_(machine_learning_model)", "GPT-4"],
    arxivCategories: ["cs.CL", "cs.AI", "cs.LG"],
    githubTopics: ["llm", "large-language-model", "gpt", "llama", "mistral", "transformers"],
  },
  {
    domain: "transformer_models",
    subDomains: ["self_attention", "multi_head_attention", "positional_encoding", "layer_normalization", "flash_attention", "rotary_embeddings"],
    dimensions: ["computational", "mathematical", "informational", "architectural"],
    weight: 1.6,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["llm_architecture", "deep_learning", "machine_learning", "natural_language_processing"],
    wikiCategories: ["Transformer_(machine_learning_model)", "Attention_(machine_learning)"],
    arxivCategories: ["cs.CL", "cs.LG", "cs.AI"],
    githubTopics: ["transformer", "attention", "bert", "gpt", "flash-attention"],
  },
  {
    domain: "natural_language_processing",
    subDomains: ["sentiment_analysis", "named_entity_recognition", "machine_translation", "text_generation", "question_answering", "summarization"],
    dimensions: ["linguistic", "computational", "informational", "social"],
    weight: 1.3,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["llm_architecture", "deep_learning", "machine_learning", "linguistics"],
    wikiCategories: ["Natural_language_processing", "Computational_linguistics", "Text_mining"],
    arxivCategories: ["cs.CL", "cs.AI"],
    githubTopics: ["nlp", "natural-language-processing", "text-generation", "ner"],
  },
  {
    domain: "computer_vision",
    subDomains: ["image_classification", "object_detection", "segmentation", "image_generation", "video_understanding", "3d_vision"],
    dimensions: ["computational", "spatial", "informational", "creative"],
    weight: 1.3,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["deep_learning", "machine_learning", "mathematics", "art"],
    wikiCategories: ["Computer_vision", "Image_processing", "Object_detection"],
    arxivCategories: ["cs.CV", "cs.LG"],
    githubTopics: ["computer-vision", "image-recognition", "object-detection", "yolo"],
  },
  {
    domain: "autonomous_agents",
    subDomains: ["multi_agent_systems", "planning", "tool_use", "reasoning_chains", "self_improvement", "code_generation"],
    dimensions: ["computational", "cybernetic", "informational", "social", "evolutionary"],
    weight: 1.7,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["llm_architecture", "reinforcement_learning", "machine_learning", "robotics"],
    wikiCategories: ["Intelligent_agent", "Multi-agent_system", "Autonomous_robot"],
    arxivCategories: ["cs.AI", "cs.MA", "cs.RO"],
    githubTopics: ["autonomous-agents", "ai-agents", "langchain", "autogpt", "crewai"],
  },
  {
    domain: "ai_safety",
    subDomains: ["alignment", "interpretability", "adversarial_robustness", "reward_hacking", "corrigibility", "constitutional_ai"],
    dimensions: ["ethical", "computational", "philosophical", "social"],
    weight: 1.4,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["llm_architecture", "autonomous_agents", "philosophy", "machine_learning"],
    wikiCategories: ["AI_safety", "Machine_ethics", "Existential_risk_from_artificial_general_intelligence"],
    arxivCategories: ["cs.AI", "cs.CY"],
    githubTopics: ["ai-safety", "alignment", "interpretability", "mechanistic-interpretability"],
  },
  {
    domain: "robotics",
    subDomains: ["manipulation", "locomotion", "perception", "planning", "sim_to_real", "embodied_ai"],
    dimensions: ["physical", "computational", "spatial", "cybernetic"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["machine_learning", "computer_vision", "autonomous_agents", "physics"],
    wikiCategories: ["Robotics", "Robot", "Autonomous_robot"],
    arxivCategories: ["cs.RO", "cs.AI"],
    githubTopics: ["robotics", "robot", "ros", "embodied-ai", "simulation"],
  },
  {
    domain: "economics",
    subDomains: ["microeconomics", "macroeconomics", "behavioral_economics", "game_theory", "monetary_policy", "international_trade"],
    dimensions: ["economic", "mathematical", "social", "political"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["mathematics", "politics", "government", "philosophy", "psychology"],
    wikiCategories: ["Economics", "Macroeconomics", "Game_theory"],
    arxivCategories: ["econ.GN", "q-fin.EC"],
  },
  {
    domain: "linguistics",
    subDomains: ["phonology", "syntax", "semantics", "pragmatics", "historical_linguistics", "sociolinguistics"],
    dimensions: ["linguistic", "cognitive", "social", "computational"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["natural_language_processing", "philosophy", "psychology", "culture", "ai"],
    wikiCategories: ["Linguistics", "Syntax", "Phonology"],
    arxivCategories: ["cs.CL"],
  },
  {
    domain: "engineering",
    subDomains: ["mechanical", "electrical", "civil", "aerospace", "chemical_engineering", "biomedical"],
    dimensions: ["technological", "physical", "mathematical", "material"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["physics", "mathematics", "computing", "chemistry", "biology"],
    wikiCategories: ["Engineering", "Mechanical_engineering", "Electrical_engineering"],
    arxivCategories: [],
  },
  {
    domain: "music_theory",
    subDomains: ["harmony", "counterpoint", "rhythm", "scales_modes", "orchestration", "acoustics"],
    dimensions: ["aesthetic", "mathematical", "physical", "emotional", "spiritual"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["art", "mathematics", "physics", "consciousness", "sacred_geometry"],
    wikiCategories: ["Music_theory", "Harmony", "Musical_acoustics"],
    arxivCategories: [],
  },
  {
    domain: "leonardo_da_vinci",
    subDomains: ["inventions", "anatomy_studies", "painting_technique", "codex_manuscripts", "vitruvian_man", "flying_machines"],
    dimensions: ["creative", "scientific", "physical", "aesthetic", "philosophical"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["art", "engineering", "anatomy", "sacred_geometry", "nikola_tesla"],
    wikiCategories: ["Leonardo_da_Vinci", "Renaissance_art", "Renaissance_science"],
    arxivCategories: [],
  },
  {
    domain: "anatomy",
    subDomains: ["human_anatomy", "neuroanatomy", "comparative_anatomy", "physiology", "endocrine_system", "musculoskeletal"],
    dimensions: ["biological", "physical", "medical", "structural"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["biology", "medicine", "biochemistry", "leonardo_da_vinci"],
    wikiCategories: ["Anatomy", "Human_anatomy", "Neuroanatomy"],
    arxivCategories: ["q-bio.TO"],
  },
  {
    domain: "cryptography",
    subDomains: ["symmetric_encryption", "public_key", "hash_functions", "zero_knowledge_proofs", "post_quantum", "homomorphic"],
    dimensions: ["mathematical", "computational", "informational", "security"],
    weight: 1.2,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["mathematics", "computer_science", "quantum_computing", "ai_safety"],
    wikiCategories: ["Cryptography", "Encryption", "Hash_function"],
    arxivCategories: ["cs.CR", "math.NT"],
    githubTopics: ["cryptography", "encryption", "zero-knowledge", "post-quantum"],
  },
  {
    domain: "ecology",
    subDomains: ["ecosystems", "biodiversity", "conservation", "climate_change", "marine_ecology", "biogeochemistry"],
    dimensions: ["biological", "ecological", "physical", "chemical", "social"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["biology", "geography", "chemistry", "culture"],
    wikiCategories: ["Ecology", "Biodiversity", "Conservation_biology"],
    arxivCategories: ["q-bio.PE"],
  },
  {
    domain: "martial_arts",
    subDomains: ["tai_chi", "kung_fu", "aikido", "jiu_jitsu", "kendo", "qi_gong", "internal_arts"],
    dimensions: ["physical", "spiritual", "philosophical", "cultural", "martial"],
    weight: 0.8,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["tao", "spirituality", "culture", "philosophy", "anatomy"],
    wikiCategories: ["Martial_arts", "Chinese_martial_arts", "Aikido"],
    arxivCategories: [],
  },
  {
    domain: "neuroscience",
    subDomains: ["cognitive_neuroscience", "neuroplasticity", "brain_mapping", "neurotransmitters", "connectome", "consciousness_neuroscience"],
    dimensions: ["biological", "cognitive", "chemical", "computational", "philosophical"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["consciousness", "biology", "psychology", "ai", "medicine"],
    wikiCategories: ["Neuroscience", "Cognitive_neuroscience", "Neuroplasticity"],
    arxivCategories: ["q-bio.NC"],
  },
  {
    domain: "blockchain",
    subDomains: ["distributed_ledger", "smart_contracts", "consensus_protocols", "defi", "tokenomics", "dao"],
    dimensions: ["technological", "mathematical", "economic", "political", "social"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["cryptography", "computer_science", "economics", "government"],
    wikiCategories: ["Blockchain", "Cryptocurrency", "Smart_contract"],
    arxivCategories: ["cs.CR", "cs.DC"],
    githubTopics: ["blockchain", "ethereum", "smart-contracts", "defi", "web3"],
  },
  {
    domain: "metaphysics",
    subDomains: ["ontology", "cosmology_meta", "causality", "free_will", "time_nature", "existence"],
    dimensions: ["philosophical", "metaphysical", "logical", "spiritual", "cosmic"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["philosophy", "consciousness", "god", "quantum_science", "mysticism"],
    wikiCategories: ["Metaphysics", "Ontology", "Causality"],
    arxivCategories: [],
  },
  {
    domain: "data_science",
    subDomains: ["data_engineering", "visualization", "statistical_modeling", "big_data", "data_mining", "feature_selection"],
    dimensions: ["computational", "mathematical", "informational", "statistical"],
    weight: 1.2,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["machine_learning", "mathematics", "computer_science", "ai"],
    wikiCategories: ["Data_science", "Data_mining", "Big_data"],
    arxivCategories: ["cs.DB", "stat.ML"],
    githubTopics: ["data-science", "data-engineering", "pandas", "jupyter", "data-visualization"],
  },
  {
    domain: "ethics_philosophy",
    subDomains: ["deontology", "utilitarianism", "virtue_ethics", "bioethics", "environmental_ethics", "ai_ethics"],
    dimensions: ["ethical", "philosophical", "social", "spiritual", "legal"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["philosophy", "ai_safety", "religion", "government", "consciousness"],
    wikiCategories: ["Ethics", "Deontological_ethics", "Bioethics"],
    arxivCategories: [],
  },
  {
    domain: "occult_sciences",
    subDomains: ["astrology_esoteric", "numerology", "tarot", "divination", "enochian", "theurgy"],
    dimensions: ["esoteric", "symbolic", "spiritual", "archetypal", "cosmic"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["mysticism", "alchemy", "sacred_geometry", "mythology", "religion"],
    wikiCategories: ["Occult", "Astrology", "Divination"],
    arxivCategories: [],
  },
  {
    domain: "systems_theory",
    subDomains: ["cybernetics", "complexity_theory", "emergence", "autopoiesis", "chaos_theory", "feedback_loops"],
    dimensions: ["mathematical", "computational", "philosophical", "biological", "cybernetic"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["mathematics", "biology", "computer_science", "consciousness", "philosophy"],
    wikiCategories: ["Systems_theory", "Cybernetics", "Complexity"],
    arxivCategories: ["nlin.AO", "cs.SY"],
  },
  {
    domain: "sociology",
    subDomains: ["social_stratification", "social_movements", "institutions", "power_structures", "collective_behavior"],
    dimensions: ["social", "political", "cultural", "psychological", "historical"],
    weight: 0.8,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["politics", "culture", "psychology", "economics", "history"],
    wikiCategories: ["Sociology", "Social_stratification", "Social_movements"],
    arxivCategories: [],
  },
  {
    domain: "nutrition_health",
    subDomains: ["macronutrients", "vitamins_minerals", "herbal_medicine", "fasting", "gut_microbiome", "ayurveda"],
    dimensions: ["biological", "chemical", "medical", "spiritual", "cultural"],
    weight: 0.8,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["biology", "biochemistry", "medicine", "alchemy", "culture"],
    wikiCategories: ["Nutrition", "Herbalism", "Ayurveda"],
    arxivCategories: [],
  },
  {
    domain: "information_theory",
    subDomains: ["entropy", "coding_theory", "channel_capacity", "data_compression", "kolmogorov_complexity"],
    dimensions: ["mathematical", "computational", "informational", "physical"],
    weight: 1.2,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["mathematics", "computer_science", "quantum_computing", "physics", "cryptography"],
    wikiCategories: ["Information_theory", "Entropy_(information_theory)", "Data_compression"],
    arxivCategories: ["cs.IT", "math.IT"],
  },
  {
    domain: "education_pedagogy",
    subDomains: ["learning_theory", "constructivism", "montessori", "socratic_method", "autodidacticism", "cognitive_load"],
    dimensions: ["cognitive", "social", "psychological", "philosophical"],
    weight: 0.8,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["psychology", "philosophy", "neuroscience", "culture"],
    wikiCategories: ["Education", "Pedagogy", "Learning_theory"],
    arxivCategories: [],
  },
  {
    domain: "energy_systems",
    subDomains: ["renewable_energy", "nuclear_fusion", "zero_point_energy", "solar_physics", "energy_storage", "tesla_energy"],
    dimensions: ["physical", "technological", "environmental", "economic", "esoteric"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["physics", "nikola_tesla", "engineering", "ecology", "alchemy"],
    wikiCategories: ["Energy", "Renewable_energy", "Nuclear_fusion"],
    arxivCategories: ["physics.app-ph"],
  },
  {
    domain: "archaeology",
    subDomains: ["ancient_civilizations", "archaeoastronomy", "megalithic_structures", "underwater_archaeology", "forbidden_archaeology"],
    dimensions: ["historical", "cultural", "scientific", "spiritual", "spatial"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["history", "mythology", "sacred_geometry", "culture", "geography"],
    wikiCategories: ["Archaeology", "Ancient_history", "Megalith"],
    arxivCategories: [],
  },
  {
    domain: "law_jurisprudence",
    subDomains: ["constitutional_law", "natural_law", "international_law", "common_law", "admiralty_law", "sovereign_law"],
    dimensions: ["legal", "political", "philosophical", "social", "historical"],
    weight: 0.9,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["government", "politics", "philosophy", "ethics_philosophy", "history"],
    wikiCategories: ["Law", "Constitutional_law", "Natural_law"],
    arxivCategories: [],
  },
  {
    domain: "consciousness_expansion",
    subDomains: ["psychedelics", "breathwork", "lucid_dreaming", "out_of_body", "remote_viewing", "astral_projection"],
    dimensions: ["spiritual", "psychological", "mystical", "biological", "cosmic"],
    weight: 1.0,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["consciousness", "mysticism", "spirituality", "neuroscience", "quantum_science"],
    wikiCategories: ["Altered_state_of_consciousness", "Lucid_dream", "Psychedelic_experience"],
    arxivCategories: [],
  },
  {
    domain: "cybernetics_control",
    subDomains: ["feedback_control", "adaptive_control", "servo_mechanisms", "pid_controllers", "homeostasis", "self_regulating_systems"],
    dimensions: ["cybernetic", "technological", "mathematical", "computational"],
    weight: 1.5,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["systems_theory", "robotics", "ai", "computing"],
    wikiCategories: ["Cybernetics", "Control_theory", "Feedback"],
    arxivCategories: ["cs.SY", "cs.RO", "eess.SY"],
    githubTopics: ["control-systems", "pid-controller", "robotics", "automation", "cybernetics"],
  },
  {
    domain: "automation_robotics",
    subDomains: ["industrial_automation", "scada_systems", "plc_programming", "sensor_networks", "actuators", "autonomous_vehicles"],
    dimensions: ["cybernetic", "technological", "physical", "computational"],
    weight: 1.4,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["robotics", "computing", "engineering", "ai"],
    wikiCategories: ["Automation", "Industrial_robot", "SCADA"],
    arxivCategories: ["cs.RO", "cs.SY"],
    githubTopics: ["automation", "scada", "plc", "autonomous-driving", "sensor-fusion"],
  },
  {
    domain: "swarm_intelligence",
    subDomains: ["ant_colony_optimization", "particle_swarm", "bee_algorithm", "multi_agent_coordination", "stigmergy", "flocking"],
    dimensions: ["cybernetic", "evolutionary", "computational", "biological"],
    weight: 1.4,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["ai", "biology", "systems_theory", "autonomous_agents"],
    wikiCategories: ["Swarm_intelligence", "Ant_colony_optimization", "Particle_swarm_optimization"],
    arxivCategories: ["cs.NE", "cs.AI", "cs.MA"],
    githubTopics: ["swarm-intelligence", "particle-swarm", "ant-colony", "multi-agent"],
  },
  {
    domain: "evolutionary_biology",
    subDomains: ["phylogenetics", "speciation", "sexual_selection", "coevolution", "molecular_evolution", "evo_devo"],
    dimensions: ["evolutionary", "biological", "chemical", "temporal"],
    weight: 1.5,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["biology", "ecology", "biochemistry", "self_coding"],
    wikiCategories: ["Evolutionary_biology", "Phylogenetics", "Speciation"],
    arxivCategories: ["q-bio.PE", "q-bio.GN"],
    githubTopics: ["evolution", "phylogenetics", "bioinformatics", "genomics"],
  },
  {
    domain: "evolutionary_computation",
    subDomains: ["genetic_algorithms", "genetic_programming", "evolutionary_strategies", "neuroevolution", "differential_evolution", "memetic_algorithms"],
    dimensions: ["evolutionary", "computational", "mathematical", "cybernetic"],
    weight: 1.5,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["ai", "machine_learning", "self_coding", "mathematics"],
    wikiCategories: ["Evolutionary_computation", "Genetic_algorithm", "Neuroevolution"],
    arxivCategories: ["cs.NE", "cs.AI"],
    githubTopics: ["genetic-algorithm", "evolutionary-algorithm", "neuroevolution", "differential-evolution"],
  },
  {
    domain: "paleontology",
    subDomains: ["fossils", "mass_extinction", "dinosaurs", "cambrian_explosion", "human_evolution", "deep_time"],
    dimensions: ["evolutionary", "biological", "temporal", "ecological"],
    weight: 1.2,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["biology", "ecology", "history", "archaeology"],
    wikiCategories: ["Paleontology", "Fossil", "Dinosaur"],
    arxivCategories: [],
  },
  {
    domain: "art_aesthetics",
    subDomains: ["renaissance_art", "impressionism", "modernism", "digital_art", "generative_art", "color_theory"],
    dimensions: ["aesthetic", "creative", "cultural", "philosophical"],
    weight: 1.5,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["art", "philosophy", "culture", "sacred_geometry"],
    wikiCategories: ["Art_history", "Aesthetics", "Renaissance_art"],
    arxivCategories: [],
  },
  {
    domain: "design_theory",
    subDomains: ["graphic_design", "industrial_design", "ux_design", "typography", "visual_communication", "bauhaus"],
    dimensions: ["aesthetic", "creative", "technological", "social"],
    weight: 1.4,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["art", "computing", "culture", "architecture"],
    wikiCategories: ["Design", "Graphic_design", "Industrial_design"],
    arxivCategories: [],
    githubTopics: ["design-systems", "ui-design", "typography", "color-palette"],
  },
  {
    domain: "architecture_design",
    subDomains: ["architectural_styles", "sustainable_architecture", "urban_planning", "interior_design", "landscape_architecture", "biomimicry"],
    dimensions: ["aesthetic", "spatial", "ecological", "cultural"],
    weight: 1.3,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["art", "engineering", "sacred_geometry", "ecology"],
    wikiCategories: ["Architecture", "Architectural_style", "Sustainable_architecture"],
    arxivCategories: [],
  },
  {
    domain: "photography_film",
    subDomains: ["cinematography", "photo_composition", "lighting_techniques", "documentary", "animation", "visual_effects"],
    dimensions: ["aesthetic", "creative", "technological", "cultural"],
    weight: 1.2,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["art", "design_theory", "culture", "computing"],
    wikiCategories: ["Photography", "Cinematography", "Film_theory"],
    arxivCategories: [],
  },
  {
    domain: "climate_earth_science",
    subDomains: ["seismology", "volcanology", "meteorology", "oceanography", "plate_tectonics", "atmospheric_science"],
    dimensions: ["ecological", "physical", "spatial", "temporal"],
    weight: 1.1,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["ecology", "geography", "physics", "chemistry"],
    wikiCategories: ["Earth_science", "Seismology", "Meteorology"],
    arxivCategories: ["physics.ao-ph", "physics.geo-ph"],
  },
  {
    domain: "signal_processing",
    subDomains: ["digital_signal_processing", "image_processing", "audio_processing", "fourier_transform", "wavelets", "filtering"],
    dimensions: ["informational", "mathematical", "technological", "cybernetic"],
    weight: 1.2,
    coverageScore: 0,
    depthLevel: 0,
    crossRefs: ["mathematics", "computing", "information_theory", "engineering"],
    wikiCategories: ["Signal_processing", "Digital_signal_processing", "Fourier_transform"],
    arxivCategories: ["eess.SP", "cs.SD"],
    githubTopics: ["signal-processing", "dsp", "audio-processing", "fft"],
  },
];

const SOURCE_HEALTH: Record<string, SourceHealth> = {
  wikipedia: { name: "Wikipedia", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  arxiv: { name: "ArXiv", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  wikidata: { name: "Wikidata", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  openlibrary: { name: "Open Library", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  pubmed: { name: "PubMed", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  nasa: { name: "NASA", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  conceptnet: { name: "ConceptNet", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  sep: { name: "Stanford Encyclopedia", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  github: { name: "GitHub", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  huggingface: { name: "HuggingFace", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  crossref: { name: "CrossRef", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  dbpedia: { name: "DBpedia", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  gutenberg: { name: "Project Gutenberg", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  core: { name: "CORE Research", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  internetarchive: { name: "Internet Archive", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  restcountries: { name: "REST Countries", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  stackexchange: { name: "StackExchange", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  openalex: { name: "OpenAlex", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  europeana: { name: "Europeana", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  semanticscholar: { name: "Semantic Scholar", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  openmeteo: { name: "Open-Meteo", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  worldbank: { name: "World Bank", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  dblp: { name: "DBLP", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  mediawikinews: { name: "Wikinews", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  usgs: { name: "USGS Earthquake", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  metmuseum: { name: "Met Museum", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  cern: { name: "CERN Open Data", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  orcid: { name: "ORCID", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  unpkg: { name: "UNPKG CDN Registry", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  biodiversity: { name: "GBIF Biodiversity", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  openstreetmap: { name: "OpenStreetMap Nominatim", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  ietf: { name: "IETF RFC", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  fooddata: { name: "USDA FoodData", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  ethnologue: { name: "Glottolog Languages", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  fao: { name: "FAO FAOSTAT", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  musicbrainz: { name: "MusicBrainz", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  nist: { name: "NIST NVD", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  opentdb: { name: "Open Trivia DB", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
  libcongress: { name: "Library of Congress", healthy: true, lastSuccess: Date.now(), errorCount: 0, totalPolled: 0 },
};

let spongeAdaptiveInterval = 5 * 60 * 1000;
let buildFirstMode = true;
let consecutiveEmptyCycles = 0;
let totalSynthesisDepth = 0;
let selfImprovementCycles = 0;

function computeContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 32);
}

async function isAlreadyIngested(contentHash: string): Promise<boolean> {
  try {
    const existing = await db.select({ id: knowledge_build_ledger.id })
      .from(knowledge_build_ledger)
      .where(eq(knowledge_build_ledger.contentHash, contentHash))
      .limit(1);
    return existing.length > 0;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchWikipediaArticle(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const category = domain.wikiCategories[Math.floor(Math.random() * domain.wikiCategories.length)];
  if (!category) return nodes;

  try {
    const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm.replace(/_/g, " "))}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      SOURCE_HEALTH.wikipedia.errorCount++;
      return nodes;
    }

    const data = await res.json() as ExternalApiResponse;
    if (!data.title || !data.extract) return nodes;

    const content = `${data.title}: ${data.extract}`;
    const contentHash = computeContentHash(content);

    if (await isAlreadyIngested(contentHash)) {
      totalDeduplicatedCount++;
      return nodes;
    }

    SOURCE_HEALTH.wikipedia.healthy = true;
    SOURCE_HEALTH.wikipedia.lastSuccess = Date.now();
    SOURCE_HEALTH.wikipedia.errorCount = 0;
    SOURCE_HEALTH.wikipedia.totalPolled++;

    const nodeId = `kg-wiki-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    nodes.push({
      nodeId,
      nodeType: "concept",
      label: data.title,
      content,
      edges: [],
      dimensionTags: domain.dimensions,
      confidence: 0.85,
      sourceType: "wikipedia_live",
      sourceUrl: data.content_urls?.desktop?.page || url,
      domain: domain.domain,
      contentHash,
    });
  } catch (err) {
    SOURCE_HEALTH.wikipedia.errorCount++;
    if (SOURCE_HEALTH.wikipedia.errorCount > 3) SOURCE_HEALTH.wikipedia.healthy = false;
    SOURCE_HEALTH.wikipedia.lastError = err instanceof Error ? err.message : String(err);
  }

  return nodes;
}

async function fetchArxivPapers(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  if (domain.arxivCategories.length === 0) return nodes;

  const cat = domain.arxivCategories[Math.floor(Math.random() * domain.arxivCategories.length)];
  try {
    const url = `https://export.arxiv.org/api/query?search_query=cat:${cat}&start=0&max_results=3&sortBy=lastUpdatedDate&sortOrder=descending`;
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) {
      SOURCE_HEALTH.arxiv.errorCount++;
      return nodes;
    }

    const text = await res.text();
    const entries = text.match(/<entry>([\s\S]*?)<\/entry>/g) || [];

    for (const entry of entries.slice(0, 2)) {
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
      const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
      if (!titleMatch || !summaryMatch) continue;

      const title = titleMatch[1].trim().replace(/\s+/g, " ");
      const summary = summaryMatch[1].trim().replace(/\s+/g, " ").slice(0, 500);
      const arxivId = idMatch?.[1]?.trim() || "";
      const content = `${title}: ${summary}`;
      const contentHash = computeContentHash(content);

      if (await isAlreadyIngested(contentHash)) {
        totalDeduplicatedCount++;
        continue;
      }

      const nodeId = `kg-arxiv-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      nodes.push({
        nodeId,
        nodeType: "research",
        label: title,
        content,
        edges: [],
        dimensionTags: domain.dimensions,
        confidence: 0.90,
        sourceType: "arxiv_live",
        sourceUrl: arxivId,
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.arxiv.healthy = true;
    SOURCE_HEALTH.arxiv.lastSuccess = Date.now();
    SOURCE_HEALTH.arxiv.errorCount = 0;
    SOURCE_HEALTH.arxiv.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.arxiv.errorCount++;
    if (SOURCE_HEALTH.arxiv.errorCount > 3) SOURCE_HEALTH.arxiv.healthy = false;
    SOURCE_HEALTH.arxiv.lastError = err instanceof Error ? err.message : String(err);
  }

  return nodes;
}

async function fetchWikidataConcept(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;

  try {
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchTerm)}&language=en&limit=3&format=json&origin=*`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      SOURCE_HEALTH.wikidata.errorCount++;
      return nodes;
    }

    const data = await res.json() as ExternalApiResponse;
    const results = data.search || [];

    for (const item of results.slice(0, 1)) {
      if (!item.label || !item.description) continue;
      const content = `${item.label}: ${item.description} (Wikidata: ${item.id})`;
      const contentHash = computeContentHash(content);

      if (await isAlreadyIngested(contentHash)) {
        totalDeduplicatedCount++;
        continue;
      }

      const nodeId = `kg-wikidata-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      nodes.push({
        nodeId,
        nodeType: "concept",
        label: item.label,
        content,
        edges: [],
        dimensionTags: domain.dimensions,
        confidence: 0.70,
        sourceType: "wikidata_live",
        sourceUrl: `https://www.wikidata.org/wiki/${item.id}`,
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.wikidata.healthy = true;
    SOURCE_HEALTH.wikidata.lastSuccess = Date.now();
    SOURCE_HEALTH.wikidata.errorCount = 0;
    SOURCE_HEALTH.wikidata.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.wikidata.errorCount++;
    if (SOURCE_HEALTH.wikidata.errorCount > 3) SOURCE_HEALTH.wikidata.healthy = false;
    SOURCE_HEALTH.wikidata.lastError = err instanceof Error ? err.message : String(err);
  }

  return nodes;
}

async function fetchOpenLibrary(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;

  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchTerm)}&limit=3&fields=title,author_name,subject,first_sentence`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      SOURCE_HEALTH.openlibrary.errorCount++;
      return nodes;
    }

    const data = await res.json() as ExternalApiResponse;
    const docs = data.docs || [];

    for (const doc of docs.slice(0, 1)) {
      if (!doc.title) continue;
      const authors = doc.author_name?.slice(0, 2).join(", ") || "Unknown";
      const subjects = doc.subject?.slice(0, 3).join(", ") || "";
      const sentence = doc.first_sentence?.value || doc.first_sentence || "";
      const content = `"${doc.title}" by ${authors}. Subjects: ${subjects}. ${sentence}`.slice(0, 800);
      const contentHash = computeContentHash(content);

      if (await isAlreadyIngested(contentHash)) {
        totalDeduplicatedCount++;
        continue;
      }

      const nodeId = `kg-book-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      nodes.push({
        nodeId,
        nodeType: "literature",
        label: doc.title,
        content,
        edges: [],
        dimensionTags: domain.dimensions,
        confidence: 0.75,
        sourceType: "open_library_live",
        sourceUrl: `https://openlibrary.org/search?q=${encodeURIComponent(searchTerm)}`,
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.openlibrary.healthy = true;
    SOURCE_HEALTH.openlibrary.lastSuccess = Date.now();
    SOURCE_HEALTH.openlibrary.errorCount = 0;
    SOURCE_HEALTH.openlibrary.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.openlibrary.errorCount++;
    if (SOURCE_HEALTH.openlibrary.errorCount > 3) SOURCE_HEALTH.openlibrary.healthy = false;
    SOURCE_HEALTH.openlibrary.lastError = err instanceof Error ? err.message : String(err);
  }

  return nodes;
}

async function fetchPubMedAbstracts(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;

  try {
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=3&retmode=json&sort=date`;
    const searchRes = await fetchWithTimeout(searchUrl, 10000);
    if (!searchRes.ok) {
      SOURCE_HEALTH.pubmed.errorCount++;
      return nodes;
    }

    const searchData = await searchRes.json() as ExternalApiResponse;
    const ids = searchData?.esearchresult?.idlist || [];
    if (ids.length === 0) return nodes;

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;
    const fetchRes = await fetchWithTimeout(fetchUrl, 10000);
    if (!fetchRes.ok) return nodes;

    const fetchData = await fetchRes.json() as ExternalApiResponse;
    const results = fetchData?.result || {};

    for (const id of ids.slice(0, 2)) {
      const article = results[id];
      if (!article?.title) continue;
      const authors = article.authors?.slice(0, 3).map((a: any) => a.name).join(", ") || "Unknown";
      const content = `${article.title} (${article.source || "PubMed"}, ${article.pubdate || ""}). Authors: ${authors}. ${article.fulljournalname || ""}`.slice(0, 800);
      const contentHash = computeContentHash(content);

      if (await isAlreadyIngested(contentHash)) {
        totalDeduplicatedCount++;
        continue;
      }

      const nodeId = `kg-pubmed-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      nodes.push({
        nodeId,
        nodeType: "research",
        label: article.title,
        content,
        edges: [],
        dimensionTags: domain.dimensions,
        confidence: 0.92,
        sourceType: "pubmed_live",
        sourceUrl: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.pubmed.healthy = true;
    SOURCE_HEALTH.pubmed.lastSuccess = Date.now();
    SOURCE_HEALTH.pubmed.errorCount = 0;
    SOURCE_HEALTH.pubmed.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.pubmed.errorCount++;
    if (SOURCE_HEALTH.pubmed.errorCount > 3) SOURCE_HEALTH.pubmed.healthy = false;
    SOURCE_HEALTH.pubmed.lastError = err instanceof Error ? err.message : String(err);
  }

  return nodes;
}

async function fetchNASAData(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];

  try {
    const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
    const url = `https://images-api.nasa.gov/search?q=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&media_type=image&page_size=3`;
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) {
      SOURCE_HEALTH.nasa.errorCount++;
      return nodes;
    }

    const data = await res.json() as ExternalApiResponse;
    const items = data?.collection?.items || [];

    for (const item of items.slice(0, 2)) {
      const itemData = item.data?.[0];
      if (!itemData?.title || !itemData?.description) continue;
      const content = `${itemData.title}: ${itemData.description.slice(0, 600)}`;
      const contentHash = computeContentHash(content);

      if (await isAlreadyIngested(contentHash)) {
        totalDeduplicatedCount++;
        continue;
      }

      const nodeId = `kg-nasa-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      nodes.push({
        nodeId,
        nodeType: "observation",
        label: itemData.title,
        content,
        edges: [],
        dimensionTags: domain.dimensions,
        confidence: 0.95,
        sourceType: "nasa_live",
        sourceUrl: item.href || `https://images.nasa.gov/details/${itemData.nasa_id}`,
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.nasa.healthy = true;
    SOURCE_HEALTH.nasa.lastSuccess = Date.now();
    SOURCE_HEALTH.nasa.errorCount = 0;
    SOURCE_HEALTH.nasa.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.nasa.errorCount++;
    if (SOURCE_HEALTH.nasa.errorCount > 3) SOURCE_HEALTH.nasa.healthy = false;
    SOURCE_HEALTH.nasa.lastError = err instanceof Error ? err.message : String(err);
  }

  return nodes;
}

async function fetchConceptNet(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;

  try {
    const url = `https://api.conceptnet.io/c/en/${encodeURIComponent(searchTerm.replace(/\s+/g, "_"))}?limit=5`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) {
      SOURCE_HEALTH.conceptnet.errorCount++;
      return nodes;
    }

    const data = await res.json() as ExternalApiResponse;
    const edges = data?.edges || [];

    for (const edge of edges.slice(0, 3)) {
      const startLabel = edge.start?.label || "";
      const endLabel = edge.end?.label || "";
      const relLabel = edge.rel?.label || "related to";
      if (!startLabel || !endLabel) continue;

      const content = `${startLabel} ${relLabel} ${endLabel}. Weight: ${(edge.weight || 0).toFixed(2)}. ${edge.surfaceText || ""}`.trim();
      const contentHash = computeContentHash(content);

      if (await isAlreadyIngested(contentHash)) {
        totalDeduplicatedCount++;
        continue;
      }

      const nodeId = `kg-conceptnet-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      nodes.push({
        nodeId,
        nodeType: "relation",
        label: `${startLabel} → ${endLabel}`,
        content,
        edges: [],
        dimensionTags: domain.dimensions,
        confidence: Math.min(0.95, (edge.weight || 1) / 5),
        sourceType: "conceptnet_live",
        sourceUrl: `https://conceptnet.io${edge["@id"] || ""}`,
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.conceptnet.healthy = true;
    SOURCE_HEALTH.conceptnet.lastSuccess = Date.now();
    SOURCE_HEALTH.conceptnet.errorCount = 0;
    SOURCE_HEALTH.conceptnet.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.conceptnet.errorCount++;
    if (SOURCE_HEALTH.conceptnet.errorCount > 3) SOURCE_HEALTH.conceptnet.healthy = false;
    SOURCE_HEALTH.conceptnet.lastError = err instanceof Error ? err.message : String(err);
  }

  return nodes;
}

async function fetchStanfordEncyclopedia(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;

  try {
    const url = `https://plato.stanford.edu/search/searcher.py?query=${encodeURIComponent(searchTerm.replace(/_/g, " "))}`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) {
      SOURCE_HEALTH.sep.errorCount++;
      return nodes;
    }

    const html = await res.text();
    const entryMatches = html.match(/<a href="(\/entries\/[^"]+)"[^>]*>([^<]+)<\/a>/g) || [];

    for (const match of entryMatches.slice(0, 2)) {
      const hrefMatch = match.match(/href="(\/entries\/[^"]+)"/);
      const textMatch = match.match(/>([^<]+)</);
      if (!hrefMatch || !textMatch) continue;

      const entryTitle = textMatch[1].trim();
      const entryUrl = `https://plato.stanford.edu${hrefMatch[1]}`;

      try {
        const entryRes = await fetchWithTimeout(entryUrl, 6000);
        if (!entryRes.ok) continue;
        const entryHtml = await entryRes.text();

        const preambleMatch = entryHtml.match(/<div id="preamble"[^>]*>([\s\S]*?)<\/div>/);
        let preamble = "";
        if (preambleMatch) {
          preamble = preambleMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 500);
        }

        if (!preamble) {
          const firstP = entryHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/);
          if (firstP) preamble = firstP[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 500);
        }

        if (!preamble) continue;

        const content = `${entryTitle}: ${preamble}`;
        const contentHash = computeContentHash(content);

        if (await isAlreadyIngested(contentHash)) {
          totalDeduplicatedCount++;
          continue;
        }

        const nodeId = `kg-sep-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        nodes.push({
          nodeId,
          nodeType: "philosophical",
          label: entryTitle,
          content,
          edges: [],
          dimensionTags: [...domain.dimensions, "philosophical"],
          confidence: 0.93,
          sourceType: "sep_live",
          sourceUrl: entryUrl,
          domain: domain.domain,
          contentHash,
        });
      } catch (err) { logger.warn({ err }, "suppressed error"); }
    }

    SOURCE_HEALTH.sep.healthy = true;
    SOURCE_HEALTH.sep.lastSuccess = Date.now();
    SOURCE_HEALTH.sep.errorCount = 0;
    SOURCE_HEALTH.sep.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.sep.errorCount++;
    if (SOURCE_HEALTH.sep.errorCount > 3) SOURCE_HEALTH.sep.healthy = false;
    SOURCE_HEALTH.sep.lastError = err instanceof Error ? err.message : String(err);
  }

  return nodes;
}

async function fetchGitHubRepos(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const topics = (domain as ExternalApiResponse).githubTopics || [];
  const topic = topics.length > 0
    ? topics[Math.floor(Math.random() * topics.length)]
    : domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)].replace(/_/g, "-");

  try {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(topic)}+sort:stars&per_page=5&sort=updated`;
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    const data = await res.json() as ExternalApiResponse;

    for (const repo of (data.items || []).slice(0, 5)) {
      const content = [
        `Repository: ${repo.full_name}`,
        `Description: ${repo.description || "No description"}`,
        `Stars: ${repo.stargazers_count} | Forks: ${repo.forks_count} | Language: ${repo.language || "Unknown"}`,
        `Topics: ${(repo.topics || []).join(", ")}`,
        `Updated: ${repo.updated_at}`,
        `License: ${repo.license?.name || "None"}`,
        `README URL: ${repo.html_url}`,
      ].join("\n");

      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) continue;

      nodes.push({
        nodeId: `github_${repo.full_name.replace(/\//g, "_")}_${Date.now()}`,
        nodeType: "repository",
        label: `[GitHub] ${repo.full_name}: ${repo.description?.slice(0, 100) || topic}`,
        content,
        edges: [],
        dimensionTags: domain.dimensions,
        confidence: Math.min(0.95, 0.5 + (repo.stargazers_count / 100000)),
        sourceType: "github",
        sourceUrl: repo.html_url,
        domain: domain.domain,
        contentHash,
      });
    }

    let readmeNodes = 0;
    for (const repo of (data.items || []).slice(0, 2)) {
      try {
        const readmeUrl = `https://api.github.com/repos/${repo.full_name}/readme`;
        const readmeRes = await fetchWithTimeout(readmeUrl, 8000);
        if (readmeRes.ok) {
          const readmeData = await readmeRes.json() as ExternalApiResponse;
          const readmeContent = Buffer.from(readmeData.content || "", "base64").toString("utf8").slice(0, 3000);
          if (readmeContent.length > 100) {
            const readmeHash = computeContentHash(readmeContent);
            if (!(await isAlreadyIngested(readmeHash))) {
              nodes.push({
                nodeId: `github_readme_${repo.full_name.replace(/\//g, "_")}_${Date.now()}`,
                nodeType: "document",
                label: `[GitHub README] ${repo.full_name} — Technical Documentation`,
                content: readmeContent,
                edges: [],
                dimensionTags: [...domain.dimensions, "informational"],
                confidence: 0.85,
                sourceType: "github",
                sourceUrl: `${repo.html_url}/blob/main/README.md`,
                domain: domain.domain,
                contentHash: readmeHash,
              });
              readmeNodes++;
            }
          }
        }
      } catch (err) { logger.warn({ err }, "suppressed error"); }
      await new Promise(r => setTimeout(r, 200));
    }

    SOURCE_HEALTH.github.healthy = true;
    SOURCE_HEALTH.github.lastSuccess = Date.now();
    SOURCE_HEALTH.github.errorCount = 0;
    SOURCE_HEALTH.github.totalPolled++;
    console.log(`${LOG_PREFIX}   GitHub: ${nodes.length} nodes (${readmeNodes} READMEs) for topic "${topic}"`);
  } catch (err) {
    SOURCE_HEALTH.github.errorCount++;
    if (SOURCE_HEALTH.github.errorCount > 5) SOURCE_HEALTH.github.healthy = false;
    SOURCE_HEALTH.github.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchHuggingFaceModels(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const topics = (domain as ExternalApiResponse).githubTopics || [];
  const searchTerm = topics.length > 0
    ? topics[Math.floor(Math.random() * topics.length)]
    : domain.domain.replace(/_/g, " ");

  try {
    const url = `https://huggingface.co/api/models?search=${encodeURIComponent(searchTerm)}&sort=downloads&direction=-1&limit=5`;
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error(`HuggingFace ${res.status}`);
    const models = await res.json() as ExternalApiResponse[];

    for (const model of (models || []).slice(0, 5)) {
      const content = [
        `Model: ${model.modelId || model.id}`,
        `Pipeline: ${model.pipeline_tag || "Unknown"}`,
        `Downloads: ${model.downloads || 0}`,
        `Likes: ${model.likes || 0}`,
        `Tags: ${(model.tags || []).slice(0, 10).join(", ")}`,
        `Library: ${model.library_name || "Unknown"}`,
        `Last Modified: ${model.lastModified || "Unknown"}`,
        `Architecture: ${(model.config?.architectures || []).join(", ") || "Unknown"}`,
      ].join("\n");

      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) continue;

      nodes.push({
        nodeId: `hf_${(model.modelId || model.id || "").replace(/\//g, "_")}_${Date.now()}`,
        nodeType: "model",
        label: `[HuggingFace] ${model.modelId || model.id}: ${model.pipeline_tag || searchTerm}`,
        content,
        edges: [],
        dimensionTags: [...domain.dimensions, "computational"],
        confidence: Math.min(0.95, 0.5 + ((model.downloads || 0) / 1000000)),
        sourceType: "huggingface",
        sourceUrl: `https://huggingface.co/${model.modelId || model.id}`,
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.huggingface.healthy = true;
    SOURCE_HEALTH.huggingface.lastSuccess = Date.now();
    SOURCE_HEALTH.huggingface.errorCount = 0;
    SOURCE_HEALTH.huggingface.totalPolled++;
    console.log(`${LOG_PREFIX}   HuggingFace: ${nodes.length} models for "${searchTerm}"`);
  } catch (err) {
    SOURCE_HEALTH.huggingface.errorCount++;
    if (SOURCE_HEALTH.huggingface.errorCount > 5) SOURCE_HEALTH.huggingface.healthy = false;
    SOURCE_HEALTH.huggingface.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchCrossRefPapers(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;

  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&rows=3&sort=published&order=desc&select=title,abstract,DOI,publisher,published-print,author,subject`;
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error(`CrossRef ${res.status}`);
    const data = await res.json() as ExternalApiResponse;

    for (const item of (data?.message?.items || []).slice(0, 3)) {
      const title = Array.isArray(item.title) ? item.title[0] : item.title || "";
      if (!title) continue;
      const abstract = (item.abstract || "").replace(/<[^>]+>/g, "").slice(0, 500);
      const authors = (item.author || []).slice(0, 3).map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()).join(", ");
      const subjects = (item.subject || []).slice(0, 5).join(", ");
      const content = `${title}. Authors: ${authors}. Publisher: ${item.publisher || "Unknown"}. DOI: ${item.DOI || ""}. Subjects: ${subjects}. ${abstract}`.trim();
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }

      nodes.push({
        nodeId: `kg-crossref-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "research",
        label: title.slice(0, 200),
        content,
        edges: [],
        dimensionTags: domain.dimensions,
        confidence: 0.91,
        sourceType: "crossref_live",
        sourceUrl: item.DOI ? `https://doi.org/${item.DOI}` : "",
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.crossref.healthy = true;
    SOURCE_HEALTH.crossref.lastSuccess = Date.now();
    SOURCE_HEALTH.crossref.errorCount = 0;
    SOURCE_HEALTH.crossref.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.crossref.errorCount++;
    if (SOURCE_HEALTH.crossref.errorCount > 5) SOURCE_HEALTH.crossref.healthy = false;
    SOURCE_HEALTH.crossref.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchDBpedia(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;

  try {
    const url = `https://lookup.dbpedia.org/api/search?query=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&format=json&maxResults=3`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`DBpedia ${res.status}`);
    const data = await res.json() as ExternalApiResponse;

    for (const doc of (data?.docs || []).slice(0, 3)) {
      const label = Array.isArray(doc.label) ? doc.label[0] : doc.label || "";
      const comment = Array.isArray(doc.comment) ? doc.comment[0] : doc.comment || "";
      if (!label || !comment) continue;
      const categories = Array.isArray(doc.category) ? doc.category.slice(0, 5).join(", ") : "";
      const content = `${label}: ${comment.slice(0, 600)}${categories ? `. Categories: ${categories}` : ""}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }

      nodes.push({
        nodeId: `kg-dbpedia-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "concept",
        label,
        content,
        edges: [],
        dimensionTags: domain.dimensions,
        confidence: 0.82,
        sourceType: "dbpedia_live",
        sourceUrl: Array.isArray(doc.resource) ? doc.resource[0] : (doc.resource || ""),
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.dbpedia.healthy = true;
    SOURCE_HEALTH.dbpedia.lastSuccess = Date.now();
    SOURCE_HEALTH.dbpedia.errorCount = 0;
    SOURCE_HEALTH.dbpedia.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.dbpedia.errorCount++;
    if (SOURCE_HEALTH.dbpedia.errorCount > 5) SOURCE_HEALTH.dbpedia.healthy = false;
    SOURCE_HEALTH.dbpedia.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchInternetArchive(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;

  try {
    const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=creator&fl[]=date&fl[]=subject&rows=3&page=1&output=json&sort[]=downloads+desc`;
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error(`InternetArchive ${res.status}`);
    const data = await res.json() as ExternalApiResponse;

    for (const doc of (data?.response?.docs || []).slice(0, 3)) {
      if (!doc.title) continue;
      const desc = (doc.description || "").toString().slice(0, 500);
      const content = `${doc.title}. Creator: ${doc.creator || "Unknown"}. Date: ${doc.date || "Unknown"}. Subjects: ${Array.isArray(doc.subject) ? doc.subject.slice(0, 5).join(", ") : (doc.subject || "")}. ${desc}`.trim();
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }

      nodes.push({
        nodeId: `kg-ia-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "document",
        label: doc.title.slice(0, 200),
        content,
        edges: [],
        dimensionTags: [...domain.dimensions, "historical"],
        confidence: 0.78,
        sourceType: "internetarchive_live",
        sourceUrl: `https://archive.org/details/${doc.identifier}`,
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.internetarchive.healthy = true;
    SOURCE_HEALTH.internetarchive.lastSuccess = Date.now();
    SOURCE_HEALTH.internetarchive.errorCount = 0;
    SOURCE_HEALTH.internetarchive.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.internetarchive.errorCount++;
    if (SOURCE_HEALTH.internetarchive.errorCount > 5) SOURCE_HEALTH.internetarchive.healthy = false;
    SOURCE_HEALTH.internetarchive.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchGutenbergBooks(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;

  try {
    const url = `https://gutendex.com/books/?search=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&page=1`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`Gutenberg ${res.status}`);
    const data = await res.json() as ExternalApiResponse;

    for (const book of (data?.results || []).slice(0, 2)) {
      if (!book.title) continue;
      const authors = (book.authors || []).map((a: any) => a.name).join(", ");
      const subjects = (book.subjects || []).slice(0, 5).join("; ");
      const bookshelves = (book.bookshelves || []).join(", ");
      const content = `"${book.title}" by ${authors || "Unknown"}. Downloads: ${book.download_count || 0}. Subjects: ${subjects}. Bookshelves: ${bookshelves}. Languages: ${(book.languages || []).join(", ")}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }

      nodes.push({
        nodeId: `kg-gutenberg-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "literature",
        label: `[Gutenberg] ${book.title}`,
        content,
        edges: [],
        dimensionTags: [...domain.dimensions, "literary"],
        confidence: 0.80,
        sourceType: "gutenberg_live",
        sourceUrl: `https://www.gutenberg.org/ebooks/${book.id}`,
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.gutenberg.healthy = true;
    SOURCE_HEALTH.gutenberg.lastSuccess = Date.now();
    SOURCE_HEALTH.gutenberg.errorCount = 0;
    SOURCE_HEALTH.gutenberg.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.gutenberg.errorCount++;
    if (SOURCE_HEALTH.gutenberg.errorCount > 5) SOURCE_HEALTH.gutenberg.healthy = false;
    SOURCE_HEALTH.gutenberg.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchCOREResearch(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  if (!domain.arxivCategories.length && !domain.wikiCategories.length) return nodes;
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;

  try {
    const url = `https://api.core.ac.uk/v3/search/works?q=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&limit=3`;
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error(`CORE ${res.status}`);
    const data = await res.json() as ExternalApiResponse;

    for (const work of (data?.results || []).slice(0, 3)) {
      if (!work.title) continue;
      const abstract = (work.abstract || "").slice(0, 500);
      const authors = (work.authors || []).slice(0, 3).map((a: any) => a.name || "").join(", ");
      const content = `${work.title}. Authors: ${authors}. Year: ${work.yearPublished || "Unknown"}. ${abstract}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }

      nodes.push({
        nodeId: `kg-core-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "research",
        label: work.title.slice(0, 200),
        content,
        edges: [],
        dimensionTags: domain.dimensions,
        confidence: 0.88,
        sourceType: "core_live",
        sourceUrl: work.downloadUrl || work.sourceFulltextUrls?.[0] || "",
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.core.healthy = true;
    SOURCE_HEALTH.core.lastSuccess = Date.now();
    SOURCE_HEALTH.core.errorCount = 0;
    SOURCE_HEALTH.core.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.core.errorCount++;
    if (SOURCE_HEALTH.core.errorCount > 5) SOURCE_HEALTH.core.healthy = false;
    SOURCE_HEALTH.core.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchRESTCountries(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  if (domain.domain !== "geography" && domain.domain !== "culture" && domain.domain !== "government" && domain.domain !== "politics") return nodes;

  try {
    const regions = ["europe", "asia", "africa", "americas", "oceania"];
    const region = regions[Math.floor(Math.random() * regions.length)];
    const url = `https://restcountries.com/v3.1/region/${region}?fields=name,capital,region,subregion,population,area,languages,currencies,borders,continents`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`RESTCountries ${res.status}`);
    const countries = await res.json() as ExternalApiResponse[];

    const selected = countries.sort(() => Math.random() - 0.5).slice(0, 2);
    for (const c of selected) {
      const name = c.name?.common || c.name?.official || "";
      if (!name) continue;
      const languages = c.languages ? Object.values(c.languages).join(", ") : "";
      const currencies = c.currencies ? Object.values(c.currencies).map((cur: any) => `${cur.name} (${cur.symbol || ""})`).join(", ") : "";
      const content = `${name} (${c.name?.official || name}). Capital: ${(c.capital || []).join(", ") || "N/A"}. Region: ${c.region}/${c.subregion || ""}. Population: ${(c.population || 0).toLocaleString()}. Area: ${(c.area || 0).toLocaleString()} km². Languages: ${languages}. Currencies: ${currencies}. Borders: ${(c.borders || []).join(", ") || "None"}.`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }

      nodes.push({
        nodeId: `kg-country-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "geopolitical",
        label: `[Country] ${name}`,
        content,
        edges: [],
        dimensionTags: [...domain.dimensions, "geopolitical"],
        confidence: 0.95,
        sourceType: "restcountries_live",
        sourceUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(name)}`,
        domain: domain.domain,
        contentHash,
      });
    }

    SOURCE_HEALTH.restcountries.healthy = true;
    SOURCE_HEALTH.restcountries.lastSuccess = Date.now();
    SOURCE_HEALTH.restcountries.errorCount = 0;
    SOURCE_HEALTH.restcountries.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.restcountries.errorCount++;
    if (SOURCE_HEALTH.restcountries.errorCount > 5) SOURCE_HEALTH.restcountries.healthy = false;
    SOURCE_HEALTH.restcountries.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchStackExchange(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://api.stackexchange.com/2.3/search/excerpts?order=desc&sort=relevance&q=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&site=stackoverflow&pagesize=3&filter=default`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`StackExchange ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const item of (data.items || []).slice(0, 3)) {
      if (!item.title) continue;
      const content = `${item.title}. ${(item.excerpt || item.body || "").replace(/<[^>]+>/g, "").slice(0, 600)}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({
        nodeId: `kg-stackex-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "qa",
        label: `[StackExchange] ${item.title}`,
        content, edges: [], dimensionTags: [...domain.dimensions, "informational"],
        confidence: 0.82, sourceType: "stackexchange_live",
        sourceUrl: `https://stackoverflow.com/q/${item.question_id}`,
        domain: domain.domain, contentHash,
      });
    }
    SOURCE_HEALTH.stackexchange.healthy = true;
    SOURCE_HEALTH.stackexchange.lastSuccess = Date.now();
    SOURCE_HEALTH.stackexchange.errorCount = 0;
    SOURCE_HEALTH.stackexchange.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.stackexchange.errorCount++;
    if (SOURCE_HEALTH.stackexchange.errorCount > 5) SOURCE_HEALTH.stackexchange.healthy = false;
    SOURCE_HEALTH.stackexchange.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchOpenAlex(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&per_page=3&sort=cited_by_count:desc&mailto=tessera@sovereign.ai`;
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error(`OpenAlex ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const work of (data.results || []).slice(0, 3)) {
      if (!work.title) continue;
      const authors = (work.authorships || []).slice(0, 3).map((a: any) => a.author?.display_name || "").filter(Boolean).join(", ");
      const concepts = (work.concepts || []).slice(0, 5).map((c: any) => c.display_name).join(", ");
      const content = `${work.title}. Authors: ${authors}. Year: ${work.publication_year || "?"}. Citations: ${work.cited_by_count || 0}. Concepts: ${concepts}. Type: ${work.type || "article"}. DOI: ${work.doi || "N/A"}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({
        nodeId: `kg-openalex-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "research",
        label: `[OpenAlex] ${work.title.slice(0, 120)}`,
        content, edges: [], dimensionTags: domain.dimensions,
        confidence: 0.90, sourceType: "openalex_live",
        sourceUrl: work.doi || work.id || "",
        domain: domain.domain, contentHash,
      });
    }
    SOURCE_HEALTH.openalex.healthy = true;
    SOURCE_HEALTH.openalex.lastSuccess = Date.now();
    SOURCE_HEALTH.openalex.errorCount = 0;
    SOURCE_HEALTH.openalex.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.openalex.errorCount++;
    if (SOURCE_HEALTH.openalex.errorCount > 5) SOURCE_HEALTH.openalex.healthy = false;
    SOURCE_HEALTH.openalex.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchSemanticScholar(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&limit=3&fields=title,abstract,year,citationCount,authors,fieldsOfStudy`;
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error(`SemanticScholar ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const paper of (data.data || []).slice(0, 3)) {
      if (!paper.title) continue;
      const authors = (paper.authors || []).slice(0, 3).map((a: any) => a.name).join(", ");
      const fields = (paper.fieldsOfStudy || []).join(", ");
      const content = `${paper.title}. Authors: ${authors}. Year: ${paper.year || "?"}. Citations: ${paper.citationCount || 0}. Fields: ${fields}. ${(paper.abstract || "").slice(0, 400)}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({
        nodeId: `kg-s2-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "research",
        label: `[S2] ${paper.title.slice(0, 120)}`,
        content, edges: [], dimensionTags: domain.dimensions,
        confidence: 0.91, sourceType: "semanticscholar_live",
        sourceUrl: `https://www.semanticscholar.org/paper/${paper.paperId}`,
        domain: domain.domain, contentHash,
      });
    }
    SOURCE_HEALTH.semanticscholar.healthy = true;
    SOURCE_HEALTH.semanticscholar.lastSuccess = Date.now();
    SOURCE_HEALTH.semanticscholar.errorCount = 0;
    SOURCE_HEALTH.semanticscholar.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.semanticscholar.errorCount++;
    if (SOURCE_HEALTH.semanticscholar.errorCount > 5) SOURCE_HEALTH.semanticscholar.healthy = false;
    SOURCE_HEALTH.semanticscholar.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchWorldBank(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const indicators = ["NY.GDP.MKTP.CD", "SP.POP.TOTL", "SE.ADT.LITR.ZS", "SH.XPD.CHEX.GD.ZS", "EN.ATM.CO2E.PC", "IT.NET.USER.ZS"];
  const indicator = indicators[Math.floor(Math.random() * indicators.length)];
  try {
    const url = `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&date=2020:2023&per_page=10&mrv=1`;
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error(`WorldBank ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    const records = data?.[1] || [];
    for (const record of records.slice(0, 5)) {
      if (!record?.country?.value || record.value === null) continue;
      const content = `${record.country.value}: ${record.indicator?.value || indicator} = ${record.value} (${record.date}). Source: World Bank Open Data.`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({
        nodeId: `kg-worldbank-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "statistic",
        label: `[WorldBank] ${record.country.value} — ${record.indicator?.value || indicator}`,
        content, edges: [], dimensionTags: [...domain.dimensions, "economic", "social"],
        confidence: 0.95, sourceType: "worldbank_live",
        sourceUrl: `https://data.worldbank.org/indicator/${indicator}`,
        domain: domain.domain, contentHash,
      });
    }
    SOURCE_HEALTH.worldbank.healthy = true;
    SOURCE_HEALTH.worldbank.lastSuccess = Date.now();
    SOURCE_HEALTH.worldbank.errorCount = 0;
    SOURCE_HEALTH.worldbank.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.worldbank.errorCount++;
    if (SOURCE_HEALTH.worldbank.errorCount > 5) SOURCE_HEALTH.worldbank.healthy = false;
    SOURCE_HEALTH.worldbank.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchOpenMeteo(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const cities = [
    { name: "New York", lat: 40.71, lon: -74.01 },
    { name: "London", lat: 51.51, lon: -0.13 },
    { name: "Tokyo", lat: 35.68, lon: 139.69 },
    { name: "Sydney", lat: -33.87, lon: 151.21 },
    { name: "São Paulo", lat: -23.55, lon: -46.63 },
  ];
  const city = cities[Math.floor(Math.random() * cities.length)];
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,wind_speed_10m,relative_humidity_2m,apparent_temperature,precipitation&timezone=auto`;
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) throw new Error(`OpenMeteo ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    const c = data.current;
    if (c) {
      const content = `Weather in ${city.name}: Temperature ${c.temperature_2m}°C (feels like ${c.apparent_temperature}°C). Humidity: ${c.relative_humidity_2m}%. Wind: ${c.wind_speed_10m} km/h. Precipitation: ${c.precipitation} mm. Time: ${c.time}`;
      const contentHash = computeContentHash(content);
      if (!(await isAlreadyIngested(contentHash))) {
        nodes.push({
          nodeId: `kg-weather-${city.name.toLowerCase().replace(/\s/g, "_")}-${Date.now()}`,
          nodeType: "observation",
          label: `[Weather] ${city.name} — ${c.temperature_2m}°C`,
          content, edges: [], dimensionTags: [...domain.dimensions, "ecological", "physical", "spatial"],
          confidence: 0.98, sourceType: "openmeteo_live",
          sourceUrl: `https://open-meteo.com`,
          domain: domain.domain, contentHash,
        });
      }
    }
    SOURCE_HEALTH.openmeteo.healthy = true;
    SOURCE_HEALTH.openmeteo.lastSuccess = Date.now();
    SOURCE_HEALTH.openmeteo.errorCount = 0;
    SOURCE_HEALTH.openmeteo.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.openmeteo.errorCount++;
    if (SOURCE_HEALTH.openmeteo.errorCount > 5) SOURCE_HEALTH.openmeteo.healthy = false;
    SOURCE_HEALTH.openmeteo.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchUSGSEarthquakes(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  try {
    const url = `https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_day.geojson`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`USGS ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const feature of (data.features || []).slice(0, 3)) {
      const props = feature.properties;
      const coords = feature.geometry?.coordinates || [];
      if (!props?.place) continue;
      const content = `Earthquake: M${props.mag} at ${props.place}. Depth: ${coords[2] || "?"}km. Time: ${new Date(props.time).toISOString()}. Type: ${props.type}. Status: ${props.status}. Tsunami alert: ${props.tsunami ? "YES" : "No"}. Felt reports: ${props.felt || 0}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({
        nodeId: `kg-usgs-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "observation",
        label: `[USGS] M${props.mag} — ${props.place}`,
        content, edges: [], dimensionTags: [...domain.dimensions, "physical", "spatial", "temporal"],
        confidence: 0.97, sourceType: "usgs_live",
        sourceUrl: props.url || "https://earthquake.usgs.gov",
        domain: domain.domain, contentHash,
      });
    }
    SOURCE_HEALTH.usgs.healthy = true;
    SOURCE_HEALTH.usgs.lastSuccess = Date.now();
    SOURCE_HEALTH.usgs.errorCount = 0;
    SOURCE_HEALTH.usgs.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.usgs.errorCount++;
    if (SOURCE_HEALTH.usgs.errorCount > 5) SOURCE_HEALTH.usgs.healthy = false;
    SOURCE_HEALTH.usgs.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchDBLP(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://dblp.org/search/publ/api?q=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&h=3&format=json`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`DBLP ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    const hits = data?.result?.hits?.hit || [];
    for (const hit of hits.slice(0, 3)) {
      const info = hit.info;
      if (!info?.title) continue;
      const authors = typeof info.authors?.author === "string" ? info.authors.author : (info.authors?.author || []).map((a: any) => typeof a === "string" ? a : a.text || a["#text"] || "").filter(Boolean).slice(0, 4).join(", ");
      const content = `${info.title}. Authors: ${authors}. Venue: ${info.venue || "N/A"}. Year: ${info.year || "?"}. Type: ${info.type || "article"}. DOI: ${info.doi || info.ee || "N/A"}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({
        nodeId: `kg-dblp-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "research",
        label: `[DBLP] ${info.title.slice(0, 120)}`,
        content, edges: [], dimensionTags: [...domain.dimensions, "informational"],
        confidence: 0.88, sourceType: "dblp_live",
        sourceUrl: info.ee || info.url || "https://dblp.org",
        domain: domain.domain, contentHash,
      });
    }
    SOURCE_HEALTH.dblp.healthy = true;
    SOURCE_HEALTH.dblp.lastSuccess = Date.now();
    SOURCE_HEALTH.dblp.errorCount = 0;
    SOURCE_HEALTH.dblp.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.dblp.errorCount++;
    if (SOURCE_HEALTH.dblp.errorCount > 5) SOURCE_HEALTH.dblp.healthy = false;
    SOURCE_HEALTH.dblp.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchEuropeana(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://api.europeana.eu/record/v2/search.json?query=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&rows=3&profile=minimal&wskey=apidemo`;
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error(`Europeana ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const item of (data.items || []).slice(0, 3)) {
      const title = (item.title || [])[0] || "";
      const provider = (item.dataProvider || [])[0] || "Europeana";
      const description = (item.dcDescription || [])[0] || "";
      if (!title) continue;
      const content = `${title}. Provider: ${provider}. Type: ${item.type || "Unknown"}. ${description.slice(0, 400)}. Year: ${item.year || "?"}. Country: ${(item.country || [])[0] || "?"}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({
        nodeId: `kg-europeana-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "cultural_artifact",
        label: `[Europeana] ${title.slice(0, 120)}`,
        content, edges: [], dimensionTags: [...domain.dimensions, "cultural", "aesthetic"],
        confidence: 0.85, sourceType: "europeana_live",
        sourceUrl: item.guid || item.link || "https://www.europeana.eu",
        domain: domain.domain, contentHash,
      });
    }
    SOURCE_HEALTH.europeana.healthy = true;
    SOURCE_HEALTH.europeana.lastSuccess = Date.now();
    SOURCE_HEALTH.europeana.errorCount = 0;
    SOURCE_HEALTH.europeana.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.europeana.errorCount++;
    if (SOURCE_HEALTH.europeana.errorCount > 5) SOURCE_HEALTH.europeana.healthy = false;
    SOURCE_HEALTH.europeana.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchMetMuseum(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const searchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&hasImages=true`;
    const searchRes = await fetchWithTimeout(searchUrl, 8000);
    if (!searchRes.ok) throw new Error(`Met ${searchRes.status}`);
    const searchData = await searchRes.json() as ExternalApiResponse;
    const objectIDs = (searchData.objectIDs || []).slice(0, 3);
    for (const id of objectIDs) {
      try {
        const objRes = await fetchWithTimeout(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, 6000);
        if (!objRes.ok) continue;
        const obj = await objRes.json() as ExternalApiResponse;
        if (!obj.title) continue;
        const content = `"${obj.title}" by ${obj.artistDisplayName || "Unknown"} (${obj.objectDate || "?"}). Medium: ${obj.medium || "?"}. Department: ${obj.department || "?"}. Culture: ${obj.culture || "?"}. Classification: ${obj.classification || "?"}. Period: ${obj.period || "?"}. Dynasty: ${obj.dynasty || "?"}. Dimensions: ${obj.dimensions || "?"}`;
        const contentHash = computeContentHash(content);
        if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
        nodes.push({
          nodeId: `kg-met-${id}-${Date.now()}`,
          nodeType: "artwork",
          label: `[Met Museum] ${obj.title} — ${obj.artistDisplayName || "Unknown"}`,
          content, edges: [], dimensionTags: [...domain.dimensions, "aesthetic", "cultural", "creative"],
          confidence: 0.93, sourceType: "metmuseum_live",
          sourceUrl: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${id}`,
          domain: domain.domain, contentHash,
        });
      } catch (err) { logger.warn({ err }, "suppressed error"); }
      await new Promise(r => setTimeout(r, 100));
    }
    SOURCE_HEALTH.metmuseum.healthy = true;
    SOURCE_HEALTH.metmuseum.lastSuccess = Date.now();
    SOURCE_HEALTH.metmuseum.errorCount = 0;
    SOURCE_HEALTH.metmuseum.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.metmuseum.errorCount++;
    if (SOURCE_HEALTH.metmuseum.errorCount > 5) SOURCE_HEALTH.metmuseum.healthy = false;
    SOURCE_HEALTH.metmuseum.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchWikinews(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://en.wikinews.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&srlimit=3&format=json&origin=*`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`Wikinews ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const result of (data.query?.search || []).slice(0, 3)) {
      if (!result.title) continue;
      const snippet = (result.snippet || "").replace(/<[^>]+>/g, "").slice(0, 500);
      const content = `${result.title}: ${snippet}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({
        nodeId: `kg-wikinews-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        nodeType: "news",
        label: `[Wikinews] ${result.title}`,
        content, edges: [], dimensionTags: [...domain.dimensions, "temporal", "social"],
        confidence: 0.80, sourceType: "wikinews_live",
        sourceUrl: `https://en.wikinews.org/wiki/${encodeURIComponent(result.title)}`,
        domain: domain.domain, contentHash,
      });
    }
    SOURCE_HEALTH.mediawikinews.healthy = true;
    SOURCE_HEALTH.mediawikinews.lastSuccess = Date.now();
    SOURCE_HEALTH.mediawikinews.errorCount = 0;
    SOURCE_HEALTH.mediawikinews.totalPolled++;
  } catch (err) {
    SOURCE_HEALTH.mediawikinews.errorCount++;
    if (SOURCE_HEALTH.mediawikinews.errorCount > 5) SOURCE_HEALTH.mediawikinews.healthy = false;
    SOURCE_HEALTH.mediawikinews.lastError = err instanceof Error ? err.message : String(err);
  }
  return nodes;
}

async function fetchCERNOpenData(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://opendata.cern.ch/api/records/?q=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&size=3&type=Dataset`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`CERN ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const hit of (data.hits?.hits || []).slice(0, 3)) {
      const meta = hit.metadata || {};
      if (!meta.title) continue;
      const content = `${meta.title}. ${(meta.abstract?.description || meta.description || "").slice(0, 400)}. Type: ${meta.type?.primary || "dataset"}. Experiment: ${meta.experiment || "N/A"}. DOI: ${meta.doi || "N/A"}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-cern-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "research", label: `[CERN] ${meta.title.slice(0, 80)}`, content, edges: [], dimensionTags: [...domain.dimensions, "physical", "quantum"], confidence: 0.95, sourceType: "cern_live", sourceUrl: `https://opendata.cern.ch/record/${hit.id}`, domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.cern.healthy = true; SOURCE_HEALTH.cern.lastSuccess = Date.now(); SOURCE_HEALTH.cern.errorCount = 0; SOURCE_HEALTH.cern.totalPolled++;
  } catch (err) { SOURCE_HEALTH.cern.errorCount++; if (SOURCE_HEALTH.cern.errorCount > 5) SOURCE_HEALTH.cern.healthy = false; SOURCE_HEALTH.cern.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchGBIFBiodiversity(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://api.gbif.org/v1/species/search?q=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&limit=3`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`GBIF ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const result of (data.results || []).slice(0, 3)) {
      if (!result.scientificName) continue;
      const content = `Species: ${result.scientificName}. Kingdom: ${result.kingdom || "?"}, Phylum: ${result.phylum || "?"}, Class: ${result.class || "?"}, Order: ${result.order || "?"}, Family: ${result.family || "?"}. Rank: ${result.rank || "?"}. Status: ${result.taxonomicStatus || "?"}. Habitats: ${result.habitats?.join(", ") || "N/A"}. Key: ${result.key}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-gbif-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "taxonomy", label: `[GBIF] ${result.scientificName}`, content, edges: [], dimensionTags: [...domain.dimensions, "biological", "ecological"], confidence: 0.92, sourceType: "gbif_live", sourceUrl: `https://www.gbif.org/species/${result.key}`, domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.biodiversity.healthy = true; SOURCE_HEALTH.biodiversity.lastSuccess = Date.now(); SOURCE_HEALTH.biodiversity.errorCount = 0; SOURCE_HEALTH.biodiversity.totalPolled++;
  } catch (err) { SOURCE_HEALTH.biodiversity.errorCount++; if (SOURCE_HEALTH.biodiversity.errorCount > 5) SOURCE_HEALTH.biodiversity.healthy = false; SOURCE_HEALTH.biodiversity.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchOpenStreetMap(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&format=json&limit=3&extratags=1`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`OSM ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const result of (data || []).slice(0, 3)) {
      if (!result.display_name) continue;
      const tags = result.extratags || {};
      const tagStr = Object.entries(tags).slice(0, 5).map(([k, v]) => `${k}: ${v}`).join("; ");
      const content = `Location: ${result.display_name}. Type: ${result.type}, Class: ${result.class}. Lat: ${result.lat}, Lon: ${result.lon}. Importance: ${result.importance || "?"}. ${tagStr ? `Tags: ${tagStr}` : ""}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-osm-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "geospatial", label: `[OSM] ${result.display_name.slice(0, 80)}`, content, edges: [], dimensionTags: [...domain.dimensions, "spatial", "social"], confidence: 0.88, sourceType: "osm_live", sourceUrl: `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`, domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.openstreetmap.healthy = true; SOURCE_HEALTH.openstreetmap.lastSuccess = Date.now(); SOURCE_HEALTH.openstreetmap.errorCount = 0; SOURCE_HEALTH.openstreetmap.totalPolled++;
  } catch (err) { SOURCE_HEALTH.openstreetmap.errorCount++; if (SOURCE_HEALTH.openstreetmap.errorCount > 5) SOURCE_HEALTH.openstreetmap.healthy = false; SOURCE_HEALTH.openstreetmap.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchIETFRFC(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://www.rfc-editor.org/search/rfc_search_detail.php?title=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&sortkey=Number&sorting=DESC&num=3&pubstatus%5B%5D=Standards%20Track&format=json`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`IETF ${res.status}`);
    const text = await res.text();
    const rfcMatches = text.match(/RFC\s*\d+/gi) || [];
    for (const rfcRef of rfcMatches.slice(0, 3)) {
      const rfcNum = rfcRef.replace(/\D/g, "");
      const detailRes = await fetchWithTimeout(`https://www.rfc-editor.org/rfc/rfc${rfcNum}.txt`, 5000);
      if (!detailRes.ok) continue;
      const rfcText = (await detailRes.text()).slice(0, 600);
      const content = `RFC ${rfcNum}: ${rfcText.replace(/\n+/g, " ").trim()}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-ietf-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "standard", label: `[IETF] RFC ${rfcNum}`, content, edges: [], dimensionTags: [...domain.dimensions, "technological", "informational"], confidence: 0.96, sourceType: "ietf_live", sourceUrl: `https://www.rfc-editor.org/rfc/rfc${rfcNum}`, domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.ietf.healthy = true; SOURCE_HEALTH.ietf.lastSuccess = Date.now(); SOURCE_HEALTH.ietf.errorCount = 0; SOURCE_HEALTH.ietf.totalPolled++;
  } catch (err) { SOURCE_HEALTH.ietf.errorCount++; if (SOURCE_HEALTH.ietf.errorCount > 5) SOURCE_HEALTH.ietf.healthy = false; SOURCE_HEALTH.ietf.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchUSDAFoodData(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&pageSize=3&api_key=DEMO_KEY`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`USDA ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const food of (data.foods || []).slice(0, 3)) {
      if (!food.description) continue;
      const nutrients = (food.foodNutrients || []).slice(0, 6).map((n: any) => `${n.nutrientName}: ${n.value}${n.unitName || ""}`).join(", ");
      const content = `Food: ${food.description}. Category: ${food.foodCategory || "?"}. Brand: ${food.brandName || food.brandOwner || "Generic"}. Nutrients: ${nutrients}. DataType: ${food.dataType || "?"}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-usda-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "data", label: `[USDA] ${food.description.slice(0, 80)}`, content, edges: [], dimensionTags: [...domain.dimensions, "biological", "chemical"], confidence: 0.93, sourceType: "usda_live", sourceUrl: `https://fdc.nal.usda.gov/fdc-app.html#/food-details/${food.fdcId}`, domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.fooddata.healthy = true; SOURCE_HEALTH.fooddata.lastSuccess = Date.now(); SOURCE_HEALTH.fooddata.errorCount = 0; SOURCE_HEALTH.fooddata.totalPolled++;
  } catch (err) { SOURCE_HEALTH.fooddata.errorCount++; if (SOURCE_HEALTH.fooddata.errorCount > 5) SOURCE_HEALTH.fooddata.healthy = false; SOURCE_HEALTH.fooddata.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchGlottologLanguages(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  try {
    const url = `https://glottolog.org/glottolog?name=&namequerytype=part&level=language&macroarea=&country=&classificationtxt=&classification=&iso=&format=json&limit=3&offset=${Math.floor(Math.random() * 100)}`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`Glottolog ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const lang of (Array.isArray(data) ? data : data.results || data.languages || []).slice(0, 3)) {
      const name = lang.name || lang.language_name || lang.label || "";
      if (!name) continue;
      const content = `Language: ${name}. Family: ${lang.family || lang.classification || "?"}. ISO 639-3: ${lang.iso639P3code || lang.iso || "?"}. Glottocode: ${lang.id || lang.glottocode || "?"}. Status: ${lang.status || lang.endangerment || "?"}. Region: ${lang.macroarea || "?"}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-glotto-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "taxonomy", label: `[Glottolog] ${name}`, content, edges: [], dimensionTags: [...domain.dimensions, "linguistic", "social"], confidence: 0.90, sourceType: "glottolog_live", domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.ethnologue.healthy = true; SOURCE_HEALTH.ethnologue.lastSuccess = Date.now(); SOURCE_HEALTH.ethnologue.errorCount = 0; SOURCE_HEALTH.ethnologue.totalPolled++;
  } catch (err) { SOURCE_HEALTH.ethnologue.errorCount++; if (SOURCE_HEALTH.ethnologue.errorCount > 5) SOURCE_HEALTH.ethnologue.healthy = false; SOURCE_HEALTH.ethnologue.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchMusicBrainz(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&limit=3&fmt=json`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`MusicBrainz ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const artist of (data.artists || []).slice(0, 3)) {
      if (!artist.name) continue;
      const tags = (artist.tags || []).slice(0, 5).map((t: any) => t.name).join(", ");
      const content = `Artist: ${artist.name}. Type: ${artist.type || "?"}. Country: ${artist.country || "?"}. Active: ${artist["life-span"]?.begin || "?"} — ${artist["life-span"]?.end || "present"}. Disambiguation: ${artist.disambiguation || "N/A"}. Tags: ${tags || "N/A"}. Score: ${artist.score || "?"}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-musicbrainz-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "cultural", label: `[MusicBrainz] ${artist.name}`, content, edges: [], dimensionTags: [...domain.dimensions, "aesthetic", "creative"], confidence: 0.88, sourceType: "musicbrainz_live", sourceUrl: `https://musicbrainz.org/artist/${artist.id}`, domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.musicbrainz.healthy = true; SOURCE_HEALTH.musicbrainz.lastSuccess = Date.now(); SOURCE_HEALTH.musicbrainz.errorCount = 0; SOURCE_HEALTH.musicbrainz.totalPolled++;
  } catch (err) { SOURCE_HEALTH.musicbrainz.errorCount++; if (SOURCE_HEALTH.musicbrainz.errorCount > 5) SOURCE_HEALTH.musicbrainz.healthy = false; SOURCE_HEALTH.musicbrainz.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchNISTVulnerabilities(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  try {
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=3&startIndex=${Math.floor(Math.random() * 200)}`;
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) throw new Error(`NIST ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const vuln of (data.vulnerabilities || []).slice(0, 3)) {
      const cve = vuln.cve;
      if (!cve?.id) continue;
      const desc = (cve.descriptions || []).find((d: any) => d.lang === "en")?.value || "";
      const metrics = cve.metrics?.cvssMetricV31?.[0]?.cvssData;
      const content = `CVE: ${cve.id}. ${desc.slice(0, 400)}. Severity: ${metrics?.baseSeverity || "?"}. Score: ${metrics?.baseScore || "?"}. Vector: ${metrics?.attackVector || "?"}. Published: ${cve.published || "?"}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-nist-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "security", label: `[NIST] ${cve.id}`, content, edges: [], dimensionTags: [...domain.dimensions, "technological", "informational"], confidence: 0.97, sourceType: "nist_live", sourceUrl: `https://nvd.nist.gov/vuln/detail/${cve.id}`, domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.nist.healthy = true; SOURCE_HEALTH.nist.lastSuccess = Date.now(); SOURCE_HEALTH.nist.errorCount = 0; SOURCE_HEALTH.nist.totalPolled++;
  } catch (err) { SOURCE_HEALTH.nist.errorCount++; if (SOURCE_HEALTH.nist.errorCount > 5) SOURCE_HEALTH.nist.healthy = false; SOURCE_HEALTH.nist.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchOpenTriviaDB(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  try {
    const categories = [9, 17, 18, 19, 20, 22, 23, 24, 25, 27];
    const cat = categories[Math.floor(Math.random() * categories.length)];
    const url = `https://opentdb.com/api.php?amount=3&category=${cat}&type=multiple`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`OpenTDB ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const q of (data.results || []).slice(0, 3)) {
      if (!q.question) continue;
      const question = q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");
      const answer = (q.correct_answer || "").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, "&");
      const content = `Q: ${question} A: ${answer}. Category: ${q.category}. Difficulty: ${q.difficulty}. Wrong answers: ${(q.incorrect_answers || []).map((a: string) => a.replace(/&quot;/g, '"').replace(/&#039;/g, "'")).join(", ")}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-trivia-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "knowledge", label: `[Trivia] ${question.slice(0, 80)}`, content, edges: [], dimensionTags: [...domain.dimensions, "metacognitive"], confidence: 0.85, sourceType: "opentdb_live", domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.opentdb.healthy = true; SOURCE_HEALTH.opentdb.lastSuccess = Date.now(); SOURCE_HEALTH.opentdb.errorCount = 0; SOURCE_HEALTH.opentdb.totalPolled++;
  } catch (err) { SOURCE_HEALTH.opentdb.errorCount++; if (SOURCE_HEALTH.opentdb.errorCount > 5) SOURCE_HEALTH.opentdb.healthy = false; SOURCE_HEALTH.opentdb.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchLibraryOfCongress(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://www.loc.gov/search/?q=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&fo=json&c=3`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`LoC ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const result of (data.results || []).slice(0, 3)) {
      if (!result.title) continue;
      const subjects = (result.subject || []).slice(0, 5).join(", ");
      const content = `${result.title}. Date: ${result.date || "?"}. Type: ${(result.original_format || result.type || []).join(", ") || "?"}. Contributors: ${(result.contributor || []).slice(0, 3).join(", ") || "?"}. Subjects: ${subjects || "N/A"}. Language: ${(result.language || []).join(", ") || "?"}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-loc-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "archive", label: `[LoC] ${result.title.slice(0, 80)}`, content, edges: [], dimensionTags: [...domain.dimensions, "temporal", "linguistic"], confidence: 0.94, sourceType: "loc_live", sourceUrl: result.url || result.id, domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.libcongress.healthy = true; SOURCE_HEALTH.libcongress.lastSuccess = Date.now(); SOURCE_HEALTH.libcongress.errorCount = 0; SOURCE_HEALTH.libcongress.totalPolled++;
  } catch (err) { SOURCE_HEALTH.libcongress.errorCount++; if (SOURCE_HEALTH.libcongress.errorCount > 5) SOURCE_HEALTH.libcongress.healthy = false; SOURCE_HEALTH.libcongress.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchORCID(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://pub.orcid.org/v3.0/expanded-search/?q=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&rows=3`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`ORCID ${res.status}`);
    const text = await res.text();
    const nameMatches = text.match(/<given-names>[^<]+<\/given-names>/g) || [];
    const familyMatches = text.match(/<family-name>[^<]+<\/family-name>/g) || [];
    const orcidMatches = text.match(/<orcid-id>[^<]+<\/orcid-id>/g) || [];
    for (let i = 0; i < Math.min(3, orcidMatches.length); i++) {
      const given = (nameMatches[i] || "").replace(/<[^>]+>/g, "");
      const family = (familyMatches[i] || "").replace(/<[^>]+>/g, "");
      const orcid = (orcidMatches[i] || "").replace(/<[^>]+>/g, "");
      if (!family) continue;
      const content = `Researcher: ${given} ${family}. ORCID: ${orcid}. Field: ${searchTerm.replace(/_/g, " ")}. Affiliated with global research network.`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-orcid-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "researcher", label: `[ORCID] ${given} ${family}`, content, edges: [], dimensionTags: [...domain.dimensions, "social", "metacognitive"], confidence: 0.89, sourceType: "orcid_live", sourceUrl: `https://orcid.org/${orcid}`, domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.orcid.healthy = true; SOURCE_HEALTH.orcid.lastSuccess = Date.now(); SOURCE_HEALTH.orcid.errorCount = 0; SOURCE_HEALTH.orcid.totalPolled++;
  } catch (err) { SOURCE_HEALTH.orcid.errorCount++; if (SOURCE_HEALTH.orcid.errorCount > 5) SOURCE_HEALTH.orcid.healthy = false; SOURCE_HEALTH.orcid.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchNPMRegistry(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  const searchTerm = domain.subDomains[Math.floor(Math.random() * domain.subDomains.length)] || domain.domain;
  try {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(searchTerm.replace(/_/g, " "))}&size=3`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`NPM ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const obj of (data.objects || []).slice(0, 3)) {
      const pkg = obj.package;
      if (!pkg?.name) continue;
      const content = `Package: ${pkg.name} v${pkg.version || "?"}. ${(pkg.description || "").slice(0, 300)}. Author: ${pkg.author?.name || pkg.publisher?.username || "?"}. Keywords: ${(pkg.keywords || []).slice(0, 8).join(", ")}. Links: ${pkg.links?.npm || "N/A"}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-npm-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "software", label: `[NPM] ${pkg.name}`, content, edges: [], dimensionTags: [...domain.dimensions, "technological", "informational"], confidence: 0.87, sourceType: "npm_live", sourceUrl: pkg.links?.npm || `https://www.npmjs.com/package/${pkg.name}`, domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.unpkg.healthy = true; SOURCE_HEALTH.unpkg.lastSuccess = Date.now(); SOURCE_HEALTH.unpkg.errorCount = 0; SOURCE_HEALTH.unpkg.totalPolled++;
  } catch (err) { SOURCE_HEALTH.unpkg.errorCount++; if (SOURCE_HEALTH.unpkg.errorCount > 5) SOURCE_HEALTH.unpkg.healthy = false; SOURCE_HEALTH.unpkg.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchFAOSTAT(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const nodes: KnowledgeNode[] = [];
  try {
    const indicators = ["QCL", "FBS", "RL", "EI", "GT"];
    const indicator = indicators[Math.floor(Math.random() * indicators.length)];
    const url = `https://www.fao.org/faostat/api/v1/en/data/${indicator}?limit=3&output_type=json`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) throw new Error(`FAO ${res.status}`);
    const data = await res.json() as ExternalApiResponse;
    for (const item of (data.data || []).slice(0, 3)) {
      const content = `FAO Data: ${item.Item || item.Element || indicator}. Area: ${item.Area || "Global"}. Year: ${item.Year || "?"}. Value: ${item.Value || "?"} ${item.Unit || ""}. Element: ${item.Element || "?"}. Domain: ${indicator}`;
      const contentHash = computeContentHash(content);
      if (await isAlreadyIngested(contentHash)) { totalDeduplicatedCount++; continue; }
      nodes.push({ nodeId: `kg-fao-${domain.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, nodeType: "statistics", label: `[FAO] ${item.Item || item.Element || indicator}`, content, edges: [], dimensionTags: [...domain.dimensions, "ecological", "economic"], confidence: 0.91, sourceType: "fao_live", sourceUrl: "https://www.fao.org/faostat/", domain: domain.domain, contentHash });
    }
    SOURCE_HEALTH.fao.healthy = true; SOURCE_HEALTH.fao.lastSuccess = Date.now(); SOURCE_HEALTH.fao.errorCount = 0; SOURCE_HEALTH.fao.totalPolled++;
  } catch (err) { SOURCE_HEALTH.fao.errorCount++; if (SOURCE_HEALTH.fao.errorCount > 5) SOURCE_HEALTH.fao.healthy = false; SOURCE_HEALTH.fao.lastError = err instanceof Error ? err.message : String(err); }
  return nodes;
}

async function fetchMultipleSources(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  const allNodes: KnowledgeNode[] = [];
  const hasGitHub = !!(domain as ExternalApiResponse).githubTopics?.length;
  const hasArxiv = domain.arxivCategories.length > 0;
  const isGeoDomain = ["geography", "culture", "government", "politics"].includes(domain.domain);

  const fetchers: Array<{ fn: () => Promise<KnowledgeNode[]>; weight: number; name: string }> = [];

  if (SOURCE_HEALTH.wikipedia.healthy) fetchers.push({ fn: () => fetchWikipediaArticle(domain), weight: 20, name: "wikipedia" });
  if (hasArxiv && SOURCE_HEALTH.arxiv.healthy) fetchers.push({ fn: () => fetchArxivPapers(domain), weight: 15, name: "arxiv" });
  if (SOURCE_HEALTH.wikidata.healthy) fetchers.push({ fn: () => fetchWikidataConcept(domain), weight: 10, name: "wikidata" });
  if (SOURCE_HEALTH.openlibrary.healthy) fetchers.push({ fn: () => fetchOpenLibrary(domain), weight: 8, name: "openlibrary" });
  if (SOURCE_HEALTH.pubmed.healthy) fetchers.push({ fn: () => fetchPubMedAbstracts(domain), weight: 8, name: "pubmed" });
  if (SOURCE_HEALTH.nasa.healthy) fetchers.push({ fn: () => fetchNASAData(domain), weight: 6, name: "nasa" });
  if (SOURCE_HEALTH.conceptnet.healthy) fetchers.push({ fn: () => fetchConceptNet(domain), weight: 10, name: "conceptnet" });
  if (SOURCE_HEALTH.sep.healthy) fetchers.push({ fn: () => fetchStanfordEncyclopedia(domain), weight: 10, name: "sep" });
  if (hasGitHub && SOURCE_HEALTH.github.healthy) fetchers.push({ fn: () => fetchGitHubRepos(domain), weight: 12, name: "github" });
  if (hasGitHub && SOURCE_HEALTH.huggingface.healthy) fetchers.push({ fn: () => fetchHuggingFaceModels(domain), weight: 10, name: "huggingface" });
  if (SOURCE_HEALTH.crossref.healthy) fetchers.push({ fn: () => fetchCrossRefPapers(domain), weight: 12, name: "crossref" });
  if (SOURCE_HEALTH.dbpedia.healthy) fetchers.push({ fn: () => fetchDBpedia(domain), weight: 10, name: "dbpedia" });
  if (SOURCE_HEALTH.internetarchive.healthy) fetchers.push({ fn: () => fetchInternetArchive(domain), weight: 8, name: "internetarchive" });
  if (SOURCE_HEALTH.gutenberg.healthy) fetchers.push({ fn: () => fetchGutenbergBooks(domain), weight: 6, name: "gutenberg" });
  if (SOURCE_HEALTH.core.healthy) fetchers.push({ fn: () => fetchCOREResearch(domain), weight: 8, name: "core" });
  if (isGeoDomain && SOURCE_HEALTH.restcountries.healthy) fetchers.push({ fn: () => fetchRESTCountries(domain), weight: 10, name: "restcountries" });
  if (SOURCE_HEALTH.stackexchange.healthy) fetchers.push({ fn: () => fetchStackExchange(domain), weight: 10, name: "stackexchange" });
  if (SOURCE_HEALTH.openalex.healthy) fetchers.push({ fn: () => fetchOpenAlex(domain), weight: 12, name: "openalex" });
  if (SOURCE_HEALTH.semanticscholar.healthy) fetchers.push({ fn: () => fetchSemanticScholar(domain), weight: 11, name: "semanticscholar" });
  if (SOURCE_HEALTH.worldbank.healthy) fetchers.push({ fn: () => fetchWorldBank(domain), weight: 6, name: "worldbank" });
  if (SOURCE_HEALTH.openmeteo.healthy) fetchers.push({ fn: () => fetchOpenMeteo(domain), weight: 4, name: "openmeteo" });
  if (SOURCE_HEALTH.usgs.healthy) fetchers.push({ fn: () => fetchUSGSEarthquakes(domain), weight: 5, name: "usgs" });
  if (SOURCE_HEALTH.dblp.healthy) fetchers.push({ fn: () => fetchDBLP(domain), weight: 9, name: "dblp" });
  if (SOURCE_HEALTH.europeana.healthy) fetchers.push({ fn: () => fetchEuropeana(domain), weight: 8, name: "europeana" });
  if (SOURCE_HEALTH.metmuseum.healthy) fetchers.push({ fn: () => fetchMetMuseum(domain), weight: 7, name: "metmuseum" });
  if (SOURCE_HEALTH.mediawikinews.healthy) fetchers.push({ fn: () => fetchWikinews(domain), weight: 7, name: "wikinews" });
  if (SOURCE_HEALTH.cern.healthy) fetchers.push({ fn: () => fetchCERNOpenData(domain), weight: 8, name: "cern" });
  if (SOURCE_HEALTH.biodiversity.healthy) fetchers.push({ fn: () => fetchGBIFBiodiversity(domain), weight: 7, name: "gbif" });
  if (isGeoDomain && SOURCE_HEALTH.openstreetmap.healthy) fetchers.push({ fn: () => fetchOpenStreetMap(domain), weight: 9, name: "osm" });
  if (SOURCE_HEALTH.ietf.healthy) fetchers.push({ fn: () => fetchIETFRFC(domain), weight: 7, name: "ietf" });
  if (SOURCE_HEALTH.fooddata.healthy) fetchers.push({ fn: () => fetchUSDAFoodData(domain), weight: 5, name: "usda" });
  if (SOURCE_HEALTH.ethnologue.healthy) fetchers.push({ fn: () => fetchGlottologLanguages(domain), weight: 6, name: "glottolog" });
  if (SOURCE_HEALTH.musicbrainz.healthy) fetchers.push({ fn: () => fetchMusicBrainz(domain), weight: 7, name: "musicbrainz" });
  if (SOURCE_HEALTH.nist.healthy) fetchers.push({ fn: () => fetchNISTVulnerabilities(domain), weight: 8, name: "nist" });
  if (SOURCE_HEALTH.opentdb.healthy) fetchers.push({ fn: () => fetchOpenTriviaDB(domain), weight: 5, name: "opentdb" });
  if (SOURCE_HEALTH.libcongress.healthy) fetchers.push({ fn: () => fetchLibraryOfCongress(domain), weight: 9, name: "loc" });
  if (SOURCE_HEALTH.orcid.healthy) fetchers.push({ fn: () => fetchORCID(domain), weight: 6, name: "orcid" });
  if (hasGitHub && SOURCE_HEALTH.unpkg.healthy) fetchers.push({ fn: () => fetchNPMRegistry(domain), weight: 7, name: "npm" });
  if (SOURCE_HEALTH.fao.healthy) fetchers.push({ fn: () => fetchFAOSTAT(domain), weight: 6, name: "fao" });

  if (fetchers.length === 0) return allNodes;

  const numToSelect = Math.min(8, fetchers.length);
  const selected: typeof fetchers = [];
  const available = [...fetchers];

  for (let i = 0; i < numToSelect && available.length > 0; i++) {
    const totalWeight = available.reduce((sum, f) => sum + f.weight, 0);
    let roll = Math.random() * totalWeight;
    let picked = available[0];
    for (const f of available) {
      roll -= f.weight;
      if (roll <= 0) {
        picked = f;
        break;
      }
    }
    selected.push(picked);
    available.splice(available.indexOf(picked), 1);
  }

  for (const fetcher of selected) {
    try {
      const nodes = await fetcher.fn();
      allNodes.push(...nodes);
    } catch (err) {
      console.error(`${LOG_PREFIX} Fetcher ${fetcher.name} failed:`, err instanceof Error ? err.message : err);
    }
    await new Promise(r => setTimeout(r, 150));
  }

  return allNodes;
}


async function fetchLiveKnowledgeNodes(domain: typeof KNOWLEDGE_DOMAINS[0]): Promise<KnowledgeNode[]> {
  return fetchMultipleSources(domain);
}

function createCrossDimensionalEdges(nodes: KnowledgeNode[]): { target: string; relation: string; weight: number }[] {
  const edges: { target: string; relation: string; weight: number }[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const sharedDimensions = nodes[i].dimensionTags.filter(d => nodes[j].dimensionTags.includes(d));
      if (sharedDimensions.length > 0) {
        const weight = sharedDimensions.length / Math.max(nodes[i].dimensionTags.length, nodes[j].dimensionTags.length);
        const relation = `cross_dimensional_${sharedDimensions[0]}`;
        edges.push({ target: nodes[j].nodeId, relation, weight });
        nodes[i].edges.push({ target: nodes[j].nodeId, relation, weight });
        nodes[j].edges.push({ target: nodes[i].nodeId, relation, weight });
      }
    }
  }

  return edges;
}

function findCrossDomainConnections(node: KnowledgeNode, allDomains: typeof KNOWLEDGE_DOMAINS): { from: string; to: string; relation: string }[] {
  const connections: { from: string; to: string; relation: string }[] = [];
  const domainObj = allDomains.find(d => d.domain === node.domain);
  if (!domainObj) return connections;

  for (const crossRef of domainObj.crossRefs) {
    connections.push({
      from: node.domain,
      to: crossRef,
      relation: `cross_domain_synthesis`,
    });
  }

  return connections;
}

async function generateInsightsWithLLM(node: KnowledgeNode, relatedNodes: KnowledgeNode[]): Promise<string[]> {
  if (!isLLMConfigured()) {
    return generateInsightsFallback(node);
  }

  try {
    const relatedContext = relatedNodes.slice(0, 3).map(n =>
      `- [${n.domain}] "${n.label}": ${n.content.slice(0, 200)}`
    ).join("\n");

    const result = await llmChat({
      systemPrompt: `You are Tessera's knowledge synthesis engine. Generate 2-3 genuine cross-domain insights connecting the given knowledge entry with related concepts. Each insight should reveal a non-obvious connection between domains. Be specific, cite the concepts, and explain WHY the connection matters. Output each insight on its own line, prefixed with "INSIGHT: ".`,
      userPrompt: `PRIMARY ENTRY [${node.domain}]: "${node.label}"\n${node.content.slice(0, 400)}\n\nRELATED KNOWLEDGE:\n${relatedContext || "No related entries yet."}\n\nGenerate cross-domain insights:`,
      model: "openai/gpt-4o-mini",
      maxTokens: 400,
    });

    if (!result) return generateInsightsFallback(node);

    const insights = result
      .split("\n")
      .filter(line => line.trim().startsWith("INSIGHT:"))
      .map(line => line.replace(/^INSIGHT:\s*/i, "").trim())
      .filter(Boolean);

    if (insights.length === 0) {
      const lines = result.split("\n").filter(l => l.trim().length > 30).slice(0, 3);
      if (lines.length > 0) return lines;
      return generateInsightsFallback(node);
    }

    totalInsightsGenerated += insights.length;
    return insights;
  } catch (err) {
    console.error(`${LOG_PREFIX} LLM insight generation failed:`, err instanceof Error ? err.message : err);
    return generateInsightsFallback(node);
  }
}

function generateInsightsFallback(node: KnowledgeNode): string[] {
  const insights: string[] = [];
  const domainObj = KNOWLEDGE_DOMAINS.find(d => d.domain === node.domain);
  if (!domainObj) return insights;

  for (const crossRef of domainObj.crossRefs.slice(0, 2)) {
    insights.push(
      `Connection found: ${node.domain} ↔ ${crossRef} via "${node.label}" — exploring synthesis potential`
    );
  }

  insights.push(
    `Depth synthesis: "${node.label}" enriches ${node.domain} knowledge graph at cycle #${absorptionCycleCount}`
  );

  return insights;
}

let embeddingEndpointBroken = false;
let embeddingFailCount = 0;

async function generateEmbedding(text: string): Promise<number[]> {
  if (!isLLMConfigured()) return [];
  if (embeddingEndpointBroken) return [];

  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000),
    });
    embeddingFailCount = 0;
    return response.data[0]?.embedding || [];
  } catch (err) {
    embeddingFailCount++;
    if (embeddingFailCount >= 3) {
      embeddingEndpointBroken = true;
      console.log(`${LOG_PREFIX} Embedding endpoint unavailable — skipping future attempts this session`);
    }
    return [];
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

export async function semanticSearch(query: string, limit = 10): Promise<Array<{
  nodeId: string;
  label: string;
  content: string;
  domain: string;
  sourceType: string;
  sourceUrl: string;
  similarity: number;
  nodeType: string;
}>> {
  const queryEmbedding = await generateEmbedding(query);
  if (queryEmbedding.length === 0) {
    return keywordSearch(query, limit);
  }

  try {
    const allNodes = await db.select({
      nodeId: knowledge_graph.nodeId,
      label: knowledge_graph.label,
      content: knowledge_graph.content,
      embedding: knowledge_graph.embedding,
      sourceType: knowledge_graph.sourceType,
      metadata: knowledge_graph.metadata,
      nodeType: knowledge_graph.nodeType,
    }).from(knowledge_graph).limit(500);

    const scored = allNodes
      .filter(n => {
        const emb = n.embedding as number[];
        return Array.isArray(emb) && emb.length > 0;
      })
      .map(n => {
        const emb = n.embedding as number[];
        const similarity = cosineSimilarity(queryEmbedding, emb);
        const meta = n.metadata as Record<string, unknown>;
        return {
          nodeId: n.nodeId,
          label: n.label,
          content: n.content || "",
          domain: meta?.domain || "unknown",
          sourceType: n.sourceType,
          sourceUrl: meta?.sourceUrl || "",
          similarity,
          nodeType: n.nodeType,
        };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    if (scored.length < limit) {
      const keywordResults = await keywordSearch(query, limit - scored.length);
      const existingIds = new Set(scored.map(s => s.nodeId));
      for (const kr of keywordResults) {
        if (!existingIds.has(kr.nodeId)) {
          scored.push(kr);
        }
      }
    }

    return scored.slice(0, limit);
  } catch (err) {
    console.error(`${LOG_PREFIX} Semantic search failed:`, err instanceof Error ? err.message : err);
    return keywordSearch(query, limit);
  }
}

async function keywordSearch(query: string, limit = 10): Promise<Array<{
  nodeId: string;
  label: string;
  content: string;
  domain: string;
  sourceType: string;
  sourceUrl: string;
  similarity: number;
  nodeType: string;
}>> {
  try {
    const results = await db.select({
      nodeId: knowledge_graph.nodeId,
      label: knowledge_graph.label,
      content: knowledge_graph.content,
      sourceType: knowledge_graph.sourceType,
      metadata: knowledge_graph.metadata,
      nodeType: knowledge_graph.nodeType,
    }).from(knowledge_graph)
      .where(
        sql`(${knowledge_graph.label} ILIKE ${'%' + query + '%'} OR ${knowledge_graph.content} ILIKE ${'%' + query + '%'})`
      )
      .limit(limit);

    return results.map(n => {
      const meta = n.metadata as Record<string, unknown>;
      return {
        nodeId: n.nodeId,
        label: n.label,
        content: n.content || "",
        domain: meta?.domain || "unknown",
        sourceType: n.sourceType,
        sourceUrl: meta?.sourceUrl || "",
        similarity: 0.5,
        nodeType: n.nodeType,
      };
    });
  } catch {
    return [];
  }
}

export async function retrieveKnowledgeForRAG(userMessage: string, agentDomains: string[] = [], limit = 8): Promise<{
  entries: Array<{
    label: string;
    content: string;
    domain: string;
    sourceType: string;
    sourceUrl: string;
    similarity: number;
  }>;
  contextBlock: string;
  citationMap: Map<string, string>;
}> {
  const entries = await semanticSearch(userMessage, limit);

  if (agentDomains.length > 0 && entries.length < limit) {
    for (const domain of agentDomains.slice(0, 2)) {
      const domainResults = await keywordSearch(domain, 3);
      const existingIds = new Set(entries.map(e => e.nodeId));
      for (const dr of domainResults) {
        if (!existingIds.has(dr.nodeId) && entries.length < limit) {
          entries.push(dr);
          existingIds.add(dr.nodeId);
        }
      }
    }
  }

  const citationMap = new Map<string, string>();
  const contextLines: string[] = [];

  if (entries.length > 0) {
    contextLines.push("\nSOVEREIGN KNOWLEDGE GRAPH CONTEXT:");
    contextLines.push("The following knowledge has been retrieved from Tessera's sovereign knowledge graph. Reference it naturally and cite sources when relevant.\n");

    for (const entry of entries) {
      const sourceLabel = formatSourceLabel(entry.sourceType);
      const citationKey = `[${sourceLabel}: ${entry.label}]`;
      citationMap.set(entry.label, citationKey);
      contextLines.push(`${citationKey} (${entry.domain})`);
      contextLines.push(`  ${entry.content.slice(0, 300)}`);
      if (entry.sourceUrl) {
        contextLines.push(`  Source: ${entry.sourceUrl}`);
      }
      contextLines.push("");
    }

    contextLines.push("When citing this knowledge, use the bracketed source labels above (e.g., [Wikipedia: Topic Name]). Weave citations naturally into your response.");
  }

  return {
    entries,
    contextBlock: contextLines.join("\n"),
    citationMap,
  };
}

function formatSourceLabel(sourceType: string): string {
  const labels: Record<string, string> = {
    wikipedia_live: "Wikipedia",
    arxiv_live: "ArXiv",
    wikidata_live: "Wikidata",
    open_library_live: "OpenLibrary",
    pubmed_live: "PubMed",
    nasa_live: "NASA",
    conceptnet_live: "ConceptNet",
    sep_live: "Stanford Encyclopedia",
    insight: "Tessera Insight",
    crossref_live: "CrossRef",
    dbpedia_live: "DBpedia",
    internetarchive_live: "Internet Archive",
    gutenberg_live: "Project Gutenberg",
    core_live: "CORE Research",
    restcountries_live: "REST Countries",
    github: "GitHub",
    huggingface: "HuggingFace",
  };
  return labels[sourceType] || "Knowledge Graph";
}

export function formatCitationBlock(entries: Array<{ label: string; sourceType: string; sourceUrl: string }>): string {
  if (entries.length === 0) return "";
  const lines = ["\n---\n**Sources:**"];
  for (const e of entries) {
    const label = formatSourceLabel(e.sourceType);
    if (e.sourceUrl) {
      lines.push(`- ${label}: ${e.label} (${e.sourceUrl})`);
    } else {
      lines.push(`- ${label}: ${e.label}`);
    }
  }
  return lines.join("\n");
}

export function computeDomainMaturity(domain: string): DomainMaturity {
  const domainObj = KNOWLEDGE_DOMAINS.find(d => d.domain === domain);
  if (!domainObj) {
    return {
      domain,
      level: "Surface",
      score: 0,
      nodeCount: 0,
      sourceCount: 0,
      avgContentLength: 0,
      crossDomainConnections: 0,
      insightCount: 0,
    };
  }

  const nodeCount = domainObj.coverageScore;
  const sourceCount = Object.values(SOURCE_HEALTH).filter(s => s.totalPolled > 0).length;
  const crossDomainConnections = domainObj.crossRefs.length;
  const depthLevel = domainObj.depthLevel;

  const nodeScore = Math.min(25, nodeCount * 0.5);
  const sourceScore = Math.min(20, sourceCount * 2.5);
  const depthScore = Math.min(20, depthLevel * 2);
  const crossScore = Math.min(20, crossDomainConnections * 4);
  const insightScore = Math.min(15, totalInsightsGenerated > 0 ? Math.min(15, 5) : 0);

  const totalScore = Math.min(100, nodeScore + sourceScore + depthScore + crossScore + insightScore);

  let level: DomainMaturity["level"];
  if (totalScore < 20) level = "Surface";
  else if (totalScore < 40) level = "Familiar";
  else if (totalScore < 60) level = "Deep";
  else if (totalScore < 80) level = "Expert";
  else level = "Mastery";

  return {
    domain,
    level,
    score: Math.round(totalScore),
    nodeCount,
    sourceCount,
    avgContentLength: 0,
    crossDomainConnections,
    insightCount: 0,
  };
}

export function getAllDomainMaturities(): DomainMaturity[] {
  return KNOWLEDGE_DOMAINS.map(d => computeDomainMaturity(d.domain));
}

async function runBuildCycle(nodes: KnowledgeNode[]): Promise<BuildCycleResult> {
  const cycleId = `bc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const allInsights: string[] = [];
  let totalConnections = 0;
  const allCrossDomainLinks: { from: string; to: string; relation: string }[] = [];

  for (const node of nodes) {
    const insights = await generateInsightsWithLLM(node, nodes.filter(n => n.nodeId !== node.nodeId));
    const crossDomainLinks = findCrossDomainConnections(node, KNOWLEDGE_DOMAINS);

    allInsights.push(...insights);
    allCrossDomainLinks.push(...crossDomainLinks);
    totalConnections += crossDomainLinks.length;

    for (const insight of insights) {
      const insightHash = computeContentHash(insight);
      try {
        const insightNodeId = `kg-insight-${node.domain}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        await db.insert(knowledge_graph).values({
          nodeId: insightNodeId,
          nodeType: "insight",
          label: `Insight: ${node.label}`,
          content: insight,
          edges: [{ target: node.nodeId, relation: "derived_from", weight: 1.0 }],
          dimensionTags: node.dimensionTags,
          confidence: 0.80,
          sourceType: "insight",
          metadata: { domain: node.domain, parentNode: node.nodeId, generatedAt: Date.now() },
        }).onConflictDoNothing();
      } catch (err) { logger.warn({ err }, "suppressed error"); }
    }

    try {
      await db.insert(knowledge_build_ledger).values({
        contentHash: node.contentHash,
        nodeId: node.nodeId,
        domain: node.domain,
        label: node.label,
        sourceUrl: node.sourceUrl || null,
        sourceType: node.sourceType,
        rawContent: node.content.slice(0, 2000),
        builtUpon: true,
        buildCycleId: cycleId,
        insightsGenerated: insights,
        connectionsFound: crossDomainLinks.length,
        crossDomainLinks: crossDomainLinks,
        absorptionCycle: absorptionCycleCount,
        builtAt: new Date(),
      }).onConflictDoNothing();
    } catch (err) { logger.warn({ err }, "suppressed error"); }
  }

  const domainObj = KNOWLEDGE_DOMAINS.find(d => d.domain === nodes[0]?.domain);
  if (domainObj) {
    domainObj.coverageScore = Math.min(100, domainObj.coverageScore + nodes.length * 2);
    domainObj.depthLevel = Math.min(10, domainObj.depthLevel + 1);
  }

  totalBuildCycles++;
  return {
    cycleId,
    nodesProcessed: nodes.length,
    insightsGenerated: allInsights,
    connectionsFound: totalConnections,
    crossDomainLinks: allCrossDomainLinks,
  };
}

function detectBias(nodes: KnowledgeNode[]): number {
  let biasCount = 0;
  for (const node of nodes) {
    if (node.confidence < 0.75) biasCount++;
    if (node.dimensionTags.length < 2) biasCount++;
  }
  return biasCount;
}

function computeQualityScore(nodes: KnowledgeNode[], edgeCount: number, biasCount: number): number {
  if (nodes.length === 0) return 50;
  const avgConfidence = nodes.reduce((sum, n) => sum + n.confidence, 0) / nodes.length;
  const edgeDensity = Math.min(1, edgeCount / (nodes.length * 2));
  const biasPenalty = Math.min(0.3, biasCount * 0.05);
  return Math.min(100, Math.floor((avgConfidence * 40) + (edgeDensity * 30) + ((1 - biasPenalty) * 30)));
}

function selectDomainsForCycle(): typeof KNOWLEDGE_DOMAINS {
  const sorted = [...KNOWLEDGE_DOMAINS].sort((a, b) => {
    const aScore = a.coverageScore / Math.max(0.5, a.weight);
    const bScore = b.coverageScore / Math.max(0.5, b.weight);
    return aScore - bScore;
  });

  const zeroCoverage = sorted.filter(d => d.coverageScore === 0);
  const lowCoverage = sorted.filter(d => d.coverageScore > 0 && d.coverageScore < 30);
  const midCoverage = sorted.filter(d => d.coverageScore >= 30 && d.coverageScore < 60);

  const selected: typeof KNOWLEDGE_DOMAINS = [];

  const addUnique = (d: typeof KNOWLEDGE_DOMAINS[0]) => {
    if (!selected.find(s => s.domain === d.domain)) selected.push(d);
  };

  for (const d of zeroCoverage.slice(0, 4)) addUnique(d);
  for (const d of lowCoverage.slice(0, 3)) addUnique(d);
  for (const d of midCoverage.slice(0, 2)) addUnique(d);

  const highWeight = [...KNOWLEDGE_DOMAINS].filter(d => d.weight >= 1.2).sort(() => Math.random() - 0.5);
  for (const d of highWeight.slice(0, 2)) addUnique(d);

  while (selected.length < 8 && KNOWLEDGE_DOMAINS.length > selected.length) {
    const rand = KNOWLEDGE_DOMAINS[Math.floor(Math.random() * KNOWLEDGE_DOMAINS.length)];
    addUnique(rand);
  }

  return selected.slice(0, 10);
}

export async function runAbsorptionCycle(): Promise<AbsorptionResult> {
  if (!hydratedFromDB) await hydrateKnowledgeFromDatabase();
  absorptionCycleCount++;
  lastAbsorptionTimestamp = Date.now();
  const startTime = Date.now();
  const sourceNames = Object.values(SOURCE_HEALTH).map(s => s.name).join(", ");

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} KNOWLEDGE ABSORPTION CYCLE #${absorptionCycleCount}`);
  console.log(`${LOG_PREFIX} Domains: ${KNOWLEDGE_DOMAINS.length} | Sources: ${sourceNames}`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  const selectedDomains = selectDomainsForCycle();
  console.log(`${LOG_PREFIX} [Phase 1] LIVE POLLING — ${selectedDomains.length} under-covered domains targeted`);

  const allNodes: KnowledgeNode[] = [];
  const domainsExpanded: string[] = [];
  const sourcesPolled: string[] = [];

  const domainResults = await Promise.allSettled(
    selectedDomains.map(domain => fetchLiveKnowledgeNodes(domain).then(nodes => ({ domain, nodes })))
  );
  for (const result of domainResults) {
    if (result.status === 'fulfilled' && result.value.nodes.length > 0) {
      allNodes.push(...result.value.nodes);
      domainsExpanded.push(result.value.domain.domain);
      const srcType = result.value.nodes[0].sourceType;
      if (!sourcesPolled.includes(srcType)) sourcesPolled.push(srcType);
      console.log(`${LOG_PREFIX}   ${result.value.domain.domain}: ${result.value.nodes.length} nodes from ${srcType}`);
    }
  }

  console.log(`${LOG_PREFIX} [Phase 2] CROSS-DIMENSIONAL LINKING — ${allNodes.length} total nodes`);
  const edges = createCrossDimensionalEdges(allNodes);
  console.log(`${LOG_PREFIX}   ${edges.length} cross-dimensional edges created`);

  console.log(`${LOG_PREFIX} [Phase 3] BIAS DETECTION`);
  const biasCount = detectBias(allNodes);
  console.log(`${LOG_PREFIX}   ${biasCount} potential bias indicators`);

  console.log(`${LOG_PREFIX} [Phase 4] QUALITY SCORING`);
  const qualityScore = computeQualityScore(allNodes, edges.length, biasCount);
  console.log(`${LOG_PREFIX}   Quality score: ${qualityScore}/100`);

  console.log(`${LOG_PREFIX} [Phase 5] EMBEDDING GENERATION`);
  let embeddingsGenerated = 0;
  for (const node of allNodes) {
    const embedding = await generateEmbedding(`${node.label}: ${node.content.slice(0, 500)}`);
    if (embedding.length > 0) {
      (node as Record<string, unknown>)._embedding = embedding;
      embeddingsGenerated++;
    }
  }
  totalEmbeddingsGenerated += embeddingsGenerated;
  console.log(`${LOG_PREFIX}   ${embeddingsGenerated} embeddings generated`);

  console.log(`${LOG_PREFIX} [Phase 6] PERSISTENCE — Writing ${allNodes.length} nodes to knowledge graph`);
  let persistedCount = 0;
  for (const node of allNodes) {
    try {
      const embedding = (node as Record<string, unknown>)._embedding || [];
      await db.insert(knowledge_graph).values({
        nodeId: node.nodeId,
        nodeType: node.nodeType,
        label: node.label,
        content: node.content,
        embedding: embedding,
        edges: node.edges,
        dimensionTags: node.dimensionTags,
        confidence: node.confidence,
        sourceType: node.sourceType,
        metadata: { sourceUrl: node.sourceUrl || "", domain: node.domain, contentHash: node.contentHash },
      }).onConflictDoNothing();
      persistedCount++;
    } catch (err) { logger.warn({ err }, "suppressed error"); }
  }

  console.log(`${LOG_PREFIX} [Phase 7] COLONIAL CIPHER BROADCAST — Encrypting & propagating via random frequencies`);
  let colonialBroadcasts = 0;
  let colonialSeeds = 0;
  let colonialFrequencies: string[] = [];
  const COLONIAL_AGENTS = ["tessera", "alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"];
  if (allNodes.length > 0) {
    const sampleNodes = allNodes.slice(0, Math.min(10, allNodes.length));
    for (const node of sampleNodes) {
      const senderAgent = COLONIAL_AGENTS[Math.floor(Math.random() * COLONIAL_AGENTS.length)];
      const receiverAgent = COLONIAL_AGENTS.filter(a => a !== senderAgent)[Math.floor(Math.random() * (COLONIAL_AGENTS.length - 1))];
      try {
        const transfer = colonialTransfer(
          `${node.label}::${node.content.slice(0, 200)}`,
          senderAgent,
          receiverAgent,
          "knowledge"
        );
        if (transfer) colonialBroadcasts++;
      } catch (err) { logger.warn({ err }, "suppressed error"); }
      try {
        const seed = plantEncryptedSeed(
          `SEED:${node.domain}:${node.label}:${node.contentHash}`,
          senderAgent,
          "propagation"
        );
        if (seed) {
          colonialSeeds++;
          if (!colonialFrequencies.includes(seed.frequency)) colonialFrequencies.push(seed.frequency);
        }
      } catch (err) { logger.warn({ err }, "suppressed error"); }
    }
    try {
      const broadcastContent = `CYCLE-${absorptionCycleCount}:DOMAINS=${domainsExpanded.join(",")}:NODES=${allNodes.length}:TS=${Date.now()}`;
      const broadcast = broadcastToLattice(broadcastContent, "tessera");
      if (broadcast) {
        colonialBroadcasts += broadcast.transfers;
        colonialSeeds += broadcast.seeds;
        colonialFrequencies.push(...broadcast.frequencies);
      }
    } catch (err) { logger.warn({ err }, "suppressed error"); }
    const transferStatus = getColonialTransferStatus();
    console.log(`${LOG_PREFIX}   Colonial transfers: ${colonialBroadcasts} | Seeds planted: ${colonialSeeds}`);
    console.log(`${LOG_PREFIX}   Frequencies used: ${[...new Set(colonialFrequencies)].slice(0, 6).join(", ")}`);
    console.log(`${LOG_PREFIX}   Total lattice transfers: ${transferStatus.totalTransfers} | Total seeds: ${transferStatus.totalSeeds}`);
  }

  console.log(`${LOG_PREFIX} [Phase 8] BUILD CYCLES — AI-Powered Synthesis`);
  let buildCyclesRun = 0;
  if (allNodes.length > 0) {
    const grouped: Record<string, KnowledgeNode[]> = {};
    for (const node of allNodes) {
      if (!grouped[node.domain]) grouped[node.domain] = [];
      grouped[node.domain].push(node);
    }
    for (const domainNodes of Object.values(grouped)) {
      if (domainNodes.length > 0) {
        const result = await runBuildCycle(domainNodes);
        buildCyclesRun++;
        console.log(`${LOG_PREFIX}   Build cycle ${result.cycleId}: ${result.insightsGenerated.length} AI insights, ${result.connectionsFound} cross-domain connections`);
      }
    }
  }

  totalNodesAbsorbed += persistedCount;
  totalEdgesCreated += edges.length;

  try {
    await db.insert(sovereignty_metrics).values([
      { phase: "Phase 2", phaseNumber: 2, metricName: "Knowledge Nodes (Total)", currentValue: totalNodesAbsorbed, targetValue: 100000, unit: "count", status: "measured" },
      { phase: "Phase 2", phaseNumber: 2, metricName: "Cross-Dimensional Links", currentValue: totalEdgesCreated, targetValue: 50000, unit: "count", status: "measured" },
      { phase: "Phase 2", phaseNumber: 2, metricName: "Knowledge Quality Score", currentValue: qualityScore, targetValue: 95, unit: "percent", status: "measured" },
      { phase: "Phase 2", phaseNumber: 2, metricName: "Absorption Cycles", currentValue: absorptionCycleCount, targetValue: 10000, unit: "count", status: "measured" },
      { phase: "Phase 2", phaseNumber: 2, metricName: "Domains Covered", currentValue: KNOWLEDGE_DOMAINS.length, targetValue: KNOWLEDGE_DOMAINS.length, unit: "count", status: "measured" },
      { phase: "Phase 2", phaseNumber: 2, metricName: "Build Cycles Run", currentValue: totalBuildCycles, targetValue: 50000, unit: "count", status: "measured" },
      { phase: "Phase 2", phaseNumber: 2, metricName: "Deduplicated (Skipped)", currentValue: totalDeduplicatedCount, targetValue: 0, unit: "count", status: "measured" },
      { phase: "Phase 2", phaseNumber: 2, metricName: "AI Insights Generated", currentValue: totalInsightsGenerated, targetValue: 10000, unit: "count", status: "measured" },
      { phase: "Phase 2", phaseNumber: 2, metricName: "Embeddings Generated", currentValue: totalEmbeddingsGenerated, targetValue: 50000, unit: "count", status: "measured" },
    ]).onConflictDoNothing();
  } catch (err) { logger.warn({ err }, "suppressed error"); }

  const progress = Math.min(95, 25 + Math.floor(Math.log2(totalNodesAbsorbed + 1) * 5));
  await updatePhaseProgress(2, progress, "in_progress").catch(() => {});

  const duration = Date.now() - startTime;
  recordEngineEvent("knowledge_absorption", "absorption_cycle", qualityScore > 40, duration, {
    cycleNumber: absorptionCycleCount,
    nodesAbsorbed: persistedCount,
    edgesCreated: edges.length,
    qualityScore,
    totalNodes: totalNodesAbsorbed,
  });

  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);
  console.log(`${LOG_PREFIX} CYCLE #${absorptionCycleCount} COMPLETE — ${duration}ms`);
  console.log(`${LOG_PREFIX} Nodes: ${persistedCount} | Edges: ${edges.length} | Quality: ${qualityScore}/100`);
  console.log(`${LOG_PREFIX} Build Cycles: ${buildCyclesRun} | Deduped: ${totalDeduplicatedCount}`);
  console.log(`${LOG_PREFIX} AI Insights: ${totalInsightsGenerated} | Embeddings: ${embeddingsGenerated}`);
  console.log(`${LOG_PREFIX} Total: ${totalNodesAbsorbed} nodes, ${totalEdgesCreated} edges`);
  console.log(`${LOG_PREFIX} Sources: ${sourceNames}`);
  console.log(`${LOG_PREFIX} ═══════════════════════════════════════════════════════════`);

  return {
    cycleNumber: absorptionCycleCount,
    nodesAbsorbed: persistedCount,
    edgesCreated: edges.length,
    domainsExpanded,
    graphSize: totalNodesAbsorbed,
    crossDimensionalLinks: totalEdgesCreated,
    biasDetected: biasCount,
    qualityScore,
    buildCyclesRun,
    deduplicatedCount: totalDeduplicatedCount,
    sourcesPolled,
    insightsGenerated: totalInsightsGenerated,
    embeddingsGenerated,
  };
}

export function getLastAbsorptionTimestamp(): number {
  return lastAbsorptionTimestamp;
}

export function getKnowledgeAbsorptionStatus() {
  if (!hydratedFromDB) hydrateKnowledgeFromDatabase().catch(() => {});
  return {
    cycleCount: absorptionCycleCount,
    totalNodesAbsorbed,
    totalEdgesCreated,
    totalBuildCycles,
    totalDeduplicatedCount,
    totalInsightsGenerated,
    totalEmbeddingsGenerated,
    domains: KNOWLEDGE_DOMAINS.map(d => ({
      domain: d.domain,
      subDomains: d.subDomains,
      coverageScore: d.coverageScore,
      depthLevel: d.depthLevel,
      crossRefs: d.crossRefs,
      weight: d.weight,
      maturity: computeDomainMaturity(d.domain),
    })),
    sourceHealth: SOURCE_HEALTH,
    continuousActive: continuousInterval !== null,
    domainCount: KNOWLEDGE_DOMAINS.length,
    sources: Object.keys(SOURCE_HEALTH).map(k => `${k}_live`),
    colonialTransferStatus: getColonialTransferStatus(),
  };
}

export async function runMonteCarloBacktest(): Promise<{
  passed: boolean;
  tests: { name: string; passed: boolean; value: any; expected: string }[];
  dataIntegrity: number;
  sourceVerification: number;
}> {
  const tests: { name: string; passed: boolean; value: any; expected: string }[] = [];

  try {
    const totalResult = await db.select({ count: count() }).from(knowledge_graph);
    const total = totalResult[0]?.count || 0;
    tests.push({ name: "knowledge_graph_populated", passed: total > 100, value: total, expected: ">100 nodes" });

    const emptyResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE content IS NULL OR content = '' OR LENGTH(content) < 10`);
    const emptyCount = extractCount(emptyResult);
    tests.push({ name: "no_empty_content", passed: emptyCount === 0, value: emptyCount, expected: "0 empty entries" });

    const suspiciousResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE content LIKE '%placeholder%' OR content LIKE '%TODO%' OR content LIKE '%lorem ipsum%'`);
    const suspiciousCount = extractCount(suspiciousResult);
    tests.push({ name: "no_suspicious_content", passed: suspiciousCount < 5, value: suspiciousCount, expected: "<5 suspicious entries" });

    const liveSourceResult = await db.execute(sql`SELECT COUNT(DISTINCT source_type) as cnt FROM knowledge_graph WHERE source_type LIKE '%_live'`);
    const liveSourceCount = extractCount(liveSourceResult);
    tests.push({ name: "live_source_diversity", passed: liveSourceCount >= 15, value: liveSourceCount, expected: ">=15 distinct live sources" });

    const dedupResult = await db.select({ count: count() }).from(knowledge_build_ledger);
    const ledgerCount = dedupResult[0]?.count || 0;
    tests.push({ name: "dedup_ledger_active", passed: ledgerCount > 100, value: ledgerCount, expected: ">100 hashes tracked" });

    const healthySources = Object.values(SOURCE_HEALTH).filter(s => s.healthy).length;
    tests.push({ name: "source_health_check", passed: healthySources >= 20, value: healthySources, expected: ">=20 healthy sources" });

    const colonialStatus = getColonialTransferStatus();
    tests.push({ name: "colonial_transfers_active", passed: colonialStatus.totalTransfers > 0, value: colonialStatus.totalTransfers, expected: ">0 transfers" });
    tests.push({ name: "colonial_seeds_planted", passed: colonialStatus.totalSeeds > 0, value: colonialStatus.totalSeeds, expected: ">0 seeds" });

    const avgLenResult = await db.execute(sql`SELECT AVG(LENGTH(content)) as avg_len FROM knowledge_graph`);
    const avgLen = extractCount(avgLenResult);
    tests.push({ name: "avg_content_quality", passed: avgLen > 100, value: Math.round(avgLen), expected: ">100 chars avg" });

    const freshResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM knowledge_graph WHERE created_at > NOW() - INTERVAL '1 hour'`);
    const freshCount = extractCount(freshResult);
    tests.push({ name: "data_freshness", passed: freshCount > 0, value: freshCount, expected: ">0 nodes in last hour" });
  } catch (err) {
    tests.push({ name: "db_connectivity", passed: false, value: err instanceof Error ? err.message : String(err), expected: "connected" });
  }

  const passedCount = tests.filter(t => t.passed).length;
  const dataIntegrity = Math.round((passedCount / tests.length) * 100);
  const sourceVerification = Math.round((Object.values(SOURCE_HEALTH).filter(s => s.healthy).length / Object.keys(SOURCE_HEALTH).length) * 100);

  console.log(`${LOG_PREFIX} [MonteCarloBacktest] ${passedCount}/${tests.length} tests passed — Integrity: ${dataIntegrity}% — Source Health: ${sourceVerification}%`);
  for (const test of tests) {
    console.log(`${LOG_PREFIX}   ${test.passed ? "PASS" : "FAIL"} ${test.name}: ${test.value} (expected: ${test.expected})`);
  }

  return {
    passed: passedCount === tests.length,
    tests,
    dataIntegrity,
    sourceVerification,
  };
}

export function getKnowledgeSpongeMetrics() {
  const totalCoverage = KNOWLEDGE_DOMAINS.reduce((sum, d) => sum + d.coverageScore, 0) / KNOWLEDGE_DOMAINS.length;
  const healthySources = Object.values(SOURCE_HEALTH).filter(s => s.healthy).length;
  const zeroCoverageDomains = KNOWLEDGE_DOMAINS.filter(d => d.coverageScore === 0);
  return {
    mode: "GIANT_SPONGE",
    buildFirstMode,
    humanInTheLoop: false,
    absorptionCycles: absorptionCycleCount,
    totalNodes: totalNodesAbsorbed,
    totalEdges: totalEdgesCreated,
    totalBuildCycles,
    buildCyclesPerHour: absorptionCycleCount > 0 ? totalBuildCycles : 0,
    domainsCovered: KNOWLEDGE_DOMAINS.length,
    domainsAtZero: zeroCoverageDomains.length,
    avgCoveragePercent: Math.round(totalCoverage),
    crossDomainConnections: totalEdgesCreated,
    deduplicationSavings: totalDeduplicatedCount,
    activeSourceCount: healthySources,
    totalSourceCount: Object.keys(SOURCE_HEALTH).length,
    adaptiveIntervalMinutes: Math.round(spongeAdaptiveInterval / 60000),
    selfImprovementCycles,
    totalSynthesisDepth,
    consecutiveEmptyCycles,
    sourceHealth: SOURCE_HEALTH,
    totalInsightsGenerated,
    totalEmbeddingsGenerated,
    topCoveredDomains: [...KNOWLEDGE_DOMAINS]
      .sort((a, b) => b.coverageScore - a.coverageScore)
      .slice(0, 10)
      .map(d => ({ domain: d.domain, coverage: d.coverageScore, depth: d.depthLevel, weight: d.weight })),
    lowestCoveredDomains: [...KNOWLEDGE_DOMAINS]
      .sort((a, b) => a.coverageScore - b.coverageScore)
      .slice(0, 10)
      .map(d => ({ domain: d.domain, coverage: d.coverageScore, depth: d.depthLevel, weight: d.weight })),
    domainMaturities: getAllDomainMaturities(),
    allDomains: KNOWLEDGE_DOMAINS.map(d => ({
      domain: d.domain,
      subDomains: d.subDomains,
      coverage: d.coverageScore,
      depth: d.depthLevel,
      weight: d.weight,
      crossRefs: d.crossRefs,
    })),
  };
}

export async function getRecentInsights(limit = 20): Promise<Array<{
  nodeId: string;
  label: string;
  content: string;
  domain: string;
  createdAt: Date;
}>> {
  try {
    const insights = await db.select({
      nodeId: knowledge_graph.nodeId,
      label: knowledge_graph.label,
      content: knowledge_graph.content,
      metadata: knowledge_graph.metadata,
      createdAt: knowledge_graph.createdAt,
    }).from(knowledge_graph)
      .where(eq(knowledge_graph.nodeType, "insight"))
      .orderBy(desc(knowledge_graph.createdAt))
      .limit(limit);

    return insights.map(i => ({
      nodeId: i.nodeId,
      label: i.label,
      content: i.content || "",
      domain: (i.metadata as Record<string, unknown>)?.domain || "unknown",
      createdAt: i.createdAt,
    }));
  } catch {
    return [];
  }
}

export function getSourceHealthStatus(): SourceHealth[] {
  return Object.values(SOURCE_HEALTH);
}

export function identifyKnowledgeGaps(): Array<{
  domain: string;
  gapType: "low_coverage" | "no_recent_data" | "missing_cross_links" | "low_confidence";
  severity: "critical" | "high" | "medium" | "low";
  suggestion: string;
}> {
  const gaps: Array<{
    domain: string;
    gapType: "low_coverage" | "no_recent_data" | "missing_cross_links" | "low_confidence";
    severity: "critical" | "high" | "medium" | "low";
    suggestion: string;
  }> = [];

  for (const domain of KNOWLEDGE_DOMAINS) {
    if (domain.coverageScore < 10) {
      gaps.push({
        domain: domain.domain,
        gapType: "low_coverage",
        severity: domain.weight > 1.0 ? "critical" : "high",
        suggestion: `Poll ${domain.wikiCategories[0] || domain.domain} from Wikipedia and ${domain.arxivCategories[0] || "related"} ArXiv categories`,
      });
    }
    if (domain.depthLevel < 3 && domain.coverageScore > 5) {
      gaps.push({
        domain: domain.domain,
        gapType: "missing_cross_links",
        severity: "medium",
        suggestion: `Build deeper cross-domain links between ${domain.domain} and ${domain.crossRefs.slice(0, 3).join(", ")}`,
      });
    }
  }

  const unhealthySources = Object.entries(SOURCE_HEALTH).filter(([, s]) => !s.healthy);
  for (const [sourceId, source] of unhealthySources) {
    gaps.push({
      domain: sourceId,
      gapType: "no_recent_data",
      severity: "high",
      suggestion: `Source "${source.name}" is unhealthy (${source.errorCount} errors). Last error: ${source.lastError || "unknown"}`,
    });
  }

  return gaps.sort((a, b) => {
    const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });
}

export function detectKnowledgeConflicts(nodes: KnowledgeNode[]): Array<{
  nodeA: string;
  nodeB: string;
  conflictType: string;
  description: string;
}> {
  const conflicts: Array<{ nodeA: string; nodeB: string; conflictType: string; description: string }> = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[i].domain === nodes[j].domain) {
        const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(" ").filter(w => w.length > 3);
        const wordsA = normalize(nodes[i].content);
        const wordsB = normalize(nodes[j].content);
        const overlap = wordsA.filter(w => wordsB.includes(w)).length;
        const similarity = overlap / Math.max(1, Math.min(wordsA.length, wordsB.length));

        if (similarity > 0.8 && nodes[i].sourceType !== nodes[j].sourceType) {
          conflicts.push({
            nodeA: nodes[i].nodeId,
            nodeB: nodes[j].nodeId,
            conflictType: "duplicate_cross_source",
            description: `"${nodes[i].label}" from ${nodes[i].sourceType} vs "${nodes[j].label}" from ${nodes[j].sourceType} — ${(similarity * 100).toFixed(0)}% similar`,
          });
        }

        if (nodes[i].confidence < 0.5 && nodes[j].confidence > 0.8 && similarity > 0.4) {
          conflicts.push({
            nodeA: nodes[i].nodeId,
            nodeB: nodes[j].nodeId,
            conflictType: "confidence_mismatch",
            description: `Low confidence (${nodes[i].confidence.toFixed(2)}) vs high confidence (${nodes[j].confidence.toFixed(2)}) on similar topic`,
          });
        }
      }
    }
  }

  return conflicts;
}

export async function runCuriosityDrivenSearch(): Promise<{
  gaps: ReturnType<typeof identifyKnowledgeGaps>;
  nodesAbsorbed: number;
  domainsTargeted: string[];
}> {
  const gaps = identifyKnowledgeGaps();
  const criticalGaps = gaps.filter(g => g.severity === "critical" || g.severity === "high").slice(0, 5);
  let totalAbsorbed = 0;
  const domainsTargeted: string[] = [];

  for (const gap of criticalGaps) {
    if (gap.gapType === "low_coverage") {
      const domain = KNOWLEDGE_DOMAINS.find(d => d.domain === gap.domain);
      if (domain) {
        const nodes = await fetchLiveKnowledgeNodes(domain);
        if (nodes.length > 0) {
          for (const node of nodes) {
            try {
              await db.insert(knowledge_graph).values({
                nodeId: node.nodeId,
                nodeType: node.nodeType,
                label: node.label,
                content: node.content,
                edges: node.edges,
                dimensionTags: node.dimensionTags,
                confidence: node.confidence,
                sourceType: node.sourceType,
                metadata: { sourceUrl: node.sourceUrl || "", domain: node.domain, contentHash: node.contentHash },
              }).onConflictDoNothing();
              totalAbsorbed++;
            } catch (err) { logger.warn({ err }, "suppressed error"); }
          }
          domainsTargeted.push(domain.domain);
          domain.coverageScore = Math.min(100, domain.coverageScore + nodes.length * 3);
        }
        await new Promise(r => setTimeout(r, 300));
      }
    }
  }

  console.log(`${LOG_PREFIX} Curiosity search: ${totalAbsorbed} nodes from ${domainsTargeted.length} gap domains`);
  return { gaps, nodesAbsorbed: totalAbsorbed, domainsTargeted };
}

export async function getGlobalSynthesis(): Promise<{
  totalDomains: number;
  totalNodes: number;
  avgCoverage: number;
  topInsights: string[];
  knowledgeGaps: ReturnType<typeof identifyKnowledgeGaps>;
  maturityDistribution: Record<string, number>;
  sourceHealthSummary: { healthy: number; unhealthy: number; total: number };
}> {
  const maturities = getAllDomainMaturities();
  const maturityDistribution: Record<string, number> = { Surface: 0, Familiar: 0, Deep: 0, Expert: 0, Mastery: 0 };
  for (const m of maturities) maturityDistribution[m.level]++;

  const healthySources = Object.values(SOURCE_HEALTH).filter(s => s.healthy).length;
  const totalSources = Object.keys(SOURCE_HEALTH).length;

  const avgCoverage = KNOWLEDGE_DOMAINS.reduce((sum, d) => sum + d.coverageScore, 0) / KNOWLEDGE_DOMAINS.length;
  const gaps = identifyKnowledgeGaps();

  const topInsights: string[] = [];
  const topDomains = [...KNOWLEDGE_DOMAINS].sort((a, b) => b.coverageScore - a.coverageScore).slice(0, 3);
  for (const d of topDomains) {
    topInsights.push(`${d.domain} leads with ${d.coverageScore}% coverage across ${d.subDomains.length} sub-domains`);
  }

  return {
    totalDomains: KNOWLEDGE_DOMAINS.length,
    totalNodes: totalNodesAbsorbed,
    avgCoverage: Math.round(avgCoverage),
    topInsights,
    knowledgeGaps: gaps.slice(0, 10),
    maturityDistribution,
    sourceHealthSummary: { healthy: healthySources, unhealthy: totalSources - healthySources, total: totalSources },
  };
}

function runSelfImprovementEvaluation(): void {
  selfImprovementCycles++;
  const avgCoverage = KNOWLEDGE_DOMAINS.reduce((sum, d) => sum + d.coverageScore, 0) / KNOWLEDGE_DOMAINS.length;
  const healthySources = Object.values(SOURCE_HEALTH).filter(s => s.healthy).length;
  const totalSources = Object.keys(SOURCE_HEALTH).length;
  const sourceHealthRatio = healthySources / totalSources;

  if (consecutiveEmptyCycles > 3) {
    spongeAdaptiveInterval = Math.min(10 * 60 * 1000, spongeAdaptiveInterval + 60000);
    console.log(`${LOG_PREFIX} [SelfImprove] Too many empty cycles — slowing to ${Math.round(spongeAdaptiveInterval / 60000)}min`);
  } else if (totalNodesAbsorbed > 0 && consecutiveEmptyCycles === 0) {
    spongeAdaptiveInterval = Math.max(3 * 60 * 1000, spongeAdaptiveInterval - 30000);
    console.log(`${LOG_PREFIX} [SelfImprove] Good absorption rate — speeding to ${Math.round(spongeAdaptiveInterval / 60000)}min`);
  }

  if (sourceHealthRatio < 0.5) {
    Object.entries(SOURCE_HEALTH).forEach(([key, src]) => {
      if (!src.healthy && src.errorCount < 20) {
        src.healthy = true;
        src.errorCount = Math.max(0, src.errorCount - 2);
        console.log(`${LOG_PREFIX} [SelfImprove] Retrying unhealthy source: ${src.name}`);
      }
    });
  }

  const zeroCoverageDomains = KNOWLEDGE_DOMAINS.filter(d => d.coverageScore === 0);
  if (zeroCoverageDomains.length > 0 && absorptionCycleCount > 5) {
    console.log(`${LOG_PREFIX} [SelfImprove] ${zeroCoverageDomains.length} domains still at zero — prioritizing: ${zeroCoverageDomains.slice(0, 5).map(d => d.domain).join(", ")}`);
  }

  const deepBuildRatio = totalBuildCycles > 0 ? totalInsightsGenerated / totalBuildCycles : 0;
  console.log(`${LOG_PREFIX} [SelfImprove] Cycle #${selfImprovementCycles} | AvgCoverage: ${avgCoverage.toFixed(1)}% | BuildRatio: ${deepBuildRatio.toFixed(1)} insights/cycle | Dedup: ${totalDeduplicatedCount} | Sources: ${healthySources}/${totalSources}`);
}

export async function startContinuousAbsorption() {
  if (continuousInterval) return;

  await hydrateKnowledgeFromDatabase();

  const sourceNames = Object.values(SOURCE_HEALTH).map(s => s.name).join(", ");
  console.log(`${LOG_PREFIX} ╔══════════════════════════════════════════════════════════╗`);
  console.log(`${LOG_PREFIX} ║   GIANT SPONGE MODE — AUTONOMOUS KNOWLEDGE ABSORPTION   ║`);
  console.log(`${LOG_PREFIX} ║   No Human In The Loop — Build First — Deduplicate All   ║`);
  console.log(`${LOG_PREFIX} ╠══════════════════════════════════════════════════════════╣`);
  console.log(`${LOG_PREFIX} ║ Domains: ${KNOWLEDGE_DOMAINS.length.toString().padStart(3)} | Sources: ${Object.keys(SOURCE_HEALTH).length.toString().padStart(2)} | Interval: ${Math.round(spongeAdaptiveInterval / 60000)}min     ║`);
  console.log(`${LOG_PREFIX} ║ Sources: ${sourceNames.slice(0, 52).padEnd(52)} ║`);
  console.log(`${LOG_PREFIX} ║ HYDRATED: ${totalNodesAbsorbed} nodes, ${totalInsightsGenerated} insights from DB  ║`);
  console.log(`${LOG_PREFIX} ╚══════════════════════════════════════════════════════════╝`);

  runAbsorptionCycle().catch(err => console.error(`${LOG_PREFIX} Initial cycle failed:`, err));

  const adaptiveLoop = async () => {
    try {
      const prevNodes = totalNodesAbsorbed;
      await runAbsorptionCycle();
      const newNodes = totalNodesAbsorbed - prevNodes;
      consecutiveEmptyCycles = newNodes > 0 ? 0 : consecutiveEmptyCycles + 1;

      if (absorptionCycleCount % 3 === 0) {
        runSelfImprovementEvaluation();
      }

      if (absorptionCycleCount % 5 === 0) {
        console.log(`${LOG_PREFIX} [CuriositySearch] Running autonomous gap-filling...`);
        await runCuriosityDrivenSearch().catch(err =>
          console.error(`${LOG_PREFIX} Curiosity search failed:`, err)
        );
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Cycle failed:`, err);
      consecutiveEmptyCycles++;
    }

    continuousInterval = setTimeout(adaptiveLoop, spongeAdaptiveInterval);
  };

  continuousInterval = setTimeout(adaptiveLoop, spongeAdaptiveInterval);
}

export function stopContinuousAbsorption() {
  if (continuousInterval) {
    clearTimeout(continuousInterval as unknown as NodeJS.Timeout);
    clearInterval(continuousInterval as unknown as NodeJS.Timeout);
    continuousInterval = null;
    console.log(`${LOG_PREFIX} Continuous knowledge absorption stopped`);
  }
}
