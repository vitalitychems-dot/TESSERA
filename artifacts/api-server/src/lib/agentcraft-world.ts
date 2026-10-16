import { timingSafeEqual } from "node:crypto";
import {
  AgentCraftBridgePayloadSchema,
  type AgentCraftBridgePayload,
  type AgentCraftWorldResponse,
} from "@workspace/api-zod";

const MAX_SNAPSHOT_AGE_MS = 60_000;

let latest: { payload: AgentCraftBridgePayload; receivedAt: number } | null = null;

export function isAgentCraftBridgeConfigured(): boolean {
  return (process.env.AGENTCRAFT_BRIDGE_TOKEN ?? "").trim().length >= 32;
}

export function verifyAgentCraftBridgeToken(presented: string | undefined): boolean {
  const configured = (process.env.AGENTCRAFT_BRIDGE_TOKEN ?? "").trim();
  if (configured.length < 32 || !presented || presented.length > 512) return false;
  const expectedBytes = Buffer.from(configured, "utf8");
  const presentedBytes = Buffer.from(presented, "utf8");
  return expectedBytes.length === presentedBytes.length && timingSafeEqual(expectedBytes, presentedBytes);
}

export function acceptAgentCraftSnapshot(input: unknown, now = Date.now()): boolean {
  const parsed = AgentCraftBridgePayloadSchema.safeParse(input);
  if (!parsed.success) return false;
  latest = { payload: parsed.data, receivedAt: now };
  return true;
}

export function readAgentCraftWorld(now = Date.now()): AgentCraftWorldResponse {
  const age = latest ? now - latest.receivedAt : Number.POSITIVE_INFINITY;
  const isAvailable = !!latest && age <= MAX_SNAPSHOT_AGE_MS;
  const stale = !!latest && !isAvailable;
  return {
    ok: true,
    status: isAvailable ? "live" : stale ? "stale" : "unavailable",
    source: "AgentCraft Foreman",
    backend: latest?.payload.backend ?? null,
    agents: latest?.payload.agents ?? [],
    receivedAt: latest?.receivedAt ?? null,
    provenance: {
      kind: "agentcraft-foreman",
      live: isAvailable,
      gameCoordinates: false,
      note: "AgentCraft Foreman status and station labels only; this feed does not provide Minecraft world coordinates.",
    },
  };
}

export function clearAgentCraftSnapshotForTests(): void {
  latest = null;
}
