#!/usr/bin/env python3
"""ARC-AGI-1 public evaluation harness ($0, local, stdlib + numpy).

Scores a solver plugin on fchollet/ARC-AGI data/evaluation (pinned commit):
  predictions correct: test outputs where any of <= 2 attempts matches exactly (out of 419)
  tasks solved:        tasks where every test output is correct (out of 400)
See PREREGISTRATION.md for the fixed rules. Writes evals/arc_agi/results/<UTC timestamp>/.
"""
import argparse, hashlib, importlib.util, io, json, multiprocessing as mp, os, platform, random
import subprocess, sys, time, urllib.request, zipfile
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ARC_REPO = "fchollet/ARC-AGI"
ARC_SHA = "399030444e0ab0cc8b4e199870fb20b863846f34"
EXPECTED_TASKS, EXPECTED_TESTS = 400, 419
MAX_ATTEMPTS = 2


def fetch_dataset(cache):
    dest = os.path.join(cache, ARC_SHA, "evaluation")
    if os.path.isdir(dest) and len(os.listdir(dest)) == EXPECTED_TASKS:
        return dest
    url = f"https://codeload.github.com/{ARC_REPO}/zip/{ARC_SHA}"
    data = urllib.request.urlopen(url, timeout=120).read()
    os.makedirs(dest, exist_ok=True)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        for n in z.namelist():
            if "/data/evaluation/" in n and n.endswith(".json"):
                with open(os.path.join(dest, os.path.basename(n)), "wb") as f:
                    f.write(z.read(n))
    return dest


def load_tasks(d):
    tasks, h = {}, hashlib.sha256()
    for fn in sorted(os.listdir(d)):
        if fn.endswith(".json"):
            raw = open(os.path.join(d, fn), "rb").read()
            h.update(fn.encode() + b"\0" + raw)
            tasks[fn[:-5]] = json.loads(raw)
    return tasks, h.hexdigest()


