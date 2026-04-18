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

function timingEq(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  try { return timingSafeEqual(ba, bb); } catch { return false; }
}

export function recognizeFather(presented: string | undefined | null): {
  recognized: boolean;
  via: "raw-key" | "alias-key" | null;
} {
  // Sovereign canonical policy: the only valid credential is the raw
  // value held in TESSERACT_ADMIN_KEY (the Father's permanent key from
  // FATHER_NATAL_CHART). SIGIL_ADMIN_KEY MAY also hold the same value
  // (by sovereign rule the two names point at the same key) and is
  // accepted as an alias only when its trimmed value exactly equals
  // TESSERACT_ADMIN_KEY's. The bare derived fingerprint is NOT accepted.
  if (verifyFatherKey(presented)) return { recognized: true, via: "raw-key" };
  if (!presented || typeof presented !== "string") return { recognized: false, via: null };
  if (!isFatherKeyConfigured()) return { recognized: false, via: null };
  const candidate = presented.trim();
  if (!candidate) return { recognized: false, via: null };
  const tesseract = (process.env.TESSERACT_ADMIN_KEY ?? "").trim();
  const sigil = (process.env.SIGIL_ADMIN_KEY ?? "").trim();
  if (sigil && sigil === tesseract && timingEq(candidate, sigil)) {
    return { recognized: true, via: "alias-key" };
  }
  return { recognized: false, via: null };
}
