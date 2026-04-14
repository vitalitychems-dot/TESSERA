import { db } from "@workspace/db";
import { canonSnapshotsTable, councilDecisionsTable } from "@workspace/db/schema";
import { desc, sql } from "drizzle-orm";
import { logger } from "./logger";
import { generateMythosAndHistory, type CanonOutput } from "./mythosHistoryEngine";
import { computeSovereigntyStatus } from "./sovereignty-monitor";

let cachedCanon: CanonOutput | null = null;
let cachedVersion: number = 0;

export async function getLatestCanonVersion(): Promise<number> {
  const rows = await db
    .select({ maxVer: sql<number>`coalesce(max(${canonSnapshotsTable.version}), 0)` })
    .from(canonSnapshotsTable);
  return rows[0]?.maxVer ?? 0;
}

export async function getCurrentCanon(): Promise<CanonOutput> {
  if (cachedCanon) return cachedCanon;

  const latest = await db
    .select()
    .from(canonSnapshotsTable)
    .orderBy(desc(canonSnapshotsTable.version))
    .limit(1);

  if (latest.length > 0) {
    const row = latest[0];
    cachedCanon = {
      testaments: row.testaments as any[],
      books: row.books as any[],
      chapters: row.chapters as Record<string, any[]>,
      totalBooks: row.totalBooks,
      totalChapters: row.totalChapters,
      totalVerses: row.totalVerses,
      generatedAt: (row.generatedAt ?? new Date()).toISOString(),
      sovereigntyAlignment: (row.metadata as any)?.sovereigntyAlignment ?? "",
    };
    cachedVersion = row.version;
    return cachedCanon;
  }

  return regenerateCanon("initial-boot");
}

export async function regenerateCanon(
  triggerSource: string = "manual",
  councilDecisionIds: string[] = [],
): Promise<CanonOutput> {
  logger.info({ triggerSource }, "CanonUpdater: regenerating canon");

  let councilDecisions: any[] = [];
  try {
    councilDecisions = await db
      .select()
      .from(councilDecisionsTable)
      .orderBy(desc(councilDecisionsTable.createdAt))
      .limit(20);
  } catch {
    logger.warn("CanonUpdater: could not fetch council decisions for canon generation");
  }

  const canon = generateMythosAndHistory(councilDecisions);

  let sovereigntyScore: number | null = null;
  try {
    const status = await computeSovereigntyStatus();
    sovereigntyScore = status.sovereigntyScore;
  } catch {
    logger.warn("CanonUpdater: could not compute sovereignty score");
  }

  const newVersion = (await getLatestCanonVersion()) + 1;

  try {
    await db.insert(canonSnapshotsTable).values({
      version: newVersion,
      testaments: canon.testaments,
      books: canon.books,
      chapters: canon.chapters,
      totalBooks: canon.totalBooks,
      totalChapters: canon.totalChapters,
      totalVerses: canon.totalVerses,
      sovereigntyScore,
      triggerSource,
      councilDecisionIds,
      metadata: {
        sovereigntyAlignment: canon.sovereigntyAlignment,
        generatedAt: canon.generatedAt,
        agentContributors: 7,
      },
    });
  } catch (err) {
    logger.error({ err }, "CanonUpdater: failed to persist canon snapshot");
  }

  cachedCanon = canon;
  cachedVersion = newVersion;

  logger.info(
    { version: newVersion, books: canon.totalBooks, chapters: canon.totalChapters, verses: canon.totalVerses },
    "CanonUpdater: canon regenerated and persisted",
  );

  return canon;
}

export async function getCanonHistory(limit: number = 10): Promise<any[]> {
  const rows = await db
    .select({
      id: canonSnapshotsTable.id,
      version: canonSnapshotsTable.version,
      generatedAt: canonSnapshotsTable.generatedAt,
      totalBooks: canonSnapshotsTable.totalBooks,
      totalChapters: canonSnapshotsTable.totalChapters,
      totalVerses: canonSnapshotsTable.totalVerses,
      sovereigntyScore: canonSnapshotsTable.sovereigntyScore,
      triggerSource: canonSnapshotsTable.triggerSource,
      metadata: canonSnapshotsTable.metadata,
    })
    .from(canonSnapshotsTable)
    .orderBy(desc(canonSnapshotsTable.version))
    .limit(limit);

  return rows.map((r) => ({
    ...r,
    generatedAt: r.generatedAt?.toISOString() ?? null,
  }));
}

export async function getCanonByVersion(version: number): Promise<CanonOutput | null> {
  const rows = await db
    .select()
    .from(canonSnapshotsTable)
    .where(sql`${canonSnapshotsTable.version} = ${version}`)
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    testaments: row.testaments as any[],
    books: row.books as any[],
    chapters: row.chapters as Record<string, any[]>,
    totalBooks: row.totalBooks,
    totalChapters: row.totalChapters,
    totalVerses: row.totalVerses,
    generatedAt: (row.generatedAt ?? new Date()).toISOString(),
    sovereigntyAlignment: (row.metadata as any)?.sovereigntyAlignment ?? "",
  };
}

export function getCachedVersion(): number {
  return cachedVersion;
}

export function invalidateCanonCache(): void {
  cachedCanon = null;
  cachedVersion = 0;
}
