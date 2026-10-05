import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { distillLessons, retrieveLessons } from "./distill";
import { proposeImprovements } from "./improve";
import { redactSecrets } from "./redact";
import type { ImpProposal, InteractionRecord, Lesson, RecordInteractionInput, RetrievedLesson } from "./types";

export interface MemoryStoreOptions {
  dir?: string;
  now?: () => Date;
  createId?: () => string;
}

function isMissingFile(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

async function readJsonl<T>(file: string): Promise<T[]> {
  try {
    const raw = await readFile(file, "utf8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if (isMissingFile(error)) return [];
    throw error;
  }
}

/**
 * Append-only JSONL store under `.local/tessera-memory` by default.
 * Creating the store does not write anything. The directory is created
 * on the first append. Records are never deleted by this module.
 */
export function createMemoryStore(options: MemoryStoreOptions = {}) {
  const dir = options.dir ?? path.resolve(process.cwd(), ".local", "tessera-memory");
  const interactionsPath = path.join(dir, "interactions.jsonl");
  const proposalsPath = path.join(dir, "proposals.jsonl");
  const now = options.now ?? (() => new Date());
  const createId = options.createId ?? (() => randomUUID());

  async function appendLine(file: string, value: unknown): Promise<void> {
    await mkdir(dir, { recursive: true });
    await appendFile(file, `${JSON.stringify(value)}\n`, "utf8");
  }

  return {
    dir,
    interactionsPath,
    proposalsPath,

    async record(input: RecordInteractionInput): Promise<InteractionRecord> {
      const record: InteractionRecord = {
        id: createId(),
        timestamp: now().toISOString(),
        sourceAgent: redactSecrets(input.sourceAgent),
        input: redactSecrets(input.input),
        output: redactSecrets(input.output),
        tags: (input.tags ?? []).map((tag) => redactSecrets(tag)),
      };
      await appendLine(interactionsPath, record);
      return record;
    },

    async list(): Promise<InteractionRecord[]> {
      return readJsonl<InteractionRecord>(interactionsPath);
    },

    async lessons(): Promise<Lesson[]> {
      return distillLessons(await this.list());
    },

    async recall(query: string, limit = 3): Promise<RetrievedLesson[]> {
      return retrieveLessons(await this.lessons(), query, limit);
    },

    /**
     * Text a caller can place beside a new answer.
     * This is retrieved lesson text. It is not a weight update.
     */
    async contextForQuery(query: string): Promise<string> {
      const hits = await this.recall(query);
      if (hits.length === 0) return "";
      const lines = hits.map(
        (hit) => `- (${hit.confidence.toFixed(2)}) ${hit.fact} [evidence: ${hit.evidenceIds.join(", ")}]`,
      );
      return ["Retrieved lessons (retrieval memory, not trained weights):", ...lines].join("\n");
    },

    async propose(): Promise<ImpProposal[]> {
      const proposals = proposeImprovements(await this.list());
      const existing = await readJsonl<ImpProposal>(proposalsPath);
      const known = new Set(existing.map((proposal) => proposal.ID));
      const fresh = proposals.filter((proposal) => !known.has(proposal.ID));
      if (fresh.length > 0) {
        await mkdir(dir, { recursive: true });
        await appendFile(proposalsPath, fresh.map((proposal) => JSON.stringify(proposal)).join("\n") + "\n", "utf8");
      }
      return proposals;
    },
  };
}

export type MemoryStore = ReturnType<typeof createMemoryStore>;
