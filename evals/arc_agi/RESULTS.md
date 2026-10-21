# ARC-AGI-1 baseline

Headline: **20 / 400 tasks** solved on the full public evaluation split. 95% CI **[0.033, 0.076]**.

Predictions correct on that same run: 23 / 419. Wall time 75.6 s (cap not hit). Run directory: `results/20261021T220320Z`.

The final OK waits on Einstein's cloud rerun `bc-c67d08c3`.

## Erratum

The pull request text said the solver uses 47 transforms. The code that ran (`solvers/dsl_search.py`, commit `953b4a45`) has **44** entries in `PRIMITIVES`. The preregistration text was corrected after the run. The code and the scoring rules did not change.

## Per-task logs

`results/20261021T220320Z/tasks.json` and `results/20261021T220320Z/confidence.jsonl` are listed in `evals/arc_agi/.gitignore` and are not in commit `014f669f` or any other commit on this branch. The bytes are not in the repository, so this file does not invent sha256 hashes for them. Add the files, or their hashes, once the baseline artifacts are recovered.

## Self-reported confidence

Counts from the baseline summary, renamed so they are not read as a reliability result:

| Bin | n | correct |
| --- | ---: | ---: |
| 0.50-0.75 | 3 | 2 |
| 0.75-1.00 | 23 | 21 |

The 0.50-0.75 bin has n=3, 95% CI [0.21, 0.94]. That is too small to interpret.
