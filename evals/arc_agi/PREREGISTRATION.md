# ARC-AGI-1 baseline: preregistration

Written and committed before the first scored run. Changing any item below makes a new
run type; report it separately and do not compare it as the same baseline.

## Data
- Split: public ARC-AGI-1 **evaluation** set, `fchollet/ARC-AGI` `data/evaluation`, pinned
  commit `399030444e0ab0cc8b4e199870fb20b863846f34`.
- Counts (checked by the runner; it exits on mismatch): **400 tasks, 419 test outputs**.
- Integrity: the runner logs a sha256 over the sorted (filename, bytes) of all 400 files
  and exits non-zero if that digest is not the pinned value (`PINNED_DATASET_SHA256` in `run.py`,
  the same digest recorded in `RESULTS.md`). post-run amendment (#540): applies to runs after 20261021T220320Z. That run used `run.py` at `953b4a45`, which did not exit on a digest mismatch.
- No training-split tasks, no hidden/private sets, no test outputs visible to the solver.

## Scoring
- A test output is **correct** if any of at most **2 attempts** equals the expected grid
  exactly (shape and every cell). Extra attempts beyond 2 are dropped before scoring.
- **Predictions** = correct test outputs, out of **419**.
- **Tasks** = tasks whose test outputs are all correct, out of **400**.
- A crash, timeout, empty answer, or task not started before the wall cap scores 0. The
  denominators stay 419 and 400 for a full run.
- Also reported, not part of the score: tests attempted and precision when attempted.
  Self-reported confidence is counted in four buckets. A bucket with n=3 is too small
  to interpret (the 0.50-0.75 bin on the first run is 2/3, 95% CI [0.21, 0.94]).

## Solver (baseline)
- `solvers/dsl_search.py`: breadth-first brute-force search over sequences of 44
  parameter-free grid transforms (rotations/flips, crop, scale, tile, mirror, gravity,
  object crop, halves, half-logic, enclosed fill, symmetry completion, color keep/remove),
  plus a per-program color remap learned from the train pairs.
- Config: `{"depth": 2, "retry_depth": 3, "max_programs": 50}`. Depth 2 first; depth 3
  only when depth 2 finds **no train-consistent program**. This differs from the recorded
  "depth 3 on the misses" method, which picks retries by test-label correctness; this
  harness never uses test labels to decide anything.
- Attempts: the 2 distinct test predictions from the shortest consistent programs (ties:
  more agreeing programs first). Confidence = share of consistent programs that agree
  with attempt 1; 0 when there is no attempt.
- Deterministic. No learned weights, no network calls during solving, $0.

## Seed and limits
- Seed: **20261021** (orders tasks; also selects `--subset` if one is used).
- Per-task time limit: **8 s** (solver deadline, enforced by the harness). A task still running
  at that limit is a failure recorded with a timeout reason. post-run amendment (#540): applies to runs after 20261021T220320Z. That run used `run.py` at `953b4a45`, which did not kill an overrun. Total wall cap: **600 s**. Workers: **6**.
- First run is the full 400-task split. If the wall cap is hit, unstarted tasks score 0
  and the summary says so.

## Command
```
python3 evals/arc_agi/run.py --seed 20261021 --task-time-limit 8 --total-time-limit 600 --workers 6
```
The run records the command, Python and numpy versions, platform, CPU model and count,
and the git commit in `results/<UTC timestamp>/summary.json`.

## Reference numbers
The 172/419 predictions and 157/400 tasks in collab `handoff/score-2026-10-20.md` are
**reported, unverified**: no harness or logs for them were found. They are not a baseline.
This harness's first run is the baseline.

## Errata (after run 20261021T220320Z)
- The solver description said 47 transforms; the committed solver (953b4a45, the code that ran) has **44**. Text fixed; no code or rule changed.
