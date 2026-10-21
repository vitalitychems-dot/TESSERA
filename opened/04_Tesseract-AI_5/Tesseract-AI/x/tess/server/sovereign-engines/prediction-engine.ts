export class SovereignPredictionEngine {
  linearRegression(x: number[], y: number[]): { predict: (xNew: number) => number; slope: number; intercept: number; r2: number } {
    const n = x.length;
    const mx = x.reduce((s, v) => s + v, 0) / n;
    const my = y.reduce((s, v) => s + v, 0) / n;
    let ssxy = 0, ssxx = 0, ssyy = 0;
    for (let i = 0; i < n; i++) {
      ssxy += (x[i] - mx) * (y[i] - my);
      ssxx += (x[i] - mx) ** 2;
      ssyy += (y[i] - my) ** 2;
    }
    const slope = ssxx > 0 ? ssxy / ssxx : 0;
    const intercept = my - slope * mx;
    const r2 = ssyy > 0 ? (ssxy ** 2) / (ssxx * ssyy) : 0;
    return { predict: (xNew: number) => slope * xNew + intercept, slope, intercept, r2 };
  }

  polynomialRegression(x: number[], y: number[], degree: number): { predict: (xNew: number) => number; coefficients: number[] } {
    const n = x.length;
    const size = degree + 1;
    const matrix: number[][] = Array.from({ length: size }, () => new Array(size + 1).fill(0));
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        for (let k = 0; k < n; k++) matrix[i][j] += Math.pow(x[k], i + j);
      }
      for (let k = 0; k < n; k++) matrix[i][size] += y[k] * Math.pow(x[k], i);
    }
    for (let i = 0; i < size; i++) {
      let maxRow = i;
      for (let k = i + 1; k < size; k++) if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) maxRow = k;
      [matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]];
      if (Math.abs(matrix[i][i]) < 1e-10) continue;
      for (let k = i + 1; k < size; k++) {
        const factor = matrix[k][i] / matrix[i][i];
        for (let j = i; j <= size; j++) matrix[k][j] -= factor * matrix[i][j];
      }
    }
    const coefficients = new Array(size).fill(0);
    for (let i = size - 1; i >= 0; i--) {
      coefficients[i] = matrix[i][size];
      for (let j = i + 1; j < size; j++) coefficients[i] -= matrix[i][j] * coefficients[j];
      if (Math.abs(matrix[i][i]) > 1e-10) coefficients[i] /= matrix[i][i];
    }
    return {
      coefficients,
      predict: (xNew: number) => coefficients.reduce((s, c, i) => s + c * Math.pow(xNew, i), 0),
    };
  }

  simpleMovingAverage(data: number[], window: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - window + 1);
      const vals = data.slice(start, i + 1);
      result.push(vals.reduce((s, v) => s + v, 0) / vals.length);
    }
    return result;
  }

  weightedMovingAverage(data: number[], window: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - window + 1);
      const vals = data.slice(start, i + 1);
      const totalW = vals.length * (vals.length + 1) / 2;
      const wma = vals.reduce((s, v, j) => s + v * (j + 1), 0) / totalW;
      result.push(wma);
    }
    return result;
  }

  exponentialSmoothing(data: number[], alpha = 0.3): { forecast: number[]; nextValue: number } {
    if (data.length === 0) return { forecast: [], nextValue: 0 };
    const forecast = [data[0]];
    for (let i = 1; i < data.length; i++) {
      forecast.push(alpha * data[i] + (1 - alpha) * forecast[i - 1]);
    }
    return { forecast, nextValue: alpha * data[data.length - 1] + (1 - alpha) * forecast[forecast.length - 1] };
  }

  doubleExponentialSmoothing(data: number[], alpha = 0.3, beta = 0.2): { forecast: number[]; predict: (steps: number) => number[] } {
    if (data.length < 2) return { forecast: [...data], predict: () => [] };
    let level = data[0];
    let trend = data[1] - data[0];
    const forecast: number[] = [level];
    for (let i = 1; i < data.length; i++) {
      const prevLevel = level;
      level = alpha * data[i] + (1 - alpha) * (prevLevel + trend);
      trend = beta * (level - prevLevel) + (1 - beta) * trend;
      forecast.push(level + trend);
    }
    return {
      forecast,
      predict: (steps: number) => {
        const result: number[] = [];
        for (let i = 1; i <= steps; i++) result.push(level + i * trend);
        return result;
      }
    };
  }

  arimaSimple(data: number[], p = 1, d = 1): { predict: (steps: number) => number[] } {
    let diffed = [...data];
    for (let i = 0; i < d; i++) {
      const newDiffed: number[] = [];
      for (let j = 1; j < diffed.length; j++) newDiffed.push(diffed[j] - diffed[j - 1]);
      diffed = newDiffed;
    }
    const coeffs: number[] = [];
    for (let lag = 1; lag <= p; lag++) {
      let num = 0, den = 0;
      for (let i = lag; i < diffed.length; i++) {
        num += diffed[i] * diffed[i - lag];
        den += diffed[i - lag] ** 2;
      }
      coeffs.push(den > 0 ? num / den : 0);
    }
    return {
      predict: (steps: number) => {
        const extended = [...diffed];
        for (let s = 0; s < steps; s++) {
          let next = 0;
          for (let j = 0; j < coeffs.length; j++) {
            const idx = extended.length - 1 - j;
            if (idx >= 0) next += coeffs[j] * extended[idx];
          }
          extended.push(next);
        }
        const predictions: number[] = [];
        let lastVal = data[data.length - 1];
        for (let s = 0; s < steps; s++) {
          lastVal += extended[diffed.length + s];
          predictions.push(lastVal);
        }
        return predictions;
      }
    };
  }

  naiveBayes(trainingData: { features: Record<string, number>; label: string }[]): {
    classify: (features: Record<string, number>) => { label: string; probability: number };
  } {
    const classCounts = new Map<string, number>();
    const featureStats = new Map<string, Map<string, { sum: number; sumSq: number; count: number }>>();
    for (const { features, label } of trainingData) {
      classCounts.set(label, (classCounts.get(label) || 0) + 1);
      if (!featureStats.has(label)) featureStats.set(label, new Map());
      const classStats = featureStats.get(label)!;
      for (const [feat, val] of Object.entries(features)) {
        if (!classStats.has(feat)) classStats.set(feat, { sum: 0, sumSq: 0, count: 0 });
        const s = classStats.get(feat)!;
        s.sum += val; s.sumSq += val * val; s.count++;
      }
    }
    const total = trainingData.length;
    return {
      classify: (features: Record<string, number>) => {
        let bestLabel = '';
        let bestLogProb = -Infinity;
        for (const [label, count] of classCounts) {
          let logProb = Math.log(count / total);
          const classFeats = featureStats.get(label)!;
          for (const [feat, val] of Object.entries(features)) {
            const stats = classFeats.get(feat);
            if (stats && stats.count > 1) {
              const mean = stats.sum / stats.count;
              const variance = Math.max((stats.sumSq / stats.count) - mean * mean, 1e-6);
              logProb -= 0.5 * Math.log(2 * Math.PI * variance) + ((val - mean) ** 2) / (2 * variance);
            }
          }
          if (logProb > bestLogProb) { bestLogProb = logProb; bestLabel = label; }
        }
        return { label: bestLabel, probability: Math.exp(bestLogProb) };
      }
    };
  }

  decisionStump(data: { features: number[]; label: number }[]): { featureIdx: number; threshold: number; predict: (features: number[]) => number } {
    let bestFeature = 0, bestThreshold = 0, bestError = Infinity;
    const featureCount = data[0]?.features.length || 0;
    for (let f = 0; f < featureCount; f++) {
      const vals = [...new Set(data.map(d => d.features[f]))].sort((a, b) => a - b);
      for (let i = 0; i < vals.length - 1; i++) {
        const threshold = (vals[i] + vals[i + 1]) / 2;
        let error = 0;
        for (const d of data) {
          const pred = d.features[f] <= threshold ? -1 : 1;
          if (pred !== d.label) error++;
        }
        if (error < bestError) { bestError = error; bestFeature = f; bestThreshold = threshold; }
      }
    }
    const bf = bestFeature, bt = bestThreshold;
    return { featureIdx: bf, threshold: bt, predict: (features: number[]) => features[bf] <= bt ? -1 : 1 };
  }

  runSelfTest(): { passed: number; total: number; details: string[] } {
    const details: string[] = [];
    let passed = 0, total = 0;
    const check = (name: string, result: boolean) => {
      total++;
      if (result) { passed++; details.push(`PASS: ${name}`); }
      else details.push(`FAIL: ${name}`);
    };

    check("Linear regression fit", (() => {
      const r = this.linearRegression([1,2,3,4,5], [2,4,6,8,10]);
      return Math.abs(r.predict(6) - 12) < 0.01;
    })());
    check("Linear regression r2", this.linearRegression([1,2,3,4,5], [2,4,6,8,10]).r2 > 0.99);
    check("Polynomial regression", (() => {
      const x = [0,1,2,3,4]; const y = x.map(v => v*v);
      const r = this.polynomialRegression(x, y, 2);
      return Math.abs(r.predict(5) - 25) < 1;
    })());
    check("SMA", this.simpleMovingAverage([1,2,3,4,5], 3).length === 5);
    check("WMA", this.weightedMovingAverage([1,2,3,4,5], 3).length === 5);
    check("Exp smoothing", this.exponentialSmoothing([1,2,3,4,5]).forecast.length === 5);
    check("Double exp", this.doubleExponentialSmoothing([1,2,3,4,5]).predict(3).length === 3);
    check("ARIMA predict", this.arimaSimple([1,2,3,4,5,6,7,8]).predict(3).length === 3);
    check("Naive Bayes", (() => {
      const nb = this.naiveBayes([
        { features: { x: 1, y: 1 }, label: 'A' },
        { features: { x: 2, y: 2 }, label: 'A' },
        { features: { x: 10, y: 10 }, label: 'B' },
        { features: { x: 11, y: 11 }, label: 'B' },
      ]);
      return nb.classify({ x: 1.5, y: 1.5 }).label === 'A';
    })());
    check("Decision stump", (() => {
      const ds = this.decisionStump([
        { features: [1], label: -1 }, { features: [2], label: -1 },
        { features: [10], label: 1 }, { features: [11], label: 1 },
      ]);
      return ds.predict([1.5]) === -1 && ds.predict([10.5]) === 1;
    })());

    return { passed, total, details };
  }
}

export const predictionEngine = new SovereignPredictionEngine();
