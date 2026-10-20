export type TesseraTrustStatus = "verified" | "unverified" | "stale";

export interface TesseraSourceProvenance {
  sourceUrl: string | null;
  documentReference: string;
  retrievedAt: string | null;
  /** Publication date; reduced precision such as YYYY-MM is preserved when the source provides no day. */
  publishedAt: string | null;
  trustStatus: TesseraTrustStatus;
  trustNote: string;
}

function cleanReference(value: unknown, maxLength = 240): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return cleaned || null;
}

function isoDate(value: unknown): string | null {
  if (!(value instanceof Date) && typeof value !== "string" && typeof value !== "number") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function publicationDate(value: unknown): string | null {
  if (typeof value === "string") {
    const reducedPrecision = value.trim().match(/^(\d{4})(?:-(\d{2}))?$/);
    if (reducedPrecision) {
      const month = reducedPrecision[2];
      if (month && (Number(month) < 1 || Number(month) > 12)) return null;
      return reducedPrecision[0];
    }
  }
  return isoDate(value);
}

export function normalizeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function makeSourceProvenance(options: {
  sourceUrl?: unknown;
  documentReference?: unknown;
  retrievedAt?: unknown;
  publishedAt?: unknown;
  trustStatus?: TesseraTrustStatus;
}): TesseraSourceProvenance {
  const trustStatus = options.trustStatus ?? "unverified";
  return {
    sourceUrl: normalizeSourceUrl(options.sourceUrl),
    documentReference: cleanReference(options.documentReference) ?? "source-reference-unavailable",
    retrievedAt: isoDate(options.retrievedAt),
    publishedAt: publicationDate(options.publishedAt),
    trustStatus,
    trustNote: trustStatus === "verified"
      ? "Marked verified by trusted server-side provenance; still check the linked original."
      : trustStatus === "stale"
        ? "Outdated source; use only as a historical note, not as a current fact."
        : "Not independently verified; treat as a note, not an established fact.",
  };
}

export function sanitizeCitationText(value: unknown, maxLength = 240): string {
  return cleanReference(value, maxLength) ?? "source";
}

export function formatInlineCitation(index: number, provenance: TesseraSourceProvenance): string {
  const safeIndex = Number.isInteger(index) && index > 0 ? index : 1;
  return provenance.sourceUrl
    ? `[${safeIndex}](<${provenance.sourceUrl}>)`
    : `[${safeIndex}]`;
}

export function getSourceTrustLabel(status: TesseraTrustStatus): string {
  switch (status) {
    case "verified": return "Verified source";
    case "stale": return "Outdated note";
    default: return "Unverified note";
  }
}
