import { callLLM, LLMMessage, LLMCallOptions } from "./llm-client";
import { logger } from "./logger";
import * as crypto from "crypto";

interface QueuedRequest {
  messages: LLMMessage[];
  opts: LLMCallOptions;
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
  hash: string;
  userContent: string;
  queuedAt: number;
}

const BATCH_WINDOW_MS = 2000;
const MAX_BATCH_SIZE = 8;
const SEMANTIC_SIMILARITY_THRESHOLD = 0.85;

const queue: QueuedRequest[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

const batchStats = {
  totalBatched: 0,
  totalDeduplicated: 0,
  totalSemanticMerged: 0,
  totalFlushed: 0,
  batchesProcessed: 0,
};

function hashRequest(messages: LLMMessage[], model: string): string {
  const key = messages.map(m => `${m.role}:${m.content}`).join("|") + `|model:${model}`;
  return crypto.createHash("sha256").update(key).digest("hex");
}

function extractUserContent(messages: LLMMessage[]): string {
  return messages.filter(m => m.role === "user").map(m => m.content).join(" ").toLowerCase().trim();
}

function tokenJaccard(a: string, b: string): number {
  const tokensA = new Set(a.split(/\s+/).filter(t => t.length > 2));
  const tokensB = new Set(b.split(/\s+/).filter(t => t.length > 2));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  return intersection / (tokensA.size + tokensB.size - intersection);
}

function groupBySimilarity(batch: QueuedRequest[]): Map<string, QueuedRequest[]> {
  const groups = new Map<string, QueuedRequest[]>();

  for (const req of batch) {
    const existing = groups.get(req.hash);
    if (existing) {
      existing.push(req);
      batchStats.totalDeduplicated++;
      continue;
    }

    let merged = false;
    for (const [groupKey, groupReqs] of groups) {
      const representative = groupReqs[0];
      if (representative.userContent.length > 0 && req.userContent.length > 0) {
        const similarity = tokenJaccard(representative.userContent, req.userContent);
        if (similarity >= SEMANTIC_SIMILARITY_THRESHOLD) {
          groupReqs.push(req);
          batchStats.totalSemanticMerged++;
          merged = true;
          break;
        }
      }
    }

    if (!merged) {
      groups.set(req.hash, [req]);
    }
  }

  return groups;
}

async function flushBatch(): Promise<void> {
  batchTimer = null;
  if (queue.length === 0) return;

  const batch = queue.splice(0, MAX_BATCH_SIZE);
  batchStats.batchesProcessed++;
  batchStats.totalFlushed += batch.length;

  const groups = groupBySimilarity(batch);

  const promises: Promise<void>[] = [];
  for (const [, reqs] of groups) {
    const primary = reqs[0];
    promises.push(
      callLLM(primary.messages, { ...primary.opts, skipCache: false })
        .then(result => {
          for (const r of reqs) r.resolve(result);
        })
        .catch(err => {
          for (const r of reqs) r.reject(err);
        }),
    );
  }

  await Promise.allSettled(promises);

  if (queue.length > 0) {
    scheduleBatch();
  }
}

function scheduleBatch(): void {
  if (batchTimer) return;
  batchTimer = setTimeout(() => {
    flushBatch().catch(err => {
      logger.warn({ err: (err as Error).message }, "LLMBatcher: flush error");
    });
  }, BATCH_WINDOW_MS);
}

export function batchedCallLLM(messages: LLMMessage[], opts: LLMCallOptions = {}): Promise<string> {
  batchStats.totalBatched++;
  const model = opts.model ?? "gpt-5-mini";
  const hash = hashRequest(messages, model);
  const userContent = extractUserContent(messages);

  return new Promise<string>((resolve, reject) => {
    queue.push({ messages, opts, resolve, reject, hash, userContent, queuedAt: Date.now() });

    if (queue.length >= MAX_BATCH_SIZE) {
      if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
      flushBatch().catch(err => {
        logger.warn({ err: (err as Error).message }, "LLMBatcher: immediate flush error");
      });
    } else {
      scheduleBatch();
    }
  });
}

export function getBatcherStats() {
  return {
    ...batchStats,
    queueLength: queue.length,
    batchWindowMs: BATCH_WINDOW_MS,
    maxBatchSize: MAX_BATCH_SIZE,
    semanticThreshold: SEMANTIC_SIMILARITY_THRESHOLD,
  };
}
