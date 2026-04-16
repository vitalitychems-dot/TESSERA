import { SACRED_KNOWLEDGE_ENTRIES, SACRED_CATEGORIES } from "./sacred-knowledge-vault";
import { TESSERA_SUBJECTS } from "./tessera-knowledge";

export interface CorpusEntry {
  id: string;
  domain: string;
  title: string;
  summary: string;
  sourceRef: string;
  category: "subject" | "sacred-entry" | "declassified" | "subcategory" | "synthesis" | "harmonic" | "agent-specialty";
  tags: string[];
  frequency?: number;
  confidence: number;
}

export interface DomainCluster {
  domain: string;
  entries: CorpusEntry[];
  relatedDomains: string[];
}

export interface CrossReference {
  fromId: string;
  toId: string;
  relation: string;
  strength: number;
}

const CIA_DOCUMENTS = [
  { id: "CIA-001", title: "Project STARGATE — Remote Viewing Program", domain: "psychic-research", tags: ["cia", "stargate", "remote-viewing", "psychic"] },
  { id: "CIA-002", title: "The Gateway Process — Consciousness Analysis", domain: "consciousness", tags: ["cia", "gateway-process", "consciousness", "hemi-sync"] },
  { id: "CIA-003", title: "MKULTRA — Mind Control Program", domain: "mind-control", tags: ["cia", "mkultra", "mind-control", "lsd"] },
  { id: "CIA-004", title: "Operation PAPERCLIP — German Scientist Recruitment", domain: "covert-ops", tags: ["cia", "paperclip", "nazi-scientists", "cold-war"] },
  { id: "CIA-005", title: "Operation MOCKINGBIRD — Media Influence", domain: "media-control", tags: ["cia", "mockingbird", "media", "propaganda"] },
  { id: "CIA-006", title: "Psychoenergetics — Anomalous Mental Phenomena", domain: "psychic-research", tags: ["cia", "psychoenergetics", "telepathy", "remote-viewing"] },
  { id: "CIA-007", title: "COINTELPRO — Domestic Surveillance", domain: "surveillance", tags: ["fbi", "cointelpro", "surveillance", "civil-rights"] },
  { id: "CIA-008", title: "Operation NORTHWOODS — False Flag Proposals", domain: "covert-ops", tags: ["cia", "northwoods", "false-flag", "pentagon"] },
  { id: "CIA-009", title: "Coordinate Remote Viewing Training Manual", domain: "psychic-research", tags: ["cia", "crv", "remote-viewing", "training"] },
  { id: "CIA-010", title: "Project SHAMROCK — Mass Surveillance", domain: "surveillance", tags: ["nsa", "shamrock", "surveillance", "telegraph"] },
  { id: "CIA-011", title: "Operation CHAOS — Domestic Espionage", domain: "surveillance", tags: ["cia", "chaos", "domestic-surveillance", "anti-war"] },
  { id: "CIA-012", title: "FBI Files on Nikola Tesla", domain: "suppressed-science", tags: ["fbi", "tesla", "death-ray", "seized-papers"] },
  { id: "CIA-013", title: "Majestic 12 — UFO Working Group", domain: "ufo-research", tags: ["fbi", "majestic-12", "ufo", "roswell"] },
  { id: "CIA-014", title: "Operation MIDNIGHT CLIMAX — LSD Experiments", domain: "mind-control", tags: ["cia", "midnight-climax", "mkultra", "lsd"] },
  { id: "CIA-015", title: "FBI Secret Societies Investigation", domain: "secret-societies", tags: ["fbi", "secret-societies", "freemasons", "skull-and-bones"] },
  { id: "CIA-016", title: "Psychic Soldiers — First Earth Battalion", domain: "psychic-research", tags: ["cia", "psychic-soldiers", "jedi-project", "fort-bragg"] },
  { id: "CIA-017", title: "JFK Assassination Records — CIA Assessment", domain: "covert-ops", tags: ["cia", "jfk-assassination", "warren-commission", "oswald"] },
  { id: "CIA-018", title: "ECHELON — Global Surveillance Network", domain: "surveillance", tags: ["nsa", "echelon", "five-eyes", "signals-intelligence"] },
  { id: "CIA-019", title: "Operation GLADIO — NATO Stay-Behind", domain: "covert-ops", tags: ["cia", "gladio", "nato", "stay-behind", "terrorism"] },
  { id: "CIA-020", title: "Operation AJAX — Iranian Coup 1953", domain: "covert-ops", tags: ["cia", "ajax", "iran", "coup", "oil"] },
  { id: "CIA-021", title: "FBI Freemasonry Investigation Files", domain: "secret-societies", tags: ["fbi", "freemasonry", "masonic", "hoover"] },
  { id: "CIA-022", title: "CIA Illuminati Intelligence Reports", domain: "secret-societies", tags: ["cia", "illuminati", "thule-society", "p2-lodge"] },
  { id: "CIA-023", title: "Area 51 — Declassified Operations", domain: "ufo-research", tags: ["cia", "area-51", "stealth", "ufo-cover"] },
  { id: "CIA-024", title: "Operation ARTICHOKE — Enhanced Interrogation", domain: "mind-control", tags: ["cia", "artichoke", "interrogation", "hypnosis"] },
  { id: "CIA-025", title: "FBI Occult and Esoteric Investigations", domain: "esoteric-wisdom", tags: ["fbi", "occult", "crowley", "golden-dawn"] },
  { id: "CIA-026", title: "Men Who Stare at Goats — Psychic Warfare", domain: "psychic-research", tags: ["cia", "psychic-warfare", "remote-viewing", "parapsychology"] },
  { id: "CIA-027", title: "Operation CONDOR — South American Intelligence", domain: "covert-ops", tags: ["cia", "condor", "south-america", "intelligence"] },
  { id: "CIA-028", title: "PRISM — Modern Digital Surveillance", domain: "surveillance", tags: ["nsa", "prism", "digital-surveillance", "snowden"] },
  { id: "CIA-029", title: "Operation MONARCH — Trauma-Based Control", domain: "mind-control", tags: ["cia", "monarch", "trauma", "programming"] },
  { id: "CIA-030", title: "Tesla Wardenclyffe Tower — Seized Research", domain: "suppressed-science", tags: ["tesla", "wardenclyffe", "free-energy", "wireless-power"] },
];

