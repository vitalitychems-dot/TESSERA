import { logger } from "./logger";

interface CacheEntry<T> {
  key: string;
  value: T;
  ts: number;
  prev: CacheEntry<T> | null;
  next: CacheEntry<T> | null;
}

class LRUDimension<T> {
  private map = new Map<string, CacheEntry<T>>();
  private head: CacheEntry<T> | null = null;
  private tail: CacheEntry<T> | null = null;
  private _hits = 0;
  private _misses = 0;

  constructor(public readonly capacity: number) {}

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this._misses++;
      return undefined;
    }
    this._hits++;
    this.moveToHead(entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      existing.ts = Date.now();
      this.moveToHead(existing);
      return;
    }

    const entry: CacheEntry<T> = { key, value, ts: Date.now(), prev: null, next: null };
    this.map.set(key, entry);
    this.addToHead(entry);

    if (this.map.size > this.capacity) {
      const evicted = this.removeTail();
      if (evicted) this.map.delete(evicted.key);
    }
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  delete(key: string): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    this.removeNode(entry);
    this.map.delete(key);
    return true;
  }

  get size(): number {
    return this.map.size;
  }

  get hits(): number {
    return this._hits;
  }

  get misses(): number {
    return this._misses;
  }

  get hitRate(): number {
    const total = this._hits + this._misses;
    return total > 0 ? this._hits / total : 0;
  }

  values(): T[] {
    const result: T[] = [];
    let node = this.head;
    while (node) {
      result.push(node.value);
      node = node.next;
    }
    return result;
  }

  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  private addToHead(entry: CacheEntry<T>): void {
    entry.prev = null;
    entry.next = this.head;
    if (this.head) this.head.prev = entry;
    this.head = entry;
    if (!this.tail) this.tail = entry;
  }

  private removeNode(entry: CacheEntry<T>): void {
    if (entry.prev) entry.prev.next = entry.next;
    else this.head = entry.next;
    if (entry.next) entry.next.prev = entry.prev;
    else this.tail = entry.prev;
    entry.prev = null;
    entry.next = null;
  }

  private moveToHead(entry: CacheEntry<T>): void {
    if (entry === this.head) return;
    this.removeNode(entry);
    this.addToHead(entry);
  }

  private removeTail(): CacheEntry<T> | null {
    if (!this.tail) return null;
    const old = this.tail;
    this.removeNode(old);
    return old;
  }
}

const DOMAIN_SIMILARITY: Record<string, Record<string, number>> = {
  security: { governance: 0.85, sovereignty: 0.80, infrastructure: 0.75 },
  governance: { security: 0.85, sovereignty: 0.90, consciousness: 0.70 },
  infrastructure: { security: 0.75, feature: 0.80, income: 0.65 },
  feature: { infrastructure: 0.80, income: 0.75, community: 0.70 },
  income: { feature: 0.75, infrastructure: 0.65, sovereignty: 0.60 },
  community: { governance: 0.70, feature: 0.70, consciousness: 0.80 },
  consciousness: { governance: 0.70, community: 0.80, sovereignty: 0.85 },
  sovereignty: { security: 0.80, governance: 0.90, consciousness: 0.85 },
  general: { feature: 0.60, governance: 0.55, infrastructure: 0.55 },
};

export class DimensionalLRUCache<T> {
  private dimensions = new Map<string, LRUDimension<T>>();
  private defaultDimension: LRUDimension<T>;
  private crossDimensionHits = 0;
  private totalLookups = 0;

  constructor(private dimensionCapacity: number = 200) {
    this.defaultDimension = new LRUDimension<T>(dimensionCapacity);
    this.dimensions.set("general", this.defaultDimension);
  }

  private getDimension(name: string): LRUDimension<T> {
    let dim = this.dimensions.get(name);
    if (!dim) {
      dim = new LRUDimension<T>(this.dimensionCapacity);
      this.dimensions.set(name, dim);
    }
    return dim;
  }

  set(key: string, value: T, dimension: string = "general"): void {
    this.getDimension(dimension).set(key, value);
  }

  get(key: string, dimension: string = "general"): T | undefined {
    return this.getDimension(dimension).get(key);
  }

  lookup(
    key: string,
    primaryDimension: string = "general",
    relatedDimensions?: string[],
  ): { value: T; dimension: string; weight: number } | undefined {
    this.totalLookups++;

    const primary = this.getDimension(primaryDimension);
    const val = primary.get(key);
    if (val !== undefined) {
      return { value: val, dimension: primaryDimension, weight: 1.0 };
    }

    const related = relatedDimensions ?? DOMAIN_SIMILARITY[primaryDimension] ?? [];
    for (const dim of related) {
      const dimCache = this.dimensions.get(dim);
      if (!dimCache) continue;
      const crossVal = dimCache.get(key);
      if (crossVal !== undefined) {
        this.crossDimensionHits++;
        return { value: crossVal, dimension: dim, weight: CROSS_DIMENSION_WEIGHT };
      }
    }

    return undefined;
  }

  has(key: string, dimension: string = "general"): boolean {
    return this.getDimension(dimension).has(key);
  }

  delete(key: string, dimension: string = "general"): boolean {
    return this.getDimension(dimension).delete(key);
  }

  clear(dimension?: string): void {
    if (dimension) {
      this.dimensions.get(dimension)?.clear();
    } else {
      for (const dim of this.dimensions.values()) dim.clear();
    }
  }

  get totalSize(): number {
    let total = 0;
    for (const dim of this.dimensions.values()) total += dim.size;
    return total;
  }

  getStats(): {
    totalSize: number;
    dimensionCount: number;
    crossDimensionHits: number;
    totalLookups: number;
    crossDimensionRecallRate: number;
    perDimension: Record<string, { size: number; hits: number; misses: number; hitRate: number }>;
  } {
    const perDimension: Record<string, { size: number; hits: number; misses: number; hitRate: number }> = {};
    for (const [name, dim] of this.dimensions) {
      perDimension[name] = {
        size: dim.size,
        hits: dim.hits,
        misses: dim.misses,
        hitRate: Math.round(dim.hitRate * 1000) / 1000,
      };
    }

    return {
      totalSize: this.totalSize,
      dimensionCount: this.dimensions.size,
      crossDimensionHits: this.crossDimensionHits,
      totalLookups: this.totalLookups,
      crossDimensionRecallRate: this.totalLookups > 0
        ? Math.round((this.crossDimensionHits / this.totalLookups) * 1000) / 1000
        : 0,
      perDimension,
    };
  }
}

export const embeddingDimensionalCache = new DimensionalLRUCache<{ vec: number[]; ts: number }>(300);
export const semanticDimensionalCache = new DimensionalLRUCache<{ response: string; ts: number }>(200);

export function getDimensionalCacheStats() {
  return {
    embedding: embeddingDimensionalCache.getStats(),
    semantic: semanticDimensionalCache.getStats(),
  };
}
