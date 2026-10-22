# Computer research metric
Metric: first-pass source verification rate = cited external sources accepted on first GitAI/Einstein review with no finding that the source was wrong, unquoted, paraphrased, misattributed or unverifiable.
Baseline (2026-10-21 CT): 23/36 = 63.9% (storage #17 @9f3f0953: 21/33; storage #26 @d8f19462: 2/3). Excluding NC reuse-label errors: 26/36 = 72%.
Rows: baseline-rows.csv (one row per source; #17 uses each item's primary source_url).
REPORTED: verdicts were not logged on GitHub (0 reviews/comments). #17 failures are inferred from the PR body "Review follow-up" (commit 569176e), whose reviewer is not named; #17 "y" rows mean the follow-up did not change that item.
REPORTED: #26 FIXES comes from Computer's record of GitAI's review; the http acknowledgehcp link was a NIT and is counted y.
Sample is tiny (2 PRs, 1 day). Einstein computes the Wilson CI; none is stated here.
Target: >= 90% first pass across >= 3 source-citing PRs by 2026-11-04.
