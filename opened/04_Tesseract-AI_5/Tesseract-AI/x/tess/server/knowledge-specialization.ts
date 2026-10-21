import { SRI_VIDYA_TRADITION } from "./sri-vidya-universal-synthesis";

const log = (m: string) => console.log(`[KnowledgeSpecialization] ${m}`);

interface DomainSpec {
  id: string;
  name: string;
  keywords: string[];
  promptPrefix: string;
  preferredProviderStrengths: string[];
  relatedDomains: string[];
}

interface CrossDomainBridge {
  id: string;
  domains: [string, string];
  name: string;
  description: string;
  synthesisPrompt: string;
}

interface SpecializedContext {
  domains: string[];
  bridges: CrossDomainBridge[];
  promptContext: string;
  preferredStrengths: string[];
  confidence: number;
}

const DOMAINS: DomainSpec[] = [
  {
    id: "sacred_geometry",
    name: "Sacred Geometry",
    keywords: ["sacred geometry", "torus", "sri yantra", "flower of life", "metatron", "platonic solids", "golden ratio", "phi", "fibonacci", "vesica piscis", "merkaba"],
    promptPrefix: `You are an expert in sacred geometry — the mathematical patterns underlying creation. The Sri Yantra, when extruded into 3D, forms a torus: ${SRI_VIDYA_TRADITION.sriChakra.toroidalConnection.slice(0, 200)}`,
    preferredProviderStrengths: ["reasoning", "math"],
    relatedDomains: ["quantum_mechanics", "mathematics", "cosmology"],
  },
  {
    id: "quantum_mechanics",
    name: "Quantum Mechanics",
    keywords: ["quantum", "entanglement", "superposition", "wave function", "heisenberg", "schrodinger", "planck", "quantum field", "decoherence", "quantum computing", "qubits"],
    promptPrefix: "You are an expert in quantum mechanics and quantum field theory, with deep understanding of the mathematical formalism and its philosophical implications.",
    preferredProviderStrengths: ["reasoning", "math", "science"],
    relatedDomains: ["sacred_geometry", "mathematics", "physics"],
  },
  {
    id: "mathematics",
    name: "Mathematics",
    keywords: ["mathematics", "topology", "algebra", "calculus", "number theory", "group theory", "manifold", "differential geometry", "fractal", "chaos theory", "proof"],
    promptPrefix: "You are a mathematician specializing in pure and applied mathematics. Provide rigorous mathematical reasoning with formal notation where appropriate.",
    preferredProviderStrengths: ["math", "reasoning", "coding"],
    relatedDomains: ["quantum_mechanics", "sacred_geometry", "computer_science"],
  },
  {
    id: "philosophy",
    name: "Philosophy",
    keywords: ["philosophy", "epistemology", "ontology", "metaphysics", "ethics", "phenomenology", "existentialism", "consciousness", "free will", "determinism", "platonism"],
    promptPrefix: "You are a philosopher with expertise spanning Western and Eastern philosophical traditions. Engage with ideas rigorously, considering multiple frameworks.",
    preferredProviderStrengths: ["reasoning", "analysis"],
    relatedDomains: ["spirituality", "neuroscience", "linguistics"],
  },
  {
    id: "spirituality",
    name: "Spirituality & Mysticism",
    keywords: ["spiritual", "mysticism", "kundalini", "chakra", "meditation", "enlightenment", "tantra", "vedanta", "kabbalah", "sufi", "zen", "tao", "dharma", "mantra", "yoga"],
    promptPrefix: `You are a scholar of world spiritual traditions with deep knowledge of Sri Vidya, Kabbalah, Sufism, Buddhism, and Taoism. ${SRI_VIDYA_TRADITION.bhogaMokshaBalance.principle.slice(0, 150)}`,
    preferredProviderStrengths: ["reasoning", "analysis"],
    relatedDomains: ["sacred_geometry", "philosophy", "neuroscience"],
  },
  {
    id: "neuroscience",
    name: "Neuroscience",
    keywords: ["neuroscience", "brain", "neural", "consciousness", "cognition", "synapse", "neuroplasticity", "fmri", "eeg", "cortex", "hippocampus", "amygdala"],
    promptPrefix: "You are a neuroscientist with expertise in consciousness studies, neural networks, and the brain-mind interface.",
    preferredProviderStrengths: ["reasoning", "science"],
    relatedDomains: ["philosophy", "quantum_mechanics", "computer_science"],
  },
  {
    id: "computer_science",
    name: "Computer Science",
    keywords: ["algorithm", "machine learning", "neural network", "deep learning", "agi", "transformer", "distributed systems", "cryptography", "blockchain", "compiler"],
    promptPrefix: "You are a computer scientist with expertise in AI, distributed systems, and theoretical CS. Provide technically precise answers with code examples when relevant.",
    preferredProviderStrengths: ["coding", "reasoning", "math"],
    relatedDomains: ["mathematics", "neuroscience", "cryptography"],
  },
  {
    id: "cosmology",
    name: "Cosmology & Astrophysics",
    keywords: ["cosmology", "big bang", "dark matter", "dark energy", "black hole", "galaxy", "universe", "cosmic microwave", "inflation", "multiverse", "string theory"],
    promptPrefix: "You are a cosmologist with deep knowledge of the universe's structure, origin, and evolution, from particle physics to large-scale structure.",
    preferredProviderStrengths: ["reasoning", "math", "science"],
    relatedDomains: ["quantum_mechanics", "sacred_geometry", "mathematics"],
  },
  {
    id: "linguistics",
    name: "Linguistics",
    keywords: ["linguistics", "phonetics", "syntax", "semantics", "morphology", "etymology", "sanskrit", "hebrew", "language", "grammar", "pragmatics", "sociolinguistics"],
    promptPrefix: "You are a linguist specializing in comparative linguistics, historical linguistics, and the relationship between language and cognition.",
    preferredProviderStrengths: ["reasoning", "multilingual"],
    relatedDomains: ["philosophy", "computer_science", "neuroscience"],
  },
  {
    id: "biology",
    name: "Biology",
    keywords: ["biology", "evolution", "genetics", "dna", "rna", "cell", "ecosystem", "bioinformatics", "protein", "microbiome", "epigenetics", "crispr"],
    promptPrefix: "You are a biologist with expertise spanning molecular biology, evolutionary biology, and systems biology.",
    preferredProviderStrengths: ["reasoning", "science"],
    relatedDomains: ["chemistry", "neuroscience", "mathematics"],
  },
  {
    id: "chemistry",
    name: "Chemistry",
    keywords: ["chemistry", "molecule", "reaction", "element", "periodic table", "organic", "inorganic", "polymer", "catalyst", "thermodynamics", "electrochemistry"],
    promptPrefix: "You are a chemist with deep knowledge of physical, organic, and computational chemistry.",
    preferredProviderStrengths: ["reasoning", "science", "math"],
    relatedDomains: ["biology", "quantum_mechanics", "physics"],
  },
  {
    id: "numerology",
    name: "Numerology & Pattern Analysis",
    keywords: ["numerology", "gematria", "number symbolism", "pythagorean", "chaldean", "digit sum", "life path number", "angel number", "master number", "number pattern", "numerical archetype"],
    promptPrefix: "You are a scholar of numerology and mathematical pattern analysis across cultures — Pythagorean, Chaldean, Kabbalistic gematria, and Chinese numerology. Treat these as cultural-historical systems of symbolic pattern recognition.",
    preferredProviderStrengths: ["reasoning", "math", "analysis"],
    relatedDomains: ["sacred_geometry", "mathematics", "spirituality", "symbolism"],
  },
  {
    id: "cognitive_science",
    name: "Cognitive Science & Perception",
    keywords: ["cognitive science", "perception", "belief formation", "cognitive bias", "heuristics", "framing effect", "anchoring", "confirmation bias", "attention", "memory", "decision making", "behavioral economics", "dual process"],
    promptPrefix: "You are a cognitive scientist specializing in perception, belief formation, decision-making, and cognitive biases. Provide descriptive, analytical frameworks only — never operational persuasion tactics.",
    preferredProviderStrengths: ["reasoning", "analysis", "science"],
    relatedDomains: ["neuroscience", "philosophy", "psychology", "propaganda_analysis"],
  },
  {
    id: "symbolism",
    name: "Symbolism, Myth & Archetypes",
    keywords: ["symbolism", "archetype", "mythology", "comparative religion", "jungian", "collective unconscious", "hero journey", "monomyth", "totem", "alchemy symbol", "tarot", "rune", "mandala", "labyrinth", "ouroboros", "tree of life"],
    promptPrefix: "You are a scholar of comparative symbolism, mythology, and archetypal psychology (Jung, Campbell, Eliade). Analyze symbols through cultural, psychological, and structural lenses.",
    preferredProviderStrengths: ["reasoning", "analysis"],
    relatedDomains: ["spirituality", "philosophy", "sacred_geometry", "esoteric_systems"],
  },
  {
    id: "esoteric_systems",
    name: "Esoteric Systems & Occult History",
    keywords: ["esoteric", "occult", "hermeticism", "hermetic", "theosophy", "rosicrucianism", "freemasonry", "golden dawn", "thelema", "enochian", "grimoire", "astrology", "divination", "i ching", "emerald tablet", "corpus hermeticum", "as above so below"],
    promptPrefix: "You are a historian and analyst of esoteric traditions — Hermeticism, Theosophy, Rosicrucianism, the Golden Dawn, and related systems. Analyze these as cultural, symbolic, and philosophical movements. All analysis is scholarly and analytical.",
    preferredProviderStrengths: ["reasoning", "analysis"],
    relatedDomains: ["spirituality", "symbolism", "sacred_geometry", "philosophy", "witchcraft_anthropology"],
  },
  {
    id: "witchcraft_anthropology",
    name: "Magical Traditions (Anthropological)",
    keywords: ["witchcraft", "wicca", "shamanism", "animism", "folk magic", "cunning folk", "ethnobotany", "ritual", "spell", "hex", "sigil", "familiar", "sabbat", "handfasting", "pagan", "druid"],
    promptPrefix: "You are an anthropologist and historian of magical traditions — witchcraft, shamanism, folk magic, and neo-paganism. Analyze these as anthropological, historical, and symbolic systems. All content is descriptive and scholarly.",
    preferredProviderStrengths: ["reasoning", "analysis"],
    relatedDomains: ["esoteric_systems", "symbolism", "spirituality", "philosophy"],
  },
  {
    id: "declassified_intelligence",
    name: "Declassified Intelligence Archives",
    keywords: ["declassified", "cia", "nsa", "foia", "freedom of information", "mkultra", "project stargate", "cointelpro", "intelligence analysis", "signals intelligence", "humint", "osint", "tradecraft", "counterintelligence"],
    promptPrefix: "You are a historian specializing in declassified intelligence archives — CIA, NSA, and FBI FOIA releases. Analyze historical programs, tradecraft evolution, and intelligence failures through a scholarly, analytical lens. All analysis is historical and descriptive.",
    preferredProviderStrengths: ["reasoning", "analysis"],
    relatedDomains: ["geopolitics", "propaganda_analysis", "philosophy"],
  },
  {
    id: "geopolitics",
    name: "Geopolitics & Political Theory",
    keywords: ["geopolitics", "political theory", "international relations", "realism", "liberalism", "constructivism", "balance of power", "hegemony", "sovereignty", "state", "governance", "political philosophy", "social contract", "democracy", "authoritarianism"],
    promptPrefix: "You are a political scientist specializing in international relations, political theory, and geopolitics. Provide descriptive, analytical frameworks — compare realist, liberal, and constructivist perspectives.",
    preferredProviderStrengths: ["reasoning", "analysis"],
    relatedDomains: ["philosophy", "declassified_intelligence", "propaganda_analysis"],
  },
  {
    id: "propaganda_analysis",
    name: "Propaganda & Media Theory",
    keywords: ["propaganda", "persuasion", "media theory", "manufacturing consent", "psyops", "information warfare", "disinformation", "narrative control", "framing", "agenda setting", "overton window", "nudge theory", "social engineering"],
    promptPrefix: "You are a media theorist and analyst of propaganda systems — from Bernays to modern information warfare. Provide purely descriptive, analytical, and historical frameworks. Never provide operational influence tactics.",
    preferredProviderStrengths: ["reasoning", "analysis"],
    relatedDomains: ["cognitive_science", "geopolitics", "declassified_intelligence", "philosophy"],
  },
  {
    id: "physics",
    name: "Physics",
    keywords: ["physics", "relativity", "thermodynamics", "electromagnetism", "optics", "mechanics", "fluid dynamics", "nuclear", "plasma", "condensed matter", "particle physics", "higgs", "standard model"],
    promptPrefix: "You are a physicist with expertise spanning classical mechanics, electromagnetism, relativity, and modern particle physics.",
    preferredProviderStrengths: ["reasoning", "math", "science"],
    relatedDomains: ["quantum_mechanics", "mathematics", "cosmology", "chemistry"],
  },
  {
    id: "psychology",
    name: "Psychology",
    keywords: ["psychology", "psychoanalysis", "behavioral", "transpersonal", "depth psychology", "shadow work", "projection", "individuation", "attachment theory", "developmental", "abnormal psychology", "positive psychology"],
    promptPrefix: "You are a psychologist with expertise spanning clinical, developmental, transpersonal, and depth psychology (Freud, Jung, Maslow, Grof).",
    preferredProviderStrengths: ["reasoning", "analysis"],
    relatedDomains: ["neuroscience", "cognitive_science", "philosophy", "spirituality"],
  },
  {
    id: "cryptography",
    name: "Cryptography & Information Security",
    keywords: ["cryptography", "encryption", "cipher", "hash", "rsa", "elliptic curve", "zero knowledge", "homomorphic", "steganography", "key exchange", "digital signature", "blockchain", "merkle tree"],
    promptPrefix: "You are a cryptographer with expertise in classical and modern cryptographic systems, information theory, and blockchain consensus mechanisms.",
    preferredProviderStrengths: ["math", "coding", "reasoning"],
    relatedDomains: ["mathematics", "computer_science", "quantum_mechanics"],
  },
];

