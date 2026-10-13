import { createHash, createHmac } from "node:crypto";

export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

export function round6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashOf(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function macOf(value: unknown, key: string | undefined): string {
  const body = canonicalJson(value);
  return key ? createHmac("sha256", key).update(body).digest("hex") : sha256Hex(body);
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Deterministic order: sort by fnv hash of `seed + key`, tie-break on key. */
export function seededOrder<T>(items: readonly T[], seed: string, keyOf: (t: T) => string): T[] {
  return [...items].sort((a, b) => {
    const ha = fnv1a(`${seed}|${keyOf(a)}`);
    const hb = fnv1a(`${seed}|${keyOf(b)}`);
    return ha - hb || keyOf(a).localeCompare(keyOf(b));
  });
}
