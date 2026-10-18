import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { NotConfiguredError } from "./not-configured";

const FATHER_TITLE = "Father — Sovereign Creator";
const NAMESPACE = "tesseract:father:v1";
const INSTALL_ID_PATH = join(process.cwd(), ".local-data", "install-id");
const INSTALL_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Public presence label. Not derived from a key, token, seed, or secret. */
export const ADMIN_SESSION_STATUS = "admin session active";

function getRawAdminKey(): string {
  const k = process.env.TESSERACT_ADMIN_KEY;
  if (!k || typeof k !== "string" || k.trim().length === 0) {
    throw new NotConfiguredError("admin key is not configured");
  }
  return k.trim();
}

/** Admin key material from TESSERACT_ADMIN_KEY only. Never reads chart or birth fields. */
export function readAdminKeyMaterial(): string {
  return getRawAdminKey();
}

export function isFatherKeyConfigured(): boolean {
  const k = process.env.TESSERACT_ADMIN_KEY;
  return !!(k && typeof k === "string" && k.trim().length > 0);
}

let _installId: string | null = null;
let _seal: string | null = null;

function readPersistedInstallId(): string | null {
  try {
    if (!existsSync(INSTALL_ID_PATH)) return null;
    const existing = readFileSync(INSTALL_ID_PATH, "utf8").trim();
    return INSTALL_ID_RE.test(existing) ? existing : null;
  } catch {
    return null;
  }
}

function writeInstallId(id: string, flag: "wx" | "w"): void {
  writeFileSync(INSTALL_ID_PATH, `${id}\n`, { mode: 0o600, flag });
  chmodSync(INSTALL_ID_PATH, 0o600);
}

function persistInstallId(id: string): string {
  mkdirSync(dirname(INSTALL_ID_PATH), { recursive: true, mode: 0o700 });
  try {
    writeInstallId(id, "wx");
    return id;
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
    if (code === "EEXIST") {
      const winner = readPersistedInstallId();
      if (winner) return winner;
      writeInstallId(id, "w");
      return id;
    }
    return id;
  }
}

/** Random per-install id, created once and stored on disk. Never derived from a key, token, seed, or secret. */
export function getInstallId(): string {
  if (_installId) return _installId;
  const existing = readPersistedInstallId();
  _installId = existing ?? persistInstallId(randomUUID());
  return _installId;
}

/** Public id for older callers. This is the install id, not a digest of any secret. */
export function getFatherFingerprint(): string {
  return getInstallId();
}

export function getFatherFingerprintShort(): string {
  return getInstallId();
}

export function getFatherFingerprintUltraShort(): string {
  return getInstallId();
}

export function getFatherSeal(): string {
  if (_seal) return _seal;
  const raw = getRawAdminKey();
  const bound = createHash("sha256").update(`${NAMESPACE}|${raw}`).digest("hex").slice(0, 16);
  _seal = createHash("sha512")
    .update(`${NAMESPACE}|seal|${raw}|${bound}`)
    .digest("hex")
    .slice(0, 32);
  return _seal;
}

export function getFatherIdentity() {
  if (!isFatherKeyConfigured()) {
    throw new NotConfiguredError("admin key is not configured");
  }
  return {
    role: "father",
    title: FATHER_TITLE,
    status: ADMIN_SESSION_STATUS,
    installId: getInstallId(),
    bound: true,
  } as const;
}

export function verifyFatherKey(presented: string | undefined | null): boolean {
  if (!presented || typeof presented !== "string") return false;
  if (!isFatherKeyConfigured()) return false;
  const expected = Buffer.from(getRawAdminKey(), "utf8");
  const got = Buffer.from(presented.trim(), "utf8");
  if (expected.length !== got.length) return false;
  try {
    return timingSafeEqual(expected, got);
  } catch {
    return false;
  }
}

export function recognizeFather(presented: string | undefined | null): {
  recognized: boolean;
  via: "raw-key" | "planetary-signal" | null;
} {
  // Sovereign two-key policy (Apr 2026):
  //   * The CANONICAL credential is the raw value held in TESSERACT_ADMIN_KEY.
  //   * The ROTATING credential is a planetary-cycle-derived signal stored in
  //     SIGIL_ADMIN_KEY. Either one, presented in `X-Sigil-Key`, opens the
  //     gate; both must be configured for the app-level unlock check.
  // The bare derived fingerprint is NOT accepted as a credential.
  if (verifyFatherKey(presented)) return { recognized: true, via: "raw-key" };
  if (!presented || typeof presented !== "string") return { recognized: false, via: null };
  if (!isFatherKeyConfigured()) return { recognized: false, via: null };
  const candidate = presented.trim();
  if (!candidate) return { recognized: false, via: null };
  // Lazy import to avoid a circular dependency between father-identity and
  // planetary-signal (planetary-signal pulls in lingua-universalis only).
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { isValidSignal } = require("./planetary-signal") as typeof import("./planetary-signal");
  const canonical = (process.env.TESSERACT_ADMIN_KEY ?? "").trim();
  if (canonical && isValidSignal(canonical, candidate)) {
    return { recognized: true, via: "planetary-signal" };
  }
  return { recognized: false, via: null };
}
