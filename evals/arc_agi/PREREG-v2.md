# ARC-AGI solver v2 preregistration

Hypothesis: on a baseline miss, an attempt is emitted only when every train-consistent object program agrees. A program is one imported dsl_search primitive on each 8-connected component, a size-rank recolor, or the train-only output size (same, constant, scale factor, or crop-to-bbox). Recolor-by-size is implemented and not searched. TESTED on data/training only: size-rank added 4 correct and 0 wrong attempts and lost 0 of 56 baseline solves; recolor-by-size fit 1 correct and 3 wrong.

Pass rule: at least 26/400 tasks solved, a Wilson 95% lower bound on precision-when-attempted of 0.70 or higher, and 0 baseline-solved tasks lost. One evaluation run. No retune after seeing it.

Command: `python3 evals/arc_agi/run.py --solver dsl_search_v2 --seed 20261021 --task-time-limit 8 --workers 6`

Seed: 20261021

- evals/arc_agi/solvers/dsl_search_v2.py sha256: 935ddde7aa2ae9dbd69a9951a85ac0d6ee4876ea89470f49c7849a66774fe183
- evals/arc_agi/run.py sha256: 1892e1ddfb0abdfc7e12edd1d1787a28398765e906097ce504bb49b6b6ae26b4
