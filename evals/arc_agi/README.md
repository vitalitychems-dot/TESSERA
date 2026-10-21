# ARC-AGI-1 eval harness

Local, $0. Python 3 + numpy. Rules: [PREREGISTRATION.md](PREREGISTRATION.md).

```
python3 evals/arc_agi/run.py                      # full 400-task evaluation split
python3 evals/arc_agi/run.py --subset 40          # seeded random subset
python3 evals/arc_agi/run.py --solver path/to/solver.py --config '{"depth": 3}'
```

- Downloads the pinned evaluation split to `evals/arc_agi/.data/` (gitignored) and checks
  400 tasks / 419 test outputs.
- Solver plugin: a file with `solve(train, tests, time_limit, config)` returning, per test
  input, `{"attempts": [grid, grid], "confidence": float, "meta": {...}}`. See
  `solvers/dsl_search.py`.
- Output: `results/<UTC timestamp>/summary.json` (scores, config, environment, command;
  committed), `tasks.json` and `confidence.jsonl` (per task / per test; gitignored).
