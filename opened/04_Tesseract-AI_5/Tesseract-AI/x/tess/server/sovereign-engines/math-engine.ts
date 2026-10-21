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
      sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
      asinh: Math.asinh, acosh: Math.acosh, atanh: Math.atanh,
      sign: Math.sign, trunc: Math.trunc, cbrt: Math.cbrt,
      log2: Math.log2,
    };

    const constants: Record<string, number> = {
      pi: Math.PI, e: Math.E, tau: Math.PI * 2,
      phi: (1 + Math.sqrt(5)) / 2,
      sqrt2: Math.SQRT2,
      ln2: Math.LN2,
      ln10: Math.LN10,
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

  solveCubic(a: number, b: number, c: number, d: number): number[] {
    if (a === 0) return this.solveQuadratic(b, c, d);
    const p = (3 * a * c - b * b) / (3 * a * a);
    const q = (2 * b * b * b - 9 * a * b * c + 27 * a * a * d) / (27 * a * a * a);
    const disc = q * q / 4 + p * p * p / 27;
    const offset = -b / (3 * a);

    if (Math.abs(disc) < 1e-12) {
      if (Math.abs(q) < 1e-12) return [offset];
      const u = Math.cbrt(-q / 2);
      return [2 * u + offset, -u + offset];
    }
    if (disc > 0) {
      const sqrtDisc = Math.sqrt(disc);
      const u = Math.cbrt(-q / 2 + sqrtDisc);
      const v = Math.cbrt(-q / 2 - sqrtDisc);
      return [u + v + offset];
    }
    const r = Math.sqrt(-p * p * p / 27);
    const theta = Math.acos(-q / (2 * r));
    const m = 2 * Math.cbrt(r);
    return [
      m * Math.cos(theta / 3) + offset,
      m * Math.cos((theta + 2 * Math.PI) / 3) + offset,
      m * Math.cos((theta + 4 * Math.PI) / 3) + offset,
    ];
  }

  solveSystemLinear2x2(a1: number, b1: number, c1: number, a2: number, b2: number, c2: number): { x: number; y: number } | null {
    const det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < 1e-12) return null;
    return { x: (c1 * b2 - c2 * b1) / det, y: (a1 * c2 - a2 * c1) / det };
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

  nthDerivative(coefficients: number[], n: number): number[] {
    let result = [...coefficients];
    for (let i = 0; i < n; i++) result = this.derivative(result);
    return result;
  }

  definiteIntegral(coefficients: number[], a: number, b: number): number {
    const antiderivative = this.integral(coefficients);
    const evalPoly = (c: number[], x: number) => c.reduce((sum, coeff, i) => sum + coeff * Math.pow(x, i), 0);
    return evalPoly(antiderivative, b) - evalPoly(antiderivative, a);
  }

  taylorSeries(fn: (x: number) => number, center: number, terms: number): number[] {
    const coeffs: number[] = [];
    const h = 1e-5;
    for (let n = 0; n < terms; n++) {
      let deriv: (x: number) => number = fn;
      for (let d = 0; d < n; d++) {
        const prevDeriv = deriv;
        deriv = (x: number) => (prevDeriv(x + h) - prevDeriv(x - h)) / (2 * h);
      }
      coeffs.push(deriv(center) / this.factorial(n));
    }
    return coeffs;
  }

  numericalIntegrate(fn: (x: number) => number, a: number, b: number, n = 1000): number {
    const h = (b - a) / n;
    let sum = (fn(a) + fn(b)) / 2;
    for (let i = 1; i < n; i++) sum += fn(a + i * h);
    return sum * h;
  }

  simpsonIntegrate(fn: (x: number) => number, a: number, b: number, n = 1000): number {
    if (n % 2 !== 0) n++;
    const h = (b - a) / n;
    let sum = fn(a) + fn(b);
    for (let i = 1; i < n; i++) sum += (i % 2 === 0 ? 2 : 4) * fn(a + i * h);
    return (h / 3) * sum;
  }

  numericalDerivative(fn: (x: number) => number, x: number, h = 1e-7): number {
    return (fn(x + h) - fn(x - h)) / (2 * h);
  }

  secondDerivative(fn: (x: number) => number, x: number, h = 1e-5): number {
    return (fn(x + h) - 2 * fn(x) + fn(x - h)) / (h * h);
  }

  newtonRaphson(fn: (x: number) => number, x0: number, maxIter = 100, tol = 1e-10): number | null {
    let x = x0;
    for (let i = 0; i < maxIter; i++) {
      const fx = fn(x);
      if (Math.abs(fx) < tol) return x;
      const dfx = this.numericalDerivative(fn, x);
      if (Math.abs(dfx) < 1e-15) return null;
      x = x - fx / dfx;
    }
    return Math.abs(fn(x)) < 1e-6 ? x : null;
  }

  bisection(fn: (x: number) => number, a: number, b: number, tol = 1e-10, maxIter = 100): number | null {
    if (fn(a) * fn(b) > 0) return null;
    for (let i = 0; i < maxIter; i++) {
      const mid = (a + b) / 2;
      if (Math.abs(fn(mid)) < tol || (b - a) / 2 < tol) return mid;
      if (fn(a) * fn(mid) < 0) b = mid;
      else a = mid;
    }
    return (a + b) / 2;
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

  mode(data: number[]): number[] {
    const freq = new Map<number, number>();
    for (const v of data) freq.set(v, (freq.get(v) || 0) + 1);
    const maxFreq = Math.max(...freq.values());
    return [...freq.entries()].filter(([, f]) => f === maxFreq).map(([v]) => v);
  }

  variance(data: number[]): number {
    const m = this.mean(data);
    return data.reduce((s, v) => s + (v - m) ** 2, 0) / data.length;
  }

  skewness(data: number[]): number {
    const n = data.length;
    const m = this.mean(data);
    const sd = this.standardDeviation(data);
    if (sd === 0) return 0;
    return (data.reduce((s, v) => s + Math.pow((v - m) / sd, 3), 0)) * n / ((n - 1) * (n - 2) || 1);
  }

  kurtosis(data: number[]): number {
    const n = data.length;
    const m = this.mean(data);
    const sd = this.standardDeviation(data);
    if (sd === 0) return 0;
    return (data.reduce((s, v) => s + Math.pow((v - m) / sd, 4), 0)) / n - 3;
  }

  percentile(data: number[], p: number): number {
    const sorted = [...data].sort((a, b) => a - b);
    const idx = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
  }

  interquartileRange(data: number[]): number {
    return this.percentile(data, 75) - this.percentile(data, 25);
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

  spearmanCorrelation(x: number[], y: number[]): number {
    const rank = (arr: number[]) => {
      const sorted = [...arr].map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
      const ranks = new Array(arr.length);
      for (let i = 0; i < sorted.length; i++) ranks[sorted[i].i] = i + 1;
      return ranks;
    };
    return this.pearsonCorrelation(rank(x), rank(y));
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

  polynomialRegression(x: number[], y: number[], degree: number): number[] {
    const n = x.length;
    const size = degree + 1;
    const A: number[][] = Array.from({ length: size }, () => new Array(size).fill(0));
    const B: number[] = new Array(size).fill(0);
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        for (let k = 0; k < n; k++) A[i][j] += Math.pow(x[k], i + j);
      }
      for (let k = 0; k < n; k++) B[i] += y[k] * Math.pow(x[k], i);
    }
    return this.solveLinearSystem(A, B) || new Array(size).fill(0);
  }

  private solveLinearSystem(A: number[][], b: number[]): number[] | null {
    const n = A.length;
    const aug = A.map((row, i) => [...row, b[i]]);
    for (let col = 0; col < n; col++) {
      let maxRow = col;
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
      }
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
      if (Math.abs(aug[col][col]) < 1e-12) return null;
      for (let row = col + 1; row < n; row++) {
        const factor = aug[row][col] / aug[col][col];
        for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j];
      }
    }
    const result = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      result[i] = aug[i][n];
      for (let j = i + 1; j < n; j++) result[i] -= aug[i][j] * result[j];
      result[i] /= aug[i][i];
    }
    return result;
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
    inverse(m: number[][]): number[][] | null {
      const n = m.length;
      const aug = m.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]);
      for (let col = 0; col < n; col++) {
        let maxRow = col;
        for (let row = col + 1; row < n; row++) {
          if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) maxRow = row;
        }
        [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
        if (Math.abs(aug[col][col]) < 1e-12) return null;
        const pivot = aug[col][col];
        for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
        for (let row = 0; row < n; row++) {
          if (row !== col) {
            const factor = aug[row][col];
            for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
          }
        }
      }
      return aug.map(row => row.slice(n));
    },
    identity(n: number): number[][] {
      return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
    },
    trace(m: number[][]): number {
      return m.reduce((sum, row, i) => sum + (row[i] || 0), 0);
    },
    add(a: number[][], b: number[][]): number[][] {
      return a.map((row, i) => row.map((v, j) => v + b[i][j]));
    },
    scale(m: number[][], s: number): number[][] {
      return m.map(row => row.map(v => v * s));
    },
    norm(m: number[][]): number {
      return Math.sqrt(m.reduce((sum, row) => sum + row.reduce((s, v) => s + v * v, 0), 0));
    },
    eigenvalues2x2(m: number[][]): number[] {
      if (m.length !== 2) return [];
      const trace = m[0][0] + m[1][1];
      const det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
      const disc = trace * trace - 4 * det;
      if (disc < 0) return [];
      return [(trace + Math.sqrt(disc)) / 2, (trace - Math.sqrt(disc)) / 2];
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

  primeFactors(n: number): number[] {
    const factors: number[] = [];
    let d = 2;
    while (n > 1) {
      while (n % d === 0) { factors.push(d); n /= d; }
      d++;
      if (d * d > n && n > 1) { factors.push(n); break; }
    }
    return factors;
  }

  sieveOfEratosthenes(limit: number): number[] {
    const sieve = new Array(limit + 1).fill(true);
    sieve[0] = sieve[1] = false;
    for (let i = 2; i * i <= limit; i++) {
      if (sieve[i]) for (let j = i * i; j <= limit; j += i) sieve[j] = false;
    }
    return sieve.reduce((primes: number[], v, i) => { if (v) primes.push(i); return primes; }, []);
  }

  factorial(n: number): number {
    if (n < 0) return NaN;
    if (n <= 1) return 1;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  permutations(n: number, r: number): number {
    if (r > n || r < 0) return 0;
    let result = 1;
    for (let i = n; i > n - r; i--) result *= i;
    return result;
  }

  combinations(n: number, r: number): number {
    if (r > n || r < 0) return 0;
    if (r === 0 || r === n) return 1;
    r = Math.min(r, n - r);
    let result = 1;
    for (let i = 0; i < r; i++) result = result * (n - i) / (i + 1);
    return Math.round(result);
  }

  gcd(a: number, b: number): number {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { [a, b] = [b, a % b]; }
    return a;
  }

  lcm(a: number, b: number): number {
    return Math.abs(a * b) / this.gcd(a, b);
  }

  modPow(base: number, exp: number, mod: number): number {
    let result = 1;
    base %= mod;
    while (exp > 0) {
      if (exp % 2 === 1) result = (result * base) % mod;
      exp = Math.floor(exp / 2);
      base = (base * base) % mod;
    }
    return result;
  }

  fibonacci(n: number): number[] {
    const fib = [0, 1];
    for (let i = 2; i < n; i++) fib.push(fib[i-1] + fib[i-2]);
    return fib.slice(0, n);
  }

  catalan(n: number): number {
    return this.combinations(2 * n, n) / (n + 1);
  }

  complexAdd(a: [number, number], b: [number, number]): [number, number] {
    return [a[0] + b[0], a[1] + b[1]];
  }

  complexMultiply(a: [number, number], b: [number, number]): [number, number] {
    return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  }

  complexMagnitude(z: [number, number]): number {
    return Math.sqrt(z[0] * z[0] + z[1] * z[1]);
  }

  complexPhase(z: [number, number]): number {
    return Math.atan2(z[1], z[0]);
  }

  complexDivide(a: [number, number], b: [number, number]): [number, number] {
    const denom = b[0] * b[0] + b[1] * b[1];
    if (denom === 0) return [NaN, NaN];
    return [(a[0] * b[0] + a[1] * b[1]) / denom, (a[1] * b[0] - a[0] * b[1]) / denom];
  }

  degreesToRadians(deg: number): number { return deg * Math.PI / 180; }
  radiansToDegrees(rad: number): number { return rad * 180 / Math.PI; }

  secant(x: number): number { return 1 / Math.cos(x); }
  cosecant(x: number): number { return 1 / Math.sin(x); }
  cotangent(x: number): number { return 1 / Math.tan(x); }

  lawOfCosines(a: number, b: number, C: number): number {
    return Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(C));
  }

  lawOfSines(a: number, A: number): number {
    return a / Math.sin(A);
  }

  triangleArea(a: number, b: number, c: number): number {
    const s = (a + b + c) / 2;
    return Math.sqrt(s * (s - a) * (s - b) * (s - c));
  }

  circleArea(r: number): number { return Math.PI * r * r; }
  sphereVolume(r: number): number { return (4 / 3) * Math.PI * r * r * r; }
  cylinderVolume(r: number, h: number): number { return Math.PI * r * r * h; }

  dotProduct(a: number[], b: number[]): number {
    return a.reduce((sum, v, i) => sum + v * (b[i] || 0), 0);
  }

  crossProduct(a: [number, number, number], b: [number, number, number]): [number, number, number] {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  vectorMagnitude(v: number[]): number {
    return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  }

  normalizeVector(v: number[]): number[] {
    const mag = this.vectorMagnitude(v);
    return mag === 0 ? v : v.map(x => x / mag);
  }

  interpolate(x0: number, y0: number, x1: number, y1: number, x: number): number {
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }

  lagrangeInterpolation(points: [number, number][], x: number): number {
    let result = 0;
    for (let i = 0; i < points.length; i++) {
      let term = points[i][1];
      for (let j = 0; j < points.length; j++) {
        if (i !== j) term *= (x - points[j][0]) / (points[i][0] - points[j][0]);
      }
      result += term;
    }
    return result;
  }

  normalDistribution(x: number, mean: number, stddev: number): number {
    const z = (x - mean) / stddev;
    return (1 / (stddev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
  }

  zScore(value: number, mean: number, stddev: number): number {
    return (value - mean) / stddev;
  }

  chiSquared(observed: number[], expected: number[]): number {
    return observed.reduce((sum, o, i) => sum + Math.pow(o - expected[i], 2) / expected[i], 0);
  }

  exponentialMovingAverage(data: number[], alpha: number): number[] {
    const result = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
    }
    return result;
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
    check("Expression: cbrt(27)", Math.abs((this.evaluateExpression("cbrt(27)") || 0) - 3) < 0.001);
    check("Quadratic x²-5x+6=0", JSON.stringify(this.solveQuadratic(1,-5,6).sort()) === "[2,3]");
    check("Cubic x³-6x²+11x-6=0", (() => {
      const roots = this.solveCubic(1, -6, 11, -6).map(r => Math.round(r * 1000) / 1000).sort((a, b) => a - b);
      return roots.length === 3 && Math.abs(roots[0] - 1) < 0.01 && Math.abs(roots[1] - 2) < 0.01 && Math.abs(roots[2] - 3) < 0.01;
    })());
    check("System 2x2", (() => {
      const r = this.solveSystemLinear2x2(2, 1, 5, 1, 3, 7);
      return r !== null && Math.abs(r.x - (8/5)) < 0.01 && Math.abs(r.y - (9/5)) < 0.01;
    })());
    check("Derivative [3,2,1]→[2,2]", JSON.stringify(this.derivative([3,2,1])) === "[2,2]");
    check("Definite integral x² [0,1] = 1/3", Math.abs(this.definiteIntegral([0, 0, 1], 0, 1) - 1/3) < 0.001);
    check("Newton-Raphson sqrt(2)", (() => {
      const r = this.newtonRaphson(x => x * x - 2, 1);
      return r !== null && Math.abs(r - Math.SQRT2) < 1e-6;
    })());
    check("Simpson integral sin [0,π]≈2", Math.abs(this.simpsonIntegrate(Math.sin, 0, Math.PI) - 2) < 0.001);
    check("Mean [1,2,3,4,5]=3", this.mean([1,2,3,4,5]) === 3);
    check("Median [1,2,3,4,5]=3", this.median([1,2,3,4,5]) === 3);
    check("Mode [1,1,2,3]=1", this.mode([1, 1, 2, 3])[0] === 1);
    check("Variance [1,2,3,4,5]=2", this.variance([1,2,3,4,5]) === 2);
    check("Percentile 50th", Math.abs(this.percentile([1,2,3,4,5], 50) - 3) < 0.001);
    check("IQR", this.interquartileRange([1,2,3,4,5,6,7,8]) > 0);
    check("isPrime(17)", this.isPrime(17) === true);
    check("isPrime(15)", this.isPrime(15) === false);
    check("Prime factors 60", JSON.stringify(this.primeFactors(60)) === "[2,2,3,5]");
    check("Sieve primes<20", JSON.stringify(this.sieveOfEratosthenes(20)) === "[2,3,5,7,11,13,17,19]");
    check("factorial(5)=120", this.factorial(5) === 120);
    check("Permutations P(5,3)=60", this.permutations(5, 3) === 60);
    check("Combinations C(10,3)=120", this.combinations(10, 3) === 120);
    check("gcd(12,8)=4", this.gcd(12, 8) === 4);
    check("lcm(4,6)=12", this.lcm(4, 6) === 12);
    check("modPow 2^10 mod 1000=24", this.modPow(2, 10, 1000) === 24);
    check("Fibonacci(7)", JSON.stringify(this.fibonacci(7)) === "[0,1,1,2,3,5,8]");
    check("Catalan(5)=42", this.catalan(5) === 42);
    check("Complex multiply", (() => {
      const r = this.complexMultiply([1, 2], [3, 4]);
      return r[0] === -5 && r[1] === 10;
    })());
    check("Complex magnitude", Math.abs(this.complexMagnitude([3, 4]) - 5) < 0.001);
    check("Degrees to radians", Math.abs(this.degreesToRadians(180) - Math.PI) < 0.001);
    check("Law of cosines", Math.abs(this.lawOfCosines(3, 4, Math.PI / 2) - 5) < 0.001);
    check("Triangle area (Heron's)", Math.abs(this.triangleArea(3, 4, 5) - 6) < 0.001);
    check("Sphere volume r=1", Math.abs(this.sphereVolume(1) - 4.18879) < 0.01);
    check("Dot product", this.dotProduct([1,2,3], [4,5,6]) === 32);
    check("Cross product", JSON.stringify(this.crossProduct([1,0,0], [0,1,0])) === "[0,0,1]");
    check("Vector magnitude", Math.abs(this.vectorMagnitude([3,4]) - 5) < 0.001);
    check("LinearRegression", (() => {
      const r = this.linearRegression([1,2,3,4,5], [2,4,6,8,10]);
      return Math.abs(r.slope - 2) < 0.01 && Math.abs(r.intercept) < 0.01 && r.r2 > 0.99;
    })());
    check("Polynomial regression", (() => {
      const x = [0, 1, 2, 3, 4];
      const y = x.map(v => v * v);
      const coeffs = this.polynomialRegression(x, y, 2);
      return Math.abs(coeffs[2] - 1) < 0.1;
    })());
    check("Spearman correlation", Math.abs(this.spearmanCorrelation([1,2,3,4,5], [2,4,6,8,10]) - 1) < 0.01);
    check("Pearson correlation", Math.abs(this.pearsonCorrelation([1,2,3],[1,2,3]) - 1) < 0.01);
    check("Matrix det [[1,2],[3,4]]=-2", this.matrix.determinant([[1,2],[3,4]]) === -2);
    check("Matrix inverse 2x2", (() => {
      const inv = this.matrix.inverse([[1, 2], [3, 4]]);
      if (!inv) return false;
      return Math.abs(inv[0][0] - (-2)) < 0.01 && Math.abs(inv[0][1] - 1) < 0.01;
    })());
    check("Matrix eigenvalues", (() => {
      const eig = this.matrix.eigenvalues2x2([[2, 1], [1, 2]]);
      return eig.length === 2 && Math.abs(eig[0] - 3) < 0.01 && Math.abs(eig[1] - 1) < 0.01;
    })());
    check("Numerical integral x² [0,1] ≈ 0.333", Math.abs(this.numericalIntegrate(x => x*x, 0, 1) - 1/3) < 0.01);
    check("Normal distribution", this.normalDistribution(0, 0, 1) > 0.39);
    check("Z-score", Math.abs(this.zScore(75, 70, 5) - 1) < 0.001);
    check("Chi-squared", this.chiSquared([10, 20, 30], [15, 15, 30]) > 0);
    check("EMA", this.exponentialMovingAverage([1,2,3,4,5], 0.5).length === 5);
    check("Lagrange interpolation", Math.abs(this.lagrangeInterpolation([[0,0],[1,1],[2,4]], 1.5) - 2.25) < 0.01);

    return { passed, total, details };
  }
}

export const mathEngine = new SovereignMathEngine();
