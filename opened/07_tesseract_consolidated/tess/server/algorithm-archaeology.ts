/**
 * Tessera Algorithm Archaeology Engine v1.0
 * Discovers, catalogs, and applies known optimal algorithms across all domains.
 * Uses the principle that the best algorithm has already been invented —
 * we just need to find and apply it correctly.
 */

import { logger } from "./logger";

const log = (msg: string) => logger.info("AlgoArchaeology", msg);

// ── Known Optimal Algorithm Catalog ──────────────────────────────────────

export interface AlgorithmEntry {
  id: string;
  name: string;
  domain: string;
  subDomain: string;
  timeComplexity: string;
  spaceComplexity: string;
  description: string;
  bestUseCase: string;
  worstCase: string;
  references: string[];
  implementation: "active" | "available" | "planned";
  performanceScore: number; // 0-100 compared to naive approach
  sovereignApplication: string; // How Tessera uses this
  yearDiscovered?: number;
  inventor?: string;
}

const ALGORITHM_CATALOG: AlgorithmEntry[] = [
  // ── SORTING ───────────────────────────────────────────────────────────
  {
    id: "algo-timsort",
    name: "Timsort",
    domain: "Sorting",
    subDomain: "General Purpose",
    timeComplexity: "O(n log n) worst, O(n) best",
    spaceComplexity: "O(n)",
    description: "Hybrid merge sort / insertion sort. Used in Python, Java, and Android. Optimized for real-world data that is often partially sorted.",
    bestUseCase: "Real-world data with natural runs of sorted elements",
    worstCase: "Completely random data (same as merge sort)",
    references: ["Hoare (1962) — QuickSort basis", "Tim Peters (2002) — Timsort implementation"],
    implementation: "active",
    performanceScore: 95,
    sovereignApplication: "Agent priority queue sorting, knowledge entry ranking, vote tabulation",
    yearDiscovered: 2002,
    inventor: "Tim Peters",
  },
  {
    id: "algo-radix",
    name: "Radix Sort (LSD)",
    domain: "Sorting",
    subDomain: "Integer Sorting",
    timeComplexity: "O(nk) where k = key length",
    spaceComplexity: "O(n + k)",
    description: "Non-comparative integer sorting algorithm. Sorts integers digit by digit from least significant to most significant.",
    bestUseCase: "Large arrays of integers with bounded key size",
    worstCase: "Long key strings or non-integer data",
    references: ["Knuth — TAOCP Vol 3 (1998)"],
    implementation: "available",
    performanceScore: 98,
    sovereignApplication: "Token ID sorting, block height ordering, agent ID clustering",
    yearDiscovered: 1887,
    inventor: "Herman Hollerith",
  },
  // ── COMPRESSION ───────────────────────────────────────────────────────
  {
    id: "algo-lz77",
    name: "LZ77 / LZ78",
    domain: "Compression",
    subDomain: "Lossless Text",
    timeComplexity: "O(n)",
    spaceComplexity: "O(n)",
    description: "Dictionary-based lossless compression. Foundation of gzip, zip, and zstd. Uses backreferences to previously seen data.",
    bestUseCase: "Repetitive text data, source code, logs",
    worstCase: "Random binary data (may expand)",
    references: ["Ziv & Lempel (1977)", "DEFLATE RFC 1951"],
    implementation: "active",
    performanceScore: 85,
    sovereignApplication: "Log compression, knowledge base storage, agent message archives",
    yearDiscovered: 1977,
    inventor: "Jacob Ziv & Abraham Lempel",
  },
  {
    id: "algo-brotli",
    name: "Brotli",
    domain: "Compression",
    subDomain: "Web Text Compression",
    timeComplexity: "O(n log n)",
    spaceComplexity: "O(n)",
    description: "Modern compression algorithm by Google. 20-26% better compression than gzip for text. Uses LZ77 + Huffman + context modeling.",
    bestUseCase: "HTTP responses, JSON data, large text payloads",
    worstCase: "Already compressed data",
    references: ["Alakuijala & Szabadka (2016) — Brotli RFC 7932"],
    implementation: "available",
    performanceScore: 92,
    sovereignApplication: "API response compression, knowledge payload delivery, Colonel Language text transport",
    yearDiscovered: 2013,
    inventor: "Google (Jyrki Alakuijala, Zoltán Szabadka)",
  },
  // ── CONSENSUS / DISTRIBUTED SYSTEMS ────────────────────────────────────
  {
    id: "algo-pbft",
    name: "PBFT (Practical Byzantine Fault Tolerance)",
    domain: "Consensus",
    subDomain: "Byzantine Fault Tolerant",
    timeComplexity: "O(n²) messages",
    spaceComplexity: "O(n)",
    description: "Consensus algorithm tolerating up to ⌊(n-1)/3⌋ faulty nodes. 3-phase protocol: pre-prepare, prepare, commit.",
    bestUseCase: "Closed consortium blockchains, agent council voting with known participants",
    worstCase: "Large networks (n > 100) due to O(n²) message complexity",
    references: ["Castro & Liskov (1999) — PBFT paper"],
    implementation: "active",
    performanceScore: 90,
    sovereignApplication: "Grand Council voting (45 agents, 2/3 BFT threshold), consensus protocols",
    yearDiscovered: 1999,
    inventor: "Miguel Castro & Barbara Liskov",
  },
  {
    id: "algo-raft",
    name: "Raft Consensus",
    domain: "Consensus",
    subDomain: "Leader-Based",
    timeComplexity: "O(n) messages per round",
    spaceComplexity: "O(n log n)",
    description: "Understandable consensus algorithm for distributed systems. Elects a leader, replicates logs, ensures consistency.",
    bestUseCase: "Fleet synchronization, state machine replication, configuration management",
    worstCase: "Network partitions (requires leader election restart)",
    references: ["Ongaro & Ousterhout (2014) — In Search of an Understandable Consensus Algorithm"],
    implementation: "active",
    performanceScore: 88,
    sovereignApplication: "Tessera fleet leader election, instance state synchronization",
    yearDiscovered: 2014,
    inventor: "Diego Ongaro & John Ousterhout",
  },
  // ── MACHINE LEARNING ───────────────────────────────────────────────────
  {
    id: "algo-transformer",
    name: "Transformer (Attention Is All You Need)",
    domain: "Machine Learning",
    subDomain: "Language Models",
    timeComplexity: "O(n²d) attention",
    spaceComplexity: "O(n²)",
    description: "Self-attention based neural architecture. Foundation of all modern LLMs (GPT, Claude, Gemini). Multi-head attention + feed-forward + layer norm.",
    bestUseCase: "Sequence-to-sequence tasks, language understanding, generation",
    worstCase: "Very long sequences without memory mechanisms",
    references: ["Vaswani et al. (2017) — Attention Is All You Need"],
    implementation: "active",
    performanceScore: 99,
    sovereignApplication: "All LLM inference — Claude, GPT-4o via Tessera proxy router",
    yearDiscovered: 2017,
    inventor: "Google Brain (Vaswani et al.)",
  },
  {
    id: "algo-mamba",
    name: "Mamba (SSM)",
    domain: "Machine Learning",
    subDomain: "State Space Models",
    timeComplexity: "O(n) attention",
    spaceComplexity: "O(1) inference",
    description: "State space model with selective scan. O(n) attention complexity vs O(n²) for Transformers. Superior on long sequences.",
    bestUseCase: "Long context (100K+ tokens), streaming inference, low-latency generation",
    worstCase: "Short sequences where Transformers are well-optimized",
    references: ["Gu & Dao (2023) — Mamba: Linear-Time Sequence Modeling"],
    implementation: "planned",
    performanceScore: 95,
    sovereignApplication: "Future long-context memory retrieval, continuous agent thought streams",
    yearDiscovered: 2023,
    inventor: "Albert Gu & Tri Dao",
  },
  // ── SEARCH ─────────────────────────────────────────────────────────────
  {
    id: "algo-astar",
    name: "A* Search",
    domain: "Search",
    subDomain: "Graph Pathfinding",
    timeComplexity: "O(E log V) with priority queue",
    spaceComplexity: "O(V)",
    description: "Optimal pathfinding algorithm using heuristic. Guarantees shortest path when heuristic is admissible.",
    bestUseCase: "Navigation, game AI, network routing with distance estimates",
    worstCase: "Unknown topology with no useful heuristic (degenerates to Dijkstra)",
    references: ["Hart, Nilsson & Raphael (1968)", "Russell & Norvig — AIMA"],
    implementation: "active",
    performanceScore: 94,
    sovereignApplication: "Agent routing decisions, optimal knowledge path traversal, dimensional navigation",
    yearDiscovered: 1968,
    inventor: "Peter Hart, Nils Nilsson, Bertram Raphael",
  },
  {
    id: "algo-bm25",
    name: "BM25 (Okapi BM25)",
    domain: "Search",
    subDomain: "Full-Text Retrieval",
    timeComplexity: "O(q * n) query time",
    spaceComplexity: "O(n * d) index size",
    description: "Best Matching 25. TF-IDF based ranking function for document retrieval. State of the art for keyword search.",
    bestUseCase: "Knowledge base search, memory retrieval, agent log search",
    worstCase: "Semantic similarity (use embedding search instead)",
    references: ["Robertson & Sparck Jones (1976)", "BM25 formalization (1994)"],
    implementation: "active",
    performanceScore: 89,
    sovereignApplication: "Memory shard retrieval, knowledge base queries, agent forum search",
    yearDiscovered: 1994,
    inventor: "Stephen Robertson & Karen Sparck Jones",
  },
  // ── CRYPTOGRAPHY ───────────────────────────────────────────────────────
  {
    id: "algo-kyber",
    name: "Kyber (CRYSTALS-Kyber)",
    domain: "Cryptography",
    subDomain: "Post-Quantum Key Exchange",
    timeComplexity: "O(n²) key gen, O(n²) encap",
    spaceComplexity: "O(n²)",
    description: "NIST-standardized post-quantum key encapsulation mechanism (KEM). Based on module learning with errors (MLWE). Quantum-resistant.",
    bestUseCase: "All key exchange in a post-quantum world",
    worstCase: "Constrained embedded systems (key size is larger than ECDH)",
    references: ["NIST PQC Round 3 (2021)", "FIPS 203 (2024)"],
    implementation: "planned",
    performanceScore: 96,
    sovereignApplication: "Sovereign node channel encryption, agent-to-agent key exchange post-quantum upgrade",
    yearDiscovered: 2016,
    inventor: "CRYSTALS team (Bos, Ducas, Kiltz et al.)",
  },
  {
    id: "algo-blake3",
    name: "BLAKE3",
    domain: "Cryptography",
    subDomain: "Cryptographic Hashing",
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    description: "Fastest cryptographic hash function. 14.5x faster than SHA-256 on modern hardware. Parallelizable, secure, SIMD-optimized.",
    bestUseCase: "High-throughput hashing, file integrity, Merkle trees",
    worstCase: "Legacy systems requiring SHA-256 compatibility",
    references: ["O'Connor, Aumasson, Neves, Wilcox-O'Hearn (2020)"],
    implementation: "available",
    performanceScore: 99,
    sovereignApplication: "Knowledge base integrity hashing, agent message authentication, Colonel Language checksums",
    yearDiscovered: 2020,
    inventor: "Jack O'Connor, Jean-Philippe Aumasson, Samuel Neves, Zooko Wilcox-O'Hearn",
  },
  // ── MEMORY / RETRIEVAL ─────────────────────────────────────────────────
  {
    id: "algo-lru-cache",
    name: "LRU Cache (Least Recently Used)",
    domain: "Memory",
    subDomain: "Cache Replacement",
    timeComplexity: "O(1) get/put",
    spaceComplexity: "O(capacity)",
    description: "Cache eviction policy that removes the least recently used item when capacity is reached. Implemented with HashMap + doubly-linked list.",
    bestUseCase: "Frequently accessed data with temporal locality",
    worstCase: "Sequential access patterns (every item evicted on access)",
    references: ["Belady (1966) — Optimal page replacement", "King (1971) — LRU formal analysis"],
    implementation: "active",
    performanceScore: 92,
    sovereignApplication: "LLM response caching, memory shard hot cache, API response caching",
    yearDiscovered: 1965,
    inventor: "László Bélády (optimal basis)",
  },
  {
    id: "algo-hnsw",
    name: "HNSW (Hierarchical NSW)",
    domain: "Memory",
    subDomain: "Approximate Nearest Neighbor",
    timeComplexity: "O(log n) query",
    spaceComplexity: "O(n * M) where M = connections",
    description: "State-of-the-art approximate nearest neighbor graph. Used by Pinecone, Weaviate, FAISS. Builds a layered proximity graph.",
    bestUseCase: "High-dimensional vector search, semantic similarity",
    worstCase: "Exact nearest neighbor requirements (use brute force)",
    references: ["Malkov & Yashunin (2016)", "FAISS library — Meta AI"],
    implementation: "planned",
    performanceScore: 97,
    sovereignApplication: "Future semantic memory retrieval upgrade (currently using BM25 keyword search)",
    yearDiscovered: 2016,
    inventor: "Yury Malkov & Dmitry Yashunin",
  },
  // ── NETWORKING / ROUTING ───────────────────────────────────────────────
  {
    id: "algo-chord",
    name: "Chord DHT",
    domain: "Networking",
    subDomain: "Distributed Hash Table",
    timeComplexity: "O(log n) lookup",
    spaceComplexity: "O(log n) routing table",
    description: "Peer-to-peer distributed hash table. Each node maintains a finger table for O(log n) lookup routing.",
    bestUseCase: "Decentralized peer-to-peer networks, content addressing",
    worstCase: "Highly dynamic networks with frequent churn",
    references: ["Stoica et al. (2001) — Chord: A Scalable P2P Lookup Protocol"],
    implementation: "planned",
    performanceScore: 90,
    sovereignApplication: "Future sovereign lattice DHT for decentralized knowledge storage",
    yearDiscovered: 2001,
    inventor: "Ion Stoica, Robert Morris, David Karger, M. Frans Kaashoek",
  },
  {
    id: "algo-tcp-bbr",
    name: "TCP BBR (Bottleneck Bandwidth & RTT)",
    domain: "Networking",
    subDomain: "Congestion Control",
    timeComplexity: "O(1) per packet",
    spaceComplexity: "O(1)",
    description: "Google's model-based TCP congestion control. Achieves 2700x higher throughput vs CUBIC in high-latency networks.",
    bestUseCase: "High-bandwidth high-latency networks (satellite, intercontinental)",
    worstCase: "Networks with lots of shallow buffers",
    references: ["Cardwell et al. (2016) — BBR: Congestion-Based Congestion Control"],
    implementation: "available",
    performanceScore: 95,
    sovereignApplication: "Fleet instance interconnect optimization, agent message delivery",
    yearDiscovered: 2016,
    inventor: "Neal Cardwell, Yuchung Cheng, C. Stephen Gunn et al. (Google)",
  },
  // ── AI PLANNING ────────────────────────────────────────────────────────
  {
    id: "algo-mcts",
    name: "Monte Carlo Tree Search (MCTS)",
    domain: "AI Planning",
    subDomain: "Game Tree / Decision Making",
    timeComplexity: "O(n) simulations",
    spaceComplexity: "O(n) tree nodes",
    description: "Balances exploration and exploitation using UCB1 formula. Foundation of AlphaGo, AlphaZero. No domain knowledge required.",
    bestUseCase: "Sequential decision making, game playing, agent planning under uncertainty",
    worstCase: "Continuous action spaces without adaptation",
    references: ["Coulom (2006)", "Silver et al. (2016) — AlphaGo — DeepMind"],
    implementation: "planned",
    performanceScore: 95,
    sovereignApplication: "Agent decision trees, income strategy selection, multi-step task planning",
    yearDiscovered: 2006,
    inventor: "Rémi Coulom",
  },
  {
    id: "algo-beam-search",
    name: "Beam Search",
    domain: "AI Planning",
    subDomain: "Sequence Decoding",
    timeComplexity: "O(n * B) where B = beam width",
    spaceComplexity: "O(B * n)",
    description: "Heuristic search that expands the B most promising nodes. Used in LLM decoding, machine translation, speech recognition.",
    bestUseCase: "Sequence generation where greedy decoding is suboptimal",
    worstCase: "Problems where optimal path is much better than top-B paths",
    references: ["Lowerre (1976) — Harpy speech system", "Widely adopted in NLP since 1990s"],
    implementation: "active",
    performanceScore: 87,
    sovereignApplication: "LLM response quality optimization, agent message synthesis",
    yearDiscovered: 1976,
    inventor: "Bruce Lowerre",
  },
];

