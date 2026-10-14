/**
 * COLONIAL_MASTER_SECRET is required for the colonial cipher, lattice bands,
 * and the other colonial encrypt paths. Minimum length is 32 characters.
 * A missing or short value is not configured. This module never supplies a
 * fallback, a random substitute, or an environment-flag bypass.
 * The old hardcoded colonial fallback is in git history, so treat anything encrypted under it as plaintext.
 */

export const COLONIAL_SECRET_MIN_LENGTH = 32;
export const COLONIAL_SECRET_NOT_CONFIGURED = "colonial-secret-not-configured";

export class ColonialSecretNotConfiguredError extends Error {
  readonly code = COLONIAL_SECRET_NOT_CONFIGURED;

  constructor() {
    super(COLONIAL_SECRET_NOT_CONFIGURED);
    this.name = "ColonialSecretNotConfiguredError";
  }
}

function readConfiguredSecret(): string | undefined {
  const value = process.env.COLONIAL_MASTER_SECRET;
  if (typeof value !== "string" || value.length < COLONIAL_SECRET_MIN_LENGTH) {
    return undefined;
  }
  return value;
}

export function isColonialSecretConfigured(): boolean {
  return readConfiguredSecret() !== undefined;
}

export function requireColonialMasterSecret(): Buffer {
  const value = readConfiguredSecret();
  if (value === undefined) {
    throw new ColonialSecretNotConfiguredError();
  }
  return Buffer.from(value, "utf8");
}

export function isColonialSecretNotConfigured(err: unknown): boolean {
  return err instanceof ColonialSecretNotConfiguredError;
}

export function colonialSecretUnavailableBody(): {
  ok: false;
  error: typeof COLONIAL_SECRET_NOT_CONFIGURED;
} {
  return { ok: false, error: COLONIAL_SECRET_NOT_CONFIGURED };
}

export function colonialSecretFailure(err: unknown): {
  status: 503;
  body: ReturnType<typeof colonialSecretUnavailableBody>;
} | null {
  if (!isColonialSecretNotConfigured(err)) return null;
  return { status: 503, body: colonialSecretUnavailableBody() };
}
