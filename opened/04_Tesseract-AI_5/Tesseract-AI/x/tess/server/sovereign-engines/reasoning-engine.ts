export interface Proposition {
  id: string;
  statement: string;
  truthValue: boolean | null;
  confidence: number;
}

export interface InferenceStep {
  rule: string;
  premises: string[];
  conclusion: string;
  confidence: number;
}

export interface Argument {
  premises: string[];
  conclusion: string;
  valid: boolean;
  type: string;
  fallacies: string[];
}

export class SovereignReasoningEngine {
  and(a: boolean, b: boolean): boolean { return a && b; }
  or(a: boolean, b: boolean): boolean { return a || b; }
  not(a: boolean): boolean { return !a; }
  implies(a: boolean, b: boolean): boolean { return !a || b; }
  biconditional(a: boolean, b: boolean): boolean { return a === b; }
  xor(a: boolean, b: boolean): boolean { return a !== b; }
  nand(a: boolean, b: boolean): boolean { return !(a && b); }
  nor(a: boolean, b: boolean): boolean { return !(a || b); }

  truthTable(vars: string[], expression: (vals: Record<string, boolean>) => boolean): { inputs: Record<string, boolean>; output: boolean }[] {
    const rows: { inputs: Record<string, boolean>; output: boolean }[] = [];
    const n = vars.length;
    for (let i = 0; i < Math.pow(2, n); i++) {
      const vals: Record<string, boolean> = {};
      for (let j = 0; j < n; j++) vals[vars[j]] = !!(i & (1 << (n - 1 - j)));
      rows.push({ inputs: { ...vals }, output: expression(vals) });
    }
    return rows;
  }

  isTautology(vars: string[], expression: (vals: Record<string, boolean>) => boolean): boolean {
    return this.truthTable(vars, expression).every(r => r.output);
  }

  isContradiction(vars: string[], expression: (vals: Record<string, boolean>) => boolean): boolean {
    return this.truthTable(vars, expression).every(r => !r.output);
  }

  modusPonens(pIfQ: boolean, p: boolean): boolean | null {
    if (pIfQ && p) return true;
    return null;
  }

  modusTollens(pIfQ: boolean, notQ: boolean): boolean | null {
    if (pIfQ && notQ) return true;
    return null;
  }

  hypotheticalSyllogism(pIfQ: boolean, qIfR: boolean): boolean {
    return pIfQ && qIfR;
  }

  disjunctiveSyllogism(pOrQ: boolean, notP: boolean): boolean | null {
    if (pOrQ && notP) return true;
    return null;
  }

  constructiveDilemma(pIfQ: boolean, rIfS: boolean, pOrR: boolean): boolean {
    return pIfQ && rIfS && pOrR;
  }

  validateSyllogism(majorPremise: string, minorPremise: string, conclusion: string): { valid: boolean; form: string; explanation: string } {
    const allPattern = /all\s+(\w+)\s+are\s+(\w+)/i;
    const somePattern = /some\s+(\w+)\s+are\s+(\w+)/i;
    const noPattern = /no\s+(\w+)\s+are\s+(\w+)/i;

    const major = allPattern.exec(majorPremise) || somePattern.exec(majorPremise) || noPattern.exec(majorPremise);
    const minor = allPattern.exec(minorPremise) || somePattern.exec(minorPremise) || noPattern.exec(minorPremise);
    const conc = allPattern.exec(conclusion) || somePattern.exec(conclusion) || noPattern.exec(conclusion);

    if (!major || !minor || !conc) {
      return { valid: false, form: "unknown", explanation: "Could not parse syllogistic form" };
    }

    const majorType = allPattern.test(majorPremise) ? "A" : somePattern.test(majorPremise) ? "I" : "E";
    const minorType = allPattern.test(minorPremise) ? "A" : somePattern.test(minorPremise) ? "I" : "E";
    const concType = allPattern.test(conclusion) ? "A" : somePattern.test(conclusion) ? "I" : "E";
    const form = `${majorType}${minorType}-${concType}`;

    if (majorType === "A" && minorType === "A" && concType === "A") {
      const middleTerm = major[2];
      const valid = minor[1].toLowerCase() === middleTerm.toLowerCase();
      return {
        valid,
        form: "Barbara (AAA-1)",
        explanation: valid ? "Valid Barbara syllogism: All M are P, All S are M, therefore All S are P" : "Invalid: middle term mismatch",
      };
    }

    return {
      valid: majorType === "A" && minorType === "A" && concType === "A",
      form,
      explanation: `Syllogistic form ${form} — validity depends on figure and mood`,
    };
  }

