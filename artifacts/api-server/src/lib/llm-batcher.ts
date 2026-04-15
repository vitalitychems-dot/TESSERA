import { callLLM, LLMMessage, LLMCallOptions } from "./llm-client";
import { logger } from "./logger";
import * as crypto from "crypto";

interface QueuedRequest {
  messages: LLMMessage[];
  opts: LLMCallOptions;
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
  hash: string;
  queuedAt: number;
}

const BATCH_WINDOW_MS = 2000;
const MAX_BATCH_SIZE = 8;

const queue: QueuedRequest[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

const batchStats = {
  totalBatched: 0,
  totalDeduplicated: 0,
  totalFlushed: 0,
  batchesProcessed: 0,
};

function hashRequest(messages: LLMMessage[], model: string): string {
  const key = messages.map(m => `${m.role}:${m.content}`).join("|") + `|model:${model}`;
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function flushBatch(): Promise<void> {
  batchTimer = null;
  if (queue.length === 0) return;

  const batch = queue.splice(0, MAX_BATCH_SIZE);
  batchStats.batchesProcessed++;
  batchStats.totalFlushed += batch.length;

  const deduped = new Map<string, QueuedRequest[]>();
  for (const req of batch) {
    const existing = deduped.get(req.hash);
    if (existing) {
      existing.push(req);
      batchStats.totalDeduplicated++;
    } else {
      deduped.set(req.hash, [req]);
    }
  }

  const promises: Promise<void>[] = [];
  for (const [, reqs] of deduped) {
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

  return new Promise<string>((resolve, reject) => {
    queue.push({ messages, opts, resolve, reject, hash, queuedAt: Date.now() });

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
  };
}
