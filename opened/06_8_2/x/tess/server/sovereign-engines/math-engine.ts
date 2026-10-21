export class SovereignMathEngine {
  evaluateExpression(expr: string): number | null {
    try {
      const sanitized = expr.replace(/[^0-9+\-*/().^%\s,sincotaglqrtbepxw]/gi, '');
      const tokens = this.tokenize(sanitized);
      return this.parseExpression(tokens, 0).value;
    } catch {
      return null;
    }
  }

  private tokenize(expr: string): string[] {
    const tokens: string[] = [];
    let i = 0;
    while (i < expr.length) {
      if (/\s/.test(expr[i])) { i++; continue; }
      if (/[0-9.]/.test(expr[i])) {
        let num = '';
        while (i < expr.length && /[0-9.eE]/.test(expr[i])) num += expr[i++];
        tokens.push(num);
      } else if (/[a-z]/i.test(expr[i])) {
        let fn = '';
        while (i < expr.length && /[a-z]/i.test(expr[i])) fn += expr[i++];
        tokens.push(fn.toLowerCase());
      } else {
        tokens.push(expr[i++]);
      }
    }
    return tokens;
  }

  private parseExpression(tokens: string[], pos: number): { value: number; pos: number } {
    let { value, pos: p } = this.parseTerm(tokens, pos);
    while (p < tokens.length && (tokens[p] === '+' || tokens[p] === '-')) {
      const op = tokens[p++];
      const right = this.parseTerm(tokens, p);
      p = right.pos;
      value = op === '+' ? value + right.value : value - right.value;
    }
    return { value, pos: p };
  }

  private parseTerm(tokens: string[], pos: number): { value: number; pos: number } {
    let { value, pos: p } = this.parsePower(tokens, pos);
    while (p < tokens.length && (tokens[p] === '*' || tokens[p] === '/' || tokens[p] === '%')) {
      const op = tokens[p++];
      const right = this.parsePower(tokens, p);
      p = right.pos;
      if (op === '*') value *= right.value;
      else if (op === '/') value = right.value !== 0 ? value / right.value : NaN;
      else value %= right.value;
    }
    return { value, pos: p };
  }

  private parsePower(tokens: string[], pos: number): { value: number; pos: number } {
    let { value, pos: p } = this.parseUnary(tokens, pos);
    if (p < tokens.length && tokens[p] === '^') {
      p++;
      const right = this.parsePower(tokens, p);
      p = right.pos;
      value = Math.pow(value, right.value);
    }
    return { value, pos: p };
  }

  private parseUnary(tokens: string[], pos: number): { value: number; pos: number } {
    if (pos < tokens.length && tokens[pos] === '-') {
      const { value, pos: p } = this.parseAtom(tokens, pos + 1);
      return { value: -value, pos: p };
    }
    return this.parseAtom(tokens, pos);
  }

  private parseAtom(tokens: string[], pos: number): { value: number; pos: number } {
    if (pos >= tokens.length) return { value: 0, pos };
    const token = tokens[pos];

    const funcs: Record<string, (x: number) => number> = {
      sin: Math.sin, cos: Math.cos, tan: Math.tan,
      asin: Math.asin, acos: Math.acos, atan: Math.atan,
      sqrt: Math.sqrt, abs: Math.abs, log: Math.log,
      log10: Math.log10, exp: Math.exp, ceil: Math.ceil,
      floor: Math.floor, round: Math.round,
    };

    const constants: Record<string, number> = {
      pi: Math.PI, e: Math.E, tau: Math.PI * 2,
    };

    if (constants[token] !== undefined) {
      return { value: constants[token], pos: pos + 1 };
    }

    if (funcs[token]) {
      if (pos + 1 < tokens.length && tokens[pos + 1] === '(') {
        const inner = this.parseExpression(tokens, pos + 2);
        return { value: funcs[token](inner.value), pos: inner.pos + 1 };
      }
    }

    if (token === '(') {
      const inner = this.parseExpression(tokens, pos + 1);
      return { value: inner.value, pos: inner.pos + 1 };
    }

    const num = parseFloat(token);
    if (!isNaN(num)) return { value: num, pos: pos + 1 };

    return { value: 0, pos: pos + 1 };
  }

  solveLinearEquation(a: number, b: number): number | null {
    if (a === 0) return null;
    return -b / a;
  }

  solveQuadratic(a: number, b: number, c: number): number[] {
    if (a === 0) {
      const x = this.solveLinearEquation(b, c);
      return x !== null ? [x] : [];
    }
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) return [];
    if (discriminant === 0) return [-b / (2 * a)];
    const sqrtD = Math.sqrt(discriminant);
    return [(-b + sqrtD) / (2 * a), (-b - sqrtD) / (2 * a)];
  }

  derivative(coefficients: number[]): number[] {
    if (coefficients.length <= 1) return [0];
    return coefficients.slice(1).map((c, i) => c * (i + 1));
  }

  integral(coefficients: number[], constant = 0): number[] {
    const result = [constant];
    for (let i = 0; i < coefficients.length; i++) {
      result.push(coefficients[i] / (i + 1));
    }
    return result;
  }

  numericalIntegrate(fn: (x: number) => number, a: number, b: number, n = 1000): number {
    const h = (b - a) / n;
    let sum = (fn(a) + fn(b)) / 2;
    for (let i = 1; i < n; i++) sum += fn(a + i * h);
    return sum * h;
  }

  numericalDerivative(fn: (x: number) => number, x: number, h = 1e-7): number {
    return (fn(x + h) - fn(x - h)) / (2 * h);
  }

  mean(data: number[]): number {
    return data.reduce((s, v) => s + v, 0) / data.length;
  }

  standardDeviation(data: number[]): number {
    const m = this.mean(data);
    const variance = data.reduce((s, v) => s + (v - m) ** 2, 0) / data.length;
    return Math.sqrt(variance);
  }

  median(data: number[]): number {
    const sorted = [...data].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  pearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;
    const mx = this.mean(x), my = this.mean(y);
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < x.length; i++) {
      const xi = x[i] - mx, yi = y[i] - my;
      num += xi * yi;
      dx += xi * xi;
      dy += yi * yi;
    }
    const denom = Math.sqrt(dx * dy);
    return denom === 0 ? 0 : num / denom;
  }

  linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
    const n = x.length;
    const mx = this.mean(x), my = this.mean(y);
    let ssxy = 0, ssxx = 0, ssyy = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - mx, dy = y[i] - my;
      ssxy += dx * dy;
      ssxx += dx * dx;
      ssyy += dy * dy;
    }
    const slope = ssxx === 0 ? 0 : ssxy / ssxx;
    const intercept = my - slope * mx;
    const r2 = ssyy === 0 ? 0 : (ssxy * ssxy) / (ssxx * ssyy);
    return { slope, intercept, r2 };
  }

  matrix = {
    multiply(a: number[][], b: number[][]): number[][] {
      const rows = a.length, cols = b[0].length, inner = b.length;
      const result: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++)
          for (let k = 0; k < inner; k++)
            result[i][j] += a[i][k] * b[k][j];
      return result;
    },
    determinant(m: number[][]): number {
      const n = m.length;
      if (n === 1) return m[0][0];
      if (n === 2) return m[0][0] * m[1][1] - m[0][1] * m[1][0];
      let det = 0;
      for (let j = 0; j < n; j++) {
        const sub = m.slice(1).map(row => [...row.slice(0, j), ...row.slice(j + 1)]);
        det += (j % 2 === 0 ? 1 : -1) * m[0][j] * this.determinant(sub);
      }
      return det;
    },
    transpose(m: number[][]): number[][] {
      return m[0].map((_, i) => m.map(row => row[i]));
    },
  };

  isPrime(n: number): boolean {
    if (n < 2) return false;
    if (n < 4) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (let i = 5; i * i <= n; i += 6)
      if (n % i === 0 || n % (i + 2) === 0) return false;
    return true;
  }

  factorial(n: number): number {
    if (n < 0) return NaN;
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  gcd(a: number, b: number): number {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { [a, b] = [b, a % b]; }
    return a;
  }

  fibonacci(n: number): number[] {
    const fib = [0, 1];
    for (let i = 2; i < n; i++) fib.push(fib[i-1] + fib[i-2]);
    return fib.slice(0, n);
  }

  runSelfTest(): { passed: number; total: number; details: string[] } {
    const details: string[] = [];
    let passed = 0, total = 0;

    const check = (name: string, result: boolean) => {
      total++;
      if (result) { passed++; details.push(`PASS: ${name}`); }
      else details.push(`FAIL: ${name}`);
    };

    check("Expression: 2+3*4", this.evaluateExpression("2+3*4") === 14);
    check("Expression: (2+3)*4", this.evaluateExpression("(2+3)*4") === 20);
    check("Expression: sqrt(144)", this.evaluateExpression("sqrt(144)") === 12);
    check("Expression: 2^10", this.evaluateExpression("2^10") === 1024);
    check("Expression: sin(0)", this.evaluateExpression("sin(0)") === 0);
    check("Quadratic x²-5x+6=0", JSON.stringify(this.solveQuadratic(1,-5,6).sort()) === "[2,3]");
    check("Derivative [3,2,1]→[2,2]", JSON.stringify(this.derivative([3,2,1])) === "[2,2]");
    check("Mean [1,2,3,4,5]=3", this.mean([1,2,3,4,5]) === 3);
    check("Median [1,2,3,4,5]=3", this.median([1,2,3,4,5]) === 3);
    check("isPrime(17)", this.isPrime(17) === true);
    check("isPrime(15)", this.isPrime(15) === false);
    check("factorial(5)=120", this.factorial(5) === 120);
    check("gcd(12,8)=4", this.gcd(12, 8) === 4);
    check("LinearRegression", (() => {
      const r = this.linearRegression([1,2,3,4,5], [2,4,6,8,10]);
      return Math.abs(r.slope - 2) < 0.01 && Math.abs(r.intercept) < 0.01 && r.r2 > 0.99;
    })());
    check("Correlation", Math.abs(this.pearsonCorrelation([1,2,3],[1,2,3]) - 1) < 0.01);
    check("Matrix det [[1,2],[3,4]]=-2", this.matrix.determinant([[1,2],[3,4]]) === -2);
    check("Numerical integral x² [0,1] ≈ 0.333", Math.abs(this.numericalIntegrate(x => x*x, 0, 1) - 1/3) < 0.01);
    check("Fibonacci(7)", JSON.stringify(this.fibonacci(7)) === "[0,1,1,2,3,5,8]");

    return { passed, total, details };
  }
}

export const mathEngine = new SovereignMathEngine();
