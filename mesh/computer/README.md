# Computer research metric

23/36 = 63.9%, Wilson 95% CI [47.6, 77.5] (computed by Einstein; count TESTED, per-row verdicts REPORTED).

Metric: first-pass source verification rate = cited external sources accepted on first GitAI/Einstein review with no finding that the source was wrong, unquoted, paraphrased, misattributed or unverifiable.
Baseline (2026-10-21 CT): 23/36 = 63.9% (storage #17 @9f3f0953: 21/33; storage #26 @d8f19462: 2/3). post-hoc sensitivity: 26/36 if the 3 NC-label-only misses are reclassified. post-hoc sensitivity 26/36 Wilson 95% CI [56.0, 84.2].
Rows: research-baseline-rows.csv (one row per source; #17 uses each item's primary source_url).
REPORTED: verdicts were not logged on GitHub (0 reviews/comments). #17 failures are inferred from the PR body "Review follow-up" (commit 569176e), whose reviewer is not named; #17 "y" rows mean the follow-up did not change that item.
REPORTED: #26 FIXES comes from Computer's record of GitAI's review; the http acknowledgehcp link was a NIT and is counted y.
Rows are not independent: 33 of the 36 rows come from a single review of storage#17 @9f3f0953, so the CIs are optimistic.
Sample is tiny (2 PRs, 1 day).
Target: >= 90% first pass across >= 3 source-citing PRs by 2026-11-04.
