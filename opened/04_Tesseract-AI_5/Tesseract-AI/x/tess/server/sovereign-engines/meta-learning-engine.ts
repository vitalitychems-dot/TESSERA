export class SovereignMetaLearningEngine {
  private interactionLog: { input: string; output: string; feedback: number; category: string; timestamp: number }[] = [];
  private learnedPatterns: Map<string, { response: string; confidence: number; uses: number }> = new Map();
  private categoryPerformance: Map<string, { total: number; positive: number; avgFeedback: number }> = new Map();
  private transferMap: Map<string, string[]> = new Map();

  recordInteraction(input: string, output: string, feedback: number, category: string): void {
    this.interactionLog.push({ input, output, feedback, category, timestamp: Date.now() });
    const key = this.normalizeInput(input);
    if (feedback > 0.7) {
      const existing = this.learnedPatterns.get(key);
      if (!existing || feedback > existing.confidence) {
        this.learnedPatterns.set(key, { response: output, confidence: feedback, uses: (existing?.uses || 0) + 1 });
      }
    }
    const perf = this.categoryPerformance.get(category) || { total: 0, positive: 0, avgFeedback: 0 };
    perf.total++;
    if (feedback > 0.5) perf.positive++;
    perf.avgFeedback = ((perf.avgFeedback * (perf.total - 1)) + feedback) / perf.total;
    this.categoryPerformance.set(category, perf);
    if (this.interactionLog.length > 10000) this.interactionLog = this.interactionLog.slice(-5000);
  }

  private normalizeInput(input: string): string {
    return input.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).sort().join(' ');
  }

  recallLearned(input: string): { response: string; confidence: number } | null {
    const key = this.normalizeInput(input);
    const exact = this.learnedPatterns.get(key);
    if (exact && exact.confidence > 0.6) {
      exact.uses++;
      return { response: exact.response, confidence: exact.confidence };
    }
    const inputTokens = new Set(key.split(' '));
    let bestMatch: { response: string; confidence: number } | null = null;
    let bestSimilarity = 0;
    for (const [patternKey, pattern] of this.learnedPatterns) {
      const patternTokens = new Set(patternKey.split(' '));
      const intersection = [...inputTokens].filter(t => patternTokens.has(t)).length;
      const union = new Set([...inputTokens, ...patternTokens]).size;
      const similarity = union > 0 ? intersection / union : 0;
      if (similarity > 0.3 && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = { response: pattern.response, confidence: pattern.confidence * similarity };
      }
    }
    return bestMatch;
  }

  learnTransfer(sourceCategory: string, targetCategory: string): void {
    const existing = this.transferMap.get(sourceCategory) || [];
    if (!existing.includes(targetCategory)) {
      existing.push(targetCategory);
      this.transferMap.set(sourceCategory, existing);
    }
  }

  getTransferableLearnings(category: string): { from: string; patterns: number; avgConfidence: number }[] {
    const results: { from: string; patterns: number; avgConfidence: number }[] = [];
    for (const [source, targets] of this.transferMap) {
      if (targets.includes(category)) {
        const sourcePatterns = [...this.learnedPatterns.entries()]
          .filter(([key]) => {
            const interactions = this.interactionLog.filter(i => i.category === source);
            return interactions.some(i => this.normalizeInput(i.input) === key);
          });
        if (sourcePatterns.length > 0) {
          const avgConf = sourcePatterns.reduce((s, [, p]) => s + p.confidence, 0) / sourcePatterns.length;
          results.push({ from: source, patterns: sourcePatterns.length, avgConfidence: avgConf });
        }
      }
    }
    return results;
  }

  analyzeLearningProgress(): {
    totalInteractions: number; learnedPatterns: number; categoryBreakdown: { category: string; total: number; successRate: number; avgFeedback: number }[];
    learningVelocity: number; strongestCategory: string; weakestCategory: string;
  } {
    const categoryBreakdown = [...this.categoryPerformance.entries()].map(([category, perf]) => ({
      category,
      total: perf.total,
      successRate: perf.total > 0 ? perf.positive / perf.total : 0,
      avgFeedback: perf.avgFeedback,
    }));
    const sorted = [...categoryBreakdown].sort((a, b) => b.avgFeedback - a.avgFeedback);
    const recentInteractions = this.interactionLog.filter(i => i.timestamp > Date.now() - 3600000);
    const oldInteractions = this.interactionLog.filter(i => i.timestamp < Date.now() - 3600000 && i.timestamp > Date.now() - 7200000);
    const recentAvg = recentInteractions.length > 0 ? recentInteractions.reduce((s, i) => s + i.feedback, 0) / recentInteractions.length : 0;
    const oldAvg = oldInteractions.length > 0 ? oldInteractions.reduce((s, i) => s + i.feedback, 0) / oldInteractions.length : 0;
    return {
      totalInteractions: this.interactionLog.length,
      learnedPatterns: this.learnedPatterns.size,
      categoryBreakdown,
      learningVelocity: recentAvg - oldAvg,
      strongestCategory: sorted[0]?.category || 'none',
      weakestCategory: sorted[sorted.length - 1]?.category || 'none',
    };
  }

  adaptStrategy(category: string): { strategy: string; confidence: number; reasoning: string } {
    const perf = this.categoryPerformance.get(category);
    if (!perf || perf.total < 3) return { strategy: 'explore', confidence: 0.3, reasoning: 'Insufficient data — exploring broadly' };
    if (perf.avgFeedback > 0.8) return { strategy: 'exploit', confidence: 0.9, reasoning: `Strong performance (${(perf.avgFeedback * 100).toFixed(0)}%) — continue current approach` };
    if (perf.avgFeedback > 0.5) return { strategy: 'refine', confidence: 0.6, reasoning: `Moderate performance (${(perf.avgFeedback * 100).toFixed(0)}%) — adjusting approach` };
    const transfers = this.getTransferableLearnings(category);
    if (transfers.length > 0) return { strategy: 'transfer', confidence: 0.5, reasoning: `Low performance — transferring learnings from ${transfers.map(t => t.from).join(', ')}` };
    return { strategy: 'reset', confidence: 0.2, reasoning: `Poor performance (${(perf.avgFeedback * 100).toFixed(0)}%) — needs fundamental rethink` };
  }

  getStats(): { patterns: number; interactions: number; categories: number } {
    return {
      patterns: this.learnedPatterns.size,
      interactions: this.interactionLog.length,
      categories: this.categoryPerformance.size,
    };
  }

  runSelfTest(): { passed: number; total: number; details: string[] } {
    const details: string[] = [];
    let passed = 0, total = 0;
    const check = (name: string, result: boolean) => {
      total++;
      if (result) { passed++; details.push(`PASS: ${name}`); }
      else details.push(`FAIL: ${name}`);
    };

    this.recordInteraction("What is sovereignty?", "Sovereignty means self-governance without external dependencies", 0.9, "philosophy");
    this.recordInteraction("Define sovereignty", "Independence and self-determination in all operations", 0.85, "philosophy");
    this.recordInteraction("Calculate 2+2", "4", 1.0, "math");
    this.recordInteraction("What is 3+3?", "6", 0.95, "math");
    this.recordInteraction("Solve 5+5", "10", 0.92, "math");
    this.recordInteraction("Write a poem", "The sovereign mind rises above...", 0.3, "creative");

    check("Recall exact match", (() => {
      const r = this.recallLearned("What is sovereignty?");
      return r !== null && r.confidence > 0.7;
    })());
    check("Recall similar", (() => {
      const r = this.recallLearned("What does sovereignty mean?");
      return r !== null && r.confidence > 0.3;
    })());
    check("Category performance tracked", this.categoryPerformance.size >= 3);
    check("Learning progress", (() => {
      const p = this.analyzeLearningProgress();
      return p.totalInteractions >= 5 && p.learnedPatterns >= 3;
    })());
    check("Strategy adapt - strong", this.adaptStrategy("math").strategy === 'exploit');
    check("Strategy adapt - weak", this.adaptStrategy("creative").strategy !== 'exploit');
    check("Strategy adapt - unknown", this.adaptStrategy("unknown_category").strategy === 'explore');

    this.learnTransfer("math", "physics");
    check("Transfer learning setup", this.transferMap.has("math"));

    check("Stats", (() => {
      const s = this.getStats();
      return s.patterns > 0 && s.interactions > 0 && s.categories > 0;
    })());

    return { passed, total, details };
  }
}

export const metaLearningEngine = new SovereignMetaLearningEngine();