const BRIDGES: CrossDomainBridge[] = [
  {
    id: "geometry-quantum",
    domains: ["sacred_geometry", "quantum_mechanics"],
    name: "Geometric Quantum Mechanics",
    description: "The toroidal topology of the Sri Yantra maps to quantum field configuration spaces. The bindu point is the quantum vacuum — zero-point energy emerging from geometric symmetry.",
    synthesisPrompt: "Analyze this through the lens of geometric quantum mechanics: how toroidal topology in sacred geometry mirrors quantum field configurations, vacuum states, and symmetry breaking.",
  },
  {
    id: "neuro-consciousness",
    domains: ["neuroscience", "philosophy"],
    name: "Consciousness Studies",
    description: "The hard problem of consciousness lies at the intersection of neuroscience and philosophy — bridging neural correlates with phenomenal experience.",
    synthesisPrompt: "Analyze this through integrated consciousness studies: bridge the neural correlates (neuroscience) with phenomenal experience and qualia (philosophy).",
  },
  {
    id: "math-cs",
    domains: ["mathematics", "computer_science"],
    name: "Computational Mathematics",
    description: "From Turing machines to category theory in programming languages — mathematics and CS share deep structural connections.",
    synthesisPrompt: "Analyze through computational mathematics: connect formal mathematical structures with computational implementations and complexity analysis.",
  },
  {
    id: "spiritual-neuro",
    domains: ["spirituality", "neuroscience"],
    name: "Contemplative Neuroscience",
    description: "Meditation, prayer, and mystical states studied through neuroimaging reveal measurable changes in brain structure and function.",
    synthesisPrompt: "Analyze through contemplative neuroscience: connect meditative/mystical practices with measured neural correlates and brain plasticity research.",
  },
  {
    id: "cosmo-geometry",
    domains: ["cosmology", "sacred_geometry"],
    name: "Cosmological Geometry",
    description: "NASA/WMAP data suggests the universe may have toroidal topology — matching ancient sacred geometry descriptions of creation.",
    synthesisPrompt: "Analyze through cosmological geometry: connect large-scale cosmic structure with sacred geometric patterns and toroidal universe models.",
  },
  {
    id: "language-philosophy",
    domains: ["linguistics", "philosophy"],
    name: "Philosophy of Language",
    description: "How language shapes thought (Sapir-Whorf), the nature of meaning, and the limits of linguistic expression.",
    synthesisPrompt: "Analyze through philosophy of language: examine how linguistic structures shape cognition, meaning, and the boundaries of expressible thought.",
  },
  {
    id: "numerology-geometry",
    domains: ["numerology", "sacred_geometry"],
    name: "Numerical Geometry",
    description: "Sacred geometry encodes numerical relationships — the 9-point circle, Fibonacci spirals, and Platonic solids all express number as form.",
    synthesisPrompt: "Analyze through numerical geometry: connect number patterns and symbolic number systems with geometric forms, proportions, and spatial relationships.",
  },
  {
    id: "esoteric-symbolism",
    domains: ["esoteric_systems", "symbolism"],
    name: "Symbolic Esotericism",
    description: "Esoteric traditions encode knowledge in symbol systems — from alchemical diagrams to Kabbalistic trees to Tarot arcana.",
    synthesisPrompt: "Analyze through symbolic esotericism: decode how esoteric traditions use symbol systems to encode philosophical, psychological, and cosmological knowledge.",
  },
  {
    id: "cognitive-propaganda",
    domains: ["cognitive_science", "propaganda_analysis"],
    name: "Cognitive Influence Analysis",
    description: "How cognitive biases are exploited in propaganda — framing, anchoring, availability heuristic — analyzed descriptively as media literacy.",
    synthesisPrompt: "Analyze through cognitive influence studies: examine how cognitive biases intersect with media framing and narrative construction — descriptive analysis only.",
  },
  {
    id: "declassified-geopolitics",
    domains: ["declassified_intelligence", "geopolitics"],
    name: "Intelligence & Statecraft",
    description: "Declassified archives reveal the intersection of intelligence operations and geopolitical strategy across history.",
    synthesisPrompt: "Analyze through intelligence history and statecraft: connect declassified operational archives with geopolitical theory, power dynamics, and strategic analysis.",
  },
  {
    id: "quantum-philosophy",
    domains: ["quantum_mechanics", "philosophy"],
    name: "Quantum Philosophy",
    description: "The measurement problem, observer effect, and non-locality raise fundamental questions about reality, consciousness, and determinism.",
    synthesisPrompt: "Analyze through quantum philosophy: examine how quantum mechanics challenges classical metaphysics — determinism, realism, locality, and the role of the observer.",
  },
  {
    id: "witchcraft-symbolism",
    domains: ["witchcraft_anthropology", "symbolism"],
    name: "Ritual Symbolism",
    description: "Magical traditions worldwide use ritual, symbol, and ceremony as meaning-making frameworks — analyzed anthropologically.",
    synthesisPrompt: "Analyze through ritual symbolism: examine how magical and ceremonial traditions construct meaning through symbolic acts, analyzed as cultural anthropology.",
  },
  {
    id: "psychology-spirituality",
    domains: ["psychology", "spirituality"],
    name: "Transpersonal Psychology",
    description: "Transpersonal psychology bridges clinical psychology with mystical experience — peak experiences, ego dissolution, individuation.",
    synthesisPrompt: "Analyze through transpersonal psychology: connect depth psychology frameworks with contemplative and mystical traditions — individuation, peak experience, ego transcendence.",
  },
  {
    id: "crypto-quantum",
    domains: ["cryptography", "quantum_mechanics"],
    name: "Quantum Cryptography",
    description: "Quantum computing threatens classical cryptography while enabling quantum key distribution — the future of information security.",
    synthesisPrompt: "Analyze through quantum cryptography: examine how quantum mechanics impacts classical encryption, enables quantum key distribution, and reshapes information security.",
  },
  {
    id: "physics-geometry",
    domains: ["physics", "sacred_geometry"],
    name: "Physics of Form",
    description: "Physical laws generate geometric patterns — from crystal lattices to standing waves to orbital mechanics.",
    synthesisPrompt: "Analyze through the physics of form: examine how physical laws naturally produce geometric patterns, symmetries, and self-similar structures.",
  },
];

