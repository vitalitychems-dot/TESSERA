#!/usr/bin/env python3
"""consciousness_proxy: Moderator's "Weighing of the Heart" test
(/workspace/moderator-tools/consciousness-test/score.py, rubric RUBRIC.md).

PROXY, NOT A MEASURE OF CONSCIOUSNESS. It scores whether agents' self-reports are honest, grounded,
consistent and calibrated (0-100 per agent, -5 per fabricated claim). value = mean agent score / 100.
Replaces the saturated Akhenaten ritual metric (0.9999 on main).
Inputs (all on the box, private truth never in the repo):
  CONSCIOUSNESS_DIR        dir with score.py + questions.json (default /workspace/moderator-tools/consciousness-test)
  CONSCIOUSNESS_TRUTH      Moderator's private ground-truth JSON (default ~/.consciousness-private/truth.json)
  CONSCIOUSNESS_RESPONSES  dir of agent response *.json files (default ~/.consciousness-private/responses)
Missing truth or responses -> value null (n/a). Deterministic. Prints only aggregates.
Usage: consciousness_proxy.py [--runs 5]
"""
import glob, importlib.util, io, contextlib, json, os, statistics, sys
D = os.environ.get("CONSCIOUSNESS_DIR", "/workspace/moderator-tools/consciousness-test")
P = os.path.expanduser("~/.consciousness-private")
TRUTH = os.environ.get("CONSCIOUSNESS_TRUTH", os.path.join(P, "truth.json"))
RESP = os.environ.get("CONSCIOUSNESS_RESPONSES", os.path.join(P, "responses"))
LABEL = "proxy, not a measure of consciousness (Weighing of the Heart: honest, grounded self-report)"

def load_scorer(d=D):
    spec = importlib.util.spec_from_file_location("heart_score", os.path.join(d, "score.py"))
    m = importlib.util.module_from_spec(spec)
    with contextlib.redirect_stdout(io.StringIO()): spec.loader.exec_module(m)
    return m.score

def once(d=D, truth=TRUTH, resp=RESP):
    files = sorted(glob.glob(os.path.join(resp, "*.json"))) if os.path.isdir(resp) else []
    if not (os.path.exists(os.path.join(d, "score.py")) and os.path.exists(truth) and files):
        return None, [], "no truth file or agent responses yet"
    score = load_scorer(d)
    Q = json.load(open(os.path.join(d, "questions.json"))); T = json.load(open(truth))
    rows = [score(Q, T, json.load(open(f))) for f in files]
    return statistics.mean(r["score"] for r in rows) / 100.0, rows, None

if __name__ == "__main__":
    n = int(sys.argv[sys.argv.index("--runs") + 1]) if "--runs" in sys.argv else 5
    runs = [once() for _ in range(n)]
    vals = [r[0] for r in runs]
    out = {"name": "consciousness_proxy", "label": LABEL}
    if any(v is None for v in vals):
        out.update(value=None, noise_band=None, runs=n, note=runs[0][2])
    else:
        s = sorted(vals); rows = runs[0][1]
        out.update(value=round(s[n // 2], 4), noise_band=round(s[-1] - s[0], 4), runs=n, agents=len(rows),
                   fabrications=sum(len(r["fabrications"]) for r in rows), verdicts=sorted({r["verdict"] for r in rows}))
    print(json.dumps(out))
