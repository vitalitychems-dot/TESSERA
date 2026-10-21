# ARC-AGI-1 baseline run 20261021T220320Z (TESTED)

- Split: full public evaluation set (400 tasks / 419 test outputs), fchollet/ARC-AGI @ 3990304, seed 20261021.
- Solver: `solvers/dsl_search.py`, `{"depth": 2, "retry_depth": 3, "max_programs": 50}`, 2 attempts, 8 s/task, 600 s cap, 6 workers.
- **Predictions correct: 23 / 419. Tasks solved: 20 / 400.**
- All 400 tasks finished in 75.6 s wall (cap not hit, 0 solver errors, slowest task 4.77 s).
- Attempted 26 test outputs (23 tasks); 23 correct (precision 0.885). Calibration: conf 0.75-1.00 -> 21/23 correct; 0.50-0.75 -> 2/3.
- Command: `python3 evals/arc_agi/run.py --seed 20261021 --task-time-limit 8 --total-time-limit 600 --workers 6`
- Environment: Python 3.13.5, numpy 2.5.4, Linux 6.12 x86_64, Intel Xeon (8 vCPU), git 953b4a45 (clean). Dataset sha256 4d9a1544...a16dfb.
- The 172/419 and 157/400 figures remain reported, unverified; this run does not reproduce them.
