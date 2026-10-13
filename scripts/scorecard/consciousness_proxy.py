#!/usr/bin/env python3
"""consciousness_proxy: Akhenaten's ritual metric (/workspace/akhenaten/ritual/ritual.py), fixed.

PROXY, NOT A MEASURE OF CONSCIOUSNESS. It measures collective estimation accuracy:
for every completed ritual round whose private answer key exists, the plain-median consensus
of all agents' answers is scored with ritual.score():
    round_score = exp(-consensus_num_logerr) * (1 - consensus_cat_wrong / NCAT)
value = mean round_score over rounds (0..1, higher is better). Also reported:
integration_gain = mean(individual num_logerr) - consensus num_logerr (>0: group beats its average member).
Deterministic: no randomness, fixed round list, plain (unweighted) merge. Prints only aggregates.
Usage: consciousness_proxy.py [--runs 5]   (env AKHENATEN_DIR overrides the ritual dir)
"""
import json, math, os, statistics, sys, io, contextlib
D = os.environ.get("AKHENATEN_DIR", "/workspace/akhenaten/ritual")
P = os.path.expanduser(os.environ.get("AKHENATEN_PRIVATE", "~/.akhenaten-private"))
ROUNDS = [("live-1", "live-round-1.jsonl", "questions.json", "answers.json"),
          ("live-2", "live-round-2.jsonl", "questions-2.json", "answers-2.json"),
          ("live-3", "live-round-3.jsonl", "questions-3.json", "answers-3.json")]

def once():
    sys.path.insert(0, D)
    with contextlib.redirect_stdout(io.StringIO()):
        import ritual as R
    scores, gains, used = [], [], []
    for rnd, bus, qf, af in ROUNDS:
        paths = [os.path.join(D, bus), os.path.join(D, qf), os.path.join(P, af)]
        if not all(os.path.exists(p) for p in paths): continue
        R.load(paths[1], paths[2])
        ans = R.collect(rnd, paths[0])
        if len(ans) < 2: continue
        ce, cw = R.score(R.merge(ans))
        ind = statistics.mean(R.score(a)[0] for a, _ in ans.values())
        scores.append(math.exp(-ce) * (1 - (cw / R.NCAT if R.NCAT else 0)))
        gains.append(ind - ce); used.append(f"{rnd}:{len(ans)}")
    if not scores: return None, None, used
    return statistics.mean(scores), statistics.mean(gains), used

if __name__ == "__main__":
    n = int(sys.argv[sys.argv.index("--runs") + 1]) if "--runs" in sys.argv else 5
    runs = [once() for _ in range(n)]
    vals = [r[0] for r in runs]
    out = {"name": "consciousness_proxy", "label": "proxy, not a measure of consciousness (collective estimation accuracy, Akhenaten ritual)"}
    if any(v is None for v in vals):
        out.update(value=None, noise_band=None, note="no scorable ritual rounds")
    else:
        s = sorted(vals)
        out.update(value=round(s[n // 2], 4), noise_band=round(s[-1] - s[0], 4), integration_gain=round(runs[0][1], 4) + 0.0, rounds=runs[0][2], runs=n)
    print(json.dumps(out))