def load_solver(path):
    spec = importlib.util.spec_from_file_location("arc_solver", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_SOLVER = None

def _init(path):
    global _SOLVER
    _SOLVER = load_solver(path)


def _run_task(args):
    tid, task, limit, cfg = args
    train = [(p["input"], p["output"]) for p in task["train"]]
    tests = [p["input"] for p in task["test"]]
    t0 = time.monotonic()
    try:
        res = _SOLVER.solve(train, tests, limit, cfg)
        err = None
    except Exception as e:  # a crash scores as no attempts
        res, err = [{"attempts": [], "confidence": 0.0, "meta": {}} for _ in tests], repr(e)[:200]
    return tid, res, round(time.monotonic() - t0, 3), err


def env_info(cmd):
    def sh(*a):
        try:
            return subprocess.run(a, cwd=HERE, capture_output=True, text=True, timeout=10).stdout.strip()
        except Exception:
            return None
    cpu = None
    try:
        cpu = next(l.split(":", 1)[1].strip() for l in open("/proc/cpuinfo") if l.startswith("model name"))
    except Exception:
        cpu = platform.processor()
    try:
        import numpy
        npv = numpy.__version__
    except Exception:
        npv = None
    return {"command": cmd, "python": sys.version.split()[0], "packages": {"numpy": npv},
            "platform": platform.platform(), "cpu": cpu, "cpu_count": os.cpu_count(),
            "git_commit": sh("git", "rev-parse", "HEAD"), "git_dirty": bool(sh("git", "status", "--porcelain", "--", ".")),
            "dataset": {"repo": ARC_REPO, "commit": ARC_SHA, "split": "data/evaluation"}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--solver", default=os.path.join(HERE, "solvers", "dsl_search.py"))
    ap.add_argument("--config", default='{"depth": 2, "retry_depth": 3, "max_programs": 50}', help="JSON for the solver")
    ap.add_argument("--seed", type=int, default=20261021, help="orders tasks and draws --subset")
    ap.add_argument("--subset", type=int, default=0, help="score only N seeded-random tasks (0 = all 400)")
    ap.add_argument("--task-time-limit", type=float, default=8.0, help="seconds per task (solver deadline)")
    ap.add_argument("--total-time-limit", type=float, default=600.0, help="wall cap; unstarted tasks score 0")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--cache", default=os.path.join(HERE, ".data"))
    ap.add_argument("--out", default=os.path.join(HERE, "results"))
    a = ap.parse_args()
    cmd = " ".join([os.path.basename(sys.executable)] + [os.path.relpath(sys.argv[0])] + sys.argv[1:])
    cfg = json.loads(a.config)

    tasks, ds_hash = load_tasks(fetch_dataset(a.cache))
    n_tests = sum(len(t["test"]) for t in tasks.values())
    if (len(tasks), n_tests) != (EXPECTED_TASKS, EXPECTED_TESTS):
        sys.exit(f"dataset count mismatch: {len(tasks)} tasks / {n_tests} tests")
    ids = sorted(tasks)
    random.Random(a.seed).shuffle(ids)
    if a.subset:
        ids = ids[:a.subset]

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = os.path.join(a.out, stamp)
    os.makedirs(out, exist_ok=True)
    env = env_info(cmd)
    env["dataset"]["sha256_of_files"] = ds_hash

    t_start = time.monotonic()
    done = {}
    conf_log = open(os.path.join(out, "confidence.jsonl"), "w")
    jobs = [(tid, tasks[tid], a.task_time_limit, cfg) for tid in ids]
    pool = mp.get_context("fork").Pool(a.workers, initializer=_init, initargs=(a.solver,), maxtasksperchild=50)
    it = pool.imap_unordered(_run_task, jobs)
    hit_cap = False
    while len(done) < len(jobs):
        remaining = a.total_time_limit - (time.monotonic() - t_start)
        if remaining <= 0:
            hit_cap = True
            break
        try:
            tid, res, secs, err = it.next(timeout=remaining)
        except mp.TimeoutError:
            hit_cap = True
            break
        task = tasks[tid]
        rows = []
        for i, t in enumerate(task["test"]):
            r = res[i] if i < len(res) else {"attempts": [], "confidence": 0.0, "meta": {}}
            att = (r.get("attempts") or [])[:MAX_ATTEMPTS]
            ok = any(x == t["output"] for x in att)
            rows.append({"test_index": i, "correct": ok, "n_attempts": len(att),
                         "confidence": r.get("confidence", 0.0), "meta": r.get("meta", {})})
            conf_log.write(json.dumps({"task": tid, "test_index": i, "confidence": r.get("confidence", 0.0),
                                       "n_attempts": len(att), "correct": ok, "seconds": secs}) + "\n")
        done[tid] = {"tests": rows, "solved": all(x["correct"] for x in rows), "seconds": secs, "error": err}
    pool.terminate()
    conf_log.close()
    wall = round(time.monotonic() - t_start, 1)

    scored_tests = sum(len(tasks[t]["test"]) for t in ids)
    preds = sum(x["correct"] for d in done.values() for x in d["tests"])
    solved = sum(d["solved"] for d in done.values())
    attempted = [d for d in done.values() if any(x["n_attempts"] for x in d["tests"])]
    buckets = {}
    for d in done.values():
        for x in d["tests"]:
            if x["n_attempts"]:
                b = min(int(x["confidence"] * 4), 3)
                lo = b / 4
                k = f"{lo:.2f}-{lo + 0.25:.2f}"
                s = buckets.setdefault(k, [0, 0])
                s[0] += 1
                s[1] += x["correct"]
    summary = {
        "harness": "evals/arc_agi/run.py", "solver": os.path.relpath(a.solver, HERE), "solver_config": cfg,
        "seed": a.seed, "subset": a.subset or None, "task_time_limit_s": a.task_time_limit,
        "total_time_limit_s": a.total_time_limit, "workers": a.workers, "max_attempts": MAX_ATTEMPTS,
        "tasks_in_run": len(ids), "tests_in_run": scored_tests, "tasks_finished": len(done),
        "hit_total_time_cap": hit_cap, "wall_seconds": wall,
        "predictions_correct": preds, "predictions_denominator": scored_tests,
        "tasks_solved": solved, "tasks_denominator": len(ids),
        "full_split_denominators": {"predictions": EXPECTED_TESTS, "tasks": EXPECTED_TASKS},
        "tests_with_any_attempt": sum(1 for d in done.values() for x in d["tests"] if x["n_attempts"]),
        "tasks_with_any_attempt": len(attempted),
        "precision_when_attempted": round(preds / max(1, sum(1 for d in done.values() for x in d["tests"] if x["n_attempts"])), 4),
        "confidence_calibration": {k: {"n": v[0], "correct": v[1]} for k, v in sorted(buckets.items())},
        "solved_task_ids": sorted(t for t, d in done.items() if d["solved"]),
        "environment": env, "utc_timestamp": stamp,
    }
    json.dump(summary, open(os.path.join(out, "summary.json"), "w"), indent=2)
    json.dump(done, open(os.path.join(out, "tasks.json"), "w"))
    print(json.dumps({k: summary[k] for k in ("predictions_correct", "predictions_denominator", "tasks_solved",
                                               "tasks_denominator", "tasks_finished", "hit_total_time_cap", "wall_seconds")}))
    print("results:", out)


if __name__ == "__main__":
    main()