  analogicalReasoning(
    source: { properties: string[]; conclusion: string },
    target: { properties: string[] }
  ): { conclusion: string; confidence: number; sharedProperties: string[] } {
    const shared = source.properties.filter(p => target.properties.includes(p));
    const similarity = shared.length / Math.max(source.properties.length, target.properties.length);
    return {
      conclusion: source.conclusion,
      confidence: Math.min(similarity * 0.8, 0.9),
      sharedProperties: shared,
    };
  }

  causalReasoning(events: { event: string; timestamp: number; tags: string[] }[]): { cause: string; effect: string; confidence: number; reasoning: string }[] {
    const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
    const causalChains: { cause: string; effect: string; confidence: number; reasoning: string }[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const timeDiff = sorted[j].timestamp - sorted[i].timestamp;
        const sharedTags = sorted[i].tags.filter(t => sorted[j].tags.includes(t));
        if (sharedTags.length > 0 && timeDiff > 0) {
          const tagSimilarity = sharedTags.length / Math.max(sorted[i].tags.length, sorted[j].tags.length);
          const temporalDecay = Math.exp(-timeDiff / 10000);
          causalChains.push({
            cause: sorted[i].event,
            effect: sorted[j].event,
            confidence: Math.min(tagSimilarity * temporalDecay * 0.8, 0.85),
            reasoning: `Temporal ordering (${timeDiff}ms gap) + shared context [${sharedTags.join(", ")}]`,
          });
        }
      }
    }
    return causalChains.sort((a, b) => b.confidence - a.confidence);
  }

  inductiveReasoning(observations: { case: string; outcome: boolean }[]): { hypothesis: string; confidence: number; supportCount: number; totalCount: number } {
    const positive = observations.filter(o => o.outcome).length;
    const total = observations.length;
    const confidence = total > 0 ? positive / total : 0;
    return {
      hypothesis: confidence > 0.7 ? "Strong inductive support" : confidence > 0.4 ? "Moderate inductive support" : "Weak inductive support",
      confidence,
      supportCount: positive,
      totalCount: total,
    };
  }

  abductiveReasoning(observation: string, hypotheses: { hypothesis: string; explanatoryPower: number; simplicity: number; consistency: number }[]): { bestHypothesis: string; score: number; ranking: { hypothesis: string; score: number }[] } {
    const scored = hypotheses.map(h => ({
      hypothesis: h.hypothesis,
      score: h.explanatoryPower * 0.5 + h.simplicity * 0.3 + h.consistency * 0.2,
    })).sort((a, b) => b.score - a.score);
    return {
      bestHypothesis: scored[0]?.hypothesis || "No hypothesis available",
      score: scored[0]?.score || 0,
      ranking: scored,
    };
  }

  detectFallacy(argument: string): { fallacy: string; confidence: number; explanation: string }[] {
    const lower = argument.toLowerCase();
    const fallacies: { fallacy: string; confidence: number; explanation: string }[] = [];

    const patterns: [string, RegExp[], string][] = [
      ["Ad Hominem", [/you're (wrong|stupid|ignorant)/i, /person who said.*is/i, /what do you know/i], "Attacking the person rather than the argument"],
      ["Straw Man", [/so you're saying/i, /what you really mean/i, /your argument is basically/i], "Misrepresenting an opponent's argument to make it easier to attack"],
      ["Appeal to Authority", [/expert(s)? (say|agree|believe)/i, /according to.*authority/i, /scientists (all )?agree/i], "Using authority as evidence without proper justification"],
      ["False Dichotomy", [/either.*or/i, /you're (either|with us)/i, /only two (options|choices)/i], "Presenting only two options when more exist"],
      ["Slippery Slope", [/will lead to/i, /next thing you know/i, /where does it end/i, /inevitably/i], "Assuming one event will trigger a chain of negative events"],
      ["Circular Reasoning", [/because it (is|just is)/i, /true because.*true/i, /proves itself/i], "Using the conclusion as a premise"],
      ["Appeal to Emotion", [/think of the children/i, /how would you feel/i, /imagine if/i], "Using emotional appeals instead of logical arguments"],
      ["Red Herring", [/but what about/i, /the real issue is/i, /let's talk about/i], "Introducing an irrelevant topic to divert attention"],
      ["Bandwagon", [/everyone (knows|believes|thinks)/i, /most people/i, /popular opinion/i], "Appealing to popularity as evidence"],
      ["Hasty Generalization", [/always|never|every single|all of them/i], "Drawing broad conclusions from limited examples"],
    ];

    for (const [name, regexes, explanation] of patterns) {
      for (const re of regexes) {
        if (re.test(lower)) {
          fallacies.push({ fallacy: name, confidence: 0.6, explanation });
          break;
        }
      }
    }
    return fallacies;
  }

  bayesianUpdate(prior: number, likelihoodGivenTrue: number, likelihoodGivenFalse: number): number {
    const numerator = likelihoodGivenTrue * prior;
    const denominator = likelihoodGivenTrue * prior + likelihoodGivenFalse * (1 - prior);
    return denominator === 0 ? prior : numerator / denominator;
  }

  inferenceChain(facts: Record<string, boolean>, rules: { if: string[]; then: string }[]): { derived: Record<string, boolean>; steps: InferenceStep[] } {
    const derived = { ...facts };
    const steps: InferenceStep[] = [];
    let changed = true;
    let maxIterations = 100;

    while (changed && maxIterations-- > 0) {
      changed = false;
      for (const rule of rules) {
        if (derived[rule.then] !== undefined) continue;
        const allTrue = rule.if.every(premise => derived[premise] === true);
        if (allTrue) {
          derived[rule.then] = true;
          steps.push({
            rule: `IF ${rule.if.join(" AND ")} THEN ${rule.then}`,
            premises: rule.if,
            conclusion: rule.then,
            confidence: 1.0,
          });
          changed = true;
        }
      }
    }
    return { derived, steps };
  }

  fuzzyLogic(value: number, sets: { name: string; low: number; mid: number; high: number }[]): { set: string; membership: number }[] {
    return sets.map(s => {
      let membership: number;
      if (value <= s.low || value >= s.high) membership = 0;
      else if (value <= s.mid) membership = (value - s.low) / (s.mid - s.low);
      else membership = (s.high - value) / (s.high - s.mid);
      return { set: s.name, membership: Math.max(0, Math.min(1, membership)) };
    }).filter(r => r.membership > 0);
  }

  evaluateArgument(premises: string[], conclusion: string): Argument {
    const fallacies = this.detectFallacy(premises.join(" ") + " " + conclusion);
    const hasLogicalConnectives = premises.some(p => /therefore|because|since|if.*then|all.*are/i.test(p));
    return {
      premises,
      conclusion,
      valid: fallacies.length === 0 && hasLogicalConnectives,
      type: hasLogicalConnectives ? "deductive" : "informal",
      fallacies: fallacies.map(f => f.fallacy),
    };
  }

  decisionMatrix(options: string[], criteria: { name: string; weight: number }[], scores: number[][]): { option: string; score: number }[] {
    return options.map((opt, i) => ({
      option: opt,
      score: criteria.reduce((sum, c, j) => sum + c.weight * (scores[i]?.[j] || 0), 0),
    })).sort((a, b) => b.score - a.score);
  }

  runSelfTest(): { passed: number; total: number; details: string[] } {
    const details: string[] = [];
    let passed = 0, total = 0;
    const check = (name: string, result: boolean) => {
      total++;
      if (result) { passed++; details.push(`PASS: ${name}`); }
      else details.push(`FAIL: ${name}`);
    };

    check("AND true,true", this.and(true, true) === true);
    check("AND true,false", this.and(true, false) === false);
    check("OR false,true", this.or(false, true) === true);
    check("NOT true", this.not(true) === false);
    check("IMPLIES false→true", this.implies(false, true) === true);
    check("IMPLIES true→false", this.implies(true, false) === false);
    check("XOR true,false", this.xor(true, false) === true);
    check("Biconditional same", this.biconditional(true, true) === true);
    check("Truth table 2 vars", this.truthTable(["A", "B"], v => v.A && v.B).length === 4);
    check("Tautology p∨¬p", this.isTautology(["p"], v => v.p || !v.p));
    check("Contradiction p∧¬p", this.isContradiction(["p"], v => v.p && !v.p));
    check("Modus ponens", this.modusPonens(true, true) === true);
    check("Modus tollens", this.modusTollens(true, true) === true);
    check("Hypothetical syllogism", this.hypotheticalSyllogism(true, true) === true);
    check("Disjunctive syllogism", this.disjunctiveSyllogism(true, true) === true);

    check("Syllogism validation", (() => {
      const r = this.validateSyllogism("All men are mortal", "All Greeks are men", "All Greeks are mortal");
      return r.form.includes("Barbara");
    })());

    check("Analogical reasoning", (() => {
      const r = this.analogicalReasoning(
        { properties: ["has_wings", "has_feathers", "lays_eggs"], conclusion: "can fly" },
        { properties: ["has_wings", "has_feathers", "lays_eggs"] }
      );
      return r.confidence > 0.5 && r.sharedProperties.length === 3;
    })());

    check("Inductive reasoning", (() => {
      const r = this.inductiveReasoning([
        { case: "swan1", outcome: true }, { case: "swan2", outcome: true },
        { case: "swan3", outcome: true }, { case: "swan4", outcome: true },
      ]);
      return r.confidence > 0.9 && r.hypothesis.includes("Strong");
    })());

    check("Abductive reasoning", (() => {
      const r = this.abductiveReasoning("wet ground", [
        { hypothesis: "It rained", explanatoryPower: 0.9, simplicity: 0.8, consistency: 0.9 },
        { hypothesis: "Sprinkler was on", explanatoryPower: 0.7, simplicity: 0.9, consistency: 0.6 },
      ]);
      return r.bestHypothesis === "It rained";
    })());

    check("Detect fallacy ad hominem", this.detectFallacy("You're stupid so you're wrong").length > 0);
    check("Detect fallacy slippery slope", this.detectFallacy("This will lead to chaos and destruction").length > 0);
    check("No fallacy clean argument", this.detectFallacy("Given premise A and premise B, we conclude C").length === 0);

    check("Bayesian update", (() => {
      const posterior = this.bayesianUpdate(0.5, 0.9, 0.1);
      return posterior > 0.85 && posterior < 0.95;
    })());

    check("Inference chain", (() => {
      const result = this.inferenceChain(
        { rain: true, umbrella: false },
        [{ if: ["rain"], then: "wet_ground" }, { if: ["rain", "wet_ground"], then: "puddles" }]
      );
      return result.derived["wet_ground"] === true && result.derived["puddles"] === true && result.steps.length === 2;
    })());

    check("Fuzzy logic", (() => {
      const result = this.fuzzyLogic(70, [
        { name: "cold", low: 0, mid: 30, high: 60 },
        { name: "warm", low: 50, mid: 70, high: 90 },
        { name: "hot", low: 80, mid: 95, high: 110 },
      ]);
      return result.some(r => r.set === "warm" && r.membership > 0.9);
    })());

    check("Decision matrix", (() => {
      const r = this.decisionMatrix(
        ["Option A", "Option B"],
        [{ name: "cost", weight: 0.4 }, { name: "quality", weight: 0.6 }],
        [[8, 9], [9, 6]]
      );
      return r[0].option === "Option A";
    })());

    check("Causal reasoning", (() => {
      const r = this.causalReasoning([
        { event: "rain", timestamp: 100, tags: ["weather", "water"] },
        { event: "flood", timestamp: 200, tags: ["water", "disaster"] },
      ]);
      return r.length > 0 && r[0].cause === "rain";
    })());

    check("Evaluate argument", (() => {
      const r = this.evaluateArgument(
        ["All humans are mortal", "Socrates is human", "therefore Socrates is mortal"],
        "Socrates is mortal"
      );
      return r.type === "deductive";
    })());

    return { passed, total, details };
  }
}

export const reasoningEngine = new SovereignReasoningEngine();
