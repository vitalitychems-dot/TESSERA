import { pool } from "./db";

interface SymbolicProposition {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  source: string;
  timestamp: Date;
}

interface InferenceResult {
  conclusion: string;
  premises: string[];
  rule: string;
  confidence: number;
}

const knowledgeBase: Map<string, SymbolicProposition[]> = new Map();
const inferenceRules: Map<string, (props: SymbolicProposition[]) => InferenceResult[]> = new Map();

function addProposition(prop: SymbolicProposition): void {
  const key = prop.subject;
  if (!knowledgeBase.has(key)) knowledgeBase.set(key, []);
  knowledgeBase.get(key)!.push(prop);
}

function queryPropositions(subject: string): SymbolicProposition[] {
  return knowledgeBase.get(subject) || [];
}

inferenceRules.set("transitivity", (props: SymbolicProposition[]): InferenceResult[] => {
  const results: InferenceResult[] = [];
  for (const p1 of props) {
    if (p1.predicate === "is_a" || p1.predicate === "implies") {
      const related = knowledgeBase.get(p1.object) || [];
      for (const p2 of related) {
        if (p2.predicate === p1.predicate) {
          results.push({
            conclusion: `${p1.subject} ${p1.predicate} ${p2.object}`,
            premises: [`${p1.subject} ${p1.predicate} ${p1.object}`, `${p1.object} ${p2.predicate} ${p2.object}`],
            rule: "transitivity",
            confidence: p1.confidence * p2.confidence,
          });
        }
      }
    }
  }
  return results;
});

inferenceRules.set("modus_ponens", (props: SymbolicProposition[]): InferenceResult[] => {
  const results: InferenceResult[] = [];
  for (const p1 of props) {
    if (p1.predicate === "implies") {
      const antecedents = knowledgeBase.get(p1.subject) || [];
      const hasAntecedent = antecedents.some(a => a.predicate === "is_true");
      if (hasAntecedent) {
        results.push({
          conclusion: `${p1.object} is_true`,
          premises: [`${p1.subject} is_true`, `${p1.subject} implies ${p1.object}`],
          rule: "modus_ponens",
          confidence: p1.confidence,
        });
      }
    }
  }
  return results;
});

inferenceRules.set("contrapositive", (props: SymbolicProposition[]): InferenceResult[] => {
  const results: InferenceResult[] = [];
  for (const p of props) {
    if (p.predicate === "implies") {
      const consequentProps = knowledgeBase.get(p.object) || [];
      const isFalse = consequentProps.some(c => c.predicate === "is_false");
      if (isFalse) {
        results.push({
          conclusion: `${p.subject} is_false`,
          premises: [`${p.object} is_false`, `${p.subject} implies ${p.object}`],
          rule: "contrapositive",
          confidence: p.confidence,
        });
      }
    }
  }
  return results;
});

function runInference(subject: string): InferenceResult[] {
  const props = queryPropositions(subject);
  const allResults: InferenceResult[] = [];
  for (const [, ruleFn] of inferenceRules) {
    allResults.push(...ruleFn(props));
  }
  return allResults;
}

async function loadFromBrain(): Promise<number> {
  try {
    const r = await pool.query(
      "SELECT question, answer FROM tessera_brain WHERE category IN ('reasoning', 'logic', 'knowledge', 'science') LIMIT 500"
    );
    let loaded = 0;
    for (const row of r.rows) {
      addProposition({
        id: `brain-${loaded}`,
        subject: (row.question || "").substring(0, 100),
        predicate: "relates_to",
        object: (row.answer || "").substring(0, 100),
        confidence: 0.8,
        source: "tessera_brain",
        timestamp: new Date(),
      });
      loaded++;
    }
    return loaded;
  } catch {
    return 0;
  }
}

function getStats() {
  let totalProps = 0;
  for (const [, props] of knowledgeBase) totalProps += props.length;
  return {
    propositions: totalProps,
    subjects: knowledgeBase.size,
    inferenceRules: inferenceRules.size,
    rulesAvailable: Array.from(inferenceRules.keys()),
  };
}

export {
  addProposition,
  queryPropositions,
  runInference,
  loadFromBrain,
  getStats,
  SymbolicProposition,
  InferenceResult,
};

loadFromBrain().then(count => {
  console.log(`[SymbolicReasoning] Loaded ${count} propositions from brain, ${inferenceRules.size} inference rules active`);
});
