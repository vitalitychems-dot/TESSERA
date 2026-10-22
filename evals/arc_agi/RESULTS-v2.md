# dsl_search v2: FAIL vs prereg (20/400 = baseline)

TESTED one eval after `893c6c49` (solver files unchanged). Numpy 1.26.4. Dataset sha256 `4d9a15441fd20199f4fb419641ead13aaef357695abcc7e0ea243e3548a16dfb`. Development on training only is REPORTED. Do not re-run this eval split.
A v3 needs a new training-only prereg plus a held-out training split before any eval, to catch the train-to-eval gap (REPORTED +4 on train, TESTED 0 on eval).
It also needs a positive control on one training task that must fire the path, and an evaluated/fired counter recorded for every test. No eval re-run.

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

The Wilson 95% lower bound 0.7102 is on precision-when-attempted (23/26), identical to baseline (interval 0.7102409678828636 to 0.9599675537638938, z=1.959963984540054). It is not a bound on 20/400; that interval is 0.0326–0.0760. Seed 20261021, task-time-limit 8, workers 6, total-time-limit 600. Both canonical digests `053614f979f55874abf7025bf7c459c869395571190256579c9eb186f2a0caa9` (`canonical.py` on each `tasks.json`; not re-run).

0/419 tests emitted a consensus-path attempt (key absent); evaluation of the path not independently shown. Pass rule fails: 20/400 (bar 26). That 0.7102 figure is the precision-when-attempted lower bound above, and 0 lost tasks meet their bar. No retune.
