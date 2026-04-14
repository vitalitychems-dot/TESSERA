import { createHash } from "crypto";

const MIN_TOKEN_LENGTH = 8;

function hashSimple(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function validateMeshToken(token: string | undefined | null): string | null {
  if (!token || token.trim().length < MIN_TOKEN_LENGTH) return null;
  return hashSimple(token.trim());
}
