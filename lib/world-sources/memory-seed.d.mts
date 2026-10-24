export interface UsageMemoryRecord {
  sourceAgent: string;
  input: string;
  output: string;
  tags: string[];
}
export interface UsageMemoryStore {
  list(): Promise<Array<{ tags?: string[] }>>;
  record(record: UsageMemoryRecord): Promise<unknown>;
}
export const MEMORY_LESSONS: readonly {
  key: string;
  question: string;
  fact: string;
}[];
export function seedWorldSourcesMemory(store: UsageMemoryStore): Promise<{
  inserted: number;
  skipped: number;
  totalLessons: number;
}>;
