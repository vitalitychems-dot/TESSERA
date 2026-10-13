/**
 * Mesh node registry per lane (GM-1). Mirrors the REA-08 comms allow-list:
 * directed [from, to] edges, "*" as `to` = any recipient ("*" is never a valid sender).
 * Data: config/mesh-lanes.json (or MESH_REGISTRY_PATH at startup).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { CommsEdge } from "./comms-policy";

export interface MeshRegistry { lanes: string[]; sinks?: string[]; edges: CommsEdge[]; aliases?: Record<string, string>; groups?: MeshNodeGroup[] }

export const NODE_GROUP_KINDS = ["council"] as const;
export interface MeshNodeGroup { kind: (typeof NODE_GROUP_KINDS)[number]; nodes: string[] }

export const DEFAULT_MESH_REGISTRY_PATH = fileURLToPath(new URL("../../../../config/mesh-lanes.json", import.meta.url));

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

export class MeshRegistryError extends Error {
  constructor(msg: string) { super(`mesh registry: ${msg}`); this.name = "MeshRegistryError"; }
}

function isSlugList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === "string" && SLUG.test(s));
}

/** Schema-validate a parsed registry. Throws MeshRegistryError on any problem. */
export function validateMeshRegistry(raw: unknown): MeshRegistry {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new MeshRegistryError("root must be an object");
  const r = raw as Record<string, unknown>;
  if (!isSlugList(r.lanes) || r.lanes.length === 0) throw new MeshRegistryError("lanes must be a non-empty slug array");
  if (r.sinks !== undefined && !isSlugList(r.sinks)) throw new MeshRegistryError("sinks must be a slug array");
  const sinks = (r.sinks as string[] | undefined) ?? [];
  const groups: MeshNodeGroup[] = [];
  if (r.groups !== undefined) {
    if (!Array.isArray(r.groups)) throw new MeshRegistryError("groups must be an array");
    for (const g of r.groups as any[]) {
      if (!g || typeof g !== "object" || !(NODE_GROUP_KINDS as readonly unknown[]).includes(g.kind)) {
        throw new MeshRegistryError(`group kind must be one of ${NODE_GROUP_KINDS.join(", ")}`);
      }
      if (!isSlugList(g.nodes) || g.nodes.length === 0) throw new MeshRegistryError("group nodes must be a non-empty slug array");
      if (g.nodes.some((n: string) => !n.startsWith(`${g.kind}-`))) throw new MeshRegistryError(`${g.kind} nodes must be prefixed "${g.kind}-"`);
      groups.push({ kind: g.kind, nodes: g.nodes });
    }
  }
  const groupNodes = groups.flatMap((g) => g.nodes);
  const nodes = new Set([...r.lanes, ...sinks, ...groupNodes]);
  if (nodes.size !== r.lanes.length + sinks.length + groupNodes.length) throw new MeshRegistryError("duplicate lane/sink/group node");
  if (!Array.isArray(r.edges)) throw new MeshRegistryError("edges must be an array");
  for (const e of r.edges) {
    if (!Array.isArray(e) || e.length !== 2 || typeof e[0] !== "string" || typeof e[1] !== "string") {
      throw new MeshRegistryError("each edge must be [from, to]");
    }
    const [f, t] = e as [string, string];
    if (f === "*") throw new MeshRegistryError("'*' is not allowed as a sender");
    if (!nodes.has(f)) throw new MeshRegistryError(`unknown sender ${f}`);
    if (t !== "*" && !nodes.has(t)) throw new MeshRegistryError(`unknown recipient ${t}`);
  }
  let aliases: Record<string, string> = {};
  if (r.aliases !== undefined) {
    if (!r.aliases || typeof r.aliases !== "object" || Array.isArray(r.aliases)) throw new MeshRegistryError("aliases must be an object");
    for (const [name, slug] of Object.entries(r.aliases as Record<string, unknown>)) {
      if (name.length === 0 || name.length > 128 || name === "*") throw new MeshRegistryError(`bad alias name ${name}`);
      if (typeof slug !== "string" || !nodes.has(slug)) throw new MeshRegistryError(`alias ${name} -> unknown slug`);
    }
    aliases = r.aliases as Record<string, string>;
  }
  return { lanes: r.lanes, sinks, edges: r.edges as CommsEdge[], aliases, groups };
}

/** Read + validate. Throws on missing file, bad JSON, or schema failure. */
export function loadMeshRegistry(path = DEFAULT_MESH_REGISTRY_PATH): MeshRegistry {
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch { throw new MeshRegistryError(`cannot read ${path}`); }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new MeshRegistryError(`invalid JSON in ${path}`); }
  return validateMeshRegistry(parsed);
}
