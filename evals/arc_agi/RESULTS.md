# ARC-AGI-1 baseline

Headline: **20 / 400 tasks** solved on the full public evaluation split. 95% CI **[0.033, 0.076]**.

Predictions correct on that same run: 23 / 419. Wall time 75.6 s (cap not hit). Run directory: `results/20261021T220320Z`.

Einstein's final on `#526` at `014f669f` is OK-WITH-FIXES. An independent rerun of the preregistered command reproduced the scores: 23/419 predictions and 20/400 tasks. That audit read the summary key `confidence_calibration`.

## Erratum

The pull request text said the solver uses 47 transforms. The code that ran (`solvers/dsl_search.py`, commit `953b4a45`) has **44** entries in `PRIMITIVES`. The preregistration text was corrected after the run. The scoring rules did not change. After that audit the summary key was renamed `confidence_calibration` to `confidence_counts`; the bin counts were not changed.

## Per-task logs

`results/20261021T220320Z/tasks.json` and `results/20261021T220320Z/confidence.jsonl` stay gitignored. Those logs include wall-clock fields, so this file records the stable canonical sha256 values instead. Both were recomputed here from the pinned evaluation files and from a full rerun of `solvers/dsl_search.py` (`--seed 20261021 --task-time-limit 8 --total-time-limit 600 --workers 6`). Each full digest matches the audit prefix and suffix.

- Dataset sha256, over the 400 evaluation files in sorted filename order, updating with `filename + NUL + file bytes`: `4d9a15441fd20199f4fb419641ead13aaef357695abcc7e0ea243e3548a16dfb`
- Prediction sha256, over the canonical per-task record (correctness, attempt count, confidence, programs, `n_consistent`, depth, timeout flag; `seconds` removed), serialized with `json.dumps(..., sort_keys=True, separators=(",", ":"))` by [`canonical.py`](canonical.py) (`canonical_predictions` / `prediction_sha256`; recompute with `python3 evals/arc_agi/canonical.py <tasks.json>`): `053614f979f55874abf7025bf7c459c869395571190256579c9eb186f2a0caa9`

## Self-reported confidence

Counts from the baseline summary, renamed so they are not read as a reliability result:

| Bin | n | correct |
| --- | ---: | ---: |
| 0.50-0.75 | 3 | 2 |
| 0.75-1.00 | 23 | 21 |

The 0.50-0.75 bin has n=3, 95% CI [0.21, 0.94]. That is too small to interpret.

summary.json key renamed post-run (confidence_calibration→confidence_counts); values unchanged.
