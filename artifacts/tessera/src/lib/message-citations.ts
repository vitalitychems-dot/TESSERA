export interface MessageCitation {
  id: string;
  idx: number;
  source: string;
  score: number;
  sourceUrl: string | null;
  documentReference: string;
  retrievedAt: string | null;
  publishedAt: string | null;
  trustStatus: "verified" | "unverified" | "stale";
  trustNote: string;
}

function text(value: unknown, max = 240): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max)
    : "";
}

function sourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && url.hostname && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function date(value: unknown, allowReducedPrecision = false): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  if (allowReducedPrecision && /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/.test(value)) return value;
  return /^\d{4}-\d{2}-\d{2}(?:T[\d:.+-]+Z?)?$/.test(value) && Number.isFinite(Date.parse(value))
    ? value
    : null;
}

/** Read only the attached structured record, never URLs or trust claims in chat text. */
export function parseMessageCitations(value: unknown): MessageCitation[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 24).flatMap((item: unknown) => {
    if (!item || typeof item !== "object") return [];
    const c = item as Record<string, unknown>;
    const source = text(c.source);
    const documentReference = text(c.documentReference);
    if (!source || !documentReference) return [];
    return [{
      id: text(c.id) || documentReference,
      idx: Number.isInteger(c.idx) && Number(c.idx) > 0 ? Number(c.idx) : 1,
      source,
      score: typeof c.score === "number" && Number.isFinite(c.score) ? c.score : 0,
      sourceUrl: sourceUrl(c.sourceUrl),
      documentReference,
      retrievedAt: date(c.retrievedAt),
      publishedAt: date(c.publishedAt, true),
      trustStatus: c.trustStatus === "verified" || c.trustStatus === "stale" ? c.trustStatus : "unverified",
      trustNote: text(c.trustNote, 400),
    }];
  });
}
