// Tessera Usage Ledger — tailored from FreeLLMAPI's per-request accounting
// idea. Counts and honest limit reporting only: NO provider failover, NO
// secondary endpoints. One owner-controlled model endpoint, fully accounted.

interface ModelUsage {
  requests: number;
  failures: number;
  limitEvents: number;      // HTTP 429 / quota responses from the endpoint
  estimatedPromptTokens: number;
  estimatedCompletionTokens: number;
  firstCallAt: number | null;
  lastCallAt: number | null;
}

const ledger = new Map<string, ModelUsage>();

function bucket(model: string): ModelUsage {
  let entry = ledger.get(model);
  if (!entry) {
    entry = {
      requests: 0, failures: 0, limitEvents: 0,
      estimatedPromptTokens: 0, estimatedCompletionTokens: 0,
      firstCallAt: null, lastCallAt: null,
    };
    ledger.set(model, entry);
  }
  return entry;
}

export function recordModelCall(args: {
  model: string;
  ok: boolean;
  limited?: boolean;
  promptChars: number;
  completionChars?: number;
  at?: number;
}): void {
  const entry = bucket(args.model);
  const at = args.at ?? Date.now();
  entry.requests++;
  if (!args.ok) entry.failures++;
  if (args.limited) entry.limitEvents++;
  entry.estimatedPromptTokens += Math.ceil(args.promptChars / 4);
  entry.estimatedCompletionTokens += Math.ceil((args.completionChars ?? 0) / 4);
  entry.firstCallAt = entry.firstCallAt ?? at;
  entry.lastCallAt = at;
}

export interface UsageReport {
  model: string;
  requests: number;
  failures: number;
  limitEvents: number;
  estimatedTotalTokens: number;
  window: { firstCallAt: number | null; lastCallAt: number | null };
  note: string;
}

export function getUsageReport(model?: string): UsageReport[] {
  const models = model ? [model] : [...ledger.keys()];
  return models.filter((m) => ledger.has(m)).map((m) => {
    const e = ledger.get(m)!;
    return {
      model: m,
      requests: e.requests,
      failures: e.failures,
      limitEvents: e.limitEvents,
      estimatedTotalTokens: e.estimatedPromptTokens + e.estimatedCompletionTokens,
      window: { firstCallAt: e.firstCallAt, lastCallAt: e.lastCallAt },
      note: "Counts are exact; token figures are chars/4 estimates from this process only. No fallback provider exists by policy.",
    };
  });
}

/** Test hook: reset the in-memory ledger. */
export function resetUsageLedger(): void {
  ledger.clear();
}