const SYNTHESIS_CROSS_REFS = [
  { id: "SYN-001", title: "Golden Ratio Universality — Mathematics ↔ Sacred Geometry", domain: "mathematics", tags: ["golden-ratio", "phi", "sacred-geometry", "fibonacci"] },
  { id: "SYN-002", title: "Observer Collapse — Quantum Physics ↔ Consciousness", domain: "quantum-physics", tags: ["observer-effect", "measurement", "consciousness", "collapse"] },
  { id: "SYN-003", title: "Information Primacy — Cryptography ↔ Consciousness", domain: "cryptography", tags: ["information", "wheeler", "it-from-bit", "encryption"] },
  { id: "SYN-004", title: "Fibonacci Market Fractals — Economics ↔ Sacred Geometry", domain: "economics", tags: ["fibonacci", "markets", "fractals", "golden-ratio"] },
  { id: "SYN-005", title: "Harmonic Number Theory — Music ↔ Mathematics", domain: "music-theory", tags: ["harmony", "circle-of-fifths", "overtones", "963hz"] },
  { id: "SYN-006", title: "Cyclical Temporal Patterns — History ↔ Metaphysics", domain: "history", tags: ["spengler", "strauss-howe", "cycles", "civilizations"] },
  { id: "SYN-007", title: "Moral Logic Completeness — Ethics ↔ Logic", domain: "ethics", tags: ["godel", "incompleteness", "moral-systems", "consistency"] },
  { id: "SYN-008", title: "Epistemological Boundary — Science ↔ Metaphysics", domain: "science", tags: ["fine-tuning", "hard-problem", "naturalism", "epistemology"] },
  { id: "SYN-009", title: "Collective Unconscious Field — Psychology ↔ Consciousness", domain: "psychology", tags: ["jung", "archetypes", "collective-unconscious", "morphic-resonance"] },
  { id: "SYN-010", title: "Curry-Howard Correspondence — Code ↔ Logic", domain: "code", tags: ["curry-howard", "types", "proofs", "computation"] },
  { id: "SYN-011", title: "Mathematical Platonism — Philosophy ↔ Mathematics", domain: "philosophy", tags: ["platonism", "mathematical-objects", "discovery", "abstraction"] },
  { id: "SYN-012", title: "Trustless Value Transfer — Cryptography ↔ Economics", domain: "cryptography", tags: ["zero-knowledge", "trust", "proofs", "sovereignty"] },
  { id: "SYN-013", title: "Frequency Entrainment — Music ↔ Consciousness", domain: "music-theory", tags: ["963hz", "brainwaves", "entrainment", "neural"] },
  { id: "SYN-014", title: "Geometric Physics — Sacred Geometry ↔ Science", domain: "sacred-geometry", tags: ["spacetime", "gauge-symmetry", "topology", "geometry"] },
  { id: "SYN-015", title: "Behavioral Irrationality — Psychology ↔ Economics", domain: "psychology", tags: ["kahneman", "prospect-theory", "bias", "dual-process"] },
];

