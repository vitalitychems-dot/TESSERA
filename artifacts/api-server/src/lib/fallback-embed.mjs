// Fixed local fallback embedding (PR #263). Kept free of server imports so the
// re-embed script and the API server share one implementation.
export const FALLBACK_EMBEDDING_DIM = 256;
export const FALLBACK_PERIOD = 32;

const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","of","to","in","on","at","by","for","with","as","is","are","was","were","be","been","being","have","has","had","do","does","did","this","that","these","those","it","its","from","so","not","no","yes","i","you","he","she","we","they","them","us","our","your","their","my","me"
]);

function hashStr(s, seed = 2166136261) {
  let h = seed >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t.length >= 2 && !STOPWORDS.has(t));
}

function ngrams(tokens, n) {
  if (tokens.length < n) return [];
  const out = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    out.push(tokens.slice(i, i + n).join(" "));
  }
  return out;
}

export function localFallbackEmbedding(text) {
  const tokens = tokenize(text);
  if (tokens.length === 0) return new Array(FALLBACK_EMBEDDING_DIM).fill(0);

  const bag = new Map();
  const add = (t, w) => bag.set(t, (bag.get(t) ?? 0) + w);
  for (const t of tokens) add(t, 1);
  for (const g of ngrams(tokens, 2)) add(g, 0.6);
  for (const g of ngrams(tokens, 3)) add(g, 0.35);

  const simhash = new Array(FALLBACK_EMBEDDING_DIM).fill(0);
  let totalWeight = 0;
  for (const [term, weight] of bag) {
    totalWeight += weight;
    // One independent 32-bit hash per 32-dim block so every dimension gets its own sign bit.
    // The old (h1, h2) scheme depended only on i % 32, making the 256-d vector 8 copies of a 32-d sketch.
    for (let block = 0; block < FALLBACK_EMBEDDING_DIM / 32; block++) {
      const h = hashStr(term, (2166136261 + 7919 * block) >>> 0);
      for (let b = 0; b < 32; b++) {
        const i = block * 32 + b;
        simhash[i] += (h >>> b) & 1 ? weight : -weight;
      }
    }
  }

  const vec = new Array(FALLBACK_EMBEDDING_DIM).fill(0);
  const avgAbs = totalWeight > 0 ? totalWeight / FALLBACK_EMBEDDING_DIM : 1;
  for (let i = 0; i < FALLBACK_EMBEDDING_DIM; i++) {
    vec[i] = Math.tanh(simhash[i] / (avgAbs * 4 + 1));
  }

  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (mag > 0) for (let i = 0; i < vec.length; i++) vec[i] /= mag;
  return vec;
}

// True when a stored 256-d vector is 8 copies of one non-constant 32-d block.
// All-zero vectors are the fixed function's output for empty input, so they are not stale.
export function isOldFallbackVector(vec, period = FALLBACK_PERIOD) {
  if (!Array.isArray(vec) || vec.length !== FALLBACK_EMBEDDING_DIM || period <= 0 || vec.length % period !== 0) {
    return false;
  }
  let maxDelta = 0;
  let min0 = Infinity;
  let max0 = -Infinity;
  for (let i = 0; i < vec.length; i++) {
    const v = vec[i];
    if (typeof v !== "number" || !Number.isFinite(v)) return false;
    if (i < period) {
      if (v < min0) min0 = v;
      if (v > max0) max0 = v;
    }
    if (i + period < vec.length) {
      const d = Math.abs(v - vec[i + period]);
      if (d > maxDelta) maxDelta = d;
    }
  }
  return maxDelta <= 1e-6 && max0 - min0 > 1e-6;
}
