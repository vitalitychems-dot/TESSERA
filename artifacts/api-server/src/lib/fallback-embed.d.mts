export const FALLBACK_EMBEDDING_DIM: 256;
export const FALLBACK_PERIOD: 32;
export function localFallbackEmbedding(text: string): number[];
export function isOldFallbackVector(vec: unknown, period?: number): boolean;
