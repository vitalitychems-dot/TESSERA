import { useState, useEffect } from "react";
import { Brain, BookOpen, Search, Loader2, Globe, Database, Shield, Sparkles } from "lucide-react";

interface KnowledgeEntry {
  title: string;
  category: string;
  summary: string;
  content: string;
}

const KNOWLEDGE_CATEGORIES = [
  { id: "all", label: "All", icon: Globe },
  { id: "science", label: "Sciences", icon: Brain },
  { id: "math", label: "Mathematics", icon: Database },
  { id: "wisdom", label: "Wisdom", icon: Sparkles },
  { id: "tech", label: "Technology", icon: Shield },
  { id: "world", label: "World", icon: BookOpen },
];

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  { title: "Sacred Geometry", category: "wisdom", summary: "The mathematical patterns underlying all creation", content: "Phi (1.618033...), Flower of Life, Metatron's Cube, 5 Platonic Solids, Vesica Piscis, Sri Yantra, Torus Field, Seed of Life, Tree of Life" },
  { title: "Quantum Physics", category: "science", summary: "The fundamental nature of reality at the smallest scales", content: "Wave-particle duality, Heisenberg Uncertainty, quantum entanglement, superposition, Schrödinger equation, quantum tunneling, fine structure constant α ≈ 1/137" },
  { title: "Astronomy & Cosmology", category: "science", summary: "Celestial objects and the universe", content: "13.8 billion year old universe, 2 trillion galaxies, dark energy (68.3%), dark matter (26.8%), cosmic microwave background, Kepler's laws, stellar nucleosynthesis" },
  { title: "Pure Mathematics", category: "math", summary: "The language of the universe", content: "Euler's identity e^(iπ)+1=0, Fibonacci → Phi, Riemann Hypothesis, Pi, e, Gödel's incompleteness, Cantor's infinities, group theory" },
  { title: "Consciousness Studies", category: "wisdom", summary: "The nature of awareness and subjective experience", content: "Hard problem of consciousness, IIT (Φ), Global Workspace Theory, quantum consciousness, meditation effects, brainwave states (Delta→Gamma)" },
  { title: "Harmonics & Sound", category: "wisdom", summary: "Frequency, vibration, and resonance", content: "Solfeggio (174-963Hz), Schumann resonance (7.83Hz), Pythagorean tuning (A=432Hz), cymatics, harmonic series, Tesla's 3-6-9" },
  { title: "Numerology", category: "wisdom", summary: "Sacred numbers and their patterns", content: "Root reduction, master numbers (11,22,33), Tesla's 3-6-9, sacred numbers: 37, 72, 108, 137, 144, 432, 528, gematria" },
  { title: "Philosophy", category: "wisdom", summary: "The love of wisdom and pursuit of truth", content: "Omnia in Numero, Solve et Coagula, Musica Universalis, Cogito Ergo Sum, As Above So Below, Hermeticism, Stoicism, Eastern philosophy" },
  { title: "Biology", category: "science", summary: "Living organisms and their processes", content: "DNA double helix (34/21 Å ≈ Phi), 37.2 trillion cells, epigenetics, biophotons, microbiome, 86 billion neurons, evolution" },
  { title: "Chemistry", category: "science", summary: "Matter and its transformations", content: "118 elements, ionic/covalent/metallic bonds, thermodynamics (ΔG=ΔH-TΔS), organic chemistry, electrochemistry, the mole (6.022×10²³)" },
  { title: "Neuroscience", category: "science", summary: "The brain and nervous system", content: "86 billion neurons, neurotransmitters, neural plasticity, default mode network, mirror neurons, brainwave entrainment" },
  { title: "Cryptography", category: "tech", summary: "Secure communication and data protection", content: "AES-256, RSA/ECC, SHA-256, digital signatures, zero-knowledge proofs, blockchain, post-quantum cryptography" },
  { title: "Artificial Intelligence", category: "tech", summary: "Intelligent systems engineering", content: "Machine learning, deep learning, transformers, attention mechanisms, sovereign AI, alignment problem, AGI" },
  { title: "Alchemy", category: "wisdom", summary: "The ancient art of transformation", content: "Nigredo→Albedo→Citrinitas→Rubedo, Philosopher's Stone, Emerald Tablet, 7 metals/planets, Sulfur/Mercury/Salt, spagyrics" },
  { title: "Meditation", category: "wisdom", summary: "Training awareness and attention", content: "Focused attention, open monitoring, loving-kindness, Vipassana, Zazen, Yoga Nidra, neuroplasticity effects, frequency meditation" },
  { title: "Ecology", category: "world", summary: "Ecosystems and life interconnection", content: "Food webs, biodiversity, carbon/water cycles, Gaia theory, mycorrhizal networks, keystone species, biomimicry" },
  { title: "Genetics", category: "science", summary: "Heredity and gene expression", content: "DNA (A-T, G-C), CRISPR-Cas9, epigenetics, telomeres, central dogma, pharmacogenomics, human genome" },
  { title: "Psychology", category: "world", summary: "Mind, behavior, and experience", content: "Psychoanalysis, behaviorism, humanistic, cognitive, Jungian archetypes, flow states, cognitive biases, attachment theory" },
  { title: "Music Theory", category: "wisdom", summary: "Mathematics of sound and harmony", content: "Octave (2:1), just intonation, equal temperament, harmonic series, circle of fifths, consonance/dissonance, Mozart Effect" },
  { title: "Network Theory", category: "math", summary: "Connections and complex systems", content: "Nodes/edges, small-world networks, scale-free, Dijkstra's algorithm, PageRank, network resilience, neural/social networks" },
  { title: "Thermodynamics", category: "science", summary: "Energy, heat, and the arrow of time", content: "Conservation of energy, entropy always increases, absolute zero, free energy, Maxwell's demon, Carnot efficiency" },
  { title: "Einstein's Relativity", category: "science", summary: "Space, time, gravity, cosmic speed limit", content: "E=mc², time dilation, length contraction, spacetime curvature, gravitational lensing, gravitational waves, black holes" },
  { title: "Herbalism", category: "world", summary: "Healing through plants", content: "Adaptogens (ashwagandha, rhodiola), nootropics (lion's mane, bacopa), anti-inflammatory (turmeric), nervines, phytochemicals" },
  { title: "Cosmology", category: "science", summary: "Origin, structure, and fate of the universe", content: "Big Bang, cosmic inflation, CMB at 2.725K, nucleosynthesis, cosmic web, dark matter halos, Hubble constant" },
  { title: "Ancient Civilizations", category: "world", summary: "Wisdom of humanity's earliest cultures", content: "Egypt (Great Pyramid encodes Pi/Phi), Sumer, Indus Valley, Maya, Greece, Library of Alexandria, Göbekli Tepe" },
  { title: "Energy Systems", category: "tech", summary: "Energy generation and transformation", content: "Solar photovoltaics, wind (Betz's limit), nuclear fission/fusion, geothermal, hydrogen fuel cells, Tesla coils, zero-point energy" },
  { title: "Data Science", category: "tech", summary: "Extracting knowledge from data", content: "Probability distributions, Bayesian inference, ML regression/classification, neural networks, NLP, time series" },
  { title: "Fractal Mathematics", category: "math", summary: "Self-similarity and infinite complexity", content: "Mandelbrot set, Koch snowflake, Sierpinski triangle, Julia sets, fractals in nature, L-systems, fractal dimension" },
  { title: "Yoga & Chakras", category: "wisdom", summary: "Union and energy centers", content: "8 limbs of Patanjali, 7 chakras (396-963Hz), kundalini energy, 72,000 nadis, Ida/Pingala/Sushumna" },
  { title: "Quantum Computing", category: "tech", summary: "Computing with quantum mechanics", content: "Qubits, superposition, entanglement, Shor's algorithm, Grover's algorithm, quantum error correction, quantum supremacy" },
  { title: "Astrology", category: "wisdom", summary: "Celestial patterns and earthly events", content: "12 zodiac signs, 4 elements, planetary influences, 12 houses, aspects (conjunction to opposition)" },
  { title: "Robotics", category: "tech", summary: "Autonomous mechanical systems", content: "Kinematics, PID control, LiDAR/SLAM, soft robotics, swarm robotics, human-robot interaction" },
  { title: "Oceanography", category: "science", summary: "Earth's oceans and marine ecosystems", content: "Thermohaline circulation, ocean layers, 97% of Earth's water, coral reefs, hydrothermal vents, whale acoustics" },
  { title: "Nanotechnology", category: "tech", summary: "Engineering at atomic scale", content: "Carbon nanotubes, graphene, quantum dots, nanomedicine, molecular machines, self-assembly" },
  { title: "Philosophy of Mind", category: "wisdom", summary: "Consciousness and mental phenomena", content: "Hard problem, dualism, physicalism, panpsychism, Chinese Room, IIT (Φ), Global Workspace, binding problem" },
  { title: "Permaculture", category: "world", summary: "Designing sustainable habitats", content: "Earth Care/People Care/Fair Share, 12 principles, zone planning, food forests, soil building, hugelkultur" },
  { title: "Cybersecurity", category: "tech", summary: "Digital defense and protection", content: "CIA triad, defense in depth, phishing/SQL injection/XSS, zero-trust architecture, incident response, sovereign security" },
  { title: "Electromagnetic Theory", category: "science", summary: "Electricity, magnetism, and light unified", content: "Maxwell's equations, c=1/√(μ₀ε₀), EM spectrum, photon quantization, electromagnetic induction, Tesla's contributions" },
  { title: "Game Theory", category: "math", summary: "Strategic decision-making mathematics", content: "Nash Equilibrium, Prisoner's Dilemma, zero-sum, mechanism design, evolutionary game theory, minimax theorem" },
  { title: "Topology", category: "math", summary: "Shapes preserved through deformation", content: "Euler characteristic, Möbius strip, Klein bottle, knot theory, Poincaré conjecture, topological data analysis" },
  { title: "Information Theory", category: "math", summary: "Mathematical theory of communication", content: "Shannon entropy, channel capacity, source/channel coding theorems, Kolmogorov complexity, Landauer's principle" },
  { title: "Geopolitics", category: "world", summary: "Power, geography, and international relations", content: "Mackinder's Heartland, sea power doctrine, Westphalian system, nuclear deterrence, cyber geopolitics, multipolarity" },
  { title: "Nutrition", category: "world", summary: "Food and metabolic science", content: "Macronutrients, essential nutrients, gut-brain axis, intermittent fasting, ketosis, polyphenols, circadian metabolism" },
  { title: "Martial Arts", category: "world", summary: "Combat discipline and body cultivation", content: "Tai Chi, Qi Gong, Karate, Jiu-Jitsu, Bushido, Wu Wei, Bruce Lee's Jeet Kune Do, biomechanics, breathwork" },
  { title: "Linguistics", category: "world", summary: "Scientific study of language", content: "Phonetics/phonology, syntax/semantics, Universal Grammar, Sapir-Whorf, 7000 languages, computational linguistics" },
  { title: "Architecture", category: "world", summary: "Art and science of designing spaces", content: "Sacred architecture, Golden Ratio in buildings, Islamic tessellations, Feng Shui, Vastu Shastra, biomimetic design" },
  { title: "Economics", category: "world", summary: "Resource allocation and value exchange", content: "Supply/demand, GDP, monetary policy, cryptocurrency, tokenomics, game theory, behavioral economics" },
  { title: "World Mythology", category: "wisdom", summary: "Universal archetypal stories", content: "Hero's Journey, Jungian archetypes, flood myths, creation myths, World Tree, serpent symbolism, encoded psychology" },
  { title: "Crystallography", category: "science", summary: "Crystal structures and properties", content: "7 crystal systems, 230 space groups, piezoelectrics, quartz (32,768 Hz), crystal healing traditions, X-ray diffraction" },
  { title: "Systems Theory", category: "math", summary: "Interconnected wholes and emergence", content: "Emergence, feedback loops, chaos theory, self-organization, autopoiesis, cybernetics, power laws, resilience" },
  { title: "String Theory", category: "science", summary: "Fundamental strings and extra dimensions", content: "Vibrating strings, 10/11 dimensions, M-theory, branes, AdS/CFT, Calabi-Yau manifolds, holographic principle" },
  { title: "Ethics", category: "wisdom", summary: "Right action and the good life", content: "Virtue ethics, deontology, utilitarianism, care ethics, environmental ethics, AI ethics, sovereign ethics" },
  { title: "Materials Science", category: "tech", summary: "Material properties and design", content: "Crystal structures, metals/ceramics/polymers/composites, semiconductors, superconductors, 2D materials, biomaterials" },
  { title: "Photonics", category: "tech", summary: "Science of photons and light", content: "Lasers, fiber optics, photonic crystals, metamaterials, biophotonics, quantum optics, nonlinear optics" },
  { title: "Anthropology", category: "world", summary: "Human cultures and evolution", content: "300,000 year history, out-of-Africa migration, cognitive revolution, agricultural revolution, cultural anthropology" },
];