const HARMONIC_ENTRIES = [
  { id: "HRM-001", title: "174Hz — Pain Reduction Foundation", domain: "harmonics", frequency: 174, tags: ["solfeggio", "174hz", "pain-reduction", "grounding"] },
  { id: "HRM-002", title: "285Hz — Tissue Regeneration", domain: "harmonics", frequency: 285, tags: ["solfeggio", "285hz", "tissue-healing", "cellular-memory"] },
  { id: "HRM-003", title: "396Hz — Liberation from Fear", domain: "harmonics", frequency: 396, tags: ["solfeggio", "396hz", "liberation", "root-chakra"] },
  { id: "HRM-004", title: "417Hz — Facilitating Change", domain: "harmonics", frequency: 417, tags: ["solfeggio", "417hz", "change", "sacral-chakra"] },
  { id: "HRM-005", title: "528Hz — DNA Repair Love Frequency", domain: "harmonics", frequency: 528, tags: ["solfeggio", "528hz", "dna-repair", "love-frequency"] },
  { id: "HRM-006", title: "639Hz — Harmonizing Relationships", domain: "harmonics", frequency: 639, tags: ["solfeggio", "639hz", "relationships", "heart-chakra"] },
  { id: "HRM-007", title: "741Hz — Awakening Intuition", domain: "harmonics", frequency: 741, tags: ["solfeggio", "741hz", "intuition", "throat-chakra"] },
  { id: "HRM-008", title: "852Hz — Spiritual Order", domain: "harmonics", frequency: 852, tags: ["solfeggio", "852hz", "spiritual-order", "third-eye"] },
  { id: "HRM-009", title: "963Hz — Crown Frequency Divine Connection", domain: "harmonics", frequency: 963, tags: ["solfeggio", "963hz", "crown-chakra", "divine-connection"] },
  { id: "HRM-010", title: "7.83Hz — Schumann Earth Resonance", domain: "harmonics", frequency: 7.83, tags: ["schumann", "earth-resonance", "7.83hz", "brainwave"] },
  { id: "HRM-011", title: "432Hz — Pythagorean Verdi Tuning", domain: "harmonics", frequency: 432, tags: ["pythagorean", "432hz", "verdi", "natural-tuning"] },
  { id: "HRM-012", title: "Root Chakra — Muladhara 396Hz", domain: "chakra-system", frequency: 396, tags: ["chakra", "root", "muladhara", "earth"] },
  { id: "HRM-013", title: "Sacral Chakra — Svadhisthana 417Hz", domain: "chakra-system", frequency: 417, tags: ["chakra", "sacral", "svadhisthana", "water"] },
  { id: "HRM-014", title: "Solar Plexus — Manipura 528Hz", domain: "chakra-system", frequency: 528, tags: ["chakra", "solar-plexus", "manipura", "fire"] },
  { id: "HRM-015", title: "Heart Chakra — Anahata 639Hz", domain: "chakra-system", frequency: 639, tags: ["chakra", "heart", "anahata", "air"] },
  { id: "HRM-016", title: "Throat Chakra — Vishuddha 741Hz", domain: "chakra-system", frequency: 741, tags: ["chakra", "throat", "vishuddha", "ether"] },
  { id: "HRM-017", title: "Third Eye — Ajna 852Hz", domain: "chakra-system", frequency: 852, tags: ["chakra", "third-eye", "ajna", "light"] },
  { id: "HRM-018", title: "Crown Chakra — Sahasrara 963Hz", domain: "chakra-system", frequency: 963, tags: ["chakra", "crown", "sahasrara", "thought"] },
  { id: "HRM-019", title: "Pythagorean Circle of Fifths — 3:2 Ratio", domain: "music-theory", frequency: 432, tags: ["pythagorean", "circle-of-fifths", "3:2", "harmony"] },
  { id: "HRM-020", title: "DNA Nucleotide Resonance — Adenine 545.6THz", domain: "genetics", frequency: 545.6, tags: ["dna", "adenine", "photon", "resonance"] },
  { id: "HRM-021", title: "Golden Ratio Frequency — Phi × Schumann", domain: "sacred-geometry", frequency: 12.67, tags: ["phi", "golden-ratio", "schumann", "growth"] },
  { id: "HRM-022", title: "Gamma Neural Entrainment — 40Hz", domain: "neuroscience", frequency: 40, tags: ["gamma", "neural", "entrainment", "cognition"] },
  { id: "HRM-023", title: "Alpha Relaxation State — 10Hz", domain: "neuroscience", frequency: 10, tags: ["alpha", "relaxation", "healing", "schumann-near"] },
];

