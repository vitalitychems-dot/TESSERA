/**
 * Per-lane identity (GM-1, Security HIGH #2).
 * MESH_LANE_TOKENS = JSON map { "<slug>": "<sha256 hex of the lane's token>" }.
 * Raw tokens are never stored; the presented token is hashed and compared in constant time.
 * Unset => lane auth is off and existing behaviour is unchanged.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export const MESH_LANE_TOKENS_ENV = "MESH_LANE_TOKENS";
export const LANE_TOKEN_HEADER = "x-mesh-lane-token";
/** Owner node(s): reachable only through the owner admin session, never by lane token. */
export const RESERVED_OWNER_SLUGS: ReadonlySet<string> = new Set(["father"]);
const HEX64 = /^[0-9a-f]{64}$/;
/** Same slug grammar as the registry; council nodes ("council-*") are valid identities too. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** Parse env. null = unset (lane auth off). Throws on malformed JSON/hashes. */
export function parseLaneTokens(env: NodeJS.ProcessEnv = process.env): Map<string, Buffer> | null {
  const raw = env[MESH_LANE_TOKENS_ENV];
  if (!raw) return null;
  const obj = JSON.parse(raw) as Record<string, unknown>;
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error("MESH_LANE_TOKENS must be a JSON object");
  const out = new Map<string, Buffer>();
  for (const [slug, h] of Object.entries(obj)) {
    if (slug.startsWith("_")) continue; // comment keys such as "_doc" (copied from the example file)
    if (!SLUG.test(slug)) throw new Error(`MESH_LANE_TOKENS: bad slug ${slug.slice(0, 64)}`);
    if (RESERVED_OWNER_SLUGS.has(slug)) throw new Error(`MESH_LANE_TOKENS: ${slug} is the owner node and cannot hold a lane token`);
    if (typeof h !== "string" || !HEX64.test(h)) throw new Error(`MESH_LANE_TOKENS: bad sha256 for ${slug}`);
    out.set(slug, Buffer.from(h, "hex"));
  }
  return out;
}

/** Hash the presented token and return the matching slug, or null. Checks every entry (no early exit). */
export function laneForToken(token: string | undefined, table: Map<string, Buffer>): string | null {
  if (!token) return null;
  const presented = createHash("sha256").update(token, "utf8").digest();
  let match: string | null = null;
  for (const [slug, h] of table) {
    if (h.length === presented.length && timingSafeEqual(h, presented)) match = slug;
  }
  return match;
}
