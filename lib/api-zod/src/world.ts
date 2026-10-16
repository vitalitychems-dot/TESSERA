import { z } from "zod";

export const AgentCraftBackendSchema = z.enum(["sim", "claude", "codex"]);
export const AgentCraftStateSchema = z.enum([
  "idle", "thinking", "reading", "editing", "running", "testing",
  "waiting_user", "blocked", "done", "error",
]);
export const AgentCraftStationSchema = z.enum([
  "desk", "library", "terminal", "testbench", "mergestation", "meeting", "lounge", "user",
]);

// Deliberately excludes activity text, repository paths, logs, diffs, and messages.
export const AgentCraftWorldAgentSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,39}$/),
  name: z.string().trim().min(1).max(48).regex(/^[\p{L}\p{N} ._'-]+$/u),
  state: AgentCraftStateSchema,
  station: AgentCraftStationSchema,
  active: z.boolean(),
}).strict();

export const AgentCraftBridgePayloadSchema = z.object({
  backend: AgentCraftBackendSchema,
  agents: z.array(AgentCraftWorldAgentSchema).max(32),
}).strict().superRefine((value, context) => {
  const ids = new Set<string>();
  value.agents.forEach((agent, index) => {
    if (ids.has(agent.id)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["agents", index, "id"], message: "Agent IDs must be unique." });
    }
    ids.add(agent.id);
  });
});

export const AgentCraftWorldResponseSchema = z.object({
  ok: z.literal(true),
  status: z.enum(["live", "stale", "unavailable"]),
  source: z.literal("AgentCraft Foreman"),
  backend: AgentCraftBackendSchema.nullable(),
  agents: z.array(AgentCraftWorldAgentSchema),
  receivedAt: z.number().int().nonnegative().nullable(),
  provenance: z.object({
    kind: z.literal("agentcraft-foreman"),
    live: z.boolean(),
    gameCoordinates: z.literal(false),
    note: z.string(),
  }),
});

export type AgentCraftBackend = z.infer<typeof AgentCraftBackendSchema>;
export type AgentCraftWorldAgent = z.infer<typeof AgentCraftWorldAgentSchema>;
export type AgentCraftBridgePayload = z.infer<typeof AgentCraftBridgePayloadSchema>;
export type AgentCraftWorldResponse = z.infer<typeof AgentCraftWorldResponseSchema>;
