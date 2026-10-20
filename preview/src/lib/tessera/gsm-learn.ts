/** Learns a calculation shape from GSM8K train annotations and applies it to a new question. The answer key of the question being solved is not read. */

const WORDS: Record<string, string> = { one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20", thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90", hundred: "100", thousand: "1000" };

export type GsmExample = { question: string; answer: string };

type Skeleton = { steps: string[]; answer: string; tokens: Set<string>; count: number };

function normalize(text: string) {
  return text.toLowerCase().replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\b/g, (word) => WORDS[word] ?? word);
}

function tokensOf(question: string) {
  return new Set(normalize(question).replace(/\$?\d[\d,.]*/g, " n ").replace(/[^a-z\s]/g, " ").split(/\s+/).filter((word) => word.length > 2 && word !== "n"));
}

function numbersOf(question: string) {
  return [...normalize(question).matchAll(/\$?(\d[\d,]*(?:\.\d+)?)/g)].map((match) => Number(match[1].replaceAll(",", ""))).filter((n) => Number.isFinite(n));
}

function evaluate(expression: string, env: Map<string, number>): number | null {
  const source = expression.replace(/\s+/g, "");
  if (!/^[-+*/().\dA-Za-z]+$/.test(source)) return null;
  let index = 0;
  const peek = () => source[index];
  const eat = (char: string) => {
    if (peek() !== char) throw new Error("bad");
    index += 1;
  };
  const parseExpression = (): number => {
    let value = parseTerm();
    while (peek() === "+" || peek() === "-") {
      const op = peek();
      index += 1;
      const right = parseTerm();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };
  const parseTerm = (): number => {
    let value = parseFactor();
    while (peek() === "*" || peek() === "/" || peek() === "x") {
      const op = peek();
      index += 1;
      const right = parseFactor();
      value = op === "/" ? value / right : value * right;
    }
    return value;
  };
  const parseFactor = (): number => {
    if (peek() === "-") {
      index += 1;
      return -parseFactor();
    }
    if (peek() === "(") {
      eat("(");
      const value = parseExpression();
      eat(")");
      return value;
    }
    const start = index;
    if (/[A-Za-z]/.test(peek() ?? "")) {
      index += 1;
      while (/[A-Za-z0-9]/.test(peek() ?? "")) index += 1;
      const name = source.slice(start, index);
      if (!env.has(name)) throw new Error(name);
      return env.get(name) as number;
    }
    while (/[0-9.]/.test(peek() ?? "")) index += 1;
    if (index === start) throw new Error("num");
    return Number(source.slice(start, index));
  };
  try {
    const value = parseExpression();
    if (index !== source.length || !Number.isFinite(value)) return null;
    return value;
  } catch {
    return null;
  }
}

function skeletonOf(example: GsmExample): Skeleton | null {
  const numbers = numbersOf(example.question);
  const env = new Map<string, number>();
  numbers.forEach((value, index) => env.set(`n${index}`, value));
  const steps: string[] = [];
  const marks = [...example.answer.matchAll(/<<([^=]+)=(-?[\d.]+)>>/g)];
  if (!marks.length) return null;
  let produced = 0;
  for (const mark of marks) {
    let expression = mark[1].replaceAll(" ", "").replaceAll("\u00d7", "*").replaceAll("x", "*");
    const value = Number(mark[2]);
    const used = [...expression.matchAll(/-?\d+(?:\.\d+)?/g)].map((item) => item[0]);
    const names = [...env.entries()].sort((left, right) => String(right[1]).length - String(left[1]).length);
    for (const raw of used) {
      const name = names.find(([, known]) => Math.abs(known - Number(raw)) < 1e-6)?.[0];
      if (!name) continue;
      expression = expression.replace(new RegExp(`(?<!\\d)${raw.replace(".", "\\.")}(?!\\d)`), name);
    }
    const computed = evaluate(expression, env);
    if (computed === null || Math.abs(computed - value) > 1e-6) return null;
    const name = `v${produced}`;
    steps.push(`${name}=${expression}`);
    env.set(name, value);
    produced += 1;
  }
  return { steps, answer: `v${produced - 1}`, tokens: tokensOf(example.question), count: numbers.length };
}

function overlap(left: Set<string>, right: Set<string>) {
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(1, left.size + right.size - shared);
}

export function learnGsm(train: GsmExample[]) {
  const known = train.map(skeletonOf).filter((item): item is Skeleton => item !== null);
  return {
    known: known.length,
    solve(question: string, minimum = 0.45) {
      const tokens = tokensOf(question);
      const numbers = numbersOf(question);
      let best: Skeleton | null = null;
      let score = 0;
      for (const item of known) {
        if (item.count !== numbers.length) continue;
        const next = overlap(tokens, item.tokens);
        if (next > score) {
          score = next;
          best = item;
        }
      }
      if (!best || score < minimum) return null;
      const env = new Map<string, number>();
      numbers.forEach((value, index) => env.set(`n${index}`, value));
      for (const step of best.steps) {
        const [name, expression] = step.split("=");
        const value = evaluate(expression, env);
        if (value === null) return null;
        env.set(name, value);
      }
      const answer = env.get(best.answer);
      if (answer === undefined || !Number.isFinite(answer)) return null;
      return Math.round(answer * 1000) / 1000;
    },
  };
}

export function gsmGold(answer: string) {
  const match = answer.match(/####\s*(-?[\d,]+(?:\.\d+)?)/);
  return match ? Number(match[1].replaceAll(",", "")) : null;
}
