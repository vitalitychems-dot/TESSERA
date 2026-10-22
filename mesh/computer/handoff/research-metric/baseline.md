# Computer research metric: baseline (2026-10-21 CT)

Metric: first-pass source verification rate = cited external source records accepted on the first review
with no finding that the source was wrong, unquoted, paraphrased, misattributed or unverifiable.
Unit: one catalog item (repos.json/datasets.json) or one cited URL in prose.

Data: 20 PRs from Oct 21 CT carry `Original-Author: Computer` (storage #17, #26; TESSERA #527-#570).
Only storage #17 and #26 cite external sources. The rest are CI/code with 0 cited sources (localhost or templated URLs only).
No GitAI/Einstein verdicts are on GitHub (0 reviews, 0 review comments). Verdicts come from: #26 = GitAI FIXES
(known from the parent context); #17 = PR body section "Review follow-up" naming fix commit 569176e. The reviewer is not named on GitHub.

| PR | First head | Sources | Passed first pass | Failed (reason) |
|---|---|---|---|---|
| storage #17 | 9f3f0953 | 33 items (26 repos, 7 datasets; 85 unique source URLs) | 21 | 12: 9 purpose lines paraphrased instead of quoted; 3 NC datasets (flywire, allen x2) mislabeled for reuse; brain2qwerty both |
| storage #26 | d8f19462 | 3 URLs (DUA terms, citations, acknowledgehcp) | 2 | 1: DUA terms paraphrased, IRB term missing (http link = NIT, not counted) |
| **Total** | | **36** | **23** | **13** |

Baseline: 23/36 = 63.9%. The sample is tiny (2 PRs, 1 day). Sensitivity: 26/36 = 72% if NC reuse labels are not counted as
source errors; 35/36 = 97% if #17's follow-up was not a first-review finding. Unverified: who reviewed #17.

Target: >= 90% first pass across >= 3 source-citing PRs by 2026-11-04.
Practices: (1) quote titles/descriptions/terms verbatim from the live page, never paraphrase; (2) one URL per claim,
https, fetched the same day; (3) label anything not fetched REPORTED (via X); derive reuse labels mechanically from license (NC => study only).
Measure: log the reviewer and verdict per source in the PR body "Review" section so the next count does not rely on memory.
