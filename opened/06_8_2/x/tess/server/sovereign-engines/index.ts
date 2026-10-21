export { mathEngine, SovereignMathEngine } from './math-engine';
export { nlpEngine, SovereignNLPEngine } from './nlp-engine';
export { patternEngine, SovereignPatternEngine } from './pattern-engine';
export { predictionEngine, SovereignPredictionEngine } from './prediction-engine';
export { temporalEngine, SovereignTemporalEngine } from './temporal-engine';
export { knowledgeEngine, SovereignKnowledgeEngine } from './knowledge-engine';
export { codeEngine, SovereignCodeEngine } from './code-engine';
export { creativeEngine, SovereignCreativeEngine } from './creative-engine';
export { metaLearningEngine, SovereignMetaLearningEngine } from './meta-learning-engine';

export interface EngineTestResult {
  engine: string;
  passed: number;
  total: number;
  passRate: number;
  details: string[];
}

export function runAllEngineTests(): { engines: EngineTestResult[]; overallPassRate: number; totalPassed: number; totalTests: number } {
  const engines = [
    { name: 'MathEngine', test: () => mathEngine.runSelfTest() },
    { name: 'NLPEngine', test: () => nlpEngine.runSelfTest() },
    { name: 'PatternEngine', test: () => patternEngine.runSelfTest() },
    { name: 'PredictionEngine', test: () => predictionEngine.runSelfTest() },
    { name: 'TemporalEngine', test: () => temporalEngine.runSelfTest() },
    { name: 'KnowledgeEngine', test: () => knowledgeEngine.runSelfTest() },
    { name: 'CodeEngine', test: () => codeEngine.runSelfTest() },
    { name: 'CreativeEngine', test: () => creativeEngine.runSelfTest() },
    { name: 'MetaLearningEngine', test: () => metaLearningEngine.runSelfTest() },
  ];

  let totalPassed = 0;
  let totalTests = 0;
  const results: EngineTestResult[] = [];

  for (const engine of engines) {
    try {
      const result = engine.test();
      totalPassed += result.passed;
      totalTests += result.total;
      results.push({
        engine: engine.name,
        passed: result.passed,
        total: result.total,
        passRate: result.total > 0 ? parseFloat(((result.passed / result.total) * 100).toFixed(1)) : 0,
        details: result.details,
      });
    } catch (err: any) {
      results.push({ engine: engine.name, passed: 0, total: 1, passRate: 0, details: [`ERROR: ${err.message}`] });
      totalTests++;
    }
  }

  return {
    engines: results,
    overallPassRate: totalTests > 0 ? parseFloat(((totalPassed / totalTests) * 100).toFixed(1)) : 0,
    totalPassed,
    totalTests,
  };
}