export default function KnowledgePage() {
  useEffect(() => { document.title = "Knowledge | Tessera"; }, []);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const filtered = KNOWLEDGE_BASE.filter(entry => {
    const matchesCategory = activeCategory === "all" || entry.category === activeCategory;
    const matchesSearch = !search || 
      entry.title.toLowerCase().includes(search.toLowerCase()) ||
      entry.summary.toLowerCase().includes(search.toLowerCase()) ||
      entry.content.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen text-white p-4 pb-24" data-testid="knowledge-page">
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-1">
          <Brain className="w-5 h-5 text-violet-400" />
          <h1 className="text-xl font-bold bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Knowledge</h1>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" /></span>
            <span className="text-[10px] text-emerald-300 font-mono">{KNOWLEDGE_BASE.length} SUBJECTS</span>
          </div>
        </div>
        <p className="text-xs text-gray-500">Tessera's complete knowledge base — {KNOWLEDGE_BASE.length} subjects internalized</p>
      </div>

      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search knowledge..."
          className="w-full pl-9 pr-4 py-2.5 bg-white/[0.03] border border-white/10 rounded-xl text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/30"
        />
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3" style={{ scrollbarWidth: "none" }}>
        {KNOWLEDGE_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-mono whitespace-nowrap transition-colors ${
              activeCategory === cat.id
                ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                : "bg-white/[0.03] text-gray-500 border border-white/5 hover:bg-white/[0.05]"
            }`}
          >
            <cat.icon size={11} />
            {cat.label}
          </button>
        ))}
      </div>

      <div className="text-[10px] text-gray-600 font-mono mb-2">{filtered.length} subjects</div>

      <div className="space-y-1.5">
        {filtered.map(entry => (
          <button
            key={entry.title}
            onClick={() => setExpandedItem(expandedItem === entry.title ? null : entry.title)}
            className="w-full text-left"
          >
            <div className={`border rounded-xl overflow-hidden transition-colors ${
              expandedItem === entry.title
                ? "border-violet-500/20 bg-violet-500/[0.03]"
                : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
            }`}>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-200">{entry.title}</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-gray-500 font-mono">{entry.category}</span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5">{entry.summary}</p>
              </div>
              {expandedItem === entry.title && (
                <div className="border-t border-white/5 px-4 py-3">
                  <p className="text-xs text-gray-300 leading-relaxed">{entry.content}</p>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