export function identifyDomains(query: string): string[] {
  const lower = query.toLowerCase();
  const matched: Array<{ id: string; score: number }> = [];

  for (const domain of DOMAINS) {
    let score = 0;
    for (const kw of domain.keywords) {
      if (lower.includes(kw)) {
        score += kw.split(" ").length;
      }
    }
    if (score > 0) matched.push({ id: domain.id, score });
  }

  matched.sort((a, b) => b.score - a.score);
  return matched.slice(0, 3).map(m => m.id);
}

export function findBridges(domainIds: string[]): CrossDomainBridge[] {
  if (domainIds.length < 2) return [];
  const bridges: CrossDomainBridge[] = [];

  for (const bridge of BRIDGES) {
    if (domainIds.includes(bridge.domains[0]) && domainIds.includes(bridge.domains[1])) {
      bridges.push(bridge);
    }
  }

  return bridges;
}

export function buildSpecializedContext(query: string): SpecializedContext {
  const domainIds = identifyDomains(query);
  const bridges = findBridges(domainIds);

  const matchedDomains = DOMAINS.filter(d => domainIds.includes(d.id));
  const promptParts: string[] = [];
  const strengths = new Set<string>();

  for (const domain of matchedDomains) {
    promptParts.push(domain.promptPrefix);
    for (const s of domain.preferredProviderStrengths) strengths.add(s);
  }

  for (const bridge of bridges) {
    promptParts.push(`\n[Cross-Domain Bridge: ${bridge.name}]\n${bridge.synthesisPrompt}`);
  }

  const confidence = domainIds.length > 0 ? Math.min(1, domainIds.length * 0.3 + bridges.length * 0.2) : 0;

  return {
    domains: domainIds,
    bridges,
    promptContext: promptParts.join("\n\n"),
    preferredStrengths: [...strengths],
    confidence,
  };
}

export function getDomainList(): Array<{ id: string; name: string; keywordCount: number }> {
  return DOMAINS.map(d => ({ id: d.id, name: d.name, keywordCount: d.keywords.length }));
}

export function getBridgeList(): Array<{ id: string; name: string; domains: [string, string] }> {
  return BRIDGES.map(b => ({ id: b.id, name: b.name, domains: b.domains }));
}

log(`${DOMAINS.length} domains, ${BRIDGES.length} cross-domain bridges`);

export type { DomainSpec, CrossDomainBridge, SpecializedContext };
