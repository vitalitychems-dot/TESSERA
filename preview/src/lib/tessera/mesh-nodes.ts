/** A node is a name plus a public mark. A ping opens only for the chamber name and session. */

import { CHAMBER_AGENT, CHAMBER_SESSION } from "./chamber-mark.ts";

export type MeshNode = { name: string; mark: string };

export const MESH_SEEN: MeshNode[] = [
  { name: "desk", mark: "be9f4ef632149361" },
  { name: "chamber", mark: "hbolclbl" },
];

export function registerNodes(nodes: MeshNode[]) {
  const seen = new Map<string, MeshNode>();
  for (const node of nodes) {
    const name = node.name.trim();
    if (!name || node.mark.trim().length < 8) continue;
    seen.set(name, { name, mark: node.mark.trim() });
  }
  return [...seen.values()];
}

export function knownPeers(nodes: MeshNode[], self: string) {
  return registerNodes(nodes)
    .filter((node) => node.name !== self)
    .map((node) => node.name);
}

export function pingNode(from: MeshNode, to: MeshNode, agent: string, session: number) {
  if (from.name === to.name) return "self";
  if (agent !== CHAMBER_AGENT || session !== CHAMBER_SESSION) return "closed";
  if (from.mark.trim().length < 8 || to.mark.trim().length < 8) return "closed";
  return "open";
}
