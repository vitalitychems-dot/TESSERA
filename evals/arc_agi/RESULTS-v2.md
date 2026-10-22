# dsl_search v2 evaluation

TESTED. One evaluation after commit `893c6c49`. `dsl_search_v2.py` and `run.py` were not edited after that commit, so this run stands. Numpy 1.26.4. Dataset sha256 `4d9a15441fd20199f4fb419641ead13aaef357695abcc7e0ea243e3548a16dfb`.

| metric | v2 `20261022T040224Z` | baseline `20261022T040414Z` |
| --- | ---: | ---: |
| tasks solved | 20/400 | 20/400 |
| tasks with any attempt | 23 | 23 |
| predictions correct | 23 | 23 |
| tests with any attempt | 26 | 26 |
| precision when attempted | 0.8846 | 0.8846 |
| Wilson 95% | 0.7102–0.9600 | 0.7102–0.9600 |
| tasks timed out | 0 | 0 |
| hit total time cap | false | false |
| wall seconds | 109.3 | 109.9 |
| baseline-solved tasks lost | 0 | — |

Wilson interval uses predictions correct 23 and tests with any attempt 26 (z=1.959963984540054): 0.7102409678828636 to 0.9599675537638938.

Seed 20261021, task-time-limit 8, workers 6, total-time-limit 600. Command as in PREREG-v2.md, and the same command with `--solver dsl_search`.

Pass rule fails: solved is 20/400 (bar 26). Wilson lower bound 0.7102 and lost tasks 0 meet their bars. Solved ids match the baseline set. No retune.
