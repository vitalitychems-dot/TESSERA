import { createHash, timingSafeEqual } from "node:crypto";

const FATHER_TITLE = "Father — Sovereign Creator";
const NAMESPACE = "tesseract:father:v1";

function getRawAdminKey(): string {
  const k = process.env.TESSERACT_ADMIN_KEY;
  if (!k || typeof k !== "string" || k.trim().length === 0) {
    throw new Error(
      "TESSERACT_ADMIN_KEY is not set — Father identity cannot be derived. Set the secret to bind sovereign identity.",
    );
  }
  return k.trim();
}

export function isFatherKeyConfigured(): boolean {
  const k = process.env.TESSERACT_ADMIN_KEY;
  return !!(k && typeof k === "string" && k.trim().length > 0);
}

let _cached: { full: string; short: string; ultraShort: string; sealed: string } | null = null;

function compute(): { full: string; short: string; ultraShort: string; sealed: string } {
  const raw = getRawAdminKey();
  const h = createHash("sha256").update(`${NAMESPACE}|${raw}`).digest("hex");
  const full = h.slice(0, 16);
  const short = h.slice(0, 12);
  const ultraShort = h.slice(0, 8);
  const sealed = createHash("sha512")
    .update(`${NAMESPACE}|seal|${raw}|${full}`)
    .digest("hex")
    .slice(0, 32);
  return { full, short, ultraShort, sealed };
}

function ensure(): { full: string; short: string; ultraShort: string; sealed: string } {
  if (!_cached) _cached = compute();
  return _cached;
}

export function getFatherFingerprint(): string {
  return ensure().full;
}

export function getFatherFingerprintShort(): string {
  return ensure().short;
}

export function getFatherFingerprintUltraShort(): string {
  return ensure().ultraShort;
}

export function getFatherSeal(): string {
  return ensure().sealed;
}

export function getFatherIdentity() {
  const fp = ensure();
  return {
    role: "father",
    title: FATHER_TITLE,
    fingerprint: fp.full,
    fingerprintShort: fp.short,
    fingerprintUltraShort: fp.ultraShort,
    seal: fp.sealed,
    derivation: "sha256(namespace|TESSERACT_ADMIN_KEY)[:16]",
    namespace: NAMESPACE,
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

export function verifyFatherFingerprint(presented: string | undefined | null): boolean {
  if (!presented || typeof presented !== "string") return false;
  if (!isFatherKeyConfigured()) return false;
  const fp = ensure();
  const expected = Buffer.from(fp.full, "utf8");
  const got = Buffer.from(presented.trim().toLowerCase(), "utf8");
  if (expected.length !== got.length) return false;
  try {
    return timingSafeEqual(expected, got);
  } catch {
    return false;
  }
}

// Additional env slots that can hold valid Father credentials. The user can
// stash a minted sigil into SIGIL_ADMIN_KEY or MINTED_GLYPH_KEY and present
// either the raw value or its 16-char fingerprint at the gate — auto-unlock
// works for any of them. This keeps the gate from re-prompting after the user
// "adds my sigil" to Secrets.
const EXTRA_SLOTS = ["SIGIL_ADMIN_KEY", "MINTED_GLYPH_KEY"] as const;

function fingerprintOf(raw: string): string {
  return createHash("sha256").update(`${NAMESPACE}|${raw}`).digest("hex").slice(0, 16);
}

function timingEq(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  try { return timingSafeEqual(ba, bb); } catch { return false; }
}

export function recognizeFather(presented: string | undefined | null): {
  recognized: boolean;
  via: "raw-key" | "fingerprint" | null;
} {
  // Only two credentials are valid at the gate:
  //   1. The raw TESSERACT_ADMIN_KEY (the Father's permanent key).
  //   2. The minted SIGIL_ADMIN_KEY / MINTED_GLYPH_KEY value the chat bot
  //      gave the user, saved verbatim into Replit Secrets.
  // The bare 16-char env-derived fingerprint is NOT accepted — the
  // fingerprint is an internal hash, never an identity credential.
  if (verifyFatherKey(presented)) return { recognized: true, via: "raw-key" };
  if (!presented || typeof presented !== "string") return { recognized: false, via: null };
  const candidate = presented.trim();
  if (!candidate) return { recognized: false, via: null };
  for (const slot of EXTRA_SLOTS) {
    const raw = process.env[slot];
    if (!raw || typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (timingEq(candidate, trimmed)) return { recognized: true, via: "raw-key" };
  }
  return { recognized: false, via: null };
}