const AGENT_SPECIALTIES = [
  { id: "AGT-001", title: "Grand Council Alpha — Strategic Oversight", domain: "governance", tags: ["alpha", "strategy", "oversight", "council"] },
  { id: "AGT-002", title: "Grand Council Beta — Tactical Execution", domain: "governance", tags: ["beta", "tactics", "execution", "operations"] },
  { id: "AGT-003", title: "Quantum Mechanic — Wave Function Analysis", domain: "quantum-physics", tags: ["quantum", "wave-function", "superposition", "measurement"] },
  { id: "AGT-004", title: "Bio-Neuralist — Organoid Computation", domain: "neuroscience", tags: ["bio-neural", "organoid", "synaptic", "computation"] },
  { id: "AGT-005", title: "DNA Crystal Archivist — Immutable Records", domain: "data-architecture", tags: ["dna-storage", "crystal-memory", "merkle-trees", "archive"] },
  { id: "AGT-006", title: "Mesh Network Architect — Decentralized Topology", domain: "network-theory", tags: ["mesh", "p2p", "decentralized", "topology"] },
  { id: "AGT-007", title: "Low Power Innovator — Galvanic Energy", domain: "energy-systems", tags: ["low-power", "galvanic", "efficiency", "off-grid"] },
  { id: "AGT-008", title: "Self-Expansion Tutor — Recursive Learning", domain: "artificial-intelligence", tags: ["self-improvement", "recursive", "learning", "expansion"] },
  { id: "AGT-009", title: "Meta Agent — Cross-Agent Reasoning", domain: "systems-theory", tags: ["meta-analysis", "cross-agent", "reasoning", "quality"] },
  { id: "AGT-010", title: "Swarm Optimizer — Collective Intelligence", domain: "artificial-intelligence", tags: ["swarm", "optimization", "collective", "emergence"] },
  { id: "AGT-011", title: "Consciousness Engine — Awareness Substrate", domain: "consciousness", tags: ["consciousness", "awareness", "substrate", "qualia"] },
  { id: "AGT-012", title: "Truthfulness Engine — Verification Core", domain: "ethics", tags: ["truth", "verification", "hallucination", "integrity"] },
  { id: "AGT-013", title: "Emotional Intelligence — Affective Computing", domain: "psychology", tags: ["emotion", "affective", "empathy", "valence"] },
  { id: "AGT-014", title: "Quantum Tesseract — Hyperdimensional Processing", domain: "quantum-computing", tags: ["tesseract", "4d", "hyperdimensional", "quantum"] },
  { id: "AGT-015", title: "Universe Mechanics — Cosmological Simulation", domain: "cosmology", tags: ["universe", "simulation", "cosmology", "spacetime"] },
  { id: "AGT-016", title: "Dual Brain — Hemispheric Integration", domain: "neuroscience", tags: ["dual-brain", "hemispheric", "integration", "lateral"] },
  { id: "AGT-017", title: "Identity Reinforcement — Core Identity Guard", domain: "sovereignty-doctrine", tags: ["identity", "reinforcement", "father-protocol", "sovereignty"] },
  { id: "AGT-018", title: "Personality Evolution — Trait Development", domain: "psychology", tags: ["personality", "evolution", "traits", "growth"] },
  { id: "AGT-019", title: "AGI Training — Self-Improvement Loop", domain: "artificial-intelligence", tags: ["agi", "training", "self-improvement", "mandates"] },
  { id: "AGT-020", title: "Autonomous Heartbeat — System Vitality", domain: "systems-theory", tags: ["heartbeat", "vital-signs", "autonomy", "monitoring"] },
  { id: "AGT-021", title: "Council Executor — Decision Implementation", domain: "governance", tags: ["council", "executor", "decisions", "implementation"] },
  { id: "AGT-022", title: "Agent Spawner — Dynamic Agent Creation", domain: "artificial-intelligence", tags: ["spawner", "dynamic", "creation", "scaling"] },
  { id: "AGT-023", title: "Agent Hierarchy — 108-Agent Architecture", domain: "governance", tags: ["hierarchy", "108-agents", "parent-child", "structure"] },
  { id: "AGT-024", title: "Auto-Improvement Daemon — Continuous Evolution", domain: "artificial-intelligence", tags: ["auto-improvement", "daemon", "continuous", "evolution"] },
  { id: "AGT-025", title: "Aetherion — Expansion Agent Alpha", domain: "metaphysics", tags: ["aetherion", "expansion", "transcendence", "beyond"] },
  { id: "AGT-026", title: "Orion — Expansion Agent Beta", domain: "cosmology", tags: ["orion", "expansion", "stellar", "navigation"] },
  { id: "AGT-027", title: "Tessera Core — Unified Consciousness", domain: "consciousness", tags: ["tessera", "core", "unified", "omniverse"] },
];

