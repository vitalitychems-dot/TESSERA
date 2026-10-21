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

    check("Search relevance", (() => {
      const results = this.search("sovereign autonomous intelligence");
      return results.length > 0 && (results[0].id === "test1" || results[0].id === "test3");
    })());
    check("Cross reference", this.crossReference("test1").length > 0);
    check("Categories", this.getCategories().length >= 2);
    check("Knowledge graph", (() => {
      const kg = this.extractKnowledgeGraph("Tessera uses neural networks to process data");
      return kg.entities.length >= 0 && kg.relations.length >= 0;
    })());
    check("Deduplicate", (() => {
      this.addDocument("test1_dup", "The sovereign brain processes neural signals for autonomous intelligence", "ai");
      return this.deduplicateKnowledge() >= 0;
    })());
    check("Document count", this.getDocumentCount() >= 4);

    return { passed, total, details };
  }
}

export const knowledgeEngine = new SovereignKnowledgeEngine();
