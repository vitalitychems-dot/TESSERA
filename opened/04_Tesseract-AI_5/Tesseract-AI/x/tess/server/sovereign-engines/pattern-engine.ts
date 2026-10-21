export class SovereignPatternEngine {
  detectAnomalies(data: number[], sensitivity = 2): { index: number; value: number; zscore: number }[] {
    const n = data.length;
    if (n < 3) return [];
    const mean = data.reduce((s, v) => s + v, 0) / n;
    const std = Math.sqrt(data.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    if (std === 0) return [];
    return data
      .map((v, i) => ({ index: i, value: v, zscore: Math.abs((v - mean) / std) }))
      .filter(a => a.zscore > sensitivity);
  }

  findFrequencyPattern(data: number[]): { period: number; strength: number }[] {
    const n = data.length;
    if (n < 6) return [];
    const mean = data.reduce((s, v) => s + v, 0) / n;
    const centered = data.map(v => v - mean);
    const periods: { period: number; strength: number }[] = [];
    for (let p = 2; p <= Math.floor(n / 2); p++) {
      let correlation = 0;
      let count = 0;
      for (let i = 0; i < n - p; i++) {
        correlation += centered[i] * centered[i + p];
        count++;
      }
      const norm = Math.sqrt(centered.reduce((s, v) => s + v * v, 0));
      const strength = norm > 0 ? Math.abs(correlation / count) / (norm / Math.sqrt(n)) : 0;
      if (strength > 0.3) periods.push({ period: p, strength: Math.min(strength, 1) });
    }
    return periods.sort((a, b) => b.strength - a.strength).slice(0, 5);
  }

  detectTrend(data: number[]): { direction: 'up' | 'down' | 'flat'; slope: number; confidence: number } {
    const n = data.length;
    if (n < 2) return { direction: 'flat', slope: 0, confidence: 0 };
    const x = data.map((_, i) => i);
    const mx = x.reduce((s, v) => s + v, 0) / n;
    const my = data.reduce((s, v) => s + v, 0) / n;
    let ssxy = 0, ssxx = 0, ssyy = 0;
    for (let i = 0; i < n; i++) {
      ssxy += (x[i] - mx) * (data[i] - my);
      ssxx += (x[i] - mx) ** 2;
      ssyy += (data[i] - my) ** 2;
    }
    const slope = ssxx > 0 ? ssxy / ssxx : 0;
    const r2 = ssxx > 0 && ssyy > 0 ? (ssxy ** 2) / (ssxx * ssyy) : 0;
    const direction = Math.abs(slope) < 0.01 ? 'flat' : slope > 0 ? 'up' : 'down';
    return { direction, slope, confidence: r2 };
  }

  findSequencePatterns(data: string[], minLen = 2, maxLen = 5): { pattern: string[]; count: number; }[] {
    const patterns = new Map<string, { pattern: string[]; count: number }>();
    for (let len = minLen; len <= maxLen && len <= data.length; len++) {
      for (let i = 0; i <= data.length - len; i++) {
        const sub = data.slice(i, i + len);
        const key = sub.join('|');
        if (!patterns.has(key)) patterns.set(key, { pattern: sub, count: 0 });
        patterns.get(key)!.count++;
      }
    }
    return [...patterns.values()]
      .filter(p => p.count >= 2)
      .sort((a, b) => b.count * b.pattern.length - a.count * a.pattern.length)
      .slice(0, 10);
  }

  clusterKMeans(data: number[][], k: number, maxIter = 100): { centroids: number[][]; assignments: number[] } {
    if (data.length === 0 || k <= 0) return { centroids: [], assignments: [] };
    const dim = data[0].length;
    let centroids = data.slice(0, k).map(d => [...d]);
    let assignments = new Array(data.length).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
      const newAssignments = data.map(point => {
        let minDist = Infinity, best = 0;
        for (let c = 0; c < centroids.length; c++) {
          const dist = point.reduce((s, v, d) => s + (v - centroids[c][d]) ** 2, 0);
          if (dist < minDist) { minDist = dist; best = c; }
        }
        return best;
      });
      const newCentroids = Array.from({ length: k }, () => new Array(dim).fill(0));
      const counts = new Array(k).fill(0);
      for (let i = 0; i < data.length; i++) {
        const c = newAssignments[i];
        counts[c]++;
        for (let d = 0; d < dim; d++) newCentroids[c][d] += data[i][d];
      }
      for (let c = 0; c < k; c++) {
        if (counts[c] > 0) {
          for (let d = 0; d < dim; d++) newCentroids[c][d] /= counts[c];
        }
      }
      const changed = newAssignments.some((a, i) => a !== assignments[i]);
      assignments = newAssignments;
      centroids = newCentroids;
      if (!changed) break;
    }
    return { centroids, assignments };
  }

  movingAverage(data: number[], window: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - window + 1);
      const slice = data.slice(start, i + 1);
      result.push(slice.reduce((s, v) => s + v, 0) / slice.length);
    }
    return result;
  }

  exponentialSmoothing(data: number[], alpha = 0.3): number[] {
    if (data.length === 0) return [];
    const result = [data[0]];
    for (let i = 1; i < data.length; i++) {
      result.push(alpha * data[i] + (1 - alpha) * result[i - 1]);
    }
    return result;
  }

  levenshteinDistance(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
    );
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = Math.min(
          dp[i-1][j] + 1,
          dp[i][j-1] + 1,
          dp[i-1][j-1] + (a[i-1] !== b[j-1] ? 1 : 0)
        );
    return dp[m][n];
  }

  classifyTimeSeries(data: number[]): string {
    if (data.length < 5) return 'insufficient_data';
    const trend = this.detectTrend(data);
    const anomalies = this.detectAnomalies(data);
    const frequencies = this.findFrequencyPattern(data);
    if (anomalies.length > data.length * 0.1) return 'volatile';
    if (trend.confidence > 0.7) return trend.direction === 'up' ? 'trending_up' : trend.direction === 'down' ? 'trending_down' : 'stable';
    if (frequencies.length > 0 && frequencies[0].strength > 0.5) return 'cyclical';
    return 'random';
  }

  runSelfTest(): { passed: number; total: number; details: string[] } {
    const details: string[] = [];
    let passed = 0, total = 0;
    const check = (name: string, result: boolean) => {
      total++;
      if (result) { passed++; details.push(`PASS: ${name}`); }
      else details.push(`FAIL: ${name}`);
    };

    check("Anomaly detection", this.detectAnomalies([1,1,1,1,100,1,1,1]).length > 0);
    check("Anomaly value", this.detectAnomalies([1,1,1,1,100,1,1,1])[0]?.value === 100);
    check("Trend up", this.detectTrend([1,2,3,4,5,6,7,8]).direction === 'up');
    check("Trend down", this.detectTrend([8,7,6,5,4,3,2,1]).direction === 'down');
    check("Trend confidence", this.detectTrend([1,2,3,4,5]).confidence > 0.9);
    check("Moving average", this.movingAverage([1,2,3,4,5], 3).length === 5);
    check("Exponential smooth", this.exponentialSmoothing([1,2,3,4,5]).length === 5);
    check("K-Means", (() => {
      const r = this.clusterKMeans([[0,0],[1,1],[10,10],[11,11]], 2);
      return r.centroids.length === 2 && r.assignments.length === 4;
    })());
    check("Levenshtein", this.levenshteinDistance("kitten", "sitting") === 3);
    check("Sequence patterns", this.findSequencePatterns(["a","b","c","a","b","c","a","b"]).length > 0);
    check("Frequency pattern", this.findFrequencyPattern([1,0,1,0,1,0,1,0,1,0,1,0]).length > 0);
    check("Time series classify", this.classifyTimeSeries([1,2,3,4,5,6,7,8,9,10]) === 'trending_up');

    return { passed, total, details };
  }
}

export const patternEngine = new SovereignPatternEngine();