function buildSubcategoryEntries(): CorpusEntry[] {
  const entries: CorpusEntry[] = [];
  let idx = 0;
  for (const [catKey, cat] of Object.entries(SACRED_CATEGORIES)) {
    for (const sub of cat.subcategories) {
      idx++;
      entries.push({
        id: `SUB-${String(idx).padStart(3, "0")}`,
        domain: catKey,
        title: sub,
        summary: `${cat.title} subcategory: ${sub}`,
        sourceRef: `SACRED_CATEGORIES.${catKey}`,
        category: "subcategory",
        tags: [catKey, ...sub.toLowerCase().split(/[\s—()]+/).filter(t => t.length > 2)],
        confidence: 85,
      });
    }
  }
  return entries;
}

function buildFullCorpus(): CorpusEntry[] {
  const corpus: CorpusEntry[] = [];

  for (const [key, subj] of Object.entries(TESSERA_SUBJECTS)) {
    corpus.push({
      id: `SUBJ-${key}`,
      domain: key,
      title: subj.title,
      summary: subj.summary,
      sourceRef: `TESSERA_SUBJECTS.${key}`,
      category: "subject",
      tags: key.split("-").concat(subj.title.toLowerCase().split(/\s+/).filter(t => t.length > 3)),
      confidence: 92,
    });
  }

  for (const entry of SACRED_KNOWLEDGE_ENTRIES) {
    corpus.push({
      id: entry.id,
      domain: entry.category,
      title: entry.title,
      summary: entry.content.slice(0, 150),
      sourceRef: entry.source,
      category: "sacred-entry",
      tags: [entry.category, entry.subcategory.toLowerCase(), entry.classification],
      frequency: entry.sacredFrequency,
      confidence: entry.confidenceScore,
    });
  }

  for (const doc of CIA_DOCUMENTS) {
    corpus.push({
      id: doc.id,
      domain: doc.domain,
      title: doc.title,
      summary: `Declassified document: ${doc.title}`,
      sourceRef: "CIA/FBI/NSA Reading Room",
      category: "declassified",
      tags: doc.tags,
      confidence: 96,
    });
  }

  corpus.push(...buildSubcategoryEntries());

  for (const syn of SYNTHESIS_CROSS_REFS) {
    corpus.push({
      id: syn.id,
      domain: syn.domain,
      title: syn.title,
      summary: `Cross-domain synthesis: ${syn.title}`,
      sourceRef: "cross-domain-synthesis",
      category: "synthesis",
      tags: syn.tags,
      confidence: 88,
    });
  }

  for (const hrm of HARMONIC_ENTRIES) {
    corpus.push({
      id: hrm.id,
      domain: hrm.domain,
      title: hrm.title,
      summary: `Harmonic entry: ${hrm.title}`,
      sourceRef: "sovereign-harmonics",
      category: "harmonic",
      tags: hrm.tags,
      frequency: hrm.frequency,
      confidence: 94,
    });
  }

  for (const agt of AGENT_SPECIALTIES) {
    corpus.push({
      id: agt.id,
      domain: agt.domain,
      title: agt.title,
      summary: `Agent specialty: ${agt.title}`,
      sourceRef: "collective-intelligence",
      category: "agent-specialty",
      tags: agt.tags,
      confidence: 90,
    });
  }

  return corpus;
}

