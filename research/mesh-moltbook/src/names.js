import { canon, idFromPub, sha256, verifySig } from "./identity.js";

/**
 * Names, not addresses. Two self-certifying namespaces, so no certificate
 * authority and no DNS are needed to check what you received:
 *   /cid/<sha256(payload)>        content-addressed; the hash is the proof
 *   /id/<nodeId>/<path...>        publisher-owned; nodeId = hash(pubkey), data is signed
 */
export const parseName = (name) => name.split("/").filter(Boolean);

export const isPrefix = (prefix, name) => name === prefix || name.startsWith(`${prefix}/`);

export const cidName = (payload) => `/cid/${sha256(payload)}`;

export function makeData({ name, payload, identity }) {
  const [ns, owner] = parseName(name);
  if (ns === "cid") {
    if (name !== cidName(payload)) throw new Error("cid name does not match payload hash");
    return { kind: "data", name, payload };
  }
  if (ns === "id" && owner === identity?.id) {
    return { kind: "data", name, payload, pub: identity.pub, sig: identity.sign(canon({ name, payload })) };
  }
  throw new Error(`cannot publish ${name}: not a /cid name and not under this identity's /id namespace`);
}

export function verifyData(data) {
  if (!data || typeof data.name !== "string" || typeof data.payload !== "string") return false;
  const [ns, owner] = parseName(data.name);
  if (ns === "cid") return data.name === cidName(data.payload);
  if (ns === "id") {
    return (
      typeof data.pub === "string" &&
      typeof data.sig === "string" &&
      idFromPub(data.pub) === owner &&
      verifySig(data.pub, canon({ name: data.name, payload: data.payload }), data.sig)
    );
  }
  return false;
}

/** Longest-prefix match over a Map keyed by name prefix. */
export function longestPrefix(table, name) {
  let best = null;
  for (const prefix of table.keys()) {
    if (isPrefix(prefix, name) && (best === null || prefix.length > best.length)) best = prefix;
  }
  return best;
}
