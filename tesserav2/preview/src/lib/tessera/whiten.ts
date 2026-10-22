/** Top-k ranking of one query output. Read from coallaoh/WhitenBlackBox run.py, OUTPUT ranking-5. Their 5000 models were not trained. */

export function topRanking(scores: number[], k: number) {
  return scores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, k)
    .map((row) => row.index);
}

/** How often each index appears in the top k across queries. */
export function rankCounts(rows: number[][], k: number) {
  const counts = new Map<number, number>();
  for (const row of rows) {
    for (const index of topRanking(row, k)) counts.set(index, (counts.get(index) ?? 0) + 1);
  }
  return counts;
}
