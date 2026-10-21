import { mathEngine, SovereignMathEngine } from './math-engine';
import { nlpEngine, SovereignNLPEngine } from './nlp-engine';
import { patternEngine, SovereignPatternEngine } from './pattern-engine';
import { predictionEngine, SovereignPredictionEngine } from './prediction-engine';
import { temporalEngine, SovereignTemporalEngine } from './temporal-engine';
import { knowledgeEngine, SovereignKnowledgeEngine } from './knowledge-engine';
import { codeEngine, SovereignCodeEngine } from './code-engine';
import { creativeEngine, SovereignCreativeEngine } from './creative-engine';
import { metaLearningEngine, SovereignMetaLearningEngine } from './meta-learning-engine';
import { reasoningEngine, SovereignReasoningEngine } from './reasoning-engine';
import { multimodalEngine, SovereignMultimodalEngine } from './multimodal-engine';

export { mathEngine, SovereignMathEngine };
export { nlpEngine, SovereignNLPEngine };
export { patternEngine, SovereignPatternEngine };
export { predictionEngine, SovereignPredictionEngine };
export { temporalEngine, SovereignTemporalEngine };
export { knowledgeEngine, SovereignKnowledgeEngine };
export { codeEngine, SovereignCodeEngine };
export { creativeEngine, SovereignCreativeEngine };
export { metaLearningEngine, SovereignMetaLearningEngine };
export { reasoningEngine, SovereignReasoningEngine };
export { multimodalEngine, SovereignMultimodalEngine };

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
    { name: 'ReasoningEngine', test: () => reasoningEngine.runSelfTest() },
    { name: 'MultimodalEngine', test: () => multimodalEngine.runSelfTest() },
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
