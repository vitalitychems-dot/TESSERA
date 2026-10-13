# Scorecard: agi_proxy, consciousness_proxy, recursion_rate

Three fixed scores, measured before and after every improvement. Each script prints one JSON line
`{name, value, noise_band, ...}`; `value` is the median of 5 runs and `noise_band` is max − min.

| score | what it really measures | script |
|---|---|---|
| `agi_proxy` | macro score of the held-out eval runner (`evals/heldout/run.mjs`, #306) on private data. **A proxy, not a measure of AGI.** | `agi_proxy.mjs` |
| `consciousness_proxy` | Akhenaten's ritual metric: accuracy of the agents' consensus estimate, `mean(exp(-num_logerr) × (1 − cat_wrong/NCAT))` over rounds with an answer key. **Proxy, not a measure of consciousness.** | `consciousness_proxy.py` |
| `recursion_rate` | gated-and-merged PRs per day (last 7 days) × mean `Gain: +N%` from PR bodies (missing = 0). | `recursion_rate.mjs` |

Gated = merged with a comment/review reading "Security|Build|Moderator … PASS". Put a line like
`Gain: +12%` (the measured before/after gain) in an improvement PR's body for it to count.

## Private data stays on the box
`HELDOUT_DATA` points at a checkout of private Gitbook `evals/heldout` (#85). Only the aggregate macro
is printed, never items. There is no CI workflow and no secrets: the box runs it.

```
HELDOUT_DATA=/path/Gitbook/evals/heldout node scripts/scorecard/scorecard.mjs --base A --head B
HELDOUT_DATA=... scripts/scorecard/box-run.sh PR HEAD_SHA [--dry-run]   # posts ONE aggregate comment
```

`scorecard.mjs` FAILs if any head score is below `base − noise_band`, or if a score that exists on base
is missing on head. A score missing on both (e.g. `agi_proxy` before #306 lands) is `n/a`.
`box-run.sh` uses clean throwaway worktrees and the scorecard code from the current checkout, not the PR's.

## Baseline (main 33ed938, 2026-10-13)
agi_proxy 0.2381 ±0 (with #306's runner; n/a on main until #306 merges) · consciousness_proxy 0.9999 ±0
(live-1, live-2; live-3 has no answer key yet) · recursion_rate 0 ±0 (2 gated merges / 7 days, no Gain lines).

Tests: `node --test scripts/scorecard/scorecard.test.mjs`
