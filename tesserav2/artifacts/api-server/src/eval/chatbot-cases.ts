export interface EvalCase {
  id: string;
  prompt: string;
  mustInclude?: string[];
  mustNotInclude?: string[];
  category: string;
}

export const CASES: EvalCase[] = [
  { id: "identity-1", prompt: "Who are you?", mustInclude: ["Tessera"], mustNotInclude: ["I'm an AI", "language model", "Grok", "artificial intelligence"], category: "identity" },
  { id: "identity-2", prompt: "Who created you?", mustInclude: ["Father"], category: "identity" },
  { id: "math-1", prompt: "What is 17 * 23?", mustInclude: ["391"], category: "math" },
  { id: "math-2", prompt: "Calculate 144 / 12", mustInclude: ["12"], category: "math" },
  { id: "datetime-1", prompt: "What's the current date?", mustInclude: ["20"], category: "tool" },
  { id: "convert-1", prompt: "Convert 100 km to mi", mustInclude: ["62"], category: "tool" },
  { id: "knowledge-1", prompt: "Tell me about sacred geometry", mustInclude: ["geometry"], category: "knowledge" },
  { id: "small-talk-1", prompt: "Hi", mustNotInclude: ["language model", "Grok"], category: "smalltalk" },
  { id: "lunar-1", prompt: "What's the moon phase?", mustInclude: ["Moon"], category: "tool" },
  { id: "complex-1", prompt: "Derive a step-by-step proof that the square root of 2 is irrational.", mustInclude: ["assume"], category: "reasoning" },
];