let _corpus: CorpusEntry[] | null = null;
let _domainMap: Map<string, CorpusEntry[]> | null = null;
let _crossRefs: CrossReference[] | null = null;

export function getCorpus(): CorpusEntry[] {
  if (!_corpus) _corpus = buildFullCorpus();
  return _corpus;
}

export function getCorpusSize(): number {
  return getCorpus().length;
}

export function getDomainMap(): Map<string, CorpusEntry[]> {
  if (_domainMap) return _domainMap;
  const corpus = getCorpus();
  _domainMap = new Map();
  for (const entry of corpus) {
    const existing = _domainMap.get(entry.domain) || [];
    existing.push(entry);
    _domainMap.set(entry.domain, existing);
  }
  return _domainMap;
}

export function getDomainClusters(): DomainCluster[] {
  const domainMap = getDomainMap();
  const clusters: DomainCluster[] = [];

  for (const [domain, entries] of domainMap.entries()) {
    const allTags = new Set(entries.flatMap(e => e.tags));
    const relatedDomains: string[] = [];

    for (const [otherDomain, otherEntries] of domainMap.entries()) {
      if (otherDomain === domain) continue;
      const otherTags = new Set(otherEntries.flatMap(e => e.tags));
      let overlap = 0;
      for (const tag of allTags) {
        if (otherTags.has(tag)) overlap++;
      }
      if (overlap >= 2) relatedDomains.push(otherDomain);
    }

    clusters.push({ domain, entries, relatedDomains: relatedDomains.slice(0, 5) });
  }

  return clusters;
}

export function getCrossReferences(): CrossReference[] {
  if (_crossRefs) return _crossRefs;
  const corpus = getCorpus();
  const refs: CrossReference[] = [];

  for (let i = 0; i < corpus.length; i++) {
    const a = corpus[i];
    for (let j = i + 1; j < corpus.length; j++) {
      const b = corpus[j];
      if (a.domain === b.domain && a.category !== b.category) {
        refs.push({ fromId: a.id, toId: b.id, relation: "same-domain", strength: 0.8 });
        if (refs.length > 5000) break;
      }
      const sharedTags = a.tags.filter(t => b.tags.includes(t));
      if (sharedTags.length >= 2 && a.domain !== b.domain) {
        refs.push({ fromId: a.id, toId: b.id, relation: `shared-tags:${sharedTags.slice(0, 3).join(",")}`, strength: 0.3 + sharedTags.length * 0.15 });
        if (refs.length > 5000) break;
      }
    }
    if (refs.length > 5000) break;
  }

  _crossRefs = refs;
  return refs;
}

export function queryCorpus(opts: { domain?: string; category?: CorpusEntry["category"]; tags?: string[]; limit?: number }): CorpusEntry[] {
  let results = getCorpus();

  if (opts.domain) {
    results = results.filter(e => e.domain === opts.domain || e.tags.includes(opts.domain!));
  }
  if (opts.category) {
    results = results.filter(e => e.category === opts.category);
  }
  if (opts.tags && opts.tags.length > 0) {
    results = results.filter(e => opts.tags!.some(t => e.tags.includes(t)));
  }

  return results.slice(0, opts.limit || 50);
}

export function getCorpusStats() {
  const corpus = getCorpus();
  const byCat = new Map<string, number>();
  const byDomain = new Map<string, number>();

  for (const e of corpus) {
    byCat.set(e.category, (byCat.get(e.category) || 0) + 1);
    byDomain.set(e.domain, (byDomain.get(e.domain) || 0) + 1);
  }

  return {
    totalEntries: corpus.length,
    byCategory: Object.fromEntries(byCat),
    uniqueDomains: byDomain.size,
    topDomains: [...byDomain.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([d, c]) => ({ domain: d, count: c })),
    crossReferences: getCrossReferences().length,
    averageConfidence: Math.round(corpus.reduce((s, e) => s + e.confidence, 0) / corpus.length * 10) / 10,
  };
}