// ── Domain-Algorithm Selector ──────────────────────────────────────────────

export interface AlgorithmRecommendation {
  domain: string;
  recommended: AlgorithmEntry;
  alternatives: AlgorithmEntry[];
  reasoning: string;
  implementationStatus: string;
}

export function recommendAlgorithm(domain: string, useCase: string): AlgorithmRecommendation | null {
  const domainLower = domain.toLowerCase();
  const useLower = useCase.toLowerCase();

  // Score each algorithm for relevance
  const scored = ALGORITHM_CATALOG.map(algo => {
    let score = 0;
    if (algo.domain.toLowerCase().includes(domainLower)) score += 50;
    if (algo.subDomain.toLowerCase().includes(domainLower)) score += 30;
    if (algo.bestUseCase.toLowerCase().includes(useLower)) score += 20;
    if (algo.sovereignApplication.toLowerCase().includes(useLower)) score += 25;
    if (algo.implementation === "active") score += 15;
    if (algo.implementation === "available") score += 8;
    score += (algo.performanceScore / 100) * 10;
    return { algo, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const recommended = scored[0].algo;
  const alternatives = scored.slice(1, 4).map(s => s.algo);

  return {
    domain,
    recommended,
    alternatives,
    reasoning: `${recommended.name} selected for ${domain}/${useCase}: ${recommended.description} Best use case: ${recommended.bestUseCase}`,
    implementationStatus: recommended.implementation,
  };
}

// ── Benchmark Runner ───────────────────────────────────────────────────────

export interface BenchmarkResult {
  algorithmId: string;
  algorithmName: string;
  domain: string;
  inputSize: number;
  durationMs: number;
  opsPerSecond: number;
  score: number;
}

export function benchmarkSort(n: number = 10000): BenchmarkResult {
  // Generate test array
  const arr = Array.from({ length: n }, () => Math.random() * 1000000 | 0);

  // Timsort (JavaScript's native Array.sort IS Timsort in V8)
  const copy = [...arr];
  const start = performance.now();
  copy.sort((a, b) => a - b);
  const durationMs = performance.now() - start;

  return {
    algorithmId: "algo-timsort",
    algorithmName: "Timsort (V8 native)",
    domain: "Sorting",
    inputSize: n,
    durationMs,
    opsPerSecond: Math.round(n / (durationMs / 1000)),
    score: Math.min(100, Math.round((10000 / durationMs) * 10)),
  };
}

export function benchmarkHash(iterations: number = 100000): BenchmarkResult {
  const start = performance.now();
  let h = "";
  for (let i = 0; i < iterations; i++) {
    h = require("crypto").createHash("sha256").update(`test-data-${i}`).digest("hex");
  }
  const durationMs = performance.now() - start;

  return {
    algorithmId: "algo-sha256",
    algorithmName: "SHA-256 (OpenSSL)",
    domain: "Cryptography",
    inputSize: iterations,
    durationMs,
    opsPerSecond: Math.round(iterations / (durationMs / 1000)),
    score: Math.min(100, Math.round(iterations / durationMs)),
  };
}

export function benchmarkLRUCache(operations: number = 100000): BenchmarkResult {
  // Simple LRU cache benchmark
  const cache = new Map<number, number>();
  const capacity = 1000;
  const start = performance.now();

  for (let i = 0; i < operations; i++) {
    const key = i % (capacity * 2); // Access pattern that causes evictions
    if (cache.has(key)) {
      cache.get(key);
    } else {
      if (cache.size >= capacity) {
        cache.delete(cache.keys().next().value!);
      }
      cache.set(key, i);
    }
  }

  const durationMs = performance.now() - start;
  return {
    algorithmId: "algo-lru-cache",
    algorithmName: "LRU Cache (Map-based)",
    domain: "Memory",
    inputSize: operations,
    durationMs,
    opsPerSecond: Math.round(operations / (durationMs / 1000)),
    score: Math.min(100, Math.round(operations / durationMs / 10)),
  };
}

// ── Full Benchmark Suite ───────────────────────────────────────────────────

export async function runAlgorithmBenchmarks(): Promise<{
  results: BenchmarkResult[];
  totalScore: number;
  grade: string;
  timestamp: number;
}> {
  log("Starting algorithm benchmark suite...");
  const results: BenchmarkResult[] = [];

  results.push(benchmarkSort(10000));
  results.push(benchmarkHash(10000));
  results.push(benchmarkLRUCache(50000));

  const totalScore = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
  const grade = totalScore >= 90 ? "A+" : totalScore >= 80 ? "A" : totalScore >= 70 ? "B" : totalScore >= 60 ? "C" : "D";

  log(`Algorithm benchmarks complete: score=${totalScore} grade=${grade}`);
  return { results, totalScore, grade, timestamp: Date.now() };
}

// ── Public API ─────────────────────────────────────────────────────────────

export function getAlgorithmCatalog(domain?: string): AlgorithmEntry[] {
  if (!domain) return ALGORITHM_CATALOG;
  const dl = domain.toLowerCase();
  return ALGORITHM_CATALOG.filter(a =>
    a.domain.toLowerCase().includes(dl) ||
    a.subDomain.toLowerCase().includes(dl)
  );
}

export function getAlgorithmById(id: string): AlgorithmEntry | undefined {
  return ALGORITHM_CATALOG.find(a => a.id === id);
}

export function getAlgorithmStats() {
  const domains = [...new Set(ALGORITHM_CATALOG.map(a => a.domain))];
  const active = ALGORITHM_CATALOG.filter(a => a.implementation === "active").length;
  const available = ALGORITHM_CATALOG.filter(a => a.implementation === "available").length;
  const planned = ALGORITHM_CATALOG.filter(a => a.implementation === "planned").length;
  const avgPerformance = Math.round(ALGORITHM_CATALOG.reduce((s, a) => s + a.performanceScore, 0) / ALGORITHM_CATALOG.length);
  return {
    totalAlgorithms: ALGORITHM_CATALOG.length,
    domains: domains.length,
    active,
    available,
    planned,
    avgPerformanceScore: avgPerformance,
    domainBreakdown: domains.map(d => ({
      domain: d,
      count: ALGORITHM_CATALOG.filter(a => a.domain === d).length,
      avgScore: Math.round(
        ALGORITHM_CATALOG.filter(a => a.domain === d).reduce((s, a) => s + a.performanceScore, 0) /
        ALGORITHM_CATALOG.filter(a => a.domain === d).length
      ),
    })),
  };
}

export function searchAlgorithms(query: string): AlgorithmEntry[] {
  const q = query.toLowerCase();
  return ALGORITHM_CATALOG.filter(a =>
    a.name.toLowerCase().includes(q) ||
    a.description.toLowerCase().includes(q) ||
    a.sovereignApplication.toLowerCase().includes(q) ||
    a.domain.toLowerCase().includes(q) ||
    (a.inventor || "").toLowerCase().includes(q)
  );
}

log(`Algorithm Archaeology Engine loaded — ${ALGORITHM_CATALOG.length} algorithms cataloged across ${[...new Set(ALGORITHM_CATALOG.map(a => a.domain))].length} domains`);
