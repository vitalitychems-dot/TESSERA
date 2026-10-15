import { createHmac, randomBytes } from "node:crypto";

// Ephemeral process key: address pseudonyms are stable only for this process,
// are purpose-separated, and are never written to logs or persistent storage.
const rateLimitKey = randomBytes(32);

export type IpRateLimitPurpose =
  | "father-verification"
  | "admin-session"
  | "chat-sigil"
  | "raw-key-admin"
  | "public-write"
  | "father-key-conference"
  | "father-key-redemption";

export function ipRateLimitKey(address: string, purpose: IpRateLimitPurpose): string {
  return createHmac("sha256", rateLimitKey)
    .update(`tessera-rate-limit:${purpose}\0`, "utf8")
    .update(address || "unknown", "utf8")
    .digest("hex");
}
