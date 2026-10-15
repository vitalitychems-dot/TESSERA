import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ values: null as Record<string, unknown> | null }));

vi.mock("@workspace/db", () => ({
  db: {
    insert: () => ({
      values: (values: Record<string, unknown>) => {
        state.values = values;
        return { returning: async () => [{ id: 17 }] };
      },
    }),
  },
  providerCallsTable: { id: "synthetic-id" },
}));

import { logProviderCall } from "../lib/provider-call-logger";

describe("provider-call log minimization", () => {
  it("keeps metrics but never persists request, response, or provider error text", async () => {
    const requestSecret = "synthetic-request-private-content";
    const responseSecret = "synthetic-response-private-content";
    const errorSecret = "synthetic-provider-error-private-content";
    const id = await logProviderCall({
      providerId: "synthetic-provider",
      providerName: "Synthetic provider",
      model: "synthetic-model",
      requestMessages: [{ role: "user", content: requestSecret }],
      responseText: responseSecret,
      error: errorSecret,
      inputTokens: 12,
      outputTokens: 8,
      latencyMs: 31,
    });

    expect(id).toBe(17);
    expect(state.values).toMatchObject({
      requestMessages: [],
      responseText: null,
      error: "provider-call-failed",
      inputTokens: 12,
      outputTokens: 8,
      latencyMs: 31,
    });
    const stored = JSON.stringify(state.values);
    expect(stored).not.toContain(requestSecret);
    expect(stored).not.toContain(responseSecret);
    expect(stored).not.toContain(errorSecret);
  });
});
