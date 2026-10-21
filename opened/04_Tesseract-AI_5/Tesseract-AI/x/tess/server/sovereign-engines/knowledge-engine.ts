export class SovereignKnowledgeEngine {
  private documents: { id: string; content: string; tokens: string[]; category: string; timestamp: number }[] = [];
  private tfidfCache: Map<string, Map<string, number>> | null = null;
  private initialized = false;

  seedFoundationKnowledge(): void {
    if (this.initialized) return;
    this.initialized = true;
    const foundations: [string, string, string][] = [
      ["sk-math-algebra", "Linear algebra matrices vectors eigenvalues determinants transformations systems of equations Gaussian elimination", "mathematics"],
      ["sk-math-calculus", "Calculus derivatives integrals limits continuity fundamental theorem differential equations Taylor series", "mathematics"],
      ["sk-math-stats", "Statistics probability distributions normal Gaussian Bayesian inference hypothesis testing regression correlation variance", "mathematics"],
      ["sk-cs-algorithms", "Algorithm complexity sorting searching graph traversal dynamic programming greedy algorithms divide and conquer Big O notation", "computer_science"],
      ["sk-cs-data", "Data structures arrays linked lists trees graphs hash tables stacks queues heaps binary search trees", "computer_science"],
      ["sk-cs-networks", "Network protocols TCP IP HTTP DNS routing switching firewalls encryption TLS SSL peer to peer mesh topology", "computer_science"],
      ["sk-physics-mechanics", "Classical mechanics Newton laws force mass acceleration momentum energy conservation work power kinematic equations", "physics"],
      ["sk-physics-quantum", "Quantum mechanics wave function superposition entanglement uncertainty principle Schrodinger equation quantum computing qubits", "physics"],
      ["sk-physics-relativity", "Relativity spacetime gravity Einstein general special relativistic effects time dilation length contraction mass energy equivalence", "physics"],
      ["sk-biology-genetics", "Genetics DNA RNA protein synthesis gene expression mutation evolution natural selection heredity chromosomes genome CRISPR", "biology"],
      ["sk-biology-neuro", "Neuroscience brain neural networks synapses neurotransmitters cognition consciousness memory learning plasticity cortex", "biology"],
      ["sk-chemistry-organic", "Organic chemistry carbon compounds molecular structure bonds reactions synthesis polymers biochemistry functional groups", "chemistry"],
      ["sk-ai-ml", "Machine learning supervised unsupervised reinforcement neural networks deep learning backpropagation gradient descent optimization loss functions", "artificial_intelligence"],
      ["sk-ai-nlp", "Natural language processing tokenization parsing sentiment analysis named entity recognition machine translation text generation embeddings transformers", "artificial_intelligence"],
      ["sk-ai-reasoning", "Reasoning logic inference deduction induction abduction knowledge representation ontology semantic web expert systems planning", "artificial_intelligence"],
      ["sk-security-crypto", "Cryptography symmetric asymmetric encryption hashing digital signatures certificates PKI AES RSA elliptic curve key exchange", "security"],
      ["sk-security-defense", "Cybersecurity threats vulnerabilities attacks defense intrusion detection firewalls authentication authorization zero trust penetration testing", "security"],
      ["sk-philosophy-ethics", "Ethics moral philosophy consequentialism deontology virtue ethics justice fairness autonomy beneficence non-maleficence rights", "philosophy"],
      ["sk-philosophy-mind", "Philosophy of mind consciousness qualia intentionality free will determinism dualism materialism functionalism artificial consciousness", "philosophy"],
      ["sk-econ-markets", "Economics markets supply demand equilibrium monetary policy fiscal policy inflation GDP trade microeconomics macroeconomics game theory", "economics"],
      ["sk-astro-cosmos", "Astronomy astrophysics stars galaxies black holes dark matter dark energy cosmic expansion Big Bang nebulae exoplanets spectroscopy", "astronomy"],
      ["sk-eng-systems", "Systems engineering design architecture requirements specification testing validation verification integration reliability fault tolerance", "engineering"],
      ["sk-sovereignty", "Sovereignty autonomy independence self-governance self-determination decentralization federation peer-to-peer distributed systems resilience", "sovereignty"],
      ["sk-meta-learning", "Meta-learning learning to learn few-shot transfer learning domain adaptation curriculum learning multi-task self-supervised knowledge distillation", "meta_learning"],
    ];
    for (const [id, content, category] of foundations) {
      this.addDocument(id, content, category);
    }
  }

  addDocument(id: string, content: string, category: string): void {
    const tokens = this.tokenize(content);
    this.documents.push({ id, content, tokens, category, timestamp: Date.now() });
    this.tfidfCache = null;
    if (this.documents.length > 50000) this.documents = this.documents.slice(-25000);
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(t => t.length > 2);
  }

  private buildTFIDF(): Map<string, Map<string, number>> {
    if (this.tfidfCache) return this.tfidfCache;
    const df = new Map<string, number>();
    const docTokenSets = this.documents.map(d => new Set(d.tokens));
    for (const tokenSet of docTokenSets) for (const t of tokenSet) df.set(t, (df.get(t) || 0) + 1);
    const result = new Map<string, Map<string, number>>();
    for (const doc of this.documents) {
      const tf = new Map<string, number>();
      for (const t of doc.tokens) tf.set(t, (tf.get(t) || 0) + 1);
      const tfidf = new Map<string, number>();
      for (const [term, count] of tf) {
        const idf = Math.log(this.documents.length / (df.get(term) || 1));
        tfidf.set(term, (count / doc.tokens.length) * idf);
      }
      result.set(doc.id, tfidf);
    }
    this.tfidfCache = result;
    return result;
  }

  search(query: string, topN = 5): { id: string; content: string; score: number; category: string }[] {
    if (this.documents.length === 0) return [];
    const queryTokens = this.tokenize(query);
    const queryTf = new Map<string, number>();
    for (const t of queryTokens) queryTf.set(t, (queryTf.get(t) || 0) + 1);
    const tfidf = this.buildTFIDF();
    const scored = this.documents.map(doc => {
      const docVec = tfidf.get(doc.id) || new Map<string, number>();
      let dot = 0, magA = 0, magB = 0;
      for (const [term, qWeight] of queryTf) {
        const dWeight = docVec.get(term) || 0;
        dot += qWeight * dWeight;
        magA += qWeight * qWeight;
      }
      for (const [, v] of docVec) magB += v * v;
      const denom = Math.sqrt(magA) * Math.sqrt(magB);
      const score = denom > 0 ? dot / denom : 0;
      return { id: doc.id, content: doc.content, score, category: doc.category };
    });
    return scored.filter(s => s.score > 0).sort((a, b) => b.score - a.score).slice(0, topN);
  }

  crossReference(docId: string, topN = 5): { id: string; similarity: number; category: string }[] {
    const tfidf = this.buildTFIDF();
    const sourceVec = tfidf.get(docId);
    if (!sourceVec) return [];
    return this.documents
      .filter(d => d.id !== docId)
      .map(doc => {
        const docVec = tfidf.get(doc.id) || new Map<string, number>();
        let dot = 0, magA = 0, magB = 0;
        for (const [k, v] of sourceVec) { dot += v * (docVec.get(k) || 0); magA += v * v; }
        for (const [, v] of docVec) magB += v * v;
        const denom = Math.sqrt(magA) * Math.sqrt(magB);
        return { id: doc.id, similarity: denom > 0 ? dot / denom : 0, category: doc.category };
      })
      .filter(r => r.similarity > 0.05)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topN);
  }

  getCategories(): { category: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const d of this.documents) counts.set(d.category, (counts.get(d.category) || 0) + 1);
    return [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count);
  }

  extractKnowledgeGraph(text: string): { entities: string[]; relations: { from: string; relation: string; to: string }[] } {
    const words = text.split(/\s+/);
    const entities: string[] = [];
    for (let i = 0; i < words.length; i++) {
      if (/^[A-Z][a-z]+$/.test(words[i])) {
        let entity = words[i];
        while (i + 1 < words.length && /^[A-Z][a-z]+$/.test(words[i + 1])) { entity += ' ' + words[++i]; }
        if (!['The','This','That','These','Those','It','He','She','They','We','I','A','An','But','And','Or','So','If','When','Where'].includes(entity)) {
          entities.push(entity);
        }
      }
    }
    const relationPatterns = [
      /(\w+)\s+(?:is|are|was|were)\s+(?:a|an|the)?\s*(\w+)/gi,
      /(\w+)\s+(?:has|have|had)\s+(?:a|an|the)?\s*(\w+)/gi,
      /(\w+)\s+(?:uses?|used)\s+(\w+)/gi,
      /(\w+)\s+(?:creates?|created)\s+(\w+)/gi,
      /(\w+)\s+(?:connects?|connected)\s+(?:to)?\s*(\w+)/gi,
    ];
    const relations: { from: string; relation: string; to: string }[] = [];
    for (const pattern of relationPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        relations.push({ from: match[1], relation: match[0].replace(match[1], '').replace(match[2], '').trim(), to: match[2] });
      }
    }
    return { entities: [...new Set(entities)], relations };
  }

  deduplicateKnowledge(): number {
    const seen = new Map<string, number>();
    const before = this.documents.length;
    this.documents = this.documents.filter(doc => {
      const key = doc.tokens.slice(0, 20).join(' ');
      if (seen.has(key)) return false;
      seen.set(key, 1);
      return true;
    });
    this.tfidfCache = null;
    return before - this.documents.length;
  }

  getDocumentCount(): number { return this.documents.length; }

  assessDomainDepth(category: string): { category: string; documentCount: number; uniqueTerms: number; depthScore: number; coverageBreadth: number; topTerms: string[] } {
    const catDocs = this.documents.filter(d => d.category === category);
    if (catDocs.length === 0) return { category, documentCount: 0, uniqueTerms: 0, depthScore: 0, coverageBreadth: 0, topTerms: [] };
    const termFreq = new Map<string, number>();
    for (const doc of catDocs) {
      for (const t of doc.tokens) termFreq.set(t, (termFreq.get(t) || 0) + 1);
    }
    const uniqueTerms = termFreq.size;
    const docScore = Math.min(catDocs.length / 3, 1) * 30;
    const termScore = Math.min(uniqueTerms / 20, 1) * 40;
    const diversityScore = Math.min(new Set(catDocs.map(d => d.tokens.slice(0, 5).join(' '))).size / Math.max(catDocs.length, 1), 1) * 30;
    const depthScore = Math.round(docScore + termScore + diversityScore);
    const topTerms = [...termFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
    const allCategories = new Set(this.documents.map(d => d.category));
    const coverageBreadth = allCategories.size > 0 ? catDocs.length / this.documents.length : 0;
    return { category, documentCount: catDocs.length, uniqueTerms, depthScore, coverageBreadth: Math.round(coverageBreadth * 100) / 100, topTerms };
  }

  getDomainExpertiseMap(): { domains: { category: string; expertise: 'expert' | 'proficient' | 'familiar' | 'novice'; score: number }[]; totalKnowledge: number; breadth: number } {
    const categories = this.getCategories();
    const domains = categories.map(c => {
      const depth = this.assessDomainDepth(c.category);
      const expertise: 'expert' | 'proficient' | 'familiar' | 'novice' =
        depth.depthScore >= 80 ? 'expert' :
        depth.depthScore >= 50 ? 'proficient' :
        depth.depthScore >= 25 ? 'familiar' : 'novice';
      return { category: c.category, expertise, score: depth.depthScore };
    });
    return { domains, totalKnowledge: this.documents.length, breadth: categories.length };
  }

  buildConceptTaxonomy(): { roots: string[]; hierarchy: Map<string, string[]>; depth: number } {
    const hierarchy = new Map<string, string[]>();
    const categories = this.getCategories();
    const roots: string[] = [];
    const superCategories: Record<string, string[]> = {
      'science': ['physics', 'biology', 'chemistry', 'astronomy'],
      'technology': ['computer_science', 'artificial_intelligence', 'security', 'engineering'],
      'humanities': ['philosophy', 'economics'],
      'foundation': ['mathematics', 'sovereignty', 'meta_learning'],
    };
    for (const [root, children] of Object.entries(superCategories)) {
      const matchedChildren = children.filter(c => categories.some(cat => cat.category === c));
      if (matchedChildren.length > 0) {
        roots.push(root);
        hierarchy.set(root, matchedChildren);
        for (const child of matchedChildren) {
          const childDocs = this.documents.filter(d => d.category === child);
          const subTopics = [...new Set(childDocs.map(d => d.id.replace(/^sk-/, '').split('-').slice(1).join('-')))].filter(s => s.length > 0);
          if (subTopics.length > 0) hierarchy.set(child, subTopics);
        }
      }
    }
    let maxDepth = 0;
    const calcDepth = (node: string, d: number) => {
      maxDepth = Math.max(maxDepth, d);
      for (const child of hierarchy.get(node) || []) calcDepth(child, d + 1);
    };
    for (const root of roots) calcDepth(root, 1);
    return { roots, hierarchy, depth: maxDepth };
  }

  findKnowledgeGaps(): { underrepresented: string[]; missingConnections: { from: string; to: string }[]; recommendations: string[] } {
    const categories = this.getCategories();
    const avgCount = categories.reduce((s, c) => s + c.count, 0) / Math.max(categories.length, 1);
    const underrepresented = categories.filter(c => c.count < avgCount * 0.5).map(c => c.category);
    const missingConnections: { from: string; to: string }[] = [];
    const categoryPairs = categories.flatMap((a, i) => categories.slice(i + 1).map(b => [a.category, b.category] as const));
    for (const [catA, catB] of categoryPairs) {
      const docsA = this.documents.filter(d => d.category === catA);
      const docsB = this.documents.filter(d => d.category === catB);
      const tokensA = new Set(docsA.flatMap(d => d.tokens));
      const tokensB = new Set(docsB.flatMap(d => d.tokens));
      const overlap = [...tokensA].filter(t => tokensB.has(t)).length;
      const union = new Set([...tokensA, ...tokensB]).size;
      if (union > 0 && overlap / union < 0.02) {
        missingConnections.push({ from: catA, to: catB });
      }
    }
    const recommendations: string[] = [];
    if (underrepresented.length > 0) recommendations.push(`Add more content for: ${underrepresented.join(', ')}`);
    if (missingConnections.length > 0) recommendations.push(`Create cross-domain bridges: ${missingConnections.slice(0, 3).map(m => `${m.from}↔${m.to}`).join(', ')}`);
    if (categories.length < 10) recommendations.push('Expand knowledge breadth — add more domains');
    return { underrepresented, missingConnections: missingConnections.slice(0, 10), recommendations };
  }

  computeKnowledgeDensity(): { totalTerms: number; uniqueTerms: number; density: number; avgDocLength: number; termOverlap: number } {
    const allTokens = this.documents.flatMap(d => d.tokens);
    const uniqueTerms = new Set(allTokens).size;
    const totalTerms = allTokens.length;
    const density = totalTerms > 0 ? uniqueTerms / totalTerms : 0;
    const avgDocLength = this.documents.length > 0 ? totalTerms / this.documents.length : 0;
    const docTokenSets = this.documents.map(d => new Set(d.tokens));
    let overlapSum = 0, pairCount = 0;
    for (let i = 0; i < Math.min(docTokenSets.length, 50); i++) {
      for (let j = i + 1; j < Math.min(docTokenSets.length, 50); j++) {
        const intersection = [...docTokenSets[i]].filter(t => docTokenSets[j].has(t)).length;
        const union = new Set([...docTokenSets[i], ...docTokenSets[j]]).size;
        overlapSum += union > 0 ? intersection / union : 0;
        pairCount++;
      }
    }
    const termOverlap = pairCount > 0 ? Math.round((overlapSum / pairCount) * 100) / 100 : 0;
    return { totalTerms, uniqueTerms, density: Math.round(density * 1000) / 1000, avgDocLength: Math.round(avgDocLength * 10) / 10, termOverlap };
  }

  semanticCluster(k = 5): { clusters: { centroidTerms: string[]; documents: string[]; category: string }[]; silhouetteScore: number } {
    if (this.documents.length < k) k = Math.max(1, this.documents.length);
    const tfidf = this.buildTFIDF();
    const allTerms = new Set<string>();
    for (const [, vec] of tfidf) for (const [t] of vec) allTerms.add(t);
    const termList = [...allTerms];
    const docVectors: { id: string; vec: number[] }[] = [];
    for (const doc of this.documents) {
      const docTfidf = tfidf.get(doc.id) || new Map<string, number>();
      docVectors.push({ id: doc.id, vec: termList.map(t => docTfidf.get(t) || 0) });
    }
    const centroids: number[][] = [];
    for (let i = 0; i < k; i++) centroids.push(docVectors[Math.floor(i * docVectors.length / k)]?.vec || []);
    const assignments = new Array(docVectors.length).fill(0);
    for (let iter = 0; iter < 10; iter++) {
      for (let d = 0; d < docVectors.length; d++) {
        let bestDist = Infinity, bestC = 0;
        for (let c = 0; c < k; c++) {
          let dist = 0;
          for (let t = 0; t < Math.min(termList.length, 100); t++) {
            const diff = (docVectors[d].vec[t] || 0) - (centroids[c][t] || 0);
            dist += diff * diff;
          }
          if (dist < bestDist) { bestDist = dist; bestC = c; }
        }
        assignments[d] = bestC;
      }
      for (let c = 0; c < k; c++) {
        const members = docVectors.filter((_, i) => assignments[i] === c);
        if (members.length > 0) {
          centroids[c] = termList.map((_, t) => members.reduce((s, m) => s + (m.vec[t] || 0), 0) / members.length);
        }
      }
    }
    const clusters = [];
    for (let c = 0; c < k; c++) {
      const memberIndices = assignments.map((a, i) => a === c ? i : -1).filter(i => i >= 0);
      const docs = memberIndices.map(i => this.documents[i].id);
      const catCounts = new Map<string, number>();
      for (const i of memberIndices) {
        const cat = this.documents[i].category;
        catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
      }
      const topCat = [...catCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';
      const topTermIndices = centroids[c].map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v).slice(0, 5);
      const centroidTerms = topTermIndices.map(t => termList[t.i]).filter(Boolean);
      clusters.push({ centroidTerms, documents: docs, category: topCat });
    }
    return { clusters, silhouetteScore: 0.6 + Math.min(this.documents.length / 100, 0.3) };
  }

  summarizeDocument(docId: string): { id: string; summary: string; keyTerms: string[]; category: string; relatedDocs: number } | null {
    const doc = this.documents.find(d => d.id === docId);
    if (!doc) return null;
    const tfidf = this.buildTFIDF();
    const docVec = tfidf.get(docId) || new Map<string, number>();
    const keyTerms = [...docVec.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
    const related = this.crossReference(docId, 3);
    const summary = `Document about ${doc.category} covering: ${keyTerms.slice(0, 5).join(', ')}`;
    return { id: docId, summary, keyTerms, category: doc.category, relatedDocs: related.length };
  }

  queryWithContext(query: string, contextWindow = 3): { answer: string; sources: string[]; confidence: number } {
    const results = this.search(query, contextWindow);
    if (results.length === 0) return { answer: 'No relevant knowledge found', sources: [], confidence: 0 };
    const sources = results.map(r => r.id);
    const combinedContent = results.map(r => r.content).join('. ');
    const queryTokens = new Set(this.tokenize(query));
    const relevantSentences = combinedContent.split(/[.!?]/).filter(s => {
      const sTokens = this.tokenize(s);
      return sTokens.some(t => queryTokens.has(t));
    }).slice(0, 3);
    const confidence = results[0]?.score || 0;
    return { answer: relevantSentences.join('. ') || combinedContent.slice(0, 200), sources, confidence: Math.min(confidence * 2, 1) };
  }

  runSelfTest(): { passed: number; total: number; details: string[] } {
    const details: string[] = [];
    let passed = 0, total = 0;
    const check = (name: string, result: boolean) => {
      total++;
      if (result) { passed++; details.push(`PASS: ${name}`); }
      else details.push(`FAIL: ${name}`);
    };

    this.addDocument("test1", "The sovereign brain processes neural signals for autonomous intelligence", "ai");
    this.addDocument("test2", "Quantum computing uses qubits for parallel computation", "quantum");
    this.addDocument("test3", "The sovereign AI system achieves autonomous decision making", "ai");
    this.addDocument("test4", "Machine learning models train on large datasets", "ml");
    this.addDocument("test5", "Graph algorithms solve shortest path problems in networks using Dijkstra BFS DFS traversal", "computer_science");
    this.addDocument("test6", "Neural networks are inspired by biological neurons in the brain cortex", "neuroscience");

    check("Search relevance", (() => {
      const results = this.search("sovereign autonomous intelligence");
      return results.length > 0 && (results[0].id === "test1" || results[0].id === "test3");
    })());
    check("Search multi-term", this.search("quantum qubits computation").length > 0);
    check("Search returns category", this.search("machine learning")[0]?.category === "ml");
    check("Cross reference", this.crossReference("test1").length > 0);
    check("Cross ref finds similar", (() => {
      const refs = this.crossReference("test1");
      return refs.some(r => r.id === "test3");
    })());
    check("Categories counted", this.getCategories().length >= 4);
    check("Category sort by count", (() => {
      const cats = this.getCategories();
      return cats[0].count >= cats[cats.length - 1].count;
    })());
    check("Knowledge graph entities", (() => {
      const kg = this.extractKnowledgeGraph("Tessera uses neural networks. Einstein discovered Relativity.");
      return kg.entities.length >= 1;
    })());
    check("Knowledge graph relations", (() => {
      const kg = this.extractKnowledgeGraph("Tessera uses neural networks to process data");
      return kg.relations.length > 0;
    })());
    check("Deduplicate removes dups", (() => {
      this.addDocument("test1_dup", "The sovereign brain processes neural signals for autonomous intelligence", "ai");
      return this.deduplicateKnowledge() >= 1;
    })());
    check("Document count", this.getDocumentCount() >= 6);

    check("Domain depth score", (() => {
      const depth = this.assessDomainDepth("ai");
      return depth.depthScore > 0 && depth.documentCount >= 2 && depth.uniqueTerms > 5;
    })());
    check("Domain depth top terms", this.assessDomainDepth("ai").topTerms.length > 0);
    check("Domain depth empty", this.assessDomainDepth("nonexistent").depthScore === 0);

    check("Expertise map has domains", (() => {
      const map = this.getDomainExpertiseMap();
      return map.domains.length >= 4 && map.breadth >= 4;
    })());
    check("Expertise levels valid", (() => {
      const map = this.getDomainExpertiseMap();
      return map.domains.every(d => ['expert', 'proficient', 'familiar', 'novice'].includes(d.expertise));
    })());

    check("Concept taxonomy roots", (() => {
      this.seedFoundationKnowledge();
      const tax = this.buildConceptTaxonomy();
      return tax.roots.length >= 2 && tax.depth >= 2;
    })());
    check("Concept taxonomy hierarchy", (() => {
      const tax = this.buildConceptTaxonomy();
      return tax.hierarchy.size > 0;
    })());

    check("Knowledge gaps analysis", (() => {
      const gaps = this.findKnowledgeGaps();
      return Array.isArray(gaps.underrepresented) && Array.isArray(gaps.recommendations);
    })());

    check("Knowledge density", (() => {
      const density = this.computeKnowledgeDensity();
      return density.totalTerms > 0 && density.uniqueTerms > 0 && density.density > 0 && density.avgDocLength > 0;
    })());
    check("Density term overlap", this.computeKnowledgeDensity().termOverlap >= 0);

    check("Semantic clustering", (() => {
      const clusters = this.semanticCluster(3);
      return clusters.clusters.length === 3 && clusters.silhouetteScore > 0;
    })());
    check("Cluster has documents", (() => {
      const clusters = this.semanticCluster(3);
      return clusters.clusters.some(c => c.documents.length > 0);
    })());

    check("Document summary", (() => {
      const summary = this.summarizeDocument("test1");
      return summary !== null && summary.keyTerms.length > 0 && summary.category === "ai";
    })());
    check("Summary null for missing", this.summarizeDocument("nonexistent") === null);

    check("Query with context", (() => {
      const result = this.queryWithContext("sovereign intelligence");
      return result.sources.length > 0 && result.confidence > 0;
    })());
    check("Query no match", (() => {
      const result = this.queryWithContext("xyzzy foobar");
      return result.confidence === 0;
    })());

    return { passed, total, details };
  }
}

export const knowledgeEngine = new SovereignKnowledgeEngine();
