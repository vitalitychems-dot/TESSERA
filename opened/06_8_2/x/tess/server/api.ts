import { callLLMSimple } from "./llm-helper";

const BATCH_SIZE = 5;
const BATCH_TIMEOUT_MS = 30_000;

interface BatchRequest {
  prompt: string;
  maxTokens?: number;
  systemPrompt?: string;
  agentId?: string;
}

interface BatchResult {
  index: number;
  success: boolean;
  response: string;
  latencyMs: number;
}

async function processSingleRequest(req: BatchRequest, index: number): Promise<BatchResult> {
  const start = Date.now();
  try {
    const response = await callLLMSimple(
      req.prompt,
      req.maxTokens || 1024,
      { agentId: req.agentId, budgetGated: true },
      req.systemPrompt || "",
      []
    );
    return { index, success: true, response, latencyMs: Date.now() - start };
  } catch (err: any) {
    return { index, success: false, response: err.message || "Batch request failed", latencyMs: Date.now() - start };
  }
}

export async function batchLLMRequests(requests: BatchRequest[]): Promise<BatchResult[]> {
  const allResults: BatchResult[] = [];
  for (let i = 0; i < requests.length; i += BATCH_SIZE) {
    const batch = requests.slice(i, i + BATCH_SIZE);
    const batchPromises = batch.map((req, idx) => processSingleRequest(req, i + idx));
    const results = await Promise.all(batchPromises);
    allResults.push(...results);
  }
  return allResults;
}

export function getBatchConfig() {
  return { batchSize: BATCH_SIZE, timeoutMs: BATCH_TIMEOUT_MS };
}
