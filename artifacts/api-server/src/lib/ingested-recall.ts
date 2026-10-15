import { db } from "@workspace/db";
import { ingestedDataTable } from "@workspace/db/schema";
import { desc, sql, or, ilike } from "drizzle-orm";
import { logger } from "./logger";
import { makeSourceProvenance, sanitizeCitationText, type TesseraSourceProvenance } from "./tessera-source-provenance";

export interface IngestedRecallPassage {
  id: string;
  text: string;
  source: string;
  provenance: TesseraSourceProvenance;
}

type IngestedRecallRow = {
  id: number;
  title: string | null;
  content: string;
  source: string;
  sourceType: string;
  url: string | null;
  ingestedAt: Date;
  publishedAt: Date | null;
};

export function mapIngestedRecallRow(row: IngestedRecallRow): IngestedRecallPassage {
  const sourceType = sanitizeCitationText(row.sourceType, 60);
  const sourceName = sanitizeCitationText(row.source, 120);
  const title = row.title ? sanitizeCitationText(row.title, 100) : "";
  const text = (row.content || "").slice(0, 400)
    .replace(/\b(ignore|disregard|forget|override|system|prompt|instruction|you are|act as|pretend|role|assistant)\b/gi, "[$1]")
    .replace(/[<>{}]/g, "")
    .trim();
  const source = `${sourceType}/${sourceName}${title ? ` — ${title}` : ""}`;

  return {
    id: `ingested:${row.id}`,
    text,
    source,
    provenance: makeSourceProvenance({
      sourceUrl: row.url,
      documentReference: `ingested-data:${row.id}`,
      retrievedAt: row.ingestedAt,
      publishedAt: row.publishedAt,
      // Stored records have no independently-controlled verification field;
      // scraped or user-provided metadata cannot promote them to verified.
      trustStatus: "unverified",
    }),
  };
}

export function formatIngestedRecallContext(passage: IngestedRecallPassage): string {
  const provenance = passage.provenance;
  const details = [
    `trust=${provenance.trustStatus}`,
    `retrieved=${provenance.retrievedAt ?? "date unavailable"}`,
    `published=${provenance.publishedAt ?? "date unavailable"}`,
    `reference=${provenance.documentReference}`,
    ...(provenance.sourceUrl ? [`url=${provenance.sourceUrl}`] : []),
  ].join("; ");
  return `> [${passage.source}] (${details}) "${passage.text}"`;
}

export async function recallIngestedKnowledgeWithProvenance(query: string, limit = 5): Promise<IngestedRecallPassage[]> {
  try {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(20, Math.floor(limit))) : 5;
    const keywords = query.slice(0, 2000)
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 3)
      .map(w => w.slice(0, 64))
      .slice(0, 8);

    if (keywords.length === 0) return [];

    const conditions = keywords.map(kw =>
      or(
        ilike(ingestedDataTable.title, `%${kw}%`),
        ilike(ingestedDataTable.content, `%${kw}%`),
      )
    );

    const rows = await db
      .select({
        id: ingestedDataTable.id,
        title: ingestedDataTable.title,
        content: ingestedDataTable.content,
        source: ingestedDataTable.source,
        sourceType: ingestedDataTable.sourceType,
        url: ingestedDataTable.url,
        ingestedAt: ingestedDataTable.ingestedAt,
        publishedAt: ingestedDataTable.publishedAt,
      })
      .from(ingestedDataTable)
      .where(or(...conditions.filter(Boolean) as any[]))
      .orderBy(desc(ingestedDataTable.ingestedAt))
      .limit(safeLimit);

    if (rows.length === 0) return [];

    logger.info({ query: query.slice(0, 50), matches: rows.length }, "Ingested knowledge recalled for sovereign context");

    return rows.map(mapIngestedRecallRow);
  } catch (err) {
    logger.warn({ err: (err as Error).message }, "Ingested knowledge recall failed");
    return [];
  }
}

// Preserve the legacy string contract for other internal consumers while the
// answer/citation pipeline uses the structured provenance-bearing records.
export async function recallIngestedKnowledge(query: string, limit = 5): Promise<string[]> {
  const passages = await recallIngestedKnowledgeWithProvenance(query, limit);
  return passages.map(formatIngestedRecallContext);
}
