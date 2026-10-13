/**
 * Allowed communication graph (REA-08).
 *
 * Idea: agency-swarm (MIT) "communication flows" — agents may only message
 * the directed edges they are given. Mirrors the Gitbook mesh gate pipeline
 * (mesh/flow.md). Implemented from scratch.
 *
 * Default is OPEN (no policy set) so existing behaviour is unchanged until a
 * policy is installed with setCommsPolicy().
 */
import { loadMeshRegistry } from "./mesh-registry";

export type CommsEdge = [from: string, to: string];

export class CommsPolicyError extends Error {
  constructor(readonly from: string, readonly to: string) {
    super(`agent "${from}" is not allowed to message "${to}"`);
    this.name = "CommsPolicyError";
  }
}

let allowed: Map<string, Set<string>> | null = null;
let aliases: Map<string, string> = new Map();

/** Display-name -> slug aliases, resolved before every policy check. */
export function setCommsAliases(map: Record<string, string> | null): void {
  aliases = new Map(Object.entries(map ?? {}));
}
export const resolveAlias = (name: string): string => aliases.get(name) ?? name;

/** Install a directed allow-list. "*" as `to` means any recipient. Pass null to reopen. */
export function setCommsPolicy(edges: CommsEdge[] | null): void {
  if (edges === null) { allowed = null; aliases = new Map(); return; }
  allowed = new Map();
  for (const [f, t] of edges) {
    if (!allowed.has(f)) allowed.set(f, new Set());
    allowed.get(f)!.add(t);
  }
}

export function isMessageAllowed(from: string, to: string): boolean {
  if (!allowed) return true;
  const s = allowed.get(resolveAlias(from));
  return Boolean(s && (s.has(resolveAlias(to)) || s.has("*")));
}

export function assertMayMessage(from: string, to: string): void {
  if (!isMessageAllowed(from, to)) throw new CommsPolicyError(from, to);
}

export function getCommsPolicy(): CommsEdge[] | null {
  if (!allowed) return null;
  return [...allowed.entries()].flatMap(([f, ts]) => [...ts].map((t) => [f, t] as CommsEdge));
}

/** Env var naming the registry file. Unset => policy stays open (REA-08 default). */
export const MESH_REGISTRY_ENV = "MESH_REGISTRY_PATH";

/**
 * GM-1: install the mesh lane registry as the policy. FAIL CLOSED: if the file is
 * missing or invalid, every edge is denied. Returns true if the registry loaded.
 */
export function applyMeshRegistryPolicy(path?: string): boolean {
  try {
    const reg = loadMeshRegistry(path);
    setCommsPolicy(reg.edges);
    setCommsAliases(reg.aliases ?? null);
    return true;
  } catch {
    setCommsPolicy([]);
    return false;
  }
}

/**
 * GM-1b startup hook. MESH_REGISTRY_PATH unset => "inert": GM-1 installs nothing and
 * adds no routes; the pre-GM-1 policy state is left as is. That is safe because the
 * comms POST routes no longer accept an unauthenticated sender (401 without
 * MESH_LANE_TOKENS), so an open policy can't be abused for impersonation.
 */
export function initMeshRegistryFromEnv(env: NodeJS.ProcessEnv = process.env): "inert" | "enforced" | "deny-all" {
  const path = env[MESH_REGISTRY_ENV];
  if (!path) return "inert";
  return applyMeshRegistryPolicy(path) ? "enforced" : "deny-all";
}
