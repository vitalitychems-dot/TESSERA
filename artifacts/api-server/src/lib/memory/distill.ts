import { createHash } from "node:crypto";
import { scoreBm25 } from "./bm25";
import { tokenize } from "./text";
import type { InteractionRecord, Lesson, RetrievedLesson } from "./types";

function recordText(record: InteractionRecord): string {
  return `${record.input}\n${record.output}\n${record.tags.join(" ")}`;
}

function uniqueTokens(text: string): Set<string> {
  return new Set(tokenize(text));
}

function overlap(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const token of left) {
    if (right.has(token)) count += 1;
  }
  return count;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  const shared = overlap(left, right);
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : shared / union;
}

function topTerms(records: InteractionRecord[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    for (const token of tokenize(recordText(record))) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function lessonId(evidenceIds: string[]): string {
  const digest = createHash("sha256").update([...evidenceIds].sort().join("|")).digest("hex").slice(0, 12);
  return `lesson-${digest}`;
}

function summarize(records: InteractionRecord[], terms: string[]): string {
  const sample = records[0]?.output.trim().replace(/\s+/g, " ").slice(0, 180) ?? "";
  return `Pattern across ${records.length} interaction(s): ${terms.slice(0, 6).join(", ")}. Example: ${sample}`;
}

/**
 * Group stored interactions into lessons. One interaction is enough to
 * produce a lesson. Related interactions share a lesson when their tokens
 * overlap. Confidence rises with repeated evidence and is capped below 1.
 */
export function distillLessons(records: InteractionRecord[]): Lesson[] {
  const clusters: InteractionRecord[][] = [];
  for (const record of records) {
    const tokens = uniqueTokens(recordText(record));
    let placed = false;
    for (const cluster of clusters) {
      const clusterTokens = uniqueTokens(cluster.map(recordText).join("\n"));
      if (overlap(tokens, clusterTokens) >= 3 || jaccard(tokens, clusterTokens) >= 0.34) {
        cluster.push(record);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push([record]);
  }
  return clusters.map((cluster) => {
    const evidenceIds = cluster.map((record) => record.id);
    const terms = topTerms(cluster, 12);
    const confidence = Math.min(0.95, Number((0.45 + 0.15 * (cluster.length - 1)).toFixed(2)));
    return {
      id: lessonId(evidenceIds),
      fact: summarize(cluster, terms),
      evidenceIds,
      confidence,
      terms,
    };
  });
}

/** Rank lessons for a query with BM25. A zero score means no shared terms. */
export function retrieveLessons(lessons: Lesson[], query: string, limit = 3): RetrievedLesson[] {
  const scores = scoreBm25(
    lessons.map((lesson) => ({ id: lesson.id, text: `${lesson.fact} ${lesson.terms.join(" ")}` })),
    query,
  );
  return lessons
    .map((lesson) => ({ ...lesson, score: scores.get(lesson.id) ?? 0 }))
    .filter((lesson) => lesson.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit);
}
