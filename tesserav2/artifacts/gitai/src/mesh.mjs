/**
 * Offline mesh drop. Uses the existing git mesh: a clone can be read with no web.
 * A drop is not delivered until it is approved, and payment text is refused.
 */
import { MESH, meshDrop } from "../../../preview/src/lib/tessera/mesh-net.ts";
import { refuseMonetaryRequest } from "./policy.mjs";

export function meshFacts() {
  return { net: MESH.net, carriedBy: MESH.carriedBy, needsWeb: MESH.needsWeb };
}

export function publishMeshDrop(from, to, body, approved) {
  const facts = meshFacts();
  if (facts.needsWeb !== false || facts.carriedBy !== "git") {
    return { ok: false, reason: "The offline git mesh is not available." };
  }
  const money = refuseMonetaryRequest(body);
  if (!money.ok) return money;
  const text = String(body ?? "").trim();
  if (!text) return { ok: false, reason: "The drop is empty." };
  if (text.length > 500) return { ok: false, reason: "The drop is too long." };
  return meshDrop(String(from), String(to), `[gitai] ${text}`, Boolean(approved));
}
